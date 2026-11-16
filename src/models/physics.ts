// Расчётные модели занятий и виджетов. Все функции чистые, в единицах СИ, если не указано иное.
// Тесты — в tests/models.test.ts. Предпосылки моделей описаны в текстах тем и занятий.

export const G = 9.81

/** Закон Стокса: скорость одиночной сферы, м/с. d — м, dRho — кг/м³, eta — Па·с. */
export function stokesVelocity(dRho: number, d: number, eta: number, g = G) {
  return (dRho * g * d * d) / (18 * eta)
}

/** Логарифмическая интерполяция по таблице [x, y], y > 0. */
export function logInterp(table: [number, number][], x: number) {
  if (x <= table[0][0]) return table[0][1]
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1], [x1, y1] = table[i]
    if (x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)))
    }
  }
  return table[table.length - 1][1]
}

/** Модель Кросса: вязкость, Па·с. lambda подбирается так, чтобы η(1000 с⁻¹) = eta1000. */
export function crossViscosity(eta0: number, eta1000: number, rate: number, m = 0.8, etaInf = 0.001) {
  if (eta0 <= eta1000) return eta0
  // (λ·1000)^m = (η0 − η∞)/(η1000 − η∞) − 1
  const ratio = (eta0 - etaInf) / Math.max(eta1000 - etaInf, 1e-9) - 1
  const lambda = Math.pow(Math.max(ratio, 1e-9), 1 / m) / 1000
  return etaInf + (eta0 - etaInf) / (1 + Math.pow(lambda * rate, m))
}

export interface BenchModel {
  column_mm: number; visible_mm: number; target_days: number; eta1000_max: number
  rz: number; rcf: number; centrifuge_min: number
  xanthan: { c: number; eta0: number; eta1000: number }[]
}
export interface BenchInput { dRho: number; d_um: number; c: number; phi: number }
export interface BenchResult {
  eta0: number; eta1000_mPas: number; v_mm_day: number; days: number
  centrifuge_mm: number; centrifuge_naive_mm: number; sprayOk: boolean; stableOk: boolean
}
/** Стенд стабильности: время до видимого слоя и центрифужный тест. */
export function benchRun(m: BenchModel, i: BenchInput): BenchResult {
  const eta0 = logInterp(m.xanthan.map((r) => [r.c, r.eta0]), i.c)
  const eta1000 = logInterp(m.xanthan.map((r) => [r.c, r.eta1000]), i.c) / 1000 // Па·с
  const d = i.d_um * 1e-6
  const hind = Math.pow(1 - i.phi, m.rz)
  const v = stokesVelocity(Math.abs(i.dRho), d, eta0) * hind // м/с
  const v_mm_day = v * 1000 * 86400
  const days = m.visible_mm / v_mm_day
  // центрифуга: вязкость зависит от скорости сдвига вокруг капли, γ̇ ≈ v/d; решаем итерацией
  let vc = v * m.rcf
  for (let k = 0; k < 60; k++) {
    const eta = crossViscosity(eta0, eta1000, vc / d)
    const next = stokesVelocity(Math.abs(i.dRho), d, eta, G * m.rcf) * hind
    vc = 0.5 * vc + 0.5 * next
  }
  const t = m.centrifuge_min * 60
  return {
    eta0, eta1000_mPas: eta1000 * 1000, v_mm_day, days,
    centrifuge_mm: Math.min(vc * t * 1000, m.column_mm),
    centrifuge_naive_mm: Math.min(v * m.rcf * t * 1000, m.column_mm),
    sprayOk: eta1000 * 1000 <= m.eta1000_max, stableOk: days >= m.target_days,
  }
}

// ---------- Масштабирование ----------
export interface ScaleParams {
  lab: { D: number; rpm: number; Q_lpm: number; V_l: number; time_min: number; d32: number; cool_min: number }
  plant: { D: number; rpm_max: number; Q_lpm_ref: number; rpm_ref: number; P_kw_max: number; V_l: number; m: number; cp: number; U: number; A: number; T0: number; T1: number }
}
export const tipSpeed = (D: number, rpm: number) => Math.PI * D * (rpm / 60)
export function rpmForCriterion(p: ScaleParams, crit: 'rpm' | 'tip' | 'weber' | 'eps') {
  const r = p.lab.D / p.plant.D
  const exp = { rpm: 0, tip: 1, weber: 1.5, eps: 2 / 3 }[crit]
  return p.lab.rpm * Math.pow(r, exp)
}
/** Учебная модель: d32 ∝ ε^-0.4, ε ∝ N³D². */
export function d32AtPlant(p: ScaleParams, rpm: number) {
  const eps = Math.pow(rpm / p.lab.rpm, 3) * Math.pow(p.plant.D / p.lab.D, 2)
  return p.lab.d32 * Math.pow(eps, -0.4)
}
/** Альтернативная корреляция: d32 ∝ u^-1.2 (только окружная скорость). */
export function d32ByTip(p: ScaleParams, rpm: number) {
  return p.lab.d32 * Math.pow(tipSpeed(p.plant.D, rpm) / tipSpeed(p.lab.D, p.lab.rpm), -1.2)
}
export const labPasses = (p: ScaleParams) => (p.lab.Q_lpm * p.lab.time_min) / p.lab.V_l
export function plantPasses(p: ScaleParams, rpm: number, minutes: number) {
  const Q = p.plant.Q_lpm_ref * (rpm / p.plant.rpm_ref)
  return (Q * minutes) / p.plant.V_l
}
export const unprocessed = (n: number) => Math.exp(-n)
export function homogHeat(p: ScaleParams, rpm: number, minutes: number) {
  const P = p.plant.P_kw_max * 1000 * Math.pow(rpm / p.plant.rpm_max, 3) // Вт
  return (P * minutes * 60) / (p.plant.m * p.plant.cp) // К
}
/** Время охлаждения через рубашку, мин. */
export function coolingMinutes(m: number, cp: number, U: number, A: number, T0: number, T1: number, Tc: number) {
  return ((m * cp) / (U * A)) * Math.log((T0 - Tc) / (T1 - Tc)) / 60
}

