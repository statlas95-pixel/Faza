// Детерминированные расчёты «Лаборатории 4.0»:
// 1) Экономика 1 единицы готового продукта (COGS: сырьё + потери + тара + этикетка + фасовка)
// 2) Профиль моющей системы (% ASM — Active Surfactant Matter и индекс мягкости)

import type { FormulaEvaluation } from './formulation'

export interface UnitEconomicsInput {
  unitGrams: number // масса нетто 1 единицы (г)
  lossPct: number // технологические потери при варке/фасовке (%)
  packagingRub: number // флакон / туба / помпа (₽)
  labelRub: number // этикетка / коробка (₽)
  laborRub: number // варка + фасовка на 1 ед. (₽)
}

export interface UnitEconomicsResult {
  rawCostPerUnit: number
  lossCostPerUnit: number
  bulkCostPerUnit: number
  packagingTotal: number
  totalCogs: number
  unitsPerBatch: number
  suggestedRetail3x: number
  suggestedRetail5x: number
}

const r2 = (n: number) => Number(n.toFixed(2))

/** Рассчитывает себестоимость 1 готовой единицы (COGS) с учётом потерь, упаковки и работы. */
export function computeUnitEconomics(
  ev: FormulaEvaluation,
  batchGrams: number,
  opts: UnitEconomicsInput,
): UnitEconomicsResult {
  const unitG = Math.max(1, Number.isFinite(opts.unitGrams) ? opts.unitGrams : 50)
  const loss = Math.max(0, Math.min(40, Number.isFinite(opts.lossPct) ? opts.lossPct : 5))
  const pack = Math.max(0, Number.isFinite(opts.packagingRub) ? opts.packagingRub : 0)
  const label = Math.max(0, Number.isFinite(opts.labelRub) ? opts.labelRub : 0)
  const labor = Math.max(0, Number.isFinite(opts.laborRub) ? opts.laborRub : 0)

  const rawCostPerUnit = (ev.costPerKg * unitG) / 1000
  const lossCostPerUnit = rawCostPerUnit * (loss / 100)
  const bulkCostPerUnit = rawCostPerUnit + lossCostPerUnit
  const packagingTotal = pack + label + labor
  const totalCogs = bulkCostPerUnit + packagingTotal
  const usableMass = batchGrams * (1 - loss / 100)
  const unitsPerBatch = Math.floor(usableMass / unitG)

  return {
    rawCostPerUnit: r2(rawCostPerUnit),
    lossCostPerUnit: r2(lossCostPerUnit),
    bulkCostPerUnit: r2(bulkCostPerUnit),
    packagingTotal: r2(packagingTotal),
    totalCogs: r2(totalCogs),
    unitsPerBatch,
    suggestedRetail3x: r2(totalCogs * 3),
    suggestedRetail5x: r2(totalCogs * 5),
  }
}

export interface SurfactantProfile {
  totalAsmPct: number
  anionicPct: number
  amphotericPct: number
  nonionicPct: number
  cationicPct: number
  coToAnionicRatio: number | null
  mildnessVerdict: 'ultra-mild' | 'balanced' | 'intense'
  mildnessLabel: string
  categoryFit: string
  advice: string
}

/** Рассчитывает % активного ПАВ (ASM) и индекс мягкости для очищающих/моющих систем. */
export function computeSurfactantProfile(ev: FormulaEvaluation): SurfactantProfile | null {
  const surfRows = ev.rows.filter((r) => r.pct > 0 && r.ingredient.role === 'surfactant')
  if (!surfRows.length) return null

  let anionic = 0, amphoteric = 0, nonionic = 0, cationic = 0
  let harshWeighted = 0

  for (const r of surfRows) {
    if (r.ingredient.ionic === 'anionic') {
      anionic += r.pct
      // SLES более активен/раздражающ, чем мягкие глутаматы/изетионаты/сульфосукцинаты
      const weight = r.ingredient.id === 'sles' ? 1.0 : 0.45
      harshWeighted += r.pct * weight
    } else if (r.ingredient.ionic === 'amphoteric') {
      amphoteric += r.pct
      harshWeighted += r.pct * 0.25
    } else if (r.ingredient.ionic === 'nonionic') {
      nonionic += r.pct
      harshWeighted += r.pct * 0.15
    } else if (r.ingredient.ionic === 'cationic') {
      cationic += r.pct
      harshWeighted += r.pct * 0.4
    }
  }

  const totalAsmPct = r2(anionic + amphoteric + nonionic + cationic)
  const coPct = amphoteric + nonionic
  const coToAnionicRatio = anionic > 0 ? r2(coPct / anionic) : null
  const harshRatio = totalAsmPct > 0 ? harshWeighted / totalAsmPct : 0

  let mildnessVerdict: SurfactantProfile['mildnessVerdict'] = 'balanced'
  let mildnessLabel = 'Сбалансированная мягкость'
  let advice = 'Хорошее сочетание очищающей способности и мягкости; контролируйте итоговую ионную силу соли.'

  if (harshRatio <= 0.35 || (anionic > 0 && (coToAnionicRatio ?? 0) >= 0.6)) {
    mildnessVerdict = 'ultra-mild'
    mildnessLabel = 'Очень мягкая (для чувствительной кожи / бессульфатная)'
    advice = 'Мягкий профиль: для загущения неионогенных/глутаматных баз используйте полимер (ГЭЦ, ксантан, склероций), а не соль.'
  } else if (harshRatio >= 0.72 || (anionic >= 8 && (coToAnionicRatio ?? 0) < 0.25)) {
    mildnessVerdict = 'intense'
    mildnessLabel = 'Интенсивное очищение (высокий риск сухости)'
    advice = 'Высокая доля жёсткого анионного ПАВ без достаточного буфера со-ПАВ: добавьте 2–4 % CAPB или коко-глюкозида, чтобы снизить ККМ и раздражающий потенциал.'
  }

  const categoryFit =
    totalAsmPct < 3
      ? 'Мицеллярная вода / мягкий тоник (< 3 % ASM)'
      : totalAsmPct <= 8
        ? 'Гель/пенка для умывания лица или детский шампунь (3–8 % ASM)'
        : totalAsmPct <= 16
          ? 'Шампунь или гель для душа (9–16 % ASM)'
          : 'Концентрат / интенсивный очиститель (> 16 % ASM)'

  return {
    totalAsmPct,
    anionicPct: r2(anionic),
    amphotericPct: r2(amphoteric),
    nonionicPct: r2(nonionic),
    cationicPct: r2(cationic),
    coToAnionicRatio,
    mildnessVerdict,
    mildnessLabel,
    categoryFit,
    advice,
  }
}
