// Детерминированные модели Пакета B:
// 1) Микробиологический Challenge Test (ISO 11930)
// 2) Симулятор промышленной подгонки pH в 500-кг реакторе (с буфером и электролитным порогом карбомера)

import { language } from './locale'

export interface ChallengeStrain {
  id: string
  name: string
  group: 'bacteria' | 'yeast' | 'mold'
  logDropD7: number
  logDropD14: number
  logDropD28: number
  isoA: string
  isoB: string
  passedA: boolean
  passedB: boolean
}

export interface ChallengeTestLabData {
  id: string
  formulaInfo: string
  strains: ChallengeStrain[]
  failedStrainId: string
  expectedCriterion: 'A' | 'B' | 'fail'
  criterionWhy: string
  remedies: { id: string; text: string; correct?: boolean; why: string }[]
}

export function evaluateChallengeTest(
  data: ChallengeTestLabData,
  ans: { strainId?: string; criterion?: 'A' | 'B' | 'fail'; remedyId?: string },
) {
  const strainOk = ans.strainId === data.failedStrainId
  const critOk = ans.criterion === data.expectedCriterion
  const chosenRemedy = data.remedies.find((r) => r.id === ans.remedyId)
  const remedyOk = !!chosenRemedy?.correct
  const score = Number((((strainOk ? 1 : 0) + (critOk ? 1 : 0) + (remedyOk ? 1 : 0)) / 3).toFixed(3))
  return { strainOk, critOk, remedyOk, chosenRemedy, score }
}

// ===== Симулятор промышленной подгонки pH на 500-кг партии с карбомером =====

export interface PhBatchState {
  step: number
  naoh10Kg: number // суммарно добавлено 10 % NaOH, кг
  citric10Kg: number // суммарно добавлено 10 % лимонной кислоты (на коррекцию перелёта), кг
  ph: number
  viscosityMpas: number
  saltPct: number // накопленная соль от «качелей» NaOH ↔ кислота (%)
  history: { step: number; action: string; ph: number; viscosityMpas: number }[]
}

const r2 = (n: number) => Number(n.toFixed(2))

/** Детерминированная кривая титрования 500-кг базы с 0,5 % Carbomer + 0,2 % Citric Acid. */
export function computePhBatchMetrics(naoh10Kg: number, citric10Kg: number): { ph: number; viscosityMpas: number; saltPct: number } {
  // Эффективный баланс щёлочи (1 кг 10% NaOH = 2.5 моль; 1 кг 10% лимонной кислоты ≈ 1.56 моль H+)
  const netBaseMol = naoh10Kg * 2.5 - citric10Kg * 1.56
  // Буферная кривая: исходная кислотность ~7.5 моль экв. (карбомер + 0.2% лимонка), точка нейтрализации около 10.5 моль (≈ 4.2 кг 10% NaOH)
  // Используем плавную сигмоидную буферную функцию с реальным крутым перегибом около pH 5.5–7.0
  const x = (netBaseMol - 10.6) / 1.85
  const sig = 1 / (1 + Math.exp(-x))
  const ph = r2(Math.max(2.6, Math.min(10.8, 3.25 + sig * 6.8 + Math.max(0, netBaseMol - 14.5) * 0.14)))

  // Соль от «качелей» (чем больше пришлось обратно гасить кислотой, тем выше ионная сила!)
  const excessSaltKg = citric10Kg * 0.12 + Math.max(0, naoh10Kg - 4.8) * 0.08
  const saltPct = r2((excessSaltKg / 500) * 100)

  // Вязкость карбомера: колокол с плато при pH 5.7–7.2, падение ниже 5.0 и выше 8.5, и штраф за соль от перелётов
  let baseVisc = 180
  if (ph < 4.5) {
    baseVisc = 180 + Math.max(0, ph - 3.2) * 400
  } else if (ph < 5.7) {
    baseVisc = 700 + Math.pow((ph - 4.5) / 1.2, 2.2) * 21300
  } else if (ph <= 7.4) {
    baseVisc = 22000 - Math.abs(ph - 6.3) * 1200
  } else {
    baseVisc = Math.max(2400, 20600 - (ph - 7.4) * 5800)
  }

  // Электролитный штраф за «качели» NaOH/кислота (цитрат натрия — трёхвалентный анион, резко сжимающий карбомер)
  const saltFactor = Math.max(0.28, 1 - saltPct * 3.8)
  const viscosityMpas = Math.round(Math.max(180, baseVisc * saltFactor))
  return { ph, viscosityMpas, saltPct }
}

