// Детерминированный расчётный и валидационный движок «Песочницы рецептур».
// Чистые функции без ИИ и без побочных эффектов — используются и в интерфейсе, и в тестах.

import { language } from './locale'

export type Phase = 'A' | 'B' | 'C'
export type ProductType = 'leave-on' | 'rinse-off'
export type ProductZone = 'face' | 'body' | 'hair' | 'spray'
export type IonicType = 'nonionic' | 'anionic' | 'cationic' | 'amphoteric'
export type IngredientRole =
  | 'solvent'
  | 'humectant'
  | 'emollient'
  | 'emulsifier'
  | 'thickener'
  | 'surfactant'
  | 'active'
  | 'preservative'
  | 'uv_filter'
  | 'ph_adjuster'
  | 'electrolyte'
  | 'antioxidant'
  | 'fragrance'
  | 'chelator'
  | 'solubilizer'
  | 'colorant'

export interface RegulatoryRule {
  standard: string
  leaveOnMax?: number
  rinseOffMax?: number
  strictMax?: boolean
  acidFactor?: number
  warnAbove?: number
  allergenLeaveOn?: number
  allergenRinseOff?: number
  note: string
}

export interface Ingredient {
  id: string
  inci: string
  name: string
  role: IngredientRole
  recommendedPhase: Phase
  ionic: IonicType
  maxTempC?: number
  hlb?: number
  reqHlb?: number
  phRange?: [number, number]
  pKa?: number
  electrolyteSensitive?: boolean
  isElectrolyte?: boolean
  typicalRange: [number, number]
  costPerKg: number
  note: string
  regulatory?: RegulatoryRule[]
}

export interface FormulaRow {
  ingredientId: string
  phase: Phase
  pct: number
}

export interface FormulaInput {
  productType: ProductType
  productZone?: ProductZone
  targetPh: number
  batchGrams: number
  phaseTempC: Record<Phase, number>
  rows: FormulaRow[]
}

export interface SandboxGoals {
  noErrors?: boolean
  requireBalance?: boolean
  requireHlbMatch?: boolean
  requirePreservative?: boolean
  phMin?: number
  phMax?: number
}

export interface SandboxPreset {
  id: string
  title: string
  summary: string
  productType: ProductType
  targetPh: number
  batchGrams: number
  phaseTempC: Record<Phase, number>
  rows: FormulaRow[]
  goals: SandboxGoals
}

export type Severity = 'error' | 'warn' | 'info'

export interface ValidationIssue {
  code: string
  severity: Severity
  title: string
  detail: string
  ingredientId?: string
  standard?: string
}

export interface EvaluatedRow {
  ingredient: Ingredient
  phase: Phase
  pct: number
  grams: number
  cost: number
  phaseTempC: number
}

export interface FormulaEvaluation {
  rows: EvaluatedRow[]
  totalPct: number
  missingPct: number
  balanced: boolean
  phaseTotals: Record<Phase, { pct: number; grams: number }>
  oilPhasePct: number
  emulsifierPct: number
  requiredHlb: number | null
  actualHlb: number | null
  hlbDelta: number | null
  costPerKg: number
  batchCost: number
  inci: { aboveOne: string[]; oneOrLess: string[] }
  issues: ValidationIssue[]
  errorsCount: number
  warningsCount: number
}

export interface GoalCheck {
  id: string
  label: string
  passed: boolean
}

const VALID_PHASES = new Set<Phase>(['A', 'B', 'C'])
const VALID_IONIC = new Set<IonicType>(['nonionic', 'anionic', 'cationic', 'amphoteric'])
const VALID_ROLES = new Set<IngredientRole>([
  'solvent', 'humectant', 'emollient', 'emulsifier', 'thickener', 'surfactant',
  'active', 'preservative', 'uv_filter', 'ph_adjuster', 'electrolyte', 'antioxidant', 'fragrance', 'chelator', 'solubilizer', 'colorant',
])

const round = (n: number, digits = 2) => Number(n.toFixed(digits))

/** Доля недиссоциированной (активной) формы слабой кислоты по уравнению Гендерсона–Хассельбаха, %. */
export function undissociatedFractionPct(pH: number, pKa: number): number {
  return round(100 / (1 + Math.pow(10, pH - pKa)), 1)
}

