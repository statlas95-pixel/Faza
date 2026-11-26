import { useEffect, useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateGradeExam, getExamQuestionsForGrade } from '../../shared/grade-exam'
import { certifyGrade } from '../store'

interface Props {
  level: number
  gradeTitle: string
  gradeBadge: string
  onClose: () => void
  onCertified?: (score: number) => void
}

const EXAM_SECONDS = 15 * 60

export function GradeExamModal({ level, gradeTitle, gradeBadge, onClose, onCertified }: Props) {
  const questions = useMemo(() => getExamQuestionsForGrade(level), [level])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (submitted) return
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          setSubmitted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [submitted])

  const result = useMemo(
    () => (submitted ? evaluateGradeExam(questions, answers) : null),
    [submitted, questions, answers],
  )

  function handleSubmit() {
    const res = evaluateGradeExam(questions, answers)
    setSubmitted(true)
    if (res.passed) {
      certifyGrade(level, res.score)
      onCertified?.(res.score)
    }
  }

  function handleRetry() {
    setAnswers({})
    setSecondsLeft(EXAM_SECONDS)
    setSubmitted(false)
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const answeredCount = Object.keys(answers).length

  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={tr('Аттестация на грейд')} onClick={onClose}>
      <div className="modal panel" style={{ maxWidth: 740, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="sandbox-head-row" style={{ marginBottom: 8 }}>
          <div>
            <span className="eyebrow">{tr('Независимая проверка без подсказок')} · {tr(gradeBadge)}</span>
            <h2 style={{ margin: '4px 0 0' }}>{tr('Аттестация:')} {tr(gradeTitle)}</h2>
          </div>
          <div className="row">
            <span className="chip num" aria-live="polite">⏱ {mm}:{ss}</span>
            <button type="button" className="btn small ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        <p className="small muted">
          {tr('5 расчётно-технологических задач без подсказок. Для подтверждения грейда и выдачи верифицированного штампа в портфолио необходимо набрать не менее 80 % (4 из 5).')}
        </p>

        {questions.map((q, idx) => {
          const picked = answers[q.id]
          return (
            <section key={q.id} className="panel" style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0 }}>
                <span className="ptag">{idx + 1}</span>{tr(q.prompt)}
              </h3>
              <div className="choices">
                {q.options.map((opt) => {
                  const isPicked = picked === opt.id
                  const cls = submitted
                    ? opt.correct
                      ? 'choice on'
                      : isPicked
                        ? 'choice wrong'
                        : 'choice'
                    : isPicked
                      ? 'choice on'
                      : 'choice'
                  return (
                    <label key={opt.id} className={cls}>
                      <input
                        type="radio"
                        name={`ge-${q.id}`}
                        disabled={submitted}
                        checked={isPicked}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                      />
                      <span>
                        {tr(opt.text)}
                        {submitted && (isPicked || opt.correct) && (
                          <span className="small muted" style={{ display: 'block', marginTop: 4 }}>
                            {opt.correct ? '✓ ' : '✕ '}{tr(opt.why)}
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          )
        })}

        {result ? (
          <div className={`fb ${result.passed ? 'ok' : 'wrong'}`} style={{ marginTop: 14 }} role="status">
            <b>
              {result.passed
                ? tr('✓ Аттестация успешно пройдена!')
                : tr('✕ Порог 80 % пока не достигнут.')}
            </b>{' '}
            {tr('Верных ответов:')} {result.correctCount} / {result.total} ({Math.round(result.score * 100)} %).{' '}
            {result.passed
              ? tr('Верифицированный штамп грейда сохранён в вашем профиле и PDF-портфолио.')
              : tr('Разберите пояснения выше и попробуйте сдать экзамен повторно.')}
            <div className="row" style={{ marginTop: 10 }}>
              {!result.passed && (
                <button type="button" className="btn" onClick={handleRetry}>
                  {tr('Попробовать снова')}
                </button>
              )}
              <button type="button" className="btn primary" onClick={onClose}>
                {tr('Готово')}
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            <span className="small num">{tr('Отвечено:')} {answeredCount} / {questions.length}</span>
            <button
              type="button"
              className="btn primary"
              disabled={answeredCount < questions.length}
              onClick={handleSubmit}
            >
              {tr('Завершить и проверить аттестацию →')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
