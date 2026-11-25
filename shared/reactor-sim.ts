// Детерминированные модели для иммерсивных тренажёров Спринта 3:
// 1) «Пульт вакуумного реактора в реальном времени» (500 кг крем O/W)
// 2) «Реверс-инжиниринг этикетки INCI»

export type JacketMode = 'heat' | 'off' | 'cool'

export interface ReactorControls {
  jacket: JacketMode
  anchorOn: boolean
  homogenizerOn: boolean
  vacuumOn: boolean
}

export interface ReactorState {
  minute: number
  tempC: number
  vacuumBar: number // 0 .. -0.7
  airPct: number // 0 .. 35 (%)
  dropletUm: number // 2 .. 32 (мкм)
  activeIntegrityPct: number // 0 .. 100 (%)
  structurePct: number // 0 .. 100 (%) — сохранность ламеллярной сетки
  phaseBAdded: boolean
  phaseBAddTempC?: number
  phaseCAdded: boolean
  phaseCAddTempC?: number
  wallFouling: boolean
  events: string[]
}

export function initialReactorState(): ReactorState {
  return {
    minute: 0,
    tempC: 24,
    vacuumBar: 0,
    airPct: 1.5,
    dropletUm: 30,
    activeIntegrityPct: 100,
    structurePct: 100,
    phaseBAdded: false,
    phaseCAdded: false,
    wallFouling: false,
    events: ['0 мин: В реактор загружена водная фаза A (370 кг, 24 °C). Масляная фаза B (95 кг) ждёт в плавильнике при 75 °C.'],
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Number(v.toFixed(1))

/** Продвигает физическую модель вакуумного реактора на dtMin минут. */
export function stepReactor(prev: ReactorState, ctl: ReactorControls, dtMin = 2): ReactorState {
  const next: ReactorState = { ...prev, events: [...prev.events] }
  next.minute += dtMin

  // 1. Вакуумный насос
  const targetVac = ctl.vacuumOn ? -0.65 : 0
  next.vacuumBar = r1(next.vacuumBar + (targetVac - next.vacuumBar) * Math.min(1, dtMin * 0.45))

  // 2. Теплообмен через рубашку (якорь со скребками ускоряет теплообмен в ~2.6 раза!)
  let fouling = false
  if (ctl.jacket === 'heat') {
    const rate = ctl.anchorOn ? 3.8 : 1.5
    next.tempC = r1(Math.min(82, next.tempC + rate * dtMin))
  } else if (ctl.jacket === 'cool') {
    if (!ctl.anchorOn && next.phaseBAdded && next.tempC < 58) {
      fouling = true
      if (!prev.wallFouling) {
        next.events.push(`${next.minute} мин: ⚠ Охлаждение без якорной мешалки — крем прилипает к холодной стенке, теплообмен резко упал!`)
      }
    }
    const rate = ctl.anchorOn ? 2.6 : 0.7
    next.tempC = r1(Math.max(22, next.tempC - rate * dtMin))
  } else {
    // естественное остывание
    next.tempC = r1(Math.max(22, next.tempC - 0.15 * dtMin))
  }
  next.wallFouling = fouling

  // 3. Ротор-статор: дробление капель, нагрев от сдвига, завоздушивание без вакуума и риск разрушения сетки при холоде
  if (ctl.homogenizerOn) {
    next.tempC = r1(Math.min(84, next.tempC + 0.35 * dtMin))
    if (next.phaseBAdded) {
      if (next.tempC >= 64) {
        next.dropletUm = r1(Math.max(2.2, next.dropletUm - 5.2 * dtMin))
      } else if (next.tempC >= 48) {
        next.dropletUm = r1(Math.max(3.5, next.dropletUm - 2.4 * dtMin))
      } else {
        // Высокий сдвиг ниже температуры кристаллизации жирных спиртов разрушает ламеллярную сетку!
        next.structurePct = r1(Math.max(35, next.structurePct - 14 * dtMin))
        if (prev.structurePct > 85) {
          next.events.push(`${next.minute} мин: ⚠ Гомогенизатор при ${next.tempC} °C разрушает уже сформированную ламеллярную сетку (потеря вязкости)!`)
        }
      }
    }
    if (next.vacuumBar > -0.35) {
      next.airPct = r1(Math.min(32, next.airPct + 4.8 * dtMin))
      if (prev.airPct < 6 && next.airPct >= 6) {
        next.events.push(`${next.minute} мин: ⚠ Гомогенизатор без вакуума затягивает воздух в массу (воздух ${next.airPct} %)!`)
      }
    } else {
      // под вакуумом воздух постепенно уходит
      next.airPct = r1(Math.max(0.8, next.airPct - 1.2 * dtMin))
    }
  } else if (next.vacuumBar <= -0.45 && ctl.anchorOn) {
    // деаэрация при медленном перемешивании под вакуумом
    next.airPct = r1(Math.max(0.8, next.airPct - 1.8 * dtMin))
  }

  // 4. Термическая деградация активов фазы C, если масса перегрета после ввода
  if (next.phaseCAdded && next.tempC > 42) {
    const loss = (next.tempC - 40) * 1.1 * dtMin
    next.activeIntegrityPct = r1(clamp(next.activeIntegrityPct - loss, 15, 100))
  }

  return next
}

/** Загрузка масляной фазы B (75 °C) в реактор. */
export function addPhaseB(prev: ReactorState): ReactorState {
  if (prev.phaseBAdded) return prev
  const events = [...prev.events]
  let droplet = 26
  let structure = prev.structurePct
  if (prev.tempC < 70) {
    droplet = 32
    structure = Math.min(structure, 72)
    events.push(`${prev.minute} мин: ⚠ Фаза B (75 °C) загружена в недогретую водную фазу (${prev.tempC} °C < 70 °C) — шоковая кристаллизация восков!`)
  } else {
    events.push(`${prev.minute} мин: ✓ Фаза B загружена при ${prev.tempC} °C (перепад температур в норме). Можно эмульгировать под вакуумом.`)
  }
  return {
    ...prev,
    phaseBAdded: true,
    phaseBAddTempC: prev.tempC,
    dropletUm: droplet,
    structurePct: structure,
    events,
  }
}

/** Загрузка термолабильной фазы C (активы, консервант, отдушка). */
export function addPhaseC(prev: ReactorState): ReactorState {
  if (prev.phaseCAdded) return prev
  const events = [...prev.events]
  let integrity = prev.activeIntegrityPct
  if (prev.tempC > 42) {
    const drop = Math.min(55, (prev.tempC - 40) * 2.2)
    integrity = r1(Math.max(25, integrity - drop))
    events.push(`${prev.minute} мин: ⚠ Фаза C введена в горячую массу (${prev.tempC} °C > 40 °C) — термическая деградация активов и испарение отдушки!`)
  } else {
    events.push(`${prev.minute} мин: ✓ Фаза C аккуратно введена при ${prev.tempC} °C (≤ 40 °C).`)
  }
  return {
    ...prev,
    phaseCAdded: true,
    phaseCAddTempC: prev.tempC,
    activeIntegrityPct: integrity,
    events,
  }
}

export interface ReactorCriterion {
  id: string
  title: string
  verdict: 'ok' | 'weak' | 'wrong'
  detail: string
}

export function evaluateReactorRun(s: ReactorState): { score: number; criteria: ReactorCriterion[] } {
  const criteria: ReactorCriterion[] = []

  // 1. Ввод фазы B при 70–80 °C
  if (!s.phaseBAdded) {
    criteria.push({ id: 'phaseB', title: 'Загрузка масляной фазы B', verdict: 'wrong', detail: 'Масляная фаза B так и не была загружена в реактор.' })
  } else if ((s.phaseBAddTempC ?? 0) >= 70 && (s.phaseBAddTempC ?? 0) <= 82) {
    criteria.push({ id: 'phaseB', title: 'Загрузка масляной фазы B', verdict: 'ok', detail: `Загружена при ${s.phaseBAddTempC} °C — без температурного шока восков.` })
  } else {
    criteria.push({ id: 'phaseB', title: 'Загрузка масляной фазы B', verdict: 'wrong', detail: `Загружена при ${s.phaseBAddTempC} °C (норма 72–78 °C): образовались твёрдые крупинки.` })
  }

  // 2. Дисперсность (размер капель)
  if (s.dropletUm <= 4.0) {
    criteria.push({ id: 'droplet', title: 'Дисперсность эмульсии', verdict: 'ok', detail: `Средний размер капель ${s.dropletUm} мкм — тонкая стабильная эмульсия.` })
  } else if (s.dropletUm <= 10.0) {
    criteria.push({ id: 'droplet', title: 'Дисперсность эмульсии', verdict: 'weak', detail: `Капли ${s.dropletUm} мкм — гомогенизация была слишком короткой, риск сливок.` })
  } else {
    criteria.push({ id: 'droplet', title: 'Дисперсность эмульсии', verdict: 'wrong', detail: `Капли ${s.dropletUm} мкм — грубая эмульсия, быстрое расслоение.` })
  }

  // 3. Деаэрация (воздух в креме)
  if (s.airPct <= 3.0) {
    criteria.push({ id: 'air', title: 'Вакуумирование и воздух', verdict: 'ok', detail: `Остаточный воздух ${s.airPct} % — плотность и объём в тубе в норме.` })
  } else if (s.airPct <= 7.0) {
    criteria.push({ id: 'air', title: 'Вакуумирование и воздух', verdict: 'weak', detail: `Воздух ${s.airPct} % — заметная микропена, нужно дольше держать вакуум −0,6 бар.` })
  } else {
    criteria.push({ id: 'air', title: 'Вакуумирование и воздух', verdict: 'wrong', detail: `Воздух ${s.airPct} % — критическое завоздушивание (гомогенизатор работал без вакуума).` })
  }

  // 4. Сохранность активов фазы C
  if (!s.phaseCAdded) {
    criteria.push({ id: 'phaseC', title: 'Ввод термолабильной фазы C', verdict: 'wrong', detail: 'Фаза C (активы и консервант) не загружена — партия без консерванта.' })
  } else if (s.activeIntegrityPct >= 95) {
    criteria.push({ id: 'phaseC', title: 'Ввод термолабильной фазы C', verdict: 'ok', detail: `Введена при ${s.phaseCAddTempC} °C, сохранность активов ${s.activeIntegrityPct} %.` })
  } else if (s.activeIntegrityPct >= 75) {
    criteria.push({ id: 'phaseC', title: 'Ввод термолабильной фазы C', verdict: 'weak', detail: `Введена при ${s.phaseCAddTempC} °C — частичная потеря активов (${s.activeIntegrityPct} %).` })
  } else {
    criteria.push({ id: 'phaseC', title: 'Ввод термолабильной фазы C', verdict: 'wrong', detail: `Перегрев при вводе (${s.phaseCAddTempC} °C) — сохранность упала до ${s.activeIntegrityPct} %.` })
  }

  // 5. Сохранность структуры и финальное охлаждение
  if (s.structurePct >= 90 && s.tempC <= 35) {
    criteria.push({ id: 'struct', title: 'Охлаждение и ламеллярная сетка', verdict: 'ok', detail: `Выгрузка при ${s.tempC} °C, целостность сетки ${s.structurePct} %.` })
  } else if (s.structurePct >= 75 && s.tempC <= 42) {
    criteria.push({ id: 'struct', title: 'Охлаждение и ламеллярная сетка', verdict: 'weak', detail: `Выгрузка при ${s.tempC} °C, сетка ${s.structurePct} % — масса не доохлаждена или был лишний сдвиг.` })
  } else {
    criteria.push({ id: 'struct', title: 'Охлаждение и ламеллярная сетка', verdict: 'wrong', detail: `Температура выгрузки ${s.tempC} °C, сетка ${s.structurePct} % — потеря вязкости от холодного сдвига или горячей выгрузки.` })
  }

  const pts = criteria.reduce((sum, c) => sum + (c.verdict === 'ok' ? 1 : c.verdict === 'weak' ? 0.5 : 0), 0)
  return { score: Number((pts / criteria.length).toFixed(3)), criteria }
}

// ===== Модель тренажёра «Реверс-инжиниринг INCI» =====

export interface ReverseInciItem {
  inci: string
  roleHint?: string
  phaseExpected?: 'A' | 'B' | 'C'
  explain?: string
}

export interface ReverseInciQuestion {
  id: string
  prompt: string
  options: { id: string; text: string; correct?: boolean; why: string }[]
}

export interface ReverseInciLabData {
  id: string
  productName: string
  claims: string
  inciList: ReverseInciItem[]
  onePercentMarker: string
  onePercentWhy: string
  phaseTargets: { inci: string; expected: 'A' | 'B' | 'C'; why: string }[]
  questions: ReverseInciQuestion[]
}

export function evaluateReverseInci(
  data: ReverseInciLabData,
  ans: { marker?: string; phases: Record<string, 'A' | 'B' | 'C'>; qAnswers: Record<string, string> },
) {
  const markerOk = ans.marker === data.onePercentMarker
  const phaseResults = data.phaseTargets.map((t) => ({
    ...t,
    chosen: ans.phases[t.inci],
    ok: ans.phases[t.inci] === t.expected,
  }))
  const qResults = data.questions.map((q) => {
    const opt = q.options.find((o) => o.id === ans.qAnswers[q.id])
    return { q, opt, ok: !!opt?.correct }
  })

  const total = 1 + phaseResults.length + qResults.length
  const passed =
    (markerOk ? 1 : 0) +
    phaseResults.filter((r) => r.ok).length +
    qResults.filter((r) => r.ok).length

  return {
    markerOk,
    phaseResults,
    qResults,
    score: Number((passed / total).toFixed(3)),
  }
}
