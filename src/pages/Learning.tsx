import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { topicById, labById, areaLabel, levelLabel, levelHint } from '../content'
import { useLearning, curriculum, skills, skillById, skillOfTopic, diagItems, diagTracks, diagDomainLabel, setGoal, answerDiag, restartDiag, moduleOfTopic } from '../learning'
import { LEVELS, CONF, diagItemsForTrack, diagTotal, type SkillState, type RouteStep } from '../../shared/mastery'
import { parseNum, ConfirmButton } from '../ui'
import { useTitle } from './util'

export function LevelBar({ s, compact }: { s?: SkillState; compact?: boolean }) {
  const lvl = s?.level ?? 0
  return (
    <span className={`lvl l${lvl}`} role="img" aria-label={`Уровень: ${LEVELS[lvl].name}; оценка: ${CONF[s?.confidence ?? 0]}`}>
      <span className="pips" aria-hidden>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= lvl ? 'on' : ''} />)}</span>
      {!compact && <b>{LEVELS[lvl].name}</b>}{!compact && lvl > 0 && <span className="conf">{CONF[s!.confidence]}</span>}
      {s?.gap && <span className="gapmark" title="Есть затруднение">затруднение</span>}{s?.legacy && <span className="conf">пройдено ранее, не оценено</span>}
    </span>)
}

export function GoalPicker({ onDone }: { onDone?: () => void }) {
  const { p } = useLearning()
  const [ctx, setCtx] = useState(p.profile.context ?? '')
  return (
    <div className="goalpick">
      <fieldset><legend>Где вы сейчас работаете? <span className="small">— только для подбора примеров, на оценку уровня не влияет</span></legend>
        <div className="seg">{curriculum.contexts.map((c) => <label key={c.id} className={ctx === c.id ? 'on' : ''}><input type="radio" name="ctx" checked={ctx === c.id} onChange={() => setCtx(c.id)} />{c.name}</label>)}</div></fieldset>
      <div className="goals" role="group" aria-label="Профессиональная цель">
        {curriculum.goals.map((g) => <button key={g.id} className={`goal ${p.profile.goal === g.id ? 'on' : ''}`} aria-pressed={p.profile.goal === g.id} onClick={() => { setGoal(g.id, ctx || undefined); onDone?.() }}><b>{g.name}</b><span>{g.hint}</span></button>)}
      </div>
    </div>)
}

export function StepCard({ r, main }: { r: RouteStep; main?: boolean }) {
  const t = topicById(r.topic)!, sk = skillById(r.skill), lab = t.labs.map(labById).find(Boolean)
  return (
    <article className={`step ${r.status} ${main ? 'main' : ''}`}>
      <span className={`swatch ${t.swatch} sm`} aria-hidden />
      <div>
        <p className="eyebrow">{r.status === 'now' ? 'Рекомендуем сейчас' : r.status === 'done' ? 'Навык подтверждён' : 'Дальше'} · {moduleOfTopic(t.id)?.module.name} · <span className={`lvtag lv${t.level}`}>{levelLabel[t.level]}</span></p>
        <h3><Link to={`/topics/${t.id}`}>{t.title}</Link></h3>
        <p className="why"><b>Почему:</b> {r.reason}</p>
        {main && sk && <p><b>Результат:</b> вы сможете {sk.outcome}.</p>}
        {main && <div className="row"><Link className="btn primary" to={`/topics/${t.id}`}>Открыть тему · {t.minutes} мин</Link>{lab && <Link className="btn ghost" to={`/labs/${lab.id}`}>Сразу к практике: {lab.title}</Link>}</div>}
      </div>
    </article>)
}

