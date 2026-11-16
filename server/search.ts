import type { Config } from './config'
import type { Db } from './db'

// Поиск внешних научных источников. Основной провайдер — Crossref REST API (без ключа).
// OpenAlex подключается, если задан OPENALEX_API_KEY (с 13.02.2026 сервис требует ключ).
export interface ExtResult {
  key: string; provider: 'crossref' | 'openalex'; title: string; authors: string; year: string; type: string; venue: string
  doi?: string; url: string; access: 'record' | 'abstract' | 'open'; abstract?: string; citedBy?: number; matched: string[]
}
export class SearchError extends Error { constructor(public code: 'timeout' | 'rate_limited' | 'unavailable' | 'bad_query', msg: string, public retryAfter?: number) { super(msg) } }

const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const TYPE: Record<string, string> = { 'journal-article': 'Статья в журнале', 'book-chapter': 'Глава книги', book: 'Книга', monograph: 'Монография', 'proceedings-article': 'Доклад конференции', 'posted-content': 'Препринт', standard: 'Стандарт', dataset: 'Набор данных', report: 'Отчёт', article: 'Статья', review: 'Обзор', preprint: 'Препринт' }
const words = (q: string) => [...new Set(q.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter((w) => w.length > 2))]
const matched = (q: string, text: string) => { const t = text.toLowerCase(); return words(q).filter((w) => t.includes(w.length > 5 ? w.slice(0, w.length - 1) : w)) }

export function mapCrossref(w: any, q: string): ExtResult {
  const title = strip((w.title ?? [])[0] ?? 'Без названия'), abstract = w.abstract ? strip(w.abstract) : undefined
  const open = (w.license ?? []).some((l: any) => /creativecommons/i.test(l.URL ?? ''))
  const au = (w.author ?? w.editor ?? []).map((a: any) => a.family ?? a.name).filter(Boolean)
  return {
    key: `doi:${String(w.DOI).toLowerCase()}`, provider: 'crossref', title, abstract: abstract?.slice(0, 1200),
    authors: au.length > 4 ? `${au.slice(0, 3).join(', ')} и др.` : au.join(', ') || (w.publisher ?? ''),
    year: String(w.issued?.['date-parts']?.[0]?.[0] ?? '—'), type: TYPE[w.type] ?? w.type ?? 'Публикация', venue: strip((w['container-title'] ?? [])[0] ?? w.publisher ?? ''),
    doi: w.DOI, url: `https://doi.org/${w.DOI}`, access: open ? 'open' : abstract ? 'abstract' : 'record', citedBy: w['is-referenced-by-count'],
    matched: matched(q, `${title} ${abstract ?? ''} ${(w['container-title'] ?? [])[0] ?? ''}`),
  }
}
export function mapOpenAlex(w: any, q: string): ExtResult {
  const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//, '') : undefined
  const au = (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean)
  return {
    key: doi ? `doi:${doi.toLowerCase()}` : `openalex:${w.id}`, provider: 'openalex', title: w.title ?? w.display_name ?? 'Без названия',
    authors: au.length > 4 ? `${au.slice(0, 3).join(', ')} и др.` : au.join(', '), year: String(w.publication_year ?? '—'), type: TYPE[w.type] ?? w.type ?? 'Публикация',
    venue: w.primary_location?.source?.display_name ?? '', doi, url: doi ? `https://doi.org/${doi}` : w.id,
    access: w.open_access?.is_oa ? 'open' : w.abstract_inverted_index ? 'abstract' : 'record', citedBy: w.cited_by_count, matched: matched(q, `${w.title ?? ''}`),
  }
}

