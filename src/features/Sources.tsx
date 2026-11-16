import { useEffect, useState, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError, useAccount } from '../account'
import { useProgress, toggleSource, patchSource } from '../store'
import { useTitle } from '../pages/util'

const ACCESS: Record<string, [string, string]> = {
  record: ['Библиографическая запись', 'Известны только выходные данные; содержание нужно читать у издателя'],
  abstract: ['Есть аннотация', 'Аннотация доступна в базе; полный текст — у издателя, возможно платно'],
  open: ['Открытая лицензия', 'В записи указана лицензия Creative Commons — полный текст, скорее всего, открыт у издателя'],
  catalog: ['Каталог платформы', 'Документ проверен редактором платформы'],
}
function Card({ r, topic }: { r: any; topic?: string }) {
  const saved = useProgress().savedSources.some((s) => s.key === r.key)
  const [open, setOpen] = useState(false)
  const acc = ACCESS[r.access ?? 'catalog']
  return (
    <li className="srccard">
      <div className="srchead"><span className="kindtag">{r.type}</span><span className={`access a-${r.access ?? 'catalog'}`} title={acc[1]}>{acc[0]}</span></div>
      <h4>{r.title}</h4>
      <p className="small">{[r.authors, r.venue, r.year].filter(Boolean).join(' · ')}{r.citedBy ? ` · цитирований в Crossref: ${r.citedBy}` : ''}</p>
      {r.matched && <p className="small why"><b>Почему в выдаче:</b> {r.matched.length ? `в названии или аннотации найдены слова запроса — ${r.matched.join(', ')}` : 'совпадение по полям записи, которых нет в карточке (например, список литературы) — проверьте релевантность по аннотации'}</p>}
      {r.scope && <p className="small why"><b>Область применения:</b> {r.scope}</p>}
      {r.checked && <p className="small dim">Проверка: {r.checked}</p>}
      {r.abstract && <><button className="btn small ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Скрыть аннотацию' : 'Показать аннотацию'}</button>{open && <p className="abstract">{r.abstract}</p>}</>}
      <div className="row">
        <a className="btn small" href={r.url} target="_blank" rel="noreferrer">Открыть оригинал ↗</a>
        {r.path && <Link className="btn small ghost" to={r.path}>Запись в реестре</Link>}
        {r.doi && <span className="num small">doi:{r.doi}</span>}
        <button className={`btn small ghost ${saved ? 'bm on' : ''}`} aria-pressed={saved} onClick={() => toggleSource({ key: r.key, title: r.title, authors: r.authors ?? '', year: r.year ?? '', type: r.type, doi: r.doi, url: r.url, provider: r.provider ?? 'catalog', access: r.access ?? 'catalog', topic })}>{saved ? '★ В подборке' : '☆ В подборку'}</button>
      </div>
    </li>)
}

export function SourceFinder({ suggestions = [], topic, initial = '' }: { suggestions?: string[]; topic?: string; initial?: string }) {
  const a = useAccount()
  const [q, setQ] = useState(initial), [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ext, setExt] = useState<any>(null), [cat, setCat] = useState<any[]>([]), [err, setErr] = useState<{ msg: string; code: string } | null>(null)
  async function run(query: string) {
    const s = query.trim(); if (s.length < 3) return
    setQ(s); setState('loading'); setErr(null); setExt(null)
    api('GET', `/api/search/catalog?q=${encodeURIComponent(s)}`).then((r) => setCat(r.results)).catch(() => setCat([]))
    try { setExt(await api('GET', `/api/search/external?q=${encodeURIComponent(s)}`)); setState('done') }
    catch (e) { const x = e as ApiError; setErr({ code: x.code ?? 'error', msg: x.code === 'rate_limited' ? `${x.message}${x.data?.retryAfter ? ` Повторите через ${x.data.retryAfter} с.` : ''}` : x.message }); setState('error') }
  }
  useEffect(() => { if (initial && a.status !== 'offline' && a.status !== 'checking') void run(initial) }, [a.status]) // eslint-disable-line
  if (a.status === 'offline') return <div className="panel"><p><b>Поиск внешних источников недоступен:</b> приложение открыто без сервера. Источники, уже проверенные редактором, перечислены в разделе <Link to="/sources">«Источники»</Link>.</p></div>
  return (
    <div className="finder">
      <form role="search" className="finderform" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(q) }}>
        <label htmlFor="fq">Запрос к научной базе — лучше на английском, 2–6 ключевых слов</label>
        <div className="row"><input id="fq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="lamellar gel network cetearyl alcohol" maxLength={200} />
          <button className="btn primary" disabled={state === 'loading' || q.trim().length < 3}>{state === 'loading' ? 'Ищу…' : 'Найти'}</button></div>
      </form>
      {suggestions.length > 0 && <p className="small">Запросы по этой теме: {suggestions.map((s) => <button key={s} className="chip" onClick={() => void run(s)}>{s}</button>)}</p>}
      <div aria-live="polite">
        {state === 'loading' && <p className="loading" role="status">Запрашиваю Crossref… обычно это занимает 1–3 секунды</p>}
        {state === 'error' && err && <div className="warnline" role="alert"><b>Научная база не ответила.</b> {err.msg} Уроки, занятия и каталог платформы работают без неё. <button className="btn small ghost" onClick={() => void run(q)}>Повторить</button></div>}
        {cat.length > 0 && state !== 'idle' && (
          <section><h3 className="srcsec"><span className="where w-cat">Каталог платформы</span> Проверенные редактором источники и технические документы</h3>
            <ul className="srclist">{cat.map((r) => <Card key={r.key} r={r} topic={topic} />)}</ul></section>)}
        {ext && (
          <section><h3 className="srcsec"><span className="where w-ext">Научная база Crossref</span> Найдено записей: {ext.results.length}{ext.cached ? ext.stale ? ' · показан сохранённый ранее результат: база сейчас недоступна' : ' · из кэша платформы' : ''}</h3>
            <p className="small">Это библиографические записи издателей. Платформа их <b>не проверяла</b>: сохраните запись в подборку как кандидата и прочтите первоисточник, прежде чем опираться на него.</p>
            {ext.results.length === 0 && <p className="empty">По этому запросу Crossref ничего не вернул. Попробуйте английские термины, меньше слов или название вещества по INCI.</p>}
            <ul className="srclist">{ext.results.map((r: any) => <Card key={r.key} r={r} topic={topic} />)}</ul></section>)}
      </div>
    </div>)
}

