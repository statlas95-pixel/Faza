import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { DIAG_TRACKS, diagItemsForTrack, diagTotal, diagProgress, nextDiagItem, skillState, type DiagItem, type DiagTrack, type Evidence, type Result } from '../shared/mastery'
import { emptyProgress, normalize, mergeProgress, fingerprint, isEmpty, summarize } from '../shared/merge'

const items = YAML.parse(fs.readFileSync('content/diagnostic.yaml', 'utf8')) as DiagItem[]
const tracks = YAML.parse(fs.readFileSync('content/diagnostic-tracks.yaml', 'utf8'))
function complete(track: DiagTrack, result: Result) {
  const answers: Record<string, { result: Result; at: number }> = {}
  for (let n = 0; n < 30; n++) {
    const item = nextDiagItem(items, answers, 'grad', track)
    if (!item) return answers
    answers[item.id] = { result, at: n + 1 }
  }
  throw Error('Диагностика не завершается')
}
const evidence = (id: string, at: number, kind: Evidence['kind'] = 'diag'): Evidence => ({ id: `${kind}:${id}`, src: id, skill: 'acidbase', kind, item: kind === 'lab' ? 'lab' : 'recognize', result: 'ok', at, label: id, ...(kind === 'lab' ? { score: 1 } : {}) })

describe('Три варианта начальной диагностики', () => {
  it('каждый вариант сочетает теорию, практику и все четыре области', () => {
    expect(tracks.map((t: any) => t.id)).toEqual([...DIAG_TRACKS])
    for (const track of DIAG_TRACKS) {
      const bank = diagItemsForTrack(items, track).filter((i) => !i.after)
      expect(bank.length).toBeGreaterThanOrEqual(8); expect(bank.length).toBeLessThanOrEqual(12)
      expect(new Set(bank.map((i) => i.domain)).size).toBe(4)
      expect(bank.filter((i) => i.mode === 'theory').length).toBeGreaterThanOrEqual(2)
      expect(bank.filter((i) => i.mode === 'practice').length).toBeGreaterThanOrEqual(2)
    }
    expect(diagTotal(items, 'starter')).toBeLessThan(diagTotal(items, 'experienced'))
  })
  it('прежняя диагностика не получает новые вопросы', () => {
    const legacy = diagItemsForTrack(items)
    expect(legacy.every((i) => i.id.startsWith('d-'))).toBe(true)
    expect(nextDiagItem(items, {}, 'rnd')?.id).toBe('d-rheo')
    const p = normalize({ diag: { answers: { 'd-rheo': { result: 'ok', at: 1 } } } })
    expect(p.diag.track).toBeUndefined()
    expect(nextDiagItem(items, p.diag.answers, 'rnd')?.id).toBe('d-rheo-calc')
  })
  it('варианты не смешиваются при смене цели, а завершение ограничено выбранным банком', () => {
    for (const track of DIAG_TRACKS) for (const goal of ['grad', 'prod', 'rnd']) {
      expect(nextDiagItem(items, {}, goal, track)?.tracks).toContain(track)
      expect(nextDiagItem(items, complete(track, 'skip'), goal, track)).toBeUndefined()
    }
  })
  it('уточнения появляются только при подходящем ответе; прогресс считает именно доступные вопросы', () => {
    const wrong = { 'e-dlvo': { result: 'wrong' as const } }, right = { 'e-dlvo': { result: 'ok' as const } }
    expect(nextDiagItem(items, wrong, 'rnd', 'experienced')?.id).not.toBe('e-ionic-calc')
    expect(nextDiagItem(items, right, 'rnd', 'experienced')?.id).toBe('e-ionic-calc')
    expect(diagProgress(items, wrong, 'experienced')).toEqual({ answered: 1, total: 12 })
    expect(diagProgress(items, right, 'experienced')).toEqual({ answered: 1, total: 13 })
    expect(diagProgress(items, { 'd-rheo': { result: 'ok' } }, 'starter').answered).toBe(0)
    for (const track of DIAG_TRACKS) for (const result of ['skip', 'unknown', 'ok'] as const) {
      const progress = diagProgress(items, complete(track, result), track)
      expect(progress.answered).toBe(progress.total)
    }
  })
  it('даже правильные ответы опытного варианта не дают самостоятельный уровень или подтверждённую практикой уверенность', () => {
    const answers = complete('experienced', 'ok')
    const ev = Object.entries(answers).map(([id, a]): Evidence => {
      const q = items.find((i) => i.id === id)!
      return { id, src: id, at: a.at, kind: 'diag', item: q.kind, result: a.result, skill: q.skill, label: q.short }
    })
    for (const skill of new Set(ev.map((e) => e.skill))) {
      const state = skillState(skill, ev)
      expect(state.level).toBeLessThanOrEqual(2); expect(state.confidence).toBe(1)
    }
  })
  it('числовые диагностические ответы сходятся с независимым пересчётом', () => {
    const expected = { 'g-area': 2, 'g-dilution': 20 * 0.1 / 0.5, 's-fraction': 100 * 0.1, 'e-scale': 6000 * 50 / 250, 'e-ionic-calc': 0.5 * (0.01 * 4 + 0.02), 'e-bubble-calc': 100 / 20 }
    for (const [id, value] of Object.entries(expected)) expect(items.find((i) => i.id === id)!.answer, id).toBeCloseTo(value, 6)
  })
})