export function initialPhBatchState(): PhBatchState {
  const m = computePhBatchMetrics(0, 0)
  return {
    step: 0,
    naoh10Kg: 0,
    citric10Kg: 0,
    ...m,
    history: [{
      step: 0,
      action: language === 'en'
        ? 'Initial unneutralized 0.5% Carbomer dispersion (500 kg)'
        : 'Исходная ненейтрализованная дисперсия 0,5 % Carbomer (500 кг)',
      ph: m.ph,
      viscosityMpas: m.viscosityMpas,
    }],
  }
}

export function dosePhBatch(prev: PhBatchState, kind: 'naoh' | 'citric', kg: number): PhBatchState {
  const naoh10Kg = r2(prev.naoh10Kg + (kind === 'naoh' ? kg : 0))
  const citric10Kg = r2(prev.citric10Kg + (kind === 'citric' ? kg : 0))
  const m = computePhBatchMetrics(naoh10Kg, citric10Kg)
  const step = prev.step + 1
  const en = language === 'en'
  const action = kind === 'naoh'
    ? (en ? `+${kg} kg 10% NaOH solution (total ${naoh10Kg} kg)` : `+${kg} кг р-ра 10 % NaOH (всего ${naoh10Kg} кг)`)
    : (en ? `+${kg} kg 10% citric acid solution (overshoot rollback)` : `+${kg} кг р-ра 10 % лимонной кислоты (коррекция перелёта)`)
  return {
    step,
    naoh10Kg,
    citric10Kg,
    ...m,
    history: [...prev.history, { step, action, ph: m.ph, viscosityMpas: m.viscosityMpas }],
  }
}

export function evaluatePhBatch(s: PhBatchState): {
  score: number
  phOk: boolean
  viscOk: boolean
  noOvershoot: boolean
  summary: string
} {
  const phOk = s.ph >= 5.7 && s.ph <= 6.3
  const viscOk = s.viscosityMpas >= 18000
  const noOvershoot = s.citric10Kg === 0 && s.history.every((h) => h.ph <= 6.6)
  const pts = (phOk ? 0.5 : s.ph >= 5.4 && s.ph <= 6.7 ? 0.25 : 0) + (viscOk ? 0.3 : s.viscosityMpas >= 14000 ? 0.15 : 0) + (noOvershoot ? 0.2 : 0)
  const score = Number(pts.toFixed(3))
  const en = language === 'en'
  const summary = phOk && viscOk && noOvershoot
    ? (en ? `Exact hit in pH ${s.ph} with no overshoot or salt swings (${s.viscosityMpas} mPa·s).` : `Точное попадание в pH ${s.ph} без перелёта и солевых качелей (${s.viscosityMpas} мПа·с).`)
    : !phOk
      ? (en ? `Final pH ${s.ph} is outside the 5.7–6.3 specification.` : `Итоговый pH ${s.ph} вышел за допуск 5,7–6,3.`)
      : !noOvershoot
        ? (en ? `pH reached ${s.ph}, but overshoot and acid rollback built up excess citrate salt (viscosity ${s.viscosityMpas} mPa·s).` : `pH доведён до ${s.ph}, но из-за перелёта и обратной коррекции кислотой накопились соли (вязкость ${s.viscosityMpas} мПа·с).`)
        : (en ? `pH ${s.ph}, but viscosity ${s.viscosityMpas} mPa·s is below the 18,000 mPa·s target.` : `pH ${s.ph}, но вязкость ${s.viscosityMpas} мПа·с ниже нормы 18 000 мПа·с.`)
  return { score, phOk, viscOk, noOvershoot, summary }
}
