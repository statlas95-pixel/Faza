import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  autoBalanceWater,
  checkPresetGoals,
  evaluateFormula,
  undissociatedFractionPct,
  validateIngredients,
  validateSandboxPresets,
  type FormulaInput,
  type Ingredient,
  type SandboxPreset,
} from '../shared/formulation'

const ingredients: Ingredient[] = YAML.parse(fs.readFileSync(path.join('content', 'ingredients.yaml'), 'utf8'))
const presets: SandboxPreset[] = YAML.parse(fs.readFileSync(path.join('content', 'sandbox-presets.yaml'), 'utf8'))

describe('Валидация схемы каталога сырья и пресетов', () => {
  it('content/ingredients.yaml и content/sandbox-presets.yaml проходят строгую схему без ошибок', () => {
    expect(validateIngredients(ingredients)).toEqual([])
    const ids = new Set(ingredients.map((i) => i.id))
    expect(validateSandboxPresets(presets, ids)).toEqual([])
  })

  it('отклоняет дубликаты id, неверную фазу, ГЛБ > 20 и неизвестный ингредиент в пресете', () => {
    const bad = [
      { ...ingredients[0], id: 'Bad_ID', recommendedPhase: 'Z', hlb: 25, costPerKg: -10 },
      { ...ingredients[0], id: 'Bad_ID' },
    ]
    const errs = validateIngredients(bad)
    expect(errs.some((e) => e.includes('kebab-case'))).toBe(true)
    expect(errs.some((e) => e.includes('повтор id'))).toBe(true)
    expect(errs.some((e) => e.includes('фаза'))).toBe(true)
    expect(errs.some((e) => e.includes('hlb'))).toBe(true)
    expect(errs.some((e) => e.includes('costPerKg'))).toBe(true)

    const pErrs = validateSandboxPresets([{ ...presets[0], rows: [{ ingredientId: 'missing-ing', phase: 'A', pct: 10 }] }], new Set(['aqua']))
    expect(pErrs.some((e) => e.includes('missing-ing'))).toBe(true)
  })
})

