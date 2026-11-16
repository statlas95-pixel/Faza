import { LabMeta } from '../content'
import { benchRun, BenchModel, BenchResult } from '../models/physics'
import { Chart, Slider, fmt, VerdictTag, Quiz, Question, isCorrect, range } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

interface Cfg { oil: string; process: string; c: number; phi: number }
interface Run { cfg: Cfg; pred?: string; res: BenchResult }
interface S { phase: 'brief' | 'bench' | 'explain' | 'debrief'; cfg: Cfg; pred?: string; runs: Run[]; chosen?: number; months: number; answers: Record<number, any>; transfer: Record<number, any>; finished?: boolean }
const COLORS = ['#E4572E', '#0E7C7B', '#6B4FC8', '#B8860B', '#C2417A', '#2F6FB0', '#3E8E41', '#7A5230']
const DASH = [undefined, '7 4', '2 4', '10 3 2 3', '5 5', '12 4', '3 3', '8 2 2 2']
const days = (d: number) => d < 60 ? `${fmt(d, 2)} сут` : d < 3650 ? `${fmt(d / 30.4, 2)} мес` : `${fmt(d / 365, 2)} лет`

export default function StabilityBench({ lab }: { lab: LabMeta }) {
  const m = lab.model as BenchModel & { oils: any[]; processes: any[]; start: Cfg; maxRuns: number }
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', cfg: { ...m.start }, runs: [], months: 24, answers: {}, transfer: {} }))
  const oil = (id: string) => m.oils.find((o) => o.id === id), proc = (id: string) => m.processes.find((p) => p.id === id)
  const calc = (c: Cfg) => benchRun(m, { dRho: 1000 - oil(c.oil).rho, d_um: proc(c.process).d, c: c.c, phi: c.phi / 100 })
  const steps = ['Вводная', 'Стенд', 'Объяснение', 'Разбор']
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={steps} step={{ brief: 0, bench: 1, explain: 2, debrief: 3 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  const predOf = (d: number) => (lab.predictions as any[]).find((p) => d <= p.max).id
  const qs = lab.questions as Question[]

  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={s.runs.length > 0} onStart={() => set((x) => { x.phase = 'bench' })} />)

  const runsTable = (pick: boolean) => (
    <div className="table-wrap" tabIndex={0}>
      <table className="runs">
        <caption>Журнал прогонов. Расчёт по учебной модели; условия: столб 50 мм, видимый слой 1 мм, 25 °C.</caption>
        <thead><tr>{pick && <th>Выбор</th>}<th>№</th><th>Масло (Δρ, кг/м³)</th><th>d, мкм</th><th>Ксантан, %</th><th>φ, %</th><th>η при малом сдвиге, Па·с</th><th>η при 1000 с⁻¹, мПа·с</th><th>До слоя 1 мм</th><th>Центрифуга {m.rcf} g, {m.centrifuge_min} мин: слой, мм</th><th>Ваш прогноз</th></tr></thead>
        <tbody>{s.runs.map((r, i) => (
          <tr key={i} className={s.chosen === i ? 'chosen' : ''}>
            {pick && <td><input type="radio" name="chosen" aria-label={`Выбрать прототип ${i + 1}`} checked={s.chosen === i} onChange={() => set((x) => { x.chosen = i })} /></td>}
            <td className="num"><span className="swdot" style={{ background: COLORS[i] }} aria-hidden />{i + 1}</td>
            <td>{oil(r.cfg.oil).name} <span className="num">({1000 - oil(r.cfg.oil).rho})</span></td>
            <td className="num">{fmt(proc(r.cfg.process).d)}</td><td className="num">{fmt(r.cfg.c, 2)}</td><td className="num">{r.cfg.phi}</td>
            <td className="num">{fmt(r.res.eta0, 2)}</td>
            <td className="num">{fmt(r.res.eta1000_mPas, 3)} <VerdictTag v={r.res.sprayOk ? 'ok' : 'wrong'} label={r.res.sprayOk ? 'распыляется' : 'не распыляется'} /></td>
            <td className="num">{days(r.res.days)} <VerdictTag v={r.res.stableOk ? 'ok' : 'wrong'} label={r.res.stableOk ? '≥ 24 мес' : '< 24 мес'} /></td>
            <td className="num">{fmt(r.res.centrifuge_mm, 2)} <span className="dim">(линейный пересчёт: {fmt(r.res.centrifuge_naive_mm, 2)})</span></td>
            <td>{r.pred ? <>{(lab.predictions as any[]).find((p) => p.id === r.pred).text} <VerdictTag v={predOf(r.res.days) === r.pred ? 'ok' : 'weak'} label={predOf(r.res.days) === r.pred ? 'совпал' : 'не совпал'} /></> : <span className="dim">—</span>}</td>
          </tr>))}</tbody>
      </table>
    </div>)
  const chart = (
    <Chart title="Рост обеднённого слоя во времени" desc="Высота прозрачного слоя в миллиметрах от времени хранения в месяцах для каждого прогона."
      xDomain={[0, 24]} yDomain={[0, 5]} xLabel="Время хранения, мес (25 °C, 1 g)" yLabel="Обеднённый слой, мм" cursor={s.months}
      hlines={[{ y: m.visible_mm, label: 'порог видимости 1 мм' }]}
      series={s.runs.map((r, i) => ({ name: `№${i + 1}`, color: COLORS[i], dash: DASH[i], points: range(0, 24, 25).map((t) => [t, Math.min(r.res.v_mm_day * t * 30.4, m.column_mm * (1 - r.cfg.phi / 100))] as [number, number]) }))} />)

  if (s.phase === 'bench') {
    const full = s.runs.length >= m.maxRuns
    return frame(
      <div className="bench">
        <section className="bench-ctl panel">
          <h3>Прототип №{s.runs.length + 1}</h3>
          <fieldset><legend>Масляная фаза</legend>
            {m.oils.map((o) => <label key={o.id} className={`choice sm ${s.cfg.oil === o.id ? 'on' : ''}`}><input type="radio" name="oil" checked={s.cfg.oil === o.id} onChange={() => set((x) => { x.cfg.oil = o.id })} /><span>{o.name}<small>ρ = {o.rho} кг/м³ · {o.note}</small></span></label>)}</fieldset>
          <fieldset><legend>Способ гомогенизации</legend>
            {m.processes.map((p) => <label key={p.id} className={`choice sm ${s.cfg.process === p.id ? 'on' : ''}`}><input type="radio" name="proc" checked={s.cfg.process === p.id} onChange={() => set((x) => { x.cfg.process = p.id })} /><span>{p.name}<small>средний диаметр {p.note}</small></span></label>)}</fieldset>
          <Slider label="Ксантановая камедь" value={s.cfg.c} min={0} max={0.5} step={0.05} onChange={(v) => set((x) => { x.cfg.c = v })} show={`${fmt(s.cfg.c, 2)} %`} />
          <Slider label="Доля масляной фазы (в задании — 15 %)" value={s.cfg.phi} min={10} max={25} step={1} onChange={(v) => set((x) => { x.cfg.phi = v })} show={`${s.cfg.phi} %`} />
          <fieldset><legend>Ваш прогноз: когда появится слой 1 мм?</legend>
            <div className="seg">{(lab.predictions as any[]).map((p) => <label key={p.id} className={s.pred === p.id ? 'on' : ''}><input type="radio" name="pred" checked={s.pred === p.id} onChange={() => set((x) => { x.pred = p.id })} />{p.text}</label>)}</div></fieldset>
          <button className="btn primary wide" disabled={full} onClick={() => set((x) => { x.runs.push({ cfg: { ...x.cfg }, pred: x.pred, res: calc(x.cfg) }); x.pred = undefined })}>
            {full ? 'Лимит прогонов исчерпан' : `Поставить на хранение (осталось ${m.maxRuns - s.runs.length})`}</button>
        </section>
        <section className="bench-out">
          {s.runs.length === 0 ? <div className="empty"><p>Здесь появятся флаконы и график. Начните с исходного прототипа — он уже настроен слева — и посмотрите, насколько он далёк от цели.</p></div> : <>
            <div className="vials" role="img" aria-label={`Вид флаконов через ${s.months} месяцев`}>
              {s.runs.map((r, i) => {
                const layer = Math.min(r.res.v_mm_day * s.months * 30.4, m.column_mm * (1 - r.cfg.phi / 100))
                return (
                  <figure key={i}><svg viewBox="0 0 44 120"><rect x="6" y="2" width="32" height="10" rx="2" fill="#3a2d52" /><rect x="3" y="12" width="38" height="104" rx="7" fill="#fbf7ef" stroke="#cfc3dd" strokeWidth="1.5" />
                    <rect x="4.5" y={114.5 - (layer / m.column_mm) * 100} width="35" height={(layer / m.column_mm) * 100} rx="2" fill="#bfe3ea" opacity=".95" /></svg>
                    <figcaption className="num"><span className="swdot" style={{ background: COLORS[i] }} />№{i + 1}<br />{fmt(layer, 2)} мм</figcaption></figure>)
              })}
            </div>
            <Slider label="Время хранения" value={s.months} min={0} max={24} step={1} onChange={(v) => set((x) => { x.months = v })} show={`${s.months} мес`} />
            {chart}{runsTable(true)}
            <div className="row end">
              <span className="small">{s.chosen === undefined ? 'Отметьте в таблице прототип, который отправите заказчику.' : `Выбран прототип №${s.chosen + 1}.`}</span>
              <button className="btn primary" disabled={s.chosen === undefined} onClick={() => set((x) => { x.phase = 'explain' })}>Объяснить выбор →</button>
            </div></>}
        </section>
      </div>)
  }
  if (s.phase === 'explain') {
    const all = qs.every((_, i) => s.answers[i] !== undefined)
    return frame(
      <div className="conclude">
        <div className="conclude-head"><h1>Почему сработало именно это?</h1><button className="btn ghost" onClick={() => set((x) => { x.phase = 'bench' })}>← Вернуться к стенду</button></div>
        <p>Вы выбрали прототип №{s.chosen! + 1}. Прежде чем отдавать его заказчику, объясните результаты стенда. Журнал прогонов — ниже.</p>
        <Quiz questions={qs} answers={s.answers} onAnswer={(i, v) => set((x) => { x.answers[i] = v })} />
        {runsTable(false)}
        <button className="btn primary" disabled={!all} onClick={() => {
          set((x) => { x.phase = 'debrief'; x.finished = true })
          const r = s.runs[s.chosen!].res
          markFinished(lab.id, `${r.stableOk && r.sprayOk ? 'цель достигнута' : 'цель не достигнута'} за ${s.runs.length} прогонов`); window.scrollTo(0, 0)
        }}>К разбору</button>
      </div>)
  }
  // ---------- Разбор ----------
  const ch = s.runs[s.chosen!], ok = ch.res.stableOk && ch.res.sprayOk
  const fields: [keyof Cfg, string][] = [['oil', 'масло'], ['process', 'способ гомогенизации'], ['c', 'концентрация ксантана'], ['phi', 'доля масла']]
  const pairs: { i: number; j: number; what: string; k: number }[] = []
  for (let i = 0; i < s.runs.length; i++) for (let j = i + 1; j < s.runs.length; j++) {
    const diff = fields.filter(([f]) => s.runs[i].cfg[f] !== s.runs[j].cfg[f])
    if (diff.length === 1) pairs.push({ i, j, what: diff[0][1], k: s.runs[j].res.days / s.runs[i].res.days })
  }
  const preds = s.runs.filter((r) => r.pred), hits = preds.filter((r) => predOf(r.res.days) === r.pred).length
  const right = qs.filter((q, i) => isCorrect(q, s.answers[i])).length
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Разбор решения</p><h1>{lab.title}</h1>
        <p className="lead">Прототип №{s.chosen! + 1}: до видимого слоя {days(ch.res.days)}, вязкость при 1000 с⁻¹ {fmt(ch.res.eta1000_mPas, 3)} мПа·с. <VerdictTag v={ok ? 'ok' : 'wrong'} label={ok ? 'Оба требования выполнены' : 'Требования не выполнены'} /></p></header>
      <section className="panel"><h3>Ваш прототип</h3>
        {!ch.res.stableOk && <article className="drow wrong"><p>Слой появится раньше 24 месяцев. Этот прототип нельзя отдавать заказчику — вернитесь к стенду, если остались прогоны, или начните заново.</p></article>}
        {!ch.res.sprayOk && <article className="drow wrong"><p>Вязкость при 1000 с⁻¹ выше 14 мПа·с — триггер не распылит продукт. Стабильность достигнута ценой функции упаковки.</p></article>}
        {ch.cfg.phi !== 15 && <article className="drow weak"><p>Вы изменили долю масляной фазы ({ch.cfg.phi} % вместо 15 %). Это отступление от задания заказчика, его нужно согласовать; на скорость разделения доля влияет слабо (только через стеснённость движения).</p></article>}
        {ch.cfg.process === 'hph' && <article className="drow weak"><p>Капли 0,5 мкм решают задачу гравитационного разделения с большим запасом. Но модель не учитывает оствальдово созревание, а оно для мелких капель и масел, заметно растворимых в воде, становится главным риском; кроме того, требуется оборудование, которого может не быть на площадке производителя.</p></article>}
        {ch.cfg.oil !== m.start.oil && <article className="drow weak"><p>Вы заменили масло заказчика на «{oil(ch.cfg.oil).name}». Разность плотностей — законный рычаг, но замена меняет сенсорику и состав на этикетке: решение принимает заказчик.</p></article>}
        {ok && ch.cfg.oil === m.start.oil && ch.cfg.process !== 'hph' && ch.cfg.phi === 15 && <article className="drow ok"><p>Задача решена в рамках исходного состава и доступного оборудования: сочетанием более мелких капель и структурирующего загустителя на границе распыляемости. Запаса по вязкости почти нет — это стоит отметить в отчёте как риск при колебаниях сырья.</p></article>}
        <p className="small">Центрифуга для этого прототипа: {fmt(ch.res.centrifuge_mm, 2)} мм за {m.centrifuge_min} мин при {m.rcf} g; линейный пересчёт от 1 g дал бы {fmt(ch.res.centrifuge_naive_mm, 2)} мм.</p>
      </section>
      <section className="panel"><h3>Как вы исследовали</h3>
        <ul className="facts">
          <li>Прогонов: <b className="num">{s.runs.length} из {m.maxRuns}</b>.</li>
          <li>Пар прогонов, различающихся ровно одним фактором: <b className="num">{pairs.length}</b>. {pairs.length === 0 ? 'Без таких пар нельзя сказать, какой фактор дал эффект, — изменения смешаны.' : 'Только такие пары позволяют приписать эффект конкретному фактору:'}</li>
        </ul>
        {pairs.length > 0 && <ul>{pairs.slice(0, 8).map((p, i) => <li key={i} className="num">№{p.i + 1} → №{p.j + 1}: изменён только фактор «{p.what}»; время до слоя изменилось в {fmt(p.k, 3)} раза</li>)}</ul>}
        <p>Прогнозы: совпало <b className="num">{hits} из {preds.length}</b>{preds.length < s.runs.length && ` (в ${s.runs.length - preds.length} прогонах прогноз не записан)`}. Расхождение прогноза с расчётом — самое полезное место для возврата к теории.</p>
        {chart}{runsTable(false)}
      </section>
      <section className="panel"><h3>Ваши объяснения: {right} из {qs.length}</h3>
        <Quiz questions={qs} answers={s.answers} onAnswer={(i, v) => set((x) => { x.answers[i] = v })} /></section>
      <section className="panel story"><h3>Границы этого вывода</h3>
        <p>{lab.dataNote} Таблица вязкости растворов ксантана — учебная. Результат стенда — ранжирование рычагов и кандидаты на реальное хранение, а не срок годности.</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end">
        {s.runs.length < m.maxRuns && <button className="btn" onClick={() => set((x) => { x.phase = 'bench' })}>Вернуться к стенду (осталось прогонов: {m.maxRuns - s.runs.length})</button>}
        <button className="btn ghost" onClick={reset}>Новая попытка с нуля</button>
      </div>
    </div>)
}
