// Детерминированные движки оценки для 3 новых предметных тренажёров:
// 1) «Разбор смены» с графиком приборных трендов (T, ток привода, вакуум)
// 2) Входной контроль сырья по сертификатам анализа (CoA / TDS)
// 3) Аудит косметической этикетки, порядка INCI и клеймов (EU 1223/2009 · ТР ТС 009/2011)

// ===== 1. Разбор смены (Shift Trend) =====

export interface TrendPoint {
  min: number
  tempC: number
  currentA: number
  vacuumBar: number
  note?: string
}

export interface TrendOption {
  id: string
  title: string
  verdict: 'ok' | 'weak' | 'wrong'
  why: string
}

export interface ShiftTrendLabData {
  equipment: string
  batchInfo: string
  points: TrendPoint[]
  anomalyMin: number
  anomalyToleranceMin: number
  anomalyWhy: string
  causes: TrendOption[]
  actions: TrendOption[]
}

export interface ShiftTrendSubmission {
  selectedMin?: number
  causeId?: string
  actionId?: string
}

export function evaluateShiftTrend(data: ShiftTrendLabData, sub: ShiftTrendSubmission) {
  const timeDiff = sub.selectedMin !== undefined ? Math.abs(sub.selectedMin - data.anomalyMin) : Infinity
  const timeVerdict: 'ok' | 'weak' | 'wrong' =
    timeDiff <= data.anomalyToleranceMin ? 'ok' : timeDiff <= data.anomalyToleranceMin * 2 ? 'weak' : 'wrong'
  const timeScore = timeVerdict === 'ok' ? 1 : timeVerdict === 'weak' ? 0.5 : 0

  const cause = data.causes.find((c) => c.id === sub.causeId)
  const causeScore = cause?.verdict === 'ok' ? 1 : cause?.verdict === 'weak' ? 0.5 : 0

  const action = data.actions.find((a) => a.id === sub.actionId)
  const actionScore = action?.verdict === 'ok' ? 1 : action?.verdict === 'weak' ? 0.5 : 0

  const score = Number((timeScore * 0.4 + causeScore * 0.35 + actionScore * 0.25).toFixed(3))
  return { timeVerdict, timeScore, cause, causeScore, action, actionScore, score }
}

// ===== 2. Входной контроль CoA =====

export type CoaDecision = 'approve' | 'quarantine' | 'reject'

export interface CoaParamRow {
  param: string
  spec: string
  result: string
  outOfSpec?: boolean
}

export interface CoaLot {
  id: string
  material: string
  inci: string
  supplier: string
  lotNo: string
  retestDate: string
  signoff: string
  rows: CoaParamRow[]
  expected: CoaDecision
  why: string
}

export interface CoaLabData {
  checkDate: string
  lots: CoaLot[]
}

export function evaluateCoaAudit(data: CoaLabData, decisions: Record<string, CoaDecision | undefined>) {
  const items = data.lots.map((lot) => {
    const picked = decisions[lot.id]
    const exact = picked === lot.expected
    // Частичный балл: если вместо reject выбран quarantine (партия хотя бы не пошла в производство)
    const partial = !exact && lot.expected === 'reject' && picked === 'quarantine'
    const itemScore = exact ? 1 : partial ? 0.5 : 0
    return { lot, picked, verdict: (exact ? 'ok' : partial ? 'weak' : 'wrong') as 'ok' | 'weak' | 'wrong', itemScore }
  })
  const score = items.length ? Number((items.reduce((s, i) => s + i.itemScore, 0) / items.length).toFixed(3)) : 0
  return { items, score }
}

// ===== 3. Аудит этикетки и клеймов =====

export interface LabelCheckItem {
  id: string
  section: 'front' | 'inci' | 'claims' | 'mandatory'
  snippet: string
  hasViolation: boolean
  standard: string
  why: string
}

export interface LabelAuditLabData {
  productTitle: string
  formulaNote: string
  items: LabelCheckItem[]
}

export function evaluateLabelAudit(data: LabelAuditLabData, flaggedIds: string[]) {
  const sel = new Set(flaggedIds)
  const expected = new Set(data.items.filter((i) => i.hasViolation).map((i) => i.id))
  const hits = [...expected].filter((id) => sel.has(id))
  const missed = [...expected].filter((id) => !sel.has(id))
  const extra = [...sel].filter((id) => !expected.has(id))
  const score = expected.size ? Number((hits.length / (expected.size + extra.length)).toFixed(3)) : 1
  return { hits, missed, extra, score }
}
