import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { site, labById, topicById } from '../content'
import { useLearning } from '../learning'
import { GoalPicker, StepCard } from './Learning'
import { useTitle } from './util'

function Entries() {
  const nav = useNavigate(), [q, setQ] = useState('')
  return (
    <section className="entries3" aria-label="Три способа работать с платформой">
      <Link to="/route" className="entry3 e-route"><span className="enum">1</span><h2>Мой маршрут</h2><p>Рекомендуемая тема, её обоснование и профиль навыков.</p></Link>
      <Link to="/map" className="entry3 e-map"><span className="enum">2</span><h2>Карта знаний</h2><p>Разделы, модули и темы. Открыть можно любую.</p></Link>
      <form className="entry3 e-ask" role="search" onSubmit={(e) => { e.preventDefault(); nav(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : '/catalog') }}>
        <span className="enum">3</span><h2><label htmlFor="hq">Найти ответ на рабочий вопрос</label></h2>
        <div className="row"><input id="hq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="партия вышла жидкой, расслоение, соль…" /><button className="btn" aria-label="Искать">→</button></div>
      </form>
    </section>)
}

export default function Home() {
  useTitle('')
  const L = useLearning(), p = L.p
  // незавершённый шаг: начатое и не доведённое до разбора занятие — самое свежее
  const open = Object.entries(p.labs).filter(([id, s]: any) => labById(id) && !s.finished && s.phase !== 'brief').sort((a: any, b: any) => (b[1]._at ?? 0) - (a[1]._at ?? 0))[0]
  const openLab = open ? labById(open[0]) : undefined
  const lastTopic = p.last?.path.startsWith('/topics/') ? topicById(p.last.path.split('/')[2]) : undefined
  const state = !L.goal ? (L.started ? 'legacy' : 'first') : openLab || (L.started && lastTopic && L.next?.topic === lastTopic.id) ? 'resume' : L.diagDone || L.started ? 'route' : 'diag'
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-text">
          {state === 'first' && <>
            <p className="eyebrow">Для технологов производства и разработчиков рецептур</p>
            <h1>Понять, <em>почему</em> продукт ведёт себя так — и что с этим делать</h1>
            <p className="lead">С чего начать — зависит от того, чего вы хотите добиться. Выберите цель: платформа соберёт маршрут и объяснит каждую рекомендацию.</p>
            <GoalPicker />
            <p className="small">Не хотите выбирать? <Link to="/map">Откройте карту знаний</Link> — все темы и занятия доступны без диагностики.</p></>}
          {state === 'legacy' && <>
            <p className="eyebrow">С возвращением</p>
            <h1>Ваш прогресс сохранён. Соберём из него маршрут?</h1>
            <p className="lead">В новой версии платформа различает, что вы открывали и что умеете делать сами. Прежние прохождения на месте; уровни навыков по ним пока не оценены. Выберите цель — и увидите, с чего продолжить.</p>
            <GoalPicker />
            {p.last && <p className="small"><Link to={p.last.path}>Или вернуться туда, где остановились: {p.last.title.replace(/ — Фаза$/, '')}</Link></p>}</>}
          {state === 'diag' && <>
            <p className="eyebrow">Цель: {L.goal!.name}</p>
            <h1>Пять минут, чтобы не начинать с того, что вы уже умеете</h1>
            <p className="lead">Диагностика — это {L.diagTotal} коротких рабочих ситуаций: прочитать данные, выбрать следующее действие, сделать небольшой расчёт. По ответам платформа определит уровень отдельно по каждому навыку.</p>
            <div className="row"><Link className="btn primary big" to="/diagnostic">{L.diagAnswered ? 'Продолжить диагностику' : 'Пройти диагностику'}</Link><Link className="btn ghost" to="/route">Пропустить — показать маршрут по цели</Link></div></>}
          {state === 'resume' && <>
            <p className="eyebrow">Вы остановились здесь</p>
            <h1>{openLab ? openLab.title : lastTopic!.title}</h1>
            <p className="lead">{openLab ? `Занятие начато и не доведено до разбора. Ваши действия сохранены — продолжите с того же шага.` : 'Тема открыта, навык по ней ещё не подтверждён действием.'}</p>
            <div className="row"><Link className="btn primary big" to={openLab ? `/labs/${openLab.id}` : `/topics/${lastTopic!.id}`}>Продолжить</Link><Link className="btn ghost" to="/route">Мой маршрут</Link></div></>}
          {state === 'route' && <>
            <p className="eyebrow">Цель: {L.goal!.name}{!L.diagDone && ' · рекомендация предварительная'}</p>
            <h1>Ваш следующий шаг</h1>
            {L.next ? <StepCard r={L.next} main /> : <p className="lead">Все навыки маршрута подтверждены. Загляните в <Link to="/map">карту знаний</Link>.</p>}
            {!L.diagDone && <p className="small"><Link to="/diagnostic">{L.diagAnswered ? 'Продолжить диагностику' : 'Пройти диагностику'}</Link> — рекомендация станет точнее.</p>}</>}
        </div>
        <div className="hero-art" aria-hidden><span className="swatch apricot big" /><span className="swatch teal" /><span className="swatch lilac" /><span className="swatch mimosa sm" /></div>
      </section>
      <Entries />
      <section className="strip">
        <h2>Частые рабочие ситуации</h2>
        <ul className="tasklist two">{site.tasks.map((t: any) => <li key={t.text}><Link to={t.to}><b>{t.text}</b><span>{t.hint}</span></Link></li>)}</ul>
      </section>
    </div>)
}