export function FindPage() {
  useTitle('Поиск источников')
  const [sp] = useSearchParams()
  return (
    <div className="page">
      <h1>Поиск внешних источников</h1>
      <p className="lead">Запрос уходит с сервера платформы в библиографическую базу Crossref и параллельно — в каталог платформы. Результаты двух видов показаны раздельно.</p>
      <SourceFinder initial={sp.get('q') ?? ''} suggestions={['yield stress cosmetic emulsion', 'lamellar gel network cream', 'wormlike micelles shampoo viscosity']} />
      <h2 style={{ marginTop: 40 }}>Моя подборка</h2><SavedSources />
    </div>)
}

export function SavedSources() {
  const list = useProgress().savedSources
  if (!list.length) return <p className="muted">Подборка пуста. Кнопка «В подборку» есть на каждой карточке в поиске источников.</p>
  return (
    <ul className="srclist">{list.map((s) => (
      <li key={s.key} className="srccard">
        <div className="srchead"><span className="kindtag">{s.type}</span><span className={`access a-${s.access}`}>{ACCESS[s.access]?.[0] ?? s.access}</span>{s.provider !== 'catalog' && <span className="access a-cand">Кандидат: не проверен редактором</span>}</div>
        <h4>{s.title}</h4><p className="small">{[s.authors, s.year].filter(Boolean).join(' · ')}{s.topic && <> · сохранён из темы <Link to={`/topics/${s.topic}`}>{s.topic}</Link></>}</p>
        <label className="field sm" htmlFor={`n-${s.key}`}>Заметка: что вы хотите из него взять или проверить</label>
        <textarea id={`n-${s.key}`} rows={2} maxLength={600} defaultValue={s.note ?? ''} onBlur={(e) => patchSource(s.key, { note: e.target.value })} />
        <div className="row"><a className="btn small" href={s.url} target="_blank" rel="noreferrer">Открыть оригинал ↗</a>
          {s.provider !== 'catalog' && <label className="choice sm inline"><input type="checkbox" checked={!!s.suggested} onChange={(e) => patchSource(s.key, { suggested: e.target.checked })} /><span>Предложить редактору для проверки</span></label>}
          <button className="btn small ghost" onClick={() => toggleSource(s)}>Убрать</button></div>
      </li>))}</ul>)
}
