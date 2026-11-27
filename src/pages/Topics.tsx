import { tr } from '../../shared/locale'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { topics, topicById, labById, sourceById, search, areaLabel, sourceTypeLabel, labs, terms, levelLabel, levelHint } from '../content'
import { Md, citedIds } from '../md'
import { BookmarkButton, Quiz, Question } from '../ui'
import { NoteBox } from '../components/NoteBox'
import { update, useProgress, getProgress } from '../store'
import { useTitle } from './util'
import { SourceFinder } from '../features/Sources'
import { recordCheck, skillOfTopic, moduleOfTopic, topicRefs, useLearning } from '../learning'
import { LevelBar } from './Learning'

export function Catalog() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const [area, setArea] = useState('all'), [lvl, setLvl] = useState(0)
  const hits = useMemo(() => search(q), [q])
  const p = useProgress()
  useTitle(q ? `${tr("Поиск: ")}${q}` : tr("Темы"))
  const list = topics.filter((t) => (area === 'all' || t.area === area || t.area === 'both') && (!lvl || t.level === lvl)).sort((a, b) => a.level - b.level || a.order - b.order)
  return (
    <div className="page">
      <h1>{q ? tr("Результаты поиска") : tr("Найти ответ на рабочий вопрос")}</h1>
      {!q && <p className="lead">{tr("Опишите ситуацию своими словами. Поиск идёт по темам, рабочим вопросам, терминам, занятиям и источникам платформы.")}</p>}
      <form className="bigsearch" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="cs">{tr("Поиск по темам, рабочим вопросам, терминам, источникам и занятиям")}</label>
        <input id="cs" type="search" value={q} autoFocus={!!q} placeholder={tr("Например: расслоение, предел текучести, охлаждение")}
          onChange={(e) => setSp(e.target.value ? { q: e.target.value } : {}, { replace: true })} />
      </form>
      {q ? (
        <div aria-live="polite">
          <p className="small">{hits.length ? `${tr("Найдено: ")}${hits.length}` : tr("Ничего не найдено. Попробуйте другое слово или откройте список терминов.")}</p>
          <ul className="hits">
            {hits.map((h, i) => (
              <li key={i}><Link to={h.path}><span className={`kindtag k-${h.kind}`}>{tr(h.kind)}</span><b>{h.title}</b><span>{h.text}</span></Link></li>))}
          </ul>
          <p className="extlink"><Link className="btn ghost" to={`/find?q=${encodeURIComponent(q)}`}>{tr("Искать «")}{q}{tr("» во внешних научных базах →")}</Link></p>
          {!hits.length && <p><Link to="/glossary">{tr("Все термины (")}{terms.length})</Link> · <Link to="/labs">{tr("Все занятия (")}{labs.length})</Link></p>}
        </div>
      ) : (
        <>
          <p className="quick"><Link to="/labs">{tr("Все занятия")}</Link> · <Link to="/glossary">{tr("Термины")}</Link> · <Link to="/sources">{tr("Проверенные источники")}</Link> · <Link to="/find">{tr("Поиск во внешних научных базах")}</Link> · <Link to="/map">{tr("Карта знаний")}</Link></p>
          <div className="filters" role="group" aria-label={tr("Фильтр по направлению")}>
            {[['all', tr("Все")], ['production', tr("Производство")], ['rnd', 'R&D']].map(([k, l]) => (
              <button key={k} className={`chip ${area === k ? 'on' : ''}`} aria-pressed={area === k} onClick={() => setArea(k)}>{l}</button>))}
            <span className="sep" aria-hidden />
            {[[0, tr("Все ступени")], [1, levelLabel[1]], [2, levelLabel[2]], [3, levelLabel[3]]].map(([k, l]) => (
              <button key={k} className={`chip ${lvl === k ? 'on' : ''}`} aria-pressed={lvl === k} onClick={() => setLvl(k as number)}>{l}</button>))}
          </div>
          <div className="cards">
            {list.map((t) => (
              <Link key={t.id} to={`/topics/${t.id}`} className="card wide">
                <span className={`swatch ${t.swatch}`} aria-hidden />
                <span className="dom">{t.domain}</span><h3>{t.title}</h3><p>{t.summary}</p>
                <ul className="qs">{t.questions.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>
                <span className="meta num"><span className={`lvtag lv${t.level}`}>{levelLabel[t.level]}</span> {t.minutes}{tr(" мин · ")}{areaLabel[t.area]}{tr(" · занятий: ")}{t.labs.length}{p.visited[t.id] ? tr(" · открывалась") : ''}</span>
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
  const [readPct, setReadPct] = useState(0)
  useTitle(t?.title ?? tr("Тема не найдена"))
  const toc = useMemo(() => (t ? [...t.body.matchAll(/^## (.+)$/gm)].map((m) => m[1]) : []), [t])
  useEffect(() => {
    if (!t) return
    setReadPct(0)
    update((s) => { s.visited[t.id] = Date.now() })
    ref.current?.querySelectorAll('.prose > div > h2').forEach((h, i) => { h.id = `s${i + 1}` })
    let timer: any
    let raf = 0
    const onScroll = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
          setReadPct(Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))))
        })
      }
      clearTimeout(timer)
      timer = setTimeout(() => update((s) => { s.scroll[t.id] = Math.round(window.scrollY) }), 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); if (raf) cancelAnimationFrame(raf) }
  }, [t])
  if (!t) return <div className="page"><h1>{tr("Тема не найдена")}</h1><Link to="/catalog">{tr("К каталогу")}</Link></div>
  const sk = skillOfTopic(t.id)
  const cited = citedIds(t.body).map(sourceById).filter(Boolean)
  const answers = p.checks[t.id] ?? {}
  const qs: Question[] = t.checks.map((c) => ({ type: 'mc', ...c }))
  const refIdx = topicRefs.findIndex((r) => r.id === t.id)
  const prevTopic = refIdx > 0 ? topicById(topicRefs[refIdx - 1].id) : undefined
  const nextTopic = refIdx >= 0 && refIdx < topicRefs.length - 1 ? topicById(topicRefs[refIdx + 1].id) : undefined
  return (
    <article className="topic" ref={ref}>
      <div className="reading-progress no-print" aria-hidden="true">
        <span style={{ width: `${readPct}%` }} />
      </div>
      <header className={`topic-head sw-${t.swatch}`}>
        <span className={`swatch ${t.swatch} big`} aria-hidden />
        <div>
          <p className="eyebrow"><Link to="/map">{tr("Карта знаний")}</Link> · {moduleOfTopic(t.id)?.section.name ?? t.domain} · {moduleOfTopic(t.id)?.module.name}</p>
          <h1>{t.title}</h1>
          <p className="lead">{t.summary}</p>
          <p className="meta num"><span className={`lvtag lv${t.level}`} title={levelHint[t.level]}>{levelLabel[t.level]}</span> {t.minutes}{tr(" мин чтения · ")}{areaLabel[t.area]}{tr(" · обновлено ")}{t.updated}</p>
          {sk && <p className="outcome-line"><b>{tr("После темы вы сможете")}</b> {sk.outcome}. <LevelBar s={L.states[sk.id]} /></p>}
          <div className="row"><BookmarkButton title={t.title} kind={tr("Тема")} />
            {t.labs[0] && <Link className="btn" to={`/labs/${t.labs[0]}`}>{tr("К практике: ")}{labById(t.labs[0])?.title}</Link>}</div>
        </div>
      </header>
      {saved > 600 && resumeShown && (
        <div className="resume-bar" role="status">{tr("Вы уже читали эту тему. ")}<button className="btn small" onClick={() => { window.scrollTo({ top: saved }); setResumeShown(false) }}>{tr("Перейти к месту остановки")}</button>
          <button className="btn ghost small" onClick={() => setResumeShown(false)}>{tr("Скрыть")}</button></div>)}
      <div className="topic-grid">
        <aside className="toc" aria-label={tr("Содержание темы")}>
          <h2>{tr("В этой теме")}</h2>
          <ol>{toc.map((h, i) => <li key={i}><a href={`#s${i + 1}`} onClick={(e) => { e.preventDefault(); document.getElementById(`s${i + 1}`)?.scrollIntoView({ behavior: 'smooth' }) }}>{h}</a></li>)}
            <li><a href="#check" onClick={(e) => { e.preventDefault(); document.getElementById('check')?.scrollIntoView() }}>{tr("Проверка понимания")}</a></li>
            <li><a href="#refs" onClick={(e) => { e.preventDefault(); document.getElementById('refs')?.scrollIntoView() }}>{tr("Источники")}</a></li></ol>
          <h2>{tr("Рабочие вопросы")}</h2>
          <ul className="qs">{t.questions.map((x) => <li key={x}>{x}</li>)}</ul>
        </aside>
        <div className="topic-body">
          {t.questions.length > 0 && (
            <section className="topic-tldr" aria-label={tr("Главное за 30 секунд")}>
              <p className="topic-tldr-eyebrow">{tr("Главное за 30 секунд · После этой главы вы сможете ответить на вопросы:")}</p>
              <ul className="topic-tldr-list">
                {t.questions.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </section>
          )}
          <Md text={t.body} />
          <NoteBox
            noteId={`topic:${t.id}`}
            kind="topic"
            targetId={t.id}
            title={t.title}
          />
          <section id="check" className="check">
            <h2>{tr("Проверка понимания")}</h2>
            <p className="small">{tr("Пояснение даётся к каждому выбранному варианту. Ответы сохраняются.")}</p>
            <Quiz questions={qs} answers={answers} onAnswer={(i, v) => { update((s) => { (s.checks[t.id] ??= {})[i] = v }); recordCheck(t.id) }} />
            {Object.keys(answers).length > 0 && <button className="btn ghost small" onClick={() => update((s) => { delete s.checks[t.id] })}>{tr("Сбросить ответы и пройти заново")}</button>}
          </section>
          {t.labs.length > 0 && (
            <section className="next-labs"><h2>{tr("Применить на практике")}</h2>
              <div className="cards">{t.labs.map((l) => labById(l)).filter(Boolean).map((l) => (
                <Link key={l!.id} to={`/labs/${l!.id}`} className="card lab"><span className="dom">{l!.role}</span><h3>{l!.title}</h3><p>{l!.skill}</p>
                  <span className="meta num">{l!.minutes}{tr(" мин")}{p.labDone[l!.id] ? `${tr(" · пройдено, попыток: ")}${p.labDone[l!.id].attempts}` : ''}</span></Link>))}</div>
            </section>)}
          <section id="refs" className="refs">
            <h2>{tr("Источники этой темы")}</h2>
            <ol>{cited.map((s) => (
              <li key={s!.id}>
                <b>{s!.authors}</b> ({s!.year}). {s!.title}. <i>{s!.where}</i>.{' '}
                {s!.doi && <a href={`https://doi.org/${s!.doi}`} target="_blank" rel="noreferrer">doi:{s!.doi}</a>}{!s!.doi && s!.url && <a href={s!.url} target="_blank" rel="noreferrer">{tr("ссылка")}</a>}
                <span className="reftype">{sourceTypeLabel[s!.type]}</span>
                <p className="small"><b>{tr("Что подтверждает:")}</b> {s!.supports}</p>
                <p className="small"><Link to={`/sources/${s!.id}`}>{tr("Как проверен источник →")}</Link></p>
              </li>))}</ol>
            <p className="review"><b>{tr("Статус рецензии:")}</b> {t.review}</p>
          </section>
          <details className="deep topic-ext-find" id="find">
            <summary>
              <span className="deep-tag">Crossref</span>
              {tr("Найти дополнительные научные статьи по теме")}
            </summary>
            <div className="deep-body">
              <p className="small">{tr("Поиск по библиографической базе Crossref и каталогу платформы. Найденное можно сохранить в личную подборку как кандидата на проверку.")}</p>
              <SourceFinder suggestions={t.search} topic={t.id} />
            </div>
          </details>
          {t.related.length > 0 && (
            <nav className="related" aria-label={tr("Связанные темы")}><h2>{tr("Связанные темы")}</h2>
              <ul>{t.related.map((r) => topicById(r)).filter(Boolean).map((r) => <li key={r!.id}><Link to={`/topics/${r!.id}`}>{r!.title}</Link></li>)}</ul></nav>)}
          {(prevTopic || nextTopic) && (
            <nav className="topic-pager no-print" aria-label={tr("Навигация по главам учебника")}>
              {prevTopic ? (
                <Link className="topic-pager-link prev" to={`/topics/${prevTopic.id}`}>
                  <span className="topic-pager-dir">← {tr("Предыдущая тема")}</span>
                  <span className="topic-pager-title">{prevTopic.title}</span>
                </Link>
              ) : <span />}
              {nextTopic ? (
                <Link className="topic-pager-link next" to={`/topics/${nextTopic.id}`}>
                  <span className="topic-pager-dir">{tr("Следующая тема")} →</span>
                  <span className="topic-pager-title">{nextTopic.title}</span>
                </Link>
              ) : <span />}
            </nav>
          )}
        </div>
      </div>
    </article>)
}
