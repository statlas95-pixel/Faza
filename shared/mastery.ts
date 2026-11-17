// Навыки, уровни освоения и маршрут. Чистые функции: одинаково работают в браузере, на сервере и в тестах.
// Рекомендации не зависят от ИИ — они воспроизводимы при любом состоянии внешних сервисов.
export type Result = 'ok' | 'partial' | 'wrong' | 'unknown' | 'skip'
export interface Evidence {
  id: string            // уникален для источника: diag:<задание>, check:<тема>, lab:<попытка>, transfer:<занятие>
  skill: string
  kind: 'diag' | 'check' | 'lab' | 'transfer'
  item: 'recognize' | 'decide' | 'calc' | 'lab' | 'transfer'
  result: Result
  score?: number        // 0..1 для занятий
  hints?: number        // сколько подсказок наставника запрошено в попытке
  src: string           // ключ независимого источника (id занятия/темы/задания) — для подсчёта уверенности
  label: string         // что это было, человеческим языком
  note?: string         // что именно ответил ученик
  at: number
}
export const LEVELS = [
  { n: 0, name: 'Нет данных', text: 'Действий, по которым можно судить о навыке, пока не было.' },
  { n: 1, name: 'Знаком', text: 'Распознаёт явление и называет причину в проверочном вопросе.' },
  { n: 2, name: 'Выполняет с опорой', text: 'Решает задачу с подсказками или частично; либо верно решил расчётное задание.' },
  { n: 3, name: 'Выполняет самостоятельно', text: 'Прошёл занятие без подсказок с обоснованным результатом.' },
  { n: 4, name: 'Переносит', text: 'Самостоятельное решение плюс верный перенос принципа на изменённые условия.' },
] as const
export const CONF = ['—', 'предварительно', 'подтверждено', 'уверенно'] as const

/** Уровень, который поддерживает одно свидетельство. */
export function supports(e: Evidence): number {
  if (e.kind === 'lab') { const s = e.score ?? 0; return s >= 0.8 && !(e.hints ?? 0) ? 3 : s >= 0.5 ? 2 : 1 }
  if (e.kind === 'transfer') return e.result === 'ok' ? 4 : 0
  if (e.result === 'ok') return e.item === 'recognize' ? 1 : 2
  if (e.result === 'partial') return 1
  return 0
}
export interface SkillState { skill: string; level: number; confidence: number; gap?: Evidence; evidence: Evidence[]; legacy: boolean; lastAt: number }

/** Состояние навыка. legacyLabs — занятия, пройденные до появления навыков (версии 0.1–0.2). */
export function skillState(skill: string, all: Evidence[], legacyLabs: string[] = []): SkillState {
  // защита от двойного зачёта: одна запись на id, по каждому источнику берём лучшее свидетельство
  const byId = new Map<string, Evidence>()
  for (const e of all) if (e.skill === skill) { const o = byId.get(e.id); if (!o || e.at >= o.at) byId.set(e.id, e) }
  const ev = [...byId.values()].sort((a, b) => b.at - a.at)
  const bySrc = new Map<string, number>()
  for (const e of ev) bySrc.set(`${e.kind}:${e.src}`, Math.max(bySrc.get(`${e.kind}:${e.src}`) ?? 0, supports(e)))
  const direct = Math.max(0, ...[...bySrc.entries()].filter(([k]) => !k.startsWith('transfer:')).map(([, v]) => v))
  const hasTransfer = [...bySrc.entries()].some(([k, v]) => k.startsWith('transfer:') && v === 4)
  // перенос поднимает до 4 только поверх самостоятельного решения; без него он равен решению с опорой
  const level = hasTransfer ? (direct >= 3 ? 4 : Math.max(direct, 2)) : direct
  const positive = [...bySrc.values()].filter((v) => v > 0).length
  const confidence = ev.every((e) => e.kind === 'diag') ? Math.min(positive, 1) : Math.min(positive, 3)
  // затруднение: последнее по времени неверное или «не знаю», после которого не было решения уровня 2+
  const bad = ev.find((e) => e.result === 'wrong' || e.result === 'unknown' || (e.kind === 'lab' && (e.score ?? 0) < 0.5))
  const gap = bad && !ev.some((e) => e.at > bad.at && supports(e) >= 2) && level < 2 ? bad : undefined
  return { skill, level, confidence, gap, evidence: ev, legacy: level === 0 && legacyLabs.length > 0, lastAt: ev[0]?.at ?? 0 }
}

export interface TopicRef { id: string; skill?: string; prereq: string[] }
export interface RouteStep { topic: string; skill?: string; status: 'done' | 'now' | 'next' | 'later'; reason: string; because?: Evidence; viaPrereqOf?: string }
/**
 * Маршрут: темы в порядке цели; освоенные (уровень 3+) помечаются, предпосылка с затруднением поднимается вперёд.
 * Каждому шагу даётся объяснение — на каком действии ученика оно основано.
 */
