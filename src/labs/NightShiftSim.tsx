import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import {
  INITIAL_SHIFT_BUDGET_RUB,
  TARGET_SHIFT_SLA_MINUTES,
  evaluateNightShift,
  generateNightShift,
  type NightShiftDecision,
} from '../../shared/night-shift-sim'
import type { LabMeta } from '../content'
import { Brief, DebriefLinks, LabFrame, markFinished, useLabState } from './LabPage'

interface NightShiftState {
  phase: 'brief' | 'work' | 'debrief'
  seed: number
  stepIdx: number
  decisions: NightShiftDecision[]
  draftCause: string
  draftAction: string
  elapsedSec: number
}

function makeSeed() {
  return Math.floor(1000 + Math.random() * 900000)
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function NightShiftSim({ lab }: { lab: LabMeta }) {
  const [st, setSt, reset] = useLabState<NightShiftState>(lab.id, () => ({
    phase: 'brief',
    seed: 202601,
    stepIdx: 0,
    decisions: [],
    draftCause: '',
    draftAction: '',
    elapsedSec: 0,
  }))
  const [liveSec, setLiveSec] = useState(st.elapsedSec)

  useEffect(() => {
    setLiveSec(st.elapsedSec)
  }, [st.elapsedSec])

  useEffect(() => {
    if (st.phase !== 'work') return
    const timer = window.setInterval(() => {
      setLiveSec((prev) => prev + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [st.phase])

  const incidents = useMemo(() => generateNightShift(st.seed), [st.seed])
  const current = incidents[st.stepIdx] ?? incidents[0]
  const currentDecision = st.decisions.find((d) => d.incidentId === current?.id)

  const liveStats = useMemo(
    () => evaluateNightShift(incidents.slice(0, st.decisions.length), st.decisions),
    [incidents, st.decisions],
  )
  const finalResult = useMemo(
    () => evaluateNightShift(incidents, st.decisions),
    [incidents, st.decisions],
  )

  const budgetLeft = st.decisions.length ? liveStats.budgetLeft : INITIAL_SHIFT_BUDGET_RUB
  const qualityIndex = st.decisions.length ? liveStats.qualityIndex : 100
  const downtimeMin = st.decisions.length ? liveStats.downtimeMinutes : 0

  function startNewShift(freshSeed?: number) {
    const nextSeed = freshSeed ?? makeSeed()
    setLiveSec(0)
    setSt((s) => {
      s.phase = 'work'
      s.seed = nextSeed
      s.stepIdx = 0
      s.decisions = []
      s.draftCause = ''
      s.draftAction = ''
      s.elapsedSec = 0
    })
  }

  function applyDecision() {
    if (!current || !st.draftCause || !st.draftAction || currentDecision) return
    setSt((s) => {
      s.decisions.push({
        incidentId: current.id,
        causeId: s.draftCause,
        actionId: s.draftAction,
      })
      s.elapsedSec = liveSec
    })
  }

  function nextOrFinish() {
    if (st.stepIdx < incidents.length - 1) {
      setSt((s) => {
        s.stepIdx += 1
        s.draftCause = ''
        s.draftAction = ''
        s.elapsedSec = liveSec
      })
      return
    }
    const res = evaluateNightShift(incidents, st.decisions)
    const label =
      res.grade === 'saved'
        ? tr('Смена спасена')
        : res.grade === 'partial'
          ? tr('Смена пройдена с потерями')
          : tr('Критические потери смены')
    markFinished(
      lab.id,
      `${label} · ${Math.round(res.score * 100)} % · ${tr('качество')} ${res.qualityIndex} %`,
      {
        seed: st.seed,
        score: res.score,
        qualityIndex: res.qualityIndex,
        budgetLeft: res.budgetLeft,
        downtimeMinutes: res.downtimeMinutes,
      },
      res.score,
    )
    setSt((s) => {
      s.phase = 'debrief'
      s.elapsedSec = liveSec
    })
  }

  const steps = [tr('Вводная'), tr('Ночная смена (3 ЧП)'), tr('Разбор смены')]
  const stepNum = st.phase === 'brief' ? 0 : st.phase === 'work' ? 1 : 2

  return (
    <LabFrame lab={lab} steps={steps} step={stepNum} debrief={st.phase === 'debrief'} onRestart={reset}>
      {st.phase === 'brief' && (
        <Brief
          lab={lab}
          resumed={st.decisions.length > 0}
          onStart={() =>
            setSt((s) => {
              s.phase = 'work'
            })
          }
        />
      )}

      {st.phase === 'work' && current && (
        <div className="ns-wrap">
          {/* Живая телеметрия ночной смены */}
          <div className="ns-hud" role="region" aria-label={tr('Телеметрия ночной смены')}>
            <div className="ns-hud-item">
              <span>{tr('Инцидент')}</span>
              <b className="num">{st.stepIdx + 1} / {incidents.length}</b>
            </div>
            <div className="ns-hud-item">
              <span>{tr('Таймер смены')}</span>
              <b className="num">⏱ {formatClock(liveSec)}</b>
            </div>
            <div className={`ns-hud-item ${downtimeMin > TARGET_SHIFT_SLA_MINUTES ? 'crit' : ''}`}>
              <span>{tr('Простой цеха')}</span>
              <b className="num">{downtimeMin} / {TARGET_SHIFT_SLA_MINUTES} {tr('мин')}</b>
            </div>
            <div className={`ns-hud-item ${budgetLeft < 0 ? 'crit' : budgetLeft < 50000 ? 'warn' : 'ok'}`}>
              <span>{tr('Резерв смены')}</span>
              <b className="num">{budgetLeft.toLocaleString('ru-RU')} ₽</b>
            </div>
            <div className={`ns-hud-item ${qualityIndex < 65 ? 'crit' : qualityIndex < 85 ? 'warn' : 'ok'}`}>
              <span>{tr('Индекс качества')}</span>
              <b className="num">{qualityIndex} %</b>
            </div>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => startNewShift()}
              title={tr('Сгенерировать новый случайный набор из 3 производственных ЧП')}
            >
              🎲 {tr('Новая смена')}
            </button>
          </div>

          <section className="panel ns-incident">
            <div className="ns-incident-head">
              <div>
                <span className="ns-alarm-pill num">{current.code} · {current.reactor}</span>
                <h2>{current.title}</h2>
                <p className="small muted">{current.product} · {current.batchKg} {tr('кг')}</p>
              </div>
              <span className="small num muted">{tr('Смена #')}{st.seed}</span>
            </div>

            <div className="ns-alarm-box" role="alert">
              <b>⚠ {current.alarm}</b>
              <p>{current.report}</p>
            </div>

            <dl className="ns-telemetry">
              {current.telemetry.map((t) => (
                <div key={t.label} className={`ns-tel-card st-${t.status}`}>
                  <dt>{t.label}</dt>
                  <dd className="num">{t.value}</dd>
                </div>
              ))}
            </dl>

            <div className="ns-decision-grid">
              <fieldset disabled={Boolean(currentDecision)}>
                <legend>{tr('1. Диагностика первопричины ЧП')}</legend>
                <div className="choices">
                  {current.causes.map((c) => {
                    const checked = (currentDecision?.causeId ?? st.draftCause) === c.id
                    return (
                      <label key={c.id} className={`choice ${checked ? 'on' : ''}`}>
                        <input
                          type="radio"
                          name={`cause-${current.id}`}
                          checked={checked}
                          onChange={() => setSt((s) => { s.draftCause = c.id })}
                        />
                        <span>{c.text}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <fieldset disabled={Boolean(currentDecision)}>
                <legend>{tr('2. Команда в цех (корректирующее действие)')}</legend>
                <div className="choices">
                  {current.actions.map((a) => {
                    const checked = (currentDecision?.actionId ?? st.draftAction) === a.id
                    return (
                      <label key={a.id} className={`choice ${checked ? 'on' : ''}`}>
                        <input
                          type="radio"
                          name={`act-${current.id}`}
                          checked={checked}
                          onChange={() => setSt((s) => { s.draftAction = a.id })}
                        />
                        <span>{a.text}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </div>

            {!currentDecision ? (
              <div className="row end">
                <button
                  type="button"
                  className="btn primary"
                  disabled={!st.draftCause || !st.draftAction}
                  onClick={applyDecision}
                >
                  {tr('Отдать команду в цех')}
                </button>
              </div>
            ) : (() => {
              const chosenCause = current.causes.find((c) => c.id === currentDecision.causeId)
              const chosenAct = current.actions.find((a) => a.id === currentDecision.actionId)
              return (
                <div className={`ns-feedback v-${chosenAct?.verdict ?? 'bad'}`} role="status">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>
                      {chosenAct?.verdict === 'ok'
                        ? tr('✓ Авария локализована оптимально')
                        : chosenAct?.verdict === 'partial'
                          ? tr('△ Инцидент сдержан, но с потерями')
                          : tr('✕ Критическая ошибка — угроза брака партии')}
                    </b>
                    <span className="small num">
                      −{chosenAct?.costRub.toLocaleString('ru-RU')} ₽ · {chosenAct?.qualityDelta} % {tr('качества')} · +{chosenAct?.minutes} {tr('мин')}
                    </span>
                  </div>
                  {chosenCause && <p className="small"><b>{tr('Причина:')}</b> {chosenCause.why}</p>}
                  {chosenAct && <p className="small"><b>{tr('Последствие в цехе:')}</b> {chosenAct.explain}</p>}
                  <div className="row end" style={{ marginTop: 12 }}>
                    <Link className="btn small ghost" to={`/topics/${current.topicId}`}>
                      {tr('Открыть теорию по теме')}
                    </Link>
                    <button type="button" className="btn primary" onClick={nextOrFinish}>
                      {st.stepIdx < incidents.length - 1 ? tr('Следующий вызов цеха →') : tr('Завершить смену и открыть отчёт')}
                    </button>
                  </div>
                </div>
              )
            })()}
          </section>
        </div>
      )}

      {st.phase === 'debrief' && (
        <div className="debrief">
          <div className="debrief-head">
            <h1>
              {finalResult.grade === 'saved'
                ? tr('Ночная смена пройдена: все партии спасены')
                : finalResult.grade === 'partial'
                  ? tr('Смена завершена с технологическими потерями')
                  : tr('Смена провалена: критический брак или перерасход')}
            </h1>
            <dl className="outcome">
              <div><dt>{tr('Итоговый балл')}</dt><dd className="num">{Math.round(finalResult.score * 100)} %</dd></div>
              <div><dt>{tr('Индекс качества')}</dt><dd className="num">{finalResult.qualityIndex} %</dd></div>
              <div><dt>{tr('Остаток резерва')}</dt><dd className="num">{finalResult.budgetLeft.toLocaleString('ru-RU')} ₽</dd></div>
              <div><dt>{tr('Простой / время')}</dt><dd className="num">{finalResult.downtimeMinutes} {tr('мин')} · {formatClock(st.elapsedSec)}</dd></div>
            </dl>
          </div>

          <section className="panel">
            <h3>{tr('Журнал принятых решений (Смена #')}{st.seed})</h3>
            {incidents.map((inc, idx) => {
              const det = finalResult.details[idx]
              const bestAct = inc.actions.find((a) => a.verdict === 'ok')
              return (
                <div key={inc.id} className={`drow ${det.actionVerdict === 'ok' && det.causeOk ? 'ok' : det.actionVerdict === 'bad' ? 'wrong' : 'weak'}`}>
                  <h4>{inc.code}: {inc.title}</h4>
                  <p className="small">
                    {tr('Диагностика причины:')} <b>{det.causeOk ? tr('верно') : tr('ошибка')}</b> · {tr('Потери:')} <span className="num">{det.costRub.toLocaleString('ru-RU')} ₽</span>, {det.minutes} {tr('мин')}
                  </p>
                  {bestAct && (
                    <p className="small"><b>{tr('Эталонное действие:')}</b> {bestAct.text}</p>
                  )}
                  <p className="small"><Link to={`/topics/${inc.topicId}`}>{tr('Теория для разбора →')}</Link></p>
                </div>
              )
            })}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="button" className="btn primary" onClick={() => startNewShift()}>
                🎲 {tr('Запустить новую ночную смену (новые 3 ЧП)')}
              </button>
              <button type="button" className="btn ghost" onClick={() => startNewShift(st.seed)}>
                ↺ {tr('Переиграть этот же набор ЧП')}
              </button>
            </div>
          </section>

          <DebriefLinks lab={lab} />
        </div>
      )}
    </LabFrame>
  )
}