export function createSearch(cfg: Config, db: Db, fetchImpl: typeof fetch = fetch) {
  const get = db.prepare('SELECT data, at FROM search_cache WHERE key = ?'), put = db.prepare('INSERT OR REPLACE INTO search_cache (key, data, at) VALUES (?, ?, ?)')
  // Не чаще одного обращения к внешней базе в 1,2 с: анонимный пул Crossref быстро отвечает 429.
  let gate = Promise.resolve()
  const pace = () => { const p = gate.then(() => new Promise<void>((r) => setTimeout(r, cfg.search.minGapMs))); gate = p.catch(() => {}); return p }
  async function call(url: string, headers: Record<string, string>) {
    await pace()
    let res: Response
    try { res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(cfg.search.timeoutMs) }) }
    catch (e: any) { throw e?.name === 'TimeoutError' || e?.name === 'AbortError' ? new SearchError('timeout', 'Научная база не ответила вовремя') : new SearchError('unavailable', 'Нет связи с научной базой') }
    if (res.status === 429) throw new SearchError('rate_limited', 'Научная база ограничила частоту запросов', Number(res.headers.get('retry-after')) || 30)
    if (!res.ok) throw new SearchError('unavailable', `Научная база ответила ошибкой ${res.status}`)
    try { return await res.json() } catch { throw new SearchError('unavailable', 'Научная база вернула нечитаемый ответ') }
  }
  const providers = {
    crossref: async (q: string) => {
      const u = new URL('https://api.crossref.org/works')
      u.searchParams.set('query.bibliographic', q); u.searchParams.set('rows', '12')
      u.searchParams.set('select', 'DOI,title,author,editor,issued,container-title,type,abstract,publisher,license,is-referenced-by-count')
      if (cfg.search.crossrefMailto) u.searchParams.set('mailto', cfg.search.crossrefMailto)
      const j: any = await call(u.toString(), { 'User-Agent': 'Faza-edu/0.2 (educational platform)' })
      return ((j.message?.items ?? []) as any[]).filter((w) => w.DOI && w.type !== 'component').map((w) => mapCrossref(w, q))
    },
    openalex: async (q: string) => {
      const u = new URL('https://api.openalex.org/works')
      u.searchParams.set('search', q); u.searchParams.set('per-page', '12'); u.searchParams.set('api_key', cfg.search.openalexKey!)
      const j: any = await call(u.toString(), {})
      return ((j.results ?? []) as any[]).map((w) => mapOpenAlex(w, q))
    },
  }
  return {
    providers: () => [{ id: 'crossref', name: 'Crossref', ready: true, note: 'Библиографическая база DOI; ключ не нужен' }, { id: 'openalex', name: 'OpenAlex', ready: !!cfg.search.openalexKey, note: cfg.search.openalexKey ? 'Ключ задан' : 'Не настроен: нужен OPENALEX_API_KEY' }],
    async search(qRaw: string, provider: 'crossref' | 'openalex' = 'crossref') {
      const q = qRaw.trim().replace(/\s+/g, ' ')
      if (q.length < 3 || q.length > 200) throw new SearchError('bad_query', 'Запрос должен быть от 3 до 200 символов')
      if (provider === 'openalex' && !cfg.search.openalexKey) throw new SearchError('unavailable', 'OpenAlex не настроен на сервере')
      const key = `${provider}:${q.toLowerCase()}`, hit = get.get(key) as any
      const fresh = hit && Date.now() - hit.at < cfg.search.cacheHours * 3600_000
      if (fresh) return { results: JSON.parse(hit.data) as ExtResult[], cached: true, stale: false, provider, at: hit.at }
      try {
        const results = await providers[provider](q)
        put.run(key, JSON.stringify(results), Date.now())
        return { results, cached: false, stale: false, provider, at: Date.now() }
      } catch (e) {
        // сервис недоступен — отдаём устаревший кэш, если он есть, и честно помечаем
        if (hit && e instanceof SearchError && e.code !== 'bad_query') return { results: JSON.parse(hit.data) as ExtResult[], cached: true, stale: true, provider, at: hit.at, warning: e.message }
        throw e
      }
    },
  }
}
