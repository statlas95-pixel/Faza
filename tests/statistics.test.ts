import { expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { openDb } from '../server/db'
import { siteStatistics } from '../server/statistics'
import { publicPage } from '../shared/statistics'

it('deduplicates browsers across dates, counts completions separately and expires old days', () => {
  const db = openDb('', ':memory:')
  try {
    db.exec("CREATE TABLE user(id TEXT PRIMARY KEY); INSERT INTO user VALUES ('test')")
    const stats = siteStatistics(db, { labs: [{ id: 'lab' }], topics: [], sources: [], techDocs: [] }, 'test')
    const day = Date.UTC(2026, 10, 2), ms = 86400000
    const view = { visitor: randomUUID(), page: '/labs/lab', kind: 'view' }
    expect(stats.record({ ...view, page: '/labs/missing' }, day)).toBe(false)
    expect(stats.record({ ...view, kind: 'complete', page: '/' }, day)).toBe(false)
    expect(stats.record(view, day)).toBe(true)
    stats.record(view, day)
    stats.record(view, day + ms)
    stats.record({ ...view, kind: 'complete' }, day + ms)
    stats.record({ ...view, visitor: randomUUID() }, day + ms)
    expect(stats.report(7, day + ms)).toMatchObject({ visitors: 2, returning: 1, accounts: 1,
      popular: [{ page: '/labs/lab', views: 4, completions: 1 }] })
    expect(stats.report(1, day + ms).daily).toEqual([{ day: '2026-11-03', visitors: 2, views: 2, completions: 1 }])
    stats.record(view, day + 31 * ms)
    expect(db.prepare('SELECT COUNT(*) AS n FROM traffic_visitors').get()!.n).toBe(1)
    expect(stats.report(30, day + 31 * ms).daily).toHaveLength(30)
  } finally { db.close() }
})

it('excludes private pages and normalizes glossary entries', () => {
  for (const path of ['/attempts/123', '/account', '/statistics', '/catalog?q=test', '/unknown']) expect(publicPage(path)).toBeNull()
  expect(publicPage('/glossary/hlb')).toBe('/glossary')
})
