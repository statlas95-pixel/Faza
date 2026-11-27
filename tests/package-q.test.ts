import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { evaluateFormula, type FormulaInput, type Ingredient } from '../shared/formulation'

const catalog = YAML.parse(fs.readFileSync('content/ingredients.yaml', 'utf8')) as Ingredient[]

describe('Пакет Q: каталог 190 ингредиентов и химические правила 2026', () => {
  it('содержит не менее 190 уникальных ингредиентов, включая ключевые активы 2026 года', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(190)
    const ids = new Set(catalog.map((x) => x.id))
    expect(ids.size).toBe(catalog.length)
    for (const id of ['ghk-cu', 'pdrn', 'c13-15-alkane', 'tetrasodium-glda', 'sucrose-laurate', 'triasorb', 'cellulose-microspheres', 'sodium-coco-sulfate']) {
      expect(ids.has(id), `отсутствует ${id}`).toBe(true)
    }
  })

  it('выявляет несовместимость GHK-Cu с хелаторами и низким pH', () => {
    const f: FormulaInput = {
      productType: 'leave-on',
      targetPh: 6.0,
      batchGrams: 100,
      phaseTempC: { A: 25, B: 25, C: 25 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 95.6 },
        { ingredientId: 'glycerin', phase: 'A', pct: 3.0 },
        { ingredientId: 'tetrasodium-glda', phase: 'A', pct: 0.2 },
        { ingredientId: 'ghk-cu', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1.0 },
      ],
    }
    const ev = evaluateFormula(f, catalog)
    expect(ev.issues.some((i) => i.code === 'conflict:ghk-cu-chelation')).toBe(true)
  })

  it('предупреждает о D5 > 0.1 % по EU 2024/1328 и разрушении липосом в горячей фазе', () => {
    const f: FormulaInput = {
      productType: 'rinse-off',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 70, B: 70, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 80.0 },
        { ingredientId: 'liposome-complex', phase: 'A', pct: 2.0 },
        { ingredientId: 'cyclopentasiloxane', phase: 'B', pct: 5.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5.0 },
        { ingredientId: 'c13-15-alkane', phase: 'B', pct: 7.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1.0 },
      ],
    }
    const ev = evaluateFormula(f, catalog)
    expect(ev.issues.some((i) => i.code === 'reg:d4-d5-d6' && i.severity === 'error')).toBe(true)
    expect(ev.issues.some((i) => i.code === 'process:liposome-shear')).toBe(true)
  })
})
