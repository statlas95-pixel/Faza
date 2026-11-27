// Детерминированное физико-оптическое ядро «Лаборатории 6.0» (Направление G — «Живые приборы»):
// 1) Цифровой вискозиметр Брукфильда (LV шпиндели S61–S64, об/мин, контроль Torque 10–90 %,
//    кривая течения Гершеля–Балкли и петля тиксотропного гистерезиса).
// 2) Поляризационный микроскоп (×100 / ×400, угол анализатора 0°–90°, λ-пластина 530 нм:
//    мальтийские кресты LGN, двулучепреломляющие кристаллы, агломераты пигментов и пузырьки).

import type { FormulaEvaluation, FormulaInput } from './formulation'
import { analyzeSpfAndPigments } from './formulation-lab5'
import { language } from './locale'

export type BrookfieldSpindle = 'S61' | 'S62' | 'S63' | 'S64'

export interface SpindleSpec {
  id: BrookfieldSpindle
  label: string
  /** Полная шкала вязкости (100 % Torque) при 1 об/мин, мПа·с (стандарт Brookfield LV). */
  fullScaleAt1Rpm: number
  /** Коэффициент пересчёта об/мин → эффективная скорость сдвига γ̇ (с⁻¹). */
  shearFactor: number
  noteRu: string
  noteEn: string
}

export const BROOKFIELD_SPINDLES: SpindleSpec[] = [
  {
    id: 'S61',
    label: 'S61 (LV-1)',
    fullScaleAt1Rpm: 6000,
    shearFactor: 0.28,
    noteRu: 'Тоники, мицеллярные воды, текучие сыворотки (15–1 000 мПа·с)',
    noteEn: 'Toners, micellar waters, fluid serums (15–1,000 mPa·s)',
  },
  {
    id: 'S62',
    label: 'S62 (LV-2)',
    fullScaleAt1Rpm: 30000,
    shearFactor: 0.25,
    noteRu: 'Молочко, лёгкие флюиды, шампуни низкой вязкости (100–5 000 мПа·с)',
    noteEn: 'Milks, light fluids, low-viscosity shampoos (100–5,000 mPa·s)',
  },
  {
    id: 'S63',
    label: 'S63 (LV-3)',
    fullScaleAt1Rpm: 120000,
    shearFactor: 0.22,
    noteRu: 'Шампуни, гели, флюиды и кремы средней вязкости (500–25 000 мПа·с)',
    noteEn: 'Shampoos, gels, medium-viscosity creams (500–25,000 mPa·s)',
  },
  {
    id: 'S64',
    label: 'S64 (LV-4)',
    fullScaleAt1Rpm: 600000,
    shearFactor: 0.20,
    noteRu: 'Плотные ламеллярные кремы, бальзамы, гели с высоким пределом текучести (2 000–200 000 мПа·с)',
    noteEn: 'Rich lamellar creams, balms, high-yield gels (2,000–200,000 mPa·s)',
  },
]

export const BROOKFIELD_RPMS = [0.5, 1, 2.5, 5, 6, 10, 12, 20, 30, 50, 60, 100] as const

export interface RheologyModel {
  /** Предел текучести τ₀ при 22 °C, Па. */
  yieldStressPa: number
  /** Индекс консистенции K при 22 °C, Па·сⁿ. */
  consistencyK: number
  /** Индекс течения n (1 = ньютоновская, < 1 = псевдопластическая). */
  flowIndexN: number
  /** Доля обратимого разрушения структуры при прямом ходе сдвига (0..0.45). */
  thixotropyIndex: number
  /** Чувствительность к температуре (энергия активации вязкого течения, усл. ед.). */
  tempSensitivity: number
  /** Тип реологического поведения. */
  regime: 'newtonian' | 'shear-thinning' | 'herschel-bulkley' | 'thixotropic-lgn' | 'collapsed'
  regimeLabel: string
  /** Прогноз разрушения структуры / проблем рецептуры. */
  notes: string[]
}

export interface BrookfieldReading {
  spindle: BrookfieldSpindle
  rpm: number
  tempC: number
  shearRate: number
  viscosityMPas: number
  shearStressPa: number
  torquePct: number
  fsrMPas: number
  status: 'under' | 'ok' | 'high' | 'over'
  statusText: string
  recommendedSpindle: BrookfieldSpindle
  recommendedRpm: number
}

export interface RheogramPoint {
  shearRate: number
  stressUpPa: number
  stressDownPa: number
  viscosityUpMPas: number
  viscosityDownMPas: number
}

export interface RheogramCurve {
  points: RheogramPoint[]
  maxShearRate: number
  maxStressPa: number
  hysteresisAreaPaPerS: number
  shearThinningRatio: number
  recoveryEstimateSec: number
}

const r1 = (n: number) => Number(n.toFixed(1))
const r2 = (n: number) => Number(n.toFixed(2))

