import { StatisticsPreference } from './Statistics'
import { tr, language } from '../../shared/locale'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { terms, sources, topics, labs, topicById, sourceById, sourceTypeLabel, labById, termById, termAreas } from '../content'
import { Md } from '../md'
import { ConfirmButton } from '../ui'
import { resetProgress, useProgress, toggleBookmark } from '../store'
import { useAccount, api } from '../account'
import { useState } from 'react'
import { useTitle } from './util'
import aboutRaw from '/content/about.md?raw'

function useScrollTo(id?: string) {
  useEffect(() => {
    if (!id) return
    // Дождаться шрифтов: иначе длинный словарь меняет высоту после прокрутки.
    let cancelled = false, frame = 0
    void document.fonts.ready.then(() => {
      if (!cancelled) frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'instant' }))
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [id])
}

export function Glossary() {
  const { id } = useParams()
  const [q, setQ] = useState(''), [area, setArea] = useState('all'), [lvl, setLvl] = useState('all')
  useTitle(tr("Словарь"))
  useEffect(() => { if (id) { setQ(''); setArea('all'); setLvl('all') } }, [id])
  const norm = (x: string) => x.toLowerCase().replace(/ё/g, 'е')
  const list = terms.filter((t) => (area === 'all' || t.area === area) && (lvl === 'all' || (t.level ?? 'base') === lvl) && (!q || norm(`${t.term} ${t.en ?? ''} ${t.short}`).includes(norm(q.trim()))))
  useScrollTo(id && list.some((t) => t.id === id) ? `t-${id}` : undefined)
  const letters = [...new Set(list.map((t) => t.term[0].toUpperCase()))]
  const counts = Object.fromEntries(Object.keys(termAreas).map((k) => [k, terms.filter((t) => t.area === k).length]))
  return (
    <div className="page glossary-page">
      <h1>{tr("Словарь")}</h1>
      <p className="lead">{terms.length}{tr(" терминов — от базовых понятий химии растворов до коллоидной химии и процессов и аппаратов. У каждого — определение, английский эквивалент для поиска литературы и переходы к темам и источникам.")}</p>
      <div className="gfilters">
        <label className="sr" htmlFor="gq">{tr("Найти термин")}</label>
        <input id="gq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Найти термин: вязкость, буфер, ККМ, Рейнольдс…")} />
        <div className="filters" role="group" aria-label={tr("Область")}>
          <button className={`chip ${area === 'all' ? 'on' : ''}`} aria-pressed={area === 'all'} onClick={() => setArea('all')}>{tr("Все области")}</button>
          {Object.entries(termAreas).filter(([k]) => counts[k]).map(([k, l]) => <button key={k} className={`chip ${area === k ? 'on' : ''}`} aria-pressed={area === k} onClick={() => setArea(k)}>{l} <span className="num dim">{counts[k]}</span></button>)}
        </div>
        <div className="filters" role="group" aria-label={tr("Уровень")}>
          {[['all', tr("Любой уровень")], ['base', tr("Базовые")], ['adv', tr("Углублённые")]].map(([k, l]) => <button key={k} className={`chip ${lvl === k ? 'on' : ''}`} aria-pressed={lvl === k} onClick={() => setLvl(k)}>{l}</button>)}
        </div>
      </div>
      <nav className="alpha" aria-label={tr("Алфавитный указатель")}>{letters.map((L) => <a key={L} href={`#g-${L}`} onClick={(e) => { e.preventDefault(); document.getElementById(`g-${L}`)?.scrollIntoView({ block: 'start' }) }}>{L}</a>)}</nav>
      <p className="small" role="status">{tr("Показано: ")}{list.length}</p>
      <dl className="glossary">
        {list.map((t, i) => (
          <div key={t.id} id={`t-${t.id}`} className={id === t.id ? 'hl' : ''}>
            {(i === 0 || list[i - 1].term[0].toUpperCase() !== t.term[0].toUpperCase()) && <span id={`g-${t.term[0].toUpperCase()}`} className="anchor" />}
            <dt>{t.term}{t.en && <span className="en"> · {t.en}</span>} <span className={`glv ${t.level === 'adv' ? 'adv' : 'base'}`}>{t.level === 'adv' ? tr("углублённый") : tr("базовый")}</span>{t.area && <span className="garea">{termAreas[t.area]}</span>}</dt>
            <dd>
              <p>{t.short}</p>{t.long && <p className="small">{t.long}</p>}
              <p className="links small">
                {t.see?.map((x) => termById(x)).filter(Boolean).map((x) => <Link key={x!.id} to={`/glossary/${x!.id}`}>{tr("См. также: ")}{x!.term}</Link>)}
                {t.topics?.map((x) => topicById(x)).filter(Boolean).map((x) => <Link key={x!.id} to={`/topics/${x!.id}`}>{tr("Тема: ")}{x!.title}</Link>)}
                {t.sources?.map((x) => sourceById(x)).filter(Boolean).map((x) => <Link key={x!.id} to={`/sources/${x!.id}`}>{tr("Источник: ")}{x!.authors.split(',')[0]}, {x!.year}</Link>)}
              </p>
            </dd>
          </div>))}
      </dl>
      {!list.length && <p className="muted">{tr("Ничего не найдено. Попробуйте другое слово или снимите фильтры.")}</p>}
    </div>)
}

