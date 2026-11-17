import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { skillState, buildRoute, nextDiagItem, supports, type Evidence, type DiagItem, type TopicRef } from '../shared/mastery'
import { mergeProgress, normalize } from '../shared/merge'

const y = (f: string) => YAML.parse(fs.readFileSync(`content/${f}.yaml`, 'utf8'))
const skills = y('skills') as any[], cur = y('curriculum'), items = y('diagnostic') as DiagItem[]
const refs: TopicRef[] = cur.sections.flatMap((s: any) => s.modules.flatMap((m: any) => m.topics.map((t: any) => ({ id: t.id, skill: skills.find((k) => k.topics.includes(t.id))?.id, prereq: t.prereq ?? [] }))))
const ev = (o: Partial<Evidence>): Evidence => ({ id: 'x', skill: 'rheo', kind: 'diag', item: 'decide', result: 'ok', src: 's', label: 'l', at: 1, ...o })
const states = (list: Evidence[]) => Object.fromEntries(skills.map((s) => [s.id, skillState(s.id, list)]))
const route = (goal: string, list: Evidence[], done = true) => buildRoute(cur.goals.find((g: any) => g.id === goal).order, refs, states(list), done)
const diag = (answers: Record<string, 'ok' | 'partial' | 'wrong' | 'unknown' | 'skip'>): Evidence[] => Object.entries(answers).filter(([, r]) => r !== 'skip').map(([id, r], i) => { const it = items.find((x) => x.id === id)!; return ev({ id: `diag:${id}`, skill: it.skill, item: it.kind, result: r, src: id, label: it.short, note: 'ответ', at: 10 + i }) })

describe('Шкала освоения', () => {
  it('просмотр и диагностика не дают самостоятельного уровня', () => {
    expect(supports(ev({ item: 'recognize' }))).toBe(1); expect(supports(ev({ item: 'calc' }))).toBe(2)
    expect(skillState('rheo', [ev({}), ev({ id: 'check:t', kind: 'check', item: 'recognize', src: 't' })]).level).toBe(2)
  })
  it('занятие: без подсказок и ≥80 % — самостоятельно; с подсказкой — с опорой', () => {
    expect(skillState('rheo', [ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 0.9, hints: 0, src: 'rheo-cabinet' })]).level).toBe(3)
    expect(skillState('rheo', [ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 0.9, hints: 1, src: 'rheo-cabinet' })]).level).toBe(2)
    expect(skillState('rheo', [ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 0.6, src: 'rheo-cabinet' })]).level).toBe(2)
  })
  it('перенос поднимает до 4 только поверх самостоятельного решения', () => {
    const tr = ev({ id: 'transfer:l', kind: 'transfer', item: 'transfer', src: 'l' })
    expect(skillState('rheo', [tr]).level).toBe(2)
    expect(skillState('rheo', [tr, ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 1, src: 'l' })]).level).toBe(4)
  })
  it('одна попытка не засчитывается дважды; уверенность растёт только от независимых источников', () => {
    const a = ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 1, src: 'l' })
    expect(skillState('rheo', [a, { ...a }, { ...a, at: 5 }]).confidence).toBe(1)
    expect(skillState('rheo', [a, ev({ id: 'lab:b', kind: 'lab', item: 'lab', score: 1, src: 'l' })]).confidence).toBe(1) // то же занятие повторно
    expect(skillState('rheo', [a, ev({ id: 'diag:d', src: 'd' }), ev({ id: 'check:t', kind: 'check', src: 't' })]).confidence).toBe(3)
  })
  it('«не знаю» и ошибка — затруднение; оно снимается решением', () => {
    const bad = ev({ id: 'diag:d', result: 'unknown', at: 1 })
    expect(skillState('rheo', [bad]).gap?.result).toBe('unknown'); expect(skillState('rheo', [ev({ id: 'diag:d', result: 'skip' as any })]).gap).toBeUndefined()
    expect(skillState('rheo', [bad, ev({ id: 'lab:a', kind: 'lab', item: 'lab', score: 0.9, src: 'l', at: 9 })]).gap).toBeUndefined()
  })
  it('прежние прохождения помечаются как неоценённые', () => expect(skillState('rheo', [], ['rheo-cabinet']).legacy).toBe(true))
})

