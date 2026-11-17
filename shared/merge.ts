// Слияние двух копий прогресса (локальной и серверной). Чистая функция: используется и в браузере, и на сервере.
// Правило: ничего не теряем — объединяем, а при конфликте берём более позднее или более полное.
export interface Attempt { id: string; labId: string; at: number; summary: string; detail?: any }
export interface SavedSource { key: string; title: string; authors: string; year: string; type: string; doi?: string; url?: string; provider: string; access: string; note?: string; topic?: string; suggested?: boolean; at: number }
import type { Evidence, Result, DiagTrack } from './mastery'
export interface Profile { goal?: string; context?: string; at?: number }
export interface Diag { answers: Record<string, { result: Result; note?: string; value?: string; at: number }>; track?: DiagTrack; changedAt?: number; startedAt?: number; finishedAt?: number }
export interface Settings { level: 'novice' | 'practitioner' | 'expert'; hints: boolean; aiModel?: string }
export interface Progress {
  visited: Record<string, number>; scroll: Record<string, number>
  checks: Record<string, Record<number, number>>
  labs: Record<string, any>
  labDone: Record<string, { at: number; attempts: number; summary?: string }>
  bookmarks: { path: string; title: string; kind: string; at: number }[]
  attempts: Attempt[]; savedSources: SavedSource[]; settings: Settings
  last?: { path: string; title: string; at: number }
  profile: Profile; diag: Diag; evidence: Evidence[]; hints: Record<string, number>
}
export const emptyProgress = (): Progress => ({
  visited: {}, scroll: {}, checks: {}, labs: {}, labDone: {}, bookmarks: [], attempts: [], savedSources: [],
  settings: { level: 'practitioner', hints: true }, profile: {}, diag: { answers: {} }, evidence: [], hints: {},
})
/** Приводит объект любой прошлой версии к текущей форме (миграция данных 0.1 -> 0.2). */
export function normalize(p: any): Progress {
  const e = emptyProgress()
  if (!p || typeof p !== 'object') return e
  return { ...e, ...p, settings: { ...e.settings, ...(p.settings ?? {}) }, attempts: Array.isArray(p.attempts) ? p.attempts : [], savedSources: Array.isArray(p.savedSources) ? p.savedSources : [], bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks : [], profile: p.profile ?? {}, diag: { answers: {}, ...(p.diag ?? {}) }, evidence: Array.isArray(p.evidence) ? p.evidence : [], hints: p.hints ?? {} }
}
const maxMap = (a: Record<string, number>, b: Record<string, number>) => {
  const o: Record<string, number> = { ...a }
  for (const k of Object.keys(b)) o[k] = Math.max(o[k] ?? 0, b[k])
  return o
}
export function mergeProgress(aRaw: any, bRaw: any): Progress {
  const a = normalize(aRaw), b = normalize(bRaw)
  const out = emptyProgress()
  out.visited = maxMap(a.visited, b.visited)
  out.scroll = maxMap(a.scroll, b.scroll)
  for (const k of new Set([...Object.keys(a.checks), ...Object.keys(b.checks)])) {
    const x = a.checks[k] ?? {}, y = b.checks[k] ?? {}
    out.checks[k] = Object.keys(y).length >= Object.keys(x).length ? { ...x, ...y } : { ...y, ...x }
  }
  for (const k of new Set([...Object.keys(a.labs), ...Object.keys(b.labs)])) {
    const x = a.labs[k], y = b.labs[k]
    out.labs[k] = !x ? y : !y ? x : (y._at ?? 0) >= (x._at ?? 0) ? y : x
  }
  for (const k of new Set([...Object.keys(a.labDone), ...Object.keys(b.labDone)])) {
    const x = a.labDone[k], y = b.labDone[k]
    out.labDone[k] = !x ? y : !y ? x : { ...(y.at >= x.at ? y : x), attempts: Math.max(x.attempts, y.attempts) }
  }
  const byKey = <T,>(xs: T[], key: (x: T) => string, newer: (x: T) => number) => {
    const m = new Map<string, T>()
    for (const x of xs) { const k = key(x), old = m.get(k); if (!old || newer(x) >= newer(old)) m.set(k, x) }
    return [...m.values()].sort((p, q) => newer(q) - newer(p))
  }
  out.bookmarks = byKey([...a.bookmarks, ...b.bookmarks], (x) => x.path, (x) => x.at)
  out.attempts = byKey([...a.attempts, ...b.attempts], (x) => x.id, (x) => x.at)
  out.savedSources = byKey([...a.savedSources, ...b.savedSources], (x) => x.key, (x) => x.at)
  out.last = !a.last ? b.last : !b.last ? a.last : b.last.at >= a.last.at ? b.last : a.last
  out.settings = { ...a.settings, ...b.settings }
  const diagChangedAt = Math.max(a.diag.changedAt ?? 0, b.diag.changedAt ?? 0)
  out.evidence = byKey([
    ...a.evidence.filter((e) => e.kind !== 'diag' || (a.diag.changedAt ?? 0) === diagChangedAt),
    ...b.evidence.filter((e) => e.kind !== 'diag' || (b.diag.changedAt ?? 0) === diagChangedAt),
  ], (x) => x.id, (x) => x.at)
  out.profile = (b.profile.at ?? 0) >= (a.profile.at ?? 0) ? b.profile : a.profile
  const da = a.diag, db = b.diag
  if ((da.changedAt ?? 0) !== (db.changedAt ?? 0)) {
    const newer = (da.changedAt ?? 0) > (db.changedAt ?? 0) ? da : db
    out.diag = { ...newer, answers: { ...newer.answers } }
  } else {
    out.diag = { ...da, ...db, answers: { ...da.answers }, startedAt: da.startedAt ?? db.startedAt, finishedAt: Math.max(da.finishedAt ?? 0, db.finishedAt ?? 0) || undefined }
    for (const [k, v] of Object.entries(db.answers)) if (!out.diag.answers[k] || v.at >= out.diag.answers[k].at) out.diag.answers[k] = v
  }
  // Старая копия с другого устройства не должна возвращать ответы и оценки сброшенного теста.
  if (out.diag.changedAt) out.evidence = out.evidence.filter((e) => {
    if (e.kind !== 'diag') return true
    const answer = out.diag.answers[e.src]
    return answer && answer.result !== 'skip' && answer.at === e.at && answer.result === e.result && e.at >= out.diag.changedAt!
  })
  out.hints = maxMap(a.hints, b.hints)
  for (const k of Object.keys(out.labDone)) out.labDone[k].attempts = Math.max(out.labDone[k].attempts, out.attempts.filter((t) => t.labId === k).length)
  return out
}
/** Короткая сводка для окна импорта. */
export function summarize(pRaw: any) {
  const p = normalize(pRaw)
  return {
    topics: Object.keys(p.visited).length,
    answers: Object.values(p.checks).reduce((n, c) => n + Object.keys(c).length, 0),
    labsStarted: Object.keys(p.labs).length, labsDone: Object.keys(p.labDone).length,
    attempts: p.attempts.length, bookmarks: p.bookmarks.length, sources: p.savedSources.length, evidence: p.evidence.length, diagnostic: Object.keys(p.diag.answers).length,
  }
}
export const isEmpty = (p: any) => { const s = summarize(p); return Object.values(s).every((v) => v === 0) }
/** Стабильный отпечаток содержимого — идентификатор импорта, исключает повторное добавление. */
export function fingerprint(p: any) {
  const n = normalize(p)
  const parts: unknown[] = [Object.keys(n.visited).sort(), n.checks, Object.keys(n.labs).sort(), n.labDone, n.bookmarks.map((b) => b.path).sort(), n.attempts.map((t) => t.id).sort(), n.savedSources.map((x) => x.key).sort()]
  // Отпечатки прежнего формата сохраняются; новые ответы диагностики дают новый импорт.
  if (n.diag.track || n.diag.changedAt) parts.push([n.diag.track, n.diag.changedAt, n.diag.answers])
  const s = JSON.stringify(parts)
  let h1 = 0x811c9dc5, h2 = 0x1b873593
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) ^ (h2 >>> 13) }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}
