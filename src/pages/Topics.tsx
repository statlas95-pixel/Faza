import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { topics, topicById, labById, sourceById, search, areaLabel, sourceTypeLabel, labs, terms } from '../content'
import { Md, citedIds } from '../md'
import { BookmarkButton, Quiz, Question } from '../ui'
import { update, useProgress, getProgress } from '../store'
import { useTitle } from './util'
import { SourceFinder } from '../features/Sources'
import { recordCheck, skillOfTopic, moduleOfTopic, useLearning } from '../learning'
import { LevelBar } from './Learning'

export function Catalog() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const [area, setArea] = useState('all')
  const hits = useMemo(() => search(q), [q])
  const p = useProgress()
  useTitle(q ? `Поиск: ${q}` : 'Темы')
  const list = topics.filter((t) => area === 'all' || t.area === area || t.area === 'both')
  return (
    <div className="page">
      <h1>{q ? 'Результаты поиска' : 'Найти ответ на рабочий вопрос'}</h1>
      {!q && <p className="lead">Опишите ситуацию своими словами. Поиск идёт по темам, рабочим вопросам, терминам, занятиям и источникам платформы.</p>}
      <form className="bigsearch" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="cs">Поиск по темам, рабочим вопросам, терминам, источникам и занятиям</label>
        <input id="cs" type="search" value={q} autoFocus={!!q} placeholder="Например: расслоение, предел текучести, охлаждение"
          onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {}, { replace: true })} />
      </form>
      {q ? (
        <div aria-live="polite">
          <p className="small">{hits.length ? `Найдено: ${hits.length}` : 'Ничего не найдено. Попробуйте другое слово или откройте список терминов.'}</p>
          <ul className="hits">
            {hits.map((h, i) => (
              <li key={i}><Link to={h.path}><span className={`kindtag k-${h.kind}`}>{h.kind}</span><b>{h.title}</b><span>{h.text}</span></Link></li>))}
          </ul>
          <p className="extlink"><Link className="btn ghost" to={`/find?q=${encodeURIComponent(q)}`}>Искать «{q}» во внешних научных базах →</Link></p>
          {!hits.length && <p><Link to="/glossary">Все термины ({terms.length})</Link> · <Link to="/labs">Все занятия ({labs.length})</Link></p>}
        </div>
      ) : (
        <>
          <p className="quick"><Link to="/labs">Все занятия</Link> · <Link to="/glossary">Термины</Link> · <Link to="/sources">Проверенные источники</Link> · <Link to="/find">Поиск во внешних научных базах</Link> · <Link to="/map">Карта знаний</Link></p>
          <div className="filters" role="group" aria-label="Фильтр по направлению">
            {[['all', 'Все'], ['production', 'Производство'], ['rnd', 'R&D']].map(([k, l]) => (
              <button key={k} className={`chip ${area === k ? 'on' : ''}`} aria-pressed={area === k} onClick={() => setArea(k)}>{l}</button>))}
          </div>
          <div className="cards">
            {list.map((t) => (
              <Link key={t.id} to={`/topics/${t.id}`} className="card wide">
                <span className={`swatch ${t.swatch}`} aria-hidden />
                <span className="dom">{t.domain}</span><h3>{t.title}</h3><p>{t.summary}</p>
                <ul className="qs">{t.questions.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>
                <span className="meta num">{t.minutes} мин · {areaLabel[t.area]} · занятий: {t.labs.length}{p.visited[t.id] ? ' · открывалась' : ''}</span>
              </Link>))}
          </div>
        </>)}
    </div>)
}

