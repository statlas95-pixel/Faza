import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import { DAILY_CASES, getDailyCase } from '../../shared/daily-case'

const DAILY_SOLVED_KEY = 'faza.daily.solved.v1'

function loadSolvedIds(): string[] {
  try {
    const raw = localStorage.getItem(DAILY_SOLVED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Интерактивный блок «Микро-кейс дня» (3 минуты) на Главной странице. */
export function DailyCaseCard() {
  const [offset, setOffset] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [solvedIds, setSolvedIds] = useState<string[]>(() => loadSolvedIds())
  const item = getDailyCase(new Date(), offset)
  const chosen = item.options.find((o) => o.id === picked)

  function handlePick(optId: string) {
    setPicked(optId)
    const opt = item.options.find((o) => o.id === optId)
    if (opt?.correct && !solvedIds.includes(item.id)) {
      const next = [...solvedIds, item.id]
      setSolvedIds(next)
      try { localStorage.setItem(DAILY_SOLVED_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    }
  }

  function nextCase() {
    setOffset((o) => (o + 1) % DAILY_CASES.length)
    setPicked(null)
  }

  return (
    <section className="daily-case panel" aria-label={tr('Микро-кейс дня')}>
      <div className="daily-case-head">
        <div>
          <span className="eyebrow">
            ⚡ {tr('Микро-кейс дня')} · {tr(item.tag)} · {tr('Решено:')} {solvedIds.length} / {DAILY_CASES.length}
          </span>
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
                onChange={() => handlePick(o.id)}
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