/** Извлекает детерминированную реологическую модель Гершеля–Балкли из текущей рецептуры. */
export function deriveRheologyModel(ev: FormulaEvaluation, input: FormulaInput): RheologyModel {
  const en = language === 'en'
  const pctMap = new Map<string, number>()
  for (const r of ev.rows) pctMap.set(r.ingredient.id, (pctMap.get(r.ingredient.id) ?? 0) + r.pct)
  const pctOf = (id: string) => pctMap.get(id) ?? 0
  const hasCode = (prefix: string) => ev.issues.some((i) => i.code === prefix || i.code.startsWith(prefix))

  const carbomerPct =
    pctOf('carbomer') + pctOf('ultrez-21')
  const synthPolyPct =
    pctOf('aristoflex-avc') + pctOf('sepimax-zen') + pctOf('simulgel-eg')
  const gumPct =
    pctOf('xanthan-gum') + pctOf('sclerotium-gum') + pctOf('guar-hptc') + pctOf('hec') + pctOf('hyaluronic-acid') * 0.6
  const clayPct = pctOf('veegum') + pctOf('disteardimonium-hectorite')
  const fattyAlcPct =
    pctOf('cetearyl-alcohol') + pctOf('cetyl-alcohol') + pctOf('behenyl-alcohol')
  const waxPct =
    pctOf('beeswax') + pctOf('candelilla-wax') + pctOf('carnauba-wax') + pctOf('microcrystalline-wax') + pctOf('shea-butter') * 0.45
  const lgnEmulsifierPct =
    pctOf('olivem-1000') + pctOf('montanov-68') + pctOf('montanov-202') + pctOf('glyceryl-stearate') * 0.5
  const woEmulsifierPct =
    pctOf('cetyl-peg-ppg-dimethicone') + pctOf('pg3-polyricinoleate') + pctOf('sorbitan-oleate') + pctOf('isolan-gps')
  const isWO = ev.oilPhasePct >= 10 && woEmulsifierPct >= 1.5 && (ev.actualHlb === null || ev.actualHlb <= 6.2)

  // Солевая кривая (NaCl) работает для солечувствительных анионно-амфотерных ПАВ (SLES/SCS/CAPB/саркозинаты),
  // но НЕ для чистых неионогенных глюкозидов или глутаматов!
  const SALT_RESPONSIVE_SURFS = new Set([
    'sles', 'capb', 'sodium-coco-sulfate', 'sodium-lauroyl-sarcosinate',
    'disodium-sulfosuccinate', 'cocamide-dea', 'sodium-methyl-cocoyl-taurate',
  ])
  const surfactantPct = ev.rows
    .filter((r) => r.pct > 0 && r.ingredient.role === 'surfactant' && r.ingredient.ionic !== 'cationic')
    .reduce((s, r) => s + r.pct, 0)
  const saltResponsiveSurfPct = ev.rows
    .filter((r) => r.pct > 0 && SALT_RESPONSIVE_SURFS.has(r.ingredient.id))
    .reduce((s, r) => s + r.pct, 0)
  const saltPct = pctOf('sodium-chloride') + pctOf('magnesium-sulfate')

  const carbomerCollapsed =
    carbomerPct > 0 &&
    (hasCode('conflict:carbomer-electrolyte') ||
      ev.issues.some((i) => i.severity === 'error' && ['ph:carbomer', 'ph:ultrez-21', 'ph:aristoflex-avc'].includes(i.code)))
  const phaseSplit = hasCode('hlb:no-emulsifier') || hasCode('hlb:mismatch')
  const ionicConflict = hasCode('conflict:anionic-cationic') || hasCode('conflict:carbomer-cationic')

  const waterPct = pctOf('aqua')
  const anhydrous = waterPct < 5 && ev.oilPhasePct >= 50

  let yieldStressPa = 0
  let consistencyK = 0.004
  let flowIndexN = 0.98
  let thixotropyIndex = 0.02
  let tempSensitivity = 0.025
  const notes: string[] = []

  if (anhydrous) {
    yieldStressPa = 8 + waxPct * 4.5 + clayPct * 7
    consistencyK = 4 + waxPct * 2.8 + ev.oilPhasePct * 0.06
    flowIndexN = Math.max(0.32, 0.72 - waxPct * 0.02)
    thixotropyIndex = Math.min(0.38, 0.14 + waxPct * 0.014 + clayPct * 0.06)
    tempSensitivity = 0.085
    notes.push(
      en
        ? 'Anhydrous wax/oil matrix: viscosity drops steeply near 40–50 °C as crystalline wax network softens.'
        : 'Безводная восковая/масляная матрица: при 40–50 °C кристаллическая сетка восков резко размягчается.',
    )
  } else {
    // 1. Вклад карбомеров (резко обрушивается при коллапсе от электролитов или низкого pH)
    const effCarbomer = carbomerCollapsed ? carbomerPct * 0.08 : carbomerPct
    yieldStressPa += effCarbomer * 36
    consistencyK += effCarbomer * 28

    // 2. Вклад синтетических акрилатов и природных камедей
    yieldStressPa += synthPolyPct * 16 + gumPct * 9 + clayPct * 14
    consistencyK += synthPolyPct * 14 + gumPct * 11 + clayPct * 9

    // 3. Вклад ламеллярной гелевой сети (LGN) или обратной эмульсии W/O (упаковка внутренней водной фазы)
    const lgnStrength = phaseSplit
      ? 0.12
      : Math.min(1.4, (fattyAlcPct * 0.22 + lgnEmulsifierPct * 0.18) * (ev.oilPhasePct >= 3 ? 1 : 0.35))
    if (isWO && !phaseSplit) {
      // Обратная эмульсия W/O: чем выше внутренняя водная фаза φ (обычно 55–75 %), тем выше вязкость (Кригер–Доэрти)
      const phi = Math.min(0.76, waterPct / 100)
      const packBoost = Math.pow(1 - phi / 0.82, -1.6)
      yieldStressPa += 8 + packBoost * 2.2 + waxPct * 3.8 + clayPct * 12
      consistencyK += 6 + packBoost * 2.6 + waxPct * 4.0 + woEmulsifierPct * 1.4
      thixotropyIndex += Math.min(0.28, 0.12 + clayPct * 0.08 + waxPct * 0.018)
      tempSensitivity = Math.max(tempSensitivity, 0.048)
      if (saltPct < 0.4) {
        notes.push(
          en
            ? 'W/O emulsion with low electrolyte (< 0.4% MgSO₄/NaCl): internal water droplets risk Ostwald ripening and viscosity drift.'
            : 'Обратная эмульсия W/O с дефицитом электролита (< 0,4 % MgSO₄/NaCl): риск созревания Оствальда и просадки вязкости при хранении.',
        )
      }
    } else if (lgnStrength > 0.2) {
      yieldStressPa += lgnStrength * 22 + waxPct * 3.5
      consistencyK += lgnStrength * 20 + waxPct * 4.2 + ev.oilPhasePct * 0.12
      thixotropyIndex += Math.min(0.30, lgnStrength * 0.24)
      tempSensitivity = Math.max(tempSensitivity, 0.055)
    } else if (ev.oilPhasePct >= 3 && !phaseSplit) {
      yieldStressPa += ev.oilPhasePct * 0.18
      consistencyK += ev.oilPhasePct * 0.14
    }

    // 4. ПАВ-системы и солевая кривая (только для солечувствительных ПАВ; чистые глюкозиды/глутаматы солью не загущаются)
    if (saltResponsiveSurfPct >= 5 && ev.oilPhasePct < 3) {
      const saltFactor = saltPct > 0 ? Math.exp(-Math.pow((saltPct - 1.8) / 1.15, 2)) : 0.18
      const surfBase = Math.min(25, saltResponsiveSurfPct) * (0.12 + 0.55 * saltFactor)
      consistencyK += surfBase
      yieldStressPa += saltFactor * 1.4
      thixotropyIndex += 0.04
      if (saltPct > 3.2) {
        notes.push(
          en
            ? 'Salting-out zone (> 3.2% NaCl): wormlike micelles branch and viscosity collapses on the right side of the salt curve.'
            : 'Зона пересола (> 3,2 % NaCl): червеобразные мицеллы переходят в разветвлённую сетку — вязкость падает на правой ветви солевой кривой.',
        )
      }
    } else if (surfactantPct >= 5 && ev.oilPhasePct < 3) {
      consistencyK += Math.min(20, surfactantPct) * 0.04
      if (saltPct >= 0.5) {
        notes.push(
          en
            ? 'Sulfate-free nonionic/glutamate surfactant base: NaCl does not build wormlike micelles — thicken with a polymer (Xanthan / HEC / Sclerotium Gum).'
            : 'Бессульфатная база (глюкозиды/глутаматы): NaCl не образует червеобразных мицелл — загущайте полимером (ксантан, ГЭЦ, склероций).',
        )
      }
    }

    // 5. Тиксотропия от глин и камедей
    thixotropyIndex += Math.min(0.18, clayPct * 0.09 + gumPct * 0.08 + effCarbomer * 0.05)

    // 6. Индекс течения n (псевдопластичность)
    const structScore = effCarbomer * 1.6 + synthPolyPct * 1.1 + gumPct * 0.9 + lgnStrength * 0.95 + clayPct * 0.7
    if (structScore > 0.05) {
      flowIndexN = Math.max(0.28, 0.94 - Math.min(0.62, Math.log1p(structScore * 1.9) * 0.34))
    } else if (surfactantPct >= 5) {
      flowIndexN = 0.78
    }

    // 7. Дефекты, разрушающие реологию
    if (carbomerCollapsed) {
      notes.push(
        en
          ? 'Carbomer gel collapsed (electrolyte shielding or pH < 5.0): yield stress and viscosity dropped by ~90%.'
          : 'Коллапс карбомерного геля (экранирование электролитами или pH < 5,0): предел текучести и вязкость упали на ~90 %.',
      )
    }
    if (phaseSplit) {
      yieldStressPa *= 0.15
      consistencyK = Math.max(0.04, consistencyK * 0.15)
      flowIndexN = 0.88
      notes.push(
        en
          ? 'Unstable / phase-separated emulsion: spindle slips in free water/oil layers and readings drift.'
          : 'Расслоившаяся эмульсия: шпиндель проскальзывает между фазами, показания нестабильны и занижены.',
      )
    }
    if (ionicConflict) {
      yieldStressPa *= 0.35
      consistencyK *= 0.35
      notes.push(
        en
          ? 'Ionic precipitation disrupts polymer entanglement and leaves granular flocs.'
          : 'Ионный конфликт осаждает полимер/ПАВ в хлопья и лишает базу связной структуры.',
      )
    }
  }

  // Классификация режима
  let regime: RheologyModel['regime'] = 'newtonian'
  if (carbomerCollapsed || phaseSplit || ionicConflict) {
    regime = 'collapsed'
  } else if (thixotropyIndex >= 0.18 && yieldStressPa >= 4) {
    regime = 'thixotropic-lgn'
  } else if (yieldStressPa >= 3) {
    regime = 'herschel-bulkley'
  } else if (flowIndexN < 0.86) {
    regime = 'shear-thinning'
  }

  const regimeLabels: Record<RheologyModel['regime'], [string, string]> = {
    newtonian: ['Ньютоновская жидкость (η ≈ const)', 'Newtonian fluid (η ≈ const)'],
    'shear-thinning': ['Псевдопластическая система (разжижение при сдвиге)', 'Shear-thinning (pseudoplastic) fluid'],
    'herschel-bulkley': ['Вязкопластичный гель Гершеля–Балкли (есть τ₀)', 'Herschel–Bulkley yield-stress gel (τ₀ > 0)'],
    'thixotropic-lgn': ['Тиксотропная структурированная сеть (LGN / глина)', 'Thixotropic structured network (LGN / clay)'],
    collapsed: ['Разрушенная / нестабильная структура (дефект)', 'Collapsed / unstable structure (defect)'],
  }

  if (notes.length === 0) {
    notes.push(
      regime === 'thixotropic-lgn'
        ? (en
            ? 'Structured lamellar/thixotropic network resists creaming at rest (high τ₀) yet spreads effortlessly under skin shear.'
            : 'Структурированная ламеллярная/тиксотропная сетка удерживает капли в покое (высокий τ₀) и легко распределяется на коже при сдвиге.')
        : regime === 'herschel-bulkley'
          ? (en
              ? 'Distinct yield stress τ₀ keeps air bubbles and pigments suspended; measure across ≥ 2 speeds to capture shear thinning.'
              : 'Выраженный предел текучести τ₀ удерживает частицы во взвеси; снимайте минимум 2 скорости, чтобы оценить псевдопластичность.')
          : regime === 'shear-thinning'
            ? (en
                ? 'Moderate shear thinning: pours smoothly from the bottle and recovers rapidly after shearing.'
                : 'Умеренная псевдопластичность: продукт легко дозируется из флакона и быстро восстанавливает вязкость.')
            : (en
                ? 'Near-Newtonian low-viscosity system: use spindle S61 at 30–100 rpm to stay inside the 10–90% Torque window.'
                : 'Почти ньютоновская текучая система: используйте шпиндель S61 на 30–100 об/мин для попадания в окно Torque 10–90 %.'),
    )
  }

  return {
    yieldStressPa: r2(Math.max(0, yieldStressPa)),
    consistencyK: r2(Math.max(0.002, consistencyK)),
    flowIndexN: r2(Math.min(1, Math.max(0.25, flowIndexN))),
    thixotropyIndex: r2(Math.min(0.45, Math.max(0.01, thixotropyIndex))),
    tempSensitivity: r2(tempSensitivity),
    regime,
    regimeLabel: en ? regimeLabels[regime][1] : regimeLabels[regime][0],
    notes,
  }
}

