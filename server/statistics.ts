import { createHmac } from 'node:crypto'
import type { Content } from './content'
import { transaction, type Db } from './db'
import { publicPages, type StatisticsReport } from '../shared/statistics'

const dayMs = 86_400_000
const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10)
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i

export function siteStatistics(db: Db, content: Content, secret: string) {
  const collectionStart = utcDay(Number(db.prepare('SELECT at FROM schema_migrations WHERE version = 3').get()!.at))
  const labs = new Set(content.labs.map(lab => '/labs/' + lab.id))
  const pages = new Set([...publicPages, ...labs, ...content.topics.map(topic => '/topics/' + topic.id)])
  const visit = db.prepare('INSERT OR IGNORE INTO traffic_visitors VALUES (?, ?)')
  const count = db.prepare(`INSERT INTO traffic_pages VALUES (?, ?, ?, ?) ON CONFLICT(day,page)
    DO UPDATE SET views = views + excluded.views, completions = completions + excluded.completions`)
  let cleanedDay = ''
  function record(event: any, now = Date.now()) {
    if (!event || typeof event.visitor !== 'string' || !uuid.test(event.visitor) || !pages.has(event.page)) return false
    if (event.kind !== 'view' && !(event.kind === 'complete' && labs.has(event.page))) return false
    const day = utcDay(now)
    const visitor = createHmac('sha256', secret).update('traffic:' + event.visitor.toLowerCase()).digest('hex')
    transaction(db, () => {
      if (day !== cleanedDay) {
        const cutoff = utcDay(now - 29 * dayMs)
        db.prepare('DELETE FROM traffic_visitors WHERE day < ?').run(cutoff)
        db.prepare('DELETE FROM traffic_pages WHERE day < ?').run(cutoff)
      }
      visit.run(day, visitor)
      count.run(day, event.page, Number(event.kind === 'view'), Number(event.kind === 'complete'))
    })
    cleanedDay = day
    return true
  }
  function report(days: number, now = Date.now()): StatisticsReport {
    const dates = Array.from({ length: days }, (_, i) => utcDay(now - (days - i - 1) * dayMs))
    const start = dates[0], end = dates[days - 1]
    const visitors = db.prepare(`SELECT COUNT(*) AS visitors, COUNT(*) FILTER (WHERE active_days > 1) AS repeat_visitors
      FROM (SELECT COUNT(*) AS active_days FROM traffic_visitors WHERE day BETWEEN ? AND ? GROUP BY visitor)`).get(start, end)!
    const dailyVisits = db.prepare('SELECT day, COUNT(*) AS visitors FROM traffic_visitors WHERE day BETWEEN ? AND ? GROUP BY day').all(start, end)
    const dailyEvents = db.prepare('SELECT day, SUM(views) AS views, SUM(completions) AS completions FROM traffic_pages WHERE day BETWEEN ? AND ? GROUP BY day').all(start, end)
    const popular = db.prepare(`SELECT page, SUM(views) AS views, SUM(completions) AS completions FROM traffic_pages
      WHERE day BETWEEN ? AND ? AND (page LIKE '/labs/%' OR page LIKE '/topics/%') GROUP BY page
      ORDER BY views DESC, completions DESC, page LIMIT 10`).all(start, end) as unknown as StatisticsReport['popular']
    return { collectionStart, start, end, visitors: Number(visitors.visitors), returning: Number(visitors.repeat_visitors),
      accounts: Number(db.prepare('SELECT COUNT(*) AS n FROM user').get()!.n),
      daily: dates.map(day => {
        const events = dailyEvents.find(row => row.day === day)
        return { day, visitors: Number(dailyVisits.find(row => row.day === day)?.visitors ?? 0),
          views: Number(events?.views ?? 0), completions: Number(events?.completions ?? 0) }
      }), popular }
  }
  return { record, report }
}
