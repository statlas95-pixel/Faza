import { tr } from '../../shared/locale'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { site, labById, topicById, topics, labs, ingredients, terms } from '../content'
import { useLearning } from '../learning'
import { DailyCaseCard } from '../components/DailyCaseCard'
import { GoalPicker, StepCard } from './Learning'
import { useTitle } from './util'

function HeroIllustration() {
  return (
    <div className="hero-visual" aria-hidden>
      <div className="hero-card">
        <div className="hero-card-top">
          <span className="phase-pill p-A">A</span>
          <span className="phase-pill p-B">B</span>
          <span className="phase-pill p-C">C</span>
          <span className="num small muted">O/W · 500 г</span>
        </div>
        <svg viewBox="0 0 280 184" className="hero-beaker-svg">
          <defs>
            <linearGradient id="hCream" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFE9D6" />
              <stop offset="55%" stopColor="#F5E6F7" />
              <stop offset="100%" stopColor="#D7F2EE" />
            </linearGradient>
            <linearGradient id="hAccent" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF8A5C" />
              <stop offset="100%" stopColor="#D9482B" />
            </linearGradient>
          </defs>
          <circle cx="222" cy="48" r="34" fill="url(#hAccent)" opacity="0.16" />
          <circle cx="56" cy="144" r="28" fill="#0E7C7B" opacity="0.14" />
          {/* Стакан */}
          <path d="M74 34 L74 148 Q74 162 90 162 L190 162 Q206 162 206 148 L206 34" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M78 74 L202 74 L202 148 Q202 158 190 158 L90 158 Q78 158 78 148 Z" fill="url(#hCream)" />
          {/* Мениск и капли эмульсии */}
          <ellipse cx="140" cy="74" rx="62" ry="8" fill="#FFF7EE" stroke="#E2CBB5" strokeWidth="1.2" />
          <g fill="#FF8A5C" opacity="0.72">
            <circle cx="106" cy="108" r="6" /><circle cx="132" cy="126" r="4.5" /><circle cx="164" cy="104" r="5.5" />
            <circle cx="176" cy="134" r="4" /><circle cx="118" cy="140" r="3.5" /><circle cx="150" cy="118" r="3.5" />
          </g>
          {/* Мерные деления */}
          <g stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.4">
            <line x1="84" y1="96" x2="96" y2="96" /><line x1="84" y1="116" x2="102" y2="116" /><line x1="84" y1="136" x2="96" y2="136" />
          </g>
          {/* Мешалка */}
          <line x1="140" y1="12" x2="140" y2="132" stroke="#4B2E83" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="116" y="128" width="48" height="7" rx="3.5" fill="#6E4FA3" />
        </svg>
        <div className="hero-metrics num">
          <div><span>pH</span><b>5.5</b></div>
          <div><span>ΔГЛБ</span><b>0.2</b></div>
          <div><span>Баланс</span><b>100 %</b></div>
        </div>
      </div>
      <div className="hero-stats num">
        <span><b>{topics.length}</b> {tr('тем')}</span>
        <span><b>{labs.length}</b> {tr('тренажёров')}</span>
        <span><b>{ingredients.length}</b> {tr('сырья')}</span>
        <span><b>{terms.length}</b> {tr('терминов')}</span>
      </div>
    </div>
  )
}

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
        <HeroIllustration />
      </section>
      <Entries />
      <div className="strip">
        <DailyCaseCard />
      </div>
      <section className="strip">
        <h2>{tr("Частые рабочие ситуации")}</h2>
        <ul className="tasklist two">{site.tasks.map((t: any) => <li key={t.text}><Link to={t.to}><b>{t.text}</b><span>{t.hint}</span></Link></li>)}</ul>
      </section>
    </div>)
}
