import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import type { StatisticsReport } from '../../shared/statistics'
import { api, useAccount } from '../account'
import { labById, topicById } from '../content'
import { browserOptsOut, setStatisticsEnabled, statisticsEnabled } from '../statistics'
import { useTitle } from './util'

export function StatisticsPreference() {
  const [enabled, setEnabled] = useState(statisticsEnabled)
  if (location.protocol === 'file:') return null
  return <section className="panel"><h2>{tr("Статистика посещений")}</h2>
    <p>{tr("Случайный идентификатор в этом браузере помогает подсчитать посещения открытых страниц и завершения занятий. Отчёт хранит суточные итоги за 30 дней. Ответы и поисковые запросы в него не входят.")}</p>
    <label><input type="checkbox" checked={enabled} disabled={browserOptsOut()} onChange={e => {
      setStatisticsEnabled(e.target.checked)
      setEnabled(statisticsEnabled())
    }} /> {tr("Учитывать активность этого браузера")}</label>
    {browserOptsOut() && <p>{tr("Сбор отключён настройками конфиденциальности браузера.")}</p>}
  </section>
}

export default function StatisticsPage() {
  useTitle(tr("Статистика сайта"))
  const acc = useAccount()
  const [days, setDays] = useState(7)
  const [report, setReport] = useState<StatisticsReport | null>(null)
  const [error, setError] = useState('')
  const allowed = acc.status === 'user' && acc.user?.canReadStatistics
  useEffect(() => {
    setReport(null)
    setError('')
    if (!allowed) return
    const abort = new AbortController()
    api<StatisticsReport>('GET', '/api/statistics?days=' + days, undefined, abort.signal)
      .then(data => { if (!abort.signal.aborted) setReport(data) })
      .catch(e => { if (!abort.signal.aborted) setError(e.message) })
    return () => abort.abort()
  }, [days, allowed, acc.user?.id])
  const sum = (key: 'views' | 'completions') => report?.daily.reduce((total, row) => total + row[key], 0) ?? 0
  return <div className="page"><h1>{tr("Статистика сайта")}</h1>
    {!allowed ? <p>{acc.status === 'checking' ? tr("Загружаю…") : acc.status === 'user' ? tr("У этого аккаунта нет доступа к отчёту.") : <Link to="/account">{tr("Войти в аккаунт")}</Link>}</p> : <>
      <label>{tr("Период отчёта")} <select value={days} onChange={e => setDays(Number(e.target.value))}>
        <option value="1">{tr("Сегодня")}</option><option value="7">{tr("7 дней")}</option><option value="30">{tr("30 дней")}</option>
      </select></label>
      {!report ? <p role="status">{error || tr("Загружаю…")}</p> : <>
        <p>{report.start} — {report.end} (UTC) · {tr("Начало сбора")} {report.collectionStart}</p>
        <dl className="traffic-totals">{[
          [tr("Уникальные браузеры"), report.visitors],
          [tr("Активны в разные дни периода"), report.returning],
          [tr("Просмотры страниц"), sum('views')],
          [tr("Завершения занятий"), sum('completions')],
          [tr("Аккаунты на сайте сейчас"), report.accounts],
        ].map(([title, value]) => <div className="panel" key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>
        <p>{tr("Один браузер учитывается один раз за период. Другой браузер или очистка хранилища создают новый идентификатор. Повторное прохождение занятия даёт ещё одно завершение.")}</p>
        <h2>{tr("По дням")}</h2><div className="table-wrap"><table><thead><tr>
          <th>{tr("Дата")}</th><th>{tr("Браузеры")}</th><th>{tr("Просмотры")}</th><th>{tr("Завершения")}</th>
        </tr></thead><tbody>{[...report.daily].reverse().map(row => <tr key={row.day}><th scope="row">{row.day}</th>{[row.visitors, row.views, row.completions].map((value, column) => <td key={column}>{row.day < report.collectionStart ? '—' : value}</td>)}</tr>)}</tbody></table></div>
        <h2>{tr("Популярные темы и занятия")}</h2>{report.popular.length === 0 ? <p>{tr("За этот период данных о материалах пока нет.")}</p> :
          <div className="table-wrap"><table><thead><tr><th>{tr("Материал")}</th><th>{tr("Просмотры")}</th><th>{tr("Завершения")}</th></tr></thead>
          <tbody>{report.popular.map(row => {
            const [, kind, id] = row.page.split('/')
            const material = kind === 'labs' ? labById(id) : topicById(id)
            return <tr key={row.page}><th scope="row"><Link to={row.page}>{material?.title ?? id}</Link></th><td>{row.views}</td><td>{kind === 'labs' ? row.completions : '—'}</td></tr>
          })}</tbody></table></div>}
      </>}
    </>}
  </div>
}
