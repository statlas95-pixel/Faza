import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { evaluateFormula, type FormulaInput, type Ingredient } from '../shared/formulation'
import {
  analyzePolarizedMicroscopy,
  computeRheogram,
  deriveRheologyModel,
  measureBrookfield,
  suggestOptimalBrookfield,
} from '../shared/formulation-lab6'

const catalog: Ingredient[] = YAML.parse(
  fs.readFileSync(path.resolve('content/ingredients.yaml'), 'utf8'),
)

const lgnCream: FormulaInput = {
  productType: 'leave-on',
  targetPh: 5.5,
  batchGrams: 500,
  phaseTempC: { A: 75, B: 75, C: 38 },
  rows: [
    { ingredientId: 'aqua', phase: 'A', pct: 76.2 },
    { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
    { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
    { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 10.0 },
    { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 3.5 },
    { ingredientId: 'olivem-1000', phase: 'B', pct: 5.0 },
    { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1.0 },
  ],
}

const tonerWater: FormulaInput = {
  productType: 'leave-on',
  targetPh: 5.2,
  batchGrams: 500,
  phaseTempC: { A: 25, B: 25, C: 25 },
  rows: [
    { ingredientId: 'aqua', phase: 'A', pct: 94.2 },
    { ingredientId: 'glycerin', phase: 'A', pct: 5.0 },
    { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
  ],
}

const crystalSpfBad: FormulaInput = {
  productType: 'leave-on',
  targetPh: 6.2,
  batchGrams: 500,
  phaseTempC: { A: 75, B: 75, C: 38 },
  rows: [
    { ingredientId: 'aqua', phase: 'A', pct: 70.2 },
    { ingredientId: 'allantoin', phase: 'A', pct: 1.5 },
    { ingredientId: 'squalane', phase: 'B', pct: 10.0 },
    { ingredientId: 'uvinul-t150', phase: 'B', pct: 4.0 },
    { ingredientId: 'tinosorb-s', phase: 'B', pct: 4.0 },
    { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 2.5 },
    { ingredientId: 'olivem-1000', phase: 'B', pct: 5.0 },
    { ingredientId: 'ci-77492', phase: 'B', pct: 2.0 },
    { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
  ],
}

describe('Lab 6.0 — Brookfield Viscometer & Polarized Light Microscope', () => {
  it('derives thixotropic Herschel-Bulkley rheology for an LGN cream and finds a valid 10–90% Torque spindle', () => {
    const ev = evaluateFormula(lgnCream, catalog)
    const model = deriveRheologyModel(ev, lgnCream)
    expect(model.regime).toBe('thixotropic-lgn')
    expect(model.yieldStressPa).toBeGreaterThan(10)
    expect(model.flowIndexN).toBeLessThan(0.75)

    const opt = suggestOptimalBrookfield(model, 22)
    const reading = measureBrookfield(model, opt.spindle, opt.rpm, 22)
    expect(reading.status).toBe('ok')
    expect(reading.torquePct).toBeGreaterThanOrEqual(10)
    expect(reading.torquePct).toBeLessThanOrEqual(90)

    // Higher temperature reduces apparent viscosity
    const hot = measureBrookfield(model, opt.spindle, opt.rpm, 40)
    expect(hot.viscosityMPas).toBeLessThan(reading.viscosityMPas)

    // Rheogram has positive thixotropic hysteresis loop & shear thinning > 2x
    const curve = computeRheogram(model, 22)
    expect(curve.points.length).toBeGreaterThan(20)
    expect(curve.hysteresisAreaPaPerS).toBeGreaterThan(20)
    expect(curve.shearThinningRatio).toBeGreaterThan(2)
  })

  it('detects Newtonian low-viscosity fluids and flags under-range Torque on S64', () => {
    const ev = evaluateFormula(tonerWater, catalog)
    const model = deriveRheologyModel(ev, tonerWater)
    expect(model.regime).toBe('newtonian')

    const under = measureBrookfield(model, 'S64', 10, 22)
    expect(under.status).toBe('under')
    expect(under.torquePct).toBeLessThan(10)
    expect(under.recommendedSpindle).toBe('S61')
  })

  it('detects Maltese crosses in LGN creams and birefringent crystals / pigment agglomerates in defective SPF', () => {
    const evLgn = evaluateFormula(lgnCream, catalog)
    const mLgn = analyzePolarizedMicroscopy(evLgn, lgnCream)
    expect(mLgn.hasMalteseCrosses).toBe(true)
    expect(mLgn.lgnIntensity).toBeGreaterThan(0.5)
    expect(mLgn.hasCrystals).toBe(false)

    const evBad = evaluateFormula(crystalSpfBad, catalog)
    const mBad = analyzePolarizedMicroscopy(evBad, crystalSpfBad)
    expect(mBad.hasCrystals).toBe(true)
    expect(mBad.crystalCause).toBeTruthy()
    expect(mBad.hasPigments).toBe(true)
    expect(mBad.pigmentsAgglomerated).toBe(true)
  })

  it('models inverse W/O emulsion Krieger-Dougherty viscosity and flags missing MgSO4 electrolyte', () => {
    const woCream: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.8,
      batchGrams: 500,
      phaseTempC: { A: 25, B: 25, C: 25 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 65.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 18.0 },
        { ingredientId: 'squalane', phase: 'B', pct: 8.0 },
        { ingredientId: 'cetyl-peg-ppg-dimethicone', phase: 'B', pct: 4.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const evWo = evaluateFormula(woCream, catalog)
    const model = deriveRheologyModel(evWo, woCream)
    expect(model.yieldStressPa).toBeGreaterThan(10)
    expect(model.notes.some((n) => /MgSO₄|W\/O/.test(n))).toBe(true)
    const micro = analyzePolarizedMicroscopy(evWo, woCream)
    expect(micro.emulsionState).toBe('wo')
  })
})