export function RoutePage() {
  useTitle('Мой маршрут')
  const L = useLearning(), [pick, setPick] = useState(false)
  if (!L.goal || pick) return (
    <div className="page"><h1>Мой маршрут</h1><p className="lead">Выберите профессиональную цель — от неё зависит порядок тем. Цель можно сменить в любой момент; прогресс и уровни навыков при этом сохраняются.</p>
      <GoalPicker onDone={() => setPick(false)} />{L.goal && <p><button className="btn ghost" onClick={() => setPick(false)}>Отмена</button></p>}</div>)
  const now = L.route.find((r) => r.status === 'now')
  return (
    <div className="page route">
      <p className="eyebrow">Цель: {L.goal.name} · <button className="linkbtn" onClick={() => setPick(true)}>сменить</button></p>
      <h1>Мой маршрут</h1>
      {!L.diagDone && <div className="notice">{L.diagAnswered ? `Диагностика пройдена частично (${L.diagAnswered} ответов) — рекомендации предварительные.` : 'Диагностика не пройдена — маршрут идёт по порядку цели, рекомендации предварительные.'} <Link className="btn small" to="/diagnostic">{L.diagAnswered ? 'Продолжить диагностику' : 'Выбрать вариант диагностики'}</Link></div>}
      {now ? <StepCard r={now} main /> : <div className="notice ok">Все навыки маршрута подтверждены действием. Загляните в <Link to="/map">карту знаний</Link> — там видно, что запланировано дальше.</div>}
      <h2>Дальше по маршруту</h2>
      <ol className="steps-list" start={2}>{L.route.filter((r) => r !== now).map((r) => <li key={r.topic} className={r.status}><StepCard r={r} /></li>)}</ol>
      <h2>Профиль навыков</h2>
      <p className="small">Уровень — что вы делаете сами; он считается по действиям, а не по открытым страницам. Рядом — насколько оценка подтверждена независимыми свидетельствами.</p>
      <div className="table-wrap" tabIndex={0}><table className="skills"><thead><tr><th>Навык</th><th>Уровень и уверенность оценки</th><th>На чём основано</th></tr></thead>
        <tbody>{skills.map((sk) => { const s = L.states[sk.id]; return (
          <tr key={sk.id}><th scope="row">{sk.name}</th><td><LevelBar s={s} /></td>
            <td className="small">{s.evidence.length ? s.evidence.slice(0, 3).map((e) => `${e.label}${e.kind === 'lab' && e.hints ? ` (с подсказками: ${e.hints})` : ''}`).join('; ') : s.legacy ? 'занятие пройдено до появления профиля навыков' : 'действий пока не было'}</td></tr>) })}</tbody></table></div>
      <details className="scale"><summary>Шкала освоения</summary><ol start={0}>{LEVELS.map((l) => <li key={l.n}><b>{l.name}.</b> {l.text}</li>)}</ol>
        <p className="small">Уверенность: «предварительно» — одно свидетельство, «подтверждено» — два независимых, «уверенно» — три и более. Повтор одной и той же попытки не добавляет уверенности.</p></details>
      <div className="row"><Link className="btn ghost" to="/diagnostic">{L.diagDone ? 'Пройти диагностику заново' : 'Диагностика'}</Link><Link className="btn ghost" to="/map">Карта знаний</Link></div>
    </div>)
}

export function MapPage() {
  useTitle('Карта знаний')
  const L = useLearning()
  return (
    <div className="page map">
      <h1>Карта знаний</h1>
      <p className="lead">Раздел → модуль → тема. Внутри модуля темы идут от простого к сложному. Открыть можно любую тему в любом порядке; «после» показывает предпосылку.</p>
      <p className="legend-levels">{[1, 2, 3].map((n) => <span key={n}><span className={`lvtag lv${n}`}>{levelLabel[n]}</span> {levelHint[n]}</span>)}</p>
      {curriculum.sections.map((sec) => (
        <section key={sec.id} className={`mapsec c-${sec.color}`}>
          <header><span className={`swatch ${sec.color}`} aria-hidden /><div><h2>{sec.name}</h2><p>{sec.text}</p></div></header>
          <div className="modules">{sec.modules.map((m) => (
            <div key={m.id} className="module"><h3>{m.name}</h3>
              <ul>{[...m.topics.map((t) => ({ ...t, shared: false })), ...(m.also ?? []).map((id) => ({ id, prereq: [] as string[], shared: true }))].sort((a, b) => (topicById(a.id)?.level ?? 2) - (topicById(b.id)?.level ?? 2)).map((ref) => { const t = topicById(ref.id); if (!t) return null; const sk = skillOfTopic(t.id), s = sk ? L.states[sk.id] : undefined, r = L.route.find((x) => x.topic === t.id); return (
                <li key={ref.id} className={`mtopic ${r?.status ?? ''}`}><Link to={`/topics/${t.id}`}><b>{t.title}</b></Link>
                  <span className="mmeta"><span className={`lvtag lv${t.level}`} title={levelHint[t.level]}>{levelLabel[t.level]}</span>{ref.shared && <span className="tag">общая с модулем «{moduleOfTopic(t.id)?.module.name}»</span>}{r?.status === 'now' && <span className="tag now">рекомендуем сейчас</span>}{L.p.visited[t.id] ? <span className="tag">открывалась</span> : null}<LevelBar s={s} compact /> {t.labs.length ? `практика: ${t.labs.length}` : ''}</span>
                  {!!ref.prereq?.length && <span className="small prereq">после: {ref.prereq.map((x) => topicById(x)?.title).join('; ')}</span>}</li>) })}
                {(m.planned ?? []).map((x) => <li key={x} className="mtopic planned"><b>{x}</b><span className="mmeta"><span className="tag">в плане, ещё не опубликована</span></span></li>)}</ul></div>))}</div>
        </section>))}
      <p className="small">Обозначения: точки — уровень навыка по шкале из четырёх ступеней (см. «Мой маршрут»); «открывалась» — прохождение, а не владение.</p>
    </div>)
}