/** Температурный множитель вязкости относительно 22 °C. */
function tempFactor(tempC: number, sensitivity: number): number {
  return Math.exp(-sensitivity * (tempC - 22))
}

/** Расчёт напряжения сдвига τ (Па) и вязкости η (мПа·с) по модели Гершеля–Балкли. */
export function viscosityAtShear(
  model: RheologyModel,
  shearRate: number,
  tempC = 22,
  structuralFactor = 1,
): { stressPa: number; viscosityMPas: number } {
  const g = Math.max(0.05, shearRate)
  const tf = tempFactor(tempC, model.tempSensitivity)
  const tau0 = model.yieldStressPa * tf * structuralFactor
  const K = model.consistencyK * tf * structuralFactor
  const stressPa = tau0 + K * Math.pow(g, model.flowIndexN)
  const viscosityMPas = (stressPa / g) * 1000
  return { stressPa: r2(stressPa), viscosityMPas: r1(viscosityMPas) }
}

/** Подбирает оптимальную пару (шпиндель, об/мин), попадающую ближе всего к 50 % Torque. */
export function suggestOptimalBrookfield(
  model: RheologyModel,
  tempC = 22,
): { spindle: BrookfieldSpindle; rpm: number } {
  let best: { spindle: BrookfieldSpindle; rpm: number; score: number } = {
    spindle: 'S63',
    rpm: 12,
    score: Infinity,
  }
  const preferredRpms = [6, 10, 12, 20, 30, 50, 60, 100, 5, 2.5, 1, 0.5]
  for (const sp of BROOKFIELD_SPINDLES) {
    for (const rpm of preferredRpms) {
      const g = Math.max(0.08, rpm * sp.shearFactor)
      const { viscosityMPas } = viscosityAtShear(model, g, tempC)
      const fsr = sp.fullScaleAt1Rpm / rpm
      const torque = (viscosityMPas / fsr) * 100
      if (torque >= 15 && torque <= 85) {
        const dist = Math.abs(torque - 50) + (rpm === 12 || rpm === 20 || rpm === 30 ? 0 : 4)
        if (dist < best.score) best = { spindle: sp.id, rpm, score: dist }
      }
    }
  }
  if (!Number.isFinite(best.score)) {
    // Fallback: ближайший к 45 % Torque
    for (const sp of BROOKFIELD_SPINDLES) {
      for (const rpm of BROOKFIELD_RPMS) {
        const g = Math.max(0.08, rpm * sp.shearFactor)
        const { viscosityMPas } = viscosityAtShear(model, g, tempC)
        const fsr = sp.fullScaleAt1Rpm / rpm
        const torque = (viscosityMPas / fsr) * 100
        const dist = Math.abs(Math.min(140, torque) - 45)
        if (dist < best.score) best = { spindle: sp.id, rpm, score: dist }
      }
    }
  }
  return { spindle: best.spindle, rpm: best.rpm }
}

