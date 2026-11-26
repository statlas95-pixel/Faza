// Детерминированные физико-химические и инженерные модели Пакета F:
// 1) packaging-iso18811 (pack-compat) — Совместимость рецептуры и первичной упаковки (ISO/TR 18811, 4 нед. +45 °C)
// 2) spf-formulator-lab (spf-lab) — Конструктор фотостабильной системы SPF 50+ / UVA-PF
// 3) wpu-biofilm-hunt (wpu-audit) — Аудит петли воды очищенной (WPU) и охота за биоплёнкой B. cepacia
// 4) stability-triage (triage) — Триаж рекламаций рынка и ускоренного старения

import { language } from './locale'

// ===== 1. Упаковка и совместимость (ISO/TR 18811) =====

export interface PackOption {
  id: string
  name: string
  material: string
  barrierNote: string
}

export interface PackTestResult {
  packId: string
  weightLossPct: number // норма < 2.0 % за 4 нед. при +45 °C
  wallState: string
  organoleptic: string
  pumpState: string
  passed: boolean
  why: string
}

export interface PackProductCase {
  id: string
  name: string
  composition: string
  correctPackId: string
  results: PackTestResult[]
}

export interface PackCompatLabData {
  id: string
  packs: PackOption[]
  products: PackProductCase[]
  questions: {
    id: string
    prompt: string
    options: { id: string; text: string; correct?: boolean; why: string }[]
  }[]
}

export function evaluatePackCompat(
  data: PackCompatLabData,
  ans: { selectedPacks: Record<string, string>; quiz: Record<string, string> },
) {
  const productChecks = data.products.map((prod) => {
    const chosenPackId = ans.selectedPacks[prod.id]
    const cell = prod.results.find((r) => r.packId === chosenPackId)
    const ok = chosenPackId === prod.correctPackId || !!cell?.passed
    return { productId: prod.id, chosenPackId, ok, cell }
  })
  const quizChecks = data.questions.map((q) => {
    const opt = q.options.find((o) => o.id === ans.quiz[q.id])
    return { qId: q.id, ok: !!opt?.correct, opt }
  })
  const total = productChecks.length + quizChecks.length
  const earned = productChecks.filter((c) => c.ok).length + quizChecks.filter((c) => c.ok).length
  const score = total ? Number((earned / total).toFixed(3)) : 0
  return { productChecks, quizChecks, score }
}

// ===== 2. Конструктор фотостабильной системы SPF 50+ (spf-lab) =====

export interface SpfFilterState {
  dhhb: number // Diethylamino Hydroxybenzoyl Hexyl Benzoate (Uvinul A Plus), max 10 %
  bemotrizinol: number // Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine (Tinosorb S), max 10 %
  ethylhexylTriazone: number // Ethylhexyl Triazone (Uvinul T 150), max 5 %
  avobenzone: number // Butyl Methoxydibenzoylmethane, max 5 %
  ensulizole: number // Phenylbenzimidazole Sulfonic Acid, max 8 %
  polarEsterPct: number // C12-15 Alkyl Benzoate + Dicaprylyl Carbonate, 4..24 %
}

export interface SpfSpectrumPoint {
  nm: number
  absInitial: number
  absAfterUv: number
}

export interface SpfLabMetrics {
  spectrum: SpfSpectrumPoint[]
  inSilicoSpf: number
  uvaPf: number
  uvaRatio: number
  criticalWavelengthNm: number
  minPolarRequiredPct: number
  crystalFree: boolean
  photostable: boolean
  regCompliant: boolean
  totalFiltersPct: number
  warnings: string[]
}

export function defaultSpfState(): SpfFilterState {
  // Стартовая несбалансированная рецептура (авобензон без стабилизатора, мало растворителя, низкий SPF)
  return {
    dhhb: 1.0,
    bemotrizinol: 0.5,
    ethylhexylTriazone: 2.0,
    avobenzone: 3.5,
    ensulizole: 0.0,
    polarEsterPct: 8.0,
  }
}

const gauss = (nm: number, peak: number, width: number) =>
  Math.exp(-0.5 * Math.pow((nm - peak) / width, 2))

