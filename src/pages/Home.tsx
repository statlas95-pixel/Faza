import { tr } from '../../shared/locale'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { site, labById, topicById } from '../content'
import { useLearning } from '../learning'
import { DailyCaseCard } from '../components/DailyCaseCard'
import { GoalPicker, StepCard } from './Learning'
import { useTitle } from './util'

/** Парящая макро-эмульсия «Фаза» — чистый beauty-tech арт-объект из жидкого стекла без текстовой перегрузки. */
function EmulsionOrbArt() {
  return (
    <div className="hero-orb-stage" aria-hidden="true">
      <svg viewBox="0 0 420 420" className="hero-orb-svg" role="presentation">
        <defs>
          {/* Мягкие рассеянные световые ореолы */}
          <radialGradient id="auraSky" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8ED6F8" stopOpacity="0.48" />
            <stop offset="65%" stopColor="#8ED6F8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#8ED6F8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auraCoral" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF968A" stopOpacity="0.44" />
            <stop offset="65%" stopColor="#FF968A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#FF968A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auraLime" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C8E972" stopOpacity="0.42" />
            <stop offset="65%" stopColor="#C8E972" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#C8E972" stopOpacity="0" />
          </radialGradient>

          {/* Главная стеклянная сфера-эмульсия */}
          <radialGradient id="mainSphereBody" cx="32%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="28%" stopColor="#EFF9FF" stopOpacity="0.82" />
            <stop offset="60%" stopColor="#FCEAE8" stopOpacity="0.76" />
            <stop offset="86%" stopColor="#C7EBFB" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#9EDDF9" stopOpacity="0.86" />
          </radialGradient>

          {/* Внутренняя масляная фаза (Soft Coral) */}
          <linearGradient id="innerOilWave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFB0A5" stopOpacity="0.72" />
            <stop offset="55%" stopColor="#FF8E82" stopOpacity="0.54" />
            <stop offset="100%" stopColor="#FFDAD5" stopOpacity="0.28" />
          </linearGradient>

          {/* Внутренняя водная фаза (Soft Sky Blue) */}
          <linearGradient id="innerWaterWave" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8ED6F8" stopOpacity="0.62" />
            <stop offset="55%" stopColor="#BEE8FC" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E6F6FE" stopOpacity="0.22" />
          </linearGradient>

          {/* Активная лаймовая вуаль */}
          <linearGradient id="innerLimeVeil" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#C8E972" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#F2FBD9" stopOpacity="0.06" />
          </linearGradient>

          {/* Зеркальный блик стекла */}
          <linearGradient id="glassSpecular" x1="0%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Сателлит — Soft Coral */}
          <radialGradient id="orbCoral" cx="30%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="32%" stopColor="#FFD2CB" stopOpacity="0.88" />
            <stop offset="72%" stopColor="#FF968A" stopOpacity="0.86" />
            <stop offset="100%" stopColor="#F06F61" stopOpacity="0.78" />
          </radialGradient>

          {/* Сателлит — Soft Sky Blue */}
          <radialGradient id="orbSky" cx="32%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="34%" stopColor="#D6F1FE" stopOpacity="0.88" />
            <stop offset="74%" stopColor="#8ED6F8" stopOpacity="0.84" />
            <stop offset="100%" stopColor="#58BEEF" stopOpacity="0.74" />
          </radialGradient>

          {/* Сателлит — Soft Lime */}
          <radialGradient id="orbLime" cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
            <stop offset="36%" stopColor="#EAF9BE" stopOpacity="0.9" />
            <stop offset="76%" stopColor="#C8E972" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#9ED23A" stopOpacity="0.76" />
          </radialGradient>

          <clipPath id="mainSphereClip">
            <circle cx="212" cy="212" r="114" />
          </clipPath>
        </defs>

        {/* Фоновые мягкие ореолы */}
        <circle cx="288" cy="126" r="118" fill="url(#auraSky)" />
        <circle cx="144" cy="276" r="112" fill="url(#auraCoral)" />
        <circle cx="280" cy="294" r="96" fill="url(#auraLime)" />

        {/* Тонкая стеклянная орбитальная дуга (напоминает коллоидную границу раздела фаз) */}
        <ellipse
          cx="212"
          cy="212"
          rx="168"
          ry="68"
          transform="rotate(-24 212 212)"
          fill="none"
          stroke="url(#glassSpecular)"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* Задний сателлит — Soft Sky Blue (водная фаза) */}
        <g className="orb-float-slow">
          <circle cx="102" cy="272" r="46" fill="url(#orbSky)" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1.4" />
          <ellipse cx="88" cy="254" rx="15" ry="9" transform="rotate(-28 88 254)" fill="#FFFFFF" opacity="0.78" />
        </g>

        {/* Главная парящая стеклянная сфера-эмульсия */}
        <g className="orb-float-main">
          {/* Мягкая тень под сферой */}
          <ellipse cx="212" cy="348" rx="84" ry="14" fill="#182026" opacity="0.07" />

          {/* Корпус сферы */}
          <circle cx="212" cy="212" r="114" fill="url(#mainSphereBody)" />

          {/* Внутренние переплетающиеся жидкие фазы */}
          <g clipPath="url(#mainSphereClip)">
            {/* Нижняя водная фаза */}
            <path
              d="M84 226 C138 192, 188 256, 250 222 C290 200, 322 214, 342 226 L342 340 L84 340 Z"
              fill="url(#innerWaterWave)"
            />
            {/* Средняя коралловая масляная волна */}
            <path
              d="M84 188 C144 222, 198 158, 266 196 C302 216, 326 198, 342 184 L342 268 C288 292, 232 238, 174 264 C132 282, 104 260, 84 248 Z"
              fill="url(#innerOilWave)"
            />
            {/* Активная лаймовая световая линза в нижней дуге */}
            <path
              d="M114 274 C166 246, 242 296, 314 248 L330 330 L100 330 Z"
              fill="url(#innerLimeVeil)"
            />
            {/* Взвешенные светящиеся микрокапли эмульсии */}
            <circle cx="164" cy="206" r="11" fill="url(#orbCoral)" opacity="0.88" />
            <circle cx="238" cy="236" r="14" fill="url(#orbSky)" opacity="0.85" />
            <circle cx="264" cy="186" r="8.5" fill="url(#orbLime)" opacity="0.92" />
            <circle cx="196" cy="256" r="7" fill="#FFFFFF" opacity="0.82" />
            <circle cx="218" cy="176" r="5.5" fill="#FFFFFF" opacity="0.88" />
            <circle cx="146" cy="244" r="5" fill="url(#orbLime)" opacity="0.82" />
            <circle cx="272" cy="252" r="6" fill="url(#orbCoral)" opacity="0.78" />
            {/* Верхний глянцевый мениск-блик */}
            <path
              d="M126 154 C156 112, 224 98, 282 128 C236 122, 172 136, 134 176 Z"
              fill="url(#glassSpecular)"
            />
          </g>

          {/* Зеркальная каёмка сферы (Liquid Glass rim) */}
          <circle cx="212" cy="212" r="114" fill="none" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="2.2" />
          <circle cx="212" cy="212" r="112" fill="none" stroke="#8ED6F8" strokeOpacity="0.28" strokeWidth="1" />
          {/* Главный точечный блик */}
          <ellipse cx="164" cy="146" rx="28" ry="14" transform="rotate(-32 164 146)" fill="#FFFFFF" opacity="0.84" />
          <circle cx="140" cy="174" r="5.5" fill="#FFFFFF" opacity="0.76" />
        </g>

        {/* Верхний-правый сателлит — Soft Coral (масляная фаза) */}
        <g className="orb-float-mid">
          <circle cx="322" cy="126" r="36" fill="url(#orbCoral)" stroke="#FFFFFF" strokeOpacity="0.88" strokeWidth="1.6" />
          <ellipse cx="310" cy="112" rx="11" ry="6.5" transform="rotate(-28 310 112)" fill="#FFFFFF" opacity="0.82" />
        </g>

        {/* Верхний-левый сателлит — Soft Lime (активная фаза) */}
        <g className="orb-float-alt">
          <circle cx="104" cy="120" r="24" fill="url(#orbLime)" stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.4" />
          <ellipse cx="96" cy="111" rx="7.5" ry="4.5" transform="rotate(-28 96 111)" fill="#FFFFFF" opacity="0.86" />
        </g>

        {/* Деликатные стеклянные микрокапли вокруг композиции */}
        <g className="orb-float-mid">
          <circle cx="336" cy="264" r="14" fill="url(#orbLime)" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.2" />
          <circle cx="331" cy="259" r="3.2" fill="#FFFFFF" opacity="0.88" />
          <circle cx="304" cy="316" r="8.5" fill="url(#orbSky)" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1" />
          <circle cx="72" cy="188" r="7.5" fill="url(#orbCoral)" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1" />
          <circle cx="242" cy="74" r="6" fill="url(#orbSky)" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1" />
        </g>
      </svg>
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
        <EmulsionOrbArt />
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
