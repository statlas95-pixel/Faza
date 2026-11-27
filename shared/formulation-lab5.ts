// Детерминированные модули «Лаборатории 5.0» (Пакет E):
// 1) In-silico анализ SPF / UVA-PF + баланс растворимости УФ-фильтров и дисперсии пигментов
// 2) Матрица A/B-сравнения двух рецептур с наложенной 6-осевой сенсорной паутинкой
// 3) Экспорт технологической карты в CSV (UTF-8 BOM для Excel) и компактная Share-ссылка (?share=)

import { evaluateFormula, type FormulaEvaluation, type FormulaInput, type Ingredient, type Phase } from './formulation'
import { computeSensoryProfile, type SensoryProfile } from './formulation-lab3'
import { language } from './locale'

export interface SpfPigmentReport {
  hasUvFilters: boolean
  hasPigments: boolean
  estimatedSpf: number
  estimatedUvaPf: number
  uvaRatio: number
  uvaCirclePass: boolean
  solidUvPct: number
  polarSolventPct: number
  minPolarNeededPct: number
  crystalSafe: boolean
  pigmentLoadPct: number
  oilAbsorptionGramsPer100: number
  hasDispersant: boolean
  hasSuspender: boolean
  notes: { kind: 'ok' | 'warn'; text: string }[]
}

const SOLID_UV_WEIGHTS: Record<string, number> = {
  'uvinul-a-plus': 1.2,
  'tinosorb-s': 1.35,
  'uvinul-t150': 1.95,
  avobenzone: 1.5,
}

const POLAR_SOLVENTS = new Set([
  'c12-15-benzoate',
  'dicaprylyl-carbonate',
  'coco-caprylate',
  'isoamyl-laurate',
  'isopropyl-myristate',
  'octocrylene',
  'homosalate',
  'triethyl-citrate',
])

const UV_SPF_CONTRIB: Record<string, { spfPerPct: number; uvaPerPct: number }> = {
  'uvinul-t150': { spfPerPct: 4.8, uvaPerPct: 0.4 },
  'tinosorb-s': { spfPerPct: 3.6, uvaPerPct: 2.3 },
  'uvinul-a-plus': { spfPerPct: 1.4, uvaPerPct: 2.5 },
  'tinosorb-m': { spfPerPct: 2.8, uvaPerPct: 1.9 },
  octinoxate: { spfPerPct: 2.5, uvaPerPct: 0.2 },
  octocrylene: { spfPerPct: 1.8, uvaPerPct: 0.5 },
  homosalate: { spfPerPct: 1.3, uvaPerPct: 0.15 },
  avobenzone: { spfPerPct: 0.9, uvaPerPct: 2.1 },
  ensulizole: { spfPerPct: 2.9, uvaPerPct: 0.2 },
  'titanium-dioxide': { spfPerPct: 1.7, uvaPerPct: 0.65 },
  'zinc-oxide': { spfPerPct: 1.2, uvaPerPct: 1.05 },
}

const PIGMENT_IDS = new Set([
  'ci-77492',
  'ci-77491',
  'ci-77499',
  'tio2-pigment-ci77891',
  'mica-pearl',
  'synthetic-fluorphlogopite',
  'boron-nitride',
  'silica-matting',
])

