import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import { DAILY_CASES, getDailyCase } from '../../shared/daily-case'

/** Интерактивный блок «Микро-кейс дня» (3 минуты) на Главной странице. */
export function DailyCaseCard() {
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const item = getDailyCase(new Date(), offset)
  const chosen = item.options.find((o) => o.id === picked)

  function nextCase() {
    setOffset((o) => (o + 1) % DAILY_CASES.length)
    setPicked(null)
  }

  return (
    <section className="daily-case panel" aria-label={tr('Микро-кейс дня')}>
      <div className="daily-case-head">
        <div>
          <span className="eyebrow">⚡ {tr('Микро-кейс дня')} · {tr(item.tag)}</span>
          <h2>{tr(item.question)}</h2>
        </div>
        <button type="button" className="btn small ghost" onClick={nextCase}>
          {tr('Другой кейс ↻')}
        </button>
      </div>

      <div className="daily-opts" role="radiogroup" aria-label={tr('Варианты ответа')}>
        {item.options.map((o) => {
          const isPicked = picked === o.id
          const cls = isPicked ? (o.correct ? 'opt ok' : 'opt wrong') : 'opt'
          return (
            <label key={o.id} className={cls}>
              <input
                type="radio"
                name={`daily-${item.id}`}
                checked={isPicked}
                onChange={() => setPicked(o.id)}
              />
              <span>{tr(o.text)}</span>
            </label>
          )
        })}
      </div>

      {chosen && (
        <div className={`fb ${chosen.correct ? 'ok' : 'wrong'}`} role="status">
          <b>{chosen.correct ? tr('✓ Верно!') : tr('✕ Не совсем так.')}</b> {tr(chosen.why)}{' '}
          <Link to={item.linkTo}>{tr(item.linkLabel)} →</Link>
        </div>
      )}
    </section>
  )
}
