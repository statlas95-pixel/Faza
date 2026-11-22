import { tr } from '../../shared/locale'
import { useState } from 'react'
import { LabMeta } from '../content'
import { DoeModel, DoeRun, doeMeasure, doeTrue, doeCells, doeMainEffect, doeInteraction, Effect, tCrit, doeConclusion } from '../models/physics'
import { fmt, parseNum, VerdictTag, Verdict } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

interface S { phase: 'brief' | 'work' | 'conclude' | 'debrief'; seed: number; plan: Record<string, number>; runs: DoeRun[]; rounds: number; ans: Record<string, string>; pred: string; level?: string; transfer: Record<number, any>; finished?: boolean }
const COMBOS = [-1, 1].flatMap((C) => [-1, 1].flatMap((B) => [-1, 1].map((A) => ({ A, B, C }))))
const key = (c: { A: number; B: number; C: number }) => `${c.A},${c.B},${c.C}`
const sign = (v: number) => (v > 0 ? '+' : '−')
const OPT = { yes: tr("Влияет"), no: tr("Не отличим от шума"), unknown: tr("По моим данным сказать нельзя") }
const OPT_AB = { yes: tr("Есть"), no: tr("Не отличимо от шума"), unknown: tr("По моим данным оценить нельзя") }

export default function DoePlan({ lab }: { lab: LabMeta }) {
  const m = lab.model as DoeModel, F = lab.factors as any[], T = lab.target
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', seed: Math.floor(Math.random() * 9000) + 1, plan: {}, runs: [], rounds: 0, ans: {}, pred: '', transfer: {} }))
  const [warn, setWarn] = useState('')
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={[tr("Вводная"), tr("Опыты"), tr("Выводы"), tr("Разбор")]} step={{ brief: 0, work: 1, conclude: 2, debrief: 3 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={s.runs.length > 0} onStart={() => set((x) => { x.phase = 'work' })} />)
  const planned = Object.values(s.plan).reduce((a, b) => a + b, 0), left = lab.budget - s.runs.length
  const eff = { A: doeMainEffect(s.runs, 'A'), B: doeMainEffect(s.runs, 'B'), C: doeMainEffect(s.runs, 'C'), AB: doeInteraction(s.runs) } as Record<string, Effect>
  const cells = doeCells(s.runs), tc = tCrit(cells.df)
  const lvl = (f: any, v: number) => (v > 0 ? f.high : f.low)
  const effRow = (name: string, e: Effect) => (
    <tr key={name}><th scope="row">{name}</th>
      <td className="num">{e.estimable ? `${e.value! > 0 ? '+' : ''}${fmt(e.value!, 3)}` : '—'}</td>
      <td className="num">{e.estimable ? (e.se !== undefined ? `± ${fmt(tc * e.se, 2)}` : tr("нет оценки шума")) : '—'}</td>
      <td className="small">{e.estimable ? `${tr("по ")}${e.pairs} ${name.includes('×') ? tr("набору из четырёх сочетаний") : tr("парам сочетаний, различающихся только этим фактором")}` : name.includes('×') ? tr("не оценивается: нужны все четыре сочетания уровней A и B при одном уровне C") : tr("не оценивается: нет пары опытов, различающихся только этим фактором")}</td></tr>)
  const effects = (
    <div className="table-wrap" tabIndex={0}><table>
      <caption>{tr("Эффекты, рассчитанные по вашим опытам, ")}{lab.unit}{tr(". Указана полуширина 95 %-го интервала по повторам. При неполном плане контраст относится к измеренным сочетаниям")}{cells.sd !== undefined ? `${tr(" (оценка разброса s = ")}${fmt(cells.sd, 2)} ${lab.unit}${tr(", степеней свободы ")}${cells.df})` : tr(" — повторов пока нет")}.</caption>
      <thead><tr><th>{tr("Эффект")}</th><th>{tr("Оценка (верхний − нижний)")}</th><th>{tr("Интервал")}</th><th>{tr("На чём основана")}</th></tr></thead>
      <tbody>{F.map((f) => effRow(`${f.id}: ${f.name}`, eff[f.id]))}{effRow(tr("A × B: взаимодействие"), eff.AB)}</tbody></table></div>)
  const runsTable = (
    <div className="table-wrap" tabIndex={0}><table>
      <caption>{tr("Журнал варок. Вязкость — синтетические данные, ")}{lab.unit}{tr("; измерение через 24 ч при 25 °C.")}</caption>
      <thead><tr><th>№</th>{F.map((f) => <th key={f.id}>{f.id}: {f.name}</th>)}<th>{tr("Вязкость, ")}{lab.unit}</th></tr></thead>
      <tbody>{s.runs.map((r, i) => <tr key={i}><td className="num">{i + 1}</td>{F.map((f) => <td key={f.id} className="num">{sign((r as any)[f.id])} {lvl(f, (r as any)[f.id])}</td>)}<td className="num"><b>{fmt(r.y, 3)}</b></td></tr>)}</tbody></table></div>)

  if (s.phase === 'work') return frame(
    <div className="scale">
      <section className="panel">
        <h3>{tr("План захода ")}<span className="budget num">{tr("осталось варок: ")}{left}{planned > 0 && `${tr(" · в плане ")}${planned}`}</span></h3>
        <p className="small">{tr("Выберите, какие сочетания уровней варить и сколько раз.")}</p>
        <ul className="small legend">{F.map((f) => <li key={f.id}><b>{f.id}</b> — {f.name}: «−» {f.low}, «+» {f.high}</li>)}</ul>
        <div className="table-wrap" tabIndex={0}><table className="plan">
          <thead><tr>{F.map((f) => <th key={f.id}>{f.id}</th>)}<th>{tr("Сварено")}</th><th>{tr("Сварить ещё")}</th></tr></thead>
          <tbody>{COMBOS.map((c) => {
            const k = key(c), n = s.plan[k] ?? 0, done = cells.cells.get(k)?.length ?? 0
            return (
              <tr key={k}>{F.map((f) => <td key={f.id} className="num" title={lvl(f, (c as any)[f.id])}>{sign((c as any)[f.id])}</td>)}
                <td className="num">{done || '—'}</td>
                <td><span className="stepper-n"><button className="btn small ghost" aria-label={tr("Меньше")} disabled={n === 0} onClick={() => set((x) => { x.plan[k] = n - 1 })}>−</button><output className="num" aria-live="polite">{n}</output>
                  <button className="btn small ghost" aria-label={tr("Больше")} disabled={planned >= left} onClick={() => set((x) => { x.plan[k] = n + 1 })}>+</button></span></td></tr>)
          })}</tbody></table></div>
        <button className="btn primary wide" disabled={planned === 0} onClick={() => set((x) => {
          for (const c of COMBOS) for (let i = 0; i < (x.plan[key(c)] ?? 0); i++) x.runs.push({ ...c, y: doeMeasure(m, c.A, c.B, c.C, x.seed + x.runs.length * 7.31) })
          x.plan = {}; x.rounds++
        })}>{planned === 0 ? (left === 0 ? tr("Бюджет исчерпан") : tr("Добавьте опыты в план")) : `${tr("Сварить ")}${planned}${tr(" и измерить")}`}</button>
        <p className="small dim">{tr("Порядок варок внутри захода считается рандомизированным.")}</p>
      </section>
      <div>
        {s.runs.length === 0 ? <div className="empty"><p>{tr("Результаты появятся здесь. Прежде чем тратить бюджет, решите: какие сочетания нужны, чтобы ответить на вопрос «сколько загустителя нужно при 2 % актива», и чем вы отличите эффект от разброса.")}</p></div>
          : <>{runsTable}<h4>{tr("Что можно вычислить из этих данных")}</h4>{effects}</>}
        <div className="row end"><span className="small">{tr("Цель: ")}{T.min}–{T.max} {lab.unit}{tr(" при 2 % актива.")}</span>
          <button className="btn primary" disabled={s.runs.length === 0} onClick={() => set((x) => { x.phase = 'conclude' })}>{tr("Перейти к выводам →")}</button></div>
      </div>
    </div>)

  if (s.phase === 'conclude') {
    const submit = () => {
      const miss = [...F.map((f) => f.id), 'AB'].filter((k) => !s.ans[k]).length
      if (miss || !s.level || !isFinite(parseNum(s.pred))) { setWarn(tr("Заполните все выводы, выбор уровня загустителя и прогноз вязкости.")); return }
      set((x) => { x.phase = 'debrief'; x.finished = true }); window.scrollTo(0, 0)
      const conclusions = Object.entries(eff).filter(([key, effect]) => s.ans[key] === doeConclusion(effect, cells.df)).length
      const predictionError = Math.abs(parseNum(s.pred) - doeTrue(m, 1, 1, -1))
      const predictionCredit = predictionError <= 2 * m.sigma ? 0.25 : predictionError <= 4 * m.sigma ? 0.12 : 0
      const planCredit = (eff.AB.estimable ? 0.15 : 0) + (cells.df >= 1 ? 0.1 : 0)
      const score = (s.level === 'high' ? 0.25 : 0) + predictionCredit + planCredit + 0.25 * conclusions / Object.keys(eff).length
      markFinished(lab.id, `${tr("варок ")}${s.runs.length}${tr("; уровень загустителя ")}${s.level === 'high' ? '0,5 %' : s.level === 'low' ? '0,3 %' : tr("не выбран")}${tr("; прогноз ")}${s.pred} ${lab.unit}`, { runs: s.runs, answers: s.ans, pred: s.pred, level: s.level }, score)
    }
    return frame(
      <div className="conclude">
        <div className="conclude-head"><h1>{tr("Ваши выводы")}</h1>{left > 0 && <button className="btn ghost" onClick={() => set((x) => { x.phase = 'work' })}>{tr("← Поставить ещё опыты (осталось ")}{left})</button>}</div>
        <details className="rubric" open><summary>{tr("Как будет разобрано решение")}</summary>
          <ul><li><b>{tr("Основание вывода.")}</b>{tr(" Позволял ли ваш план оценить этот эффект и отличить его от шума.")}</li><li><b>{tr("Согласие с данными.")}</b>{tr(" Соответствует ли вывод оценке и её интервалу.")}</li><li><b>{tr("Решение.")}</b>{tr(" Следуют ли выбор уровня и прогноз из ваших данных.")}</li></ul>
          <p className="small">{tr("Ответ «сказать нельзя» засчитывается как обоснованный, если ваш план действительно не позволял сделать вывод.")}</p></details>
        {effects}
        <section className="panel"><h3><span className="ptag">1</span>{tr("Что влияет на вязкость")}</h3>
          {F.map((f) => <fieldset key={f.id} className="hyp"><legend>{f.id}: {f.name} ({f.low} → {f.high})</legend><div className="seg">{Object.entries(OPT).map(([k, l]) => <label key={k} className={s.ans[f.id] === k ? 'on' : ''}><input type="radio" name={`f-${f.id}`} checked={s.ans[f.id] === k} onChange={() => set((x) => { x.ans[f.id] = k })} />{l}</label>)}</div></fieldset>)}
          <fieldset className="hyp"><legend>{tr("Взаимодействие загустителя и актива (A × B)")}</legend><div className="seg">{Object.entries(OPT_AB).map(([k, l]) => <label key={k} className={s.ans.AB === k ? 'on' : ''}><input type="radio" name="f-AB" checked={s.ans.AB === k} onChange={() => set((x) => { x.ans.AB = k })} />{l}</label>)}</div></fieldset></section>
        <section className="panel"><h3><span className="ptag">2</span>{tr("Решение по рецептуре с 2 % актива")}</h3>
          <div className="choices">{[['low', `${tr("Загуститель ")}${F[0].low}`], ['high', `${tr("Загуститель ")}${F[0].high}`], ['none', tr("Ни один из изученных уровней не даёт норму")]].map(([k, l]) => <label key={k} className={`choice ${s.level === k ? 'on' : ''}`}><input type="radio" name="lvl" checked={s.level === k} onChange={() => set((x) => { x.level = k })} /><span>{l}</span></label>)}</div>
          <label className="field">{tr("Ваш прогноз вязкости для рецептуры «загуститель ")}{F[0].high}{tr(", актив 2 %, мешалка ")}{F[2].low}»
            <span className="inl"><input inputMode="decimal" value={s.pred} onChange={(e) => set((x) => { x.pred = e.target.value })} /><span className="unit">{lab.unit}</span></span></label></section>
        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button className="btn primary" onClick={submit}>{tr("Отправить на разбор")}</button>
      </div>)
  }
  // ---------- Разбор ----------
  const judge = (k: string): { v: Verdict; label: string; text: string } => {
    const e = eff[k], answer = s.ans[k]
    const supported = doeConclusion(e, cells.df)
    const matches = answer === supported
    let explanation: string
    if (!e.estimable) {
      explanation = k === 'AB'
        ? tr("Для этого контраста нужны все четыре сочетания A и B при одном уровне C.")
        : tr("Для этого контраста нужна пара ячеек, отличающихся только выбранным фактором.")
    } else if (supported === 'unknown') {
      explanation = tr("Контраст вычислим, но для оценки разброса и интервала нужны повторы.")
    } else {
      const margin = tc * e.se!
      const interval = `[${fmt(e.value! - margin, 3)}, ${fmt(e.value! + margin, 3)}] ${lab.unit}`
      explanation = `${tr("95 %-й интервал для контраста в измеренных сочетаниях")} ${interval}. ${supported === 'yes'
        ? tr("Интервал исключает ноль. Данные указывают на эффект в этих условиях.")
        : tr("Интервал включает ноль. Данных недостаточно, чтобы отличить эффект от нуля. Его отсутствие не доказано.")}`
    }
    return {
      v: matches ? 'ok' : 'wrong',
      label: matches ? tr("Обосновано данными") : tr("Вывод не следует из плана и результатов"),
      text: explanation,
    }
  }
  const pred = parseNum(s.pred), tv = doeTrue(m, 1, 1, -1)
  const ab = cells.cells.get('1,1,-1')
  const direct = ab ? ab.reduce((a, b) => a + b, 0) / ab.length : undefined
  const ofat = doeTrue(m, -1, -1, -1) + 2 * (m.a - m.ab) + 2 * (m.b - m.ab)
  const predV: Verdict = Math.abs(pred - tv) <= 2 * m.sigma ? 'ok' : Math.abs(pred - tv) <= 4 * m.sigma ? 'weak' : 'wrong'
  const abCombos = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([A, B]) => s.runs.some((r) => r.A === A && r.B === B)).length
  const lvlV: Verdict = s.level === 'high' ? (direct !== undefined ? 'ok' : 'weak') : 'wrong'
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">{tr("Разбор решения")}</p><h1>{lab.title}</h1>
        <dl className="outcome">
          <div><dt>{tr("Варок")}</dt><dd className="num">{s.runs.length}<small>{tr(" из ")}{lab.budget}{tr(", заходов: ")}{s.rounds}</small></dd></div>
          <div><dt>{tr("Сочетаний A × B")}</dt><dd className="num">{abCombos}<small>{tr(" из 4")}</small></dd></div>
          <div><dt>{tr("Повторных опытов")}</dt><dd className="num">{cells.df}</dd></div>
          <div><dt>{tr("Оценка разброса")}</dt><dd className="num">{cells.sd !== undefined ? fmt(cells.sd, 2) : '—'}<small> {lab.unit}{tr(" (в модели ")}{m.sigma})</small></dd></div>
        </dl></header>
      <section className="panel"><h3>{tr("Ваш план")}</h3>
        <article className={`drow ${eff.AB.estimable ? 'ok' : 'wrong'}`}><p><b>{tr("Сочетания загустителя и актива.")}</b> {eff.AB.estimable
          ? tr("Все четыре сочетания A и B измерены при одном уровне C. Можно рассчитать контраст взаимодействия.")
          : tr("Для контраста взаимодействия нужны четыре сочетания A и B при одном и том же уровне C.")}</p></article>
        <article className={`drow ${cells.df >= 2 ? 'ok' : cells.df === 1 ? 'weak' : 'wrong'}`}><p><b>{tr("Повторы.")}</b> {cells.df === 0 ? tr("Ни одного повторного опыта: разброс между одинаковыми варками неизвестен, и любой небольшой эффект неотличим от случайности.") : `${tr("Повторных опытов: ")}${cells.df}${tr(". Оценка разброса ")}${fmt(cells.sd!, 2)} ${lab.unit}${tr(" при заложенных ")}${m.sigma}${cells.df < 2 ? tr(" — по одному повтору она очень неточна") : ''}.`}</p></article>
        {runsTable}{effects}</section>
      <section className="panel"><h3>{tr("Выводы о факторах")}</h3>
        {[...F.map((f) => [f.id, `${f.id}: ${f.name}`]), ['AB', tr("A × B: взаимодействие")]].map(([k, name]) => { const j = judge(k); return (
          <article key={k} className={`drow ${j.v}`}><h4>{name}</h4><p className="yours">{tr("Ваш ответ: ")}<b>{(k === 'AB' ? OPT_AB : OPT)[s.ans[k] as 'yes']}</b> <VerdictTag v={j.v} label={j.label} /></p><p>{j.text}</p></article>) })}</section>
      <section className="panel"><h3>{tr("Решение и прогноз")}</h3>
        <article className={`drow ${lvlV}`}><p className="yours">{tr("Ваш выбор: ")}<b>{s.level === 'high' ? `${tr("загуститель ")}${F[0].high}` : s.level === 'low' ? `${tr("загуститель ")}${F[0].low}` : tr("ни один уровень")}</b> <VerdictTag v={lvlV} label={lvlV === 'ok' ? tr("Подтверждено опытом") : lvlV === 'weak' ? tr("Верно, но без прямого опыта") : tr("Не подтверждается")} /></p>
          <p>{tr("По модели рецептура с 2 % актива даёт ")}{doeTrue(m, -1, 1, -1)} {lab.unit}{tr(" при ")}{F[0].low}{tr(" загустителя и ")}{tv} {lab.unit}{tr(" при ")}{F[0].high}{tr("; норма ")}{T.min}–{T.max}.{direct !== undefined ? `${tr(" В опытах при заданных уровнях A, B и C среднее составило ")}${fmt(direct, 3)} ${lab.unit}.` : tr(" Сочетание A+, B+, C− не измерено напрямую.")}</p></article>
        <article className={`drow ${predV}`}><p className="yours">{tr("Ваш прогноз: ")}<b className="num">{fmt(pred, 3)} {lab.unit}</b>{tr("; заложено в модель: ")}{tv} <VerdictTag v={predV} label={predV === 'ok' ? tr("В пределах разброса") : predV === 'weak' ? tr("Близко") : tr("Далеко")} /></p>
          {Math.abs(pred - ofat) <= 4 && <p>{tr("Ваш прогноз близок к ")}{ofat} {lab.unit}{tr(" — столько даёт сложение эффектов, измеренных по отдельности от базовой рецептуры. Факт ниже на ")}{ofat - tv}{tr(": актив снижает вязкость тем сильнее, чем больше загустителя. Это и есть взаимодействие, ")}{eff.AB.estimable ? tr("и ваш план его показывал.") : tr("которого ваш план не видел.")}</p>}
          <p className="small">{tr("Последний шаг в реальной работе — подтверждающая варка выбранной рецептуры.")}</p></article></section>
      <section className="panel story"><h3>{tr("Принцип")}</h3>
        <p>{tr("Ценность опыта определяется вопросом, на который он отвечает. Десять варок «по одному фактору» дают три эффекта в одной точке; те же десять, расставленные по сочетаниям с повторами, дают эффекты, взаимодействие, оценку шума и прямое измерение нужной рецептуры. Вывод «не влияет» без оценки шума — предположение.")}</p>
        <p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn" onClick={() => set((x) => { x.phase = 'conclude' })}>{tr("Пересмотреть выводы")}</button><button className="btn ghost" onClick={reset}>{tr("Новая попытка (новые случайные данные)")}</button></div>
    </div>)
}
