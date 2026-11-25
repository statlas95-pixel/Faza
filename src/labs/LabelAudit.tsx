import { useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateLabelAudit, type LabelAuditLabData } from '../../shared/domain-trainers'
import type { LabMeta } from '../content'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  flagged: string[]
  transfer: Record<number, any>
  finished?: boolean
}

const sectionNames: Record<string, string> = {
  front: tr('Лицевая сторона'),
  inci: tr('Список INCI'),
  claims: tr('Клеймы и заявления'),
  mandatory: tr('Обязательные реквизиты'),
}

export default function LabelAudit({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as LabelAuditLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', flagged: [], transfer: {} }))
  const [warn, setWarn] = useState('')
  const stepsLabels = [tr('Вводная'), tr('Аудит макета'), tr('Заключение')]

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
        resumed={s.flagged.length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const toggle = (id: string) => {
    set((x) => {
      const i = x.flagged.indexOf(id)
      if (i >= 0) x.flagged.splice(i, 1)
      else x.flagged.push(id)
    })
  }

  if (s.phase === 'work') {
    const submit = () => {
      if (s.flagged.length === 0) {
        setWarn(tr('Отметьте хотя бы одно нарушение на макете этикетки.'))
        return
      }
      const ev = evaluateLabelAudit(data, s.flagged)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('аудит этикетки: ')}${Math.round(ev.score * 100)} %`,
        { hits: ev.hits.length, missed: ev.missed.length, extra: ev.extra.length },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="paper sheet">
          <div className="paper-head">
            <h2>{data.productTitle}</h2>
            <p className="small">{data.formulaNote}</p>
          </div>
          <p className="small">{tr('Отметьте галочкой все фрагменты макета, которые нарушают EU 1223/2009 и ТР ТС 009/2011 (корректные элементы оставьте неотмеченными):')}</p>
          <div className="choices">
            {data.items.map((item) => {
              const on = s.flagged.includes(item.id)
              return (
                <label key={item.id} className={`choice ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(item.id)} />
                  <span>
                    <span className="tag">{sectionNames[item.section] ?? item.section}</span>{' '}
                    {item.snippet}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="stamp" aria-hidden>{tr('ПРОЕКТ ЭТИКЕТКИ')}</p>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Отправить заключение по макету')}
        </button>
      </div>,
    )
  }

  const ev = evaluateLabelAudit(data, s.flagged)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог регуляторного аудита')}</p>
        <h1>{tr('Заключение по макету этикетки')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      {data.items.map((item) => {
        const picked = s.flagged.includes(item.id)
        const ok = picked === item.hasViolation
        return (
          <div key={item.id} className={`drow ${ok ? 'ok' : 'wrong'}`}>
            <h4>
              <span className="tag">{item.standard}</span>{' '}
              {item.snippet}
            </h4>
            <p>{item.why}</p>
            <p className="yours">
              {picked ? tr('Вы отметили как нарушение.') : tr('Вы оставили без замечаний.')}{' '}
              {item.hasViolation ? tr('Это нарушение регламента.') : tr('Элемент корректен.')}
            </p>
          </div>
        )
      })}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
