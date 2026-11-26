import { useEffect, useState } from 'react'
import { language, tr } from '../../shared/locale'
import {
  addPhaseB,
  addPhaseC,
  evaluateReactorRun,
  initialReactorState,
  stepReactor,
  type JacketMode,
  type ReactorControls,
  type ReactorState,
} from '../../shared/reactor-sim'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  reactor: ReactorState
  ctl: ReactorControls
  transfer: Record<number, any>
  finished?: boolean
}

const initS = (): S => ({
  phase: 'brief',
  reactor: initialReactorState(),
  ctl: { jacket: 'off', anchorOn: false, homogenizerOn: false, vacuumOn: false },
  transfer: {},
})

function ReactorSchematic({ r, ctl, running }: { r: ReactorState; ctl: ReactorControls; running: boolean }) {
  const jacketColor = ctl.jacket === 'heat' ? '#E25B3B' : ctl.jacket === 'cool' ? '#3FA7D6' : '#8A7D9A'
  const liquidColor = !r.phaseBAdded
    ? '#C9EAE7'
    : r.dropletUm <= 5
      ? '#FAF6EE'
      : '#EFE3C6'
  const liquidY = r.phaseBAdded ? (r.phaseCAdded ? 68 : 78) : 96
  return (
    <svg viewBox="0 0 320 220" className={`reactor-svg ${running ? 'playing' : ''}`} role="img" aria-label={tr('Мнемосхема вакуумного реактора')}>
      {/* Рубашка нагрева/охлаждения */}
      <path
        d="M78 72 L78 164 Q78 192 160 192 Q242 192 242 164 L242 72"
        fill="none"
        stroke={jacketColor}
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* Корпус реактора */}
      <path
        d="M88 46 L232 46 L232 162 Q232 184 160 184 Q88 184 88 162 Z"
        fill="var(--surface)"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="2.5"
      />
      {/* Содержимое */}
      <path
        d={`M90 ${liquidY} L230 ${liquidY} L230 162 Q230 181 160 181 Q90 181 90 162 Z`}
        fill={liquidColor}
      />
      {/* Налипание у стенок при охлаждении без якоря */}
      {r.wallFouling && (
        <path
          d="M90 100 L90 162 Q90 180 160 180 Q230 180 230 162 L230 100"
          fill="none"
          stroke="#B58A2A"
          strokeWidth="6"
          strokeDasharray="6 4"
        />
      )}
      {/* Пузырьки воздуха при завоздушивании */}
      {r.airPct > 4 && (
        <g fill="#FFFFFF" stroke="#6E627F" strokeWidth="0.9">
          <circle cx="118" cy={liquidY + 14} r="3.5" />
          <circle cx="144" cy={liquidY + 22} r="2.8" />
          <circle cx="182" cy={liquidY + 12} r="4" />
          <circle cx="204" cy={liquidY + 26} r="3" />
          {r.airPct > 10 && <circle cx="160" cy={liquidY + 34} r="4.2" />}
        </g>
      )}
      {/* Вал якорной мешалки */}
      <rect x="157" y="18" width="6" height="148" rx="2" fill="#4B3B6B" />
      <g className={ctl.anchorOn ? 'reactor-anchor-spin' : ''} style={{ transformOrigin: '160px 140px' }}>
        <path
          d="M102 104 L102 158 Q102 172 160 172 Q218 172 218 158 L218 104"
          fill="none"
          stroke="#4B3B6B"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      {/* Донный ротор-статор */}
      <g className={ctl.homogenizerOn ? 'reactor-homo-spin' : ''} style={{ transformOrigin: '160px 168px' }}>
        <rect x="142" y="162" width="36" height="10" rx="3" fill={ctl.homogenizerOn ? '#E25B3B' : '#6E4FA3'} />
      </g>
      {/* Линия вакуума сверху */}
      <path d="M210 46 L210 22 L276 22" fill="none" stroke={ctl.vacuumOn ? '#0E7C7B' : '#8A7D9A'} strokeWidth="2.5" />
      <text x="278" y="25" fontSize="10" fill="currentColor" fontWeight="600">{r.vacuumBar} {tr('бар')}</text>
      {/* Термодатчик */}
      <text x="16" y="128" fontSize="12" fill={jacketColor} fontWeight="700">{r.tempC} °C</text>
      <text x="16" y="144" fontSize="9.5" fill="currentColor" opacity="0.7">
        {ctl.jacket === 'heat' ? tr('Нагрев') : ctl.jacket === 'cool' ? tr('Охлажд.') : tr('Рубашка выкл')}
      </text>
      <text x="160" y="210" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">
        {tr('Время:')} {r.minute} {tr('мин')} · {tr('Капли:')} {r.phaseBAdded ? `${r.dropletUm} ${tr('мкм')}` : '—'}
      </text>
    </svg>
  )
}

