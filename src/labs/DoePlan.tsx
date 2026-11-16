import { useState } from 'react'
import { LabMeta } from '../content'
import { DoeModel, DoeRun, doeMeasure, doeTrue, doeCells, doeMainEffect, doeInteraction, Effect, tCrit } from '../models/physics'
import { fmt, parseNum, VerdictTag, Verdict } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

interface S { phase: 'brief' | 'work' | 'conclude' | 'debrief'; seed: number; plan: Record<string, number>; runs: DoeRun[]; rounds: number; ans: Record<string, string>; pred: string; level?: string; transfer: Record<number, any>; finished?: boolean }
const COMBOS = [-1, 1].flatMap((C) => [-1, 1].flatMap((B) => [-1, 1].map((A) => ({ A, B, C }))))
const key = (c: { A: number; B: number; C: number }) => `${c.A},${c.B},${c.C}`
const sign = (v: number) => (v > 0 ? '+' : '−')
const OPT = { yes: 'Влияет', no: 'Не отличим от шума', unknown: 'По моим данным сказать нельзя' }
const OPT_AB = { yes: 'Есть', no: 'Не отличимо от шума', unknown: 'По моим данным оценить нельзя' }

export default function DoePlan({ lab }: { lab: LabMeta }) {
  const m = lab.model as DoeModel, F = lab.factors as any[], T = lab.target
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', seed: Math.floor(Math.random() * 9000) + 1, plan: {}, runs: [], rounds: 0, ans: {}, pred: '', transfer: {} }))
  const [warn, setWarn] = useState('')
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={['Вводная', 'Опыты', 'Выводы', 'Разбор']} step={{ brief: 0, work: 1, conclude: 2, debrief: 3 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={s.runs.length > 0} onStart={() => set((x) => { x.phase = 'work' })} />)
  const planned = Object.values(s.plan).reduce((a, b) => a + b, 0), left = lab.budget - s.runs.length
  const eff = { A: doeMainEffect(s.runs, 'A'), B: doeMainEffect(s.runs, 'B'), C: doeMainEffect(s.runs, 'C'), AB: doeInteraction(s.runs) } as Record<string, Effect>
  const cells = doeCells(s.runs), tc = tCrit(cells.df)
  const lvl = (f: any, v: number) => (v > 0 ? f.high : f.low)
  const effRow = (name: string, e: Effect) => (
    <tr key={name}><th scope="row">{name}</th>
      <td className="num">{e.estimable ? `${e.value! > 0 ? '+' : ''}${fmt(e.value!, 3)}` : '—'}</td>
      <td className="num">{e.estimable ? (e.se !== undefined ? `± ${fmt(tc * e.se, 2)}` : 'нет оценки шума') : '—'}</td>
      <td className="small">{e.estimable ? `по ${e.pairs} ${name.includes('×') ? 'набору из четырёх сочетаний' : 'парам сочетаний, различающихся только этим фактором'}` : name.includes('×') ? 'не оценивается: нужны все четыре сочетания уровней A и B при одном уровне C' : 'не оценивается: нет пары опытов, различающихся только этим фактором'}</td></tr>)
  const effects = (
    <div className="table-wrap" tabIndex={0}><table>
      <caption>Эффекты, рассчитанные по вашим опытам, {lab.unit}. Интервал — 95 %-й доверительный, по повторным опытам (при малом числе повторов он шире «двух сигм»){cells.sd !== undefined ? ` (оценка разброса s = ${fmt(cells.sd, 2)} ${lab.unit}, степеней свободы ${cells.df})` : ' — повторов пока нет'}.</caption>
      <thead><tr><th>Эффект</th><th>Оценка (верхний − нижний)</th><th>Интервал</th><th>На чём основана</th></tr></thead>
      <tbody>{F.map((f) => effRow(`${f.id}: ${f.name}`, eff[f.id]))}{effRow('A × B: взаимодействие', eff.AB)}</tbody></table></div>)
  const runsTable = (
    <div className="table-wrap" tabIndex={0}><table>
      <caption>Журнал варок. Вязкость — синтетические данные, {lab.unit}; измерение через 24 ч при 25 °C.</caption>
      <thead><tr><th>№</th>{F.map((f) => <th key={f.id}>{f.id}: {f.name}</th>)}<th>Вязкость, {lab.unit}</th></tr></thead>
      <tbody>{s.runs.map((r, i) => <tr key={i}><td className="num">{i + 1}</td>{F.map((f) => <td key={f.id} className="num">{sign((r as any)[f.id])} {lvl(f, (r as any)[f.id])}</td>)}<td className="num"><b>{fmt(r.y, 3)}</b></td></tr>)}</tbody></table></div>)

  if (s.phase === 'work') return frame(
    <div className="scale">
      <section className="panel">
        <h3>План захода <span className="budget num">осталось варок: {left}{planned > 0 && ` · в плане ${planned}`}</span></h3>
        <p className="small">Выберите, какие сочетания уровней варить и сколько раз.</p>
        <ul className="small legend">{F.map((f) => <li key={f.id}><b>{f.id}</b> — {f.name}: «−» {f.low}, «+» {f.high}</li>)}</ul>
        <div className="table-wrap" tabIndex={0}><table className="plan">
          <thead><tr>{F.map((f) => <th key={f.id}>{f.id}</th>)}<th>Сварено</th><th>Сварить ещё</th></tr></thead>
          <tbody>{COMBOS.map((c) => {
            const k = key(c), n = s.plan[k] ?? 0, done = cells.cells.get(k)?.length ?? 0
            return (
              <tr key={k}>{F.map((f) => <td key={f.id} className="num" title={lvl(f, (c as any)[f.id])}>{sign((c as any)[f.id])}</td>)}
                <td className="num">{done || '—'}</td>
                <td><span className="stepper-n"><button className="btn small ghost" aria-label="Меньше" disabled={n === 0} onClick={() => set((x) => { x.plan[k] = n - 1 })}>−</button><output className="num" aria-live="polite">{n}</output>
                  <button className="btn small ghost" aria-label="Больше" disabled={planned >= left} onClick={() => set((x) => { x.plan[k] = n + 1 })}>+</button></span></td></tr>)
          })}</tbody></table></div>
        <button className="btn primary wide" disabled={planned === 0} onClick={() => set((x) => {
          for (const c of COMBOS) for (let i = 0; i < (x.plan[key(c)] ?? 0); i++) x.runs.push({ ...c, y: doeMeasure(m, c.A, c.B, c.C, x.seed + x.runs.length * 7.31) })
          x.plan = {}; x.rounds++
        })}>{planned === 0 ? (left === 0 ? 'Бюджет исчерпан' : 'Добавьте опыты в план') : `Сварить ${planned} и измерить`}</button>
        <p className="small dim">Порядок варок внутри захода считается рандомизированным.</p>
      </section>
      <div>
        {s.runs.length === 0 ? <div className="empty"><p>Результаты появятся здесь. Прежде чем тратить бюджет, решите: какие сочетания нужны, чтобы ответить на вопрос «сколько загустителя нужно при 2 % актива», и чем вы отличите эффект от разброса.</p></div>
          : <>{runsTable}<h4>Что можно вычислить из этих данных</h4>{effects}</>}
        <div className="row end"><span className="small">Цель: {T.min}–{T.max} {lab.unit} при 2 % актива.</span>
          <button className="btn primary" disabled={s.runs.length === 0} onClick={() => set((x) => { x.phase = 'conclude' })}>Перейти к выводам →</button></div>
      </div>
    </div>)

  if (s.phase === 'conclude') {
    const submit = () => {
      const miss = [...F.map((f) => f.id), 'AB'].filter((k) => !s.ans[k]).length
      if (miss || !s.level || !isFinite(parseNum(s.pred))) { setWarn('Заполните все выводы, выбор уровня загустителя и прогноз вязкости.'); return }
      set((x) => { x.phase = 'debrief'; x.finished = true }); window.scrollTo(0, 0)
      markFinished(lab.id, `варок ${s.runs.length}; уровень загустителя ${s.level === 'high' ? '0,5 %' : s.level === 'low' ? '0,3 %' : 'не выбран'}; прогноз ${s.pred} ${lab.unit}`, { runs: s.runs, answers: s.ans, pred: s.pred, level: s.level })
    }
    return frame(
      <div className="conclude">
        <div className="conclude-head"><h1>Ваши выводы</h1>{left > 0 && <button className="btn ghost" onClick={() => set((x) => { x.phase = 'work' })}>← Поставить ещё опыты (осталось {left})</button>}</div>
        <details className="rubric" open><summary>Как будет разобрано решение</summary>
          <ul><li><b>Основание вывода.</b> Позволял ли ваш план оценить этот эффект и отличить его от шума.</li><li><b>Согласие с данными.</b> Соответствует ли вывод оценке и её интервалу.</li><li><b>Решение.</b> Следуют ли выбор уровня и прогноз из ваших данных.</li></ul>
          <p className="small">Ответ «сказать нельзя» засчитывается как обоснованный, если ваш план действительно не позволял сделать вывод.</p></details>
        {effects}
        <section className="panel"><h3><span className="ptag">1</span>Что влияет на вязкость</h3>
          {F.map((f) => <fieldset key={f.id} className="hyp"><legend>{f.id}: {f.name} ({f.low} → {f.high})</legend><div className="seg">{Object.entries(OPT).map(([k, l]) => <label key={k} className={s.ans[f.id] === k ? 'on' : ''}><input type="radio" name={`f-${f.id}`} checked={s.ans[f.id] === k} onChange={() => set((x) => { x.ans[f.id] = k })} />{l}</label>)}</div></fieldset>)}
          <fieldset className="hyp"><legend>Взаимодействие загустителя и актива (A × B)</legend><div className="seg">{Object.entries(OPT_AB).map(([k, l]) => <label key={k} className={s.ans.AB === k ? 'on' : ''}><input type="radio" name="f-AB" checked={s.ans.AB === k} onChange={() => set((x) => { x.ans.AB = k })} />{l}</label>)}</div></fieldset></section>
        <section className="panel"><h3><span className="ptag">2</span>Решение по рецептуре с 2 % актива</h3>
          <div className="choices">{[['low', `Загуститель ${F[0].low}`], ['high', `Загуститель ${F[0].high}`], ['none', 'Ни один из изученных уровней не даёт норму']].map(([k, l]) => <label key={k} className={`choice ${s.level === k ? 'on' : ''}`}><input type="radio" name="lvl" checked={s.level === k} onChange={() => set((x) => { x.level = k })} /><span>{l}</span></label>)}</div>
          <label className="field">Ваш прогноз вязкости для рецептуры «загуститель {F[0].high}, актив 2 %, мешалка {F[2].low}»
            <span className="inl"><input inputMode="decimal" value={s.pred} onChange={(e) => set((x) => { x.pred = e.target.value })} /><span className="unit">{lab.unit}</span></span></label></section>
        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button className="btn primary" onClick={submit}>Отправить на разбор</button>
      </div>)
  }
  // ---------- Разбор ----------
  const truth: Record<string, number> = { A: 2 * m.a, B: 2 * m.b, C: 2 * m.c, AB: 2 * m.ab }
  const judge = (k: string): { v: Verdict; label: string; text: string } => {
    const e = eff[k], a = s.ans[k], real = Math.abs(truth[k]) > 0
    const name = k === 'AB' ? 'взаимодействие' : 'эффект'
    if (!e.estimable) {
      if (a === 'unknown') return { v: 'weak', label: 'Честно, но план мог это показать', text: `Ваш план не содержал нужных сочетаний, и вы это признали. При бюджете в ${lab.budget} варок ${name} можно было оценить${k === 'AB' ? ': для этого нужны все четыре сочетания уровней загустителя и актива' : ''}.` }
      return { v: 'wrong', label: 'Вывод без данных', text: `Ваш план не позволял оценить ${name}: ${k === 'AB' ? 'не было всех четырёх сочетаний уровней A и B при одном уровне C' : 'не было пары опытов, различающихся только этим фактором'}. ${a === (real ? 'yes' : 'no') ? 'Ответ совпал с заложенным в модель, но получен не из опытов.' : ''}` }
    }
    const est = `Оценка по вашим данным: ${e.value! > 0 ? '+' : ''}${fmt(e.value!, 3)} ${lab.unit}${e.se !== undefined ? ` ± ${fmt(tc * e.se, 2)}` : ''}; заложено в модель: ${truth[k] > 0 ? '+' : ''}${truth[k]}.`
    if (a === 'unknown') return { v: 'weak', label: 'Данные позволяли вывод', text: `${est} ${e.se === undefined ? 'Без повторных опытов осторожность оправдана: шум не оценён.' : 'Оценка и интервал были доступны — вывод можно было сделать.'}` }
    if (e.se === undefined) return { v: a === (real ? 'yes' : 'no') ? 'weak' : 'wrong', label: a === (real ? 'yes' : 'no') ? 'Верно, но шум не оценён' : 'Не подтверждается', text: `${est} В плане нет ни одного повторного опыта, поэтому отличить ${name} от случайного разброса нечем. ${real ? 'Эффект велик, и вывод скорее всего устоит, но это предположение.' : 'Для вывода «не влияет» оценка шума обязательна.'}` }
    const sig = Math.abs(e.value!) > tc * e.se
    const consistent = (a === 'yes') === sig
    if (consistent && (a === 'yes') === real) return { v: 'ok', label: 'Обосновано данными', text: `${est} ${sig ? 'Оценка выходит за доверительный интервал.' : 'Оценка внутри доверительного интервала: в изученном диапазоне влияние не отличимо от шума.'}` }
    if (consistent) return { v: 'weak', label: 'Следует из ваших данных, но не совпало с моделью', text: `${est} Ваш вывод честно следует из оценки и интервала; расхождение с моделью — случайность выборки при малом числе опытов. Подтверждающий опыт это исправил бы.` }
    return { v: 'wrong', label: 'Противоречит вашим данным', text: `${est} ${sig ? 'Оценка выходит за доверительный интервал — эффект есть.' : 'Оценка внутри доверительного интервала — утверждать влияние нельзя.'}` }
  }
  const pred = parseNum(s.pred), tv = doeTrue(m, 1, 1, -1)
  const ab = cells.cells.get('1,1,-1') ?? cells.cells.get('1,1,1')
  const direct = ab ? ab.reduce((a, b) => a + b, 0) / ab.length : undefined
  const ofat = doeTrue(m, -1, -1, -1) + 2 * (m.a - m.ab) + 2 * (m.b - m.ab)
  const predV: Verdict = Math.abs(pred - tv) <= 2 * m.sigma ? 'ok' : Math.abs(pred - tv) <= 4 * m.sigma ? 'weak' : 'wrong'
  const abCombos = [[-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([A, B]) => s.runs.some((r) => r.A === A && r.B === B)).length
  const lvlV: Verdict = s.level === 'high' ? (direct !== undefined ? 'ok' : 'weak') : 'wrong'
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Разбор решения</p><h1>{lab.title}</h1>
        <dl className="outcome">
          <div><dt>Варок</dt><dd className="num">{s.runs.length}<small> из {lab.budget}, заходов: {s.rounds}</small></dd></div>
          <div><dt>Сочетаний A × B</dt><dd className="num">{abCombos}<small> из 4</small></dd></div>
          <div><dt>Повторных опытов</dt><dd className="num">{cells.df}</dd></div>
          <div><dt>Оценка разброса</dt><dd className="num">{cells.sd !== undefined ? fmt(cells.sd, 2) : '—'}<small> {lab.unit} (в модели {m.sigma})</small></dd></div>
        </dl></header>
      <section className="panel"><h3>Ваш план</h3>
        <article className={`drow ${abCombos === 4 ? 'ok' : 'wrong'}`}><p><b>Сочетания загустителя и актива.</b> {abCombos === 4 ? 'Поставлены все четыре — взаимодействие можно оценить, а рецептура с активом и высоким загустителем измерена напрямую.' : `Поставлено ${abCombos} из 4. ${direct === undefined ? 'Рецептуру «загуститель 0,5 % + актив 2 %» вы не варили — решение о ней опирается на экстраполяцию.' : ''} Без всех четырёх сочетаний взаимодействие не оценивается: это главный недостаток подхода «по одному фактору».`}</p></article>
        <article className={`drow ${cells.df >= 2 ? 'ok' : cells.df === 1 ? 'weak' : 'wrong'}`}><p><b>Повторы.</b> {cells.df === 0 ? 'Ни одного повторного опыта: разброс между одинаковыми варками неизвестен, и любой небольшой эффект неотличим от случайности.' : `Повторных опытов: ${cells.df}. Оценка разброса ${fmt(cells.sd!, 2)} ${lab.unit} при заложенных ${m.sigma}${cells.df < 2 ? ' — по одному повтору она очень неточна' : ''}.`}</p></article>
        {runsTable}{effects}</section>
      <section className="panel"><h3>Выводы о факторах</h3>
        {[...F.map((f) => [f.id, `${f.id}: ${f.name}`]), ['AB', 'A × B: взаимодействие']].map(([k, name]) => { const j = judge(k); return (
          <article key={k} className={`drow ${j.v}`}><h4>{name}</h4><p className="yours">Ваш ответ: <b>{(k === 'AB' ? OPT_AB : OPT)[s.ans[k] as 'yes']}</b> <VerdictTag v={j.v} label={j.label} /></p><p>{j.text}</p></article>) })}</section>
      <section className="panel"><h3>Решение и прогноз</h3>
        <article className={`drow ${lvlV}`}><p className="yours">Ваш выбор: <b>{s.level === 'high' ? `загуститель ${F[0].high}` : s.level === 'low' ? `загуститель ${F[0].low}` : 'ни один уровень'}</b> <VerdictTag v={lvlV} label={lvlV === 'ok' ? 'Подтверждено опытом' : lvlV === 'weak' ? 'Верно, но без прямого опыта' : 'Не подтверждается'} /></p>
          <p>По модели рецептура с 2 % актива даёт {doeTrue(m, -1, 1, -1)} {lab.unit} при {F[0].low} загустителя и {tv} {lab.unit} при {F[0].high}; норма {T.min}–{T.max}.{direct !== undefined ? ` В ваших опытах эта рецептура дала в среднем ${fmt(direct, 3)} ${lab.unit}.` : ' Вы её не варили.'}</p></article>
        <article className={`drow ${predV}`}><p className="yours">Ваш прогноз: <b className="num">{fmt(pred, 3)} {lab.unit}</b>; заложено в модель: {tv} <VerdictTag v={predV} label={predV === 'ok' ? 'В пределах разброса' : predV === 'weak' ? 'Близко' : 'Далеко'} /></p>
          {Math.abs(pred - ofat) <= 4 && <p>Ваш прогноз близок к {ofat} {lab.unit} — столько даёт сложение эффектов, измеренных по отдельности от базовой рецептуры. Факт ниже на {ofat - tv}: актив снижает вязкость тем сильнее, чем больше загустителя. Это и есть взаимодействие, {eff.AB.estimable ? 'и ваш план его показывал.' : 'которого ваш план не видел.'}</p>}
          <p className="small">Последний шаг в реальной работе — подтверждающая варка выбранной рецептуры.</p></article></section>
      <section className="panel story"><h3>Принцип</h3>
        <p>Ценность опыта определяется вопросом, на который он отвечает. Десять варок «по одному фактору» дают три эффекта в одной точке; те же десять, расставленные по сочетаниям с повторами, дают эффекты, взаимодействие, оценку шума и прямое измерение нужной рецептуры. Вывод «не влияет» без оценки шума — предположение.</p>
        <p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn" onClick={() => set((x) => { x.phase = 'conclude' })}>Пересмотреть выводы</button><button className="btn ghost" onClick={reset}>Новая попытка (новые случайные данные)</button></div>
    </div>)
}
