import { describe, expect, it } from 'vitest'
import {
  arrheniusFactor,
  getDefaultReactionParams,
  REACTIONS_CATALOG,
  simulateReaction,
  solveOdeRK4,
} from '../shared/reactions-sim'

describe('Reactions & Mechanisms numerical engine (Direction K)', () => {
  it('solves first-order decay ODE via RK4 accurately against exp(-k*t)', () => {
    const k = 0.25
    const tMax = 4
    const { states } = solveOdeRK4([100], (_t, [c]) => [-k * c], tMax, 80)
    const numeric = states[states.length - 1][0]
    const exact = 100 * Math.exp(-k * tMax)
    expect(Math.abs(numeric - exact)).toBeLessThan(0.01)
  })

  it('computes Arrhenius acceleration monotonically with temperature', () => {
    expect(arrheniusFactor(60, 25, 25)).toBeCloseTo(1, 5)
    expect(arrheniusFactor(60, 45, 25)).toBeGreaterThan(3)
    expect(arrheniusFactor(60, 5, 25)).toBeLessThan(0.3)
  })

  it('simulates all 6 cosmetic organic & colloidal reactions cleanly with physically valid trends', () => {
    expect(REACTIONS_CATALOG.length).toBe(6)
    for (const def of REACTIONS_CATALOG) {
      const res = simulateReaction(def.id, getDefaultReactionParams(def.id))
      expect(res.times.length).toBeGreaterThan(20)
      expect(res.series.length).toBeGreaterThanOrEqual(2)
      expect(res.kpis.length).toBe(4)
      for (const s of res.series) {
        expect(s.values.length).toBe(res.times.length)
        expect(s.values.every((v) => Number.isFinite(v) && v >= 0)).toBe(true)
      }
    }

    // Salt collapses carbomer gel viscosity drastically
    const gelOk = simulateReaction('carbomer-neutralization', { targetPh: 6.5, polymerPct: 0.5, saltPct: 0 })
    const gelSalt = simulateReaction('carbomer-neutralization', { targetPh: 6.5, polymerPct: 0.5, saltPct: 1.5 })
    expect(gelSalt.progressRatio).toBeLessThan(gelOk.progressRatio * 0.25)

    // Tocopherol + EDTA protects PUFA oil vs unprotected control
    const oilBare = simulateReaction('lipid-peroxidation', { tempC: 40, pufaPct: 60, tocopherolPct: 0, edtaPct: 0 })
    const oilSafe = simulateReaction('lipid-peroxidation', { tempC: 40, pufaPct: 60, tocopherolPct: 0.3, edtaPct: 0.15 })
    const pvBare = oilBare.series.find((s) => s.id === 'pv')!.values.at(-1)!
    const pvSafe = oilSafe.series.find((s) => s.id === 'pv')!.values.at(-1)!
    expect(pvSafe).toBeLessThan(pvBare * 0.3)

    // Micelles above CMC shield vanillin from Schiff base browning
    const noMic = simulateReaction('micellar-schiff-interfacial', { tempC: 35, pH: 6.2, cmcRatio: 0, aminePct: 1.0 })
    const hiMic = simulateReaction('micellar-schiff-interfacial', { tempC: 35, pH: 6.2, cmcRatio: 6, aminePct: 1.0 })
    const schiffNoMic = noMic.series.find((s) => s.id === 'schiff')!.values.at(-1)!
    const schiffHiMic = hiMic.series.find((s) => s.id === 'schiff')!.values.at(-1)!
    expect(schiffHiMic).toBeLessThan(schiffNoMic * 0.45)
  })
})
