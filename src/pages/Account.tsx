import { useEffect, useState, FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAccount, signIn, signUp, signOut, requestReset, resetPassword, importGuest, dismissImport, syncNow } from '../account'
import { useProgress, setSettings } from '../store'
import { ConfirmButton } from '../ui'
import { SavedSources } from '../features/Sources'
import { useTitle } from './util'

export function ImportBanner() {
  const a = useAccount(), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const p = a.pendingImport
  if (!p) return null
  const s = p.summary
  const items = [[s.topics, 'открытых тем'], [s.answers, 'ответов на проверочные вопросы'], [s.diagnostic, 'ответов в диагностике'], [s.labsStarted, 'сохранённых состояний занятий'], [s.labsDone, 'завершённых занятий'], [s.attempts, 'записей в истории попыток'], [s.bookmarks, 'закладок'], [s.sources, 'сохранённых источников']].filter(([n]) => (n as number) > 0)
  return (
    <aside className="import" role="dialog" aria-label="Импорт локального прогресса">
      <div>
        <b>В этом браузере есть прогресс, сохранённый до входа</b>
        <p>Его можно добавить в аккаунт. Будет импортировано: {items.map(([n, t]) => `${n} ${t}`).join(', ')}. Данные аккаунта не затираются — записи объединяются, повторный импорт того же набора невозможен.</p>
        {err && <p className="warnline" role="alert">{err}</p>}
      </div>
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await importGuest() } catch { setErr('Импорт не удался — локальные данные не тронуты, попробуйте ещё раз.') } setBusy(false) }}>{busy ? 'Импортирую…' : 'Импортировать'}</button>
        <button className="btn ghost" onClick={dismissImport}>Не импортировать</button>
      </div>
    </aside>)
}

function AuthForms() {
  const [sp, setSp] = useSearchParams()
  const token = sp.get('reset')
  const [tab, setTab] = useState<'in' | 'up' | 'forgot'>(token ? 'forgot' : 'in')
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const a = useAccount()
  const run = async (e: FormEvent, fn: () => Promise<void>, ok = '') => { e.preventDefault(); setErr(''); setMsg(''); setBusy(true); try { await fn(); setMsg(ok) } catch (x: any) { setErr(x.message) } setBusy(false) }
  if (token) return (
    <form className="authform" onSubmit={(e) => run(e, async () => { await resetPassword(token, pw); setSp({}); setTab('in'); setPw('') }, 'Пароль изменён. Войдите с новым паролем.')}>
      <h2>Новый пароль</h2>
      <label htmlFor="npw">Новый пароль (не менее 10 символов)</label><input id="npw" type="password" autoComplete="new-password" minLength={10} required value={pw} onChange={(e) => setPw(e.target.value)} />
      {err && <p className="warnline" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy}>Сохранить пароль</button>
      <button type="button" className="btn ghost" onClick={() => setSp({})}>Отмена</button>
    </form>)
  return (
    <div className="authbox">
      <div className="seg" role="tablist">
        {([['in', 'Вход'], ['up', 'Регистрация'], ['forgot', 'Забыли пароль']] as const).map(([k, l]) => <label key={k} className={tab === k ? 'on' : ''}><input type="radio" name="authtab" checked={tab === k} onChange={() => { setTab(k); setErr(''); setMsg('') }} />{l}</label>)}
      </div>
      {tab === 'in' && (
        <form className="authform" onSubmit={(e) => run(e, () => signIn(email, pw))}>
          <label htmlFor="em">Электронная почта</label><input id="em" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="pw">Пароль</label><input id="pw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="warnline" role="alert">{err}</p>}{msg && <p className="okline" role="status">{msg}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Вхожу…' : 'Войти'}</button>
        </form>)}
      {tab === 'up' && (
        <form className="authform" onSubmit={(e) => run(e, () => signUp(name, email, pw))}>
          <label htmlFor="nm">Как к вам обращаться</label><input id="nm" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="em2">Электронная почта</label><input id="em2" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="pw2">Пароль (не менее 10 символов)</label><input id="pw2" type="password" autoComplete="new-password" minLength={10} required value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="warnline" role="alert">{err}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Создаю…' : 'Создать аккаунт'}</button>
          <p className="small">Почта нужна только для входа и восстановления доступа. Подтверждение адреса не требуется.</p>
        </form>)}
      {tab === 'forgot' && (
        <form className="authform" onSubmit={(e) => run(e, () => requestReset(email), a.mail === 'smtp' ? 'Если такой адрес зарегистрирован, на него отправлено письмо со ссылкой. Ссылка действует 1 час.' : 'Если такой адрес зарегистрирован, письмо со ссылкой создано. На этом сервере почта не настроена: письмо лежит в папке data/outbox на компьютере, где запущена платформа, — откройте файл и перейдите по ссылке.')}>
          <label htmlFor="em3">Электронная почта аккаунта</label><input id="em3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {err && <p className="warnline" role="alert">{err}</p>}{msg && <p className="okline" role="status">{msg}</p>}
          <button className="btn primary" disabled={busy}>Получить ссылку</button>
        </form>)}
    </div>)
}