export function analyzeSpfAndPigments(ev: FormulaEvaluation, input: FormulaInput): SpfPigmentReport | null {
  const en = language === 'en'
  const pctOf = (id: string) =>
    ev.rows.filter((r) => r.ingredient.id === id).reduce((s, r) => s + r.pct, 0)

  const uvRows = ev.rows.filter((r) => r.pct > 0 && r.ingredient.role === 'uv_filter')
  const pigRows = ev.rows.filter((r) => r.pct > 0 && (r.ingredient.role === 'colorant' || PIGMENT_IDS.has(r.ingredient.id)))

  if (uvRows.length === 0 && pigRows.length === 0) return null

  let rawSpf = 1
  let rawUva = 1
  let solidUvPct = 0
  let minPolarNeededPct = 0

  for (const r of uvRows) {
    const c = UV_SPF_CONTRIB[r.ingredient.id]
    if (c) {
      rawSpf += r.pct * c.spfPerPct
      rawUva += r.pct * c.uvaPerPct
    }
    if (SOLID_UV_WEIGHTS[r.ingredient.id]) {
      solidUvPct += r.pct
      minPolarNeededPct += r.pct * SOLID_UV_WEIGHTS[r.ingredient.id]
    }
  }

  // Синергия плёнкообразователя / диспергатора и штраф за холодную кристаллизацию
  const polarSolventPct = Number(
    ev.rows
      .filter((r) => r.pct > 0 && POLAR_SOLVENTS.has(r.ingredient.id))
      .reduce((s, r) => s + r.pct, 0)
      .toFixed(2),
  )
  minPolarNeededPct = Number(minPolarNeededPct.toFixed(1))
  const crystalSafe = solidUvPct === 0 || polarSolventPct + 0.05 >= minPolarNeededPct
  const hasFilmBoost = pctOf('trimethylsiloxysilicate') + pctOf('polyhydroxystearic-acid') > 0
  const avoUnstabilized =
    pctOf('avobenzone') > 0 &&
    pctOf('octinoxate') > 0 &&
    pctOf('octocrylene') < 2 &&
    pctOf('tinosorb-s') < 1.5
  const boost = (crystalSafe ? 1.0 : 0.65) * (hasFilmBoost ? 1.12 : 1.0)
  // Нелинейное насыщение Бера–Ламберта при высоких загрузках УФ-фильтров (плато микрорельефа кожи) + фотодеградация нестабилизированного авобензона
  const satSpf = rawSpf <= 45 ? rawSpf : 45 + (rawSpf - 45) / (1 + 0.012 * (rawSpf - 45))
  const satUva = rawUva <= 20 ? rawUva : 20 + (rawUva - 20) / (1 + 0.018 * (rawUva - 20))
  const photoSpfFactor = avoUnstabilized ? 0.82 : 1.0
  const photoUvaFactor = avoUnstabilized ? 0.58 : 1.0

  const estimatedSpf = uvRows.length ? Math.max(2, Math.min(80, Math.round(satSpf * boost * photoSpfFactor))) : 0
  const estimatedUvaPf = uvRows.length ? Number(Math.max(1, Math.min(40, satUva * boost * photoUvaFactor)).toFixed(1)) : 0
  const uvaRatio = estimatedSpf > 0 ? Number((estimatedUvaPf / estimatedSpf).toFixed(2)) : 0
  const uvaCirclePass = estimatedSpf > 0 && uvaRatio >= 0.33

  const pigmentLoadPct = Number(
    pigRows.reduce((s, r) => s + r.pct, 0).toFixed(2),
  )
  // Средняя маслоёмкость ~0.35 г масла на 1 г неорганического пигмента/слюды (выше для силики)
  const oilAbsorptionGramsPer100 = Number(
    pigRows
      .reduce((s, r) => s + r.pct * (r.ingredient.id === 'silica-matting' ? 0.9 : 0.34), 0)
      .toFixed(2),
  )

  const hasDispersant =
    pctOf('polyhydroxystearic-acid') >= 0.3 ||
    pctOf('octyldodecanol') >= 1.5 ||
    pctOf('castor-oil') >= 2.0 ||
    pctOf('cetyl-peg-ppg-dimethicone') >= 1.5 ||
    pctOf('pg3-polyricinoleate') >= 1.5

  const hasSuspender =
    pctOf('disteardimonium-hectorite') >= 0.4 ||
    pctOf('veegum') >= 0.4 ||
    pctOf('xanthan-gum') >= 0.25 ||
    pctOf('sclerotium-gum') >= 0.3 ||
    pctOf('sepimax-zen') >= 0.4

  const notes: { kind: 'ok' | 'warn'; text: string }[] = []

  if (uvRows.length > 0) {
    if (!crystalSafe) {
      notes.push({
        kind: 'warn',
        text: en
          ? `Solid UV filters (${solidUvPct.toFixed(1)}%) need ≥ ${minPolarNeededPct}% polar esters to prevent +4 °C crystallization (currently ${polarSolventPct}%).`
          : `Твёрдые УФ-фильтры (${solidUvPct.toFixed(1)} %) требуют ≥ ${minPolarNeededPct} % полярных эфиров против кристаллизации при +4 °C (сейчас ${polarSolventPct} %).`,
      })
    } else if (solidUvPct > 0) {
      notes.push({
        kind: 'ok',
        text: en
          ? `Polar oil solvency (${polarSolventPct}% vs ≥ ${minPolarNeededPct}% needed) keeps solid UV filters dissolved.`
          : `Запас полярных эмолентов (${polarSolventPct} % при норме ≥ ${minPolarNeededPct} %) удерживает кристаллические УФ-фильтры в растворе.`,
      })
    }
    if (pctOf('ensulizole') > 0 && input.targetPh < 6.8) {
      notes.push({
        kind: 'warn',
        text: en
          ? `Ensulizole precipitates as sharp crystals below pH 6.8 (current target pH = ${input.targetPh}).`
          : `Ensulizole выпадает колючими кристаллами при pH < 6,8 (сейчас целевой pH = ${input.targetPh}).`,
      })
    }
    notes.push({
      kind: uvaCirclePass ? 'ok' : 'warn',
      text: uvaCirclePass
        ? (en
            ? `EU UVA-circle ratio met: UVA-PF / SPF = ${uvaRatio} (≥ 0.33).`
            : `Критерий «UVA в кружке» выполнен: UVA-PF / SPF = ${uvaRatio} (≥ 0,33).`)
        : (en
            ? `UVA-PF / SPF = ${uvaRatio} (< 0.33): boost UVA1 coverage (Uvinul A Plus / Tinosorb S / ZnO).`
            : `Отношение UVA-PF / SPF = ${uvaRatio} (< 0,33): усильте плечо UVA1 (Uvinul A Plus / Tinosorb S / ZnO).`),
    })
  }

  if (pigRows.length > 0) {
    if (pigmentLoadPct >= 3 && !hasDispersant) {
      notes.push({
        kind: 'warn',
        text: en
          ? `Pigment/powder load is ${pigmentLoadPct}% without a polymeric dispersant — add 0.5–1.5% Polyhydroxystearic Acid or Octyldodecanol to prevent streaking.`
          : `Нагрузка пигментов и пудр ${pigmentLoadPct} % без диспергатора — введите 0,5–1,5 % Polyhydroxystearic Acid или Octyldodecanol против полошения.`,
      })
    }
    if (pigmentLoadPct >= 2 && !hasSuspender) {
      notes.push({
        kind: 'warn',
        text: en
          ? 'Add a yield-stress suspender (Disteardimonium Hectorite in oil or Veegum/Xanthan in water) to prevent pigment settling.'
          : 'Добавьте тиксотропный суспендирующий агент (Disteardimonium Hectorite в масло или Veegum/ксантан в воду) против оседания пигментов.',
      })
    }
    if (pctOf('disteardimonium-hectorite') > 0 && pctOf('propylene-carbonate') < pctOf('disteardimonium-hectorite') * 0.2) {
      notes.push({
        kind: 'warn',
        text: en
          ? 'Disteardimonium Hectorite needs ~30% of its mass in Propylene Carbonate (polar activator) to exfoliate clay platelets.'
          : 'Для раскрытия пластинок Disteardimonium Hectorite введите ~30 % от его массы полярного активатора Propylene Carbonate.',
      })
    }
    if (hasDispersant && hasSuspender) {
      notes.push({
        kind: 'ok',
        text: en
          ? `Pigment suspension (${pigmentLoadPct}%, oil demand ~${oilAbsorptionGramsPer100} g/100 g) is stabilized by dispersant + yield-stress network.`
          : `Пигментная суспензия (${pigmentLoadPct} %, маслоёмкость ~${oilAbsorptionGramsPer100} г/100 г) защищена диспергатором и тиксотропной сеткой.`,
      })
    }
  }

  return {
    hasUvFilters: uvRows.length > 0,
    hasPigments: pigRows.length > 0,
    estimatedSpf,
    estimatedUvaPf,
    uvaRatio,
    uvaCirclePass,
    solidUvPct: Number(solidUvPct.toFixed(2)),
    polarSolventPct,
    minPolarNeededPct,
    crystalSafe,
    pigmentLoadPct,
    oilAbsorptionGramsPer100,
    hasDispersant,
    hasSuspender,
    notes,
  }
}

