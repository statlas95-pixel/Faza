import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import { evaluateReverseInci, type ReverseInciLabData } from '../../shared/reactor-sim'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  marker?: string
  phases: Record<string, 'A' | 'B' | 'C'>
  qAnswers: Record<string, string>
  transfer: Record<number, any>
  finished?: boolean
}

export default function ReverseInci({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as ReverseInciLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({
    phase: 'brief',
    phases: {},
    qAnswers: {},
    transfer: {},
  }))
  const [warn, setWarn] = useState('')

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Разбор INCI'), tr('Итоги анализа')]}
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
        resumed={!!s.marker || Object.keys(s.phases).length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const submit = () => {
      const miss: string[] = []
      if (!s.marker) miss.push(tr('маркер границы 1 %'))
      if (data.phaseTargets.some((t) => !s.phases[t.inci])) miss.push(tr('распределение компонентов по фазам'))
      if (data.questions.some((q) => !s.qAnswers[q.id])) miss.push(tr('ответы на технологические вопросы'))
      if (miss.length) {
        setWarn(`${tr('Заполните все шаги: ')}${miss.join(', ')}.`)
        return
      }
      const ev = evaluateReverseInci(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('реверс-инжиниринг INCI · ')}${Math.round(ev.score * 100)} %`,
        { marker: s.marker, phases: s.phases },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        {/* Этикетка конкурента */}
        <section className="paper sheet">
          <div className="paper-head">
            <h2>{data.productName}</h2>
            <p className="small">{data.claims}</p>
          </div>
          <p className="small"><b>INGREDIENTS (INCI):</b> {data.inciList.map((x) => x.inci).join(', ')}.</p>
          <p className="stamp" aria-hidden>{tr('УЧЕБНАЯ ЭТИКЕТКА')}</p>
        </section>

        {/* Шаг 1: Граница 1% */}
        <section className="panel">
          <h3><span className="ptag">1</span>{tr('Укажите на этикетке компонент-маркер границы 1 %')}</h3>
          <p className="small">{tr('Кликните по ингредиенту со строгим законодательным пределом 1,0 % — всё правее него введено ≤ 1 %.')}</p>
          <div className="row">
            {data.inciList.map((item) => (
              <button
                key={item.inci}
                type="button"
                className={`chip ${s.marker === item.inci ? 'on' : ''}`}
                onClick={() => set((x) => { x.marker = item.inci })}
              >
                {item.inci}
              </button>
            ))}
          </div>
        </section>

        {/* Шаг 2: Фазы A / B / C */}
        <section className="panel">
          <h3><span className="ptag">2</span>{tr('Разнесите ключевые компоненты по технологическим фазам A / B / C')}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>INCI</th>
                  <th>{tr('Фаза ввода')}</th>
                </tr>
              </thead>
              <tbody>
                {data.phaseTargets.map((t) => (
                  <tr key={t.inci}>
                    <td><b>{t.inci}</b></td>
                    <td>
                      <div className="phase-switch">
                        {(['A', 'B', 'C'] as const).map((ph) => (
                          <button
                            key={ph}
                            type="button"
                            className={`phase-btn p-${ph} ${s.phases[t.inci] === ph ? 'on' : ''}`}
                            onClick={() => set((x) => { x.phases[t.inci] = ph })}
                          >
                            {tr('Фаза')} {ph}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Шаг 3: Технологические вопросы */}
        {data.questions.map((q, qi) => (
          <section key={q.id} className="panel">
            <h3><span className="ptag">{qi + 3}</span>{q.prompt}</h3>
            <div className="choices">
              {q.options.map((o) => (
                <label key={o.id} className={`choice ${s.qAnswers[q.id] === o.id ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name={`ri-${q.id}`}
                    checked={s.qAnswers[q.id] === o.id}
                    onChange={() => set((x) => { x.qAnswers[q.id] = o.id })}
                  />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Проверить реверс-инжиниринг →')}
        </button>
      </div>,
    )
  }

  const ev = evaluateReverseInci(data, s)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Разбор INCI конкурента')}</p>
        <h1>{tr('Точность анализа этикетки')} — {Math.round(ev.score * 100)} %</h1>
      </div>

      <div className={`drow ${ev.markerOk ? 'ok' : 'wrong'}`}>
        <h4>
          <VerdictTag v={ev.markerOk ? 'ok' : 'wrong'} /> {tr('Маркер границы 1 %:')} {s.marker} ({tr('эталон:')} {data.onePercentMarker})
        </h4>
        <p>{data.onePercentWhy}</p>
      </div>

      <section className="panel">
        <h3>{tr('Распределение по фазам A / B / C')}</h3>
        {ev.phaseResults.map((r) => (
          <div key={r.inci} className={`drow ${r.ok ? 'ok' : 'wrong'}`}>
            <h4><VerdictTag v={r.ok ? 'ok' : 'wrong'} /> {r.inci}: {tr('ваш выбор')} {r.chosen} · {tr('верно')} {r.expected}</h4>
            <p>{r.why}</p>
          </div>
        ))}
      </section>

      {ev.qResults.map((r) => (
        <div key={r.q.id} className={`drow ${r.ok ? 'ok' : 'wrong'}`}>
          <h4><VerdictTag v={r.ok ? 'ok' : 'wrong'} /> {r.q.prompt}</h4>
          <p>{r.opt?.why}</p>
        </div>
      ))}

      <section className="panel">
        <h3>{tr('Собрать эту базу своими руками')}</h3>
        <p className="small">{tr('Перейдите в Лабораторию рецептур — все компоненты из этой этикетки уже есть в каталоге сырья (130 позиций), вы можете собрать аналог и поставить его на термостат.')}</p>
        <Link className="btn primary" to="/sandbox?template=reverse-inci">{tr('Перенести скелет этой формулы в Лабораторию →')}</Link>
      </section>

      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