export default function ReactorSim({ lab }: { lab: LabMeta }) {
  const [s, set, reset] = useLabState<S>(lab.id, initS)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || s.phase !== 'work') return
    const timer = window.setInterval(() => {
      set((draft) => {
        draft.reactor = stepReactor(draft.reactor, draft.ctl, 2)
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, s.phase, set])

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Пульт реактора'), tr('Разбор варки')]}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={() => { setRunning(false); reset() }}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={s.reactor.minute > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const r = s.reactor
    const ctl = s.ctl
    const finish = () => {
      setRunning(false)
      const ev = evaluateReactorRun(r)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('варка ') + r.minute + tr(' мин · ')}${Math.round(ev.score * 100)} %`,
        { tempC: r.tempC, dropletUm: r.dropletUm, airPct: r.airPct, activeIntegrityPct: r.activeIntegrityPct },
        ev.score,
      )
    }

    return frame(
      <div className="reactor-work">
        <div className="reactor-grid">
          <section className="panel">
            <div className="sandbox-head-row">
              <h2>{tr('Вакуумный гомогенизатор (500 кг)')}</h2>
              <div className="row">
                <button
                  type="button"
                  className={`btn small ${running ? 'primary' : ''}`}
                  onClick={() => setRunning((v) => !v)}
                >
                  {running ? tr('⏸ Пауза') : tr('▶ Старт времени')}
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => set((x) => { x.reactor = stepReactor(x.reactor, x.ctl, 2) })}
                >
                  +2 {tr('мин')}
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => set((x) => { x.reactor = stepReactor(x.reactor, x.ctl, 5) })}
                >
                  +5 {tr('мин')}
                </button>
              </div>
            </div>

            <div className="reactor-vis-box">
              <ReactorSchematic r={r} ctl={ctl} running={running} />
            </div>

            <dl className="outcome reactor-gauges">
              <div><dt>{tr('Температура')}</dt><dd className="num">{r.tempC} °C</dd></div>
              <div><dt>{tr('Вакуум')}</dt><dd className="num">{r.vacuumBar} {tr('бар')}</dd></div>
              <div><dt>{tr('Воздух (норма ≤ 3 %)')}</dt><dd className="num">{r.airPct} %</dd></div>
              <div><dt>{tr('Капли (норма ≤ 4 мкм)')}</dt><dd className="num">{r.phaseBAdded ? `${r.dropletUm} ${tr('мкм')}` : '—'}</dd></div>
              <div><dt>{tr('Активы фазы C')}</dt><dd className="num">{r.activeIntegrityPct} %</dd></div>
              <div><dt>{tr('Сетка структуры')}</dt><dd className="num">{r.structurePct} %</dd></div>
            </dl>
          </section>

          <section className="panel">
            <h2>{tr('Пульт управления оператора')}</h2>

            <div className="reactor-ctl-block">
              <span className="eyebrow">{tr('1. Рубашка реактора')}</span>
              <div className="seg">
                {(['heat', 'off', 'cool'] as JacketMode[]).map((m) => (
                  <label key={m} className={ctl.jacket === m ? 'on' : ''}>
                    <input
                      type="radio"
                      name="jmode"
                      checked={ctl.jacket === m}
                      onChange={() => set((x) => {
                        x.ctl.jacket = m
                        if (language === 'en') {
                          const lbl = m === 'heat' ? 'Heating (+80 °C)' : m === 'cool' ? 'Cooling (+12 °C)' : 'Off'
                          x.reactor.events.push(`${x.reactor.minute} min: Jacket switched → ${lbl}.`)
                        } else {
                          const lbl = m === 'heat' ? 'Нагрев (+80 °C)' : m === 'cool' ? 'Охлаждение (+12 °C)' : 'Выкл'
                          x.reactor.events.push(`${x.reactor.minute} мин: Рубашка переключена → ${lbl}.`)
                        }
                      })}
                    />
                    {m === 'heat' ? tr('🔥 Нагрев (+80 °C)') : m === 'cool' ? tr('❄ Охлаждение (+12 °C)') : tr('Выкл')}
                  </label>
                ))}
              </div>
            </div>

            <div className="reactor-ctl-block">
              <span className="eyebrow">{tr('2. Приводы и вакуум')}</span>
              <div className="choices">
                <label className={`choice ${ctl.anchorOn ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ctl.anchorOn}
                    onChange={(e) => set((x) => {
                      x.ctl.anchorOn = e.target.checked
                      x.reactor.events.push(language === 'en'
                        ? `${x.reactor.minute} min: Anchor mixer ${e.target.checked ? 'started (35 rpm)' : 'stopped'}.`
                        : `${x.reactor.minute} мин: Якорная мешалка ${e.target.checked ? 'включена (35 об/мин)' : 'остановлена'}.`)
                    })}
                  />
                  <span><b>{tr('Якорная мешалка со скребками (35 об/мин)')}</b><small>{tr('Ускоряет нагрев и охлаждение, не даёт крему застывать на стенках.')}</small></span>
                </label>
                <label className={`choice ${ctl.vacuumOn ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ctl.vacuumOn}
                    onChange={(e) => set((x) => {
                      x.ctl.vacuumOn = e.target.checked
                      x.reactor.events.push(language === 'en'
                        ? `${x.reactor.minute} min: Vacuum pump ${e.target.checked ? 'turned on' : 'turned off'}.`
                        : `${x.reactor.minute} мин: Вакуумный насос ${e.target.checked ? 'включён' : 'выключен'}.`)
                    })}
                  />
                  <span><b>{tr('Вакуумный насос (−0,45 бар при > 62 °C / −0,65 бар при охлаждении)')}</b><small>{tr('Обязателен перед гомогенизацией для защиты от завоздушивания без вскипания горячей воды.')}</small></span>
                </label>
                <label className={`choice ${ctl.homogenizerOn ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={ctl.homogenizerOn}
                    onChange={(e) => set((x) => {
                      x.ctl.homogenizerOn = e.target.checked
                      x.reactor.events.push(language === 'en'
                        ? `${x.reactor.minute} min: Rotor-stator homogenizer ${e.target.checked ? 'started (3500 rpm)' : 'stopped'}.`
                        : `${x.reactor.minute} мин: Гомогенизатор ротор-статор ${e.target.checked ? 'включён (3500 об/мин)' : 'остановлен'}.`)
                    })}
                  />
                  <span><b>{tr('Гомогенизатор ротор-статор (3500 об/мин)')}</b><small>{tr('Дробит капли масла после ввода фазы B при 65–75 °C; нельзя включать на холодной сетке!')}</small></span>
                </label>
              </div>
            </div>

            <div className="reactor-ctl-block">
              <span className="eyebrow">{tr('3. Загрузка фаз и выгрузка')}</span>
              <div className="row">
                <button
                  type="button"
                  className={`btn ${r.phaseBAdded ? 'ghost' : ''}`}
                  disabled={r.phaseBAdded}
                  onClick={() => set((x) => { x.reactor = addPhaseB(x.reactor) })}
                >
                  {r.phaseBAdded ? `✓ ${tr('Фаза B введена')} (${r.phaseBAddTempC} °C)` : tr('Загрузить фазу B (масляную)')}
                </button>
                <button
                  type="button"
                  className={`btn ${r.phaseCAdded ? 'ghost' : ''}`}
                  disabled={r.phaseCAdded || !r.phaseBAdded}
                  onClick={() => set((x) => { x.reactor = addPhaseC(x.reactor) })}
                >
                  {r.phaseCAdded ? `✓ ${tr('Фаза C введена')} (${r.phaseCAddTempC} °C)` : tr('Загрузить фазу C (активы/консервант)')}
                </button>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button type="button" className="btn primary" onClick={finish}>
                  {tr('Завершить варку и передать партию в ОКК →')}
                </button>
              </div>
            </div>

            <div className="reactor-log">
              <span className="eyebrow">{tr('Журнал реактора')}</span>
              <ul className="small">
                {[...r.events].reverse().slice(0, 8).map((ev, i) => <li key={i}>{ev}</li>)}
              </ul>
            </div>
          </section>
        </div>
      </div>,
    )
  }

  const ev = evaluateReactorRun(s.reactor)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Протокол ОКК после выгрузки')}</p>
        <h1>{tr('Итог промышленной варки')} — {Math.round(ev.score * 100)} %</h1>
        <dl className="outcome">
          <div><dt>{tr('Время варки')}</dt><dd className="num">{s.reactor.minute} {tr('мин')}</dd></div>
          <div><dt>{tr('Размер капель')}</dt><dd className="num">{s.reactor.dropletUm} {tr('мкм')}</dd></div>
          <div><dt>{tr('Воздух')}</dt><dd className="num">{s.reactor.airPct} %</dd></div>
          <div><dt>{tr('Активы / Сетка')}</dt><dd className="num">{s.reactor.activeIntegrityPct}% / {s.reactor.structurePct}%</dd></div>
        </dl>
      </div>
      {ev.criteria.map((c) => (
        <div key={c.id} className={`drow ${c.verdict}`}>
          <h4><VerdictTag v={c.verdict} /> {c.title}</h4>
          <p>{c.detail}</p>
        </div>
      ))}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