// ---------- Реология ----------
export interface HB { sy: number; K: number; n: number }
export const hbStress = (s: HB, rate: number) => s.sy + s.K * Math.pow(rate, s.n)
export const hbViscosity = (s: HB, rate: number) => hbStress(s, rate) / rate
export const pipeWallRate = (Q: number, R: number) => (4 * Q) / (Math.PI * R * R * R)
export const filmStress = (rho: number, h: number) => rho * G * h
/** Восстановление структуры после сдвига: доля исходной вязкости через t секунд. */
export const recovery = (floor: number, tau: number, t: number) => 1 - (1 - floor) * Math.exp(-t / tau)

// ---------- Солевая кривая ПАВ-системы ----------
export interface SaltCurve { etaMax: number; sPeak: number; k: number }
/** Учебная модель солевой кривой: колокол в координатах ln(η) — общая соль, %. Вязкость в мПа·с. */
export const saltViscosity = (c: SaltCurve, sTotal: number) => c.etaMax * Math.exp(-c.k * (sTotal - c.sPeak) ** 2)
/** Соль в партии после разбавления несолёной основой: доля добавки f от массы партии. */
export const dilutedSalt = (s: number, f: number) => s / (1 + f)
/** Детерминированный «шум измерения»: одинаков при повторном открытии занятия. */
export function seededNoise(seed: number) {
  let x = Math.sin(seed * 12.9898) * 43758.5453
  x = x - Math.floor(x)
  let y = Math.sin((seed + 0.5) * 78.233) * 12543.123
  y = y - Math.floor(y)
  return Math.sqrt(-2 * Math.log(Math.max(x, 1e-9))) * Math.cos(2 * Math.PI * y) // ~N(0,1)
}

// ---------- Планирование эксперимента ----------
export interface DoeModel { b0: number; a: number; b: number; c: number; ab: number; sigma: number }
export interface DoeRun { A: number; B: number; C: number; y: number }
export const doeTrue = (m: DoeModel, A: number, B: number, C: number) => m.b0 + m.a * A + m.b * B + m.c * C + m.ab * A * B
export const doeMeasure = (m: DoeModel, A: number, B: number, C: number, seed: number) => Math.round((doeTrue(m, A, B, C) + m.sigma * seededNoise(seed)) * 10) / 10
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const cellKey = (r: { A: number; B: number; C: number }) => `${r.A},${r.B},${r.C}`
/** Средние по ячейкам плана и объединённая оценка стандартного отклонения по повторам. */
export function doeCells(runs: DoeRun[]) {
  const cells = new Map<string, number[]>()
  for (const r of runs) cells.set(cellKey(r), [...(cells.get(cellKey(r)) ?? []), r.y])
  let ss = 0, df = 0
  for (const ys of cells.values()) if (ys.length > 1) { const m = mean(ys); ss += ys.reduce((a, y) => a + (y - m) ** 2, 0); df += ys.length - 1 }
  return { cells, df, sd: df > 0 ? Math.sqrt(ss / df) : undefined }
}
export interface Effect { estimable: boolean; value?: number; pairs: number; se?: number }
/** Главный эффект фактора: среднее разностей (верхний − нижний) по парам ячеек, различающихся только этим фактором. */
export function doeMainEffect(runs: DoeRun[], f: 'A' | 'B' | 'C'): Effect {
  const { cells, sd } = doeCells(runs)
  const diffs: number[] = []; let invN = 0
  for (const [k, hi] of cells) {
    const [A, B, C] = k.split(',').map(Number), lv = { A, B, C }
    if (lv[f] !== 1) continue
    const lo = cells.get(cellKey({ ...lv, [f]: -1 } as any)); if (!lo) continue
    diffs.push(mean(hi) - mean(lo)); invN += 1 / hi.length + 1 / lo.length
  }
  if (!diffs.length) return { estimable: false, pairs: 0 }
  return { estimable: true, value: mean(diffs), pairs: diffs.length, se: sd !== undefined ? (sd * Math.sqrt(invN)) / diffs.length : undefined }
}
/** Взаимодействие AB: половина разницы эффектов A при B+ и B− (при одном и том же уровне C). */
export function doeInteraction(runs: DoeRun[]): Effect {
  const { cells, sd } = doeCells(runs)
  const vals: number[] = []; let invN = 0
  for (const C of [-1, 1]) {
    const g = (A: number, B: number) => cells.get(cellKey({ A, B, C }))
    const pp = g(1, 1), mp = g(-1, 1), pm = g(1, -1), mm = g(-1, -1)
    if (!pp || !mp || !pm || !mm) continue
    vals.push(((mean(pp) - mean(mp)) - (mean(pm) - mean(mm))) / 2); invN += (1 / pp.length + 1 / mp.length + 1 / pm.length + 1 / mm.length) / 4
  }
  if (!vals.length) return { estimable: false, pairs: 0 }
  return { estimable: true, value: mean(vals), pairs: vals.length, se: sd !== undefined ? (sd * Math.sqrt(invN)) / vals.length : undefined }
}
/** Двусторонний 95 %-й квантиль Стьюдента: при малом числе повторов интервал заметно шире «двух сигм». */
export const tCrit = (df: number) => [Infinity, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26][df] ?? 2.2
