import { tr, language } from '../shared/locale'
import { useId, useState, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { toggleBookmark, useProgress } from './store'

export const fmt = (x: number, sig = 3) =>
  !isFinite(x) ? '—' : x.toLocaleString(language === 'en' ? 'en-GB' : 'ru-RU', { maximumSignificantDigits: sig, useGrouping: Math.abs(x) >= 10000 })
export function parseNum(input: string) {
  const number = input.trim().replace(/(?<=\d)[ \u00a0\u202f](?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(number) ? Number(number) : NaN
}

export type Verdict = 'ok' | 'weak' | 'wrong'
export const verdictLabel: Record<Verdict, string> = { ok: tr("Обосновано"), weak: tr("Спорно"), wrong: tr("Не подтверждается") }
export const verdictIcon: Record<Verdict, string> = { ok: '✓', weak: '◐', wrong: '✕' }
export function VerdictTag({ v, label }: { v: Verdict; label?: string }) {
  return <span className={`verdict ${v}`}><span aria-hidden>{verdictIcon[v]}</span> {label ?? verdictLabel[v]}</span>
}

export function BookmarkButton({ title, kind }: { title: string; kind: string }) {
  const { pathname } = useLocation()
  const on = useProgress().bookmarks.some((b) => b.path === pathname)
  return (
    <button className={`btn ghost bm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleBookmark(pathname, title, kind)}>
      <span aria-hidden>{on ? '★' : '☆'}</span> {on ? tr("В закладках") : tr("В закладки")}
    </button>
  )
}

// ---------- График ----------
export interface Series { name: string; color: string; dash?: string; points: [number, number][]; dots?: boolean }
interface ChartProps {
  series: Series[]; xLog?: boolean; yLog?: boolean; xDomain: [number, number]; yDomain: [number, number]
  xLabel: string; yLabel: string; height?: number; title: string; desc?: string
  markers?: { x: number; label: string }[]; hlines?: { y: number; label: string }[]; cursor?: number
}
const sup = (n: number) => String(n).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d])
export function Chart(p: ChartProps) {
  const W = 640, H = p.height ?? 340, L = 64, R = 20, T = 18, B = 48
  const id = useId()
  const tx = (v: number) => p.xLog ? Math.log10(v) : v
  const ty = (v: number) => p.yLog ? Math.log10(v) : v
  const [x0, x1] = p.xDomain.map(tx), [y0, y1] = p.yDomain.map(ty)
  const sx = (v: number) => L + ((tx(v) - x0) / (x1 - x0)) * (W - L - R)
  const sy = (v: number) => H - B - ((ty(v) - y0) / (y1 - y0)) * (H - T - B)
  const ticks = (log: boolean | undefined, a: number, b: number) => {
    if (log) { const out = []; for (let e = Math.ceil(a - 1e-9); e <= Math.floor(b + 1e-9); e++) out.push(Math.pow(10, e)); return out }
    const span = b - a, step = Math.pow(10, Math.floor(Math.log10(span / 4)))
    const st = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= 6) ?? step
    const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toPrecision(10)); return out
  }
  const tl = (log: boolean | undefined, v: number) => log ? `10${sup(Math.round(Math.log10(v)))}` : fmt(v, 4)
  const clampY = (v: number) => Math.min(Math.max(v, p.yDomain[0]), p.yDomain[1])
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}t ${id}d`}>
      <title id={`${id}t`}>{p.title}</title>
      <desc id={`${id}d`}>{p.desc ?? `${tr("Ось X: ")}${p.xLabel}${tr(". Ось Y: ")}${p.yLabel}.`}</desc>
      {ticks(p.xLog, x0, x1).map((v) => (
        <g key={'x' + v}><line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} className="grid" />
          <text x={sx(v)} y={H - B + 18} textAnchor="middle" className="tick">{tl(p.xLog, v)}</text></g>))}
      {ticks(p.yLog, y0, y1).map((v) => (
        <g key={'y' + v}><line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="grid" />
          <text x={L - 8} y={sy(v) + 4} textAnchor="end" className="tick">{tl(p.yLog, v)}</text></g>))}
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis" /><line x1={L} x2={L} y1={T} y2={H - B} className="axis" />
      <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="axlabel">{p.xLabel}</text>
      <text transform={`translate(15 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="axlabel">{p.yLabel}</text>
      {p.hlines?.map((h) => (
        <g key={h.label}><line x1={L} x2={W - R} y1={sy(h.y)} y2={sy(h.y)} className="hline" />
          <text x={W - R - 4} y={sy(h.y) - 5} textAnchor="end" className="mlabel">{h.label}</text></g>))}
      {p.markers?.map((m, i) => (
        <g key={m.label}><line x1={sx(m.x)} x2={sx(m.x)} y1={T} y2={H - B} className="marker" />
          <text x={sx(m.x) + 4} y={T + 12 + (i % 3) * 14} className="mlabel">{m.label}</text></g>))}
      {p.series.map((s) => {
        const pts = s.points.filter(([x, y]) => x >= p.xDomain[0] && x <= p.xDomain[1] && isFinite(y) && (!p.yLog || y > 0))
        if (!pts.length) return null
        const last = pts[pts.length - 1]
        return (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth={2.6} strokeDasharray={s.dash} strokeLinejoin="round"
              points={pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(clampY(y)).toFixed(1)}`).join(' ')} />
            {s.dots && pts.map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(clampY(y))} r={4} fill={s.color} />)}
            <text x={Math.min(sx(last[0]) + 5, W - 4)} y={sy(clampY(last[1])) - 6} textAnchor="end" className="slabel" fill={s.color}>{s.name}</text>
          </g>)
      })}
      {p.cursor !== undefined && <line x1={sx(p.cursor)} x2={sx(p.cursor)} y1={T} y2={H - B} className="cursor" />}
    </svg>
  )
}
export const range = (a: number, b: number, n: number, log = false) =>
  Array.from({ length: n }, (_, i) => log ? Math.pow(10, Math.log10(a) + (i / (n - 1)) * (Math.log10(b) - Math.log10(a))) : a + (i / (n - 1)) * (b - a))