describe('Диагностика и маршрут', () => {
  it('все навыки, темы и занятия из карты существуют', () => {
    const topicIds = fs.readdirSync('content/topics').map((f) => f.replace('.md', '')), labIds = fs.readdirSync('content/labs').map((f) => f.replace('.yaml', ''))
    for (const s of skills) { for (const t of s.topics) expect(topicIds, `тема ${t}`).toContain(t); for (const l of s.labs) expect(labIds, `занятие ${l}`).toContain(l) }
    for (const r of refs) { expect(topicIds).toContain(r.id); expect(r.skill, `навык темы ${r.id}`).toBeTruthy(); for (const p of r.prereq) expect(topicIds).toContain(p) }
    for (const g of cur.goals) expect([...g.order].sort()).toEqual(refs.map((r) => r.id).sort())
    for (const i of items) { expect(skills.some((s) => s.id === i.skill)).toBe(true); if (i.options) expect(i.options.filter((o) => o.result === 'ok')).toHaveLength(1); else expect(typeof i.answer).toBe('number') }
  })
  it('порядок заданий зависит от цели; уточняющие появляются только после верного ответа', () => {
    expect(nextDiagItem(items, {}, 'prod')!.id).not.toBe(nextDiagItem(items, {}, 'rnd')!.id)
    expect(nextDiagItem(items, { 'd-rheo': { result: 'ok' } }, 'rnd')!.id).toBe('d-rheo-calc')
    expect(nextDiagItem(items, { 'd-rheo': { result: 'wrong' } }, 'rnd')!.id).not.toBe('d-rheo-calc')
    const all = Object.fromEntries(items.map((i) => [i.id, { result: 'ok' as const }])); expect(nextDiagItem(items, all, 'rnd')).toBeUndefined()
  })
  const novice = diag({ 'd-sol': 'unknown', 'd-ph': 'unknown', 'd-colloid': 'unknown', 'd-heat': 'unknown', 'd-rheo': 'unknown', 'd-mech': 'wrong', 'd-struct': 'wrong', 'd-mixing': 'unknown', 'd-scale': 'unknown', 'd-surf': 'unknown', 'd-micro': 'wrong', 'd-doe': 'unknown' })
  const floor = diag({ 'd-sol': 'ok', 'd-ph': 'ok', 'd-heat': 'ok', 'd-colloid': 'wrong', 'd-struct': 'ok', 'd-mixing': 'ok', 'd-scale': 'ok', 'd-emul': 'ok', 'd-surf': 'ok', 'd-rheo': 'wrong', 'd-mech': 'partial', 'd-stab': 'wrong', 'd-micro': 'wrong', 'd-doe': 'unknown' })
  const chemist = diag({ 'd-sol': 'ok', 'd-ph': 'ok', 'd-colloid': 'ok', 'd-heat': 'wrong', 'd-rheo': 'ok', 'd-rheo-calc': 'ok', 'd-mech': 'ok', 'd-stab': 'ok', 'd-micro': 'ok', 'd-doe': 'ok', 'd-surf': 'partial', 'd-struct': 'partial', 'd-mixing': 'wrong', 'd-scale': 'unknown' })
  it('три профиля получают разные первые шаги, и у каждого есть объяснение', () => {
    const a = route('base', novice)[0], b = route('prod', floor)[0], c = route('rnd', chemist)[0]
    expect(a.topic).toBe('solutions-basics'); expect(b.topic).toBe('preservation'); expect(c.topic).toBe('emulsification')
    for (const r of [a, b, c]) { expect(r.status).toBe('now'); expect(r.reason.length).toBeGreaterThan(20); expect(r.because?.kind).toBe('diag') }
    expect(b.reason).toContain('сорбат'); expect(a.reason).toContain('50 % щёлочь'); expect(c.reason).toContain('обороты для той же окружной скорости')
  })
  it('технологу производства не предлагают сначала то, что он решил верно', () => {
    const first3 = route('prod', floor).slice(0, 3).map((r) => r.topic)
    expect(first3).not.toContain('mixing-basics'); expect(first3).not.toContain('scale-up')
  })
  it('без диагностики маршрут идёт по цели и помечен как предварительный', () => {
    const order = cur.goals.find((g: any) => g.id === 'prod').order, first = refs.find((t) => t.id === order[0])!
    const r = route('prod', [], false); expect([order[0], ...first.prereq]).toContain(r[0].topic); expect(r[0].reason.length).toBeGreaterThan(20)
    expect(route('prod', [], false).some((x) => x.reason.includes('предварительная'))).toBe(true)
  })
  it('смена цели меняет порядок, но не уровни', () => {
    const lab = [ev({ id: 'lab:a', skill: 'mech', kind: 'lab', item: 'lab', score: 1, src: 'stability-bench' })]
    expect(route('rnd', lab).find((r) => r.topic === 'emulsion-stability')!.status).toBe('done'); expect(route('prod', lab).find((r) => r.topic === 'emulsion-stability')!.status).toBe('done')
    expect(route('rnd', lab).find((r) => r.status === 'now')!.topic).not.toBe(route('prod', lab).find((r) => r.status === 'now')!.topic)
  })
})

