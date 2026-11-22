import { tr, language } from '../shared/locale'
import { useSyncExternalStore } from 'react'
import { GUEST_KEY, load, setScope, replaceState, onChange, getProgress } from './store'
import { mergeProgress, isEmpty, fingerprint, summarize, type Progress } from '../shared/merge'

// Связь с сервером: вход, синхронизация прогресса, импорт локальных данных.
// Если сервера нет (файл открыт с диска, статический хостинг), статус — 'offline': обучение работает, данные остаются в браузере.
export interface Account {
  status: 'checking' | 'offline' | 'guest' | 'user'
  user?: { id: string; email: string; name: string }
  sync: 'idle' | 'saving' | 'saved' | 'error'
  pendingImport?: { id: string; summary: ReturnType<typeof summarize> }
  mail?: 'smtp' | 'outbox'
}
let acc: Account = { status: 'checking', sync: 'idle' }
const subs = new Set<() => void>()
const set = (p: Partial<Account>) => { acc = { ...acc, ...p }; subs.forEach((s) => s()) }
export const useAccount = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb) }, () => acc)
export const getAccount = () => acc

export class ApiError extends Error { constructor(public status: number, public code: string, msg: string, public data?: any) { super(msg) } }
export async function api<T = any>(method: string, url: string, body?: any, signal?: AbortSignal): Promise<T> {
  if (location.protocol === 'file:') throw new ApiError(0, 'offline', tr("Приложение открыто как файл — сервер недоступен"))
  let r: Response
  try { r = await fetch(url, { method, credentials: 'same-origin', signal, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }) }
  catch (e: any) { if (e?.name === 'AbortError') throw e; throw new ApiError(0, 'offline', tr("Нет связи с сервером платформы")) }
  const j = await r.json().catch(() => null)
  if (!r.ok) {
    const code = j?.error ?? j?.code ?? 'error'
    const english: Record<string, string> = {
      limit: 'Your daily tutor allowance has been used. Try again tomorrow.',
      rate_limited: 'Too many requests. Please try again shortly.',
      too_long: 'Shorten the text and try again.',
      timeout: 'The service took too long to respond. Please try again.',
      not_configured: 'This service has not been configured.',
      unknown_model: 'Please select an available model.',
      refused: 'The provider declined the request.',
      truncated: 'The response was incomplete. Try a shorter question.',
      bad_query: 'Enter a more specific search query.',
      not_found: 'This item could not be found.',
    }
    const message = language === 'en'
      ? english[code] ?? (r.status === 401 ? 'Please sign in to continue.' : `Request failed (HTTP ${r.status}).`)
      : j?.message ?? `Ошибка ${r.status}`
    throw new ApiError(r.status, code, message, j)
  }
  return j as T
}

let rev = 0, timer: any, inFlight: Promise<void> | undefined
async function sendSnapshot() {
  if (acc.status !== 'user') return
  const snapshot = getProgress(), uid = acc.user?.id
  set({ sync: 'saving' })
  try {
    const r = await api('PUT', '/api/me/state', { data: snapshot, baseRev: rev })
    if (acc.user?.id !== uid) return
    rev = r.rev
    if (r.merged) replaceState(snapshot === getProgress() ? r.data : mergeProgress(r.data, getProgress()))
    set({ sync: 'saved' })
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { setScope(GUEST_KEY); set({ status: 'guest', user: undefined, sync: 'idle' }) } else set({ sync: 'error' })
  }
}
async function push() {
  while (inFlight) await inFlight
  inFlight = sendSnapshot()
  try { await inFlight } finally { inFlight = undefined }
}
const schedule = () => { clearTimeout(timer); timer = setTimeout(push, 1200) }
onChange(() => { if (acc.status === 'user') schedule() })
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (acc.sync === 'error') schedule() })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && acc.status === 'user') { clearTimeout(timer); void push() } })
}
const dismissedKey = (uid: string) => `faza.import.dismissed.${uid}`

