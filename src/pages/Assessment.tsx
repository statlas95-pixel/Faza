import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import {
  buildExamQuestions,
  buildSignedExamResult,
  decodeExamConfig,
  decodeExamResult,
  encodeExamConfig,
  encodeExamResult,
  type ExamConfig,
  type ExamResultPayload,
  type ExamTrack,
} from '../../shared/assessment'
import { showToast } from '../components/Toast'
import { useTitle } from './util'

function ResultProtocolView({
  result,
  valid,
  resultCode,
  onReset,
}: {
  result: ExamResultPayload
  valid: boolean
  resultCode: string
  onReset: () => void
}) {
  const resultUrl = `${window.location.origin}${window.location.pathname}#/assessment?result=${encodeURIComponent(resultCode)}`
  const passed = result.score >= 75

  function copy(text: string, msg: string) {
    navigator.clipboard?.writeText(text).then(() => showToast(msg)).catch(() => {})
  }

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="sandbox-head-row">
        <div>
          <span className={`grade-badge ${valid ? '' : 'err'}`}>
            {valid ? tr('✓ Верифицированный протокол экзамена') : tr('⚠ Контрольная сумма не совпала')}
          </span>
          <h2 style={{ margin: '8px 0 4px' }}>{result.candidate}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {result.org} · {result.role} · {result.date} · Seed <span className="num">#{result.seed}</span>
          </p>
        </div>
        <div className="row no-print" style={{ gap: 8 }}>
          <button type="button" className="btn small ghost" onClick={() => window.print()}>
            🖨 {tr('Печать PDF')}
          </button>
          <button type="button" className="btn small primary" onClick={onReset}>
            {tr('Новый экзамен')}
          </button>
        </div>
      </div>

      <div className="tools-kpi-row" style={{ marginTop: 14 }}>
        <div className={`tools-kpi ${passed ? 'ok' : 'err'}`}>
          <span className="small muted">{tr('Итоговый балл')}</span>
          <b className="num" style={{ fontSize: '1.6rem' }}>{result.score} %</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Верных ответов')}</span>
          <b className="num">{result.correct} / {result.total}</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Затрачено времени')}</span>
          <b className="num">{Math.floor(result.elapsedSec / 60)}:{String(result.elapsedSec % 60).padStart(2, '0')}</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Код целостности')}</span>
          <b className="num">{result.sig}</b>
        </div>
      </div>

      <div className="tools-kpi-row" style={{ marginTop: 10 }}>
        <div className="tools-kpi">
          <span className="small muted">R&amp;D / {tr('Рецептуры')}</span>
          <b className="num">{result.domainPct.rnd} %</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Процессы и масштаб')}</span>
          <b className="num">{result.domainPct.process} %</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">QA / {tr('Регуляторика')}</span>
          <b className="num">{result.domainPct.qa} %</b>
        </div>
      </div>

      <div className="tools-inci-box no-print" style={{ marginTop: 14 }}>
        <div className="small muted" style={{ marginBottom: 4 }}>
          {tr('Верифицируемый код результата (отправьте тимлиду / HR / преподавателю):')}
        </div>
        <code>{resultCode}</code>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button type="button" className="btn small ghost" onClick={() => copy(resultCode, tr('Код результата скопирован'))}>
            📋 {tr('Копировать код')}
          </button>
          <button type="button" className="btn small ghost" onClick={() => copy(resultUrl, tr('Ссылка на протокол скопирована'))}>
            🔗 {tr('Копировать ссылку на протокол')}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function AssessmentPage() {
  useTitle(tr('Режим экзамена для команд и вузов'))
  const en = language === 'en'
  const [sp, setSp] = useSearchParams()
  const examToken = sp.get('exam')
  const resultToken = sp.get('result')

  // Режим просмотра верифицированного результата по ?result=
  const decodedResult = useMemo(() => (resultToken ? decodeExamResult(resultToken) : null), [resultToken])
  // Режим сдачи экзамена кандидатом по ?exam=
  const activeConfig = useMemo(() => (examToken ? decodeExamConfig(examToken) : null), [examToken])

  // Состояние конструктора (для HR / тимлида / преподавателя)
  const [tab, setTab] = useState<'create' | 'verify'>('create')
  const [org, setOrg] = useState('R&D Lab / Team')
  const [role, setRole] = useState(en ? 'Cosmetic Formulator' : 'Химик-технолог косметики')
  const [track, setTrack] = useState<ExamTrack>('full')
  const [seed, setSeed] = useState(2026)
  const [count, setCount] = useState(8)
  const [minutes, setMinutes] = useState(15)
  const [verifyInput, setVerifyInput] = useState('')
  const verifiedManual = useMemo(() => (verifyInput.trim() ? decodeExamResult(verifyInput) : null), [verifyInput])

  // Состояние сдачи кандидатом
  const [candidateName, setCandidateName] = useState('')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [remainingSec, setRemainingSec] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<ExamResultPayload | null>(null)

  const questions = useMemo(() => (activeConfig ? buildExamQuestions(activeConfig) : []), [activeConfig])

  useEffect(() => {
    if (!startedAt || submitted || !activeConfig) return
    const limitSec = activeConfig.minutes * 60
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const left = Math.max(0, limitSec - elapsed)
      setRemainingSec(left)
      if (left <= 0) {
        setSubmitted(buildSignedExamResult(activeConfig, candidateName, questions, answers, elapsed))
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [startedAt, submitted, activeConfig, candidateName, questions, answers])

  const generatedToken = useMemo(
    () => encodeExamConfig({ org, role, track, seed, count, minutes }),
    [org, role, track, seed, count, minutes],
  )
  const generatedLink = `${window.location.origin}${window.location.pathname}#/assessment?exam=${generatedToken}`

  if (decodedResult) {
    return (
      <div className="page">
        <h1>{tr('Протокол независимого экзамена')}</h1>
        <ResultProtocolView
          result={decodedResult.payload}
          valid={decodedResult.valid}
          resultCode={resultToken!}
          onReset={() => setSp({})}
        />
      </div>
    )
  }

  if (activeConfig) {
    if (submitted) {
      const code = encodeExamResult(submitted)
      return (
        <div className="page">
          <h1>{tr('Экзамен завершён')}</h1>
          <ResultProtocolView
            result={submitted}
            valid={true}
            resultCode={code}
            onReset={() => {
              setSubmitted(null)
              setStartedAt(null)
              setAnswers({})
              setSp({})
            }}
          />
        </div>
      )
    }

    return (
      <div className="page">
        <div className="sandbox-head-row">
          <div>
            <span className="grade-badge">{tr('Экзамен без подсказок')} · Seed #{activeConfig.seed}</span>
            <h1 style={{ marginTop: 8 }}>{activeConfig.org} — {activeConfig.role}</h1>
            <p className="small muted" style={{ margin: 0 }}>
              {tr('Вопросов:')} {questions.length} · {tr('Лимит времени:')} {activeConfig.minutes} {tr('мин')} · {tr('Подсказки и справочник отключены')}
            </p>
          </div>
          {startedAt && (
            <div className="tools-kpi accent" style={{ minWidth: 130, textAlign: 'center' }}>
              <span className="small muted">{tr('Осталось')}</span>
              <b className="num" style={{ fontSize: '1.3rem' }}>
                {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
              </b>
            </div>
          )}
        </div>

        {!startedAt ? (
          <section className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
            <h2>{tr('Идентификация кандидата')}</h2>
            <p className="small muted">
              {tr('Укажите имя и фамилию для верифицируемого протокола. После нажатия «Начать экзамен» запустится таймер.')}
            </p>
            <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <span className="small muted">{tr('Имя и фамилия кандидата')}</span>
              <input
                type="text"
                className="tools-textarea"
                style={{ marginTop: 0, minHeight: 0 }}
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder={en ? 'Alexey Ivanov' : 'Алексей Иванов'}
              />
            </label>
            <div className="row" style={{ gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn primary"
                disabled={!candidateName.trim()}
                onClick={() => {
                  setStartedAt(Date.now())
                  setRemainingSec(activeConfig.minutes * 60)
                }}
              >
                ▶ {tr('Начать экзамен')}
              </button>
              <button type="button" className="btn ghost" onClick={() => setSp({})}>
                {tr('Отмена')}
              </button>
            </div>
          </section>
        ) : (
          <div className="defense-list" style={{ marginTop: 16 }}>
            {questions.map((q, idx) => (
              <section key={q.id} className="panel">
                <div className="small muted" style={{ fontWeight: 600 }}>
                  {tr('Вопрос')} {idx + 1} / {questions.length} · {q.domain.toUpperCase()}
                </div>
                <p style={{ fontWeight: 600, margin: '6px 0 12px' }}>{en ? q.promptEn : q.promptRu}</p>
                <div className="defense-opts">
                  {q.options.map((o) => {
                    const selected = answers[q.id] === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`defense-opt ${selected ? 'ok' : ''}`}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                      >
                        {selected ? '● ' : '○ '}
                        {en ? o.textEn : o.textRu}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="small muted">
                {tr('Отвечено:')} {Object.keys(answers).length} / {questions.length}
              </span>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const elapsed = Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
                  setSubmitted(buildSignedExamResult(activeConfig, candidateName, questions, answers, elapsed))
                }}
              >
                ✓ {tr('Завершить и получить протокол')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page tools-page">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Режим экзамена для команд, найма и вузов')}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {tr('Настройте фиксированный билет без подсказок с таймером и отправьте кандидату или студенту ссылку — по итогам генерируется компактный код результата с контрольной суммой.')}
          </p>
        </div>
        <Link to="/portfolio" className="btn ghost">← {tr('К портфолио')}</Link>
      </div>

      <div className="tools-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'create'} className={`chip ${tab === 'create' ? 'on' : ''}`} onClick={() => setTab('create')}>
          📝 {tr('Создать экзамен')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'verify'} className={`chip ${tab === 'verify' ? 'on' : ''}`} onClick={() => setTab('verify')}>
          🔍 {tr('Проверить код результата')}
        </button>
      </div>

      {tab === 'create' ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{tr('Параметры экзаменационного билета')}</h2>
          <div className="tools-form-grid" style={{ marginTop: 12 }}>
            <label>
              <span className="small muted">{tr('Компания / кафедра / команда')}</span>
              <input type="text" className="num-in" style={{ maxWidth: '100%' }} value={org} onChange={(e) => setOrg(e.target.value)} />
            </label>
            <label>
              <span className="small muted">{tr('Вакансия / курс')}</span>
              <input type="text" className="num-in" style={{ maxWidth: '100%' }} value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label>
              <span className="small muted">{tr('Профиль экзамена')}</span>
              <select className="sel" value={track} onChange={(e) => setTrack(e.target.value as ExamTrack)}>
                <option value="full">{tr('Полный универсальный (R&D + Процесс + QA)')}</option>
                <option value="rnd">{tr('R&D-разработчик рецептур')}</option>
                <option value="process">{tr('Технолог производства и масштабирования')}</option>
                <option value="qa">{tr('QA, микробиология и регуляторика')}</option>
              </select>
            </label>
            <label>
              <span className="small muted">{tr('Фиксированный Seed билета')}</span>
              <input type="number" min="1" max="999999" className="num-in" value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            <label>
              <span className="small muted">{tr('Количество вопросов (5–12)')}</span>
              <input type="number" min="5" max="12" className="num-in" value={count} onChange={(e) => setCount(Math.max(5, Math.min(12, Number(e.target.value) || 8)))} />
            </label>
            <label>
              <span className="small muted">{tr('Лимит времени, мин')}</span>
              <input type="number" min="5" max="60" className="num-in" value={minutes} onChange={(e) => setMinutes(Math.max(5, Math.min(60, Number(e.target.value) || 15)))} />
            </label>
          </div>

          <div className="tools-inci-box" style={{ marginTop: 16 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>{tr('Ссылка для кандидата (фиксированный seed, без подсказок):')}</div>
            <code>{generatedLink}</code>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedLink).then(() => showToast(tr('Ссылка на экзамен скопирована'))).catch(() => {})
                }}
              >
                🔗 {tr('Копировать ссылку кандидату')}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setSp({ exam: generatedToken })}
              >
                ▶ {tr('Открыть билет (предпросмотр)')}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{tr('Проверка верифицируемого кода результата')}</h2>
          <p className="small muted">{tr('Вставьте код вида FAZA-EXAM-... или ссылку на протокол, присланную кандидатом.')}</p>
          <textarea
            className="tools-textarea"
            rows={3}
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value)}
            placeholder="FAZA-EXAM-..."
          />
          {verifiedManual ? (
            <ResultProtocolView
              result={verifiedManual.payload}
              valid={verifiedManual.valid}
              resultCode={verifyInput.trim()}
              onReset={() => setVerifyInput('')}
            />
          ) : verifyInput.trim() ? (
            <p className="warnline" style={{ marginTop: 10 }}>{tr('Не удалось распознать код результата.')}</p>
          ) : null}
        </section>
      )}
    </div>
  )
}