export function Sources() {
  const { id } = useParams()
  useTitle(tr("Источники")); useScrollTo(id && `s-${id}`)
  const usedIn = (sid: string) => topics.filter((t) => t.body.includes(`@${sid}`))
  const types = [...new Set(sources.map((s) => s.type))]
  return (
    <div className="page">
      <h1>{tr("Источники")}</h1>
      <p className="lead">{tr("Для каждого источника указано, какое утверждение он подтверждает и до какой глубины проверен. DOI и ссылки приведены только там, где их удалось подтвердить.")}</p>
      {types.map((ty) => (
        <section key={ty}>
          <h2>{sourceTypeLabel[ty] ?? ty}</h2>
          <ul className="sources">
            {sources.filter((s) => s.type === ty).map((s) => (
              <li key={s.id} id={`s-${s.id}`} className={id === s.id ? 'hl' : ''}>
                <p className="cit"><b>{s.authors}</b> ({s.year}). {s.title}. <i>{s.where}</i>.</p>
                <p className="small">
                  {s.doi && <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer">doi:{s.doi}</a>}
                  {s.url && <> <a href={s.url} target="_blank" rel="noreferrer">{s.url.replace(/^https?:\/\//, '').slice(0, 60)}</a></>}
                  {!s.doi && !s.url && <span className="muted">{tr("Стабильная ссылка не подтверждена")}</span>}
                </p>
                <dl className="srcmeta">
                  <dt>{tr("Подтверждает")}</dt><dd>{s.supports}</dd>
                  <dt>{tr("Как проверен")}</dt><dd>{s.verified}</dd>
                  {s.note && <><dt>{tr("Примечание")}</dt><dd>{s.note}</dd></>}
                  <dt>{tr("Используется")}</dt><dd>{usedIn(s.id).length ? usedIn(s.id).map((t, i) => <span key={t.id}>{i > 0 && '; '}<Link to={`/topics/${t.id}`}>{t.title}</Link></span>) : tr("в справочных разделах и занятиях")}</dd>
                </dl>
              </li>))}
          </ul>
        </section>))}
    </div>)
}

export function Journal() {
  useTitle(tr("Мой журнал"))
  const p = useProgress(), a = useAccount()
  const visited = topics.filter((t) => p.visited[t.id])
  const inProgress = labs.filter((l) => p.labs[l.id] && !p.labs[l.id].finished)
  const checksRight = (tid: string) => { const t = topicById(tid)!; const a = p.checks[tid] ?? {}; return t.checks.filter((c, i) => a[i] !== undefined && c.options[a[i]]?.correct).length }
  return (
    <div className="page">
      <h1>{tr("Мой журнал")}</h1>
      <p className="lead">{a.status === 'user' ? `${tr("Вы вошли как ")}${a.user?.name}${tr(": прогресс сохраняется на сервере и доступен с других устройств.")}` : a.status === 'guest' ? <>{tr("Прогресс хранится в этом браузере. ")}<Link to="/account">{tr("Войдите")}</Link>{tr(", чтобы сохранять его в аккаунте.")}</> : tr("Прогресс хранится в этом браузере.")}</p>
      <div className="journal">
        <section><h2>{tr("Продолжить")}</h2>
          {p.last ? <p><Link className="btn" to={p.last.path}>{p.last.title.replace(/ — Фаза$/, '')}</Link></p> : <p className="muted">{tr("Вы ещё ничего не открывали. ")}<Link to="/catalog">{tr("К темам")}</Link></p>}
          {inProgress.length > 0 && <><h3>{tr("Незавершённые занятия")}</h3><ul>{inProgress.map((l) => <li key={l.id}><Link to={`/labs/${l.id}`}>{l.title}</Link>{tr(" — сохранено, можно продолжить")}</li>)}</ul></>}
        </section>
        <section><h2>{tr("Закладки")}</h2>
          {p.bookmarks.length ? <ul className="bms">{p.bookmarks.map((b) => (
            <li key={b.path}><Link to={b.path}><span className="kindtag">{b.kind}</span> {b.title}</Link>
              <button className="btn ghost small" onClick={() => toggleBookmark(b.path, b.title, b.kind)} aria-label={`${tr("Убрать закладку ")}${b.title}`}>{tr("убрать")}</button></li>))}</ul>
            : <p className="muted">{tr("Закладок нет. Кнопка «В закладки» есть на странице каждой темы и занятия.")}</p>}
        </section>
        <section><h2>{tr("Темы")}</h2>
          <table><thead><tr><th>{tr("Тема")}</th><th>{tr("Открывалась")}</th><th>{tr("Проверка понимания")}</th></tr></thead>
            <tbody>{topics.map((t) => (
              <tr key={t.id}><td><Link to={`/topics/${t.id}`}>{t.title}</Link></td>
                <td className="num">{p.visited[t.id] ? new Date(p.visited[t.id]).toLocaleDateString(language === 'en' ? 'en-GB' : 'ru-RU') : '—'}</td>
                <td className="num">{p.checks[t.id] ? `${checksRight(t.id)}${tr(" из ")}${t.checks.length}` : '—'}</td></tr>))}</tbody></table>
          <p className="small">{tr("Открыто тем: ")}{visited.length}{tr(" из ")}{topics.length}.</p>
        </section>
        <section><h2>{tr("Занятия")}</h2>
          <table><thead><tr><th>{tr("Занятие")}</th><th>{tr("Попыток")}</th><th>{tr("Последний результат")}</th></tr></thead>
            <tbody>{labs.map((l) => (
              <tr key={l.id}><td><Link to={`/labs/${l.id}`}>{l.title}</Link>{l.transferOf && <span className="muted">{tr(" (перенос к «")}{labById(l.transferOf)?.title}»)</span>}</td>
                <td className="num">{p.labDone[l.id]?.attempts ?? '—'}</td><td>{p.labDone[l.id]?.summary ?? '—'}</td></tr>))}</tbody></table>
        </section>
        <section><h2>{tr("История попыток")}</h2>
          {p.attempts.length ? <table><thead><tr><th>{tr("Когда")}</th><th>{tr("Занятие")}</th><th>{tr("Итог")}</th><th><span className="sr">{tr("Открыть")}</span></th></tr></thead>
            <tbody>{p.attempts.slice(0, 40).map((t) => (
              <tr key={t.id}><td className="num">{new Date(t.at).toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{labById(t.labId)?.title ?? t.labId}</td><td>{t.summary}</td><td><Link to={`/attempts/${t.id}`}>{tr("запись")}</Link></td></tr>))}</tbody></table>
            : <p className="muted">{tr("Попыток пока нет. Запись появляется, когда занятие доведено до разбора.")}</p>}
        </section>
        <section><h2>{tr("Подборка источников")}</h2><p><Link to="/find">{tr("Открыть подборку и поиск (")}{p.savedSources.length})</Link></p></section>
        <section><h2>{tr("Сброс")}</h2>
          <ConfirmButton label={tr("Удалить весь прогресс")} ask={tr("Удалить ответы, закладки и сохранённые занятия?")} onConfirm={resetProgress} />
        </section>
      </div>
    </div>)
}

export function About() {
  useTitle(tr("О платформе"))
  const loc = useLocation()
  useEffect(() => { if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView(), 50) }, [loc.hash])
  return <div className="page about"><h1>{tr("О платформе")}</h1><Md text={aboutRaw} /><StatisticsPreference /></div>
}

export function AttemptPage() {
  const { id = '' } = useParams()
  const p = useProgress(), a = useAccount()
  const local = p.attempts.find((t) => t.id === id)
  const [remote, setRemote] = useState<any>(null), [err, setErr] = useState('')
  useTitle(tr("Запись попытки"))
  useEffect(() => { setRemote(null); setErr(''); if (!local && a.status === 'user') api('GET', `/api/attempts/${encodeURIComponent(id)}`).then(setRemote).catch(() => setErr(tr("Попытка не найдена или принадлежит другому аккаунту."))) }, [id, a.status]) // eslint-disable-line
  const t = local ?? remote
  if (!t) return <div className="page"><h1>{tr("Запись попытки")}</h1><p role="status">{err || (a.status === 'user' || a.status === 'checking' ? tr("Загружаю…") : tr("Попытка не найдена в этом браузере. Если она сделана в аккаунте — войдите."))}</p><p><Link to="/journal">{tr("К журналу")}</Link></p></div>
  const lab = labById(t.labId)
  return (
    <div className="page">
      <p className="eyebrow"><Link to="/journal">{tr("Мой журнал")}</Link>{tr(" · история попыток")}</p>
      <h1>{lab?.title ?? t.labId}</h1>
      <p className="num">{new Date(t.at).toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU')}</p>
      <div className="panel"><h3>{tr("Итог")}</h3><p>{t.summary}</p></div>
      {t.detail && <div className="panel"><h3>{tr("Зафиксированные данные попытки")}</h3><pre className="detail">{JSON.stringify(t.detail, null, 2)}</pre></div>}
      <div className="row">{lab && <Link className="btn" to={`/labs/${lab.id}`}>{tr("Открыть занятие")}</Link>}</div>
    </div>)
}
