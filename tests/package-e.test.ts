import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { evaluateFormula, validateIngredients, type FormulaInput, type Ingredient } from '../shared/formulation'
import {
  analyzeSpfAndPigments,
  buildFormulaCsv,
  compareFormulasAB,
  decodeShareFormula,
  encodeShareFormula,
} from '../shared/formulation-lab5'

const catalog = YAML.parse(fs.readFileSync('content/ingredients.yaml', 'utf8')) as Ingredient[]

describe('Пакет E: 150 ингредиентов, Лаборатория 5.0 (SPF/пигменты, A/B-радар, CSV, Share URL)', () => {
  it('расширенный каталог содержит 150 валидных ингредиентов без дублей', () => {
    expect(catalog).toHaveLength(150)
    expect(validateIngredients(catalog)).toEqual([])
  })

  it('оценивает in-silico SPF / UVA-PF и пигментную нагрузку с диспергатором', () => {
    const f: FormulaInput = {
      productType: 'leave-on',
      targetPh: 7.0,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 52.0 },
        { ingredientId: 'ensulizole', phase: 'A', pct: 2.0 },
        { ingredientId: 'magnesium-sulfate', phase: 'A', pct: 0.8 },
        { ingredientId: 'cetyl-peg-ppg-dimethicone', phase: 'B', pct: 3.0 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 12.0 },
        { ingredientId: 'dicaprylyl-carbonate', phase: 'B', pct: 8.0 },
        { ingredientId: 'uvinul-a-plus', phase: 'B', pct: 4.0 },
        { ingredientId: 'tinosorb-s', phase: 'B', pct: 4.0 },
        { ingredientId: 'uvinul-t150', phase: 'B', pct: 3.0 },
        { ingredientId: 'tio2-pigment-ci77891', phase: 'B', pct: 6.0 },
        { ingredientId: 'ci-77492', phase: 'B', pct: 1.5 },
        { ingredientId: 'polyhydroxystearic-acid', phase: 'B', pct: 1.2 },
        { ingredientId: 'disteardimonium-hectorite', phase: 'B', pct: 1.2 },
        { ingredientId: 'propylene-carbonate', phase: 'B', pct: 0.4 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.9 },
      ],
    }
    const ev = evaluateFormula(f, catalog)
    expect(ev.errorsCount).toBe(0)
    const rep = analyzeSpfAndPigments(ev, f)!
    expect(rep).toBeTruthy()
    expect(rep.hasUvFilters).toBe(true)
    expect(rep.hasPigments).toBe(true)
    expect(rep.estimatedSpf).toBeGreaterThanOrEqual(45)
    expect(rep.uvaCirclePass).toBe(true)
    expect(rep.crystalSafe).toBe(true)
    expect(rep.hasDispersant).toBe(true)
    expect(rep.hasSuspender).toBe(true)
  })

  it('строит A/B-сравнение двух рецептур, CSV-карту с BOM и обратимую Share-ссылку', () => {
    const fA: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 1000,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 84 },
        { ingredientId: 'coco-caprylate', phase: 'B', pct: 10 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1 },
      ],
    }
    const fB: FormulaInput = {
      ...fA,
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 74 },
        { ingredientId: 'petrolatum', phase: 'B', pct: 20 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 1 },
      ],
    }
    const ab = compareFormulasAB(fA, fB, catalog)
    expect(ab.oilDeltaPct).toBe(-10)
    expect(ab.sensoryA.axes).toHaveLength(6)

    const csv = buildFormulaCsv(ab.evA, fA, 'Тест флюид')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Coco-Caprylate/Caprate')

    const token = encodeShareFormula(fA, 'Мой флюид')
    const validIds = new Set(catalog.map((c) => c.id))
    const decoded = decodeShareFormula(token, validIds)
    expect(decoded?.name).toBe('Мой флюид')
    expect(decoded?.formula.rows).toEqual(fA.rows)
    expect(decodeShareFormula('invalid-base64', validIds)).toBeNull()
  })
})
