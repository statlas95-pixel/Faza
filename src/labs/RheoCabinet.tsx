import { useState } from 'react'
import { LabMeta } from '../content'
import { HB, hbViscosity, recovery } from '../models/physics'
import { Chart, Slider, fmt, parseNum, VerdictTag, Verdict, range } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

type Sample = HB & { id: string; floor: number; tau: number }
interface S { phase: 'brief' | 'work' | 'debrief'; tests: string[]; lr: number; rate: string; claims: Record<string, { sample?: string; proof?: string }>; transfer: Record<number, any>; finished?: boolean }
const COL: Record<string, string> = { A: '#E4572E', B: '#0E7C7B', C: '#6B4FC8' }
const DASH: Record<string, string | undefined> = { A: undefined, B: '8 4', C: '2 4' }

export default function RheoCabinet({ lab }: { lab: LabMeta }) {
  const samples = lab.samples as Sample[], tests = lab.tests as any[], claims = lab.claims as any[]
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', tests: [], lr: 0.6, rate: '', claims: {}, transfer: {} }))
  const [warn, setWarn] = useState('')
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={['Вводная', 'Измерения', 'Разбор']} step={{ brief: 0, work: 1, debrief: 2 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={s.tests.length > 0} onStart={() => set((x) => { x.phase = 'work' })} />)
  const cur = Math.pow(10, s.lr)

  const view = (id: string) => {
    if (id === 'single') {
      const rpm = [[5, 1], [20, 4], [50, 10]]
      return (
        <div key={id} className="result"><h4>Вискозиметр, три скорости</h4>
          <div className="table-wrap" tabIndex={0}><table><caption>Кажущаяся вязкость, мПа·с; 25 °C; отсчёт через 60 с (учебный пересчёт: 20 об/мин ≈ 4 с⁻¹)</caption>
            <thead><tr><th>Образец</th>{rpm.map(([r]) => <th key={r}>{r} об/мин</th>)}</tr></thead>
            <tbody>{samples.map((x) => <tr key={x.id}><th>{x.id}</th>{rpm.map(([r, g]) => <td key={r} className="num">{fmt(Math.round(hbViscosity(x, g) * 10) * 100, 3)}</td>)}</tr>)}</tbody></table></div></div>)
    }
    if (id === 'flow') {
      const xs = range(0.1, 3000, 60, true)
      return (
        <div key={id} className="result"><h4>Кривые течения</h4>
          <Chart title="Кривые течения образцов A, B, C" xLog yLog xDomain={[0.1, 3000]} yDomain={[0.1, 1000]} xLabel="Скорость сдвига, с⁻¹ (25 °C, конус–плита)" yLabel="Вязкость, Па·с" cursor={cur}
            series={samples.map((x) => ({ name: x.id, color: COL[x.id], dash: DASH[x.id], points: xs.map((g) => [g, hbViscosity(x, g)] as [number, number]) }))} />
          <Slider label="Точка чтения" value={s.lr} min={-1} max={3.47} step={0.01} onChange={(v) => set((y) => { y.lr = v })} show={`${fmt(cur, 3)} с⁻¹`} />
          <table className="readtable"><thead><tr><th>Образец</th>{samples.map((x) => <th key={x.id} style={{ color: COL[x.id] }}>{x.id}</th>)}</tr></thead>
            <tbody><tr><th>Вязкость при {fmt(cur, 3)} с⁻¹, Па·с</th>{samples.map((x) => <td key={x.id} className="num">{fmt(hbViscosity(x, cur), 3)}</td>)}</tr></tbody></table></div>)
    }
    if (id === 'yield') {
      const xs = range(0.1, 100, 80, true)
      return (
        <div key={id} className="result"><h4>Рампа напряжения</h4>
          <Chart title="Скорость сдвига при заданном напряжении" xLog yLog xDomain={[0.1, 100]} yDomain={[0.0001, 1000]} xLabel="Напряжение сдвига, Па (рампа 0,1–100 Па за 5 мин)" yLabel="Скорость сдвига, с⁻¹"
            markers={[{ x: 9.81, label: 'слой 1 мм: ≈10 Па' }]}
            series={samples.map((x) => ({ name: x.id, color: COL[x.id], dash: DASH[x.id], points: xs.map((sg) => [sg, sg > x.sy ? Math.max(Math.pow((sg - x.sy) / x.K, 1 / x.n), 0.0001) : 0.0001] as [number, number]) }))} />
          <p className="small">Линия у нижней границы графика означает: течение за время измерения не обнаружено.</p></div>)
    }
    const ts = range(0, 600, 61)
    return (
      <div key={id} className="result"><h4>Восстановление после сдвига</h4>
        <Chart title="Восстановление вязкости после 60 с при 1000 с⁻¹" xDomain={[0, 600]} yDomain={[0, 100]} xLabel="Время после прекращения сдвига, с (измерение при 0,5 с⁻¹)" yLabel="Доля исходной вязкости, %"
          series={samples.map((x) => ({ name: x.id, color: COL[x.id], dash: DASH[x.id], points: ts.map((t) => [t, recovery(x.floor, x.tau, t) * 100] as [number, number]) }))} /></div>)
  }

  if (s.phase === 'work') {
    const left = lab.maxTests - s.tests.length
    const submit = () => {
      const miss = claims.filter((c) => !s.claims[c.id]?.sample || !s.claims[c.id]?.proof).length
      if (miss || !isFinite(parseNum(s.rate))) { setWarn(`Не заполнено: ${miss ? `${miss} жалоб(ы)` : ''}${miss && !isFinite(parseNum(s.rate)) ? ', ' : ''}${!isFinite(parseNum(s.rate)) ? 'расчёт скорости сдвига' : ''}.`); return }
      set((x) => { x.phase = 'debrief'; x.finished = true }); window.scrollTo(0, 0)
      const okN = claims.filter((c) => s.claims[c.id].sample === c.answer && c.proof.includes(s.claims[c.id].proof) && s.tests.includes(s.claims[c.id].proof!)).length
      markFinished(lab.id, `доказано ${okN} из ${claims.length}`, { tests: s.tests }, (okN + 0.5 * claims.filter((c) => s.claims[c.id].sample === c.answer && !(c.proof.includes(s.claims[c.id].proof) && s.tests.includes(s.claims[c.id].proof!))).length) / claims.length)
    }
    return frame(
      <div className="rheo">
        <aside className="panel rheo-side">
          <h3>Прибор <span className="budget num">свободен на {left} из {lab.maxTests}</span></h3>
          <ul className="tests">{tests.map((t) => {
            const done = s.tests.includes(t.id)
            return <li key={t.id} className={done ? 'done' : ''}><b>{t.title}</b><span className="small">{t.time} · {t.shows}</span>
              <button className="btn small" disabled={done || left <= 0} onClick={() => set((x) => { x.tests.push(t.id) })}>{done ? 'Выполнено' : left <= 0 ? 'Нет времени прибора' : 'Запустить'}</button></li>
          })}</ul>
          <h3>Исходные данные</h3>
          <p className="small">A, B, C — около 12 000 мПа·с на вискозиметре при 20 об/мин, 25 °C. Плотность ≈ 1000 кг/м³.</p>
        </aside>
        <div className="rheo-main">
          <section className="results">{s.tests.length === 0 ? <div className="empty"><p>Результаты измерений появятся здесь. Подумайте, в каком диапазоне скоростей сдвига возникает каждая жалоба, — и запускайте тест, который этот диапазон покрывает.</p></div> : s.tests.map(view)}</section>
          <section className="panel"><h3><span className="ptag">1</span>Расчёт</h3>
            <label className="field">{lab.rateQuestion.q}
              <span className="inl"><input inputMode="decimal" value={s.rate} onChange={(e) => set((x) => { x.rate = e.target.value })} /><span className="unit">с⁻¹</span></span></label></section>
          <section className="panel"><h3><span className="ptag">2</span>Жалоба → образец → доказательство</h3>
            {claims.map((c) => (
              <fieldset key={c.id} className="claim"><legend>{c.text}</legend>
                <div className="seg">{samples.map((x) => <label key={x.id} className={s.claims[c.id]?.sample === x.id ? 'on' : ''}><input type="radio" name={`c-${c.id}`} checked={s.claims[c.id]?.sample === x.id} onChange={() => set((y) => { (y.claims[c.id] ??= {}).sample = x.id })} />Образец {x.id}</label>)}</div>
                <label className="field sm">Какое измерение это доказывает?
                  <select value={s.claims[c.id]?.proof ?? ''} onChange={(e) => set((y) => { (y.claims[c.id] ??= {}).proof = e.target.value || undefined })}>
                    <option value="">— выберите —</option>{tests.map((t) => <option key={t.id} value={t.id}>{t.title}{s.tests.includes(t.id) ? '' : ' (не выполнено)'}</option>)}<option value="none">Доказательства нет — это предположение</option></select></label>
              </fieldset>))}</section>
          {warn && <p className="warnline" role="alert">{warn}</p>}
          <button className="btn primary" onClick={submit}>Отправить заключение</button>
        </div>
      </div>)
  }
  const rate = parseNum(s.rate), rq = lab.rateQuestion, rateOk = Math.abs(rate - rq.answer) / rq.answer <= rq.tol
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Разбор заключения</p><h1>{lab.title}</h1>
        <p className="lead">Вы выполнили: {s.tests.map((id) => tests.find((t) => t.id === id).title.split(' — ')[0].split(',')[0]).join('; ') || 'ни одного измерения'}.</p></header>
      <section className="panel"><h3>Расчёт скорости сдвига</h3>
        <article className={`drow ${rateOk ? 'ok' : 'wrong'}`}><p className="yours"><VerdictTag v={rateOk ? 'ok' : 'wrong'} label={rateOk ? 'Расчёт сходится' : 'Не сходится'} /> Ваш ответ: {fmt(rate, 4)} с⁻¹</p><p>{rq.explain}</p></article></section>
      <section className="panel"><h3>Жалобы</h3>
        {claims.map((c) => {
          const a = s.claims[c.id], right = a.sample === c.answer, valid = c.proof.includes(a.proof), ran = s.tests.includes(a.proof!)
          const v: Verdict = right && valid && ran ? 'ok' : right ? 'weak' : 'wrong'
          const label = v === 'ok' ? 'Доказано' : right ? 'Верно, но не доказано' : 'Образец определён неверно'
          return (
            <article key={c.id} className={`drow ${v}`}><h4>{c.text}</h4>
              <p className="yours">Ваш ответ: образец <b>{a.sample}</b>, доказательство — {a.proof === 'none' ? 'нет' : tests.find((t) => t.id === a.proof)?.title} <VerdictTag v={v} label={label} /></p>
              {right && !valid && a.proof !== 'none' && <p>Образец назван верно, но выбранное измерение этого не показывает: оно не покрывает диапазон, в котором возникает жалоба. Доказательством служит: {c.proof.map((id: string) => tests.find((t) => t.id === id).title).join(' или ')}.</p>}
              {right && valid && !ran && <p>Вы правильно назвали нужное измерение, но не выполнили его — значит, образец определён по догадке или методом исключения. В отчёте это должно быть названо предположением.</p>}
              {right && a.proof === 'none' && <p>Честная пометка: вы отделили предположение от доказанного. Доказательство дало бы: {c.proof.map((id: string) => tests.find((t) => t.id === id).title).join(' или ')}.</p>}
              {!right && <p>Правильный образец — <b>{c.answer}</b>.</p>}
              <p>{c.explain}</p></article>)
        })}</section>
      <section className="panel"><h3>Все четыре измерения</h3>
        <p className="small">Теперь открыты и те, на которые не хватило времени прибора. Сравните, что каждое из них позволяет утверждать.</p>
        <div className="results">{tests.map((t) => view(t.id))}</div>
        <article className="drow weak"><p><b>Вискозиметр на трёх скоростях</b> — единственное измерение, которое не отвечает ни на одну жалобу: все три точки лежат в диапазоне 1–10 с⁻¹, а жалобы возникают при ≈0,01–1 с⁻¹ (стекание), ≈1000 с⁻¹ (дозатор) и во времени (восстановление).</p></article></section>
      <section className="panel story"><h3>Принцип</h3><p>Сначала — в каком диапазоне сдвига и времени живёт вопрос, затем — тест, который этот диапазон покрывает, и только потом вывод. Ответ без измерения остаётся предположением, даже если он верен.</p><p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn" onClick={() => set((x) => { x.phase = 'work' })}>Пересмотреть заключение</button><button className="btn ghost" onClick={reset}>Новая попытка с нуля</button></div>
    </div>)
}