/** Снимает единичное показание цифрового вискозиметра Брукфильда. */
export function measureBrookfield(
  model: RheologyModel,
  spindleId: BrookfieldSpindle,
  rpm: number,
  tempC = 22,
): BrookfieldReading {
  const en = language === 'en'
  const spec = BROOKFIELD_SPINDLES.find((s) => s.id === spindleId) ?? BROOKFIELD_SPINDLES[2]
  const safeRpm = Math.max(0.5, Math.min(100, rpm))
  const shearRate = r2(safeRpm * spec.shearFactor)
  const { stressPa, viscosityMPas } = viscosityAtShear(model, shearRate, tempC)
  const fsrMPas = r1(spec.fullScaleAt1Rpm / safeRpm)
  const torquePct = r1((viscosityMPas / fsrMPas) * 100)
  const opt = suggestOptimalBrookfield(model, tempC)

  let status: BrookfieldReading['status'] = 'ok'
  let statusText: string
  if (torquePct > 100) {
    status = 'over'
    statusText = en
      ? `EEEE Overload (> 100% Torque): reduce rpm or switch to a larger spindle number (try ${opt.spindle} @ ${opt.rpm} rpm).`
      : `EEEE Перегрузка пружины (> 100 % Torque): снизьте об/мин или возьмите шпиндель большего номера (рекомендуется ${opt.spindle} при ${opt.rpm} об/мин).`
  } else if (torquePct > 90) {
    status = 'high'
    statusText = en
      ? `Near upper limit (${torquePct}% Torque): accuracy drops above 90% — step down rpm or pick ${opt.spindle}.`
      : `Верхняя граница (${torquePct} % Torque): выше 90 % растёт риск перегрузки — снизьте об/мин или выберите ${opt.spindle}.`
  } else if (torquePct < 10) {
    status = 'under'
    statusText = en
      ? `Under-range (< 10% Torque): spring error exceeds ±10%. Increase rpm or switch to a lower spindle number (try ${opt.spindle} @ ${opt.rpm} rpm).`
      : `Недогрузка (< 10 % Torque): погрешность измерения превышает ±10 %. Увеличьте об/мин или возьмите шпиндель меньшего номера (рекомендуется ${opt.spindle} при ${opt.rpm} об/мин).`
  } else {
    status = 'ok'
    statusText = en
      ? `Valid Brookfield window (10–90% Torque): reliable reading at γ̇ = ${shearRate} s⁻¹.`
      : `Рабочее окно Brookfield (10–90 % Torque): достоверный замер при γ̇ = ${shearRate} с⁻¹.`
  }

  return {
    spindle: spec.id,
    rpm: safeRpm,
    tempC,
    shearRate,
    viscosityMPas,
    shearStressPa: stressPa,
    torquePct,
    fsrMPas,
    status,
    statusText,
    recommendedSpindle: opt.spindle,
    recommendedRpm: opt.rpm,
  }
}