export function DiagnosticPage() {
  useTitle('Диагностика')
  const L = useLearning(), nav = useNavigate()
  const [val, setVal] = useState(''), [sel, setSel] = useState<number | null>(null)
  const [choosing, setChoosing] = useState(false)
  if (!L.goal) return <div className="page"><h1>Диагностика</h1><p className="lead">Сначала выберите цель — от неё зависит, с каких заданий начать.</p><GoalPicker /></div>
  const track = diagTracks.find((t) => t.id === L.p.diag.track)
  const legacy = !track && Object.keys(L.p.diag.answers).length > 0
  if (choosing || (!track && !legacy)) return (
    <div className="page diag-start"><p className="eyebrow">Входная диагностика</p><h1>Выберите вариант под вашу подготовку</h1>
      <p className="lead">Вариант задаёт начальную сложность и примеры, а не присваивает уровень навыка. Во всех вариантах есть теория и практика. Можно ответить «Не знаю», пропустить вопрос или вернуться позже.</p>
      <div className="goals" role="group" aria-label="Вариант диагностики">{diagTracks.map((t) => {
        const bank = diagItemsForTrack(diagItems, t.id).filter((i) => !i.after)
        return <button className="goal" key={t.id} onClick={() => { restartDiag(t.id); setChoosing(false); setVal(''); setSel(null) }}>
          <b>{t.name}</b><span>{t.description}</span><span className="small num">{bank.length} основных вопросов · теория: {bank.filter((i) => i.mode === 'theory').length} · практика: {bank.filter((i) => i.mode === 'practice').length} · ориентир {t.time}</span>
        </button>
      })}</div>
      <p className="small">Это короткий срез подготовки, а не экзамен или аттестация. Неохваченные навыки уточняются в темах и занятиях; результаты разных вариантов не предназначены для рейтинга людей.</p>
      {choosing && <button className="btn ghost" onClick={() => setChoosing(false)}>Вернуться к текущей диагностике</button>}
      <p><Link to="/route">Пропустить диагностику — открыть предварительный маршрут</Link></p>
    </div>)
  const item = L.nextItem
  const n = L.diagAnswered
  const bank = diagItemsForTrack(diagItems, L.p.diag.track)
  const change = <ConfirmButton label="Выбрать другой вариант" ask="При выборе нового варианта ответы диагностики будут сброшены. Занятия, закладки и остальные результаты сохранятся. Продолжить?" onConfirm={() => setChoosing(true)} />
  const go = (fn: () => void) => { fn(); setVal(''); setSel(null) }
  if (!item) {
    const ans = L.p.diag.answers
    return (
      <div className="page diag">
        <p className="eyebrow">Диагностика завершена</p><h1>Что показали ваши ответы</h1>
        <p className="lead">{track?.name ?? 'Прежний вариант диагностики'}. Результат предварительный: это основание для выбора тем, а не подтверждение профессиональной квалификации.</p>
        {track && <div className="diag-domains">{Object.entries(diagDomainLabel).map(([id, label]) => {
          const xs = bank.filter((i) => i.domain === id && ans[i.id]), tested = xs.filter((i) => !['skip', 'unknown'].includes(ans[i.id].result))
          return <section className="panel" key={id}><h2>{label}</h2><p>{tested.length ? `Верно ${tested.filter((i) => ans[i.id].result === 'ok').length} из ${tested.length} ответов` : 'Пока нет данных для оценки'}</p><p className="small">Не знаю: {xs.filter((i) => ans[i.id].result === 'unknown').length} · пропущено: {xs.filter((i) => ans[i.id].result === 'skip').length}</p></section>
        })}</div>}
        <div className="table-wrap" tabIndex={0}><table><thead><tr><th>Задание</th><th>Навык</th><th>Ваш ответ</th><th>Что это значит</th></tr></thead>
          <tbody>{bank.filter((i) => ans[i.id]).map((i) => { const a = ans[i.id]; return (
            <tr key={i.id}><td>{i.short}</td><td className="small">{skillById(i.skill)?.name}</td><td>{a.result === 'skip' ? 'пропущено' : a.result === 'unknown' ? 'не знаю' : a.note ?? a.value}</td>
              <td><span className={`verdict ${a.result === 'ok' ? 'ok' : a.result === 'partial' ? 'weak' : a.result === 'skip' ? 'weak' : 'wrong'}`}>{{ ok: i.kind === 'recognize' ? 'распознаёте' : 'решаете', partial: 'частично обосновано', wrong: 'затруднение', unknown: 'затруднение — честный ответ', skip: 'нет данных' }[a.result]}</span>{(i.topic ?? skillById(i.skill)?.topics[0]) && <p><Link to={`/topics/${i.topic ?? skillById(i.skill)!.topics[0]}`}>Разобрать теорию →</Link></p>}</td></tr>) })}</tbody></table></div>
        <p className="small">Диагностика даёт не больше уровня «выполняет с опорой»: самостоятельность и перенос подтверждаются только занятиями. Пропущенные задания не считаются ошибкой — по ним просто нет данных.</p>
        {L.next && <><h2>С чего начать</h2><StepCard r={L.next} main /></>}
        <div className="row"><Link className="btn" to="/route">Весь маршрут и профиль навыков</Link><ConfirmButton label="Пройти заново" ask="Сбросить ответы этой диагностики и начать заново? Остальной прогресс сохранится." onConfirm={() => go(() => restartDiag(L.p.diag.track))} />{change}</div>
      </div>)
  }
  const total = L.diagTotal
  return (
    <div className="page diag">
      <p className="eyebrow">Диагностика · цель: {L.goal.name}</p>
      <p><b>{track?.name ?? 'Ранее начатая диагностика'}</b> · {change}</p>
      {legacy && <p className="notice">Ваши прежние ответы сохранены. Можно завершить этот вариант или выбрать новый, подходящий по подготовке.</p>}
      <div className="dprog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(n, total)} aria-label="Ход диагностики"><span style={{ width: `${Math.min(100, (n / total) * 100)}%` }} /></div>
      <p className="small">{item.after ? 'Уточняющее задание — оно появилось после ответа на основной вопрос.' : `Задание ${n + 1} из ${total}.`} Основная часть: {diagTotal(diagItems, L.p.diag.track)} вопросов; после верных ответов возможны уточнения. Можно прерваться: ответы сохраняются.</p>
      <article className="dq">{item.domain && <p className="eyebrow">{diagDomainLabel[item.domain]} · {item.mode === 'theory' ? 'Теория' : 'Практика'}</p>}<p className="skilltag">{skillById(item.skill)?.name}</p><h1>{item.q}</h1>
        {item.options ? (
          <fieldset><legend className="sr">Варианты ответа</legend>{item.options.map((o, i) => <label key={i} className={`opt ${sel === i ? 'sel' : ''}`}><input type="radio" name="dq" checked={sel === i} onChange={() => setSel(i)} /><span>{o.text}</span></label>)}</fieldset>
        ) : (
          <label className="field">Ваш расчёт<span className="inl"><input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /><span className="unit">{item.unit}</span></span></label>)}
        <div className="row">
          <button className="btn primary" disabled={item.options ? sel === null : !isFinite(parseNum(val))} onClick={() => go(() => { if (item.options) { const o = item.options[sel!]; answerDiag(item, o.result, o.note) } else { const v = parseNum(val); answerDiag(item, Math.abs(v - item.answer!) <= (item.tol ?? 0.05) * Math.abs(item.answer!) ? 'ok' : 'wrong', `${val} ${item.unit ?? ''}`.trim(), val) } })}>Ответить</button>
          <button className="btn ghost" onClick={() => go(() => answerDiag(item, 'unknown'))}>Не знаю</button>
          <button className="btn ghost" onClick={() => go(() => answerDiag(item, 'skip'))}>Пропустить</button>
          <span className="grow" /><button className="linkbtn" onClick={() => nav('/route')}>Прервать и вернуться позже</button>
        </div>
        <p className="small dim">Правильный ответ сейчас не показывается: задача диагностики — подобрать маршрут. Разбор вы получите в теме.</p>
      </article>
    </div>)
}
