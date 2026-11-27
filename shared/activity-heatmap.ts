// 12-недельная карта ритма практики (84 дня) для Портфолио (Пакет S).
// Спокойная визуализация без «штрафных стриков» — только реальная инженерная активность.

import type { Progress } from './merge'

export interface HeatmapDay {
  dateKey: string // YYYY-MM-DD
  count: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
}

export interface ActivityHeatmapSummary {
  days: HeatmapDay[] // ровно 84 дня (12 недель × 7 дней)
  weeks: HeatmapDay[][] // 12 столбцов по 7 дней
  totalActions: number
  activeDays: number
  activeWeeks: number
}

function toLocalDateKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildActivityHeatmap(progress: Progress, now = Date.now()): ActivityHeatmapSummary {
  const counts = new Map<string, number>()
  const bump = (ts: number | undefined, weight = 1) => {
    if (!ts || !Number.isFinite(ts) || ts <= 0) return
    const k = toLocalDateKey(ts)
    counts.set(k, (counts.get(k) ?? 0) + weight)
  }

  for (const ts of Object.values(progress.visited ?? {})) bump(ts, 1)
  for (const l of Object.values(progress.labDone ?? {})) bump(l.at, 2)
  for (const a of progress.attempts ?? []) bump(a.at, 1)
  for (const f of progress.savedFormulas ?? []) bump(f.at, 2)
  for (const c of Object.values(progress.campaigns ?? {})) bump(c.at, 2)
  for (const fc of Object.values((progress as any).flashcards ?? {})) bump((fc as any)?.lastAt, 1)
  for (const ev of progress.evidence ?? []) bump(ev.at, 1)

  // Выравниваем сетку по 12 полным неделям (84 дня), заканчивая сегодняшним днём
  const todayMidnight = new Date(now)
  todayMidnight.setHours(12, 0, 0, 0)
  const todayKey = toLocalDateKey(todayMidnight.getTime())

  const days: HeatmapDay[] = []
  let totalActions = 0
  let activeDays = 0

  for (let offset = 83; offset >= 0; offset--) {
    const ts = todayMidnight.getTime() - offset * 86400000
    const dateKey = toLocalDateKey(ts)
    const count = counts.get(dateKey) ?? 0
    totalActions += count
    if (count > 0) activeDays++
    const level: 0 | 1 | 2 | 3 | 4 =
      count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 10 ? 3 : 4
    days.push({ dateKey, count, level, isToday: dateKey === todayKey })
  }

  const weeks: HeatmapDay[][] = []
  let activeWeeks = 0
  for (let w = 0; w < 12; w++) {
    const slice = days.slice(w * 7, w * 7 + 7)
    if (slice.some((d) => d.count > 0)) activeWeeks++
    weeks.push(slice)
  }

  return { days, weeks, totalActions, activeDays, activeWeeks }
}