export function Slider(p: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; show: string }) {
  const id = useId()
  return (
    <div className="slider">
      <label htmlFor={id}>{p.label}</label><output className="num">{p.show}</output>
      <input id={id} type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(+e.target.value)} />
    </div>
  )
}

// ---------- Вопросы (проверка и перенос) ----------
export interface Question { type: 'mc' | 'num'; q: string; options?: { text: string; correct?: boolean; why: string }[]; answer?: number; tol?: number; unit?: string; explain?: string }
export function QuestionCard({ q, n, value, onAnswer }: { q: Question; n: number; value: any; onAnswer: (v: any) => void }) {
  const [draft, setDraft] = useState('')
  const name = useId()
  if (q.type === 'num') {
    const done = typeof value === 'number'
    const ok = done && Math.abs(value - q.answer!) <= (q.tol ?? 0.05) * Math.abs(q.answer!)
    return (
      <div className="qcard">
        <p className="q"><span className="qn">{n}</span>{q.q}</p>
        <form className="numform" onSubmit={(e) => { e.preventDefault(); const v = parseNum(draft); if (isFinite(v)) onAnswer(v) }}>
          <input inputMode="decimal" aria-label={tr("Ваш ответ")} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tr("Ваш расчёт")} />
          <span className="unit">{q.unit}</span><button className="btn">{tr("Проверить")}</button>
        </form>
        {done && (
          <div className={`fb ${ok ? 'ok' : 'wrong'}`} role="status">
            <VerdictTag v={ok ? 'ok' : 'wrong'} label={ok ? tr("Расчёт сходится") : `${tr("Ваш ответ ")}${fmt(value, 4)}${tr(" — не сходится")}`} />
            {ok ? <p>{q.explain}</p> : <><p>{tr("Проверьте единицы и степень. Можно пересчитать и ввести снова.")}</p>
              <details><summary>{tr("Показать расчёт")}</summary><p>{q.explain}</p></details></>}
          </div>)}
      </div>)
  }
  return (
    <fieldset className="qcard">
      <legend className="q"><span className="qn">{n}</span>{q.q}</legend>
      {q.options!.map((o, i) => {
        const chosen = value === i
        return (
          <label key={i} className={`opt ${chosen ? (o.correct ? 'ok' : 'wrong') : ''}`}>
            <input type="radio" name={name} checked={chosen} onChange={() => onAnswer(i)} />
            <span>{o.text}</span>
            {chosen && <span className="fb-inline" role="status"><VerdictTag v={o.correct ? 'ok' : 'wrong'} label={o.correct ? tr("Верно") : tr("Не так")} /> {o.why}</span>}
          </label>)
      })}
    </fieldset>)
}
export const isCorrect = (q: Question, v: any) =>
  q.type === 'num' ? typeof v === 'number' && Math.abs(v - q.answer!) <= (q.tol ?? 0.05) * Math.abs(q.answer!) : v !== undefined && !!q.options![v]?.correct

export function Quiz({ questions, answers, onAnswer }: { questions: Question[]; answers: Record<number, any>; onAnswer: (i: number, v: any) => void }) {
  const right = questions.filter((q, i) => isCorrect(q, answers[i])).length
  const answered = questions.filter((_, i) => answers[i] !== undefined).length
  return (
    <div className="quiz">
      {questions.map((q, i) => <QuestionCard key={i} q={q} n={i + 1} value={answers[i]} onAnswer={(v) => onAnswer(i, v)} />)}
      <p className="quiz-sum num" role="status">{tr("Отвечено ")}{answered}{tr(" из ")}{questions.length}{tr(" · верно ")}{right}{tr(". Ответ можно изменить — пояснение обновится.")}</p>
    </div>)
}
export function Panel({ title, children, tag }: { title?: string; children: ReactNode; tag?: string }) {
  return <section className="panel">{title && <h3>{tag && <span className="ptag">{tag}</span>}{title}</h3>}{children}</section>
}

/** Кнопка с подтверждением прямо на странице (без системного диалога). */
export function ConfirmButton({ label, ask, onConfirm }: { label: string; ask: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)
  if (!open) return <button className="btn ghost" onClick={() => setOpen(true)}>{label}</button>
  return (
    <span className="confirm" role="group" aria-label={ask}>
      <span className="small">{ask}</span>
      <button className="btn small primary" onClick={() => { setOpen(false); onConfirm() }}>{tr("Да")}</button>
      <button className="btn small ghost" onClick={() => setOpen(false)}>{tr("Нет")}</button>
    </span>)
}
