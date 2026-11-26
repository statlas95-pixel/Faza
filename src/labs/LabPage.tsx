import { tr } from '../../shared/locale'
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
import GmpTrainer from './GmpTrainer'
import BranchingSim from './BranchingSim'
import ShiftTrend from './ShiftTrend'
import CoaAudit from './CoaAudit'
import LabelAudit from './LabelAudit'
import ReactorSim from './ReactorSim'
import ReverseInci from './ReverseInci'
import ChallengeTest from './ChallengeTest'
import PhTitrationSim from './PhTitrationSim'
import { PackCompatSim, SpfFormulatorSim, WpuBiofilmSim, StabilityTriageSim } from './PackageFTrainers'

export function LabsIndex() {
  useTitle(tr("Занятия"))
  const p = useProgress()
  return (
    <div className="page">
      <h1>{tr("Интерактивные занятия")}</h1>
      <p className="lead">{tr("В каждом занятии у вас есть роль, рабочие материалы и решение, от которого зависит результат. Прогресс сохраняется — можно прерваться и вернуться.")}</p>
      <div className="cards">
        {labs.map((l) => (
          <Link key={l.id} to={`/labs/${l.id}`} className={`card lab wide ${l.transferOf ? 'transfer' : ''}`}>
            <span className="dom">{l.transferOf ? `${tr("Перенос к занятию «")}${labById(l.transferOf)?.title}»` : l.role}</span>
            <h3>{l.title}</h3><p>{l.summary}</p>
            <p className="small"><b>{tr("Навык:")}</b> {l.skill}</p>
            <span className="meta num">{l.minutes}{tr(" мин · ")}{areaLabel[l.area]}
              {p.labDone[l.id] ? `${tr(" · пройдено, попыток: ")}${p.labDone[l.id].attempts}` : p.labs[l.id] ? tr(" · начато") : ''}</span>
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
        <Link to="/labs" className="exit" aria-label={tr("Выйти из занятия к списку занятий")}>{tr("← Занятия")}</Link>
        <div className="labtitle"><span className="role">{p.lab.role}</span><b>{p.lab.title}</b></div>
        <ol className="stepper" aria-label={tr("Этапы занятия")}>
          {p.steps.map((s, i) => <li key={s} className={i === p.step ? 'on' : i < p.step ? 'done' : ''} aria-current={i === p.step ? 'step' : undefined}><span className="dot" aria-hidden>{i < p.step ? '✓' : i + 1}</span><span className="lbl">{s}</span></li>)}
        </ol>
        <div className="labtools"><BookmarkButton title={p.lab.title} kind={tr("Занятие")} />
          <ConfirmButton label={tr("Заново")} ask={tr("Удалить текущие действия?")} onConfirm={p.onRestart} /></div>
      </header>
      <div className="labbody">{p.children}</div>
    </div>)
}

export function Brief({ lab, onStart, resumed }: { lab: LabMeta; onStart: () => void; resumed?: boolean }) {
  return (
    <div className="brief">
      <p className="eyebrow">{tr("Ваша роль: ")}{lab.role} · {lab.minutes}{tr(" мин")}</p>
      <h1>{lab.title}</h1>
      <div className="brief-grid">
        <section><h2>{tr("Ситуация")}</h2><MdInline text={lab.brief.situation} /></section>
        <section><h2>{tr("Цель")}</h2><MdInline text={lab.brief.goal} /><h2>{tr("Условия")}</h2><MdInline text={lab.brief.constraints} /></section>
      </div>
      <p className="skillline"><b>{tr("Что вы сможете показать после занятия:")}</b> {lab.skill}</p>
      <p className="datanote"><b>{tr("О данных:")}</b> {lab.dataNote}</p>
      <div className="row">
        <button className="btn primary" onClick={onStart}>{resumed ? tr("Продолжить") : tr("Приступить")}</button>
        <span className="small">{tr("Опирается на темы: ")}{lab.topics.map((t: string) => topicById(t)).filter(Boolean).map((t: any, i: number) => <span key={t.id}>{i > 0 && ', '}<Link to={`/topics/${t.id}`}>{t.title}</Link></span>)}</span>
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
      <p className="eyebrow">{tr("Перенос принципа")}</p>
      <h2>{t.title}</h2>
      <MdInline text={t.intro} />
      <Quiz questions={qs} answers={answers} onAnswer={(i, v) => { onAnswer(i, v); const a = { ...answers, [i]: v }; if (qs.every((_, k) => a[k] !== undefined)) recordTransfer(lab.id, qs.every((q, k) => isCorrect(q, a[k]))) }} />
      {Object.keys(answers).length === qs.length && <p className="transfer-sum" role="status">{right === qs.length ? tr("Принцип перенесён: все ответы сходятся.") : `${tr("Сходится ")}${right}${tr(" из ")}${qs.length}${tr(". Вернитесь к вопросам с пометкой «не так» — ответ можно изменить.")}`}</p>}
    </section>)
}

export function DebriefLinks({ lab }: { lab: LabMeta }) {
  const L = useLearning()
  const sks = skillsOfLab(lab.id)
  const last = L.p.attempts.find((t) => t.labId === lab.id)
  const next = L.route.find((r) => r.status === 'now')
  return (
    <>
      <section className="panel skillupd"><h3>{tr("Что это занятие говорит о ваших навыках")}</h3>
        {sks.map((sk) => { const s = L.states[sk.id]; return (
          <div key={sk.id} className="skillrow"><div><b>{sk.name}</b><p className="small">{LEVELS[s.level].text}{last?.detail?.hints ? `${tr(" В этой попытке запрошено подсказок: ")}${last.detail.hints}${tr(" — поэтому она засчитана как решение с опорой.")}` : ''}{s.level === 3 ? tr(" Чтобы подтвердить перенос, решите блок переноса выше.") : s.level === 2 ? tr(" До самостоятельного уровня — попытка без подсказок с результатом не ниже 80 %.") : ''}</p></div><LevelBar s={s} /></div>) })}
        {last?.detail?.score !== undefined && <p className="small num">{tr("Результат попытки: ")}{Math.round(last.detail.score * 100)}{tr(" %. Повтор той же попытки уровень не меняет; новая попытка учитывается отдельно, но уверенность оценки растёт только от независимых свидетельств.")}</p>}
      </section>
      {next ? <section className="panel"><h3>{tr("Следующий шаг по вашему маршруту")}</h3><StepCard r={next} main /></section>
        : !L.goal ? <section className="panel"><h3>{tr("Следующий шаг")}</h3><p>{tr("Выберите цель — платформа соберёт маршрут с учётом этого результата.")}</p><Link className="btn primary" to="/route">{tr("Собрать мой маршрут")}</Link></section> : null}
      <section className="panel"><h3>{tr("Открыть теорию по спорным местам")}</h3>
        <ul className="linklist">{lab.topics.map((t: string) => topicById(t)).filter(Boolean).map((t: any) => <li key={t.id}><Link to={`/topics/${t.id}`}>{t.title}</Link> — {t.summary}</li>)}</ul>
      </section>
    </>)
}

export function markFinished(id: string, summary: string, detail?: any, score?: number) { finishLab(id, summary, detail, score) }

export function LabPage() {
  const { id = '' } = useParams()
  const lab = labById(id)
  useTitle(lab?.title ?? tr("Занятие не найдено"))
  if (!lab) return <div className="page"><h1>{tr("Занятие не найдено")}</h1><Link to="/labs">{tr("К занятиям")}</Link></div>
  const E = { investigation: Investigation, stability: StabilityBench, scaleup: ScaleUp, rheo: RheoCabinet, salt: SaltDosing, doe: DoePlan, worksheet: Worksheet, gmp: GmpTrainer, branching: BranchingSim, 'shift-trend': ShiftTrend, coa: CoaAudit, 'label-audit': LabelAudit, reactor: ReactorSim, 'reverse-inci': ReverseInci, 'challenge-test': ChallengeTest, 'ph-titration': PhTitrationSim, 'pack-compat': PackCompatSim, 'spf-lab': SpfFormulatorSim, 'wpu-audit': WpuBiofilmSim, triage: StabilityTriageSim }[lab.engine as string]
  if (!E) return <div className="page"><h1>{tr("Неизвестный тип занятия: ")}{lab.engine}</h1></div>
  return <E key={lab.id} lab={lab} />
}
