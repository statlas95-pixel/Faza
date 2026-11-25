// Детерминированный движок оценки тренажёра по GMP (ISO 22716):
// разбор маршрутной карты (Batch Record), CCP, отклонений и CAPA.

export interface GmpStep {
  id: string
  time: string
  stage: string
  spec: string
  recorded: string
  signoff: string
  isCcp: boolean
  ccpWhy: string
  hasDeviation: boolean
  deviationType?: 'critical' | 'major' | 'minor'
  deviationWhy: string
}

export interface GmpDisposition {
  id: string
  title: string
  verdict: 'ok' | 'weak' | 'wrong'
  why: string
}

export interface GmpCapaOption {
  id: string
  kind: 'corrective' | 'preventive'
  title: string
  valid: boolean
  why: string
}

export interface GmpLabData {
  batchMeta: {
    batchNo: string
    product: string
    equipment: string
    batchSize: string
    date: string
  }
  steps: GmpStep[]
  dispositions: GmpDisposition[]
  capa: GmpCapaOption[]
}

export interface GmpSubmission {
  ccps: string[]
  deviations: string[]
  disposition?: string
  capa: string[]
}

export interface SetMatchResult {
  score: number
  hits: string[]
  missed: string[]
  extra: string[]
}

export interface GmpEvaluation {
  ccp: SetMatchResult
  deviations: SetMatchResult
  disposition: GmpDisposition | undefined
  dispositionScore: number
  capa: SetMatchResult
  score: number
}

function scoreSet(selected: string[], expected: string[]): SetMatchResult {
  const sel = new Set(selected)
  const exp = new Set(expected)
  const hits = [...exp].filter((id) => sel.has(id))
  const missed = [...exp].filter((id) => !sel.has(id))
  const extra = [...sel].filter((id) => !exp.has(id))
  if (!exp.size) return { score: extra.length ? 0 : 1, hits, missed, extra }
  // Jaccard-подобная оценка: штрафует и пропуски, и лишние отметки.
  const denom = exp.size + extra.length
  const score = Number((hits.length / denom).toFixed(3))
  return { score, hits, missed, extra }
}

/** Оценивает разбор маршрутной карты GMP детерминированно (0..1). */
export function evaluateGmp(data: GmpLabData, sub: GmpSubmission): GmpEvaluation {
  const expectedCcps = data.steps.filter((s) => s.isCcp).map((s) => s.id)
  const expectedDevs = data.steps.filter((s) => s.hasDeviation).map((s) => s.id)
  const expectedCapa = data.capa.filter((c) => c.valid).map((c) => c.id)

  const ccp = scoreSet(sub.ccps, expectedCcps)
  const deviations = scoreSet(sub.deviations, expectedDevs)
  const capa = scoreSet(sub.capa, expectedCapa)
  const disposition = data.dispositions.find((d) => d.id === sub.disposition)
  const dispositionScore = disposition?.verdict === 'ok' ? 1 : disposition?.verdict === 'weak' ? 0.5 : 0

  // Веса: отклонения (35%), CAPA (30%), решение по партии (20%), CCP (15%).
  const score = Number(
    (deviations.score * 0.35 + capa.score * 0.3 + dispositionScore * 0.2 + ccp.score * 0.15).toFixed(3),
  )

  return { ccp, deviations, disposition, dispositionScore, capa, score }
}

/** Строгая валидация структуры GMP-занятия. */
export function validateGmpLab(raw: any): string[] {
  const errs: string[] = []
  if (!raw?.batchMeta?.batchNo || !raw?.batchMeta?.product) errs.push('нужен блок batchMeta (batchNo, product)')
  if (!Array.isArray(raw?.steps) || raw.steps.length < 4) errs.push('нужно не менее 4 этапов steps')
  else {
    const ids = new Set<string>()
    for (const s of raw.steps) {
      if (!s.id || !s.stage || !s.spec || !s.recorded) errs.push(`этап ${s.id ?? '?'}: не хватает обязательных полей`)
      if (ids.has(s.id)) errs.push(`повтор id этапа ${s.id}`)
      ids.add(s.id)
      if (typeof s.isCcp !== 'boolean' || typeof s.hasDeviation !== 'boolean') errs.push(`этап ${s.id}: isCcp и hasDeviation должны быть boolean`)
    }
    if (!raw.steps.some((s: any) => s.isCcp)) errs.push('должна быть хотя бы одна CCP')
    if (!raw.steps.some((s: any) => s.hasDeviation)) errs.push('должно быть хотя бы одно отклонение')
  }
  if (!Array.isArray(raw?.dispositions) || raw.dispositions.filter((d: any) => d.verdict === 'ok').length !== 1) {
    errs.push('в dispositions нужен ровно один вариант с verdict: ok')
  }
  if (!Array.isArray(raw?.capa) || raw.capa.filter((c: any) => c.valid).length < 2) {
    errs.push('в capa нужно не менее двух валидных мер')
  }
  return errs
}