/** Детерминированный расчёт спектра поглощения 290–400 нм, in-silico SPF, UVA-PF, растворимости кристаллов и фотостабильности. */
export function computeSpfLabMetrics(s: SpfFilterState): SpfLabMetrics {
  const en = language === 'en'
  const totalFiltersPct = Number((s.dhhb + s.bemotrizinol + s.ethylhexylTriazone + s.avobenzone + s.ensulizole).toFixed(2))

  // Потребность твёрдых кристаллических УФ-фильтров в полярных эмолентах при хранении +4 °C
  const minPolarRequiredPct = Number(
    (s.dhhb * 1.15 + s.bemotrizinol * 1.3 + s.ethylhexylTriazone * 1.95 + s.avobenzone * 1.45).toFixed(1),
  )
  const crystalFree = s.polarEsterPct + 0.05 >= minPolarRequiredPct

  // Фотостабильность авобензона: без триазинового стабилизатора (Tinosorb S >= 0.6 * Avobenzone) теряет до 55 % UVA-пика под УФ
  const avoUnstabilized = s.avobenzone > 0.5 && s.bemotrizinol < s.avobenzone * 0.6
  const photostable = !avoUnstabilized
  const avoRetention = avoUnstabilized ? 0.42 : 0.95

  // Регуляторные потолки EU 1223/2009 Annex VI и ТР ТС 009/2011 Прил. 5
  const overLimits: string[] = []
  if (s.dhhb > 10) overLimits.push('DHHB > 10 %')
  if (s.bemotrizinol > 10) overLimits.push('Bemotrizinol > 10 %')
  if (s.ethylhexylTriazone > 5) overLimits.push('Ethylhexyl Triazone > 5 %')
  if (s.avobenzone > 5) overLimits.push('Avobenzone > 5 %')
  if (s.ensulizole > 8) overLimits.push('Ensulizole > 8 %')
  if (totalFiltersPct > 22) overLimits.push(en ? 'Total UV filters > 22% sensory budget' : 'Сумма УФ-фильтров > 22 % (бюджет сенсорики)')
  const regCompliant = overLimits.length === 0

  // Расчёт монохроматического поглощения A(λ) при толщине плёнки ~2 мг/см² (с поправкой на однородность плёнки)
  const filmFactor = crystalFree ? 1.0 : 0.62
  const spectrum: SpfSpectrumPoint[] = []
  for (let nm = 290; nm <= 400; nm += 5) {
    const aDhhb = s.dhhb * 0.21 * (gauss(nm, 356, 26) + 0.25 * gauss(nm, 310, 19))
    const aBemo = s.bemotrizinol * 0.24 * (0.96 * gauss(nm, 308, 21) + 1.0 * gauss(nm, 346, 27))
    const aEht = s.ethylhexylTriazone * 0.34 * gauss(nm, 311, 19)
    const aAvo = s.avobenzone * 0.22 * gauss(nm, 358, 24)
    const aEns = s.ensulizole * 0.23 * gauss(nm, 303, 17)

    const rawInit = (aDhhb + aBemo + aEht + aAvo + aEns) * filmFactor
    const rawPost = (aDhhb * 0.98 + aBemo * 0.98 + aEht * 0.96 + aAvo * avoRetention + aEns * 0.94) * filmFactor
    spectrum.push({
      nm,
      absInitial: Number(rawInit.toFixed(3)),
      absAfterUv: Number(rawPost.toFixed(3)),
    })
  }

  // Солнечно-эритемная эффективность E(λ)·I(λ) (пик наземного эритемного спектра 306–308 нм по CIE / ISO 24443)
  const solarEryWeight = (nm: number) =>
    gauss(nm, 308, 7.2) + 0.0008 * gauss(nm, 335, 16)

  let numEry = 0
  let denEry = 0
  let numUva = 0
  let denUva = 0
  let totalArea = 0

  for (const pt of spectrum) {
    const trans = Math.pow(10, -Math.min(2.35, pt.absAfterUv))
    const wE = solarEryWeight(pt.nm)
    numEry += wE
    denEry += wE * trans
    totalArea += pt.absAfterUv
    if (pt.nm >= 320 && pt.nm <= 400) {
      // Спектр действия PPD × I_UVA (ISO 24443: максимум фотопигментации 335–355 нм, резкий спад к 390–400 нм)
      const wU = gauss(pt.nm, 344, 12.5)
      numUva += wU
      denUva += wU * Math.pow(10, -Math.min(2.15, pt.absAfterUv * 1.08))
    }
  }

  const inSilicoSpf = Math.max(1, Math.min(85, Math.round(numEry / Math.max(1e-6, denEry))))
  const uvaPf = Number(Math.max(1, Math.min(45, numUva / Math.max(1e-6, denUva))).toFixed(1))
  const uvaRatio = Number((uvaPf / Math.max(1, inSilicoSpf)).toFixed(2))

  // Критическая длина волны λc (интеграл 90 % площади спектра 290–400 нм)
  let acc = 0
  let criticalWavelengthNm = 290
  for (const pt of spectrum) {
    acc += pt.absAfterUv
    if (totalArea > 0 && acc >= 0.9 * totalArea) {
      criticalWavelengthNm = pt.nm
      break
    }
  }

  const warnings: string[] = []
  if (!regCompliant) {
    warnings.push(
      en
        ? `Regulatory / budget violation: ${overLimits.join(', ')}.`
        : `Превышены регуляторные лимиты или бюджет вводов: ${overLimits.join(', ')}.`,
    )
  }
  if (!crystalFree) {
    warnings.push(
      en
        ? `Cold crystallization risk at +4 °C: solid UV filters need ≥ ${minPolarRequiredPct}% polar esters (currently ${s.polarEsterPct}%).`
        : `Риск выпадания кристаллов при +4 °C: твёрдым УФ-фильтрам нужно ≥ ${minPolarRequiredPct} % полярных эмолентов (сейчас ${s.polarEsterPct} %).`,
    )
  }
  if (!photostable) {
    warnings.push(
      en
        ? `Avobenzone (${s.avobenzone}%) lacks triplet photostabilizer: add ≥ ${(s.avobenzone * 0.6).toFixed(1)}% Bemotrizinol (Tinosorb S) or replace Avobenzone with DHHB.`
        : `Авобензон (${s.avobenzone} %) не фотостабилизирован: добавьте ≥ ${(s.avobenzone * 0.6).toFixed(1)} % Bemotrizinol (Tinosorb S) или замените авобензон на DHHB (Uvinul A Plus).`,
    )
  }
  if (inSilicoSpf < 50) {
    warnings.push(
      en
        ? `Calculated SPF (${inSilicoSpf}) is below target SPF 50+.`
        : `Расчётный SPF (${inSilicoSpf}) ниже целевого уровня SPF 50+.`,
    )
  }
  if (uvaRatio < 0.33 || criticalWavelengthNm < 370) {
    warnings.push(
      en
        ? `UVA-PF / SPF = ${uvaRatio} (λc = ${criticalWavelengthNm} nm): fails EU UVA-circle criterion (UVA-PF ≥ 1/3 SPF and λc ≥ 370 nm).`
        : `Отношение UVA-PF / SPF = ${uvaRatio} (λc = ${criticalWavelengthNm} нм): не выполнен критерий EU UVA-кружка (UVA-PF ≥ 1/3 SPF и λc ≥ 370 нм).`,
    )
  }

  return {
    spectrum,
    inSilicoSpf,
    uvaPf,
    uvaRatio,
    criticalWavelengthNm,
    minPolarRequiredPct,
    crystalFree,
    photostable,
    regCompliant,
    totalFiltersPct,
    warnings,
  }
}

