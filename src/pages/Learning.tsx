import { tr } from '../../shared/locale'
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
    <span className={`lvl l${lvl}`} role="img" aria-label={`${tr("Уровень: ")}${LEVELS[lvl].name}${tr("; оценка: ")}${CONF[s?.confidence ?? 0]}`}>
      <span className="pips" aria-hidden>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= lvl ? 'on' : ''} />)}</span>
      {!compact && <b>{LEVELS[lvl].name}</b>}{!compact && lvl > 0 && <span className="conf">{CONF[s!.confidence]}</span>}
      {s?.gap && <span className="gapmark" title={tr("Есть затруднение")}>{tr("затруднение")}</span>}{s?.legacy && <span className="conf">{tr("пройдено ранее, не оценено")}</span>}
    </span>)
}

export function GoalPicker({ onDone }: { onDone?: () => void }) {
  const { p } = useLearning()
  const [ctx, setCtx] = useState(p.profile.context ?? '')
  return (
    <div className="goalpick">
      <fieldset><legend>{tr("Где вы сейчас работаете? ")}<span className="small">{tr("— только для подбора примеров, на оценку уровня не влияет")}</span></legend>
        <div className="seg">{curriculum.contexts.map((c) => <label key={c.id} className={ctx === c.id ? 'on' : ''}><input type="radio" name="ctx" checked={ctx === c.id} onChange={() => setCtx(c.id)} />{c.name}</label>)}</div></fieldset>
      <div className="goals" role="group" aria-label={tr("Профессиональная цель")}>
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
        <p className="eyebrow">{r.status === 'now' ? tr("Рекомендуем сейчас") : r.status === 'done' ? tr("Навык подтверждён") : tr("Дальше")} · {moduleOfTopic(t.id)?.module.name} · <span className={`lvtag lv${t.level}`}>{levelLabel[t.level]}</span></p>
        <h3><Link to={`/topics/${t.id}`}>{t.title}</Link></h3>
        <p className="why"><b>{tr("Почему:")}</b> {r.reason}</p>
        {main && sk && <p><b>{tr("Результат:")}</b>{tr(" вы сможете ")}{sk.outcome}.</p>}
        {main && <div className="row"><Link className="btn primary" to={`/topics/${t.id}`}>{tr("Открыть тему · ")}{t.minutes}{tr(" мин")}</Link>{lab && <Link className="btn ghost" to={`/labs/${lab.id}`}>{tr("Сразу к практике: ")}{lab.title}</Link>}</div>}
      </div>
    </article>)
}

export function RoutePage() {
  useTitle(tr("Мой маршрут"))
  const L = useLearning(), [pick, setPick] = useState(false)
  if (!L.goal || pick) return (
    <div className="page"><h1>{tr("Мой маршрут")}</h1><p className="lead">{tr("Выберите профессиональную цель — от неё зависит порядок тем. Цель можно сменить в любой момент; прогресс и уровни навыков при этом сохраняются.")}</p>
      <GoalPicker onDone={() => setPick(false)} />{L.goal && <p><button className="btn ghost" onClick={() => setPick(false)}>{tr("Отмена")}</button></p>}</div>)
  const now = L.route.find((r) => r.status === 'now')
  return (
    <div className="page route">
      <p className="eyebrow">{tr("Цель: ")}{L.goal.name} · <button className="linkbtn" onClick={() => setPick(true)}>{tr("сменить")}</button></p>
      <h1>{tr("Мой маршрут")}</h1>
      {!L.diagDone && <div className="notice">{L.diagAnswered ? `${tr("Диагностика пройдена частично (")}${L.diagAnswered}${tr(" ответов) — рекомендации предварительные.")}` : tr("Диагностика не пройдена — маршрут идёт по порядку цели, рекомендации предварительные.")} <Link className="btn small" to="/diagnostic">{L.diagAnswered ? tr("Продолжить диагностику") : tr("Выбрать вариант диагностики")}</Link></div>}
      {now ? <StepCard r={now} main /> : <div className="notice ok">{tr("Все навыки маршрута подтверждены действием. Загляните в ")}<Link to="/map">{tr("карту знаний")}</Link>{tr(" — там видно, что запланировано дальше.")}</div>}
      <h2>{tr("Дальше по маршруту")}</h2>
      <ol className="steps-list" start={2}>{L.route.filter((r) => r !== now).map((r) => <li key={r.topic} className={r.status}><StepCard r={r} /></li>)}</ol>
      <h2>{tr("Профиль навыков")}</h2>
      <p className="small">{tr("Уровень — что вы делаете сами; он считается по действиям, а не по открытым страницам. Рядом — насколько оценка подтверждена независимыми свидетельствами.")}</p>
      <div className="table-wrap" tabIndex={0}><table className="skills"><thead><tr><th>{tr("Навык")}</th><th>{tr("Уровень и уверенность оценки")}</th><th>{tr("На чём основано")}</th></tr></thead>
        <tbody>{skills.map((sk) => { const s = L.states[sk.id]; return (
          <tr key={sk.id}><th scope="row">{sk.name}</th><td><LevelBar s={s} /></td>
            <td className="small">{s.evidence.length ? s.evidence.slice(0, 3).map((e) => `${e.label}${e.kind === 'lab' && e.hints ? `${tr(" (с подсказками: ")}${e.hints})` : ''}`).join('; ') : s.legacy ? tr("занятие пройдено до появления профиля навыков") : tr("действий пока не было")}</td></tr>) })}</tbody></table></div>
      <details className="scale"><summary>{tr("Шкала освоения")}</summary><ol start={0}>{LEVELS.map((l) => <li key={l.n}><b>{l.name}.</b> {l.text}</li>)}</ol>
        <p className="small">{tr("Уверенность: «предварительно» — одно свидетельство, «подтверждено» — два независимых, «уверенно» — три и более. Повтор одной и той же попытки не добавляет уверенности.")}</p></details>
      <div className="row"><Link className="btn ghost" to="/diagnostic">{L.diagDone ? tr("Пройти диагностику заново") : tr("Диагностика")}</Link><Link className="btn ghost" to="/map">{tr("Карта знаний")}</Link></div>
    </div>)
}

