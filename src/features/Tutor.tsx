import { tr, language } from '../../shared/locale'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, useAccount } from '../account'
import { useProgress, getProgress, bumpHints } from '../store'
import { renderSafe, citedIds } from '../md'
import { topicById, labById, sourceById } from '../content'

type Mode = 'explain' | 'hint' | 'review' | 'ground'
const MODES: { id: Mode; label: string; ph: string; def: string }[] = [
  { id: 'hint', label: tr("Намёк"), ph: tr("Где вы застряли? (можно оставить пустым)"), def: tr("Я не знаю, какой шаг сделать следующим. Дай намёк.") },
  { id: 'review', label: tr("Разобрать моё рассуждение"), ph: tr("Опишите ход своей мысли: что вы увидели и какой вывод сделали"), def: '' },
  { id: 'explain', label: tr("Углубиться в механизм"), ph: tr("Что именно объяснить? Например: почему вязкость падает после максимума"), def: tr("Объясни механизм, который лежит в основе этого материала.") },
  { id: 'ground', label: tr("Подтверждающий материал"), ph: tr("Какое утверждение проверить по материалам и источникам?"), def: tr("Покажи, на какие фрагменты и источники опирается основной вывод этого материала.") },
]
const PHASE: Record<string, string> = { brief: tr("вводная"), work: tr("работа с материалами"), bench: tr("опыты на стенде"), conclude: tr("формулировка выводов"), explain: tr("объяснение результата"), debrief: tr("разбор после попытки") }
/** Короткое описание того, что ученик уже сделал в занятии, — для контекста наставника. */
function describe(st: any): { stage?: string; actions?: string } {
  if (!st) return {}
  const a: string[] = []
  if (st.opened) a.push(`${tr("открыто документов: ")}${Object.keys(st.opened).filter((k) => st.opened[k]).length}`)
  if (st.marks) a.push(`${tr("отмечено записей: ")}${Object.values(st.marks).filter(Boolean).length}`)
  if (st.bought?.length) a.push(`${tr("получено запросов: ")}${st.bought.length}`)
  if (Array.isArray(st.runs)) a.push(`${tr("поставлено опытов: ")}${st.runs.length}`)
  if (Array.isArray(st.log)) a.push(`${tr("действия с партией: ")}${st.log.map((x: any) => (x.kind === 'bench' ? tr("снята кривая на пробе") : x.kind === 'add' ? `${tr("введено соли +")}${Number(x.pct).toFixed(2)} % → ${x.eta}${tr(" мПа·с")}` : tr("разбавление"))).join('; ') || tr("нет")}`)
  if (Array.isArray(st.tests)) a.push(`${tr("выполнено измерений: ")}${st.tests.join(', ') || tr("нет")}`)
  if (typeof st.step === 'number') a.push(`${tr("шаг расчёта ")}${st.step + 1}${tr("; открыто подсказок: ")}${Object.keys(st.hints ?? {}).length}`)
  if (st.crit) a.push(`${tr("выбран критерий: ")}${st.crit}`)
  return { stage: PHASE[st.phase] ?? st.phase, actions: a.join('; ') || undefined }
}
/** Подтверждающие материалы темы или занятия — показываются без обращения к ИИ. */
function Grounding({ kind, id }: { kind: 'topic' | 'lab'; id: string }) {
  const ts = kind === 'topic' ? [topicById(id)] : (labById(id)?.topics ?? []).map((t: string) => topicById(t))
  return (
    <div className="grounding">
      <p className="small"><b>{tr("Материалы платформы по этому шагу")}</b>{tr(" — открываются без ИИ:")}</p>
      <ul>{ts.filter(Boolean).map((t: any) => (
        <li key={t.id}><Link to={`/topics/${t.id}`}>{t.title}</Link>
          <ul>{citedIds(t.body).map(sourceById).filter(Boolean).slice(0, 5).map((src: any) => <li key={src.id} className="small"><Link to={`/sources/${src.id}`}>{src.authors.split(',')[0]} ({src.year})</Link> — {src.supports}</li>)}</ul></li>))}</ul>
    </div>)
}
interface Answer { text: string; model: string; fragments: any[]; finished: boolean; used: number; limit: number; mode: Mode }