/** Строгая валидация схемы каталога ингредиентов (используется в check-content и тестах). */
export function validateIngredients(items: unknown): string[] {
  const errs: string[] = []
  if (!Array.isArray(items) || !items.length) return ['ingredients.yaml должен содержать непустой список']
  const seen = new Set<string>()
  for (const [idx, raw] of items.entries()) {
    const label = typeof (raw as any)?.id === 'string' ? `«${(raw as any).id}»` : `#${idx + 1}`
    if (!raw || typeof raw !== 'object') { errs.push(`${label}: элемент должен быть объектом`); continue }
    const x = raw as Record<string, any>
    for (const k of ['id', 'inci', 'name', 'note']) {
      if (typeof x[k] !== 'string' || !x[k].trim()) errs.push(`${label}: требуется непустая строка ${k}`)
    }
    if (typeof x.id === 'string') {
      if (!/^[a-z0-9-]+$/.test(x.id)) errs.push(`${label}: id должен быть в kebab-case`)
      if (seen.has(x.id)) errs.push(`${label}: повтор id`)
      seen.add(x.id)
    }
    if (!VALID_ROLES.has(x.role)) errs.push(`${label}: неизвестная роль ${x.role}`)
    if (!VALID_PHASES.has(x.recommendedPhase)) errs.push(`${label}: фаза должна быть A, B или C`)
    if (!VALID_IONIC.has(x.ionic)) errs.push(`${label}: неизвестная ионность ${x.ionic}`)
    if (!Array.isArray(x.typicalRange) || x.typicalRange.length !== 2 || !Number.isFinite(x.typicalRange[0]) || !Number.isFinite(x.typicalRange[1]) || x.typicalRange[0] < 0 || x.typicalRange[1] < x.typicalRange[0] || x.typicalRange[1] > 100) {
      errs.push(`${label}: некорректный typicalRange`)
    }
    if (!Number.isFinite(x.costPerKg) || x.costPerKg < 0) errs.push(`${label}: некорректная цена costPerKg`)
    if (x.maxTempC !== undefined && (!Number.isFinite(x.maxTempC) || x.maxTempC <= 0 || x.maxTempC > 120)) errs.push(`${label}: некорректная maxTempC`)
    if (x.hlb !== undefined && (!Number.isFinite(x.hlb) || x.hlb < 0 || x.hlb > 20)) errs.push(`${label}: некорректный hlb`)
    if (x.reqHlb !== undefined && (!Number.isFinite(x.reqHlb) || x.reqHlb < 0 || x.reqHlb > 20)) errs.push(`${label}: некорректный reqHlb`)
    if (x.pKa !== undefined && (!Number.isFinite(x.pKa) || x.pKa < 0 || x.pKa > 14)) errs.push(`${label}: некорректный pKa`)
    if (x.phRange !== undefined && (!Array.isArray(x.phRange) || x.phRange.length !== 2 || !Number.isFinite(x.phRange[0]) || !Number.isFinite(x.phRange[1]) || x.phRange[0] < 0 || x.phRange[1] > 14 || x.phRange[0] > x.phRange[1])) {
      errs.push(`${label}: некорректный phRange`)
    }
    if (x.regulatory !== undefined) {
      if (!Array.isArray(x.regulatory)) errs.push(`${label}: regulatory должен быть массивом`)
      else for (const r of x.regulatory) {
        if (!r || typeof r.standard !== 'string' || !r.standard.trim()) errs.push(`${label}: в regulatory нужен standard`)
        if (typeof r.note !== 'string' || !r.note.trim()) errs.push(`${label}: в regulatory нужен note`)
        for (const numField of ['leaveOnMax', 'rinseOffMax', 'acidFactor', 'warnAbove', 'allergenLeaveOn', 'allergenRinseOff']) {
          if (r[numField] !== undefined && (!Number.isFinite(r[numField]) || r[numField] <= 0 || r[numField] > 100)) {
            errs.push(`${label}: некорректное поле regulatory.${numField}`)
          }
        }
      }
    }
  }
  return errs
}

/** Строгая валидация пресетов песочницы. */
export function validateSandboxPresets(presets: unknown, ingredientIds: Set<string>): string[] {
  const errs: string[] = []
  if (!Array.isArray(presets) || !presets.length) return ['sandbox-presets.yaml должен содержать непустой список']
  const seen = new Set<string>()
  for (const [idx, raw] of presets.entries()) {
    const label = typeof (raw as any)?.id === 'string' ? `«${(raw as any).id}»` : `#${idx + 1}`
    if (!raw || typeof raw !== 'object') { errs.push(`${label}: пресет должен быть объектом`); continue }
    const p = raw as Record<string, any>
    for (const k of ['id', 'title', 'summary']) {
      if (typeof p[k] !== 'string' || !p[k].trim()) errs.push(`${label}: требуется строка ${k}`)
    }
    if (typeof p.id === 'string') {
      if (seen.has(p.id)) errs.push(`${label}: повтор id`)
      seen.add(p.id)
    }
    if (p.productType !== 'leave-on' && p.productType !== 'rinse-off') errs.push(`${label}: productType должен быть leave-on или rinse-off`)
    if (!Number.isFinite(p.targetPh) || p.targetPh < 1 || p.targetPh > 13) errs.push(`${label}: некорректный targetPh`)
    if (!Number.isFinite(p.batchGrams) || p.batchGrams <= 0) errs.push(`${label}: некорректный batchGrams`)
    if (!p.phaseTempC || !VALID_PHASES.has('A') || !(['A', 'B', 'C'] as Phase[]).every((ph) => Number.isFinite(p.phaseTempC[ph]))) {
      errs.push(`${label}: нужны температуры фаз A, B, C`)
    }
    if (!Array.isArray(p.rows) || !p.rows.length) errs.push(`${label}: нужен непустой список rows`)
    else for (const r of p.rows) {
      if (!ingredientIds.has(r.ingredientId)) errs.push(`${label}: неизвестный ингредиент «${r.ingredientId}»`)
      if (!VALID_PHASES.has(r.phase)) errs.push(`${label}: некорректная фаза ${r.phase}`)
      if (!Number.isFinite(r.pct) || r.pct < 0 || r.pct > 100) errs.push(`${label}: некорректный процент ${r.pct}`)
    }
  }
  return errs
}

/** Сборка декларации INCI по ст. 19 Регламента (ЕС) 1223/2009 и ТР ТС 009/2011 (с разворотом и дедупликацией смесей). */
export function buildInciList(rows: EvaluatedRow[]): { aboveOne: string[]; oneOrLess: string[] } {
  const byInci = new Map<string, number>()
  for (const r of rows) {
    if (r.pct <= 0) continue
    const parts = r.ingredient.inci.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 1) {
      byInci.set(parts[0], (byInci.get(parts[0]) ?? 0) + r.pct)
    } else {
      // Учебное приближение долей составного сырья (убывающий вес компонентов в смеси)
      const weights = parts.length === 2 ? [0.65, 0.35] : parts.map((_, i) => 1 / (i + 1))
      const wSum = weights.reduce((a, b) => a + b, 0)
      parts.forEach((p, i) => {
        byInci.set(p, (byInci.get(p) ?? 0) + r.pct * (weights[i] / wSum))
      })
    }
  }
  const entries = [...byInci.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return {
    aboveOne: entries.filter(([, pct]) => pct > 1 + 1e-6).map(([inci]) => inci),
    oneOrLess: entries.filter(([, pct]) => pct <= 1 + 1e-6).map(([inci]) => inci),
  }
}

