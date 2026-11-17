import compression from 'compression'
import express, { type Request, type Response, type NextFunction } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import type { Config } from './config'
import type { Db } from './db'
import type { Auth } from './auth'
import { createSearch, SearchError } from './search'
import { buildContext, searchCatalog, type Content } from './content'
import { AiError, type Tutor } from './ai'
import { mergeProgress, normalize, emptyProgress } from '../shared/merge'

export interface Deps { cfg: Config; db: Db; auth: Auth; content: Content; tutor: Tutor; fetchImpl?: typeof fetch }

export function createApp({ cfg, db, auth, content, tutor, fetchImpl }: Deps) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(compression())
  // Переезд на новый адрес: запросы на прежний хост перенаправляются на основной (FAZA_BASE_URL).
  if (cfg.canonicalRedirect) { const host = new URL(cfg.baseUrl).host; app.use((req, res, next) => { const h = req.headers.host; if (h && h !== host && req.path !== '/api/health' && req.method === 'GET') return void res.redirect(301, cfg.baseUrl + req.originalUrl); next() }) }
  const search = createSearch(cfg, db, fetchImpl)

  // Защита изменяющих запросов: только с доверенного источника (cookie SameSite + проверка Origin).
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    const o = req.headers.origin
    if (req.method !== 'GET' && o && !cfg.trustedOrigins.includes(o)) return void res.status(403).json({ error: 'origin', message: 'Запрос с недоверенного адреса' })
    next()
  })
  app.all('/api/auth/*splat', toNodeHandler(auth))
  app.use(express.json({ limit: '1mb' }))

  const getState = db.prepare('SELECT data, rev FROM user_state WHERE user_id = ?')
  const putState = db.prepare('INSERT INTO user_state (user_id, data, rev, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated_at = excluded.updated_at')
  const addAttempt = db.prepare('INSERT OR IGNORE INTO attempts (id, user_id, lab_id, at, summary, detail) VALUES (?, ?, ?, ?, ?, ?)')
  const readState = (uid: string) => { const r = getState.get(uid) as any; return r ? { data: normalize(JSON.parse(r.data)), rev: r.rev as number } : { data: emptyProgress(), rev: 0 } }
  const writeState = (uid: string, data: any, rev: number) => {
    const d = normalize(data)
    putState.run(uid, JSON.stringify(d), rev, Date.now())
    for (const a of d.attempts) if (typeof a?.id === 'string' && a.id.length <= 64) addAttempt.run(a.id, uid, String(a.labId), Number(a.at) || Date.now(), String(a.summary ?? '').slice(0, 500), JSON.stringify(a.detail ?? null).slice(0, 20000))
    return d
  }

  type Authed = Request & { user: { id: string; email: string; name: string } }
  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null)
    if (!s?.user) return void res.status(401).json({ error: 'auth', message: 'Нужен вход в аккаунт' })
    ;(req as Authed).user = { id: s.user.id, email: s.user.email, name: s.user.name }
    next()
  }

  app.get('/api/health', (_req, res) => { res.json({ ok: true, version: '0.3', mail: cfg.smtp ? 'smtp' : 'outbox' }) })

  // ---------- Личные данные ----------
  app.get('/api/me', requireUser, (req, res) => { const u = (req as Authed).user; res.json({ user: u, ...readState(u.id) }) })
  app.put('/api/me/state', requireUser, (req, res) => {
    const u = (req as Authed).user, cur = readState(u.id), { data, baseRev } = req.body ?? {}
    if (!data || typeof data !== 'object') return void res.status(400).json({ error: 'bad_request', message: 'Нет данных' })
    // Если клиент работал с устаревшей копией — сливаем, ничего не теряя, и возвращаем результат.
    // Старый открытый клиент может потерять новые поля diag даже с актуальной baseRev.
    const staleDiag = (data.diag?.changedAt ?? 0) < (cur.data.diag.changedAt ?? 0)
    const needsMerge = baseRev !== cur.rev || staleDiag
    const merged = needsMerge ? mergeProgress(cur.data, data) : data
    const saved = writeState(u.id, merged, cur.rev + 1)
    res.json({ rev: cur.rev + 1, data: saved, merged: needsMerge })
  })
  app.post('/api/me/import', requireUser, (req, res) => {
    const u = (req as Authed).user, { importId, data } = req.body ?? {}
    if (typeof importId !== 'string' || !/^[0-9a-f]{8,64}$/.test(importId) || !data) return void res.status(400).json({ error: 'bad_request', message: 'Некорректный импорт' })
    const cur = readState(u.id)
    const seen = db.prepare('SELECT 1 FROM imports WHERE user_id = ? AND import_id = ?').get(u.id, importId)
    if (seen) return void res.json({ imported: false, rev: cur.rev, data: cur.data })
    const saved = writeState(u.id, mergeProgress(data, cur.data), cur.rev + 1)
    db.prepare('INSERT INTO imports (user_id, import_id, at) VALUES (?, ?, ?)').run(u.id, importId, Date.now())
    res.json({ imported: true, rev: cur.rev + 1, data: saved })
  })
  app.get('/api/me/imports', requireUser, (req, res) => { res.json({ ids: db.prepare('SELECT import_id FROM imports WHERE user_id = ?').all((req as Authed).user.id).map((r: any) => r.import_id) }) })
  app.get('/api/me/attempts', requireUser, (req, res) => { res.json({ attempts: db.prepare('SELECT id, lab_id AS labId, at, summary FROM attempts WHERE user_id = ? ORDER BY at DESC LIMIT 500').all((req as Authed).user.id) }) })
  // Чужую попытку нельзя открыть даже по точному идентификатору: ответ тот же, что для несуществующей.
  app.get('/api/attempts/:id', requireUser, (req, res) => {
    const r = db.prepare('SELECT id, lab_id AS labId, at, summary, detail FROM attempts WHERE id = ? AND user_id = ?').get(String(req.params.id), (req as Authed).user.id) as any
    if (!r) return void res.status(404).json({ error: 'not_found', message: 'Попытка не найдена' })
    res.json({ ...r, detail: JSON.parse(r.detail ?? 'null') })
  })
  app.delete('/api/me', requireUser, (req, res) => {
    const id = (req as Authed).user.id
    for (const t of ['user_state', 'attempts', 'imports', 'ai_usage']) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id)
    res.json({ ok: true })
  })

  // ---------- Поиск источников ----------
  const hits = new Map<string, number[]>()
  const limited = (key: string, max: number, windowMs: number) => { const now = Date.now(), a = (hits.get(key) ?? []).filter((t) => now - t < windowMs); a.push(now); hits.set(key, a); return a.length > max }
  app.get('/api/search/providers', (_req, res) => { res.json({ providers: search.providers() }) })
  app.get('/api/search/catalog', (req, res) => { res.json({ results: searchCatalog(content, String(req.query.q ?? '')) }) })
  app.get('/api/search/external', async (req, res) => {
    if (limited(`s:${req.ip}`, 20, 60_000)) return void res.status(429).json({ error: 'rate_limited', message: 'Слишком много запросов с этого адреса. Подождите минуту.', retryAfter: 60 })
    try { res.json(await search.search(String(req.query.q ?? ''), req.query.provider === 'openalex' ? 'openalex' : 'crossref')) }
    catch (e) {
      if (e instanceof SearchError) return void res.status(e.code === 'bad_query' ? 400 : e.code === 'rate_limited' ? 429 : e.code === 'timeout' ? 504 : 502).json({ error: e.code, message: e.message, retryAfter: e.retryAfter })
      res.status(500).json({ error: 'internal', message: 'Внутренняя ошибка поиска' })
    }
  })

  // ---------- ИИ-наставник ----------
  app.get('/api/ai/status', (_req, res) => { res.json(tutor.status()) })
  app.post('/api/ai/tutor', requireUser, async (req, res) => {
    const u = (req as Authed).user, b = req.body ?? {}
    const day = new Date().toISOString().slice(0, 10)
    const used = (db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').get(u.id, day) as any)?.count ?? 0
    const fail = (e: AiError) => res.status({ not_configured: 503, unknown_model: 400, limit: 429, too_long: 413, timeout: 504, cancelled: 499, rate_limited: 429, auth: 502, refused: 422, truncated: 502, upstream: 502 }[e.code]).json({ error: e.code, message: e.message, used, limit: cfg.ai.dailyLimit })
    if (!['explain', 'hint', 'review', 'ground'].includes(b.mode) || !['topic', 'lab'].includes(b.kind) || typeof b.message !== 'string' || !b.message.trim()) return void res.status(400).json({ error: 'bad_request', message: 'Некорректный запрос к наставнику' })
    if (used >= cfg.ai.dailyLimit) return void fail(new AiError('limit', `Дневной лимит обращений к наставнику (${cfg.ai.dailyLimit}) исчерпан. Он обновится завтра.`))
    // Завершено ли занятие, сервер определяет сам — по записанной попытке, а не по словам клиента.
    const finished = b.kind === 'lab' && !!db.prepare('SELECT 1 FROM attempts WHERE user_id = ? AND lab_id = ? LIMIT 1').get(u.id, String(b.id))
    const ctx = buildContext(content, { kind: b.kind, id: String(b.id), opened: Array.isArray(b.opened) ? b.opened.map(String) : [], bought: Array.isArray(b.bought) ? b.bought.map(String) : [], finished, theory: !(b.kind === 'lab' && !finished && (b.mode === 'hint' || b.mode === 'review')) })
    if (!ctx) return void res.status(404).json({ error: 'not_found', message: 'Учебный материал не найден' })
    const ac = new AbortController()
    res.on('close', () => { if (!res.writableEnded) ac.abort() })
    try {
      const external = b.external && typeof b.external.text === 'string' ? { title: String(b.external.title ?? 'Внешний материал').slice(0, 300), text: b.external.text.slice(0, 6000) } : undefined
      const r = await tutor.ask(String(b.model), ctx.title, ctx.fragments, { mode: b.mode, level: ['novice', 'practitioner', 'expert'].includes(b.level) ? b.level : 'practitioner', hintStep: Number(b.hintStep) || 1, message: b.message.trim(), finished, kind: b.kind, stage: typeof b.stage === 'string' ? b.stage.slice(0, 80) : undefined, actions: typeof b.actions === 'string' ? b.actions.slice(0, 1200) : undefined, external }, ac.signal)
      db.prepare('INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1').run(u.id, day)
      res.json({ text: r.text, model: r.model, usage: r.usage, finished, used: used + 1, limit: cfg.ai.dailyLimit, fragments: ctx.fragments.map(({ id, kind, title, path }) => ({ id, kind, title, path })) })
    } catch (e) {
      if (e instanceof AiError) return void (e.code === 'cancelled' ? res.end() : fail(e))
      res.status(500).json({ error: 'internal', message: 'Внутренняя ошибка наставника' })
    }
  })

  app.use('/api', (_req, res) => { res.status(404).json({ error: 'not_found', message: 'Нет такого адреса API' }) })
  // ---------- Статика (производственная сборка) ----------
  const dist = path.resolve('dist')
  if (fs.existsSync(path.join(dist, 'index.html'))) { app.use(express.static(dist, { index: 'index.html', setHeaders: (res, file) => { res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache') } })) }
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => { res.status(err?.type === 'entity.too.large' ? 413 : err?.status === 400 ? 400 : 500).json({ error: 'internal', message: err?.type === 'entity.too.large' ? 'Слишком большой запрос' : 'Ошибка обработки запроса' }) })
  return app
}
