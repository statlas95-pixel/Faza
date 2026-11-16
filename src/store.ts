import { useSyncExternalStore } from 'react'
import { type Progress, type Attempt, type SavedSource, type Settings, normalize, emptyProgress } from '../shared/merge'
export type { Progress, Attempt, SavedSource, Settings }

// Прогресс всегда лежит в localStorage браузера — приложение работает и без сервера.
// Для вошедшего пользователя это кэш: src/account.ts синхронизирует его с сервером.
export const GUEST_KEY = 'faza.progress.v1'
let scope = GUEST_KEY
let state: Progress = load(scope)
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
export function resetProgress() { const s = state.settings; state = { ...emptyProgress(), settings: s }; save(); notify(); changeHooks.forEach((h) => h(state)) }
export function useProgress(): Progress {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}
export function toggleBookmark(path: string, title: string, kind: string) {
  update((p) => { const i = p.bookmarks.findIndex((b) => b.path === path); if (i >= 0) p.bookmarks.splice(i, 1); else p.bookmarks.unshift({ path, title, kind, at: Date.now() }) })
}
export function saveLab(id: string, s: any) { update((p) => { p.labs[id] = { ...s, _at: Date.now() } }) }
export function clearLab(id: string) { update((p) => { delete p.labs[id] }) }
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`)
/** Завершение занятия: счётчик и запись в историю попыток. */
export function finishLab(id: string, summary?: string, detail?: any) {
  update((p) => {
    const prev = p.labDone[id], at = Date.now()
    p.labDone[id] = { at, attempts: (prev?.attempts ?? 0) + 1, summary }
    p.attempts.unshift({ id: uid(), labId: id, at, summary: summary ?? '', detail })
    if (p.attempts.length > 200) p.attempts.length = 200
  })
}
export function toggleSource(s: Omit<SavedSource, 'at'>) {
  update((p) => { const i = p.savedSources.findIndex((x) => x.key === s.key); if (i >= 0) p.savedSources.splice(i, 1); else p.savedSources.unshift({ ...s, at: Date.now() }) })
}
export function patchSource(key: string, patch: Partial<SavedSource>) { update((p) => { const x = p.savedSources.find((s) => s.key === key); if (x) Object.assign(x, patch) }) }
export function setSettings(patch: Partial<Settings>) { update((p) => { Object.assign(p.settings, patch) }) }
