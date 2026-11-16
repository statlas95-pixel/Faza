import YAML from 'yaml'

// Весь научный контент лежит в папке /content и подключается сюда как текст.
// Интерфейсный код не содержит учебных формулировок — правьте файлы в /content.
const rawTopics = import.meta.glob('/content/topics/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const rawLabs = import.meta.glob('/content/labs/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const rawYaml = import.meta.glob('/content/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const mediaUrls = import.meta.glob('/content/media/*.{svg,png,jpg,jpeg,webp}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export interface Check { q: string; options: { text: string; correct?: boolean; why: string }[] }
export interface Topic {
  id: string; title: string; summary: string; area: 'production' | 'rnd' | 'both'; domain: string
  minutes: number; order: number; questions: string[]; labs: string[]; related: string[]
  checks: Check[]; review: string; updated: string; body: string; swatch: string; search: string[]
}
export interface Term { id: string; term: string; en?: string; short: string; long?: string; topics?: string[]; sources?: string[] }
export interface Source {
  id: string; type: string; authors: string; title: string; where: string; year: number | string
  doi?: string; url?: string; supports: string; verified: string; note?: string
}
export interface Media { file: string; title: string; author: string; source: string; license: string; attribution: string; alt: string }
export interface LabMeta {
  id: string; engine: string; title: string; summary: string; area: string; role: string; minutes: number
  skill: string; topics: string[]; order: number; transferOf?: string; [k: string]: any
}

function parseTopic(raw: string): Topic {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!m) throw new Error('В файле темы нет шапки ---')
  const fm = YAML.parse(m[1])
  return { questions: [], labs: [], related: [], checks: [], search: [], swatch: 'apricot', ...fm, body: m[2] }
}
const y = (name: string) => YAML.parse(rawYaml[`/content/${name}.yaml`] ?? '[]')

export const topics: Topic[] = Object.values(rawTopics).map(parseTopic).sort((a, b) => a.order - b.order)
export const terms: Term[] = (y('glossary') as Term[]).sort((a, b) => a.term.localeCompare(b.term, 'ru'))
export const sources: Source[] = y('sources')
export const media: Media[] = y('media')
export const site: any = y('site')
export const labs: LabMeta[] = Object.values(rawLabs).map((r) => YAML.parse(r) as LabMeta).sort((a, b) => a.order - b.order)

export const topicById = (id: string) => topics.find((t) => t.id === id)
export const termById = (id: string) => terms.find((t) => t.id === id)
export const sourceById = (id: string) => sources.find((s) => s.id === id)
export const labById = (id: string) => labs.find((l) => l.id === id)
export const mediaUrl = (file: string) => mediaUrls[`/content/media/${file}`]
export const mediaByFile = (file: string) => media.find((m) => m.file === file)

export const areaLabel: Record<string, string> = { production: 'Производство', rnd: 'R&D', both: 'Производство + R&D' }
export const sourceTypeLabel: Record<string, string> = {
  textbook: 'Учебник / монография', review: 'Рецензируемый обзор', paper: 'Первичное исследование',
  standard: 'Стандарт / руководство', regulation: 'Нормативный акт', manufacturer: 'Документация производителя', method: 'Методическая работа',
}

// ---------- Поиск ----------
export interface Hit { kind: 'Тема' | 'Термин' | 'Источник' | 'Занятие' | 'Рабочий вопрос'; title: string; text: string; path: string; score: number }
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 2) : w.length > 3 ? w.slice(0, w.length - 1) : w)
const tokens = (s: string) => norm(s).split(/[^a-zа-я0-9]+/).filter((w) => w.length > 1)
interface Doc { kind: Hit['kind']; title: string; text: string; path: string; body: string }
const docs: Doc[] = [
  ...topics.map((t) => ({ kind: 'Тема' as const, title: t.title, text: t.summary, path: `/topics/${t.id}`, body: t.questions.join(' ') + ' ' + t.body })),
  ...topics.flatMap((t) => t.questions.map((q) => ({ kind: 'Рабочий вопрос' as const, title: q, text: `Разбирается в теме «${t.title}»`, path: `/topics/${t.id}`, body: '' }))),
  ...terms.map((t) => ({ kind: 'Термин' as const, title: t.term, text: t.short, path: `/glossary/${t.id}`, body: (t.en ?? '') + ' ' + (t.long ?? '') })),
  ...sources.map((s) => ({ kind: 'Источник' as const, title: `${s.authors} (${s.year})`, text: s.title, path: `/sources/${s.id}`, body: s.supports + ' ' + s.where })),
  ...labs.map((l) => ({ kind: 'Занятие' as const, title: l.title, text: l.summary, path: `/labs/${l.id}`, body: l.skill + ' ' + l.role })),
]
export function search(q: string): Hit[] {
  const qs = tokens(q).map(stem)
  if (!qs.length) return []
  const hits: Hit[] = []
  for (const d of docs) {
    const tt = tokens(d.title), tx = tokens(d.text), tb = tokens(d.body)
    let score = 0, all = true
    for (const s of qs) {
      const a = tt.some((w) => w.startsWith(s)), b = tx.some((w) => w.startsWith(s)), c = tb.some((w) => w.startsWith(s))
      if (!a && !b && !c) { all = false; break }
      score += (a ? 6 : 0) + (b ? 3 : 0) + (c ? 1 : 0)
    }
    if (all) hits.push({ kind: d.kind, title: d.title, text: d.text, path: d.path, score })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 40)
}
