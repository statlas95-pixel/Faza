const preferenceKey = 'faza.statistics.off'
const visitorKey = 'faza.statistics.visitor'

export function browserOptsOut() {
  return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
}
export function statisticsEnabled() {
  try { return !browserOptsOut() && localStorage.getItem(preferenceKey) !== '1' } catch { return false }
}
export function setStatisticsEnabled(enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, enabled ? '0' : '1')
    if (!enabled) localStorage.removeItem(visitorKey)
  } catch { /* Storage unavailable. */ }
}
export function recordActivity(kind: 'view' | 'complete', page: string) {
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol) || !statisticsEnabled()) return
  try {
    let visitor = localStorage.getItem(visitorKey)
    if (!visitor) {
      visitor = crypto.randomUUID()
      localStorage.setItem(visitorKey, visitor)
    }
    void fetch('/api/statistics/event', { method: 'POST', credentials: 'omit', keepalive: true,
      referrerPolicy: 'strict-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, page, visitor }) }).catch(() => {})
  } catch { /* Analytics must never interrupt learning. */ }
}