export function MapPage() {
  useTitle(tr("Карта знаний"))
  const L = useLearning()
  return (
    <div className="page map">
      <h1>{tr("Карта знаний")}</h1>
      <p className="lead">{tr("Раздел → модуль → тема. Внутри модуля темы идут от простого к сложному. Открыть можно любую тему в любом порядке; «после» показывает предпосылку.")}</p>
      <p className="legend-levels">{[1, 2, 3].map((n) => <span key={n}><span className={`lvtag lv${n}`}>{levelLabel[n]}</span> {levelHint[n]}</span>)}</p>
      {curriculum.sections.map((sec) => (
        <section key={sec.id} className={`mapsec c-${sec.color}`}>
          <header><span className={`swatch ${sec.color}`} aria-hidden /><div><h2>{sec.name}</h2><p>{sec.text}</p></div></header>
          <div className="modules">{sec.modules.map((m) => (
            <div key={m.id} className="module"><h3>{m.name}</h3>
              <ul>{[...m.topics.map((t) => ({ ...t, shared: false })), ...(m.also ?? []).map((id) => ({ id, prereq: [] as string[], shared: true }))].sort((a, b) => (topicById(a.id)?.level ?? 2) - (topicById(b.id)?.level ?? 2)).map((ref) => { const t = topicById(ref.id); if (!t) return null; const sk = skillOfTopic(t.id), s = sk ? L.states[sk.id] : undefined, r = L.route.find((x) => x.topic === t.id); return (
                <li key={ref.id} className={`mtopic ${r?.status ?? ''}`}><Link to={`/topics/${t.id}`}><b>{t.title}</b></Link>
                  <span className="mmeta"><span className={`lvtag lv${t.level}`} title={levelHint[t.level]}>{levelLabel[t.level]}</span>{ref.shared && <span className="tag">{tr("общая с модулем «")}{moduleOfTopic(t.id)?.module.name}»</span>}{r?.status === 'now' && <span className="tag now">{tr("рекомендуем сейчас")}</span>}{L.p.visited[t.id] ? <span className="tag">{tr("открывалась")}</span> : null}<LevelBar s={s} compact /> {t.labs.length ? `${tr("практика: ")}${t.labs.length}` : ''}</span>
                  {!!ref.prereq?.length && <span className="small prereq">{tr("после: ")}{ref.prereq.map((x) => topicById(x)?.title).join('; ')}</span>}</li>) })}
                {(m.planned ?? []).map((x) => <li key={x} className="mtopic planned"><b>{x}</b><span className="mmeta"><span className="tag">{tr("в плане, ещё не опубликована")}</span></span></li>)}</ul></div>))}</div>
        </section>))}
      <p className="small">{tr("Обозначения: точки — уровень навыка по шкале из четырёх ступеней (см. «Мой маршрут»); «открывалась» — прохождение, а не владение.")}</p>
    </div>)
}