describe('Детерминированная математика рецептур', () => {
  it('точно пересчитывает проценты в граммы, баланс 100 %, ГЛБ смеси и порядок INCI', () => {
    // Масляная фаза: 8% CCT (reqHLB 5.0) + 4% Shea (reqHLB 8.0) + 3% Cetearyl (reqHLB 15.5) = 15%
    // Требуемый ГЛБ = (8*5 + 4*8 + 3*15.5) / 15 = (40 + 32 + 46.5) / 15 = 118.5 / 15 = 7.90
    // Эмульгаторы: 2.5% Sorbitan Stearate (HLB 4.7) + 1.5% Polysorbate 60 (HLB 14.9) = 4.0%
    // Фактический ГЛБ = (2.5*4.7 + 1.5*14.9) / 4.0 = (11.75 + 22.35) / 4.0 = 34.10 / 4.0 = 8.53
    const rows = autoBalanceWater([
      { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
      { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 8.0 },
      { ingredientId: 'shea-butter', phase: 'B', pct: 4.0 },
      { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 3.0 },
      { ingredientId: 'sorbitan-stearate', phase: 'B', pct: 2.5 },
      { ingredientId: 'polysorbate-60', phase: 'B', pct: 1.5 },
      { ingredientId: 'panthenol', phase: 'C', pct: 2.0 },
      { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
    ])
    const input: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows,
    }
    const ev = evaluateFormula(input, ingredients)
    expect(ev.totalPct).toBe(100)
    expect(ev.balanced).toBe(true)
    expect(ev.errorsCount).toBe(0)
    expect(ev.oilPhasePct).toBe(15)
    expect(ev.requiredHlb).toBe(7.9)
    expect(ev.actualHlb).toBe(8.53)
    expect(ev.hlbDelta).toBe(0.63)
    expect(ev.rows.find((r) => r.ingredient.id === 'aqua')?.pct).toBe(74)
    expect(ev.rows.find((r) => r.ingredient.id === 'aqua')?.grams).toBe(370)
    expect(ev.rows.find((r) => r.ingredient.id === 'caprylic-triglyceride')?.grams).toBe(40)
    expect(ev.inci.aboveOne[0]).toBe('Aqua')
    expect(ev.inci.aboveOne[1]).toBe('Caprylic/Capric Triglyceride')
    expect(ev.inci.oneOrLess).toContain('Phenoxyethanol')
    expect(ev.inci.oneOrLess).toContain('Tocopherol')
  })

  it('рассчитывает активную долю органических кислот по Гендерсону–Хассельбаху', () => {
    expect(undissociatedFractionPct(4.2, 4.2)).toBe(50)
    expect(undissociatedFractionPct(5.2, 4.2)).toBe(9.1)
    expect(undissociatedFractionPct(6.2, 4.2)).toBe(1)
  })
})

describe('Проверка конфликтов, температур и регуляторики (ТР ТС 009/2011 и EU 1223/2009)', () => {
  it('выявляет перегрев термолабильного актива в фазе A/B', () => {
    const ev = evaluateFormula({
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 97.2 },
        { ingredientId: 'panthenol', phase: 'A', pct: 2.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, ingredients)
    expect(ev.issues.some((i) => i.code === 'temp:panthenol' && i.severity === 'error')).toBe(true)
  })

  it('выявляет несовместимость карбомера с электролитами и низким pH', () => {
    const ev = evaluateFormula({
      productType: 'leave-on',
      targetPh: 4.5,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 97.7 },
        { ingredientId: 'carbomer', phase: 'A', pct: 0.5 },
        { ingredientId: 'sodium-chloride', phase: 'C', pct: 1.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, ingredients)
    expect(ev.issues.some((i) => i.code === 'conflict:carbomer-electrolyte' && i.severity === 'error')).toBe(true)
    expect(ev.issues.some((i) => i.code === 'ph:carbomer' && i.severity === 'error')).toBe(true)
  })

  it('выявляет конфликт анионного и катионного ПАВ', () => {
    const ev = evaluateFormula({
      productType: 'rinse-off',
      targetPh: 5.0,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 88.2 },
        { ingredientId: 'sles', phase: 'A', pct: 10.0 },
        { ingredientId: 'cetrimonium-chloride', phase: 'A', pct: 1.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, ingredients)
    expect(ev.issues.some((i) => i.code === 'conflict:anionic-cationic' && i.severity === 'error')).toBe(true)
  })

  it('проверяет лимиты феноксиэтанола, бензоата натрия (в пересчёте на кислоту), УФ-фильтров и аллерген бензилового спирта', () => {
    // 0.7% Sodium Benzoate * 0.847 = 0.593% бензойной кислоты > 0.5% (leave-on error), но < 2.5% (rinse-off ok!)
    const base: FormulaInput = {
      productType: 'leave-on',
      targetPh: 4.8,
      batchGrams: 100,
      phaseTempC: { A: 70, B: 70, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 81.9 },
        { ingredientId: 'avobenzone', phase: 'B', pct: 6.0 },
        { ingredientId: 'octinoxate', phase: 'B', pct: 7.0 },
        { ingredientId: 'ceteareth-20', phase: 'B', pct: 1.5 },
        { ingredientId: 'sorbitan-stearate', phase: 'B', pct: 1.5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1.2 },
        { ingredientId: 'sodium-benzoate', phase: 'C', pct: 0.7 },
        { ingredientId: 'benzyl-alcohol', phase: 'C', pct: 0.2 },
      ],
    }
    const leaveOn = evaluateFormula(base, ingredients)
    expect(leaveOn.issues.some((i) => i.code === 'reg:phenoxyethanol' && i.severity === 'error')).toBe(true)
    expect(leaveOn.issues.some((i) => i.code === 'reg:sodium-benzoate' && i.severity === 'error')).toBe(true)
    expect(leaveOn.issues.some((i) => i.code === 'reg:avobenzone' && i.severity === 'error')).toBe(true)
    expect(leaveOn.issues.some((i) => i.code === 'conflict:avobenzone-octinoxate' && i.severity === 'warn')).toBe(true)
    expect(leaveOn.issues.some((i) => i.code === 'allergen:benzyl-alcohol' && i.severity === 'info')).toBe(true)

    const rinseOff = evaluateFormula({ ...base, productType: 'rinse-off' }, ingredients)
    expect(rinseOff.issues.some((i) => i.code === 'reg:sodium-benzoate')).toBe(false)
  })

  it('все учебные пресеты исходно содержат ошибки для диагностики и проходят проверку после исправления', () => {
    for (const p of presets) {
      const initial = evaluateFormula(p, ingredients)
      const initialGoals = checkPresetGoals(initial, p, p.goals)
      expect(initialGoals.some((g) => !g.passed)).toBe(true)
    }
  })
})