/** Строит прямую и обратную кривые течения (петлю тиксотропного гистерезиса). */
export function computeRheogram(model: RheologyModel, tempC = 22): RheogramCurve {
  const maxShearRate = 100
  const steps = 24
  const points: RheogramPoint[] = []

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Логарифмически-квадратичная сетка для детализации области малых сдвигов
    const g = r2(0.2 + (maxShearRate - 0.2) * Math.pow(t, 1.55))
    const up = viscosityAtShear(model, g, tempC, 1)
    // При обратном ходе структура частично разрушена — сильнее в средней зоне сдвига
    const breakdown = model.thixotropyIndex * Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.85 + model.thixotropyIndex * 0.25 * (1 - t)
    const downFactor = Math.max(0.45, 1 - breakdown)
    const down = viscosityAtShear(model, g, tempC, downFactor)
    points.push({
      shearRate: g,
      stressUpPa: up.stressPa,
      stressDownPa: down.stressPa,
      viscosityUpMPas: up.viscosityMPas,
      viscosityDownMPas: down.viscosityMPas,
    })
  }

  // Площадь петли гистерезиса по правилу трапеций, Па/с
  let area = 0
  for (let i = 1; i < points.length; i++) {
    const dg = points[i].shearRate - points[i - 1].shearRate
    const diff0 = Math.max(0, points[i - 1].stressUpPa - points[i - 1].stressDownPa)
    const diff1 = Math.max(0, points[i].stressUpPa - points[i].stressDownPa)
    area += ((diff0 + diff1) / 2) * dg
  }

  const maxStressPa = r1(Math.max(1, ...points.map((p) => p.stressUpPa)))
  const vLow = viscosityAtShear(model, 1.2, tempC).viscosityMPas
  const vHigh = viscosityAtShear(model, 12.0, tempC).viscosityMPas
  const shearThinningRatio = r2(vLow / Math.max(0.1, vHigh))
  const recoveryEstimateSec = Math.round(6 + model.thixotropyIndex * 180 + model.yieldStressPa * 0.9)

  return {
    points,
    maxShearRate,
    maxStressPa,
    hysteresisAreaPaPerS: r1(area),
    shearThinningRatio,
    recoveryEstimateSec,
  }
}