describe('Совместимость данных 0.2 → 0.3', () => {
  it('запись прогресса 0.2 дополняется пустыми полями и ничего не теряет', () => {
    const v02 = { visited: { a: 1 }, scroll: {}, checks: {}, labs: {}, labDone: { 'rheo-cabinet': { at: 5, attempts: 1 } }, bookmarks: [], attempts: [{ id: 'a1', labId: 'rheo-cabinet', at: 5, summary: 's' }], savedSources: [], settings: { level: 'expert', hints: false } }
    const n = normalize(v02); expect(n.evidence).toEqual([]); expect(n.diag.answers).toEqual({}); expect(n.profile).toEqual({}); expect(n.attempts).toHaveLength(1); expect(n.settings.level).toBe('expert')
  })
  it('слияние: свидетельства объединяются по id, диагностика — по более позднему ответу', () => {
    const a = { ...normalize({}), evidence: [ev({ id: 'e1', at: 1 })], diag: { answers: { d: { result: 'wrong', at: 1 } } }, profile: { goal: 'prod', at: 1 } }
    const b = { ...normalize({}), evidence: [ev({ id: 'e1', at: 2, result: 'partial' }), ev({ id: 'e2' })], diag: { answers: { d: { result: 'ok', at: 2 } }, finishedAt: 3 }, profile: { goal: 'rnd', at: 2 } }
    const m = mergeProgress(a, b); expect(m.evidence).toHaveLength(2); expect(m.evidence.find((e) => e.id === 'e1')!.result).toBe('partial'); expect(m.diag.answers.d.result).toBe('ok'); expect(m.diag.finishedAt).toBe(3); expect(m.profile.goal).toBe('rnd')
  })
})

describe('Ступени и предпосылки 0.4', () => {
  it('выпускник без данных начинает с основ, а предпосылка объясняет себя', () => {
    const r = route('grad', [], false)
    expect(r[0].topic).toBe('raw-functions'); expect(r.findIndex((x) => x.topic === 'solutions-basics')).toBeLessThan(r.findIndex((x) => x.topic === 'ph-buffers'))
  })
  it('решённое задание по основам снимает принудительную предпосылку', () => {
    const gap = diag({ 'd-micro': 'wrong' })
    expect(route('prod', gap)[0].topic).toBe('solutions-basics') // pH-буферы и расчёты — предпосылки консервирования
    expect(route('prod', [...gap, ...diag({ 'd-sol': 'ok', 'd-ph': 'ok' })])[0].topic).toBe('preservation')
  })
  it('у каждой опубликованной темы есть ступень', () => {
    for (const f of fs.readdirSync('content/topics')) expect(fs.readFileSync(`content/topics/${f}`, 'utf8'), f).toMatch(/^level: [123]$/m)
  })
})