export default function AccountPage() {
  useTitle('Аккаунт')
  const a = useAccount(), p = useProgress(), nav = useNavigate()
  const [ai, setAi] = useState<any>(null)
  useEffect(() => { if (a.status !== 'offline' && a.status !== 'checking') fetch('/api/ai/status').then((r) => r.json()).then(setAi).catch(() => setAi(null)) }, [a.status])
  return (
    <div className="page account">
      <h1>Аккаунт</h1>
      {a.status === 'checking' && <p role="status">Проверяю связь с сервером…</p>}
      {a.status === 'offline' && (
        <div className="panel"><h3>Сервер платформы недоступен</h3>
          <p>Приложение открыто как файл или сервер не запущен. Темы и занятия работают полностью, прогресс сохраняется в этом браузере. Аккаунт, поиск внешних источников и ИИ-наставник появятся, когда платформа запущена командой <code>npm start</code> или открыта по адресу сервера.</p>
          <p><Link to="/journal">Мой журнал (локальный прогресс)</Link></p></div>)}
      {a.status === 'guest' && (<>
        <p className="lead">С аккаунтом прогресс, история попыток, закладки и подборка источников сохраняются на сервере и доступны с любого устройства. Без входа всё работает как раньше — данные остаются в этом браузере.</p>
        <AuthForms /></>)}
      {a.status === 'user' && a.user && (<>
        <section className="panel"><h3>{a.user.name}</h3>
          <p className="num">{a.user.email}</p>
          <p className="small" role="status">Синхронизация: {a.sync === 'saving' ? 'сохраняю…' : a.sync === 'error' ? 'нет связи — изменения сохранены в браузере и будут отправлены при восстановлении связи' : 'все изменения сохранены на сервере'}
            {a.sync === 'error' && <> <button className="btn small ghost" onClick={syncNow}>Повторить</button></>}</p>
          <div className="row"><Link className="btn" to="/journal">Мой журнал</Link><button className="btn ghost" onClick={async () => { await signOut(); nav('/account') }}>Выйти</button></div></section>
        <section className="panel"><h3>Настройки обучения</h3>
          <fieldset><legend>Мой уровень — влияет на объяснения ИИ-наставника</legend>
            <div className="seg">{([['novice', 'Начинающий'], ['practitioner', 'Практик'], ['expert', 'Эксперт']] as const).map(([k, l]) => <label key={k} className={p.settings.level === k ? 'on' : ''}><input type="radio" name="lvl" checked={p.settings.level === k} onChange={() => setSettings({ level: k })} />{l}</label>)}</div></fieldset>
          <label className="choice sm"><input type="checkbox" checked={p.settings.hints} onChange={(e) => setSettings({ hints: e.target.checked })} /><span>Показывать кнопку подсказок в занятиях<small>Опытным пользователям её можно отключить</small></span></label>
          {ai?.configured && (
            <label className="field">Модель наставника по умолчанию
              <select value={p.settings.aiModel ?? ''} onChange={(e) => setSettings({ aiModel: e.target.value || undefined })}>
                <option value="">— первая из настроенных —</option>{ai.models.map((m: any) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}</select></label>)}
          <p className="small">ИИ-наставник: {ai ? (ai.configured ? `настроено моделей — ${ai.models.length}; лимит ${ai.limits.daily} обращений в сутки` : 'на этом сервере не настроен') : 'статус недоступен'}.</p>
        </section>
        <section className="panel"><h3>Сохранённые источники</h3><SavedSources /></section>
        <section className="panel"><h3>Удаление данных</h3>
          <p className="small">Удаляет прогресс, историю попыток и подборку на сервере. Аккаунт остаётся.</p>
          <ConfirmButton label="Удалить мои учебные данные" ask="Удалить прогресс и историю без возможности восстановления?" onConfirm={async () => { const { api } = await import('../account'); const { resetProgress } = await import('../store'); await api('DELETE', '/api/me'); resetProgress() }} /></section>
      </>)}
    </div>)
}