/* ==================== 2. Поляризационный микроскоп (×100 / ×400, 0°–90°) ==================== */

export interface PolarizedMicroscopyModel {
  /** Наличие ламеллярной гелевой сети (мальтийские кресты при скрещённых поляризаторах). */
  hasMalteseCrosses: boolean
  /** Интенсивность мальтийских крестов (0..1). */
  lgnIntensity: number
  /** Наличие двулучепреломляющих кристаллов (аллантоин, твёрдые УФ-фильтры, нерасплавленный воск, салициловая к-та). */
  hasCrystals: boolean
  crystalCause: string | null
  /** Наличие пигментов / минеральных фильтров и их дисперсность. */
  hasPigments: boolean
  pigmentsAgglomerated: boolean
  /** Наличие эмульсионных капель и их размер. */
  emulsionState: 'none' | 'fine' | 'coarse' | 'wo'
  dropletD50Um: number
  /** Пузырьки воздуха (деаэрация / ПАВ) и хлопья ионного конфликта. */
  hasAirBubbles: boolean
  hasIonicFlocs: boolean
  /** Итоговые диагностические карточки для светлого поля (0°) и поляризации (90°). */
  brightfieldVerdict: string
  polarizedVerdict: string
  findings: { kind: 'ok' | 'warn' | 'info'; text: string }[]
}

const WO_EMULSIFIERS = new Set([
  'cetyl-peg-ppg-dimethicone',
  'pg3-polyricinoleate',
  'sorbitan-oleate',
  'sorbitan-isostearate',
])

