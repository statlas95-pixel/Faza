import { useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateShiftTrend, type ShiftTrendLabData } from '../../shared/domain-trainers'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  selectedMin?: number
  causeId?: string
  actionId?: string
  transfer: Record<number, any>
  finished?: boolean
}

export default function ShiftTrend({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as ShiftTrendLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', transfer: {} }))
  const [warn, setWarn] = useState('')
  const stepsLabels = [tr('Вводная'), tr('График трендов'), tr('Разбор смены')]

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={stepsLabels}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={s.selectedMin !== undefined || !!s.causeId}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const maxMin = Math.max(...data.points.map((p) => p.min), 1)
  const xFor = (m: number) => 42 + (m / maxMin) * 480
  const yTemp = (t: number) => 175 - ((t - 20) / 65) * 145
  const yCur = (a: number) => 175 - ((a - 5) / 10) * 145
  const yVac = (v: number) => 175 - ((Math.abs(v)) / 0.8) * 145

  const lineOf = (fn: (p: typeof data.points[number]) => number) =>
    data.points.map((p) => `${xFor(p.min).toFixed(1)},${fn(p).toFixed(1)}`).join(' ')

  const activePt = data.points.find((p) => p.min === s.selectedMin)

  if (s.phase === 'work') {
    const submit = () => {
      const miss = [
        s.selectedMin === undefined && tr('точка отклонения на графике'),
        !s.causeId && tr('физическая причина'),
        !s.actionId && tr('действие технолога'),
      ].filter(Boolean)
      if (miss.length) {
        setWarn(`${tr('Не заполнено: ')}${miss.join(', ')}.`)
        return
      }
      const ev = evaluateShiftTrend(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('маркер ') + s.selectedMin + tr(' мин · ')}${Math.round(ev.score * 100)} %`,
        { selectedMin: s.selectedMin, causeId: s.causeId },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="panel">
          <p className="eyebrow">{data.equipment} · {data.batchInfo}</p>
          <h2>{tr('Приборный тренд смены — кликните точку начала отклонения')}</h2>
          <div className="trend-legend small">
            <span className="tl-temp">● {tr('Температура, °C')}</span>
            <span className="tl-cur">● {tr('Ток привода, А')}</span>
            <span className="tl-vac">● {tr('Глубина вакуума |бар|')}</span>
          </div>
          <div className="table-wrap">
            <svg viewBox="0 0 560 215" className="trend-svg" role="img" aria-label={tr('Интерактивный график трендов варки')}>
              <line x1="42" y1="175" x2="528" y2="175" stroke="currentColor" opacity="0.25" />
              <line x1="42" y1="25" x2="42" y2="175" stroke="currentColor" opacity="0.25" />
              <polyline points={lineOf((p) => yTemp(p.tempC))} fill="none" stroke="#E86A42" strokeWidth="2.5" />
              <polyline points={lineOf((p) => yCur(p.currentA))} fill="none" stroke="var(--plum)" strokeWidth="2.5" />
              <polyline points={lineOf((p) => yVac(p.vacuumBar))} fill="none" stroke="var(--teal)" strokeWidth="2.5" />
              {s.selectedMin !== undefined && (
                <line
                  x1={xFor(s.selectedMin)}
                  y1="20"
                  x2={xFor(s.selectedMin)}
                  y2="180"
                  stroke="#C0392B"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                />
              )}
              {data.points.map((p) => {
                const x = xFor(p.min)
                const sel = s.selectedMin === p.min
                return (
                  <g
                    key={p.min}
                    className="trend-hit"
                    onClick={() => set((draft) => { draft.selectedMin = p.min })}
                  >
                    <rect x={x - 16} y="20" width="32" height="175" fill="transparent" />
                    <circle cx={x} cy={yTemp(p.tempC)} r={sel ? 5.5 : 3.5} fill="#E86A42" />
                    <circle cx={x} cy={yCur(p.currentA)} r={sel ? 5.5 : 3.5} fill="var(--plum)" />
                    <circle cx={x} cy={yVac(p.vacuumBar)} r={sel ? 5.5 : 3.5} fill="var(--teal)" />
                    <text x={x} y="196" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight={sel ? 700 : 400}>
                      {p.min}м
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="row sandbox-batch-chips">
            <span className="small">{tr('Или выберите минуту кнопкой:')}</span>
            {data.points.map((p) => (
              <button
                key={p.min}
                type="button"
                className={`chip ${s.selectedMin === p.min ? 'on' : ''}`}
                onClick={() => set((draft) => { draft.selectedMin = p.min })}
              >
                {p.min} {tr('мин')}
              </button>
            ))}
          </div>
          {activePt && (
            <dl className="outcome">
              <div><dt>{tr('Выбранная минута')}</dt><dd>{activePt.min} {tr('мин')}</dd></div>
              <div><dt>{tr('Температура')}</dt><dd>{activePt.tempC} °C</dd></div>
              <div><dt>{tr('Ток привода')}</dt><dd>{activePt.currentA} А</dd></div>
              <div><dt>{tr('Вакуум')}</dt><dd>{activePt.vacuumBar} {tr('бар')}</dd></div>
            </dl>
          )}
        </section>

        <section className="panel">
          <h3><span className="ptag">1</span>{tr('Что произошло в реакторе по данным трёх каналов?')}</h3>
          <div className="choices">
            {data.causes.map((c) => (
              <label key={c.id} className={`choice ${s.causeId === c.id ? 'on' : ''}`}>
                <input type="radio" name="st-cause" checked={s.causeId === c.id} onChange={() => set((x) => { x.causeId = c.id })} />
                <span>{c.title}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">2</span>{tr('Какое корректирующее действие принять технологу?')}</h3>
          <div className="choices">
            {data.actions.map((a) => (
              <label key={a.id} className={`choice ${s.actionId === a.id ? 'on' : ''}`}>
                <input type="radio" name="st-act" checked={s.actionId === a.id} onChange={() => set((x) => { x.actionId = a.id })} />
                <span>{a.title}</span>
              </label>
            ))}
          </div>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Завершить разбор смены')}
        </button>
      </div>,
    )
  }

  const ev = evaluateShiftTrend(data, s)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог разбора тренда')}</p>
        <h1>{tr('Разбор журнала смены')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      <div className={`drow ${ev.timeVerdict}`}>
        <h4><VerdictTag v={ev.timeVerdict} /> {tr('Момент отклонения:')} {s.selectedMin} {tr('мин')} ({tr('эталон:')} {data.anomalyMin} {tr('мин')})</h4>
        <p>{data.anomalyWhy}</p>
      </div>
      {ev.cause && (
        <div className={`drow ${ev.cause.verdict}`}>
          <h4><VerdictTag v={ev.cause.verdict} /> {ev.cause.title}</h4>
          <p>{ev.cause.why}</p>
        </div>
      )}
      {ev.action && (
        <div className={`drow ${ev.action.verdict}`}>
          <h4><VerdictTag v={ev.action.verdict} /> {ev.action.title}</h4>
          <p>{ev.action.why}</p>
        </div>
      )}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