/** Панель ИИ-наставника. Контекст — текущая тема или занятие; для занятия передаются только открытые учеником материалы. */
export function Tutor({ kind, id, title }: { kind: 'topic' | 'lab'; id: string; title: string }) {
  const a = useAccount(), p = useProgress()
  const [open, setOpen] = useState(false), [status, setStatus] = useState<any>(null)
  const [mode, setMode] = useState<Mode>(kind === 'lab' ? 'hint' : 'explain'), [authorStep, setAuthorStep] = useState(0), [msg, setMsg] = useState(''), [model, setModel] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ans, setAns] = useState<Answer | null>(null), [hintStep, setHintStep] = useState(1)
  const ctl = useRef<AbortController | null>(null), box = useRef<HTMLDivElement>(null)
  useEffect(() => { if (open && !status && a.status !== 'offline') api('GET', '/api/ai/status').then(setStatus).catch(() => setStatus({ configured: false, models: [], providers: [] })) }, [open, a.status]) // eslint-disable-line
  useEffect(() => { setAns(null); setErr(''); setHintStep(1); setAuthorStep(0) }, [id])
  useEffect(() => { if (open) box.current?.focus() }, [open])
  if (kind === 'lab' && !p.settings.hints) return null
  const cur = MODES.find((m) => m.id === mode)!
  const chosen = model || p.settings.aiModel || status?.models?.[0]?.id || ''
  async function send(step = hintStep) {
    const text = msg.trim() || cur.def
    if (!text) { setErr(tr("Опишите своё рассуждение — без него разбирать нечего.")); return }
    const st = kind === 'lab' ? getProgress().labs[id] ?? {} : {}
    ctl.current = new AbortController(); setBusy(true); setErr('')
    try {
      const r = await api('POST', '/api/ai/tutor', { language, model: chosen, mode, kind, id, level: p.settings.level, hintStep: step, message: text, ...describe(kind === 'lab' ? st : undefined), opened: Object.keys(st.opened ?? {}).filter((k) => st.opened[k]), bought: st.bought ?? [] }, ctl.current.signal)
      setAns({ ...r, mode })
      if (kind === 'lab' && mode === 'hint' && !r.finished) bumpHints(id)
    } catch (e: any) {
      if (e?.name === 'AbortError') setErr(tr("Запрос отменён."))
      else setErr((e instanceof ApiError ? e.message : tr("Не удалось получить ответ.")) + tr(" Подсказки авторов и подтверждающие материалы выше доступны без ИИ."))
    } finally { setBusy(false); ctl.current = null }
  }
  return (
    <>
      <button className="tutor-fab" aria-expanded={open} onClick={() => setOpen(!open)}><span aria-hidden>✦</span>{tr(" Наставник")}</button>
      {open && (
        <aside className="tutor" role="dialog" aria-label={tr("ИИ-наставник")} tabIndex={-1} ref={box} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
          <header><div><b>{tr("ИИ-наставник")}</b><span className="small">{tr("Контекст: ")}{kind === 'topic' ? tr("тема") : tr("занятие")} «{title}»</span></div><button className="btn small ghost" onClick={() => setOpen(false)} aria-label={tr("Закрыть панель наставника")}>✕</button></header>
          {(() => { const hints: string[] = kind === 'lab' ? labById(id)?.hints ?? [] : []; return hints.length > 0 && (
            <div className="authorhints"><p className="small"><b>{tr("Подсказки авторов занятия")}</b>{tr(" — работают без ИИ; каждая открытая подсказка засчитывается как решение с опорой.")}</p>
              {hints.slice(0, authorStep).map((h, i) => <p key={i} className="hintbox"><b>{i + 1}.</b> {h}</p>)}
              {authorStep < hints.length && <button className="btn small ghost" onClick={() => { setAuthorStep(authorStep + 1); bumpHints(id) }}>{authorStep === 0 ? tr("Открыть первую подсказку") : `${tr("Следующая подсказка (")}${authorStep + 1}${tr(" из ")}${hints.length})`}</button>}</div>) })()}
          <details className="groundbox"><summary>{tr("Открыть подтверждающие материалы")}</summary><Grounding kind={kind} id={id} /></details>
          {a.status === 'offline' && <p className="tutor-state">{tr("Наставник недоступен: приложение открыто без сервера. Все темы и занятия работают без него.")}</p>}
          {a.status === 'checking' && <p className="tutor-state" role="status">{tr("Проверяю связь…")}</p>}
          {a.status === 'guest' && <p className="tutor-state">{tr("Наставник доступен после входа: обращения учитываются по аккаунту. ")}<Link to="/account">{tr("Войти или зарегистрироваться")}</Link></p>}
          {a.status === 'user' && status && !status.configured && (
            <div className="tutor-state"><p><b>{tr("На этом сервере ИИ-наставник не настроен.")}</b>{tr(" Обучение работает без него. Администратору нужно задать ключ провайдера в файле ")}<code>.env</code>:</p>
              <ul>{status.providers.map((x: any) => <li key={x.id}>{x.name}: {x.ready ? tr("подключён") : `${tr("не подключён — ")}${x.hint}`}</li>)}</ul></div>)}
          {a.status === 'user' && status?.configured && (
            <div className="tutor-body">
              <div className="seg" role="group" aria-label={tr("Что нужно от наставника")}>{MODES.map((m) => <label key={m.id} className={mode === m.id ? 'on' : ''}><input type="radio" name="tmode" checked={mode === m.id} onChange={() => { setMode(m.id); setErr('') }} />{m.label}</label>)}</div>
              <label className="sr" htmlFor="tmsg">{tr("Сообщение наставнику")}</label>
              <textarea id="tmsg" rows={3} maxLength={status.limits.maxInputChars} value={msg} placeholder={cur.ph} onChange={(e) => setMsg(e.target.value)} />
              <div className="row">
                <label className="sr" htmlFor="tmodel">{tr("Модель")}</label>
                <select id="tmodel" value={chosen} onChange={(e) => setModel(e.target.value)}>{status.models.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                {busy ? <button className="btn" onClick={() => ctl.current?.abort()}>{tr("Отменить")}</button> : <button className="btn primary" onClick={() => { setHintStep(1); void send(1) }}>{tr("Спросить")}</button>}
              </div>
              <p className="small dim">{status.models.find((m: any) => m.id === chosen)?.note}{tr(" · уровень: ")}{{ novice: tr("начинающий"), practitioner: tr("практик"), expert: tr("эксперт") }[p.settings.level]} (<Link to="/account">{tr("изменить")}</Link>)</p>
              <div aria-live="polite">
                {busy && <p className="loading" role="status">{tr("Наставник думает… ответ может занять до минуты")}</p>}
                {err && <p className="warnline" role="alert">{err}</p>}
                {ans && !busy && (
                  <article className="tutor-answer">
                    <div className="prose small" dangerouslySetInnerHTML={{ __html: renderSafe(ans.text, ans.fragments) }} />
                    {ans.mode === 'hint' && !ans.finished && hintStep < 3 && <button className="btn small" onClick={() => { const n = hintStep + 1; setHintStep(n); void send(n) }}>{tr("Нужна более прямая подсказка (шаг ")}{hintStep + 1}{tr(" из 3)")}</button>}
                    <details><summary>{tr("Что было передано модели (")}{ans.fragments.length})</summary>
                      <ul className="frags">{ans.fragments.map((f) => <li key={f.id}><span className="num">{f.id}</span> <Link to={f.path}>{f.title}</Link> <span className="dim">— {{ section: tr("раздел темы"), source: tr("запись источника"), lab: tr("вводная занятия"), material: tr("материал, открытый вами"), external: tr("внешний материал") }[f.kind as string]}</span></li>)}</ul>
                      {kind === 'lab' && !ans.finished && <p className="small">{tr("Занятие не завершено: разбор и правильные ответы модели не передавались.")}</p>}</details>
                    <p className="small dim">{tr("Модель: ")}{ans.model}{tr(" · обращений сегодня: ")}{ans.used}{tr(" из ")}{ans.limit}{tr(". Ответ модели — не проверенный источник: метки ведут к материалам платформы, по которым его можно сверить.")}</p>
                  </article>)}
              </div>
            </div>)}
        </aside>)}
    </>)
}