async function adopt(me: { user: Account['user']; data: Progress; rev: number }) {
  const key = `faza.user.${me.user!.id}`
  const cached = load(key)
  rev = me.rev
  const merged = mergeProgress(cached, me.data)
  setScope(key, merged)
  set({ status: 'user', user: me.user, sync: 'saved' })
  if (JSON.stringify(merged) !== JSON.stringify(me.data)) schedule()
  // Локальный прогресс гостя: предлагаем импорт один раз.
  const guest = load(GUEST_KEY)
  if (!isEmpty(guest)) {
    const id = fingerprint(guest)
    const done = await api('GET', '/api/me/imports').then((r) => r.ids as string[]).catch(() => [] as string[])
    let dismissed = ''; try { dismissed = localStorage.getItem(dismissedKey(me.user!.id)) ?? '' } catch { /* ignore */ }
    if (!done.includes(id) && dismissed !== id) set({ pendingImport: { id, summary: summarize(guest) } })
  }
}
export async function init() {
  try {
    const h = await api('GET', '/api/health', undefined, AbortSignal.timeout(4000))
    set({ mail: h.mail })
    try { await adopt(await api('GET', '/api/me')) } catch (e) { if (e instanceof ApiError && e.status === 401) set({ status: 'guest' }); else throw e }
  } catch { set({ status: 'offline' }) }
}
const authErr = (e: any, fallback: string) => {
  if (!(e instanceof ApiError)) return fallback
  const m: Record<string, string> = { USER_ALREADY_EXISTS: tr("Аккаунт с таким адресом уже есть. Войдите или восстановите доступ."), USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: tr("Аккаунт с таким адресом уже есть. Войдите или восстановите доступ."), INVALID_EMAIL_OR_PASSWORD: tr("Неверный адрес или пароль."), PASSWORD_TOO_SHORT: tr("Пароль слишком короткий — не менее 10 символов."), INVALID_EMAIL: tr("Проверьте адрес почты."), INVALID_TOKEN: tr("Ссылка восстановления недействительна или уже использована."), offline: e.message }
  return m[e.code] ?? (e.status === 429 ? tr("Слишком много попыток. Подождите минуту.") : fallback)
}
export async function signUp(name: string, email: string, password: string) {
  try { await api('POST', '/api/auth/sign-up/email', { name, email, password }); await adopt(await api('GET', '/api/me')) } catch (e) { throw new Error(authErr(e, tr("Не удалось создать аккаунт."))) }
}
export async function signIn(email: string, password: string) {
  try { await api('POST', '/api/auth/sign-in/email', { email, password }); await adopt(await api('GET', '/api/me')) } catch (e) { throw new Error(authErr(e, tr("Не удалось войти."))) }
}
export async function signOut() {
  clearTimeout(timer); await push()
  const uid = acc.user?.id
  try { await api('POST', '/api/auth/sign-out', {}) } catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error }
  if (uid && acc.sync !== 'error') { try { localStorage.removeItem(`faza.user.${uid}`) } catch { /* ignore */ } } // на общем компьютере не оставляем чужой кэш
  setScope(GUEST_KEY); set({ status: 'guest', user: undefined, sync: 'idle', pendingImport: undefined })
}
export async function requestReset(email: string) { try { await api('POST', '/api/auth/request-password-reset', { email, redirectTo: '/' }) } catch (e) { throw new Error(authErr(e, tr("Не удалось отправить запрос."))) } }
export async function resetPassword(token: string, newPassword: string) { try { await api('POST', '/api/auth/reset-password', { token, newPassword }) } catch (e) { throw new Error(authErr(e, tr("Не удалось задать пароль."))) } }
export async function importGuest() {
  const p = acc.pendingImport; if (!p) return
  clearTimeout(timer); await push()
  const r = await api('POST', '/api/me/import', { importId: p.id, data: load(GUEST_KEY) })
  rev = r.rev; replaceState(r.data); set({ pendingImport: undefined })
}
export function dismissImport() { const p = acc.pendingImport; if (p && acc.user) { try { localStorage.setItem(dismissedKey(acc.user.id), p.id) } catch { /* ignore */ } } set({ pendingImport: undefined }) }
export const syncNow = () => push()
