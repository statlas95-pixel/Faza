import { LabMeta } from '../content'
import { MdInline } from '../md'
import { QuestionCard, isCorrect, Question, VerdictTag, fmt } from '../ui'
import { bumpHints } from '../store'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

// Универсальное занятие-расчёт: шаги с вопросами, подсказки, последствия после шага. Полностью задаётся YAML-файлом.
interface S { phase: 'brief' | 'work' | 'debrief'; step: number; answers: Record<string, any>; first: Record<string, boolean>; hints: Record<string, boolean>; transfer: Record<number, any>; finished?: boolean }
const Hand = ({ v }: { v: string }) => (v.startsWith('~') ? <span className="hand">{v.slice(1)}</span> : <>{v}</>)

export default function Worksheet({ lab }: { lab: LabMeta }) {
  const steps = lab.steps as { title: string; text: string; questions: (Question & { hint?: string })[]; after?: string }[]
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', step: 0, answers: {}, first: {}, hints: {}, transfer: {} }))
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={['Вводная', 'Расчёт', 'Разбор']} step={{ brief: 0, work: 1, debrief: 2 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={Object.keys(s.answers).length > 0} onStart={() => set((x) => { x.phase = 'work' })} />)
  const sheet = lab.sheet && (
    <aside className="paper sheet" aria-label={lab.sheet.title}>
      <div className="paper-head"><h2>{lab.sheet.title}</h2><dl><div><dt>Происхождение</dt><dd>{lab.sheet.origin}</dd></div></dl></div>
      <div className="paper-scroll" tabIndex={0}><table><tbody>{lab.sheet.rows.map((r: string[], i: number) => <tr key={i}><th scope="row">{r[0]}</th><td className="num"><Hand v={r[1]} /></td></tr>)}</tbody></table></div>
      <p className="stamp" aria-hidden>УЧЕБНЫЙ ДОКУМЕНТ</p>
    </aside>)
  const all = steps.flatMap((st, si) => st.questions.map((q, qi) => ({ q, k: `${si}.${qi}`, si })))
  if (s.phase === 'work') {
    const st = steps[s.step], keys = st.questions.map((_, qi) => `${s.step}.${qi}`)
    const stepDone = keys.every((k, i) => isCorrect(st.questions[i], s.answers[k]))
    const last = s.step === steps.length - 1
    return frame(
      <div className="scale">
        {sheet}
        <div className="scale-steps">
          <p className="eyebrow">Шаг {s.step + 1} из {steps.length}</p><h2>{st.title}</h2><MdInline text={st.text} />
          {st.questions.map((q, qi) => { const k = keys[qi]; return (
            <div key={k}>
              <QuestionCard q={q} n={qi + 1} value={s.answers[k]} onAnswer={(v) => set((x) => { if (x.first[k] === undefined) x.first[k] = isCorrect(q, v); x.answers[k] = v })} />
              {q.hint && !isCorrect(q, s.answers[k]) && (s.hints[k] ? <p className="hintbox"><b>Подсказка.</b> {q.hint}</p> : <button className="btn small ghost hintbtn" onClick={() => { set((x) => { x.hints[k] = true }); bumpHints(lab.id) }}>Открыть подсказку (решение будет засчитано как выполненное с опорой)</button>)}
            </div>) })}
          {stepDone && st.after && <div className="afterstep" role="status"><MdInline text={st.after} /></div>}
          <div className="row end">
            {s.step > 0 && <button className="btn ghost" onClick={() => set((x) => { x.step-- })}>← Предыдущий шаг</button>}
            <button className="btn primary" disabled={!stepDone} onClick={() => {
              if (!last) { set((x) => { x.step++ }); window.scrollTo(0, 0); return }
              const firstOk = all.filter(({ k }) => s.first[k]).length
              set((x) => { x.phase = 'debrief'; x.finished = true }); window.scrollTo(0, 0)
              markFinished(lab.id, `с первой попытки ${firstOk} из ${all.length}; подсказок: ${Object.keys(s.hints).length}`, { first: s.first, hints: Object.keys(s.hints).length }, (firstOk + 0.5 * (all.length - firstOk)) / all.length)
            }}>{stepDone ? (last ? 'К разбору' : 'Следующий шаг →') : 'Ответьте верно на все вопросы шага'}</button>
          </div>
        </div>
      </div>)
  }
  const firstOk = all.filter(({ k }) => s.first[k]).length, hints = Object.keys(s.hints).length
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Разбор</p><h1>{lab.title}</h1>
        <dl className="outcome"><div><dt>Верно с первой попытки</dt><dd className="num">{firstOk}<small> из {all.length}</small></dd></div><div><dt>Открыто подсказок</dt><dd className="num">{hints}</dd></div></dl></header>
      {steps.map((st, si) => (
        <section key={si} className="panel"><h3>{st.title}</h3>
          {st.questions.map((q, qi) => { const k = `${si}.${qi}`; return (
            <article key={k} className={`drow ${s.first[k] ? 'ok' : 'weak'}`}><p className="yours"><VerdictTag v={s.first[k] ? 'ok' : 'weak'} label={s.first[k] ? 'Верно с первой попытки' : s.hints[k] ? 'Решено с подсказкой' : 'Решено со второй попытки'} /> {q.q}</p>
              <p>{q.type === 'num' ? `Ответ: ${fmt(q.answer!, 4)} ${q.unit ?? ''}. ${q.explain ?? ''}` : q.options!.find((o) => o.correct)!.text + ' — ' + q.options!.find((o) => o.correct)!.why}</p></article>) })}
          {st.after && <MdInline text={st.after} />}</section>))}
      <section className="panel story"><h3>О данных</h3><p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn ghost" onClick={reset}>Новая попытка с нуля</button></div>
    </div>)
}
