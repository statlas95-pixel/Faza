import { chooseLanguage } from './language'
import { tr, language } from '../shared/locale'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { site } from './content'
import { update } from './store'
import { recordActivity } from './statistics'
import { publicPage } from '../shared/statistics'
import { TechCalculator } from './components/TechCalculator'
import { CommandPalette } from './components/CommandPalette'
import { ToastViewport } from './components/Toast'
import Home from './pages/Home'
import { Catalog, TopicPage } from './pages/Topics'
import { Glossary, Sources, Journal, About, AttemptPage } from './pages/Reference'
import AccountPage, { ImportBanner } from './pages/Account'
import StatisticsPage from './pages/Statistics'
import { Tutor } from './features/Tutor'
import { init, useAccount } from './account'
import { RoutePage, MapPage, DiagnosticPage } from './pages/Learning'
import { topicById, labById } from './content'

// Ленивая подгрузка тяжёлых страниц-симуляторов для быстрого старта и кешируемых чанков
const SandboxPage = lazy(() => import('./pages/Sandbox'))
const ReactionsPage = lazy(() => import('./pages/Reactions'))
const CampaignsPage = lazy(() => import('./pages/Campaigns'))
const PortfolioPage = lazy(() => import('./pages/Portfolio'))
const FindPage = lazy(() => import('./features/Sources').then((m) => ({ default: m.FindPage })))
const LabsIndex = lazy(() => import('./labs/LabPage').then((m) => ({ default: m.LabsIndex })))
const LabPage = lazy(() => import('./labs/LabPage').then((m) => ({ default: m.LabPage })))

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

function LanguageMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`language-picker ${open ? 'open' : ''}`} ref={ref}>
      <button
        type="button"
        className="lang-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={language === 'en' ? 'Language' : 'Язык'}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{language === 'en' ? 'English' : 'Русский'}</span>
        <svg className="lang-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.75 4.5L6 7.75L9.25 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="lang-menu" role="menu" aria-label={language === 'en' ? 'Select language' : 'Выбор языка'}>
          {([['ru', 'Русский'], ['en', 'English']] as const).map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={language === code}
              lang={code}
              className={`lang-opt ${language === code ? 'on' : ''}`}
              onClick={() => { setOpen(false); if (code !== language) chooseLanguage(code) }}
            >
              <span>{label}</span>
              {language === code && <span className="lang-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Shell() {
  const loc = useLocation()
  const inLab = /^\/labs\/.+/.test(loc.pathname)
  const acc = useAccount()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('faza.theme') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  const [cmdOpen, setCmdOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('faza.theme', theme) } catch { /* ignore */ }
  }, [theme])
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
  const inTopic = /^\/topics\/.+/.test(loc.pathname)
  useEffect(() => {
    document.body.dataset.mode = inLab ? 'focus' : 'explore'
    document.body.dataset.surface = inLab || inTopic ? 'reading' : 'mesh'
    if (!loc.hash) window.scrollTo(0, 0)
  }, [loc.pathname, inLab, inTopic])
  useEffect(() => {
    const t = document.title
    if (loc.pathname !== '/') update((p) => { p.last = { path: loc.pathname, title: t, at: Date.now() } })
  }, [loc.pathname])
  const languagePicker = <LanguageMenu />
  const themeButton = (
    <button
      type="button"
      className="theme-toggle theme-icon-btn"
      aria-label={theme === 'dark' ? tr('Включить светлую тему') : tr('Включить тёмную тему («Ночная смена»)')}
      title={theme === 'dark' ? tr('Светлая тема') : tr('Тёмная тема («Ночная смена»)')}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? (
        <svg className="ico-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="ico-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20.4 14.3A8.3 8.3 0 0 1 9.7 3.6a8.5 8.5 0 1 0 10.7 10.7Z" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
  const cmdButton = (
    <button
      type="button"
      className="theme-toggle cmdk-trigger"
      aria-label={tr('Быстрый поиск (Ctrl+K)')}
      title={tr('Быстрый поиск по темам, занятиям, сырью и терминам (Ctrl+K)')}
      onClick={() => setCmdOpen(true)}
    >
      ⌘K
    </button>
  )
  return (
    <>
      <a className="skip" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus() }}>{tr("К содержанию")}</a>
      {!inLab && (
        <header className="top">
          <Link to="/" className="logo" aria-label={`${site.name}${tr(" — на главную")}`}><span className="logo-drop" aria-hidden />{site.name}</Link>
          <nav aria-label={tr("Основные разделы")}>
            <NavLink to="/route">{tr("Маршрут")}</NavLink><NavLink to="/map">{tr("Карта знаний")}</NavLink><NavLink to="/sandbox">{tr("Лаборатория")}</NavLink><NavLink to="/reactions">{tr("Реакции")}</NavLink><NavLink to="/campaigns">{tr("Кампании")}</NavLink><NavLink to="/portfolio">{tr("Портфолио")}</NavLink><NavLink to="/journal">{tr("Журнал")}</NavLink>
            <NavLink to="/account" className="acct">{acc.status === 'user' ? acc.user?.name : acc.status === 'offline' ? tr("Без сервера") : tr("Войти")}</NavLink>
          </nav><div className="top-tools">{cmdButton}{themeButton}{languagePicker}</div>
        </header>)}
      {inLab && <div className="lab-language">{cmdButton}{themeButton}{languagePicker}</div>}
      <ImportBanner />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page"><p className="small muted">{tr("Загрузка раздела…")}</p></div>}>
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
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/reactions" element={<ReactionsPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/find" element={<FindPage />} />
            <Route path="/attempts/:id" element={<AttemptPage />} />
            <Route path="*" element={<div className="page"><h1>{tr("Страница не найдена")}</h1><p><Link to="/">{tr("На главную")}</Link></p></div>} />
          </Routes>
        </Suspense>
      </main>
      {m && ctx && <Tutor kind={m[1] === 'topics' ? 'topic' : 'lab'} id={ctx.id} title={ctx.title} />}
      <TechCalculator />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <ToastViewport />
      {!inLab && (
        <nav className="mobile-nav no-print" aria-label={tr("Мобильная навигация")}>
          <NavLink to="/" end>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            <span>{tr("Главная")}</span>
          </NavLink>
          <NavLink to="/route">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19c2.5-5 5.5-7 9-7s5-2 5-7M19 5l-3 2m3-2 2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="5" cy="19" r="2" stroke="currentColor" strokeWidth="1.8" /></svg>
            <span>{tr("Маршрут")}</span>
          </NavLink>
          <NavLink to="/map">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" /><path d="M8.3 6.5 15.6 7M7.3 8.2l3.6 7.6M16.7 9.2l-3.5 6.6" stroke="currentColor" strokeWidth="1.6" /></svg>
            <span>{tr("Карта")}</span>
          </NavLink>
          <NavLink to="/sandbox">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 3h6m-5 0v5.4L5.2 17a2.5 2.5 0 0 0 2.2 3.7h9.2a2.5 2.5 0 0 0 2.2-3.7L14 8.4V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M7.5 14.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span>{tr("Лаборатория")}</span>
          </NavLink>
          <NavLink to="/catalog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <span>{tr("Поиск")}</span>
          </NavLink>
        </nav>
      )}
      {!inLab && (
        <footer className="foot">
          <p><b>{site.name}</b>{tr(" · версия 0.3 · учебная платформа. Данные занятий вымышлены и обозначены как учебные.")}</p>
          {acc.status === 'user' && acc.user?.canReadStatistics && <p><Link to="/statistics">{tr("Статистика сайта")}</Link></p>}
          <p><Link to="/about">{tr("О платформе, методике и изображениях")}</Link> · <Link to="/about#authoring">{tr("Как редактировать материалы")}</Link></p>
        </footer>)}
    </>)
}
export default function App() { return <HashRouter><Shell /></HashRouter> }
