import { Link } from 'react-router-dom'
import { site, topics, labs, topicById, labById, areaLabel } from '../content'
import { useProgress } from '../store'
import { useTitle } from './util'

export default function Home() {
  useTitle('')
  const p = useProgress()
  const steps = site.track.steps as { topic?: string; lab?: string }[]
  const doneCount = steps.filter((s) => (s.topic ? p.visited[s.topic] : p.labDone[s.lab!])).length
  const next = steps.find((s) => !(s.topic ? p.visited[s.topic] : p.labDone[s.lab!]))
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Для технологов производства и разработчиков рецептур</p>
          <h1>Понять, <em>почему</em> крем ведёт себя так — и что с этим делать</h1>
          <p className="lead">{site.intro}</p>
          {p.last && (
            <Link className="resume" to={p.last.path}>
              <span>Вернуться туда, где остановились</span><b>{p.last.title.replace(/ — Фаза$/, '')}</b>
            </Link>)}
        </div>
        <div className="hero-art" aria-hidden>
          <span className="swatch apricot big" /><span className="swatch teal" /><span className="swatch lilac" /><span className="swatch mimosa sm" />
        </div>
      </section>

      <section className="entries" aria-label="Три способа начать">
        <article className="entry task">
          <h2><span className="enum">1</span>У меня рабочий вопрос</h2>
          <p>Выберите ситуацию — попадёте сразу к разбору или к занятию.</p>
          <ul className="tasklist">
            {site.tasks.map((t: any) => (
              <li key={t.text}><Link to={t.to}><b>{t.text}</b><span>{t.hint} · {areaLabel[t.area]}</span></Link></li>))}
          </ul>
        </article>
        <article className="entry track">
          <h2><span className="enum">2</span>Изучаю последовательно</h2>
          <p>{site.track.text}</p>
          <ol className="tracklist">
            {steps.map((s, i) => {
              const t = s.topic ? topicById(s.topic) : undefined, l = s.lab ? labById(s.lab) : undefined
              const done = s.topic ? !!p.visited[s.topic] : !!p.labDone[s.lab!]
              const to = t ? `/topics/${t.id}` : `/labs/${l!.id}`
              return (
                <li key={i} className={done ? 'done' : ''}>
                  <Link to={to}><span className="kind">{t ? 'Тема' : 'Занятие'}</span>{(t ?? l)!.title}{done && <span className="tick" aria-label="пройдено"> ✓</span>}</Link>
                </li>)
            })}
          </ol>
          <p className="num small">Пройдено {doneCount} из {steps.length}{next && <> · <Link to={next.topic ? `/topics/${next.topic}` : `/labs/${next.lab}`}>продолжить →</Link></>}</p>
        </article>
        <article className="entry practice">
          <h2><span className="enum">3</span>Сразу к практике</h2>
          <p>Рабочие ситуации с документами, расчётами и приборными данными. Теория открывается из разбора.</p>
          <ul className="lablist">
            {labs.filter((l) => !l.transferOf).map((l) => (
              <li key={l.id}><Link to={`/labs/${l.id}`}><b>{l.title}</b><span>{l.role} · {l.minutes} мин · {areaLabel[l.area]}</span></Link></li>))}
          </ul>
        </article>
      </section>

      <section className="strip">
        <h2>Темы</h2>
        <div className="cards">
          {topics.map((t) => (
            <Link key={t.id} to={`/topics/${t.id}`} className="card">
              <span className={`swatch ${t.swatch}`} aria-hidden />
              <span className="dom">{t.domain}</span><h3>{t.title}</h3><p>{t.summary}</p>
              <span className="meta num">{t.minutes} мин · {areaLabel[t.area]}{p.visited[t.id] ? ' · открывалась' : ''}</span>
            </Link>))}
        </div>
      </section>
    </div>)
}
