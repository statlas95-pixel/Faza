import { useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateCoaAudit, type CoaDecision, type CoaLabData } from '../../shared/domain-trainers'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  decisions: Record<string, CoaDecision | undefined>
  transfer: Record<number, any>
  finished?: boolean
}

const decLabels: Record<CoaDecision, string> = {
  approve: tr('Одобрить в производство'),
  quarantine: tr('Направить в карантин (до проверки QC/CoA)'),
  reject: tr('Отклонить (брак / возврат поставщику)'),
}

export default function CoaAudit({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as CoaLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', decisions: {}, transfer: {} }))
  const [warn, setWarn] = useState('')
  const stepsLabels = [tr('Вводная'), tr('Проверка CoA'), tr('Протокол QC')]

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
        resumed={Object.keys(s.decisions).length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const submit = () => {
      const missing = data.lots.filter((l) => !s.decisions[l.id])
      if (missing.length) {
        setWarn(`${tr('Вынесите решение по всем партиям (осталось: ')}${missing.length}).`)
        return
      }
      const ev = evaluateCoaAudit(data, s.decisions)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('входной контроль CoA: ')}${Math.round(ev.score * 100)} %`,
        { decisions: s.decisions },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <p className="small"><b>{tr('Дата проверки QC:')}</b> {data.checkDate}</p>
        {data.lots.map((lot, idx) => (
          <section key={lot.id} className="paper sheet">
            <div className="paper-head">
              <h3>{idx + 1}. {lot.material} (<code>{lot.inci}</code>)</h3>
              <dl>
                <div><dt>{tr('Поставщик')}</dt><dd>{lot.supplier}</dd></div>
                <div><dt>{tr('Партия (Lot №)')}</dt><dd>{lot.lotNo}</dd></div>
                <div><dt>{tr('Годен / переконтроль')}</dt><dd>{lot.retestDate}</dd></div>
                <div><dt>{tr('Подпись QA')}</dt><dd>{lot.signoff}</dd></div>
              </dl>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr('Показатель')}</th>
                    <th>{tr('Спецификация')}</th>
                    <th>{tr('Результат в CoA')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lot.rows.map((r) => (
                    <tr key={r.param}>
                      <td>{r.param}</td>
                      <td className="num">{r.spec}</td>
                      <td className="num">{r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="choices coa-choices">
              {(['approve', 'quarantine', 'reject'] as CoaDecision[]).map((d) => (
                <label key={d} className={`choice ${s.decisions[lot.id] === d ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name={`coa-${lot.id}`}
                    checked={s.decisions[lot.id] === d}
                    onChange={() => set((x) => { x.decisions[lot.id] = d })}
                  />
                  <span>{decLabels[d]}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Оформить ярлыки статуса QC')}
        </button>
      </div>,
    )
  }

  const ev = evaluateCoaAudit(data, s.decisions)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог входного контроля')}</p>
        <h1>{tr('Протокол проверки CoA')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      {ev.items.map((item) => (
        <div key={item.lot.id} className={`drow ${item.verdict}`}>
          <h4><VerdictTag v={item.verdict} /> {item.lot.material}</h4>
          <p>{item.lot.why}</p>
          <p className="yours">
            {tr('Ваш статус: ')}<b>{item.picked ? decLabels[item.picked] : '—'}</b> · {tr('Ожидалось: ')}<b>{decLabels[item.lot.expected]}</b>
          </p>
        </div>
      ))}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