export function DiagnosticPage() {
  useTitle(tr("Диагностика"))
  const L = useLearning(), nav = useNavigate()
  const [val, setVal] = useState(''), [sel, setSel] = useState<number | null>(null)
  const [choosing, setChoosing] = useState(false)
  if (!L.goal) return <div className="page"><h1>{tr("Диагностика")}</h1><p className="lead">{tr("Сначала выберите цель — от неё зависит, с каких заданий начать.")}</p><GoalPicker /></div>
  const track = diagTracks.find((t) => t.id === L.p.diag.track)
  const legacy = !track && Object.keys(L.p.diag.answers).length > 0
  if (choosing || (!track && !legacy)) return (
    <div className="page diag-start"><p className="eyebrow">{tr("Входная диагностика")}</p><h1>{tr("Выберите вариант под вашу подготовку")}</h1>
      <p className="lead">{tr("Вариант задаёт начальную сложность и примеры, а не присваивает уровень навыка. Во всех вариантах есть теория и практика. Можно ответить «Не знаю», пропустить вопрос или вернуться позже.")}</p>
      <div className="goals" role="group" aria-label={tr("Вариант диагностики")}>{diagTracks.map((t) => {
        const bank = diagItemsForTrack(diagItems, t.id).filter((i) => !i.after)
        return <button className="goal" key={t.id} onClick={() => { restartDiag(t.id); setChoosing(false); setVal(''); setSel(null) }}>
          <b>{t.name}</b><span>{t.description}</span><span className="small num">{bank.length}{tr(" основных вопросов · теория: ")}{bank.filter((i) => i.mode === 'theory').length}{tr(" · практика: ")}{bank.filter((i) => i.mode === 'practice').length}{tr(" · ориентир ")}{t.time}</span>
        </button>
      })}</div>
      <p className="small">{tr("Это короткий срез подготовки, а не экзамен или аттестация. Неохваченные навыки уточняются в темах и занятиях; результаты разных вариантов не предназначены для рейтинга людей.")}</p>
      {choosing && <button className="btn ghost" onClick={() => setChoosing(false)}>{tr("Вернуться к текущей диагностике")}</button>}
      <p><Link to="/route">{tr("Пропустить диагностику — открыть предварительный маршрут")}</Link></p>
    </div>)
  const item = L.nextItem
  const n = L.diagAnswered
  const bank = diagItemsForTrack(diagItems, L.p.diag.track)
  const change = <ConfirmButton label={tr("Выбрать другой вариант")} ask={tr("При выборе нового варианта ответы диагностики будут сброшены. Занятия, закладки и остальные результаты сохранятся. Продолжить?")} onConfirm={() => setChoosing(true)} />
  const go = (fn: () => void) => { fn(); setVal(''); setSel(null) }
  if (!item) {
    const ans = L.p.diag.answers
    return (
      <div className="page diag">
        <p className="eyebrow">{tr("Диагностика завершена")}</p><h1>{tr("Что показали ваши ответы")}</h1>
        <p className="lead">{track?.name ?? tr("Прежний вариант диагностики")}{tr(". Результат предварительный: это основание для выбора тем, а не подтверждение профессиональной квалификации.")}</p>
        {track && <div className="diag-domains">{Object.entries(diagDomainLabel).map(([id, label]) => {
          const xs = bank.filter((i) => i.domain === id && ans[i.id]), tested = xs.filter((i) => !['skip', 'unknown'].includes(ans[i.id].result))
          return <section className="panel" key={id}><h2>{label}</h2><p>{tested.length ? `${tr("Верно ")}${tested.filter((i) => ans[i.id].result === 'ok').length}${tr(" из ")}${tested.length}${tr(" ответов")}` : tr("Пока нет данных для оценки")}</p><p className="small">{tr("Не знаю: ")}{xs.filter((i) => ans[i.id].result === 'unknown').length}{tr(" · пропущено: ")}{xs.filter((i) => ans[i.id].result === 'skip').length}</p></section>
        })}</div>}
        <div className="table-wrap" tabIndex={0}><table><thead><tr><th>{tr("Задание")}</th><th>{tr("Навык")}</th><th>{tr("Ваш ответ")}</th><th>{tr("Что это значит")}</th></tr></thead>
          <tbody>{bank.filter((i) => ans[i.id]).map((i) => { const a = ans[i.id]; return (
            <tr key={i.id}><td>{i.short}</td><td className="small">{skillById(i.skill)?.name}</td><td>{a.result === 'skip' ? tr("пропущено") : a.result === 'unknown' ? tr("не знаю") : a.note ?? a.value}</td>
              <td><span className={`verdict ${a.result === 'ok' ? 'ok' : a.result === 'partial' ? 'weak' : a.result === 'skip' ? 'weak' : 'wrong'}`}>{{ ok: i.kind === 'recognize' ? tr("распознаёте") : tr("решаете"), partial: tr("частично обосновано"), wrong: tr("затруднение"), unknown: tr("затруднение — честный ответ"), skip: tr("нет данных") }[a.result]}</span>{(i.topic ?? skillById(i.skill)?.topics[0]) && <p><Link to={`/topics/${i.topic ?? skillById(i.skill)!.topics[0]}`}>{tr("Разобрать теорию →")}</Link></p>}</td></tr>) })}</tbody></table></div>
        <p className="small">{tr("Диагностика даёт не больше уровня «выполняет с опорой»: самостоятельность и перенос подтверждаются только занятиями. Пропущенные задания не считаются ошибкой — по ним просто нет данных.")}</p>
        {L.next && <><h2>{tr("С чего начать")}</h2><StepCard r={L.next} main /></>}
        <div className="row"><Link className="btn" to="/route">{tr("Весь маршрут и профиль навыков")}</Link><ConfirmButton label={tr("Пройти заново")} ask={tr("Сбросить ответы этой диагностики и начать заново? Остальной прогресс сохранится.")} onConfirm={() => go(() => restartDiag(L.p.diag.track))} />{change}</div>
      </div>)
  }
  const total = L.diagTotal
  return (
    <div className="page diag">
      <p className="eyebrow">{tr("Диагностика · цель: ")}{L.goal.name}</p>
      <p><b>{track?.name ?? tr("Ранее начатая диагностика")}</b> · {change}</p>
      {legacy && <p className="notice">{tr("Ваши прежние ответы сохранены. Можно завершить этот вариант или выбрать новый, подходящий по подготовке.")}</p>}
      <div className="dprog" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(n, total)} aria-label={tr("Ход диагностики")}><span style={{ width: `${Math.min(100, (n / total) * 100)}%` }} /></div>
      <p className="small">{item.after ? tr("Уточняющее задание — оно появилось после ответа на основной вопрос.") : `${tr("Задание ")}${n + 1}${tr(" из ")}${total}.`}{tr(" Основная часть: ")}{diagTotal(diagItems, L.p.diag.track)}{tr(" вопросов; после верных ответов возможны уточнения. Можно прерваться: ответы сохраняются.")}</p>
      <article className="dq">{item.domain && <p className="eyebrow">{diagDomainLabel[item.domain]} · {item.mode === 'theory' ? tr("Теория") : tr("Практика")}</p>}<p className="skilltag">{skillById(item.skill)?.name}</p><h1>{item.q}</h1>
        {item.options ? (
          <fieldset><legend className="sr">{tr("Варианты ответа")}</legend>{item.options.map((o, i) => <label key={i} className={`opt ${sel === i ? 'sel' : ''}`}><input type="radio" name="dq" checked={sel === i} onChange={() => setSel(i)} /><span>{o.text}</span></label>)}</fieldset>
        ) : (
          <label className="field">{tr("Ваш расчёт")}<span className="inl"><input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /><span className="unit">{item.unit}</span></span></label>)}
        <div className="row">
          <button className="btn primary" disabled={item.options ? sel === null : !isFinite(parseNum(val))} onClick={() => go(() => { if (item.options) { const o = item.options[sel!]; answerDiag(item, o.result, o.note) } else { const v = parseNum(val); answerDiag(item, Math.abs(v - item.answer!) <= (item.tol ?? 0.05) * Math.abs(item.answer!) ? 'ok' : 'wrong', `${val} ${item.unit ?? ''}`.trim(), val) } })}>{tr("Ответить")}</button>
          <button className="btn ghost" onClick={() => go(() => answerDiag(item, 'unknown'))}>{tr("Не знаю")}</button>
          <button className="btn ghost" onClick={() => go(() => answerDiag(item, 'skip'))}>{tr("Пропустить")}</button>
          <span className="grow" /><button className="linkbtn" onClick={() => nav('/route')}>{tr("Прервать и вернуться позже")}</button>
        </div>
        <p className="small dim">{tr("Правильный ответ сейчас не показывается: задача диагностики — подобрать маршрут. Разбор вы получите в теме.")}</p>
      </article>
    </div>)
}
