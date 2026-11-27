import { tr, language, localizeMaterial } from '../shared/locale'
import type { Ingredient, SandboxPreset } from '../shared/formulation'
import YAML from 'yaml'

// Весь научный контент лежит в папке /content и подключается сюда как текст.
// Интерфейсный код не содержит учебных формулировок — правьте файлы в /content.
const rawTopics = import.meta.glob('/content/topics/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const rawLabs = import.meta.glob('/content/labs/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const rawYaml = import.meta.glob('/content/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const mediaUrls = import.meta.glob(['/content/media/*.{svg,png,jpg,jpeg,webp}', '/content/locales/en/media/*.svg'], { query: '?url', import: 'default', eager: true }) as Record<string, string>

export interface Check { q: string; options: { text: string; correct?: boolean; why: string }[] }
export interface Topic {
  id: string; title: string; summary: string; area: 'production' | 'rnd' | 'both'; domain: string
  minutes: number; order: number; questions: string[]; labs: string[]; related: string[]
  checks: Check[]; review: string; updated: string; body: string; swatch: string; search: string[]; level: 1 | 2 | 3
}
export interface Term { id: string; term: string; en?: string; short: string; long?: string; topics?: string[]; sources?: string[]; level?: 'base' | 'adv'; area?: string; see?: string[] }
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
  if (!m) throw new Error(tr("В файле темы нет шапки ---"))
  const fm = localizeMaterial(YAML.parse(m[1]))
  return { questions: [], labs: [], related: [], checks: [], search: [], swatch: 'apricot', level: 2, ...fm, body: tr(m[2]) }
}
const y = (name: string) => localizeMaterial(YAML.parse(rawYaml[`/content/${name}.yaml`] ?? '[]'))

export const topics: Topic[] = Object.values(rawTopics).map(parseTopic).sort((a, b) => a.order - b.order)
export const terms: Term[] = (y('glossary') as Term[]).map(term => language === 'en' && term.en ? { ...term, term: term.en } : term).sort((a, b) => a.term.localeCompare(b.term, language))
export const sources: Source[] = y('sources')
export const media: Media[] = y('media')
export const site: any = y('site')
export const ingredients: Ingredient[] = y('ingredients')
export const sandboxPresets: SandboxPreset[] = y('sandbox-presets')
export const labs: LabMeta[] = Object.values(rawLabs).map((r) => localizeMaterial(YAML.parse(r)) as LabMeta).sort((a, b) => a.order - b.order)

const topicMap = new Map(topics.map((t) => [t.id, t]))
const termMap = new Map(terms.map((t) => [t.id, t]))
const sourceMap = new Map(sources.map((s) => [s.id, s]))
const labMap = new Map(labs.map((l) => [l.id, l]))
const ingredientMap = new Map(ingredients.map((i) => [i.id, i]))
const mediaMap = new Map(media.map((m) => [m.file, m]))

export const topicById = (id: string) => topicMap.get(id)
export const termById = (id: string) => termMap.get(id)
export const sourceById = (id: string) => sourceMap.get(id)
export const labById = (id: string) => labMap.get(id)
export const ingredientById = (id: string) => ingredientMap.get(id)
export const mediaUrl = (file: string) => (language === 'en' && mediaUrls[`/content/locales/en/media/${file}`]) || mediaUrls[`/content/media/${file}`]
export const mediaByFile = (file: string) => mediaMap.get(file)

/** Ступени сложности темы: от простого к сложному. */
export const levelLabel: Record<number, string> = { 1: tr("Основа"), 2: tr("Практика"), 3: tr("Углублённо") }
export const levelHint: Record<number, string> = { 1: tr("Понятия и расчёты, на которые опирается всё остальное"), 2: tr("Механизм и типовые рабочие решения"), 3: tr("Тонкие эффекты, ограничения моделей, спорные случаи") }
/** Области словаря. */
export const termAreas: Record<string, string> = { raw: tr("Сырьё и растворы"), colloid: tr("Коллоидная и поверхностная химия"), rheo: tr("Реология"), process: tr("Процессы и аппараты"), stab: tr("Стабильность и контроль"), micro: tr("Микробиология и консервирование"), stat: tr("Эксперимент и статистика"), reg: tr("Нормативы и качество") }
export const areaLabel: Record<string, string> = { production: tr("Производство"), rnd: 'R&D', both: tr("Производство + R&D") }
export const sourceTypeLabel: Record<string, string> = {
  textbook: tr("Учебник / монография"), review: tr("Рецензируемый обзор"), paper: tr("Первичное исследование"),
  standard: tr("Стандарт / руководство"), regulation: tr("Нормативный акт"), manufacturer: tr("Документация производителя"), method: tr("Методическая работа"),
}

// ---------- Поиск ----------
export interface Hit { kind: 'Тема' | 'Термин' | 'Источник' | 'Занятие' | 'Рабочий вопрос'; title: string; text: string; path: string; score: number }
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
const stem = (w: string) => (w.length > 5 ? w.slice(0, w.length - 2) : w.length > 3 ? w.slice(0, w.length - 1) : w)
const tokens = (s: string) => norm(s).split(/[^a-zа-я0-9]+/).filter((w) => w.length > 1)
interface Doc { kind: Hit['kind']; title: string; text: string; path: string; body: string }
let _docs: Doc[] | null = null
function getDocs(): Doc[] {
  if (!_docs) {
    _docs = [
      ...topics.map((t) => ({ kind: 'Тема' as const, title: t.title, text: t.summary, path: `/topics/${t.id}`, body: t.questions.join(' ') + ' ' + t.body })),
      ...topics.flatMap((t) => t.questions.map((q) => ({ kind: 'Рабочий вопрос' as const, title: q, text: `${tr("Разбирается в теме «")}${t.title}»`, path: `/topics/${t.id}`, body: '' }))),
      ...terms.map((t) => ({ kind: 'Термин' as const, title: t.term, text: t.short, path: `/glossary/${t.id}`, body: (t.en ?? '') + ' ' + (t.long ?? '') })),
      ...sources.map((s) => ({ kind: 'Источник' as const, title: `${s.authors} (${s.year})`, text: s.title, path: `/sources/${s.id}`, body: s.supports + ' ' + s.where })),
      ...labs.map((l) => ({ kind: 'Занятие' as const, title: l.title, text: l.summary, path: `/labs/${l.id}`, body: l.skill + ' ' + l.role })),
    ]
  }
  return _docs
}
export function search(q: string): Hit[] {
  const qs = tokens(q).map(stem)
  if (!qs.length) return []
  const hits: Hit[] = []
  for (const d of getDocs()) {
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