export function buildRoute(order: string[], topics: TopicRef[], states: Record<string, SkillState>, diagDone: boolean): RouteStep[] {
  const T = new Map(topics.map((t) => [t.id, t]))
  const st = (id: string) => { const s = T.get(id)?.skill; return s ? states[s] : undefined }
  const done = (id: string) => (st(id)?.level ?? 0) >= 3
  const seq: { id: string; via?: string }[] = []
  const push = (id: string, via?: string) => { if (!T.has(id) || seq.some((x) => x.id === id)) return; for (const p of T.get(id)!.prereq) if (!done(p) && (st(p)?.gap || (st(p)?.level ?? 0) === 0)) push(p, id); seq.push({ id, via }) }
  // сначала темы, где диагностика показала затруднение, затем остальные по порядку цели
  const gaps = order.filter((id) => st(id)?.gap), rest = order.filter((id) => !st(id)?.gap)
  for (const id of [...gaps, ...rest]) push(id)
  let nowSet = false
  return seq.map(({ id, via }) => {
    const s = st(id), lvl = s?.level ?? 0
    if (lvl >= 3) return { topic: id, skill: T.get(id)!.skill, status: 'done' as const, reason: `Навык подтверждён действием: ${s!.evidence.find((e) => supports(e) >= 3)?.label ?? 'занятие'}.` }
    let reason: string, because: Evidence | undefined
    if (s?.gap) { because = s.gap; reason = `${s.gap.kind === 'diag' ? 'В диагностике' : 'В занятии'} «${s.gap.label}» ${s.gap.result === 'unknown' ? 'вы ответили «не знаю»' : s.gap.note ? `ваш ответ — «${s.gap.note}»` : 'результат был ниже порога'}.${via ? ` Это предпосылка для темы, которая идёт дальше.` : ''}` }
    else if (via && st(via)?.gap) { because = st(via)!.gap; reason = `Предпосылка для темы, где ${because!.kind === 'diag' ? 'диагностика' : 'занятие'} показала затруднение («${because!.label}»${because!.result === 'unknown' ? ' — ответ «не знаю»' : ''}). По самой предпосылке данных о навыке пока нет.` }
    else if (via) reason = 'Предпосылка для следующей темы маршрута; данных о навыке пока нет.'
    else if (lvl === 2) reason = `Задача решена с опорой (${s!.evidence.find((e) => supports(e) === 2)?.label}). До самостоятельного уровня не хватает занятия без подсказок.`
    else if (lvl === 1) reason = `Явление вы распознаёте (${s!.evidence.find((e) => supports(e) === 1)?.label}), но действия, подтверждающего навык, ещё не было.`
    else if (s?.legacy) reason = 'Занятие по этой теме пройдено до появления профиля навыков — уровень не оценён, нужна проверка действием.'
    else reason = diagDone ? 'По этому навыку данных нет: задание диагностики пропущено или не задавалось.' : 'Идёт по порядку выбранной цели; диагностика не пройдена, поэтому рекомендация предварительная.'
    const status = !nowSet ? 'now' : 'next'; nowSet = true
    return { topic: id, skill: T.get(id)!.skill, status: status as 'now' | 'next', reason, because, viaPrereqOf: via }
  }).map((x, i, a) => (x.status === 'next' && a.slice(0, i).filter((y) => y.status === 'next').length >= 2 ? { ...x, status: 'later' as const } : x))
}

export const DIAG_TRACKS = ['graduate', 'starter', 'experienced'] as const
export type DiagTrack = typeof DIAG_TRACKS[number]
export type DiagDomain = 'physical' | 'colloid' | 'process' | 'cosmetics'
export interface DiagItem { id: string; skill: string; kind: 'recognize' | 'decide' | 'calc'; tracks?: DiagTrack[]; domain?: DiagDomain; mode?: 'theory' | 'practice'; topic?: string; first?: string[]; after?: { item: string; result: Result[] }; short: string; q: string; options?: { text: string; result: Result; note: string }[]; answer?: number; tol?: number; unit?: string }
/** Без track читаем только прежний банк: начатая диагностика не меняется после обновления. */
export const diagItemsForTrack = (items: DiagItem[], track?: DiagTrack) => items.filter((i) => track ? i.tracks?.includes(track) : !i.tracks)
export function diagProgress(items: DiagItem[], answers: Record<string, { result: Result }>, track?: DiagTrack) {
  const eligible = diagItemsForTrack(items, track).filter((i) => !i.after || i.after.result.includes(answers[i.after.item]?.result))
  return { answered: eligible.filter((i) => !!answers[i.id]).length, total: eligible.length }
}
/** Следующее задание диагностики: сначала различающие для цели, уточняющие — только если ответ на них повлияет. */
export function nextDiagItem(items: DiagItem[], answers: Record<string, { result: Result }>, goal: string, track?: DiagTrack): DiagItem | undefined {
  const open = diagItemsForTrack(items, track).filter((i) => !answers[i.id] && (!i.after || (answers[i.after.item] && i.after.result.includes(answers[i.after.item].result))))
  // уточняющее задание идёт сразу после своего основного
  return open.find((i) => i.after) ?? open.find((i) => i.first?.includes(goal)) ?? open[0]
}
export const diagTotal = (items: DiagItem[], track?: DiagTrack) => diagItemsForTrack(items, track).filter((i) => !i.after).length
