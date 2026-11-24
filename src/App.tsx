import { chooseLanguage } from './language'
import { tr, language } from '../shared/locale'
import { useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { site } from './content'
import { update } from './store'
import { recordActivity } from './statistics'
import { publicPage } from '../shared/statistics'
import StatisticsPage from './pages/Statistics'
import Home from './pages/Home'
import { Catalog, TopicPage } from './pages/Topics'
import { Glossary, Sources, Journal, About, AttemptPage } from './pages/Reference'
import AccountPage, { ImportBanner } from './pages/Account'
import { FindPage } from './features/Sources'
import { Tutor } from './features/Tutor'
import { init, useAccount } from './account'
import { RoutePage, MapPage, DiagnosticPage } from './pages/Learning'
import { topicById, labById } from './content'
import { LabsIndex, LabPage } from './labs/LabPage'

function SearchBox() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/catalog?q=${encodeURIComponent(q.trim())}`) }}>
      <label className="sr" htmlFor="gs">{tr("Поиск по темам, терминам, источникам и занятиям")}</label>
      <input id="gs" type="search" placeholder={tr("Поиск: вязкость, Стокс, охлаждение…")} value={q} onChange={(e) => setQ(e.target.value)} />
      <button aria-label={tr("Искать")}>→</button>
    </form>)
}

function Shell() {
  const loc = useLocation()
  const inLab = /^\/labs\/.+/.test(loc.pathname)
  const acc = useAccount()
  useEffect(() => { void init() }, [])
  const m = loc.pathname.match(/^\/(topics|labs)\/([\w-]+)$/)
  const ctx = m ? (m[1] === 'topics' ? topicById(m[2]) : labById(m[2])) : undefined
  const trackedPath = useRef<string | null>(null)
  useEffect(() => {
    if (trackedPath.current === loc.pathname) return
    trackedPath.current = loc.pathname
    const page = publicPage(loc.pathname)
    if (page && (!/^\/(topics|labs)\//.test(page) || ctx)) recordActivity('view', page)
  }, [loc.pathname, ctx])
  useEffect(() => {
    document.body.dataset.mode = inLab ? 'focus' : 'explore'
    if (!loc.hash) window.scrollTo(0, 0)
  }, [loc.pathname, inLab])
  useEffect(() => {
    const t = document.title
    if (loc.pathname !== '/') update((p) => { p.last = { path: loc.pathname, title: t, at: Date.now() } })
  }, [loc.pathname])
  const languagePicker = <label className="language-picker">
    <span className="sr">{language === 'en' ? 'Language' : 'Язык'}</span>
    <select value={language} onChange={event => chooseLanguage(event.target.value === 'en' ? 'en' : 'ru')}>
      <option value="ru" lang="ru">Русский</option><option value="en" lang="en">English</option>
    </select>
  </label>
  return (
    <>
      <a className="skip" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus() }}>{tr("К содержанию")}</a>
      {!inLab && (
        <header className="top">
          <Link to="/" className="logo" aria-label={`${site.name}${tr(" — на главную")}`}><span className="logo-drop" aria-hidden />{site.name}</Link>
          <nav aria-label={tr("Основные разделы")}>
            <NavLink to="/route">{tr("Мой маршрут")}</NavLink><NavLink to="/map">{tr("Карта знаний")}</NavLink><NavLink to="/catalog">{tr("Найти ответ")}</NavLink><NavLink to="/journal">{tr("Журнал")}</NavLink>
            <NavLink to="/account" className="acct">{acc.status === 'user' ? acc.user?.name : acc.status === 'offline' ? tr("Без сервера") : tr("Войти")}</NavLink>
          </nav>{languagePicker}
        </header>)}
      {inLab && <div className="lab-language">{languagePicker}</div>}
      <ImportBanner />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/topics/:id" element={<TopicPage />} />
          <Route path="/labs" element={<LabsIndex />} />
          <Route path="/labs/:id" element={<LabPage />} />
          <Route path="/glossary" element={<Glossary />} /><Route path="/glossary/:id" element={<Glossary />} />
          <Route path="/sources" element={<Sources />} /><Route path="/sources/:id" element={<Sources />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/about" element={<About />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/diagnostic" element={<DiagnosticPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/find" element={<FindPage />} />
          <Route path="/attempts/:id" element={<AttemptPage />} />
          <Route path="*" element={<div className="page"><h1>{tr("Страница не найдена")}</h1><p><Link to="/">{tr("На главную")}</Link></p></div>} />
        </Routes>
      </main>
      {m && ctx && <Tutor kind={m[1] === 'topics' ? 'topic' : 'lab'} id={ctx.id} title={ctx.title} />}
      {!inLab && (
        <footer className="foot">
          <p><b>{site.name}</b>{tr(" · версия 0.3 · учебная платформа. Данные занятий вымышлены и обозначены как учебные.")}</p>
          {acc.status === 'user' && acc.user?.canReadStatistics && <p><Link to="/statistics">{tr("Статистика сайта")}</Link></p>}
          <p><Link to="/about">{tr("О платформе, методике и изображениях")}</Link> · <Link to="/about#authoring">{tr("Как редактировать материалы")}</Link></p>
        </footer>)}
    </>)
}
export default function App() { return <HashRouter><Shell /></HashRouter> }