// ===== 2. Сравнение двух рецептур A / B =====

export interface FormulaABComparison {
  evA: FormulaEvaluation
  evB: FormulaEvaluation
  sensoryA: SensoryProfile
  sensoryB: SensoryProfile
  costDeltaPerKg: number
  oilDeltaPct: number
}

export function compareFormulasAB(
  formulaA: FormulaInput,
  formulaB: FormulaInput,
  catalog: Ingredient[],
): FormulaABComparison {
  const evA = evaluateFormula(formulaA, catalog)
  const evB = evaluateFormula(formulaB, catalog)
  const sensoryA = computeSensoryProfile(evA, formulaA)
  const sensoryB = computeSensoryProfile(evB, formulaB)
  return {
    evA,
    evB,
    sensoryA,
    sensoryB,
    costDeltaPerKg: Number((evA.costPerKg - evB.costPerKg).toFixed(2)),
    oilDeltaPct: Number((evA.oilPhasePct - evB.oilPhasePct).toFixed(2)),
  }
}

// ===== 3. CSV-экспорт технологической карты и Share-ссылка =====

function csvCell(v: string | number): string {
  const s = String(v)
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Генерирует CSV-файл с UTF-8 BOM и разделителем `;` для прямого открытия в Excel. */
export function buildFormulaCsv(ev: FormulaEvaluation, input: FormulaInput, title: string): string {
  const en = language === 'en'
  const header = en
    ? ['Phase', 'Temp_C', 'Ingredient', 'INCI', 'Percent_%', 'Batch_g', 'Cost_RUB']
    : ['Фаза', 'Температура_C', 'Компонент', 'INCI', 'Доля_%', 'Загрузка_г', 'Стоимость_RUB']

  const lines: string[] = [
    `# ${title} (${input.productType}, pH ${input.targetPh}, ${input.batchGrams} g)`,
    header.map(csvCell).join(';'),
  ]
  for (const r of ev.rows) {
    lines.push(
      [r.phase, r.phaseTempC, r.ingredient.name, r.ingredient.inci, r.pct, r.grams, r.cost]
        .map(csvCell)
        .join(';'),
    )
  }
  lines.push(
    [en ? 'TOTAL' : 'ИТОГО', '', '', '', ev.totalPct, input.batchGrams, ev.batchCost]
      .map(csvCell)
      .join(';'),
  )
  const inciStr = [...ev.inci.aboveOne, ...ev.inci.oneOrLess].join(', ')
  lines.push([en ? 'INCI Declaration' : 'Декларация INCI', inciStr, '', '', '', '', ''].map(csvCell).join(';'))
  return '\uFEFF' + lines.join('\r\n')
}

interface CompactSharePayload {
  v: 1
  n?: string
  t: 'l' | 'r'
  p: number
  g: number
  T: [number, number, number]
  r: [string, Phase, number][]
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return globalThis.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4)
  const bin = globalThis.atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeShareFormula(input: FormulaInput, name?: string): string {
  const payload: CompactSharePayload = {
    v: 1,
    n: name ? name.slice(0, 60) : undefined,
    t: input.productType === 'rinse-off' ? 'r' : 'l',
    p: Number(input.targetPh.toFixed(2)),
    g: Math.round(input.batchGrams),
    T: [input.phaseTempC.A, input.phaseTempC.B, input.phaseTempC.C],
    r: input.rows.map((r) => [r.ingredientId, r.phase, Number(r.pct.toFixed(3))]),
  }
  return toBase64Url(JSON.stringify(payload))
}

export function decodeShareFormula(
  token: string,
  validIngredientIds: Set<string>,
): { formula: FormulaInput; name?: string } | null {
  try {
    if (!token || token.length > 4096) return null
    const parsed = JSON.parse(fromBase64Url(token)) as CompactSharePayload
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.r) || !Array.isArray(parsed.T)) return null
    const rows = parsed.r
      .filter(
        (x) =>
          Array.isArray(x) &&
          typeof x[0] === 'string' &&
          validIngredientIds.has(x[0]) &&
          (x[1] === 'A' || x[1] === 'B' || x[1] === 'C') &&
          Number.isFinite(x[2]) &&
          x[2] >= 0 &&
          x[2] <= 100,
      )
      .map(([ingredientId, phase, pct]) => ({ ingredientId, phase, pct: Number(pct) }))
    if (!rows.length) return null
    return {
      name: typeof parsed.n === 'string' ? parsed.n : undefined,
      formula: {
        productType: parsed.t === 'r' ? 'rinse-off' : 'leave-on',
        targetPh: Math.max(1.5, Math.min(12, Number(parsed.p) || 5.5)),
        batchGrams: Math.max(10, Math.min(1000000, Number(parsed.g) || 500)),
        phaseTempC: {
          A: Math.max(15, Math.min(95, Number(parsed.T[0]) || 75)),
          B: Math.max(15, Math.min(95, Number(parsed.T[1]) || 75)),
          C: Math.max(15, Math.min(95, Number(parsed.T[2]) || 38)),
        },
        rows,
      },
    }
  } catch {
    return null
  }
}
