import { tr } from '../../shared/locale'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { site, labById, topicById } from '../content'
import { useLearning } from '../learning'
import { GoalPicker, StepCard } from './Learning'
import { useTitle } from './util'

function Entries() {
  const nav = useNavigate(), [q, setQ] = useState('')
  return (
    <section className="entries3" aria-label={tr("Три способа работать с платформой")}>
      <Link to="/route" className="entry3 e-route"><span className="enum">1</span><h2>{tr("Мой маршрут")}</h2><p>{tr("Рекомендуемая тема, её обоснование и профиль навыков.")}</p></Link>
      <Link to="/map" className="entry3 e-map"><span className="enum">2</span><h2>{tr("Карта знаний")}</h2><p>{tr("Разделы, модули и темы. Открыть можно любую.")}</p></Link>
      <form className="entry3 e-ask" role="search" onSubmit={(e) => { e.preventDefault(); nav(q.trim() ? `/catalog?q=${encodeURIComponent(q.trim())}` : '/catalog') }}>
        <span className="enum">3</span><h2><label htmlFor="hq">{tr("Найти ответ на рабочий вопрос")}</label></h2>
        <div className="row"><input id="hq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("партия вышла жидкой, расслоение, соль…")} /><button className="btn" aria-label={tr("Искать")}>→</button></div>
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
            <p className="eyebrow">{tr("Для технологов производства и разработчиков рецептур")}</p>
            <h1>{tr("Понять, ")}<em>{tr("почему")}</em>{tr(" продукт ведёт себя так — и что с этим делать")}</h1>
            <p className="lead">{tr("С чего начать — зависит от того, чего вы хотите добиться. Выберите цель: платформа соберёт маршрут и объяснит каждую рекомендацию.")}</p>
            <GoalPicker />
            <p className="small">{tr("Не хотите выбирать? ")}<Link to="/map">{tr("Откройте карту знаний")}</Link>{tr(" — все темы и занятия доступны без диагностики.")}</p></>}
          {state === 'legacy' && <>
            <p className="eyebrow">{tr("С возвращением")}</p>
            <h1>{tr("Ваш прогресс сохранён. Соберём из него маршрут?")}</h1>
            <p className="lead">{tr("В новой версии платформа различает, что вы открывали и что умеете делать сами. Прежние прохождения на месте; уровни навыков по ним пока не оценены. Выберите цель — и увидите, с чего продолжить.")}</p>
            <GoalPicker />
            {p.last && <p className="small"><Link to={p.last.path}>{tr("Или вернуться туда, где остановились: ")}{p.last.title.replace(/ — Фаза$/, '')}</Link></p>}</>}
          {state === 'diag' && <>
            <p className="eyebrow">{tr("Цель: ")}{L.goal!.name}</p>
            <h1>{tr("Начнём с вопросов под вашу подготовку")}</h1>
            <p className="lead">{tr("Выберите вариант для выпускника химического вуза, начинающего или опытного специалиста. Вопросы по физической и коллоидной химии, процессам и аппаратам сочетаются с практическими ситуациями. Ответы помогут выбрать темы; это предварительная диагностика, а не экзамен.")}</p>
            <div className="row"><Link className="btn primary big" to="/diagnostic">{L.diagAnswered ? tr("Продолжить диагностику") : tr("Пройти диагностику")}</Link><Link className="btn ghost" to="/route">{tr("Пропустить — показать маршрут по цели")}</Link></div></>}
          {state === 'resume' && <>
            <p className="eyebrow">{tr("Вы остановились здесь")}</p>
            <h1>{openLab ? openLab.title : lastTopic!.title}</h1>
            <p className="lead">{openLab ? tr("Занятие начато и не доведено до разбора. Ваши действия сохранены — продолжите с того же шага.") : tr("Тема открыта, навык по ней ещё не подтверждён действием.")}</p>
            <div className="row"><Link className="btn primary big" to={openLab ? `/labs/${openLab.id}` : `/topics/${lastTopic!.id}`}>{tr("Продолжить")}</Link><Link className="btn ghost" to="/route">{tr("Мой маршрут")}</Link></div></>}
          {state === 'route' && <>
            <p className="eyebrow">{tr("Цель: ")}{L.goal!.name}{!L.diagDone && tr(" · рекомендация предварительная")}</p>
            <h1>{tr("Ваш следующий шаг")}</h1>
            {L.next ? <StepCard r={L.next} main /> : <p className="lead">{tr("Все навыки маршрута подтверждены. Загляните в ")}<Link to="/map">{tr("карту знаний")}</Link>.</p>}
            {!L.diagDone && <p className="small"><Link to="/diagnostic">{L.diagAnswered ? tr("Продолжить диагностику") : tr("Пройти диагностику")}</Link>{tr(" — рекомендация станет точнее.")}</p>}</>}
        </div>
        <div className="hero-art" aria-hidden><span className="swatch apricot big" /><span className="swatch teal" /><span className="swatch lilac" /><span className="swatch mimosa sm" /></div>
      </section>
      <Entries />
      <section className="strip">
        <h2>{tr("Частые рабочие ситуации")}</h2>
        <ul className="tasklist two">{site.tasks.map((t: any) => <li key={t.text}><Link to={t.to}><b>{t.text}</b><span>{t.hint}</span></Link></li>)}</ul>
      </section>
    </div>)
}
