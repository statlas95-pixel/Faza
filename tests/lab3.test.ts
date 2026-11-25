import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { evaluateFormula, validateIngredients, type FormulaInput, type Ingredient } from '../shared/formulation'
import {
  computeSensoryProfile,
  findIngredientSubstitutes,
  generateBatchProtocol,
  simulateAcceleratedStability,
} from '../shared/formulation-lab3'

const ingredients: Ingredient[] = YAML.parse(fs.readFileSync(path.join('content', 'ingredients.yaml'), 'utf8'))

describe('Лаборатория 3.0 — расширенный каталог, термостат, сенсорика, SOP и аналоги', () => {
  it('содержит не менее 120 валидных компонентов с уникальными id', () => {
    expect(ingredients.length).toBeGreaterThanOrEqual(120)
    expect(validateIngredients(ingredients)).toEqual([])
  })

  it('корректно прогнозирует провал и прохождение ускоренного старения (термостат + центрифуга)', () => {
    const stableCream: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 74.4 },
        { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
        { ingredientId: 'disodium-edta', phase: 'A', pct: 0.1 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 6.0 },
        { ingredientId: 'dicaprylyl-carbonate', phase: 'B', pct: 5.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 3.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 4.0 },
        { ingredientId: 'panthenol', phase: 'C', pct: 2.0 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.3 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.1 },
      ],
    }
    const evOk = evaluateFormula(stableCream, ingredients)
    const testsOk = simulateAcceleratedStability(evOk, stableCream)
    expect(testsOk).toHaveLength(4)
    expect(testsOk.every((t) => t.verdict === 'pass')).toBe(true)

    const riskyFormula: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 77.0 },
        { ingredientId: 'allantoin', phase: 'A', pct: 1.5 }, // кристаллизация на freeze-thaw
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 10.0 },
        { ingredientId: 'avobenzone', phase: 'B', pct: 4.0 },
        { ingredientId: 'octinoxate', phase: 'B', pct: 7.5 }, // фотодеградация + нет эмульгатора и консерванта
      ],
    }
    const evBad = evaluateFormula(riskyFormula, ingredients)
    const testsBad = simulateAcceleratedStability(evBad, riskyFormula)
    expect(testsBad.find((t) => t.id === 'centrifuge')?.verdict).toBe('fail')
    expect(testsBad.find((t) => t.id === 'oven45')?.verdict).toBe('fail')
    expect(testsBad.find((t) => t.id === 'photostability')?.verdict).toBe('fail')
  })

  it('различает лёгкий флюид и тяжёлый окклюзивный бальзам на сенсорной паутинке', () => {
    const fluid: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 70, B: 70, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 84.2 },
        { ingredientId: 'propanediol', phase: 'A', pct: 4.0 },
        { ingredientId: 'dicaprylyl-carbonate', phase: 'B', pct: 5.0 },
        { ingredientId: 'dimethicone', phase: 'B', pct: 2.0 },
        { ingredientId: 'montanov-202', phase: 'B', pct: 3.0 },
        { ingredientId: 'silica-matting', phase: 'B', pct: 1.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const heavyBalm: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 59.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 8.0 },
        { ingredientId: 'shea-butter', phase: 'B', pct: 10.0 },
        { ingredientId: 'petrolatum', phase: 'B', pct: 10.0 },
        { ingredientId: 'beeswax', phase: 'B', pct: 4.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 4.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 4.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const sFluid = computeSensoryProfile(evaluateFormula(fluid, ingredients), fluid)
    const sBalm = computeSensoryProfile(evaluateFormula(heavyBalm, ingredients), heavyBalm)
    expect(sFluid.axes).toHaveLength(6)
    expect(sFluid.axes.find((a) => a.id === 'lightness')!.score).toBeGreaterThan(
      sBalm.axes.find((a) => a.id === 'lightness')!.score + 30,
    )
    expect(sFluid.axes.find((a) => a.id === 'absorption')!.score).toBeGreaterThan(
      sBalm.axes.find((a) => a.id === 'absorption')!.score + 20,
    )
  })

  it('генерирует SOP с CCP-точками и подбирает релевантные аналоги сырья', () => {
    const formula: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 1000,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 80.7 },
        { ingredientId: 'carbomer', phase: 'A', pct: 0.5 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 10.0 },
        { ingredientId: 'beeswax', phase: 'B', pct: 2.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 4.0 },
        { ingredientId: 'panthenol', phase: 'C', pct: 2.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const sop = generateBatchProtocol(evaluateFormula(formula, ingredients), formula)
    expect(sop.length).toBe(5)
    expect(sop.some((s) => s.ccp?.includes('CCP-1'))).toBe(true)
    expect(sop.some((s) => s.ccp?.includes('CCP-3'))).toBe(true)

    const subsCarbomer = findIngredientSubstitutes('carbomer', ingredients)
    expect(subsCarbomer.length).toBe(3)
    expect(subsCarbomer.every((s) => s.ingredient.role === 'thickener' && s.ingredient.id !== 'carbomer')).toBe(true)
  })

  it('соблюдает научные и нормативные регрессии фактчекинга (D5 < 0.1%, поликватерниум в SLES, EHG-бустер, безводный термостат, фотостабильность)', () => {
    // 1. D5 строго < 0.1% (0.1% — нарушение REACH Annex XVII п. 70)
    const d5AtLimit = evaluateFormula({
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 70, B: 70, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 99.1 },
        { ingredientId: 'cyclopentasiloxane', phase: 'C', pct: 0.1 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, ingredients)
    expect(d5AtLimit.issues.some((i) => i.code === 'reg:cyclopentasiloxane' && i.severity === 'error')).toBe(true)

    // 2. Поликватерниум-7 в анионном шампуне SLES — норма (без ложного conflict:anionic-cationic)
    const shampoo = evaluateFormula({
      productType: 'rinse-off',
      targetPh: 5.3,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 86.2 },
        { ingredientId: 'sles', phase: 'A', pct: 10.0 },
        { ingredientId: 'capb', phase: 'A', pct: 2.0 },
        { ingredientId: 'polyquaternium-7', phase: 'A', pct: 1.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, ingredients)
    expect(shampoo.issues.some((i) => i.code === 'conflict:anionic-cationic')).toBe(false)

    // 3. Ethylhexylglycerin сам по себе — эмолент-бустер, не заменяет консервант Прил. V
    const ehgOnly = evaluateFormula({
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 99.5 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.5 },
      ],
    }, ingredients)
    expect(ehgOnly.issues.some((i) => i.code === 'micro:no-preservative')).toBe(true)

    // 4. Безводный бальзам (0 % воды) не проваливает термостат по «микробиологической порче»
    const anhydrous: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 25, B: 75, C: 38 },
      rows: [
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 69.5 },
        { ingredientId: 'shea-butter', phase: 'B', pct: 25.0 },
        { ingredientId: 'beeswax', phase: 'B', pct: 5.0 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.5 },
      ],
    }
    const anhTests = simulateAcceleratedStability(evaluateFormula(anhydrous, ingredients), anhydrous)
    expect(anhTests.find((t) => t.id === 'oven45')?.headline).not.toContain('Микробиологическая')

    // 5. Стабилизированный авобензон + октиноксат + Tinosorb S (2%) проходит фототест
    const stabSpf: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 69.2 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 10.0 },
        { ingredientId: 'avobenzone', phase: 'B', pct: 3.0 },
        { ingredientId: 'octinoxate', phase: 'B', pct: 5.0 },
        { ingredientId: 'tinosorb-s', phase: 'B', pct: 3.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 2.0 },
        { ingredientId: 'steareth-2', phase: 'B', pct: 2.0 },
        { ingredientId: 'steareth-21', phase: 'B', pct: 5.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const spfTests = simulateAcceleratedStability(evaluateFormula(stabSpf, ingredients), stabSpf)
    expect(spfTests.find((t) => t.id === 'photostability')?.verdict).toBe('pass')
  })
})
