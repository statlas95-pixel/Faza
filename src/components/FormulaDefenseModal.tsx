import { useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import type { FormulaEvaluation, FormulaInput, Ingredient } from '../../shared/formulation'
import { generateFormulaDefense } from '../../shared/formula-defense'

export function FormulaDefenseModal({
  formula,
  evaluation,
  catalog,
  onClose,
  onAskAi,
}: {
  formula: FormulaInput
  evaluation: FormulaEvaluation
  catalog: Ingredient[]
  onClose: () => void
  onAskAi?: () => void
}) {
  const questions = useMemo(() => generateFormulaDefense(formula, evaluation, catalog), [formula, evaluation, catalog])
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const answeredCount = Object.keys(answers).length
  const correctCount = questions.filter((q) => {
    const picked = answers[q.id]
    return q.options.some((o) => o.id === picked && o.correct)
  }).length
  const done = answeredCount === questions.length && questions.length > 0
  const scorePct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={tr('QA-защита рецептуры')} onClick={onClose}>
      <div className="panel modal-card defense-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sandbox-head-row">
          <div>
            <span className="grade-badge">🛡 {tr('Сократовский QA-аудит')}</span>
            <h2 style={{ margin: '6px 0 0' }}>{tr('Защита вашей рецептуры перед запуском')}</h2>
          </div>
          <button type="button" className="btn small ghost" onClick={onClose} aria-label={tr('Закрыть')}>×</button>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          {tr('Ответьте на 3 инженерных вопроса QA-аудитора, сформированных именно по вашему текущему составу, pH и фазам.')}
        </p>

        <div className="defense-list">
          {questions.map((q, idx) => {
            const picked = answers[q.id]
            const pickedOpt = q.options.find((o) => o.id === picked)
            return (
              <div key={q.id} className="defense-q">
                <div className="small muted" style={{ fontWeight: 600 }}>
                  {idx + 1}. {q.category}
                </div>
                <p style={{ margin: '4px 0 10px', fontWeight: 600 }}>{q.prompt}</p>
                <div className="defense-opts">
                  {q.options.map((o) => {
                    const isPicked = picked === o.id
                    const cls = !picked
                      ? 'defense-opt'
                      : o.correct
                        ? 'defense-opt ok'
                        : isPicked
                          ? 'defense-opt bad'
                          : 'defense-opt muted'
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={cls}
                        disabled={Boolean(picked)}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      >
                        {o.text}
                      </button>
                    )
                  })}
                </div>
                {pickedOpt && (
                  <p className={`small defense-why ${pickedOpt.correct ? 'ok' : 'bad'}`}>
                    {pickedOpt.correct ? '✓ ' : '✕ '}
                    {pickedOpt.why}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {done && (
          <div className={`defense-verdict ${scorePct >= 67 ? 'ok' : 'warn'}`}>
            <div>
              <b>
                {tr('Результат QA-защиты:')} {correctCount} / {questions.length} ({scorePct} %)
              </b>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {scorePct === 100
                  ? tr('Отличная защита: вы аргументированно закрыли технологические, микробиологические и регуляторные риски.')
                  : scorePct >= 67
                    ? tr('Хорошая база, но один инженерный узел стоит перепроверить до пилотной варки.')
                    : tr('Рекомендуется разобрать пояснения и скорректировать рецептуру перед защитой.')}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {onAskAi && (
                <button type="button" className="btn small ghost" onClick={() => { onClose(); onAskAi() }}>
                  ✦ {tr('Углублённый разбор с ИИ')}
                </button>
              )}
              <button type="button" className="btn small primary" onClick={onClose}>
                {tr('Вернуться к рецептуре')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
