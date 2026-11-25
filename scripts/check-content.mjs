// Проверка целостности контента: npm run check
// Находит битые ссылки на термины, источники, темы, занятия, изображения и ошибки в сценариях.
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const C = 'content'
const errors = [], warns = []
const err = (f, m) => errors.push(`${f}: ${m}`)
const readY = (f) => { try { return YAML.parse(fs.readFileSync(path.join(C, f), 'utf8'), (key, value) => {
    if (value === null && /[а-яё]/i.test(key)) err(f, `неожиданный пустой ключ «${key}»; проверьте кавычки вокруг текста с запятой`)
    return value
  }) } catch (e) { err(f, `не читается YAML — ${e.message.split('\n')[0]}`); return null } }

const sources = readY('sources.yaml') ?? [], terms = readY('glossary.yaml') ?? [], media = readY('media.yaml') ?? [], site = readY('site.yaml') ?? {}
const srcIds = new Set(sources.map((s) => s.id)), termIds = new Set(terms.map((t) => t.id))
const dup = (arr, f) => arr.forEach((x, i) => arr.findIndex((y) => y.id === x.id) !== i && err(f, `повтор id «${x.id}»`))
dup(sources, 'sources.yaml'); dup(terms, 'glossary.yaml')
for (const s of sources) for (const k of ['type', 'authors', 'title', 'where', 'year', 'supports', 'verified']) if (!s[k]) err('sources.yaml', `у «${s.id}» нет поля ${k}`)
for (const s of sources) if (!s.doi && !s.url) warns.push(`sources.yaml: у «${s.id}» нет ни DOI, ни URL`)

const topics = fs.readdirSync(path.join(C, 'topics')).filter((f) => f.endsWith('.md')).map((f) => {
  const raw = fs.readFileSync(path.join(C, 'topics', f), 'utf8'), m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!m) { err(f, 'нет шапки ---'); return null }
  try { return { file: `topics/${f}`, ...YAML.parse(m[1]), body: m[2] } } catch (e) { err(f, `шапка не читается — ${e.message.split('\n')[0]}`); return null }
}).filter(Boolean)
const labs = fs.readdirSync(path.join(C, 'labs')).filter((f) => f.endsWith('.yaml')).map((f) => ({ file: `labs/${f}`, ...(readY(`labs/${f}`) ?? {}) }))
const topicIds = new Set(topics.map((t) => t.id)), labIds = new Set(labs.map((l) => l.id))
dup(topics, 'topics'); dup(labs, 'labs')
const mediaFiles = new Set(fs.readdirSync(path.join(C, 'media')))
for (const m of media) { if (!mediaFiles.has(m.file)) err('media.yaml', `нет файла media/${m.file}`); for (const k of ['author', 'source', 'license', 'attribution', 'alt']) if (!m[k]) err('media.yaml', `у «${m.file}» нет поля ${k}`) }
for (const f of mediaFiles) if (!media.find((m) => m.file === f)) err('media.yaml', `файл media/${f} не внесён в реестр`)

