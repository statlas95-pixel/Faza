import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

// Сервер читает тот же контент, что и интерфейс: для контекста ИИ-наставника и поиска по каталогу платформы.
export function loadContent(dir = 'content') {
  const y = (f: string) => YAML.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const topics = fs.readdirSync(path.join(dir, 'topics')).filter((f) => f.endsWith('.md')).map((f) => {
    const m = fs.readFileSync(path.join(dir, 'topics', f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)!
    return { ...YAML.parse(m[1]), body: m[2] } as any
  })
  const labs = fs.readdirSync(path.join(dir, 'labs')).filter((f) => f.endsWith('.yaml')).map((f) => y(`labs/${f}`) as any)
  return { topics, labs, sources: y('sources.yaml') as any[], techDocs: y('tech-docs.yaml') as any[] }
}
export type Content = ReturnType<typeof loadContent>

export interface Fragment { id: string; kind: 'section' | 'source' | 'lab' | 'material' | 'external'; title: string; path: string; text: string }
const clean = (s: string) => s.replace(/\{\{widget:[^}]+\}\}/g, '').replace(/^:::\w*.*$/gm, '').replace(/\[\[([\w-]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([\w-]+)\]\]/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim()

/** Разбивает тему на фрагменты по заголовкам второго уровня. */
export function topicFragments(t: any): Fragment[] {
  const parts = t.body.split(/^## /m).filter((p: string) => p.trim())
  return parts.map((p: string, i: number) => { const [h, ...rest] = p.split('\n'); return { id: `F${i + 1}`, kind: 'section' as const, title: `${t.title} → ${h.trim()}`, path: `/topics/${t.id}`, text: clean(rest.join('\n')) } })
}
const cell = (c: string) => (typeof c === 'string' && c.startsWith('~') ? `${c.slice(1)} (от руки)` : c)

/**
 * Контекст для ИИ-наставника. Ключевое правило: до завершения занятия модель получает ТОЛЬКО то,
 * что уже доступно ученику (вводная, открытые им документы, полученные запросы). Тексты разбора,
 * вердикты, правильные ответы и пояснения к вариантам сюда не попадают — их нельзя выдать даже случайно.
 */
export function buildContext(c: Content, req: { kind: 'topic' | 'lab'; id: string; opened?: string[]; bought?: string[]; finished?: boolean }): { title: string; fragments: Fragment[] } | null {
  const srcFr = (ids: string[], start: number): Fragment[] => ids.map((id) => c.sources.find((s) => s.id === id)).filter(Boolean).map((s: any, i) => ({ id: `S${start + i}`, kind: 'source' as const, title: `${s.authors} (${s.year}). ${s.title}`, path: `/sources/${s.id}`, text: `Что подтверждает: ${s.supports}\nКак проверен: ${s.verified}` }))
  const cited = (body: string) => [...new Set([...body.matchAll(/\[@([^\]]+)\]/g)].flatMap((m) => m[1].split(';').map((x) => x.trim().replace(/^@/, ''))))]
  if (req.kind === 'topic') {
    const t = c.topics.find((x) => x.id === req.id); if (!t) return null
    return { title: t.title, fragments: [...topicFragments(t), ...srcFr(cited(t.body), 1)] }
  }
  const l = c.labs.find((x) => x.id === req.id); if (!l) return null
  const fr: Fragment[] = [{ id: 'L1', kind: 'lab', title: `Занятие «${l.title}»: вводная`, path: `/labs/${l.id}`, text: `Роль: ${l.role}\nСитуация: ${clean(l.brief.situation)}\nЦель: ${clean(l.brief.goal)}\nУсловия: ${clean(l.brief.constraints)}\nО данных: ${l.dataNote}` }]
  const opened = new Set(req.opened ?? []), bought = new Set(req.bought ?? [])
  let n = 1
  for (const d of l.documents ?? []) {
    if (!opened.has(d.id)) continue
    const rows = d.sections ? d.sections.flatMap((s: any) => [`# ${s.title}`, ...s.rows.map((r: any) => r.cells.map(cell).filter(Boolean).join(' | '))]) : (d.rows ?? []).map((r: string[]) => r.map(cell).join(': '))
    const notes = (d.notes ?? []).map((x: any) => `${x.where}: «${x.hand}» (от руки)`)
    fr.push({ id: `M${n++}`, kind: 'material', title: `Документ, открытый учеником: ${d.title}`, path: `/labs/${l.id}`, text: [...rows, ...notes].join('\n') })
  }
  for (const r of l.requests ?? []) if (bought.has(r.id)) fr.push({ id: `M${n++}`, kind: 'material', title: `Полученный учеником ответ на запрос: ${r.title}`, path: `/labs/${l.id}`, text: clean(r.result) })
  if (l.hypotheses) fr.push({ id: `M${n++}`, kind: 'material', title: 'Гипотезы, между которыми выбирает ученик', path: `/labs/${l.id}`, text: l.hypotheses.map((h: any) => `— ${h.title}`).join('\n') })
  if (req.finished && l.debrief) fr.push({ id: `M${n++}`, kind: 'material', title: 'Разбор занятия (ученик его уже видел)', path: `/labs/${l.id}`, text: clean(`${l.debrief.story}\n${l.debrief.principle}`) })
  let f = 1
  for (const tid of (l.topics ?? []).slice(0, 2)) { const t = c.topics.find((x) => x.id === tid); if (t) for (const x of topicFragments(t)) fr.push({ ...x, id: `F${f++}` }) }
  return { title: l.title, fragments: fr }
}

/** Поиск по каталогу платформы: проверенные источники и первичные технические документы. */
const TYPE_RU: Record<string, string> = { textbook: 'Учебник / монография', review: 'Рецензируемый обзор', paper: 'Первичное исследование', standard: 'Стандарт / руководство', regulation: 'Нормативный акт', manufacturer: 'Документация производителя', method: 'Методическая работа' }
export function searchCatalog(c: Content, q: string) {
  const ws = q.toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/i).filter((w) => w.length > 2).map((w) => (w.length > 5 ? w.slice(0, -2) : w))
  if (!ws.length) return []
  const score = (text: string) => { const t = text.toLowerCase().replace(/ё/g, 'е'); return ws.filter((w) => t.includes(w)).length }
  const docs = c.techDocs.map((d) => ({ key: `catalog:${d.id}`, kind: 'Каталог технических документов', title: d.title, authors: d.org, year: String(d.year), type: d.type, url: d.url, scope: d.scope, checked: d.checked, s: score(`${d.title} ${d.org} ${d.keywords} ${d.scope}`) }))
  const srcs = c.sources.map((s) => ({ key: `source:${s.id}`, kind: 'Реестр источников платформы', title: s.title, authors: s.authors, year: String(s.year), type: TYPE_RU[s.type] ?? s.type, url: s.doi ? `https://doi.org/${s.doi}` : s.url, doi: s.doi, scope: s.supports, checked: s.verified, path: `/sources/${s.id}`, s: score(`${s.title} ${s.authors} ${s.supports} ${s.where}`) }))
  return [...docs, ...srcs].filter((x) => x.s >= Math.min(ws.length, 2) || (ws.length === 1 && x.s === 1)).sort((a, b) => b.s - a.s).slice(0, 10)
}
