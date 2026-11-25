import { useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateChallengeTest, type ChallengeTestLabData } from '../../shared/package-b-sim'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  strainId?: string
  criterion?: 'A' | 'B' | 'fail'
  remedyId?: string
  transfer: Record<number, any>
  finished?: boolean
}

const STRAIN_COLORS = ['#0E7C7B', '#4B2E83', '#3FA7D6', '#C98A00', '#D9482B']

export default function ChallengeTest({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as ChallengeTestLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', transfer: {} }))
  const [warn, setWarn] = useState('')

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Протокол ISO 11930'), tr('Разбор теста')]}
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
        resumed={!!s.strainId || !!s.criterion}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  // Координаты графика Δlog КОЕ (-1.5 .. +5.0) на D0, D7, D14, D28
  const xAt = (idx: number) => 56 + idx * 155
  const yAt = (v: number) => 176 - ((v + 1.5) / 6.5) * 146

  if (s.phase === 'work') {
    const submit = () => {
      const miss = [
        !s.strainId && tr('провалившийся штамм'),
        !s.criterion && tr('вердикт ISO 11930'),
        !s.remedyId && tr('план корректировки'),
      ].filter(Boolean)
      if (miss.length) {
        setWarn(`${tr('Заполните: ')}${miss.join(', ')}.`)
        return
      }
      const ev = evaluateChallengeTest(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `ISO 11930 · ${Math.round(ev.score * 100)} %`,
        { strainId: s.strainId, criterion: s.criterion, remedyId: s.remedyId },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="panel">
          <p className="eyebrow">{data.formulaInfo}</p>
          <h2>{tr('Динамика снижения КОЕ (Δlog₁₀) за 28 суток по ISO 11930')}</h2>
          <p className="small">{tr('Положительное Δlog — гибель микроорганизмов (чем выше, тем лучше); отрицательное — рост микрофлоры в продукте.')}</p>
          <div className="table-wrap">
            <svg viewBox="0 0 560 212" className="trend-svg" role="img" aria-label={tr('График Challenge Test ISO 11930')}>
              {/* Нулевая линия (отсутствие роста) */}
              <line x1="56" y1={yAt(0)} x2="528" y2={yAt(0)} stroke="#D9482B" strokeDasharray="5 3" strokeWidth="1.4" />
              <text x="528" y={yAt(0) - 5} textAnchor="end" fontSize="9.5" fill="#D9482B">Δlog = 0 (граница роста)</text>
              {/* Линия +3 log (бактерии) */}
              <line x1="56" y1={yAt(3)} x2="528" y2={yAt(3)} stroke="#0E7C7B" strokeDasharray="4 4" strokeWidth="1" opacity="0.6" />
              <text x="528" y={yAt(3) - 4} textAnchor="end" fontSize="9" fill="#0E7C7B">+3 log (порог бактерий)</text>
              <line x1="56" y1="176" x2="528" y2="176" stroke="currentColor" opacity="0.25" />
              <line x1="56" y1="24" x2="56" y2="176" stroke="currentColor" opacity="0.25" />
              {['День 0', 'День 7', 'День 14', 'День 28'].map((lbl, idx) => (
                <text key={lbl} x={xAt(idx)} y="196" textAnchor="middle" fontSize="10.5" fill="currentColor">{tr(lbl)}</text>
              ))}
              {[-1, 0, 1, 2, 3, 4].map((v) => (
                <text key={v} x="46" y={yAt(v) + 3} textAnchor="end" fontSize="9.5" fill="currentColor" opacity="0.75">{v > 0 ? `+${v}` : v}</text>
              ))}
              {data.strains.map((st, si) => {
                const col = STRAIN_COLORS[si % STRAIN_COLORS.length]
                const vals = [0, st.logDropD7, st.logDropD14, st.logDropD28]
                const pts = vals.map((v, idx) => `${xAt(idx)},${yAt(v).toFixed(1)}`).join(' ')
                return (
                  <g key={st.id}>
                    <polyline points={pts} fill="none" stroke={col} strokeWidth={st.passedB ? 2 : 3} />
                    {vals.map((v, idx) => <circle key={idx} cx={xAt(idx)} cy={yAt(v)} r={idx === 0 ? 3 : 4} fill={col} />)}
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>{tr('Тест-штамм')}</th>
                  <th>D7 (Δlog)</th>
                  <th>D14 (Δlog)</th>
                  <th>D28 (Δlog)</th>
                  <th>{tr('Норма ISO 11930 (Критерий A / B)')}</th>
                </tr>
              </thead>
              <tbody>
                {data.strains.map((st, si) => (
                  <tr key={st.id}>
                    <td><span className="swdot" style={{ background: STRAIN_COLORS[si % STRAIN_COLORS.length] }} /><b>{st.name}</b></td>
                    <td className="num">{st.logDropD7 > 0 ? `+${st.logDropD7}` : st.logDropD7}</td>
                    <td className="num">{st.logDropD14 > 0 ? `+${st.logDropD14}` : st.logDropD14}</td>
                    <td className="num"><b>{st.logDropD28 > 0 ? `+${st.logDropD28}` : st.logDropD28}</b></td>
                    <td className="small">A: {st.isoA}<br />B: {st.isoB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">1</span>{tr('Какой тест-штамм полностью провалил даже Критерий B (дал рост микрофлоры)?')}</h3>
          <div className="choices">
            {data.strains.map((st) => (
              <label key={st.id} className={`choice ${s.strainId === st.id ? 'on' : ''}`}>
                <input type="radio" name="ct-strain" checked={s.strainId === st.id} onChange={() => set((x) => { x.strainId = st.id })} />
                <span>{st.name}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">2</span>{tr('Каков итоговый вердикт по протоколу ISO 11930?')}</h3>
          <div className="choices">
            {[
              { id: 'A' as const, label: tr('Соответствует Критерию A (разрешён выпуск в любой таре)') },
              { id: 'B' as const, label: tr('Соответствует Критерию B (выпуск с обоснованием защитной упаковки)') },
              { id: 'fail' as const, label: tr('Не соответствует ISO 11930 (выпуск запрещён, нужна доработка)') },
            ].map((opt) => (
              <label key={opt.id} className={`choice ${s.criterion === opt.id ? 'on' : ''}`}>
                <input type="radio" name="ct-crit" checked={s.criterion === opt.id} onChange={() => set((x) => { x.criterion = opt.id })} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">3</span>{tr('Выберите корректную технологическую доработку рецептуры и тары')}</h3>
          <div className="choices">
            {data.remedies.map((r) => (
              <label key={r.id} className={`choice ${s.remedyId === r.id ? 'on' : ''}`}>
                <input type="radio" name="ct-rem" checked={s.remedyId === r.id} onChange={() => set((x) => { x.remedyId = r.id })} />
                <span>{r.text}</span>
              </label>
            ))}
          </div>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>{tr('Подписать заключение ISO 11930 →')}</button>
      </div>,
    )
  }

  const ev = evaluateChallengeTest(data, s)
  const failedSt = data.strains.find((x) => x.id === data.failedStrainId)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Разбор протокола ISO 11930')}</p>
        <h1>{tr('Оценка Challenge Test')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      <div className={`drow ${ev.strainOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.strainOk ? 'ok' : 'wrong'} /> {tr('Провалившийся штамм:')} {failedSt?.name}</h4>
        <p>{tr('Отрицательные значения Δlog (−0,2 → −0,5 → −0,9) означают активный рост плесневого гриба в креме.')}</p>
      </div>
      <div className={`drow ${ev.critOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.critOk ? 'ok' : 'wrong'} /> {tr('Вердикт по ISO 11930')}</h4>
        <p>{data.criterionWhy}</p>
      </div>
      <div className={`drow ${ev.remedyOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.remedyOk ? 'ok' : 'wrong'} /> {tr('План доработки рецептуры')}</h4>
        <p>{ev.chosenRemedy?.why}</p>
      </div>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