function checkText(file, text) {
  for (const m of text.matchAll(/\[\[([\w-]+)(?:\|[^\]]+)?\]\]/g)) if (!termIds.has(m[1])) err(file, `неизвестный термин [[${m[1]}]]`)
  for (const m of text.matchAll(/\[@([^\]]+)\]/g)) for (const x of m[1].split(';')) { const id = x.trim().replace(/^@/, ''); if (!srcIds.has(id)) err(file, `неизвестный источник [@${id}]`) }
  for (const m of text.matchAll(/\(#\/(topics|labs)\/([\w-]+)\)/g)) if (!(m[1] === 'topics' ? topicIds : labIds).has(m[2])) err(file, `ссылка на несуществующую страницу #/${m[1]}/${m[2]}`)
  for (const m of text.matchAll(/\(media:([^\s)"]+)/g)) if (!mediaFiles.has(m[1])) err(file, `нет изображения media/${m[1]}`)
  if ((text.match(/^:::/gm) ?? []).length % 2) err(file, 'непарный блок :::')
}
for (const t of topics) {
  for (const k of ['id', 'title', 'summary', 'area', 'domain', 'order', 'review']) if (t[k] === undefined) err(t.file, `нет поля ${k}`)
  if (![1, 2, 3].includes(t.level)) err(t.file, 'level должен быть 1, 2 или 3')
  checkText(t.file, t.body)
  if (!/\[@/.test(t.body)) err(t.file, 'в теме нет ни одной ссылки на источник')
  for (const l of t.labs ?? []) if (!labIds.has(l)) err(t.file, `labs: нет занятия «${l}»`)
  for (const r of t.related ?? []) if (!topicIds.has(r)) err(t.file, `related: нет темы «${r}»`)
  for (const [i, c] of (t.checks ?? []).entries()) if ((c.options ?? []).filter((o) => o.correct).length !== 1) err(t.file, `проверочный вопрос ${i + 1}: должен быть ровно один верный вариант`)
}
for (const t of terms) { for (const x of t.topics ?? []) if (!topicIds.has(x)) err('glossary.yaml', `«${t.id}»: нет темы ${x}`); for (const x of t.sources ?? []) if (!srcIds.has(x)) err('glossary.yaml', `«${t.id}»: нет источника ${x}`) }
for (const t of terms) for (const x of t.see ?? []) if (!termIds.has(x)) err('glossary.yaml', `«${t.id}»: нет термина see «${x}»`)
for (const l of labs) {
  for (const k of ['id', 'engine', 'title', 'summary', 'role', 'skill', 'brief', 'dataNote']) if (!l[k]) err(l.file, `нет поля ${k}`)
  for (const x of l.topics ?? []) if (!topicIds.has(x)) err(l.file, `topics: нет темы ${x}`)
  checkText(l.file, JSON.stringify(l))
  const qs = [...(l.questions ?? []), ...(l.transferQuiz?.questions ?? []), ...(l.steps ?? []).flatMap((x) => x.questions ?? []), ...(typeof l.transfer === 'object' ? l.transfer?.questions ?? [] : [])]
  qs.forEach((q, i) => { if (q.type === 'mc' && (q.options ?? []).filter((o) => o.correct).length !== 1) err(l.file, `вопрос ${i + 1}: нужен ровно один верный вариант`); if (q.type === 'num' && !Number.isFinite(q.answer)) err(l.file, `вопрос ${i + 1}: нет конечного числового ответа`); if (q.tol !== undefined && (!Number.isFinite(q.tol) || q.tol < 0)) err(l.file, `вопрос ${i + 1}: некорректный допуск tol`) })
  if (l.transferOf && !labIds.has(l.transferOf)) err(l.file, `transferOf: нет занятия ${l.transferOf}`)
  if (l.engine === 'investigation') {
    const ev = new Set(l.requests.map((r) => r.id))
    for (const d of l.documents) { for (const s of d.sections) for (const r of s.rows) { if (r.id) ev.add(r.id); if (r.cells.length !== s.columns.length) err(l.file, `документ «${d.id}», раздел «${s.title}»: в строке ${r.cells.length} ячеек при ${s.columns.length} столбцах`) } for (const n of d.notes ?? []) ev.add(n.id) }
    const cost = l.requests.reduce((a, r) => a + r.cost, 0)
    if (cost <= l.budget) warns.push(`${l.file}: бюджета хватает на все запросы — выбор исчезает`)
    for (const h of l.hypotheses) for (const [st, v] of Object.entries(h.statuses)) { if (!['ok', 'weak', 'wrong'].includes(v.verdict)) err(l.file, `гипотеза ${h.id}/${st}: verdict`); for (const n of v.needs ?? []) if (!ev.has(n)) err(l.file, `гипотеза ${h.id}/${st}: основание «${n}» не найдено в документах и запросах`) }
    for (const h of l.hypotheses) for (const st of ['main', 'contrib', 'excluded', 'untested']) if (!h.statuses[st]) err(l.file, `гипотеза ${h.id}: нет статуса ${st}`)
    for (const d of l.dispositions) for (const v of d.variants ?? []) for (const w of v.when) if (!(w.startsWith('main:') ? l.hypotheses.some((h) => h.id === w.slice(5)) : ev.has(w))) err(l.file, `решение ${d.id}: условие «${w}» не найдено`)
    if (l.transfer && !labIds.has(l.transfer)) err(l.file, `transfer: нет занятия ${l.transfer}`)
  }
  if (l.engine === 'gmp') {
    if (!l.batchMeta?.batchNo || !Array.isArray(l.steps) || l.steps.length < 4) err(l.file, 'gmp: нужны batchMeta и не менее 4 этапов steps')
    if (!Array.isArray(l.dispositions) || l.dispositions.filter((d) => d.verdict === 'ok').length !== 1) err(l.file, 'gmp: нужен ровно один verdict: ok в dispositions')
    if (!Array.isArray(l.capa) || l.capa.filter((c) => c.valid).length < 2) err(l.file, 'gmp: нужно не менее двух валидных мер capa')
  }
  if (l.engine === 'branching') {
    const nodes = Array.isArray(l.nodes) ? l.nodes : []
    const ids = new Set(nodes.map((n) => n.id))
    if (!ids.has(l.start)) err(l.file, `branching: стартовый узел «${l.start}» не найден`)
    for (const n of nodes) {
      for (const c of n.choices ?? []) if (!ids.has(c.next)) err(l.file, `branching: узел «${n.id}» ссылается на несуществующий узел «${c.next}»`)
    }
    if (!nodes.some((n) => n.outcome && n.outcome.score >= 0.85)) err(l.file, 'branching: нет успешного исхода (score >= 0.85)')
  }
  if (l.engine === 'shift-trend') {
    if (!Array.isArray(l.points) || l.points.length < 4 || !Number.isFinite(l.anomalyMin)) err(l.file, 'shift-trend: нужны points (>=4) и anomalyMin')
    if (!Array.isArray(l.causes) || l.causes.filter((c) => c.verdict === 'ok').length !== 1) err(l.file, 'shift-trend: нужен ровно один verdict: ok в causes')
    if (!Array.isArray(l.actions) || l.actions.filter((a) => a.verdict === 'ok').length !== 1) err(l.file, 'shift-trend: нужен ровно один verdict: ok в actions')
  }
  if (l.engine === 'coa') {
    if (!Array.isArray(l.lots) || l.lots.length < 2) err(l.file, 'coa: нужно не менее 2 партий lots')
    for (const lot of l.lots ?? []) if (!['approve', 'quarantine', 'reject'].includes(lot.expected)) err(l.file, `coa: у ${lot.id} неверный expected`)
  }
  if (l.engine === 'label-audit') {
    if (!Array.isArray(l.items) || l.items.filter((i) => i.hasViolation).length < 2) err(l.file, 'label-audit: нужно не менее 2 нарушений в items')
  }
}
for (const t of site.tasks ?? []) { const m = t.to.match(/^\/(topics|labs)\/(.+)$/); if (m && !(m[1] === 'topics' ? topicIds : labIds).has(m[2])) err('site.yaml', `tasks: нет страницы ${t.to}`) }
for (const s of site.track?.steps ?? []) { if (s.topic && !topicIds.has(s.topic)) err('site.yaml', `track: нет темы ${s.topic}`); if (s.lab && !labIds.has(s.lab)) err('site.yaml', `track: нет занятия ${s.lab}`) }
const unused = sources.filter((s) => !topics.some((t) => t.body.includes(`@${s.id}`)) && !labs.some((l) => JSON.stringify(l).includes(`@${s.id}`)) && !terms.some((t) => (t.sources ?? []).includes(s.id)) && !fs.readFileSync(path.join(C, 'about.md'), 'utf8').includes(`@${s.id}`))
for (const s of unused) warns.push(`sources.yaml: источник «${s.id}» нигде не используется`)

// карта знаний, навыки, диагностика
const cur = readY('curriculum.yaml') ?? { sections: [], goals: [] }, skills = readY('skills.yaml') ?? [], diag = readY('diagnostic.yaml') ?? []
const mapped = cur.sections.flatMap((s) => s.modules.flatMap((m) => m.topics.map((t) => t.id)))
dup(skills, 'skills.yaml'); dup(diag, 'diagnostic.yaml')
const refs = cur.sections.flatMap((s) => s.modules.flatMap((m) => m.topics))
dup(refs, 'curriculum.yaml')
for (const s of cur.sections) for (const m of s.modules) for (const id of m.also ?? []) if (!topicIds.has(id)) err('curriculum.yaml', `also: нет темы «${id}»`)
const graph = new Map(refs.map((t) => [t.id, t.prereq ?? []]))
for (const t of refs) for (const id of t.prereq ?? []) if (!graph.has(id)) err('curriculum.yaml', `«${t.id}»: нет предпосылки «${id}» в карте знаний`)
const visited = new Set(), active = new Set()
function visit(id) {
  if (active.has(id)) { err('curriculum.yaml', `цикл предпосылок у «${id}»`); return }
  if (visited.has(id)) return
  active.add(id)
  for (const p of graph.get(id) ?? []) visit(p)
  active.delete(id); visited.add(id)
}
for (const id of graph.keys()) visit(id)
for (const t of topics) if (!mapped.includes(t.id)) err('curriculum.yaml', `тема «${t.id}» не размещена ни в одном модуле карты знаний`)
for (const id of mapped) if (!topicIds.has(id)) err('curriculum.yaml', `в карте указана несуществующая тема «${id}»`)
for (const t of topics) if (!skills.some((s) => s.topics.includes(t.id))) err('skills.yaml', `у темы «${t.id}» нет навыка`)
for (const s of skills) { for (const x of s.topics) if (!topicIds.has(x)) err('skills.yaml', `навык ${s.id}: нет темы ${x}`); for (const x of s.labs) if (!labIds.has(x)) err('skills.yaml', `навык ${s.id}: нет занятия ${x}`) }
for (const l of labs) if (!skills.some((s) => s.labs.includes(l.id))) warns.push(`skills.yaml: занятие «${l.id}» не привязано к навыку — его результат не повлияет на профиль`)
for (const g of cur.goals) for (const id of mapped) if (!g.order.includes(id)) err('curriculum.yaml', `цель ${g.id}: в порядке нет темы ${id}`)
for (const g of cur.goals) for (const id of g.order) if (!topicIds.has(id)) err('curriculum.yaml', `цель ${g.id}: неизвестная тема ${id}`)
for (const d of diag) { if (!skills.some((s) => s.id === d.skill)) err('diagnostic.yaml', `${d.id}: нет навыка ${d.skill}`); if (d.after && !diag.some((x) => x.id === d.after.item)) err('diagnostic.yaml', `${d.id}: after ссылается на несуществующее задание`) }
const tracks = readY('diagnostic-tracks.yaml') ?? [], trackIds = new Set(tracks.map((t) => t.id))
dup(tracks, 'diagnostic-tracks.yaml')
for (const id of ['graduate', 'starter', 'experienced']) if (!trackIds.has(id)) err('diagnostic-tracks.yaml', `нет варианта ${id}`)
for (const t of tracks) {
  if (!['graduate', 'starter', 'experienced'].includes(t.id)) err('diagnostic-tracks.yaml', `неизвестный вариант ${t.id}`)
  for (const k of ['name', 'description', 'time']) if (!t[k]) err('diagnostic-tracks.yaml', `${t.id}: нет поля ${k}`)
  const bank = diag.filter((d) => Array.isArray(d.tracks) && d.tracks.includes(t.id) && !d.after)
  if (bank.length < 8 || bank.length > 12) err('diagnostic.yaml', `${t.id}: основная часть должна содержать 8–12 вопросов`)
  for (const mode of ['theory', 'practice']) if (bank.filter((d) => d.mode === mode).length < 2) err('diagnostic.yaml', `${t.id}: нужно не менее двух вопросов ${mode}`)
  for (const domain of ['physical', 'colloid', 'process', 'cosmetics']) if (!bank.some((d) => d.domain === domain)) err('diagnostic.yaml', `${t.id}: нет области ${domain}`)
}
for (const d of diag) {
  if (d.tracks) {
    if (!Array.isArray(d.tracks) || !d.tracks.length || d.tracks.some((id) => !trackIds.has(id))) err('diagnostic.yaml', `${d.id}: неизвестный вариант tracks`)
    if (!['physical', 'colloid', 'process', 'cosmetics'].includes(d.domain)) err('diagnostic.yaml', `${d.id}: неизвестная область domain`)
    if (!['theory', 'practice'].includes(d.mode)) err('diagnostic.yaml', `${d.id}: нужен mode theory или practice`)
    if (!topicIds.has(d.topic)) err('diagnostic.yaml', `${d.id}: нет темы разбора ${d.topic}`)
  }
  if (d.options) {
    if (d.options.filter((o) => o.result === 'ok').length !== 1) err('diagnostic.yaml', `${d.id}: нужен ровно один верный вариант`)
    if (d.options.some((o) => !['ok', 'partial', 'wrong'].includes(o.result))) err('diagnostic.yaml', `${d.id}: неизвестный результат варианта`)
  } else if (!Number.isFinite(d.answer)) err('diagnostic.yaml', `${d.id}: нужен конечный числовой ответ`)
  if (d.tol !== undefined && (!Number.isFinite(d.tol) || d.tol < 0)) err('diagnostic.yaml', `${d.id}: некорректный допуск tol`)
  if (d.after) {
    const parent = diag.find((x) => x.id === d.after.item)
    if (!Array.isArray(d.after.result) || !d.after.result.length || d.after.result.some((r) => !['ok', 'partial', 'wrong', 'unknown', 'skip'].includes(r))) err('diagnostic.yaml', `${d.id}: некорректное условие after`)
    if (parent && Array.isArray(d.tracks) && d.tracks.some((id) => !Array.isArray(parent.tracks) || !parent.tracks.includes(id))) err('diagnostic.yaml', `${d.id}: родитель уточнения из другого варианта`)
    const seen = new Set([d.id]); let p = parent
    while (p) { if (seen.has(p.id)) { err('diagnostic.yaml', `${d.id}: цикл уточнений`); break }; seen.add(p.id); p = p.after ? diag.find((x) => x.id === p.after.item) : undefined }
  }
}
// каталог ингредиентов и пресеты песочницы рецептур
const ingredients = readY('ingredients.yaml') ?? []
const sandboxPresets = readY('sandbox-presets.yaml') ?? []
const ingIds = new Set(ingredients.map((i) => i.id))
dup(ingredients, 'ingredients.yaml'); dup(sandboxPresets, 'sandbox-presets.yaml')
const validRoles = new Set(['solvent', 'humectant', 'emollient', 'emulsifier', 'thickener', 'surfactant', 'active', 'preservative', 'uv_filter', 'ph_adjuster', 'electrolyte', 'antioxidant', 'fragrance', 'chelator', 'solubilizer'])
const validIonic = new Set(['nonionic', 'anionic', 'cationic', 'amphoteric'])
for (const ing of ingredients) {
  for (const k of ['id', 'inci', 'name', 'note']) if (typeof ing[k] !== 'string' || !ing[k].trim()) err('ingredients.yaml', `у «${ing.id}» нет поля ${k}`)
  if (!validRoles.has(ing.role)) err('ingredients.yaml', `«${ing.id}»: неизвестная роль ${ing.role}`)
  if (!['A', 'B', 'C'].includes(ing.recommendedPhase)) err('ingredients.yaml', `«${ing.id}»: фаза должна быть A, B или C`)
  if (!validIonic.has(ing.ionic)) err('ingredients.yaml', `«${ing.id}»: неизвестная ионность ${ing.ionic}`)
  if (!Array.isArray(ing.typicalRange) || ing.typicalRange.length !== 2 || !Number.isFinite(ing.typicalRange[0]) || !Number.isFinite(ing.typicalRange[1]) || ing.typicalRange[0] < 0 || ing.typicalRange[1] < ing.typicalRange[0]) err('ingredients.yaml', `«${ing.id}»: некорректный typicalRange`)
  if (!Number.isFinite(ing.costPerKg) || ing.costPerKg < 0) err('ingredients.yaml', `«${ing.id}»: некорректная цена costPerKg`)
  if (ing.hlb !== undefined && (!Number.isFinite(ing.hlb) || ing.hlb < 0 || ing.hlb > 20)) err('ingredients.yaml', `«${ing.id}»: некорректный hlb`)
  if (ing.reqHlb !== undefined && (!Number.isFinite(ing.reqHlb) || ing.reqHlb < 0 || ing.reqHlb > 20)) err('ingredients.yaml', `«${ing.id}»: некорректный reqHlb`)
  for (const r of ing.regulatory ?? []) {
    if (!r.standard || !r.note) err('ingredients.yaml', `«${ing.id}»: в regulatory нужны standard и note`)
  }
}
for (const p of sandboxPresets) {
  for (const k of ['id', 'title', 'summary']) if (!p[k]) err('sandbox-presets.yaml', `у «${p.id}» нет поля ${k}`)
  if (!['leave-on', 'rinse-off'].includes(p.productType)) err('sandbox-presets.yaml', `«${p.id}»: некорректный productType`)
  for (const r of p.rows ?? []) {
    if (!ingIds.has(r.ingredientId)) err('sandbox-presets.yaml', `«${p.id}»: неизвестный ингредиент ${r.ingredientId}`)
    if (!['A', 'B', 'C'].includes(r.phase)) err('sandbox-presets.yaml', `«${p.id}»: некорректная фаза ${r.phase}`)
  }
}

console.log(`Темы: ${topics.length} · занятия: ${labs.length} · термины: ${terms.length} · источники: ${sources.length} · ингредиенты: ${ingredients.length} · изображения: ${media.length}`)
warns.forEach((w) => console.log('  предупреждение — ' + w))
if (errors.length) { errors.forEach((e) => console.error('  ОШИБКА — ' + e)); console.error(`\nНайдено ошибок: ${errors.length}`); process.exit(1) }
console.log('Ошибок не найдено.')