export function evaluateSpfLab(s: SpfFilterState) {
  const m = computeSpfLabMetrics(s)
  const spfOk = m.inSilicoSpf >= 50
  const uvaOk = m.uvaRatio >= 0.33 && m.criticalWavelengthNm >= 370
  const checks = [spfOk, uvaOk, m.crystalFree, m.photostable, m.regCompliant]
  const score = Number((checks.filter(Boolean).length / checks.length).toFixed(3))
  return { metrics: m, spfOk, uvaOk, score }
}

// ===== 3. Охота за биоплёнкой в петле воды очищенной (wpu-audit) =====

export interface WpuSamplingPoint {
  id: string
  code: string
  name: string
  locationDesc: string
  velocityMs: number
  deadLegRatioLd: number
  sanitizationTempC: number
  conductivityUsCm: number
  tocPpb: number
  cfuPerMl: string
  gramStain: string
}

export interface WpuAuditLabData {
  id: string
  incidentSummary: string
  points: WpuSamplingPoint[]
  hotspotPointId: string
  conductivityQuestions: { id: string; text: string; correct?: boolean; why: string }[]
  capaOptions: { id: string; text: string; valid?: boolean; why: string }[]
}

export function evaluateWpuAudit(
  data: WpuAuditLabData,
  ans: { pointId?: string; condReasonId?: string; capaIds: string[] },
) {
  const pointOk = ans.pointId === data.hotspotPointId
  const condOpt = data.conductivityQuestions.find((o) => o.id === ans.condReasonId)
  const condOk = !!condOpt?.correct

  const validCapaIds = data.capaOptions.filter((c) => c.valid).map((c) => c.id)
  const pickedSet = new Set(ans.capaIds)
  const validPicked = validCapaIds.filter((id) => pickedSet.has(id)).length
  const wrongPicked = data.capaOptions.filter((c) => !c.valid && pickedSet.has(c.id)).length
  const capaScore = Math.max(0, (validPicked / Math.max(1, validCapaIds.length)) - wrongPicked * 0.5)
  const capaOk = capaScore >= 0.99

  const score = Number((((pointOk ? 1 : 0) + (condOk ? 1 : 0) + capaScore) / 3).toFixed(3))
  return { pointOk, condOk, condOpt, capaOk, capaScore, score }
}

// ===== 4. Триаж рекламаций рынка и стабильности (triage) =====

export interface TriageComplaint {
  id: string
  product: string
  complaint: string
  labFindings: string
  mechanisms: { id: string; text: string; correct?: boolean; why: string }[]
  fixes: { id: string; text: string; correct?: boolean; why: string }[]
}

export interface StabilityTriageLabData {
  id: string
  cases: TriageComplaint[]
}

export function evaluateStabilityTriage(
  data: StabilityTriageLabData,
  ans: Record<string, { mechId?: string; fixId?: string }>,
) {
  const rows = data.cases.map((c) => {
    const a = ans[c.id] ?? {}
    const mech = c.mechanisms.find((m) => m.id === a.mechId)
    const fix = c.fixes.find((f) => f.id === a.fixId)
    const mechOk = !!mech?.correct
    const fixOk = !!fix?.correct
    return { caseId: c.id, mechOk, fixOk, mech, fix }
  })
  const totalChecks = rows.length * 2
  const passedChecks = rows.reduce((s, r) => s + (r.mechOk ? 1 : 0) + (r.fixOk ? 1 : 0), 0)
  const score = totalChecks ? Number((passedChecks / totalChecks).toFixed(3)) : 0
  return { rows, score }
}
