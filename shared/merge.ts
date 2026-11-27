// Слияние двух копий прогресса (локальной и серверной). Чистая функция: используется и в браузере, и на сервере.
// Правило: ничего не теряем — объединяем, а при конфликте берём более позднее или более полное.
export interface Attempt { id: string; labId: string; at: number; summary: string; detail?: any }
export interface SavedSource { key: string; title: string; authors: string; year: string; type: string; doi?: string; url?: string; provider: string; access: string; note?: string; topic?: string; suggested?: boolean; at: number }
export interface SavedFormulaRecord { id: string; name: string; at: number; presetId?: string; formula: any }
export interface CertifiedGradeRecord { level: number; score: number; at: number }
export interface LabNoteRecord { id: string; kind: 'topic' | 'ingredient' | 'formula'; targetId: string; title: string; text: string; at: number }
export interface CampaignProgressRecord {
  id: string
  stage: number
  choices: Record<string, string>
  labFormula?: any
  labSummary?: { score: number; passed: boolean; costPerKg: number; errors: number; spf?: number; notes: string[] }
  finalScore?: number
  completedAt?: number
  at: number
}
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
  attempts: Attempt[]; savedSources: SavedSource[]; savedFormulas: SavedFormulaRecord[]; settings: Settings
  certifiedGrades: Record<string, CertifiedGradeRecord>
  notes: Record<string, LabNoteRecord>
  campaigns: Record<string, CampaignProgressRecord>
  last?: { path: string; title: string; at: number }
  profile: Profile; diag: Diag; evidence: Evidence[]; hints: Record<string, number>
}
export const emptyProgress = (): Progress => ({
  visited: {}, scroll: {}, checks: {}, labs: {}, labDone: {}, bookmarks: [], attempts: [], savedSources: [], savedFormulas: [],
  certifiedGrades: {}, notes: {}, campaigns: {},
  settings: { level: 'practitioner', hints: true }, profile: {}, diag: { answers: {} }, evidence: [], hints: {},
})
/** Приводит объект любой прошлой версии к текущей форме (миграция данных 0.1 -> 0.2). */
export function normalize(p: any): Progress {
  const e = emptyProgress()
  if (!p || typeof p !== 'object') return e
  const rawGrades = p.certifiedGrades && typeof p.certifiedGrades === 'object' ? p.certifiedGrades : {}
  const certifiedGrades: Record<string, CertifiedGradeRecord> = {}
  for (const [k, v] of Object.entries<any>(rawGrades)) {
    if (v && Number.isFinite(v.level) && Number.isFinite(v.score)) {
      certifiedGrades[String(k)] = { level: Number(v.level), score: Number(v.score), at: Number(v.at ?? 0) }
    }
  }
  const rawNotes = p.notes && typeof p.notes === 'object' ? p.notes : {}
  const notes: Record<string, LabNoteRecord> = {}
  for (const [k, v] of Object.entries<any>(rawNotes)) {
    if (v && typeof v.text === 'string' && v.text.trim()) {
      notes[k] = {
        id: String(v.id ?? k),
        kind: v.kind === 'ingredient' || v.kind === 'formula' ? v.kind : 'topic',
        targetId: String(v.targetId ?? k),
        title: String(v.title ?? k),
        text: v.text,
        at: Number(v.at ?? 0),
      }
    }
  }
  const rawCampaigns = p.campaigns && typeof p.campaigns === 'object' ? p.campaigns : {}
  const campaigns: Record<string, CampaignProgressRecord> = {}
  for (const [k, v] of Object.entries<any>(rawCampaigns)) {
    if (v && typeof v === 'object') {
      campaigns[k] = {
        id: String(v.id ?? k),
        stage: Number.isFinite(v.stage) ? Math.max(0, Math.min(5, Number(v.stage))) : 0,
        choices: v.choices && typeof v.choices === 'object' ? { ...v.choices } : {},
        labFormula: v.labFormula,
        labSummary: v.labSummary,
        finalScore: Number.isFinite(v.finalScore) ? Number(v.finalScore) : undefined,
        completedAt: Number.isFinite(v.completedAt) ? Number(v.completedAt) : undefined,
        at: Number(v.at ?? 0),
      }
    }
  }
  return { ...e, ...p, settings: { ...e.settings, ...(p.settings ?? {}) }, attempts: Array.isArray(p.attempts) ? p.attempts : [], savedSources: Array.isArray(p.savedSources) ? p.savedSources : [], savedFormulas: Array.isArray(p.savedFormulas) ? p.savedFormulas.filter((f: any) => f && typeof f.id === 'string' && f.formula) : [], certifiedGrades, notes, campaigns, bookmarks: Array.isArray(p.bookmarks) ? p.bookmarks : [], profile: p.profile ?? {}, diag: { answers: {}, ...(p.diag ?? {}) }, evidence: Array.isArray(p.evidence) ? p.evidence : [], hints: p.hints ?? {} }
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
  out.savedFormulas = byKey([...a.savedFormulas, ...b.savedFormulas], (x) => x.id, (x) => x.at).slice(0, 50)
  for (const k of new Set([...Object.keys(a.certifiedGrades), ...Object.keys(b.certifiedGrades)])) {
    const x = a.certifiedGrades[k], y = b.certifiedGrades[k]
    out.certifiedGrades[k] = !x ? y : !y ? x : (y.score > x.score || (y.score === x.score && y.at >= x.at)) ? y : x
  }
  for (const k of new Set([...Object.keys(a.notes), ...Object.keys(b.notes)])) {
    const x = a.notes[k], y = b.notes[k]
    out.notes[k] = !x ? y : !y ? x : y.at >= x.at ? y : x
  }
  for (const k of new Set([...Object.keys(a.campaigns), ...Object.keys(b.campaigns)])) {
    const x = a.campaigns[k], y = b.campaigns[k]
    out.campaigns[k] = !x ? y : !y ? x : (y.stage > x.stage || (y.stage === x.stage && y.at >= x.at)) ? y : x
  }
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
    attempts: p.attempts.length, bookmarks: p.bookmarks.length, sources: p.savedSources.length, formulas: p.savedFormulas.length, evidence: p.evidence.length, diagnostic: Object.keys(p.diag.answers).length,
  }
}
export const isEmpty = (p: any) => { const s = summarize(p); return Object.values(s).every((v) => v === 0) }
/** Стабильный отпечаток содержимого — идентификатор импорта, исключает повторное добавление. */
export function fingerprint(p: any) {
  const n = normalize(p)
  const parts: unknown[] = [Object.keys(n.visited).sort(), n.checks, Object.keys(n.labs).sort(), n.labDone, n.bookmarks.map((b) => b.path).sort(), n.attempts.map((t) => t.id).sort(), n.savedSources.map((x) => x.key).sort()]
  // Отпечатки прежнего формата сохраняются; новые ответы диагностики дают новый импорт.
  if (n.diag.track || n.diag.changedAt) parts.push([n.diag.track, n.diag.changedAt, n.diag.answers])
  if (n.savedFormulas.length) parts.push(n.savedFormulas.map((f) => f.id).sort())
  if (Object.keys(n.certifiedGrades).length) parts.push(Object.keys(n.certifiedGrades).sort())
  if (Object.keys(n.notes).length) parts.push(Object.keys(n.notes).sort())
  if (Object.keys(n.campaigns).length) parts.push(Object.keys(n.campaigns).sort())
  const s = JSON.stringify(parts)
  let h1 = 0x811c9dc5, h2 = 0x1b873593
  for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) ^ (h2 >>> 13) }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}
