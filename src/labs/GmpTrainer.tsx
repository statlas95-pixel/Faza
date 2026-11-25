import { useState } from 'react'
import { tr } from '../../shared/locale'
import { evaluateGmp, type GmpLabData } from '../../shared/gmp'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  ccps: string[]
  deviations: string[]
  disposition?: string
  capa: string[]
  transfer: Record<number, any>
  finished?: boolean
}

export default function GmpTrainer({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as GmpLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({
    phase: 'brief',
    ccps: [],
    deviations: [],
    capa: [],
    transfer: {},
  }))
  const [warn, setWarn] = useState('')
  const stepsLabels = [tr('Вводная'), tr('Аудит Batch Record'), tr('Разбор QA')]

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
        resumed={s.ccps.length > 0 || s.deviations.length > 0 || !!s.disposition}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const toggle = (field: 'ccps' | 'deviations' | 'capa', id: string) => {
    set((x) => {
      const i = x[field].indexOf(id)
      if (i >= 0) x[field].splice(i, 1)
      else x[field].push(id)
    })
  }

  if (s.phase === 'work') {
    const submit = () => {
      const miss = [
        s.ccps.length === 0 && tr('критические контрольные точки (CCP)'),
        s.deviations.length === 0 && tr('отклонения в маршрутной карте'),
        !s.disposition && tr('решение по партии'),
        s.capa.length === 0 && tr('план CAPA'),
      ].filter(Boolean)
      if (miss.length) {
        setWarn(`${tr('Не заполнено: ')}${miss.join(', ')}.`)
        return
      }
      const ev = evaluateGmp(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `${tr('аудит Batch Record: ')}${Math.round(ev.score * 100)} %`,
        { ccpScore: ev.ccp.score, devScore: ev.deviations.score, capaScore: ev.capa.score },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="paper sheet">
          <div className="paper-head">
            <h2>{tr('Маршрутная карта партии (Batch Record)')}</h2>
            <dl>
              <div><dt>{tr('Партия')}</dt><dd>{data.batchMeta.batchNo}</dd></div>
              <div><dt>{tr('Продукт')}</dt><dd>{data.batchMeta.product}</dd></div>
              <div><dt>{tr('Оборудование')}</dt><dd>{data.batchMeta.equipment}</dd></div>
              <div><dt>{tr('Загрузка / дата')}</dt><dd>{data.batchMeta.batchSize} · {data.batchMeta.date}</dd></div>
            </dl>
          </div>
          <p className="small">
            {tr('Отметьте в таблице строки, которые являются критическими контрольными точками (CCP), и строки, где допущено отклонение GMP.')}
          </p>
          <div className="table-wrap">
            <table className="gmp-table">
              <thead>
                <tr>
                  <th>{tr('Время')}</th>
                  <th>{tr('Этап и спецификация')}</th>
                  <th>{tr('Фактическая запись и подписи')}</th>
                  <th>{tr('CCP')}</th>
                  <th>{tr('Отклонение')}</th>
                </tr>
              </thead>
              <tbody>
                {data.steps.map((st) => {
                  const isCcp = s.ccps.includes(st.id)
                  const isDev = s.deviations.includes(st.id)
                  return (
                    <tr key={st.id} className={isDev ? 'gmp-row-dev' : ''}>
                      <td className="num">{st.time}</td>
                      <td>
                        <b>{st.stage}</b>
                        <div className="small">{tr('Норма: ')}{st.spec}</div>
                      </td>
                      <td>
                        <div>{st.recorded}</div>
                        <div className="small">{st.signoff}</div>
                      </td>
                      <td className="gmp-check">
                        <input
                          type="checkbox"
                          aria-label={`${tr('CCP')}: ${st.stage}`}
                          checked={isCcp}
                          onChange={() => toggle('ccps', st.id)}
                        />
                      </td>
                      <td className="gmp-check">
                        <input
                          type="checkbox"
                          aria-label={`${tr('Отклонение')}: ${st.stage}`}
                          checked={isDev}
                          onChange={() => toggle('deviations', st.id)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="stamp" aria-hidden>{tr('УЧЕБНЫЙ BATCH RECORD')}</p>
        </section>

        <section className="panel">
          <h3><span className="ptag">1</span>{tr('Решение QA по судьбе партии')}</h3>
          <div className="choices">
            {data.dispositions.map((d) => (
              <label key={d.id} className={`choice ${s.disposition === d.id ? 'on' : ''}`}>
                <input
                  type="radio"
                  name="gmp-disp"
                  checked={s.disposition === d.id}
                  onChange={() => set((x) => { x.disposition = d.id })}
                />
                <span>{d.title}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">2</span>{tr('План корректирующих и предупреждающих действий (CAPA)')}</h3>
          <p className="small">{tr('Выберите все корректные меры по ISO 22716 и отсейте недопустимые или формальные действия.')}</p>
          <div className="choices">
            {data.capa.map((c) => {
              const on = s.capa.includes(c.id)
              return (
                <label key={c.id} className={`choice ${on ? 'on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle('capa', c.id)} />
                  <span>
                    <span className="tag">{c.kind === 'corrective' ? tr('Корректирующее') : tr('Предупреждающее')}</span>{' '}
                    {c.title}
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Завершить аудит и оформить протокол QA')}
        </button>
      </div>,
    )
  }

  // ---------- Разбор ----------
  const ev = evaluateGmp(data, s)
  const scorePct = Math.round(ev.score * 100)

  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог аудита GMP')}</p>
        <h1>{tr('Протокол разбора Batch Record')} — {scorePct} %</h1>
      </div>

      <dl className="outcome">
        <div><dt>{tr('Выявление отклонений')}</dt><dd>{Math.round(ev.deviations.score * 100)} %</dd></div>
        <div><dt>{tr('План CAPA')}</dt><dd>{Math.round(ev.capa.score * 100)} %</dd></div>
        <div><dt>{tr('Решение по партии')}</dt><dd>{Math.round(ev.dispositionScore * 100)} %</dd></div>
        <div><dt>{tr('Точки CCP')}</dt><dd>{Math.round(ev.ccp.score * 100)} %</dd></div>
      </dl>

      <section className="panel">
        <h2>{tr('Разбор этапов маршрутной карты')}</h2>
        {data.steps.map((st) => {
          const pickedDev = s.deviations.includes(st.id)
          const pickedCcp = s.ccps.includes(st.id)
          const devMatch = pickedDev === st.hasDeviation
          const ccpMatch = pickedCcp === st.isCcp
          const cls = devMatch && ccpMatch ? 'ok' : devMatch ? 'weak' : 'wrong'
          return (
            <div key={st.id} className={`drow ${cls}`}>
              <h4>
                {st.time} · {st.stage}{' '}
                {st.isCcp && <span className="tag">CCP</span>}{' '}
                {st.hasDeviation && <span className="gapmark">{tr('Отклонение')}</span>}
              </h4>
              <p>{st.deviationWhy}</p>
              <p className="small"><b>{tr('Про CCP: ')}</b>{st.ccpWhy}</p>
              <p className="yours">
                {tr('Ваши отметки: ')}
                CCP — {pickedCcp ? tr('да') : tr('нет')}, {tr('отклонение')} — {pickedDev ? tr('да') : tr('нет')}.
              </p>
            </div>
          )
        })}
      </section>

      <section className="panel">
        <h2>{tr('Решение по партии')}</h2>
        {ev.disposition && (
          <div className={`drow ${ev.disposition.verdict}`}>
            <h4><VerdictTag v={ev.disposition.verdict} /> {ev.disposition.title}</h4>
            <p>{ev.disposition.why}</p>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>{tr('Разбор плана CAPA')}</h2>
        {data.capa.map((c) => {
          const picked = s.capa.includes(c.id)
          const ok = picked === c.valid
          return (
            <div key={c.id} className={`drow ${ok ? 'ok' : 'wrong'}`}>
              <h4>{c.title}</h4>
              <p>{c.why}</p>
              <p className="yours">
                {picked ? tr('Вы выбрали эту меру.') : tr('Вы не выбрали эту меру.')}{' '}
                {c.valid ? tr('Требуется по GMP.') : tr('Недопустимая или ошибочная мера.')}
              </p>
            </div>
          )
        })}
      </section>

      <Transfer
        lab={lab}
        answers={s.transfer}
        onAnswer={(i, v) => set((x) => { x.transfer[i] = v })}
      />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
