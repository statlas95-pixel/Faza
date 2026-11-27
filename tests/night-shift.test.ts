import { describe, expect, it } from 'vitest'
import {
  INITIAL_SHIFT_BUDGET_RUB,
  evaluateNightShift,
  generateNightShift,
  getNightShiftPool,
} from '../shared/night-shift-sim'

describe('Night Shift emergency simulator (Package M-light)', () => {
  it('has 10 unique cosmetic plant incidents with exactly 1 correct cause and 1 optimal action each', () => {
    const pool = getNightShiftPool()
    expect(pool.length).toBe(10)
    expect(new Set(pool.map((i) => i.id)).size).toBe(10)
    for (const inc of pool) {
      expect(inc.causes.filter((c) => c.correct).length).toBe(1)
      expect(inc.actions.filter((a) => a.verdict === 'ok').length).toBe(1)
      expect(inc.actions.filter((a) => a.verdict === 'bad').length).toBeGreaterThanOrEqual(1)
    }
  })

  it('deterministically generates 3 distinct emergencies per seed and varies across seeds', () => {
    const s1 = generateNightShift(202601)
    const s1b = generateNightShift(202601)
    const s2 = generateNightShift(994321)
    expect(s1.length).toBe(3)
    expect(new Set(s1.map((x) => x.id)).size).toBe(3)
    expect(s1.map((x) => x.id)).toEqual(s1b.map((x) => x.id))
    expect(s1.map((x) => x.id)).not.toEqual(s2.map((x) => x.id))
  })

  it('scores optimal decisions as saved and fatal mistakes as scrap', () => {
    const shift = generateNightShift(202601)
    const good = evaluateNightShift(
      shift,
      shift.map((inc) => ({
        incidentId: inc.id,
        causeId: inc.causes.find((c) => c.correct)!.id,
        actionId: inc.actions.find((a) => a.verdict === 'ok')!.id,
      })),
    )
    expect(good.score).toBe(1)
    expect(good.grade).toBe('saved')
    expect(good.qualityIndex).toBeGreaterThanOrEqual(85)
    expect(good.budgetLeft).toBeGreaterThan(0)
    expect(good.budgetLeft).toBeLessThan(INITIAL_SHIFT_BUDGET_RUB)

    const bad = evaluateNightShift(
      shift,
      shift.map((inc) => ({
        incidentId: inc.id,
        causeId: inc.causes.find((c) => !c.correct)!.id,
        actionId: inc.actions.find((a) => a.verdict === 'bad')!.id,
      })),
    )
    expect(bad.score).toBe(0)
    expect(bad.grade).toBe('scrap')
    expect(bad.budgetLeft).toBeLessThan(0)
  })
})
