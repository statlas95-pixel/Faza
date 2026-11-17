import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LabMeta, labById } from '../content'
import { MdInline, Md } from '../md'
import { VerdictTag, Verdict } from '../ui'
import { LabFrame, Brief, useLabState, DebriefLinks, markFinished, Transfer } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'conclude' | 'debrief'
  view: string; opened: Record<string, boolean>; marks: Record<string, boolean>; bought: string[]
  hyp: Record<string, string>; disp?: string; capa: string[]; missing?: string; zoom: number; plain: boolean; finished?: boolean; tq?: Record<number, any>
}
const STATUS: Record<string, string> = { main: 'Основная причина', contrib: 'Возможный вклад', excluded: 'Исключена данными', untested: 'Не проверена' }
const Cell = ({ v }: { v: string }) => v?.startsWith?.('~') ? <span className="hand">{v.slice(1)}</span> : <>{v}</>
const plainCell = (v: string) => (v?.startsWith?.('~') ? `${v.slice(1)} (от руки)` : v)

export default function Investigation({ lab }: { lab: LabMeta }) {
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', view: lab.documents[0].id, opened: {}, marks: {}, bought: [], hyp: {}, capa: [], zoom: 1, plain: false }))
  const [warn, setWarn] = useState('')
  const docs = lab.documents as any[], reqs = lab.requests as any[], hyps = lab.hypotheses as any[]
  const spent = s.bought.reduce((a, id) => a + reqs.find((r) => r.id === id).cost, 0), left = lab.budget - spent
  const rowKey = (d: any, si: number, ri: number, row: any) => row.id ?? `${d.id}#${si}.${ri}`
  // подписи для всех возможных оснований
  const labelOf: Record<string, string> = {}
  docs.forEach((d) => {
    d.sections.forEach((sec: any, si: number) => sec.rows.forEach((row: any, ri: number) => {
      labelOf[rowKey(d, si, ri, row)] = `${d.short}: ${row.cells.slice(0, 2).map(plainCell).filter((c: string) => c && c !== '—').join(' — ')}`
    }))
    d.notes?.forEach((n: any) => { labelOf[n.id] = `${d.short}: ${n.where.toLowerCase()}` })
  })
  reqs.forEach((r) => { labelOf[r.id] = `Запрос: ${r.title}` })
  const E = new Set([...Object.keys(s.marks).filter((k) => s.marks[k]), ...s.bought])
  const steps = ['Вводная', 'Материалы', 'Вывод', 'Разбор']
  const stepIdx = { brief: 0, work: 1, conclude: 2, debrief: 3 }[s.phase]
  const frame = (children: React.ReactNode) => <LabFrame lab={lab} steps={steps} step={stepIdx} debrief={s.phase === 'debrief'} onRestart={reset}>{children}</LabFrame>

  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={Object.keys(s.opened).length > 0} onStart={() => set((x) => { x.phase = 'work'; x.opened[x.view] = true })} />)

  // ---------- Работа с материалами ----------
  if (s.phase === 'work') {
    const doc = docs.find((d) => d.id === s.view), req = reqs.find((r) => r.id === s.view)
    const marked = Object.keys(s.marks).filter((k) => s.marks[k])
    const MarkBtn = ({ k }: { k: string }) => (
      <button className={`mark ${s.marks[k] ? 'on' : ''}`} aria-pressed={!!s.marks[k]} title="Отметить запись как значимую"
        onClick={() => set((x) => { x.marks[k] = !x.marks[k] })}><span aria-hidden>{s.marks[k] ? '⚑' : '⚐'}</span><span className="sr">{s.marks[k] ? 'Снять отметку' : 'Отметить запись'}</span></button>)
    return frame(
      <div className="inv">
        <nav className="inv-side" aria-label="Материалы дела">
          <h2>Документы</h2>
          <ul>{docs.map((d) => (
            <li key={d.id}><button className={s.view === d.id ? 'on' : ''} aria-current={s.view === d.id} onClick={() => set((x) => { x.view = d.id; x.opened[d.id] = true })}>
              <span className="docico" aria-hidden>▤</span>{d.title}{!s.opened[d.id] && <span className="new">не открыт</span>}</button></li>))}</ul>
          <h2>Запросы <span className="budget num" aria-label={`Осталось ресурса: ${left} из ${lab.budget}`}>{'●'.repeat(Math.max(left, 0))}{'○'.repeat(spent)} {left}/{lab.budget}</span></h2>
          <ul>{reqs.map((r) => {
            const has = s.bought.includes(r.id)
            return (
              <li key={r.id}><button className={`${s.view === r.id ? 'on' : ''} ${has ? 'got' : ''}`} onClick={() => set((x) => { x.view = r.id })}>
                <span className="docico" aria-hidden>{has ? '✉' : '＋'}</span>{r.title}<span className="cost num">{has ? 'получено' : `${r.cost} ед.`}</span></button></li>)
          })}</ul>
          <h2>Мои отметки <span className="num">({marked.length})</span></h2>
          {marked.length ? <ul className="marks">{marked.map((k) => <li key={k}><span>{labelOf[k]}</span><button aria-label="Снять отметку" onClick={() => set((x) => { delete x.marks[k] })}>×</button></li>)}</ul>
            : <p className="small dim">Нажимайте ⚐ у записей, которые считаете значимыми. На них будут опираться выводы.</p>}
          <button className="btn primary wide" onClick={() => set((x) => { x.phase = 'conclude' })}>Перейти к выводам →</button>
        </nav>
        <section className="inv-view" aria-live="polite">
          {doc && (
            <>
              <div className="doc-tools">
                <span className="origin"><b>Происхождение:</b> {doc.origin}</span>
                <span className="grow" />
                <button className="btn ghost small" onClick={() => set((x) => { x.zoom = Math.max(0.85, +(x.zoom - 0.15).toFixed(2)) })} aria-label="Уменьшить">A−</button>
                <button className="btn ghost small" onClick={() => set((x) => { x.zoom = Math.min(1.6, +(x.zoom + 0.15).toFixed(2)) })} aria-label="Увеличить">A+</button>
                <button className="btn ghost small" aria-pressed={s.plain} onClick={() => set((x) => { x.plain = !x.plain })}>{s.plain ? 'Вид документа' : 'Текстовая расшифровка'}</button>
              </div>
              {s.plain ? (
                <div className="plain">
                  <h2>{doc.title} — расшифровка</h2>
                  <ul>{doc.header.map((h: string[]) => <li key={h[0]}>{h[0]}: {plainCell(h[1])}</li>)}</ul>
                  {doc.sections.map((sec: any, si: number) => (
                    <div key={si}><h3>{sec.title}</h3>
                      <ol>{sec.rows.map((row: any, ri: number) => {
                        const k = rowKey(doc, si, ri, row)
                        return <li key={ri}>{row.cells.map((c: string, ci: number) => c ? `${sec.columns[ci] ?? ''}: ${plainCell(c)}` : '').filter(Boolean).join('; ')} <MarkBtn k={k} /></li>
                      })}</ol></div>))}
                  {doc.notes?.map((n: any) => <p key={n.id}>{n.where}: «{n.hand}» (от руки) <MarkBtn k={n.id} /></p>)}
                  {doc.footer && <ul>{doc.footer.map((h: string[]) => <li key={h[0]}>{h[0]}: {plainCell(h[1])}</li>)}</ul>}
                </div>
              ) : (
                <div className="paper" style={{ fontSize: `${s.zoom}em` }}>
                  <div className="paper-head">
                    <h2>{doc.title}</h2>
                    <dl>{doc.header.map((h: string[]) => <div key={h[0]}><dt>{h[0]}</dt><dd><Cell v={h[1]} /></dd></div>)}</dl>
                  </div>
                  {doc.sections.map((sec: any, si: number) => (
                    <div key={si} className="paper-sec">
                      <h3>{sec.title}</h3>
                      <div className="paper-scroll" tabIndex={0}>
                        <table><thead><tr>{sec.columns.map((c: string) => <th key={c} scope="col">{c}</th>)}<th className="mk"><span className="sr">Отметка</span></th></tr></thead>
                          <tbody>{sec.rows.map((row: any, ri: number) => {
                            const k = rowKey(doc, si, ri, row)
                            return <tr key={ri} className={s.marks[k] ? 'marked' : ''}>{row.cells.map((c: string, ci: number) => <td key={ci}><Cell v={c} /></td>)}<td className="mk"><MarkBtn k={k} /></td></tr>
                          })}</tbody></table>
                      </div>
                    </div>))}
                  {doc.notes?.map((n: any) => (
                    <div key={n.id} className={`margin-note ${s.marks[n.id] ? 'marked' : ''}`}><span className="where">{n.where}</span><span className="hand">{n.hand}</span><MarkBtn k={n.id} /></div>))}
                  {doc.footer && <dl className="paper-foot">{doc.footer.map((h: string[]) => <div key={h[0]}><dt>{h[0]}</dt><dd><Cell v={h[1]} /></dd></div>)}</dl>}
                  <p className="stamp" aria-hidden>УЧЕБНЫЙ ДОКУМЕНТ</p>
                </div>)}
            </>)}
          {req && (
            <div className="memo">
              <p className="eyebrow">Запрос · {req.who}</p>
              <h2>{req.title}</h2>
              <p className="num">Стоимость: {req.cost} ед. ресурса · {req.lead}</p>
              {s.bought.includes(req.id)
                ? <div className="memo-result"><h3>Ответ</h3><MdInline text={req.result} /></div>
                : left >= req.cost
                  ? <><p>Результат станет доступен сразу, но ресурс вернуть нельзя. Осталось: {left} ед.</p>
                    <button className="btn primary" onClick={() => set((x) => { x.bought.push(req.id) })}>Запросить за {req.cost} ед.</button></>
                  : <p className="warnline">Ресурса не хватает: нужно {req.cost}, осталось {left}. Это ограничение — часть задачи: выбирайте наблюдения, которые различают гипотезы.</p>}
            </div>)}
        </section>
      </div>)
  }

  // ---------- Формулировка вывода ----------
  const resolveDisp = (d: any) => {
    const v = d.variants?.find((va: any) => va.when.every((w: string) => w.startsWith('main:') ? s.hyp[w.slice(5)] === 'main' : E.has(w)))
    return v ?? d
  }
  if (s.phase === 'conclude') {
    const submit = () => {
      const miss = hyps.filter((h) => !s.hyp[h.id]).length
      if (miss || !s.disp) { setWarn(`Не заполнено: ${miss ? `статус у ${miss} гипотез` : ''}${miss && !s.disp ? ' и ' : ''}${!s.disp ? 'решение по партии' : ''}.`); return }
      setWarn('')
      set((x) => { x.phase = 'debrief'; x.finished = true })
      const sc = score()
      markFinished(lab.id, sc.map((c) => `${c.title}: ${c.level}`).join('; '), { bought: s.bought, hyp: s.hyp, disp: s.disp }, sc.reduce((a, c) => a + c.value, 0) / sc.length)
      window.scrollTo(0, 0)
    }
    return frame(
      <div className="conclude">
        <div className="conclude-head">
          <h1>Ваши выводы</h1>
          <button className="btn ghost" onClick={() => set((x) => { x.phase = 'work' })}>← Вернуться к материалам</button>
        </div>
        <details className="rubric" open><summary>Критерии, по которым будет разобрано решение</summary>
          <ul>{lab.rubric.map((r: any) => <li key={r.id}><b>{r.title}.</b> {r.text}</li>)}</ul>
          <p className="small">Вывод, совпавший с разбором, но не подкреплённый вашими отметками или запросами, засчитывается как «без основания». У вас отмечено записей: {Object.values(s.marks).filter(Boolean).length}, получено запросов: {s.bought.length}.</p></details>
        <section className="panel"><h3><span className="ptag">1</span>Статус каждой гипотезы</h3>
          <div className="hyps">
            {hyps.map((h) => (
              <fieldset key={h.id} className="hyp"><legend>{h.title}</legend>
                <div className="seg">{Object.entries(STATUS).map(([k, l]) => (
                  <label key={k} className={s.hyp[h.id] === k ? 'on' : ''}><input type="radio" name={`h-${h.id}`} checked={s.hyp[h.id] === k} onChange={() => set((x) => { x.hyp[h.id] = k })} />{l}</label>))}</div>
              </fieldset>))}
          </div></section>
        <section className="panel"><h3><span className="ptag">2</span>Решение по партии</h3>
          <div className="choices">{lab.dispositions.map((d: any) => (
            <label key={d.id} className={`choice ${s.disp === d.id ? 'on' : ''}`}><input type="radio" name="disp" checked={s.disp === d.id} onChange={() => set((x) => { x.disp = d.id })} /><span>{d.title}</span></label>))}</div></section>
        <section className="panel"><h3><span className="ptag">3</span>Меры, чтобы не повторилось <span className="small">— не более {lab.capaMax}</span></h3>
          <div className="choices">{lab.capa.map((c: any) => {
            const on = s.capa.includes(c.id), full = s.capa.length >= lab.capaMax
            return <label key={c.id} className={`choice ${on ? 'on' : ''} ${!on && full ? 'dis' : ''}`}><input type="checkbox" checked={on} disabled={!on && full}
              onChange={() => set((x) => { x.capa = on ? x.capa.filter((i) => i !== c.id) : [...x.capa, c.id] })} /><span>{c.title}</span></label>
          })}</div></section>
        <section className="panel"><h3><span className="ptag">4</span>Чего не хватает</h3>
          <p>Какое одно дополнительное наблюдение сильнее всего могло бы изменить или укрепить ваш вывод?</p>
          <select value={s.missing ?? ''} onChange={(e) => set((x) => { x.missing = e.target.value || undefined })} aria-label="Недостающее наблюдение">
            <option value="">— не выбрано —</option>
            {reqs.map((r) => <option key={r.id} value={r.id}>{r.title}{s.bought.includes(r.id) ? ' (уже получено)' : ''}</option>)}
            <option value="none">Данных достаточно, ничего не нужно</option>
          </select></section>
        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button className="btn primary" onClick={submit}>Отправить на разбор</button>
      </div>)
  }

  // ---------- Разбор ----------
  function evalHyp(h: any) {
    const st = h.statuses[s.hyp[h.id]]
    const had = (st.needs ?? []).filter((n: string) => E.has(n))
    const basis = !st.needs || had.length > 0
    const pts = st.verdict === 'ok' ? (basis ? 2 : 1) : st.verdict === 'weak' ? 1 : 0
    const okNeeds: string[] = [...new Set(Object.values(h.statuses).filter((x: any) => x.verdict === 'ok').flatMap((x: any) => x.needs ?? []))] as string[]
    return { st, had, basis, pts, text: basis ? st.text : st.noBasis ?? st.text, lacking: okNeeds.filter((n) => !E.has(n)) }
  }
  function score() {
    const lvl = (r: number) => (r >= 0.85 ? 'уверенно' : r >= 0.5 ? 'частично' : 'требует пересмотра')
    const grp = (g: string) => { const hs = hyps.filter((h) => h.group === g); return hs.reduce((a, h) => a + evalHyp(h).pts, 0) / (2 * hs.length) }
    const d = resolveDisp(lab.dispositions.find((x: any) => x.id === s.disp))
    const dv = d.verdict === 'ok' ? 1 : d.verdict === 'weak' ? 0.5 : 0
    const cs = s.capa.map((id) => lab.capa.find((c: any) => c.id === id))
    const cv = Math.max(0, Math.min(1, cs.reduce((a, c) => a + (c.verdict === 'ok' ? 1 : c.verdict === 'weak' ? 0.4 : -1), 0) / Math.min(lab.capaMax, lab.capa.filter((c: any) => c.verdict === 'ok').length)))
    const val: Record<string, number> = { measurement: grp('measurement'), cause: grp('cause'), disposition: dv, capa: cv }
    return (lab.rubric as any[]).map((r) => ({ ...r, value: val[r.id], level: lvl(val[r.id]) }))
  }
  const sc = score()
  const disp = lab.dispositions.find((x: any) => x.id === s.disp), dres = resolveDisp(disp)
  const unopened = docs.filter((d) => !s.opened[d.id])
  const allNeeds = new Set(hyps.flatMap((h) => Object.values(h.statuses).flatMap((x: any) => x.needs ?? [])))
  const marked = Object.keys(s.marks).filter((k) => s.marks[k])
  const relevant = marked.filter((k) => allNeeds.has(k))
  const miss = s.missing && s.missing !== 'none' ? reqs.find((r) => r.id === s.missing) : null
  const transfer = lab.transfer ? labById(lab.transfer) : null
  return frame(
    <div className="debrief">
      <header className="debrief-head">
        <p className="eyebrow">Разбор решения</p>
        <h1>{lab.title}</h1>
        <div className="scores">{sc.map((c) => (
          <div key={c.id} className="score"><span className="st">{c.title}</span>
            <div className="bar" role="img" aria-label={`${c.title}: ${c.level}`}><span style={{ width: `${Math.max(c.value * 100, 4)}%` }} /></div>
            <b>{c.level}</b><span className="small">{c.text}</span></div>))}</div>
      </header>

      <section className="panel"><h3>Что вы сделали</h3>
        <ul className="facts">
          <li>Открыто документов: <b className="num">{docs.length - unopened.length} из {docs.length}</b>{unopened.length > 0 && <> — не открыты: {unopened.map((d) => d.title).join('; ')}</>}</li>
          <li>Отмечено записей: <b className="num">{marked.length}</b>, из них используются в разборе как основания: <b className="num">{relevant.length}</b>{relevant.length > 0 && <> ({relevant.map((k) => labelOf[k]).join('; ')})</>}</li>
          <li>Запросы ({spent} из {lab.budget} ед.): {s.bought.length ? s.bought.map((id) => reqs.find((r) => r.id === id).title).join('; ') : 'не запрашивались'}</li>
        </ul></section>

      <section className="panel"><h3>Гипотезы: ваш статус и основания</h3>
        {hyps.map((h) => {
          const e = evalHyp(h)
          const v: Verdict = e.st.verdict === 'ok' && !e.basis ? 'weak' : e.st.verdict
          return (
            <article key={h.id} className={`drow ${v}`}>
              <h4>{h.title}</h4>
              <p className="yours">Ваш статус: <b>{STATUS[s.hyp[h.id]]}</b> <VerdictTag v={v} label={e.st.verdict === 'ok' && !e.basis ? 'Верно, но без основания' : undefined} /></p>
              <p>{e.text}</p>
              {e.had.length > 0 && <p className="small"><b>На что вы опирались:</b> {e.had.map((n: string) => labelOf[n]).join('; ')}.</p>}
              {e.lacking.length > 0 && <p className="small"><b>Наблюдения, которых у вас не было и которые относятся к этой гипотезе:</b> {e.lacking.map((n) => labelOf[n]).join('; ')}.</p>}
            </article>)
        })}</section>

      <section className="panel"><h3>Решение по партии</h3>
        <article className={`drow ${dres.verdict}`}><h4>{disp.title}</h4><p className="yours"><VerdictTag v={dres.verdict} /></p><p>{dres.text}</p>
          {disp.variants && dres === disp && <p className="small">Оценка этого решения зависит от ваших выводов и данных: при других основаниях она была бы иной.</p>}</article></section>

      <section className="panel"><h3>Меры</h3>
        {s.capa.length === 0 && <p>Вы не выбрали ни одной меры. Расследование без предупреждающих действий оставляет условия для повторения.</p>}
        {s.capa.map((id) => lab.capa.find((c: any) => c.id === id)).map((c: any) => (
          <article key={c.id} className={`drow ${c.verdict}`}><h4>{c.title}</h4><p className="yours"><VerdictTag v={c.verdict} /></p><p>{c.text}</p></article>))}
        <details><summary>Меры, которые вы не выбрали</summary>
          {lab.capa.filter((c: any) => !s.capa.includes(c.id)).map((c: any) => <p key={c.id} className="small"><VerdictTag v={c.verdict} /> <b>{c.title}.</b> {c.text}</p>)}</details></section>

      <section className="panel"><h3>Чего не хватало</h3>
        {miss ? <article className={`drow ${miss.value === 'high' ? 'ok' : miss.value === 'mid' ? 'weak' : 'wrong'}`}><h4>{miss.title}</h4>
          <p>{miss.valueText}</p>{s.bought.includes(miss.id) && <p className="small">Вы уже получили это наблюдение — значит, считаете его ключевым для своего вывода.</p>}</article>
          : s.missing === 'none' ? <p>Вы сочли данные достаточными. Сравните с перечнем «наблюдений, которых у вас не было» у каждой гипотезы выше.</p>
            : <p>Вы не указали недостающее наблюдение. Самые различающие в этом случае:</p>}
        <details open={!miss}><summary>Ценность каждого запроса</summary>
          {reqs.map((r) => <p key={r.id} className="small"><VerdictTag v={r.value === 'high' ? 'ok' : r.value === 'mid' ? 'weak' : 'wrong'} label={r.value === 'high' ? 'Различающее' : r.value === 'mid' ? 'Уточняющее' : 'Малополезное'} /> <b>{r.title}.</b> {r.valueText}</p>)}</details></section>

      <section className="panel story"><h3>Что было на самом деле и какой принцип за этим стоит</h3>
        <Md text={lab.debrief.story} className="prose small" /><Md text={lab.debrief.principle} className="prose small" /></section>

      {lab.transferQuiz && <Transfer lab={{ ...lab, transfer: lab.transferQuiz }} answers={s.tq ?? {}} onAnswer={(i, v) => set((x) => { (x.tq ??= {})[i] = v })} />}
      <DebriefLinks lab={lab} />
      <div className="row end">
        <button className="btn" onClick={() => set((x) => { x.phase = 'conclude' })}>Пересмотреть выводы</button>
        <button className="btn ghost" onClick={() => set((x) => { x.phase = 'work' })}>Вернуться к материалам</button>
        <button className="btn ghost" onClick={reset}>Новая попытка с нуля</button>
        {transfer && <Link className="btn primary" to={`/labs/${transfer.id}`}>Применить в новой ситуации: {transfer.title} →</Link>}
      </div>
    </div>)
}
