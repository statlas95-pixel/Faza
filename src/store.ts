import { recordActivity } from './statistics'
import { tr } from '../shared/locale'
import { useSyncExternalStore } from 'react'
import { type Progress, type Attempt, type SavedSource, type SavedFormulaRecord, type Settings, normalize, emptyProgress } from '../shared/merge'
import type { Evidence } from '../shared/mastery'
export type { Progress, Attempt, SavedSource, SavedFormulaRecord, Settings }

const LEGACY_FORMULAS_KEY = 'faza.sandbox.saved.v1'
function loadLegacyFormulas(): SavedFormulaRecord[] {
  try {
    const raw = localStorage.getItem(LEGACY_FORMULAS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((f: any) => f && typeof f.id === 'string' && f.formula) : []
  } catch { return [] }
}
function mergeLegacyFormulas(p: Progress): Progress {
  const legacy = loadLegacyFormulas()
  if (!legacy.length) return p
  const known = new Set(p.savedFormulas.map((f) => f.id))
  const extra = legacy.filter((f) => !known.has(f.id))
  if (!extra.length) return p
  return { ...p, savedFormulas: [...p.savedFormulas, ...extra].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 50) }
}

// Прогресс всегда лежит в localStorage браузера — приложение работает и без сервера.
// Для вошедшего пользователя это кэш: src/account.ts синхронизирует его с сервером.
export const GUEST_KEY = 'faza.progress.v1'
let scope = GUEST_KEY
let state: Progress = mergeLegacyFormulas(load(scope))
const listeners = new Set<() => void>()
const changeHooks = new Set<(p: Progress) => void>()

export function load(key: string): Progress {
  try { const raw = localStorage.getItem(key); if (raw) return normalize(JSON.parse(raw)) } catch { /* хранилище недоступно — работаем в памяти */ }
  return emptyProgress()
}
function save() { try { localStorage.setItem(scope, JSON.stringify(state)) } catch { /* ignore */ } }
const notify = () => listeners.forEach((l) => l())
/** Переключает хранилище между гостем и пользователем. */
export function setScope(key: string, initial?: Progress) { scope = key; state = initial ? normalize(initial) : load(key); save(); notify() }
/** Подмена состояния ответом сервера — без повторной отправки. */
export function replaceState(p: Progress) { state = normalize(p); save(); notify() }
export function onChange(fn: (p: Progress) => void) { changeHooks.add(fn); return () => changeHooks.delete(fn) }
export function update(fn: (p: Progress) => void) {
  const next: Progress = JSON.parse(JSON.stringify(state))
  fn(next); state = next; save(); notify(); changeHooks.forEach((h) => h(state))
}
export function getProgress() { return state }
export function resetProgress() { const s = state.settings; state = { ...emptyProgress(), settings: s, profile: state.profile }; save(); notify(); changeHooks.forEach((h) => h(state)) }
export function useProgress(): Progress {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}
export function toggleBookmark(path: string, title: string, kind: string) {
  update((p) => { const i = p.bookmarks.findIndex((b) => b.path === path); if (i >= 0) p.bookmarks.splice(i, 1); else p.bookmarks.unshift({ path, title, kind, at: Date.now() }) })
}
export function saveLab(id: string, s: any) { update((p) => { p.labs[id] = { ...s, _at: Date.now() } }) }
export function clearLab(id: string) { update((p) => { delete p.labs[id] }) }
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)
/** Свидетельство о навыке. Запись с тем же id заменяется — одна попытка не засчитывается дважды. */
export function addEvidence(list: Evidence[]) {
  if (!list.length) return
  update((p) => { for (const e of list) { const i = p.evidence.findIndex((x) => x.id === e.id); if (i >= 0) p.evidence[i] = e; else p.evidence.unshift(e) } })
}
let labSkills: (labId: string) => { skills: string[]; title: string; transferOf?: string } = () => ({ skills: [], title: '' })
export function registerLabSkills(fn: typeof labSkills) { labSkills = fn }
/** Завершение занятия: счётчик, запись в историю попыток и свидетельства о навыках (score 0..1 считает движок занятия). */
export function finishLab(id: string, summary?: string, detail?: any, score?: number) {
  update((p) => {
    const prev = p.labDone[id], at = Date.now(), aid = uid()
    p.labDone[id] = { at, attempts: (prev?.attempts ?? 0) + 1, summary }
    p.attempts.unshift({ id: aid, labId: id, at, summary: summary ?? '', detail: { ...(detail ?? {}), score, hints: p.hints[id] ?? 0 } })
    if (p.attempts.length > 200) p.attempts.length = 200
    const info = labSkills(id)
    if (score !== undefined) for (const skill of info.skills) {
      p.evidence.unshift({ id: `lab:${aid}:${skill}`, skill, kind: 'lab', item: 'lab', result: score >= 0.8 ? 'ok' : score >= 0.5 ? 'partial' : 'wrong', score, hints: p.hints[id] ?? 0, src: id, label: `${tr("занятие «")}${info.title}»`, at })
      // занятие-перенос, пройденное самостоятельно, — это и есть перенос принципа
      if (info.transferOf && score >= 0.8 && !p.hints[id]) p.evidence.unshift({ id: `transfer:${id}:${skill}`, skill, kind: 'transfer', item: 'transfer', result: 'ok', src: id, label: `${tr("перенос: «")}${info.title}»`, at })
    }
    p.hints[id] = 0
  })
  recordActivity('complete', `/labs/${id}`)
}
export function bumpHints(labId: string) { update((p) => { p.hints[labId] = (p.hints[labId] ?? 0) + 1 }) }
export function toggleSource(s: Omit<SavedSource, 'at'>) {
  update((p) => { const i = p.savedSources.findIndex((x) => x.key === s.key); if (i >= 0) p.savedSources.splice(i, 1); else p.savedSources.unshift({ ...s, at: Date.now() }) })
}
export function patchSource(key: string, patch: Partial<SavedSource>) { update((p) => { const x = p.savedSources.find((s) => s.key === key); if (x) Object.assign(x, patch) }) }
export function setSettings(patch: Partial<Settings>) { update((p) => { Object.assign(p.settings, patch) }) }
export function saveFormula(entry: SavedFormulaRecord) {
  update((p) => {
    p.savedFormulas = [entry, ...p.savedFormulas.filter((x) => x.id !== entry.id)].slice(0, 50)
  })
}
export function deleteSavedFormula(id: string) {
  update((p) => {
    p.savedFormulas = p.savedFormulas.filter((x) => x.id !== id)
  })
}