export function analyzePolarizedMicroscopy(
  ev: FormulaEvaluation,
  input: FormulaInput,
): PolarizedMicroscopyModel {
  const en = language === 'en'
  const pctMap = new Map<string, number>()
  for (const r of ev.rows) pctMap.set(r.ingredient.id, (pctMap.get(r.ingredient.id) ?? 0) + r.pct)
  const pctOf = (id: string) => pctMap.get(id) ?? 0
  const hasCode = (prefix: string) => ev.issues.some((i) => i.code === prefix || i.code.startsWith(prefix))

  const spfPig = analyzeSpfAndPigments(ev, input)
  const hasOil = ev.oilPhasePct >= 1
  const phaseSplit = hasCode('hlb:no-emulsifier') || hasCode('hlb:mismatch')
  const hlbDrift = hasCode('hlb:drift')
  const unmeltedWax = hasCode('melt:phase-b')
  const ionicConflict = hasCode('conflict:anionic-cationic') || hasCode('conflict:carbomer-cationic')
  const hasSurfactants = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'surfactant')

  const isWO =
    hasOil &&
    ev.rows.some((r) => r.pct > 0 && WO_EMULSIFIERS.has(r.ingredient.id)) &&
    (ev.actualHlb === null || ev.actualHlb <= 6.2)

  const fattyAlcPct =
    pctOf('cetearyl-alcohol') + pctOf('cetyl-alcohol') + pctOf('behenyl-alcohol')
  const lgnEmulPct =
    pctOf('olivem-1000') + pctOf('montanov-68') + pctOf('montanov-202')

  const hasMalteseCrosses =
    hasOil &&
    !phaseSplit &&
    !unmeltedWax &&
    !isWO &&
    (lgnEmulPct >= 1.5 || (fattyAlcPct >= 1.5 && ev.emulsifierPct >= 1.5))

  const lgnIntensity = hasMalteseCrosses
    ? r2(Math.min(1, 0.35 + fattyAlcPct * 0.14 + lgnEmulPct * 0.12))
    : 0

  // Двулучепреломляющие кристаллы
  let crystalCause: string | null = null
  if (hasCode('solubility:allantoin')) {
    crystalCause = en
      ? 'Needle crystals of recrystallized Allantoin (> 0.5% in water phase)'
      : 'Игольчатые кристаллы рекристаллизованного аллантоина (> 0,5 % в водной фазе)'
  } else if (spfPig && spfPig.hasUvFilters && !spfPig.crystalSafe) {
    crystalCause = en
      ? 'Prismatic crystals of solid UV filters (insufficient polar ester solvent)'
      : 'Призматические кристаллы твёрдых УФ-фильтров (нехватка полярных эфиров-растворителей)'
  } else if (pctOf('ensulizole') > 0 && input.targetPh < 6.8) {
    crystalCause = en
      ? 'Sharp needles of precipitated Ensulizole at pH < 6.8'
      : 'Острые иглы осаждённого Ensulizole при pH < 6,8'
  } else if (pctOf('salicylic-acid') >= 1.2 && pctOf('propanediol') + pctOf('pentylene-glycol') < 5) {
    crystalCause = en
      ? 'Needle crystals of Salicylic Acid (insufficient glycol co-solvent)'
      : 'Иглы салициловой кислоты (недостаточно гликолей-сорастворителей)'
  } else if (unmeltedWax) {
    crystalCause = en
      ? 'Bright anisotropic fragments of unmelted wax / fatty alcohols (phase B < 68 °C)'
      : 'Яркие анизотропные хлопья нерасплавленного воска / жирных спиртов (фаза B < 68 °C)'
  }
  const hasCrystals = crystalCause !== null

  const hasPigments = Boolean(
    (spfPig && spfPig.hasPigments) || pctOf('zinc-oxide') > 0 || pctOf('titanium-dioxide') > 0,
  )
  const pigmentsAgglomerated =
    hasPigments && Boolean(spfPig && spfPig.pigmentLoadPct >= 2 && !spfPig.hasDispersant)

  const emulsionState: PolarizedMicroscopyModel['emulsionState'] = !hasOil
    ? 'none'
    : isWO
      ? 'wo'
      : phaseSplit || hlbDrift
        ? 'coarse'
        : 'fine'

  const dropletD50Um =
    emulsionState === 'none'
      ? 0
      : emulsionState === 'coarse'
        ? (phaseSplit ? 34 : 16)
        : emulsionState === 'wo'
          ? 2.8
          : hasMalteseCrosses
            ? 2.2
            : 3.6

  const hasAirBubbles = hasSurfactants || pctOf('carbomer') >= 0.4 || pctOf('ultrez-21') >= 0.4

  const findings: PolarizedMicroscopyModel['findings'] = []
  if (hasMalteseCrosses) {
    findings.push({
      kind: 'ok',
      text: en
        ? `Anisotropic Maltese crosses detected under 90° crossed polarizers — confirms lamellar liquid-crystalline gel network (LGN) around oil droplets.`
        : `При скрещённых поляризаторах 90° видны анизотропные «мальтийские кресты» — подтверждена ламеллярная жидкокристаллическая сетка (LGN) вокруг капель.`,
    })
  } else if (emulsionState === 'fine') {
    findings.push({
      kind: 'info',
      text: en
        ? `Fine emulsion (d₅₀ ≈ ${dropletD50Um} μm) without birefringent LGN crosses: stability relies on polymer thickener and interfacial film.`
        : `Мелкодисперсная эмульсия (d₅₀ ≈ ${dropletD50Um} мкм) без двулучепреломляющих крестов LGN: стабильность держится на полимере и межфазной плёнке.`,
    })
  } else if (emulsionState === 'wo') {
    findings.push({
      kind: 'ok',
      text: en
        ? `Inverse W/O emulsion (water droplets d₅₀ ≈ ${dropletD50Um} μm in continuous oil phase); check MgSO₄ electrolyte for Ostwald ripening control.`
        : `Обратная эмульсия W/O (капли воды d₅₀ ≈ ${dropletD50Um} мкм в сплошной масляной фазе); стабильность требует электролита (MgSO₄) против созревания Оствальда.`,
    })
  } else if (emulsionState === 'coarse') {
    findings.push({
      kind: 'warn',
      text: en
        ? `Polydisperse coalescing droplets (d₅₀ ≈ ${dropletD50Um} μm) — high risk of creaming and oil separation.`
        : `Полидисперсные сливающиеся капли (d₅₀ ≈ ${dropletD50Um} мкм) — высокий риск кримирования и отслоения масла.`,
    })
  }

  if (hasCrystals && crystalCause) {
    findings.push({
      kind: 'warn',
      text: en
        ? `Birefringent crystals light up brightly under 90° polarizers: ${crystalCause}.`
        : `В скрещённых поляризаторах 90° ярко вспыхивают двулучепреломляющие кристаллы: ${crystalCause}.`,
    })
  }
  if (hasPigments) {
    findings.push({
      kind: pigmentsAgglomerated ? 'warn' : 'ok',
      text: pigmentsAgglomerated
        ? (en
            ? 'Dark pigment / mineral UV agglomerates (15–35 μm) visible in brightfield — add a dispersant and high-shear milling.'
            : 'В светлом поле видны тёмные агломераты пигментов / минеральных УФ (15–35 мкм) — нужен диспергатор и интенсивное диспергирование.')
        : (en
            ? 'Mineral UV / pigment particles are evenly dispersed (< 3 μm) without coarse agglomerates.'
            : 'Частицы пигментов и минеральных УФ распределены равномерно (< 3 мкм) без крупных агломератов.'),
    })
  }
  if (hasAirBubbles) {
    findings.push({
      kind: 'info',
      text: en
        ? 'Micro-bubbles show thick dark Becke rings in brightfield (0°) and vanish completely in 90° crossed polarizers (isotropic gas).'
        : 'Микропузырьки воздуха дают толстую тёмную кайму в светлом поле (0°), но полностью гаснут при 90° (газ оптически изотропен).',
    })
  }
  if (ionicConflict) {
    findings.push({
      kind: 'warn',
      text: en
        ? 'Irregular precipitated flocs from anionic–cationic incompatibility.'
        : 'Крупные аморфные хлопья осадка из-за анионно-катионного конфликта.',
    })
  }
  if (findings.length === 0) {
    findings.push({
      kind: 'info',
      text: en
        ? 'Optically isotropic aqueous/micellar solution: completely dark field at 90° crossed polarizers with zero birefringence.'
        : 'Оптически изотропный водный/мицеллярный раствор: при 90° поле зрения полностью тёмное, двулучепреломление отсутствует.',
    })
  }

  const brightfieldVerdict =
    emulsionState === 'coarse'
      ? (en ? `Coarse droplets (d₅₀ ≈ ${dropletD50Um} μm)` : `Крупные капли (d₅₀ ≈ ${dropletD50Um} мкм)`)
      : emulsionState === 'fine' || emulsionState === 'wo'
        ? (en ? `Uniform droplets (d₅₀ ≈ ${dropletD50Um} μm)` : `Однородные капли (d₅₀ ≈ ${dropletD50Um} мкм)`)
        : hasCrystals
          ? (en ? 'Solid needles / particulates in solution' : 'Твёрдые кристаллы / включения в растворе')
          : (en ? 'Clear isotropic continuous phase' : 'Прозрачная изотропная среда')

  const polarizedVerdict = hasCrystals && hasMalteseCrosses
    ? (en ? 'Maltese crosses (LGN) + sharp crystals' : 'Мальтийские кресты LGN + острые кристаллы')
    : hasCrystals
      ? (en ? 'Bright birefringent crystals (defect)' : 'Яркие двулучепреломляющие кристаллы (дефект)')
      : hasMalteseCrosses
        ? (en ? 'Maltese crosses — lamellar LGN confirmed' : 'Мальтийские кресты — подтверждена сеть LGN')
        : (en ? 'Dark isotropic field (no birefringence)' : 'Тёмное изотропное поле (нет анизотропии)')

  return {
    hasMalteseCrosses,
    lgnIntensity,
    hasCrystals,
    crystalCause,
    hasPigments,
    pigmentsAgglomerated,
    emulsionState,
    dropletD50Um,
    hasAirBubbles,
    hasIonicFlocs: ionicConflict,
    brightfieldVerdict,
    polarizedVerdict,
    findings,
  }
}