/** Автодоведение воды (aqua) до строго 100 %. */
export function autoBalanceWater(rows: FormulaRow[]): FormulaRow[] {
  const others = rows.filter((r) => r.ingredientId !== 'aqua')
  const otherSum = others.reduce((sum, r) => sum + (Number.isFinite(r.pct) && r.pct > 0 ? r.pct : 0), 0)
  const waterPct = Math.max(0, round(100 - otherSum, 2))
  const existing = rows.find((r) => r.ingredientId === 'aqua')
  if (existing) return rows.map((r) => (r.ingredientId === 'aqua' ? { ...r, pct: waterPct } : r))
  return [{ ingredientId: 'aqua', phase: 'A', pct: waterPct }, ...rows]
}

/** Полный детерминированный расчёт и проверка рецептуры. */
export function evaluateFormula(input: FormulaInput, catalog: Ingredient[]): FormulaEvaluation {
  const byId = new Map(catalog.map((i) => [i.id, i]))
  const batchGrams = Number.isFinite(input.batchGrams) && input.batchGrams > 0 ? input.batchGrams : 100
  const phaseTotals: Record<Phase, { pct: number; grams: number }> = {
    A: { pct: 0, grams: 0 },
    B: { pct: 0, grams: 0 },
    C: { pct: 0, grams: 0 },
  }

  const rows: EvaluatedRow[] = []
  const issues: ValidationIssue[] = []
  const totalByIngredient = new Map<string, number>()

  for (const r of input.rows) {
    const ing = byId.get(r.ingredientId)
    if (!ing) continue
    const pct = Number.isFinite(r.pct) && r.pct >= 0 ? r.pct : 0
    const grams = round((batchGrams * pct) / 100, 2)
    const cost = round(((batchGrams * pct) / 100 / 1000) * ing.costPerKg, 2)
    const temp = input.phaseTempC[r.phase]
    rows.push({ ingredient: ing, phase: r.phase, pct, grams, cost, phaseTempC: temp })
    phaseTotals[r.phase].pct = round(phaseTotals[r.phase].pct + pct, 2)
    phaseTotals[r.phase].grams = round(phaseTotals[r.phase].grams + grams, 2)
    totalByIngredient.set(ing.id, round((totalByIngredient.get(ing.id) ?? 0) + pct, 4))
  }

  const totalPct = round(rows.reduce((s, r) => s + r.pct, 0), 2)
  const missingPct = round(100 - totalPct, 2)
  const balanced = Math.abs(totalPct - 100) <= 0.01

  const en = language === 'en'

  // 1. Баланс 100 %
  if (!balanced) {
    issues.push({
      code: 'balance',
      severity: 'error',
      title: en
        ? (missingPct > 0 ? `Formula total is ${totalPct}% (short by ${missingPct}%)` : `Formula total is ${totalPct}% (over by ${Math.abs(missingPct)}%)`)
        : (missingPct > 0 ? `Сумма рецептуры ${totalPct} % (не хватает ${missingPct} %)` : `Сумма рецептуры ${totalPct} % (перебор ${Math.abs(missingPct)} %)`),
      detail: en
        ? 'The mass fractions of all formula components must total strictly 100.00%. Adjust percentages or click "Balance water to 100%".'
        : 'Массовая доля всех компонентов рецептуры должна строго составлять 100,00 %. Скорректируйте доли или нажмите «Довести воду до 100 %».',
    })
  }

  // 2. Температура ввода и соответствие фаз
  for (const r of rows) {
    if (r.pct <= 0) continue
    const ing = r.ingredient
    if (ing.maxTempC !== undefined && r.phaseTempC > ing.maxTempC) {
      issues.push({
        code: `temp:${ing.id}`,
        severity: 'error',
        ingredientId: ing.id,
        title: en
          ? `Overheating ${ing.name} (${r.phaseTempC} °C > ${ing.maxTempC} °C)`
          : `Перегрев ${ing.name} (${r.phaseTempC} °C > ${ing.maxTempC} °C)`,
        detail: en
          ? `${ing.inci} is in Phase ${r.phase} at ${r.phaseTempC} °C. To prevent thermal degradation or evaporation, move it to cool-down Phase C or lower the phase temperature to ≤ ${ing.maxTempC} °C.`
          : `${ing.inci} находится в фазе ${r.phase} при ${r.phaseTempC} °C. Для предотвращения деградации или испарения перенесите компонент в фазу охлаждения C или снизьте температуру фазы до ≤ ${ing.maxTempC} °C.`,
      })
    }
    if (ing.recommendedPhase === 'B' && r.phase === 'A') {
      issues.push({
        code: `phase:${ing.id}`,
        severity: 'warn',
        ingredientId: ing.id,
        title: en
          ? `Oil-soluble ${ing.name} placed in aqueous Phase A`
          : `Жирорастворимый ${ing.name} указан в водной фазе A`,
        detail: en
          ? `${ing.inci} is typically added to oil Phase B.`
          : `${ing.inci} обычно вводится в масляную фазу B.`,
      })
    }
    if (ing.recommendedPhase === 'A' && r.phase === 'B') {
      issues.push({
        code: `phase:${ing.id}`,
        severity: 'warn',
        ingredientId: ing.id,
        title: en
          ? `Water-soluble ${ing.name} placed in oil Phase B`
          : `Водорастворимый ${ing.name} указан в масляной фазе B`,
        detail: en
          ? `${ing.inci} is typically added to aqueous Phase A.`
          : `${ing.inci} обычно вводится в водную фазу A.`,
      })
    }
  }

  // 3. Требуемый и фактический ГЛБ (O/W) — твёрдые неорганические порошки (ZnO, TiO₂) исключены из расчёта reqHLB жидких масел
  const SOLID_MINERAL_UV = new Set(['zinc-oxide', 'titanium-dioxide'])
  const waterPct = totalByIngredient.get('aqua') ?? 0
  const oilRows = rows.filter((r) => r.pct > 0 && r.ingredient.reqHlb !== undefined && !SOLID_MINERAL_UV.has(r.ingredient.id))
  const emulRows = rows.filter((r) => r.pct > 0 && r.ingredient.role === 'emulsifier' && r.ingredient.hlb !== undefined)
  const oilPhasePct = round(oilRows.reduce((s, r) => s + r.pct, 0), 2)
  const emulsifierPct = round(emulRows.reduce((s, r) => s + r.pct, 0), 2)
  const requiredHlb = oilPhasePct > 0
    ? round(oilRows.reduce((s, r) => s + r.pct * (r.ingredient.reqHlb ?? 0), 0) / oilPhasePct, 2)
    : null
  const actualHlb = emulsifierPct > 0
    ? round(emulRows.reduce((s, r) => s + r.pct * (r.ingredient.hlb ?? 0), 0) / emulsifierPct, 2)
    : null
  const hlbDelta = requiredHlb !== null && actualHlb !== null ? round(Math.abs(actualHlb - requiredHlb), 2) : null

  const hasPolymericOrCationicEmulsifier = rows.some(
    (r) => r.pct > 0 && (r.ingredient.id === 'simulgel-eg' || r.ingredient.id === 'btms' || r.ingredient.id === 'behentrimonium-chloride'),
  )
  const isWoSystem =
    actualHlb !== null &&
    actualHlb <= 6.0 &&
    emulRows.some((r) => ['isolan-gps', 'sorbitan-oleate', 'pg3-polyricinoleate', 'cetyl-peg-ppg-dimethicone'].includes(r.ingredient.id))

  if (waterPct >= 1 && oilPhasePct >= 1 && emulsifierPct <= 0 && !hasPolymericOrCationicEmulsifier) {
    issues.push({
      code: 'hlb:no-emulsifier',
      severity: 'error',
      title: en ? 'No emulsifier for the oil phase' : 'В масляной фазе нет эмульгатора',
      detail: en
        ? `The oil phase is ${oilPhasePct}% (required HLB ≈ ${requiredHlb}), but no emulsifier is present — the emulsion will separate rapidly.`
        : `Масляная фаза составляет ${oilPhasePct} % (требуемый ГЛБ ≈ ${requiredHlb}), но в рецептуре не задан эмульгатор — эмульсия быстро расслоится.`,
    })
  } else if (isWoSystem) {
    issues.push({
      code: 'hlb:wo-info',
      severity: 'info',
      title: en
        ? `Water-in-oil (W/O) emulsion detected (emulsifier HLB ${actualHlb})`
        : `Обнаружена обратная эмульсия W/O (ГЛБ эмульгатора ${actualHlb})`,
      detail: en
        ? 'O/W required HLB targets do not apply to inverse W/O emulsions; add 0.5–1.0% electrolyte (NaCl / MgSO₄) to the aqueous phase for W/O stability.'
        : 'Для обратных эмульсий «вода в масле» ориентир O/W reqHLB не применяется; для стабильности W/O введите 0,5–1,0 % электролита (NaCl / MgSO₄) в водную фазу.',
    })
  } else if (hlbDelta !== null && hlbDelta > 2.0) {
    issues.push({
      code: 'hlb:mismatch',
      severity: 'error',
      title: en
        ? `Severe HLB mismatch: actual ${actualHlb} vs required ${requiredHlb} (Δ = ${hlbDelta})`
        : `Сильное расхождение ГЛБ: факт ${actualHlb} при требуемом ${requiredHlb} (Δ = ${hlbDelta})`,
      detail: en
        ? 'Balance a lipophilic/hydrophilic emulsifier pair so the blended HLB sits within ±1.0 of the oil phase required HLB (O/W guideline).'
        : 'Сбалансируйте пару липофильного и гидрофильного эмульгаторов так, чтобы расчётный ГЛБ смеси находился в пределах ±1,0 от требуемого ГЛБ масляной фазы (ориентир для O/W).',
    })
  } else if (hlbDelta !== null && hlbDelta > 1.0) {
    issues.push({
      code: 'hlb:drift',
      severity: 'warn',
      title: en
        ? `HLB offset: actual ${actualHlb} vs required ${requiredHlb} (Δ = ${hlbDelta})`
        : `ГЛБ смещён: факт ${actualHlb} при требуемом ${requiredHlb} (Δ = ${hlbDelta})`,
      detail: en
        ? 'Deviation exceeds ±1.0 HLB units — check emulsion stability or adjust the emulsifier ratio.'
        : 'Отклонение превышает ±1,0 единицы ГЛБ — проверьте устойчивость эмульсии или скорректируйте соотношение эмульгаторов.',
    })
  }

  // 4. Химические и коллоидные конфликты
  const activeRows = rows.filter((r) => r.pct > 0)
  const anionicSurfs = activeRows.filter((r) => r.ingredient.ionic === 'anionic' && (r.ingredient.role === 'surfactant' || r.ingredient.role === 'emulsifier'))
  const cationicSurfs = activeRows.filter((r) => r.ingredient.ionic === 'cationic' && (r.ingredient.role === 'surfactant' || r.ingredient.role === 'emulsifier'))
  if (anionicSurfs.length && cationicSurfs.length) {
    issues.push({
      code: 'conflict:anionic-cationic',
      severity: 'error',
      title: en ? 'Anionic + cationic surfactant incompatibility' : 'Несовместимость анионных и катионных ПАВ',
      detail: en
        ? `${anionicSurfs.map((r) => r.ingredient.inci).join(', ')} and ${cationicSurfs.map((r) => r.ingredient.inci).join(', ')} form a poorly soluble ionic complex — causing haze, flocculation/precipitate, and foam collapse.`
        : `${anionicSurfs.map((r) => r.ingredient.inci).join(', ')} и ${cationicSurfs.map((r) => r.ingredient.inci).join(', ')} образуют малорастворимый ионный комплекс — система мутнеет, выпадает осадок и теряется пенообразование.`,
    })
  }

  const sensitivePolymers = activeRows.filter((r) => r.ingredient.electrolyteSensitive)
  const electrolyteRows = activeRows.filter((r) => r.ingredient.isElectrolyte)
  const electrolytePct = round(electrolyteRows.reduce((s, r) => s + r.pct, 0), 2)
  if (sensitivePolymers.length) {
    if (electrolytePct >= 0.3) {
      issues.push({
        code: 'conflict:carbomer-electrolyte',
        severity: 'error',
        ingredientId: sensitivePolymers[0].ingredient.id,
        title: en
          ? `Electrolyte collapse of polymer thickener (${electrolytePct}%)`
          : `Разжижение полимерного загустителя электролитами (${electrolytePct} %)`,
        detail: en
          ? `${sensitivePolymers.map((r) => r.ingredient.inci).join(', ')} is sensitive to ionic strength. Electrolytes (${electrolyteRows.map((r) => `${r.ingredient.inci} ${r.pct}%`).join(', ')}) screen charges along the polymer chains and collapse viscosity. Switch to Xanthan Gum, Sepimax Zen, or Sclerotium Gum, or remove the electrolyte.`
          : `${sensitivePolymers.map((r) => r.ingredient.inci).join(', ')} чувствителен к ионной силе. Присутствие электролитов (${electrolyteRows.map((r) => `${r.ingredient.inci} ${r.pct}%`).join(', ')}) экранирует заряды вдоль полимерных цепей и разрушает гель. Замените загуститель (например, на Xanthan Gum, Sepimax Zen или Sclerotium Gum) либо уберите электролит.`,
      })
    }
    if (cationicSurfs.length) {
      issues.push({
        code: 'conflict:carbomer-cationic',
        severity: 'error',
        ingredientId: sensitivePolymers[0].ingredient.id,
        title: en ? 'Anionic polymer + cationic surfactant incompatibility' : 'Несовместимость анионного полимера и катионного ПАВ',
        detail: en
          ? 'The anionic polymer forms an insoluble complex with cationic surfactants.'
          : 'Анионный полимер образует нерастворимый комплекс с катионными ПАВ.',
      })
    }
  }

  // 5. Рабочие диапазоны pH (полимеры, консерванты, активы)
  const pH = input.targetPh
  for (const [id, pct] of totalByIngredient.entries()) {
    if (pct <= 0) continue
    const ing = byId.get(id)!
    if (ing.phRange && (pH < ing.phRange[0] || pH > ing.phRange[1])) {
      if (ing.role === 'preservative' && ing.pKa !== undefined) {
        const activePct = undissociatedFractionPct(pH, ing.pKa)
        issues.push({
          code: `ph:${ing.id}`,
          severity: 'error',
          ingredientId: ing.id,
          title: en
            ? `${ing.name} is ineffective at pH ${pH} (working range ${ing.phRange[0]}–${ing.phRange[1]})`
            : `${ing.name} неэффективен при pH ${pH} (рабочий диапазон ${ing.phRange[0]}–${ing.phRange[1]})`,
          detail: en
            ? `At pKa = ${ing.pKa} and pH = ${pH}, the active undissociated acid fraction is only ${activePct}%. Lower pH to ≤ ${ing.phRange[1]} or choose a pH-independent preservative (e.g., Phenoxyethanol).`
            : `При pKa = ${ing.pKa} и pH = ${pH} доля активной недиссоциированной кислоты составляет лишь ${activePct} %. Снизьте pH до ≤ ${ing.phRange[1]} или выберите pH-независимый консервант (например, Phenoxyethanol).`,
        })
      } else if (ing.electrolyteSensitive) {
        const isCarbomer = ing.id === 'carbomer' || ing.id === 'ultrez-21'
        issues.push({
          code: `ph:${ing.id}`,
          severity: 'error',
          ingredientId: ing.id,
          title: en
            ? `${ing.name} cannot form a stable gel at pH ${pH} (working window ${ing.phRange[0]}–${ing.phRange[1]})`
            : `${ing.name} не образует стабильный гель при pH ${pH} (рабочее окно ${ing.phRange[0]}–${ing.phRange[1]})`,
          detail: pH < ing.phRange[0]
            ? isCarbomer
              ? (en
                  ? `Polyacrylate carboxyl groups require neutralization (pH ≥ ${ing.phRange[0]}); in acidic media chains stay coiled and viscosity collapses.`
                  : `Карбоксильные группы полиакрилата требуют нейтрализации (pH ≥ ${ing.phRange[0]}); в кислой среде цепи остаются свёрнутыми и вязкость падает.`)
              : (en
                  ? `Below pH ${ing.phRange[0]}, the thickening efficiency of ${ing.inci} drops sharply. ${ing.note}`
                  : `При pH ниже ${ing.phRange[0]} загущающая способность ${ing.inci} резко падает. ${ing.note}`)
            : (en
                ? `Above pH ${ing.phRange[1]}, excess alkali ions collapse the ${ing.inci} gel network.`
                : `При pH выше ${ing.phRange[1]} избыток ионов щёлочи разрушает гелевую сетку ${ing.inci}.`),
        })
      } else {
        issues.push({
          code: `ph:${ing.id}`,
          severity: 'warn',
          ingredientId: ing.id,
          title: en
            ? `pH ${pH} is outside the recommended range for ${ing.name} (${ing.phRange[0]}–${ing.phRange[1]})`
            : `pH ${pH} вне рекомендуемого диапазона для ${ing.name} (${ing.phRange[0]}–${ing.phRange[1]})`,
          detail: ing.note,
        })
      }
    } else if (ing.role === 'preservative' && ing.pKa !== undefined) {
      const activePct = undissociatedFractionPct(pH, ing.pKa)
      issues.push({
        code: `pka-info:${ing.id}`,
        severity: 'info',
        ingredientId: ing.id,
        title: en
          ? `Active form of ${ing.name} at pH ${pH}: ${activePct}%`
          : `Активная форма ${ing.name} при pH ${pH}: ${activePct} %`,
        detail: en
          ? `By the Henderson–Hasselbalch equation (pKa = ${ing.pKa}), the preservative is within its active pH window.`
          : `По уравнению Гендерсона–Хассельбаха (pKa = ${ing.pKa}) консервант находится в рабочем окне pH.`,
      })
    }
  }

  // 6. Фотостабильность пары Авобензон + Октиноксат, кристаллизация аллантоина, плавление восков, солюбилизация отдушки
  if ((totalByIngredient.get('avobenzone') ?? 0) > 0 && (totalByIngredient.get('octinoxate') ?? 0) > 0) {
    const hasStabilizer = (totalByIngredient.get('octocrylene') ?? 0) >= 2 || (totalByIngredient.get('tinosorb-s') ?? 0) >= 1.5
    issues.push({
      code: 'conflict:avobenzone-octinoxate',
      severity: hasStabilizer ? 'info' : 'warn',
      title: hasStabilizer
        ? (en ? 'Avobenzone + Octinoxate stabilized by photostabilizer' : 'Авобензон + Октиноксат стабилизированы фотостабилизатором')
        : (en ? 'Photounstable UV filter pair: Avobenzone + Octinoxate' : 'Фотонестабильная пара УФ-фильтров: Авобензон + Этилгексилметоксициннамат'),
      detail: hasStabilizer
        ? (en
            ? 'A photostabilizer (Octocrylene / Tinosorb S) is present to mitigate avobenzone photodegradation, though SPF/UVA-PF testing is still required.'
            : 'В формуле присутствует фотостабилизатор (Octocrylene / Tinosorb S), снижающий фотодеградацию авобензона, но требуется подтверждение SPF/UVA-PF тестом.')
        : (en
            ? 'Combining Butyl Methoxydibenzoylmethane and Ethylhexyl Methoxycinnamate accelerates mutual UV photodegradation without a photostabilizer (e.g., Octocrylene or Tinosorb S).'
            : 'Комбинация Butyl Methoxydibenzoylmethane и Ethylhexyl Methoxycinnamate ускоряет взаимную фотодеградацию под УФ без фотостабилизатора (например, Octocrylene или Tinosorb S).'),
    })
  }
  if ((totalByIngredient.get('allantoin') ?? 0) > 0.5) {
    issues.push({
      code: 'solubility:allantoin',
      severity: 'warn',
      ingredientId: 'allantoin',
      title: en
        ? `Allantoin recrystallization risk (${totalByIngredient.get('allantoin')}% > 0.5%)`
        : `Риск перекристаллизации аллантоина (${totalByIngredient.get('allantoin')} % > 0,5 %)`,
      detail: en
        ? 'Allantoin water solubility at 20 °C is ~0.5%; excess amounts can precipitate as sharp needle-like crystals upon cooling.'
        : 'Предел растворимости аллантоина в воде при 20 °C составляет около 0,5 %; избыток может выпасть острыми игольчатыми кристаллами при охлаждении.',
    })
  }
  const meltChecks: { id: string; minT: number; label: string; labelEn: string }[] = [
    { id: 'carnauba-wax', minT: 82, label: 'карнаубского воска (≥ 82 °C)', labelEn: 'Carnauba Wax (≥ 82 °C)' },
    { id: 'ceramide-np', minT: 80, label: 'церамида NP (≥ 80 °C)', labelEn: 'Ceramide NP (≥ 80 °C)' },
    { id: 'microcrystalline-wax', minT: 78, label: 'микрокристаллического воска (≥ 78 °C)', labelEn: 'Microcrystalline Wax (≥ 78 °C)' },
    { id: 'candelilla-wax', minT: 73, label: 'канделильского воска (≥ 73 °C)', labelEn: 'Candelilla Wax (≥ 73 °C)' },
    { id: 'behenyl-alcohol', minT: 70, label: 'бегенилового спирта (≥ 70 °C)', labelEn: 'Behenyl Alcohol (≥ 70 °C)' },
    { id: 'beeswax', minT: 68, label: 'пчелиного воска (≥ 68 °C)', labelEn: 'Beeswax (≥ 68 °C)' },
    { id: 'cetearyl-alcohol', minT: 68, label: 'цетилстеарилового спирта (≥ 68 °C)', labelEn: 'Cetearyl Alcohol (≥ 68 °C)' },
  ]
  const unmeltedList = meltChecks.filter((m) => (totalByIngredient.get(m.id) ?? 0) > 0 && input.phaseTempC.B < m.minT)
  if (unmeltedList.length > 0) {
    const highest = unmeltedList[0]
    const namesRu = unmeltedList.map((u) => u.label).join(', ')
    const namesEn = unmeltedList.map((u) => u.labelEn).join(', ')
    issues.push({
      code: 'melt:phase-b',
      severity: 'warn',
      title: en
        ? `Phase B temperature too low (${input.phaseTempC.B} °C < ${highest.minT} °C) to melt ${namesEn}`
        : `Низкая температура фазы B (${input.phaseTempC.B} °C < ${highest.minT} °C) для расплавления ${namesRu}`,
      detail: en
        ? 'Solid waxes, fatty alcohols, or ceramides may not melt completely — creating graininess during emulsification. Raise Phase B above the highest melting point.'
        : 'Твёрдые воски, жирные спирты или церамиды могут не полностью расплавиться — при эмульгировании появятся крупинки. Поднимите температуру фазы B выше самой высокой точки плавления.',
    })
  }
  const parfumPct = totalByIngredient.get('parfum') ?? 0
  const hasSolubilizer = activeRows.some((r) => r.ingredient.role === 'solubilizer' || r.ingredient.id === 'polysorbate-60' || r.ingredient.id === 'polysorbate-80')
  if (parfumPct > 0 && oilPhasePct < 1 && emulsifierPct <= 0 && !hasSolubilizer && !activeRows.some((r) => r.ingredient.role === 'surfactant')) {
    issues.push({
      code: 'haze:parfum',
      severity: 'warn',
      ingredientId: 'parfum',
      title: en
        ? 'Fragrance in aqueous system without solubilizer — haze risk'
        : 'Отдушка в водной системе без солюбилизатора — риск помутнения',
      detail: en
        ? `${parfumPct}% fragrance added to an aqueous base without a solubilizer. Pre-mix with PEG-40 Hydrogenated Castor Oil (typically 3:1–5:1 to fragrance).`
        : `Добавлено ${parfumPct} % отдушки в водную базу без солюбилизатора. Введите PEG-40 Hydrogenated Castor Oil (ориентир 3:1–5:1 к отдушке) через предварительный премикс.`,
    })
  }

  // 7. Наличие консерванта в водной системе
  const hasPreservative = activeRows.some((r) => r.ingredient.role === 'preservative')
  if (waterPct >= 5 && !hasPreservative) {
    issues.push({
      code: 'micro:no-preservative',
      severity: 'error',
      title: en ? 'Aqueous system without preservative' : 'Водная система без консерванта',
      detail: en
        ? `Formula contains ${waterPct}% water with no preservative — high microbial growth risk. Add a preservation system to Phase C.`
        : `В рецептуре ${waterPct} % воды, но нет консерванта — высок риск микробного роста. Добавьте консервирующую систему в фазу C.`,
    })
  }

  // 8. Регуляторные лимиты (ТР ТС 009/2011 и EU 1223/2009) с учётом зоны нанесения (productZone)
  const zone: ProductZone = input.productZone ?? 'face'
  for (const [id, pct] of totalByIngredient.entries()) {
    if (pct <= 0) continue
    const ing = byId.get(id)!
    for (const rule of ing.regulatory ?? []) {
      let limit = input.productType === 'leave-on' ? rule.leaveOnMax : rule.rinseOffMax
      // Зональные уточнения EU 1223/2009 / 2022/2195 / 2024/996
      if (id === 'salicylic-acid') {
        if (zone === 'spray') limit = 0
        else if (input.productType === 'rinse-off' && zone !== 'hair') limit = 2.0
        else if (input.productType === 'leave-on' && zone === 'body') limit = 0.5
      } else if (id === 'homosalate' && (zone === 'body' || zone === 'spray')) {
        limit = 0
      } else if (id === 'retinol' && zone === 'body') {
        limit = 0.05
      } else if (id === 'alpha-arbutin' && zone === 'body') {
        limit = 0.5
      } else if (id === 'kojic-acid' && zone === 'body') {
        limit = 0
      } else if (id === 'cetrimonium-chloride' && input.productType === 'leave-on' && zone === 'hair') {
        limit = 1.0
      }

      const factor = rule.acidFactor ?? 1
      const effectivePct = round(pct * factor, 3)
      const exceeded = limit !== undefined && (rule.strictMax ? effectivePct >= limit - 1e-6 : effectivePct > limit + 1e-6)
      if (exceeded) {
        const calcNote = factor !== 1 ? (en ? ` (${effectivePct}% as acid equivalent)` : ` (${effectivePct} % в пересчёте на кислоту)`) : ''
        const op = rule.strictMax ? '≥' : '>'
        issues.push({
          code: `reg:${ing.id}`,
          severity: 'error',
          ingredientId: ing.id,
          standard: rule.standard,
          title: en
            ? `Regulatory limit exceeded for ${ing.inci}: ${pct}%${calcNote} ${op} ${limit}% (${input.productType}, ${zone})`
            : `Превышен лимит ${ing.inci}: ${pct} %${calcNote} ${op} ${limit} % (${input.productType}, зона: ${zone})`,
          detail: `${rule.standard}. ${rule.note}`,
        })
      } else if (rule.warnAbove !== undefined && effectivePct > rule.warnAbove + 1e-6) {
        issues.push({
          code: `reg-warn:${ing.id}`,
          severity: 'warn',
          ingredientId: ing.id,
          standard: rule.standard,
          title: en
            ? `${ing.inci} (${pct}%) exceeds the ${rule.warnAbove}% threshold for specific product categories`
            : `${ing.inci} (${pct} %) превышает порог ${rule.warnAbove} % для отдельных категорий продуктов`,
          detail: `${rule.standard}. ${rule.note}`,
        })
      }
      const allergenThreshold = input.productType === 'leave-on' ? rule.allergenLeaveOn : rule.allergenRinseOff
      if (allergenThreshold !== undefined && pct > allergenThreshold) {
        issues.push({
          code: `allergen:${ing.id}`,
          severity: 'info',
          ingredientId: ing.id,
          standard: rule.standard,
          title: en
            ? `Mandatory allergen labeling for ${ing.inci} (> ${allergenThreshold}%)`
            : `Обязательная маркировка аллергена ${ing.inci} (> ${allergenThreshold} %)`,
          detail: `${rule.standard}. ${rule.note}`,
        })
      }
    }
  }

  // Суммарный лимит катионных четвертичных аммонийных солей (CTAC + BTAC, EU Annex III/286-287)
  const ctacPct = totalByIngredient.get('cetrimonium-chloride') ?? 0
  const btacPct = totalByIngredient.get('behentrimonium-chloride') ?? 0
  if (ctacPct > 0 && btacPct > 0) {
    const quatSum = round(ctacPct + btacPct, 2)
    const quatMax = input.productType === 'rinse-off' ? 5.0 : 3.0
    if (quatSum > quatMax + 1e-6) {
      issues.push({
        code: 'reg:quat-sum',
        severity: 'error',
        standard: 'EU 1223/2009 Annex III/286–287',
        title: en
          ? `Combined CTAC + BTAC exceeds limit: ${quatSum}% > ${quatMax}%`
          : `Превышена сумма CTAC + BTAC: ${quatSum} % > ${quatMax} %`,
        detail: en
          ? 'EU 1223/2009 Annex III/286–287 caps the combined sum of Cetrimonium, Steartrimonium, and Behentrimonium chlorides.'
          : 'Приложение III (пп. 286–287) EU 1223/2009 ограничивает суммарное содержание хлоридов цетримония, стеартримония и бегентримония.',
      })
    }
  }
  // Ингаляционный запрет для минеральных УФ-фильтров в спреях
  if (zone === 'spray' && ((totalByIngredient.get('zinc-oxide') ?? 0) > 0 || (totalByIngredient.get('titanium-dioxide') ?? 0) > 0)) {
    issues.push({
      code: 'reg:mineral-spray',
      severity: 'error',
      standard: 'EU 1223/2009 Annex VI/27,30',
      title: en
        ? 'Mineral UV filters (ZnO / TiO₂) prohibited in inhalable sprays'
        : 'Минеральные УФ-фильтры (ZnO / TiO₂) запрещены в ингаляционных спреях',
      detail: en
        ? 'Nano/powdered Zinc Oxide and Titanium Dioxide must not be used in applications that may lead to lung exposure by inhalation.'
        : 'Оксид цинка и диоксид титана (особенно в нано-форме) запрещены в формах, создающих риск ингаляции в лёгкие.',
    })
  }

  const batchCost = round(rows.reduce((s, r) => s + r.cost, 0), 2)
  const costPerKg = round((batchCost / batchGrams) * 1000, 2)
  const errorsCount = issues.filter((i) => i.severity === 'error').length
  const warningsCount = issues.filter((i) => i.severity === 'warn').length

  return {
    rows,
    totalPct,
    missingPct,
    balanced,
    phaseTotals,
    oilPhasePct,
    emulsifierPct,
    requiredHlb,
    actualHlb,
    hlbDelta,
    costPerKg,
    batchCost,
    inci: buildInciList(rows),
    issues,
    errorsCount,
    warningsCount,
  }
}

