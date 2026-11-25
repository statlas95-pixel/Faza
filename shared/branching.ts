// Детерминированный движок ветвящихся технологических симуляций
// (масштабирование 500 г -> реактор, устранение брака, порядок загрузки, охлаждение).

export type BranchVerdict = 'ok' | 'weak' | 'wrong'

export interface BranchReading {
  label: string
  value: string
}

export interface BranchChoice {
  id: string
  label: string
  verdict: BranchVerdict
  consequence: string
  next: string
}

export interface BranchOutcome {
  verdict: BranchVerdict
  score: number
  title: string
  summary: string
  lesson: string
}

export interface BranchNode {
  id: string
  title: string
  scene: string
  readings?: BranchReading[]
  choices?: BranchChoice[]
  outcome?: BranchOutcome
}

export interface BranchingLabData {
  start: string
  nodes: BranchNode[]
}

export interface BranchHistoryItem {
  nodeId: string
  choiceId: string
}

export interface BranchPathEvaluation {
  finished: boolean
  terminalNode?: BranchNode
  steps: {
    node: BranchNode
    choice: BranchChoice
  }[]
  score: number
  verdict: BranchVerdict
}

/** Оценивает пройденный маршрут по ветвящемуся дереву решений (детерминированно, 0..1). */
export function evaluateBranchPath(data: BranchingLabData, history: BranchHistoryItem[]): BranchPathEvaluation {
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const steps: { node: BranchNode; choice: BranchChoice }[] = []
  let current = byId.get(data.start)

  for (const h of history) {
    if (!current || current.id !== h.nodeId) break
    const choice = (current.choices ?? []).find((c) => c.id === h.choiceId)
    if (!choice) break
    steps.push({ node: current, choice })
    current = byId.get(choice.next)
  }

  if (current?.outcome) {
    const choiceBonus = steps.length
      ? steps.reduce((acc, s) => acc + (s.choice.verdict === 'ok' ? 1 : s.choice.verdict === 'weak' ? 0.5 : 0), 0) / steps.length
      : 0
    // 70% итоговый исход партии + 30% качество промежуточных шагов
    const combined = Number((current.outcome.score * 0.7 + choiceBonus * 0.3).toFixed(3))
    return {
      finished: true,
      terminalNode: current,
      steps,
      score: Math.max(0, Math.min(1, combined)),
      verdict: current.outcome.verdict,
    }
  }

  return { finished: false, steps, score: 0, verdict: 'wrong' }
}

/** Строгая валидация графа ветвящегося сценария (отсутствие битых ссылок и бесконечных циклов). */
export function validateBranchingLab(raw: any): string[] {
  const errs: string[] = []
  if (!raw || typeof raw.start !== 'string' || !Array.isArray(raw.nodes) || raw.nodes.length < 3) {
    return ['нужны поля start и список nodes (не менее 3 узлов)']
  }
  const byId = new Map<string, BranchNode>()
  for (const n of raw.nodes as BranchNode[]) {
    if (!n.id || !n.title || !n.scene) errs.push(`узел ${n.id ?? '?'}: нужны id, title и scene`)
    if (byId.has(n.id)) errs.push(`повтор id узла ${n.id}`)
    byId.set(n.id, n)
  }
  if (!byId.has(raw.start)) errs.push(`стартовый узел ${raw.start} не найден`)

  let hasOkEnding = false
  let hasFailEnding = false
  for (const n of raw.nodes as BranchNode[]) {
    const hasChoices = Array.isArray(n.choices) && n.choices.length > 0
    const hasOutcome = Boolean(n.outcome)
    if (hasChoices === hasOutcome) errs.push(`узел ${n.id}: должен иметь либо choices, либо outcome`)
    if (hasChoices) {
      for (const c of n.choices!) {
        if (!c.id || !c.label || !c.consequence) errs.push(`узел ${n.id}: у варианта ${c.id ?? '?'} не хватает полей`)
        if (!['ok', 'weak', 'wrong'].includes(c.verdict)) errs.push(`узел ${n.id}/${c.id}: некорректный verdict`)
        if (!byId.has(c.next)) errs.push(`узел ${n.id}/${c.id}: ссылка next на несуществующий узел ${c.next}`)
      }
    }
    if (hasOutcome) {
      if (!Number.isFinite(n.outcome!.score) || n.outcome!.score < 0 || n.outcome!.score > 1) {
        errs.push(`узел ${n.id}: outcome.score должен быть в диапазоне 0..1`)
      }
      if (n.outcome!.score >= 0.85) hasOkEnding = true
      if (n.outcome!.score <= 0.4) hasFailEnding = true
    }
  }
  if (!hasOkEnding) errs.push('в сценарии должен быть хотя бы один успешный финал (score ≥ 0.85)')
  if (!hasFailEnding) errs.push('в сценарии должен быть хотя бы один неудачный финал (score ≤ 0.4)')

  // Проверка достижимости терминала и отсутствия циклов (DFS)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const dfs = (id: string) => {
    if (visiting.has(id)) { errs.push(`обнаружен цикл через узел ${id}`); return }
    if (visited.has(id)) return
    visiting.add(id)
    const node = byId.get(id)
    for (const c of node?.choices ?? []) if (byId.has(c.next)) dfs(c.next)
    visiting.delete(id)
    visited.add(id)
  }
  if (byId.has(raw.start)) dfs(raw.start)

  return errs
}