describe('Смена варианта, синхронизация и импорт', () => {
  it('сохраняет новые поля и объединяет ответы одного запуска с двух устройств', () => {
    const a = { ...emptyProgress(), diag: { track: 'starter' as const, changedAt: 10, answers: { 's-ph': { result: 'ok' as const, at: 11 } } } }
    const b = { ...emptyProgress(), diag: { track: 'starter' as const, changedAt: 10, answers: { 's-fraction': { result: 'skip' as const, at: 12 } } } }
    const m = mergeProgress(a, b)
    expect(m.diag.track).toBe('starter'); expect(m.diag.changedAt).toBe(10)
    expect(Object.keys(m.diag.answers)).toHaveLength(2)
    expect(a.diag.answers).not.toHaveProperty('s-fraction')
  })
  it('новый запуск побеждает старую копию в обоих порядках, даже при ошибке часов старого устройства', () => {
    const a = { ...emptyProgress(), diag: { answers: { 's-ph': { result: 'ok' as const, at: 9000 } }, finishedAt: 9001 }, evidence: [evidence('s-ph', 9000), evidence('old-lab', 5, 'lab')] }
    const b = { ...emptyProgress(), diag: { track: 'starter' as const, changedAt: 10, answers: { 's-ph': { result: 'ok' as const, at: 11 } } }, evidence: [evidence('s-ph', 11)] }
    for (const [x, y] of [[a, b], [b, a]]) {
      const m = mergeProgress(x, y)
      expect(m.diag.track).toBe('starter'); expect(m.diag.finishedAt).toBeUndefined()
      expect(m.diag.answers['s-ph'].at).toBe(11)
      expect(m.evidence.find((e) => e.kind === 'diag')?.at).toBe(11)
      expect(m.evidence.some((e) => e.src === 'old-lab')).toBe(true)
    }
  })
  it('сброс не возвращает старые диагностические свидетельства и сохраняет попытки', () => {
    const old = { ...emptyProgress(), diag: { track: 'graduate' as const, changedAt: 1, answers: { 'g-ph': { result: 'ok' as const, at: 2 } }, finishedAt: 3 }, evidence: [evidence('g-ph', 2)], attempts: [{ id: 'lab', labId: 'ph-sheet', at: 1, summary: 'пройдено' }] }
    const reset = { ...emptyProgress(), diag: { track: 'experienced' as const, changedAt: 4, answers: {} } }
    const merged = mergeProgress(old, reset)
    expect(merged.diag.answers).toEqual({}); expect(merged.diag.finishedAt).toBeUndefined()
    expect(merged.evidence).toEqual([]); expect(merged.attempts).toHaveLength(1)
  })
  it('пропущенные вопросы тоже являются сохраняемым прогрессом; новые ответы изменяют отпечаток импорта', () => {
    const a = { ...emptyProgress(), diag: { track: 'starter' as const, changedAt: 1, answers: { 's-ph': { result: 'skip' as const, at: 2 } } } }
    expect(isEmpty(a)).toBe(false); expect(summarize(a).diagnostic).toBe(1)
    const b = { ...a, diag: { ...a.diag, answers: { ...a.diag.answers, 's-fraction': { result: 'ok' as const, at: 3 } } } }
    expect(fingerprint(a)).not.toBe(fingerprint(b)); expect(fingerprint(a)).toBe(fingerprint(normalize(a)))
  })
})