/** Проверка целей учебного кейса в песочнице. */
export function checkPresetGoals(ev: FormulaEvaluation, input: FormulaInput, goals: SandboxGoals): GoalCheck[] {
  const checks: GoalCheck[] = []
  if (goals.requireBalance) {
    checks.push({ id: 'balance', label: 'Сумма всех фаз равна ровно 100,00 %', passed: ev.balanced })
  }
  if (goals.requireHlbMatch) {
    checks.push({
      id: 'hlb',
      label: 'Расчётный ГЛБ эмульгаторов в пределах ±1,0 от требуемого ГЛБ масляной фазы',
      passed: ev.hlbDelta !== null && ev.hlbDelta <= 1.0,
    })
  }
  if (goals.requirePreservative) {
    const hasPres = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'preservative')
    const presOk = hasPres && !ev.issues.some((i) => i.severity === 'error' && (i.code.startsWith('ph:') || i.code.startsWith('reg:') || i.code === 'micro:no-preservative'))
    checks.push({ id: 'preservative', label: 'Консервирование работает при выбранном pH и соблюдает регуляторные лимиты', passed: presOk })
  }
  if (goals.phMin !== undefined && goals.phMax !== undefined) {
    checks.push({
      id: 'ph',
      label: language === 'en'
        ? `Target pH within specified range ${goals.phMin}–${goals.phMax}`
        : `Целевой pH в заданном диапазоне ${goals.phMin}–${goals.phMax}`,
      passed: input.targetPh >= goals.phMin && input.targetPh <= goals.phMax,
    })
  }
  if (goals.noErrors) {
    checks.push({ id: 'noErrors', label: 'Нет критических ошибок (температура, конфликты, регуляторика)', passed: ev.errorsCount === 0 })
  }
  return checks
}