export function TopicPage() {
  const { id = '' } = useParams()
  const t = topicById(id)
  const p = useProgress(), L = useLearning()
  const ref = useRef<HTMLDivElement>(null)
  const [saved] = useState(() => getProgress().scroll[id] ?? 0)
  const [resumeShown, setResumeShown] = useState(true)
  useTitle(t?.title ?? 'Тема не найдена')
  const toc = useMemo(() => (t ? [...t.body.matchAll(/^## (.+)$/gm)].map((m) => m[1]) : []), [t])
  useEffect(() => {
    if (!t) return
    update((s) => { s.visited[t.id] = Date.now() })
    ref.current?.querySelectorAll('.prose > div > h2').forEach((h, i) => { h.id = `s${i + 1}` })
    let timer: any
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(() => update((s) => { s.scroll[t.id] = Math.round(window.scrollY) }), 400) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [t])
  if (!t) return <div className="page"><h1>Тема не найдена</h1><Link to="/catalog">К каталогу</Link></div>
  const sk = skillOfTopic(t.id)
  const cited = citedIds(t.body).map(sourceById).filter(Boolean)
  const answers = p.checks[t.id] ?? {}
  const qs: Question[] = t.checks.map((c) => ({ type: 'mc', ...c }))
  return (
    <article className="topic" ref={ref}>
      <header className={`topic-head sw-${t.swatch}`}>
        <span className={`swatch ${t.swatch} big`} aria-hidden />
        <div>
          <p className="eyebrow"><Link to="/map">Карта знаний</Link> · {moduleOfTopic(t.id)?.section.name ?? t.domain} · {moduleOfTopic(t.id)?.module.name}</p>
          <h1>{t.title}</h1>
          <p className="lead">{t.summary}</p>
          <p className="meta num">{t.minutes} мин чтения · {areaLabel[t.area]} · обновлено {t.updated}</p>
          {sk && <p className="outcome-line"><b>После темы вы сможете</b> {sk.outcome}. <LevelBar s={L.states[sk.id]} /></p>}
          <div className="row"><BookmarkButton title={t.title} kind="Тема" />
            {t.labs[0] && <Link className="btn" to={`/labs/${t.labs[0]}`}>К практике: {labById(t.labs[0])?.title}</Link>}</div>
        </div>
      </header>
      {saved > 600 && resumeShown && (
        <div className="resume-bar" role="status">Вы уже читали эту тему.
          <button className="btn small" onClick={() => { window.scrollTo({ top: saved }); setResumeShown(false) }}>Перейти к месту остановки</button>
          <button className="btn ghost small" onClick={() => setResumeShown(false)}>Скрыть</button></div>)}
      <div className="topic-grid">
        <aside className="toc" aria-label="Содержание темы">
          <h2>В этой теме</h2>
          <ol>{toc.map((h, i) => <li key={i}><a href={`#s${i + 1}`} onClick={(e) => { e.preventDefault(); document.getElementById(`s${i + 1}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{h}</a></li>)}
            <li><a href="#check" onClick={(e) => { e.preventDefault(); document.getElementById('check')?.scrollIntoView() }}>Проверка понимания</a></li>
            <li><a href="#refs" onClick={(e) => { e.preventDefault(); document.getElementById('refs')?.scrollIntoView() }}>Источники</a></li></ol>
          <h2>Рабочие вопросы</h2>
          <ul className="qs">{t.questions.map((x) => <li key={x}>{x}</li>)}</ul>
        </aside>
        <div className="topic-body">
          <Md text={t.body} />
          <section id="check" className="check">
            <h2>Проверка понимания</h2>
            <p className="small">Пояснение даётся к каждому выбранному варианту. Ответы сохраняются.</p>
            <Quiz questions={qs} answers={answers} onAnswer={(i, v) => { update((s) => { (s.checks[t.id] ??= {})[i] = v }); recordCheck(t.id) }} />
            {Object.keys(answers).length > 0 && <button className="btn ghost small" onClick={() => update((s) => { delete s.checks[t.id] })}>Сбросить ответы и пройти заново</button>}
          </section>
          {t.labs.length > 0 && (
            <section className="next-labs"><h2>Применить на практике</h2>
              <div className="cards">{t.labs.map((l) => labById(l)).filter(Boolean).map((l) => (
                <Link key={l!.id} to={`/labs/${l!.id}`} className="card lab"><span className="dom">{l!.role}</span><h3>{l!.title}</h3><p>{l!.skill}</p>
                  <span className="meta num">{l!.minutes} мин{p.labDone[l!.id] ? ` · пройдено, попыток: ${p.labDone[l!.id].attempts}` : ''}</span></Link>))}</div>
            </section>)}
          <section id="refs" className="refs">
            <h2>Источники этой темы</h2>
            <ol>{cited.map((s) => (
              <li key={s!.id}>
                <b>{s!.authors}</b> ({s!.year}). {s!.title}. <i>{s!.where}</i>.{' '}
                {s!.doi && <a href={`https://doi.org/${s!.doi}`} target="_blank" rel="noreferrer">doi:{s!.doi}</a>}{!s!.doi && s!.url && <a href={s!.url} target="_blank" rel="noreferrer">ссылка</a>}
                <span className="reftype">{sourceTypeLabel[s!.type]}</span>
                <p className="small"><b>Что подтверждает:</b> {s!.supports}</p>
                <p className="small"><Link to={`/sources/${s!.id}`}>Как проверен источник →</Link></p>
              </li>))}</ol>
            <p className="review"><b>Статус рецензии:</b> {t.review}</p>
          </section>
          <section className="refs" id="find">
            <h2>Найти внешние источники по теме</h2>
            <p className="small">Поиск по библиографической базе Crossref и каталогу платформы. Найденное можно сохранить в личную подборку как кандидата на проверку.</p>
            <SourceFinder suggestions={t.search} topic={t.id} />
          </section>
          {t.related.length > 0 && (
            <nav className="related" aria-label="Связанные темы"><h2>Связанные темы</h2>
              <ul>{t.related.map((r) => topicById(r)).filter(Boolean).map((r) => <li key={r!.id}><Link to={`/topics/${r!.id}`}>{r!.title}</Link></li>)}</ul></nav>)}
        </div>
      </div>
    </article>)
}
