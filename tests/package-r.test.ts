import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import type { Ingredient } from '../shared/formulation'
import {
  INCI_BENCHMARK_EXAMPLES,
  analyzePastedInci,
  computeAllergenDeclaration,
  computeIso16128,
  computeSccsMoS,
} from '../shared/engineering-tools'

const catalog = YAML.parse(fs.readFileSync('content/ingredients.yaml', 'utf8')) as Ingredient[]

describe('Пакет R: Инженерные утилиты 2.0 (INCI→Lab, ISO 16128, EU 2023/1545, SCCS MoS)', () => {
  it('парсит реальный INCI, находит маркер 1 %, аллергены и строит сбалансированный черновик 100 %', () => {
    const rep = analyzePastedInci(INCI_BENCHMARK_EXAMPLES[1].inci, catalog, 'leave-on')
    expect(rep.matchedCount).toBeGreaterThanOrEqual(12)
    expect(rep.markerIndex).toBeGreaterThan(0)
    expect(rep.allergensFound).toEqual(expect.arrayContaining(['Limonene', 'Linalool']))
    const sum = rep.draftFormula.rows.reduce((s, r) => s + r.pct, 0)
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.05)
  })

  it('рассчитывает индекс натурального происхождения ISO 16128 с водой и без воды', () => {
    const rep = computeIso16128(
      [
        { ingredientId: 'aqua', pct: 80 },
        { ingredientId: 'c13-15-alkane', pct: 10 }, // NOI 1.0
        { ingredientId: 'dimethicone', pct: 9 },    // NOI 0.0
        { ingredientId: 'phenoxyethanol', pct: 1 }, // NOI 0.0
      ],
      catalog,
    )
    expect(rep.noiWithWaterPct).toBe(90.0)
    expect(rep.noiWithoutWaterPct).toBe(50.0)
  })

  it('выделяет декларируемые аллергены по порогам 0,001 % (leave-on) и 0,01 % (rinse-off) EU 2023/1545', () => {
    const leaveOn = computeAllergenDeclaration(0.5, 'leave-on', { limonene: 10, 'iso-e-super': 5, citral: 0.1 })
    // limonene = 0.05% (declare), iso-e-super = 0.025% (declare), citral = 0.0005% (< 0.001%, skip)
    expect(leaveOn.declared.map((d) => d.allergen.id)).toEqual(['limonene', 'iso-e-super'])
    expect(leaveOn.inciTail).toBe('Limonene, Tetramethyl Acetyloctahydronaphthalenes')

    const rinseOff = computeAllergenDeclaration(0.5, 'rinse-off', { limonene: 1.5, 'iso-e-super': 3.0 })
    // limonene = 0.0075% (< 0.01%, skip), iso-e-super = 0.015% (declare)
    expect(rinseOff.declared.map((d) => d.allergen.id)).toEqual(['iso-e-super'])
  })

  it('рассчитывает SED и MoS по SCCS 12th Rev и показывает провал ретинола 0,3 % в лосьоне для тела', () => {
    const face = computeSccsMoS({ dailyGrams: 1.54, retentionFactor: 1.0, concPct: 0.3, dermalAbsPct: 5.7, noaelMgKgDay: 1.0, bodyWeightKg: 60 })
    const body = computeSccsMoS({ dailyGrams: 7.82, retentionFactor: 1.0, concPct: 0.3, dermalAbsPct: 5.7, noaelMgKgDay: 1.0, bodyWeightKg: 60 })
    expect(face.passed).toBe(true)
    expect(face.mos).toBeGreaterThan(200)
    expect(body.passed).toBe(false)
    expect(body.mos).toBeLessThan(50)
    expect(body.maxSafePct).toBeLessThan(0.15)
  })
})
