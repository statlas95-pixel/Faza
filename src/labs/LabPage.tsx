import { ReactNode, useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { labs, labById, topicById, areaLabel, LabMeta } from '../content'
import { MdInline } from '../md'
import { BookmarkButton, Quiz, Question, isCorrect, ConfirmButton } from '../ui'
import { getProgress, saveLab, clearLab, finishLab, useProgress } from '../store'
import { useTitle } from '../pages/util'
import { recordTransfer, useLearning, skillsOfLab } from '../learning'
import { LevelBar, StepCard } from '../pages/Learning'
import { LEVELS } from '../../shared/mastery'
import Investigation from './Investigation'
import StabilityBench from './StabilityBench'
import ScaleUp from './ScaleUp'
import RheoCabinet from './RheoCabinet'
import SaltDosing from './SaltDosing'
import DoePlan from './DoePlan'
import Worksheet from './Worksheet'

export function LabsIndex() {
  useTitle('Занятия')
  const p = useProgress()
  return (
    <div className="page">
      <h1>Интерактивные занятия</h1>
      <p className="lead">В каждом занятии у вас есть роль, рабочие материалы и решение, от которого зависит результат. Прогресс сохраняется — можно прерваться и вернуться.</p>
      <div className="cards">
        {labs.map((l) => (
          <Link key={l.id} to={`/labs/${l.id}`} className={`card lab wide ${l.transferOf ? 'transfer' : ''}`}>
            <span className="dom">{l.transferOf ? `Перенос к занятию «${labById(l.transferOf)?.title}»` : l.role}</span>
            <h3>{l.title}</h3><p>{l.summary}</p>
            <p className="small"><b>Навык:</b> {l.skill}</p>
            <span className="meta num">{l.minutes} мин · {areaLabel[l.area]}
              {p.labDone[l.id] ? ` · пройдено, попыток: ${p.labDone[l.id].attempts}` : p.labs[l.id] ? ' · начато' : ''}</span>
          </Link>))}
      </div>
    </div>)
}

/** Состояние занятия с автосохранением в localStorage. */
export function useLabState<T extends object>(id: string, init: () => T): [T, (fn: (s: T) => void) => void, () => void] {
  const [s, setS] = useState<T>(() => ({ ...init(), ...(getProgress().labs[id] ?? {}) }))
  const set = useCallback((fn: (s: T) => void) => {
    setS((prev) => { const next = JSON.parse(JSON.stringify(prev)); fn(next); saveLab(id, next); return next })
  }, [id])
  const reset = useCallback(() => { clearLab(id); setS(init()); window.scrollTo(0, 0) }, [id])
  return [s, set, reset]
}

export function LabFrame(p: { lab: LabMeta; steps: string[]; step: number; debrief: boolean; children: ReactNode; onRestart: () => void }) {
  useEffect(() => {
    document.body.dataset.mode = p.debrief ? 'debrief' : 'focus'
    return () => { document.body.dataset.mode = 'explore' }
  }, [p.debrief])
  return (
    <div className="lab">
      <header className="labbar">
        <Link to="/labs" className="exit" aria-label="Выйти из занятия к списку занятий">← Занятия</Link>
        <div className="labtitle"><span className="role">{p.lab.role}</span><b>{p.lab.title}</b></div>
        <ol className="stepper" aria-label="Этапы занятия">
          {p.steps.map((s, i) => <li key={s} className={i === p.step ? 'on' : i < p.step ? 'done' : ''} aria-current={i === p.step ? 'step' : undefined}><span className="dot" aria-hidden>{i < p.step ? '✓' : i + 1}</span><span className="lbl">{s}</span></li>)}
        </ol>
        <div className="labtools"><BookmarkButton title={p.lab.title} kind="Занятие" />
          <ConfirmButton label="Заново" ask="Удалить текущие действия?" onConfirm={p.onRestart} /></div>
      </header>
      <div className="labbody">{p.children}</div>
    </div>)
}

export function Brief({ lab, onStart, resumed }: { lab: LabMeta; onStart: () => void; resumed?: boolean }) {
  return (
    <div className="brief">
      <p className="eyebrow">Ваша роль: {lab.role} · {lab.minutes} мин</p>
      <h1>{lab.title}</h1>
      <div className="brief-grid">
        <section><h2>Ситуация</h2><MdInline text={lab.brief.situation} /></section>
        <section><h2>Цель</h2><MdInline text={lab.brief.goal} /><h2>Условия</h2><MdInline text={lab.brief.constraints} /></section>
      </div>
      <p className="skillline"><b>Что вы сможете показать после занятия:</b> {lab.skill}</p>
      <p className="datanote"><b>О данных:</b> {lab.dataNote}</p>
      <div className="row">
        <button className="btn primary" onClick={onStart}>{resumed ? 'Продолжить' : 'Приступить'}</button>
        <span className="small">Опирается на темы: {lab.topics.map((t: string) => topicById(t)).filter(Boolean).map((t: any, i: number) => <span key={t.id}>{i > 0 && ', '}<Link to={`/topics/${t.id}`}>{t.title}</Link></span>)}</span>
      </div>
    </div>)
}

/** Блок переноса: вопросы с расчётом в изменившихся условиях. */
export function Transfer({ lab, answers, onAnswer }: { lab: LabMeta; answers: Record<number, any>; onAnswer: (i: number, v: any) => void }) {
  const t = lab.transfer
  if (!t?.questions) return null
  const qs = t.questions as Question[]
  const right = qs.filter((q, i) => isCorrect(q, answers[i])).length
  return (
    <section className="transfer">
      <p className="eyebrow">Перенос принципа</p>
      <h2>{t.title}</h2>
      <MdInline text={t.intro} />
      <Quiz questions={qs} answers={answers} onAnswer={(i, v) => { onAnswer(i, v); const a = { ...answers, [i]: v }; if (qs.every((_, k) => a[k] !== undefined)) recordTransfer(lab.id, qs.every((q, k) => isCorrect(q, a[k]))) }} />
      {Object.keys(answers).length === qs.length && <p className="transfer-sum" role="status">{right === qs.length ? 'Принцип перенесён: все ответы сходятся.' : `Сходится ${right} из ${qs.length}. Вернитесь к вопросам с пометкой «не так» — ответ можно изменить.`}</p>}
    </section>)
}

export function DebriefLinks({ lab }: { lab: LabMeta }) {
  const L = useLearning()
  const sks = skillsOfLab(lab.id)
  const last = L.p.attempts.find((t) => t.labId === lab.id)
  const next = L.route.find((r) => r.status === 'now')
  return (
    <>
      <section className="panel skillupd"><h3>Что это занятие говорит о ваших навыках</h3>
        {sks.map((sk) => { const s = L.states[sk.id]; return (
          <div key={sk.id} className="skillrow"><div><b>{sk.name}</b><p className="small">{LEVELS[s.level].text}{last?.detail?.hints ? ` В этой попытке запрошено подсказок: ${last.detail.hints} — поэтому она засчитана как решение с опорой.` : ''}{s.level === 3 ? ' Чтобы подтвердить перенос, решите блок переноса выше.' : s.level === 2 ? ' До самостоятельного уровня — попытка без подсказок с результатом не ниже 80 %.' : ''}</p></div><LevelBar s={s} /></div>) })}
        {last?.detail?.score !== undefined && <p className="small num">Результат попытки: {Math.round(last.detail.score * 100)} %. Повтор той же попытки уровень не меняет; новая попытка учитывается отдельно, но уверенность оценки растёт только от независимых свидетельств.</p>}
      </section>
      {next ? <section className="panel"><h3>Следующий шаг по вашему маршруту</h3><StepCard r={next} main /></section>
        : !L.goal ? <section className="panel"><h3>Следующий шаг</h3><p>Выберите цель — платформа соберёт маршрут с учётом этого результата.</p><Link className="btn primary" to="/route">Собрать мой маршрут</Link></section> : null}
      <section className="panel"><h3>Открыть теорию по спорным местам</h3>
        <ul className="linklist">{lab.topics.map((t: string) => topicById(t)).filter(Boolean).map((t: any) => <li key={t.id}><Link to={`/topics/${t.id}`}>{t.title}</Link> — {t.summary}</li>)}</ul>
      </section>
    </>)
}

export function markFinished(id: string, summary: string, detail?: any, score?: number) { finishLab(id, summary, detail, score) }

export function LabPage() {
  const { id = '' } = useParams()
  const lab = labById(id)
  useTitle(lab?.title ?? 'Занятие не найдено')
  if (!lab) return <div className="page"><h1>Занятие не найдено</h1><Link to="/labs">К занятиям</Link></div>
  const E = { investigation: Investigation, stability: StabilityBench, scaleup: ScaleUp, rheo: RheoCabinet, salt: SaltDosing, doe: DoePlan, worksheet: Worksheet }[lab.engine as string]
  if (!E) return <div className="page"><h1>Неизвестный тип занятия: {lab.engine}</h1></div>
  return <E key={lab.id} lab={lab} />
}
