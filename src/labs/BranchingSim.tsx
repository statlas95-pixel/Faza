import { tr } from '../../shared/locale'
import { evaluateBranchPath, type BranchHistoryItem, type BranchingLabData } from '../../shared/branching'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  history: BranchHistoryItem[]
  transfer: Record<number, any>
  finished?: boolean
}

export default function BranchingSim({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as BranchingLabData
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', history: [], transfer: {} }))
  const stepsLabels = [tr('Вводная'), tr('Решения в процессе'), tr('Разбор исхода')]

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={stepsLabels}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={s.history.length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const ev = evaluateBranchPath(data, s.history)
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const currentId = ev.steps.length
    ? ev.steps[ev.steps.length - 1].choice.next
    : data.start
  const currentNode = byId.get(currentId)

  function pick(nodeId: string, choiceId: string) {
    const nextHistory = [...s.history, { nodeId, choiceId }]
    const nextEv = evaluateBranchPath(data, nextHistory)
    set((x) => {
      x.history = nextHistory
      if (nextEv.finished) {
        x.phase = 'debrief'
        x.finished = true
      }
    })
    window.scrollTo(0, 0)
    if (nextEv.finished && nextEv.terminalNode?.outcome) {
      markFinished(
        lab.id,
        `${nextEv.terminalNode.outcome.title} (${Math.round(nextEv.score * 100)} %)`,
        { terminal: nextEv.terminalNode.id, steps: nextHistory.length },
        nextEv.score,
      )
    }
  }

  if (s.phase === 'work' && currentNode && !currentNode.outcome) {
    const lastStep = ev.steps[ev.steps.length - 1]
    return frame(
      <div className="branch-work">
        {lastStep && (
          <section className={`drow ${lastStep.choice.verdict}`}>
            <h4><VerdictTag v={lastStep.choice.verdict} /> {tr('Последствие предыдущего решения')}</h4>
            <p>{lastStep.choice.consequence}</p>
          </section>
        )}

        <section className="panel branch-scene">
          <p className="eyebrow">{tr('Шаг ')} {ev.steps.length + 1}</p>
          <h2>{currentNode.title}</h2>
          <p>{currentNode.scene}</p>
          {currentNode.readings && currentNode.readings.length > 0 && (
            <dl className="outcome branch-readings">
              {currentNode.readings.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd className="branch-reading-val">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="panel">
          <h3>{tr('Ваше технологическое решение')}</h3>
          <div className="choices">
            {(currentNode.choices ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                className="choice"
                onClick={() => pick(currentNode.id, c.id)}
              >
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>,
    )
  }

  // ---------- Разбор ----------
  const outcome = ev.terminalNode?.outcome
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог симуляции')}</p>
        <h1>
          {outcome ? outcome.title : tr('Симуляция завершена')} — {Math.round(ev.score * 100)} %
        </h1>
      </div>

      {outcome && (
        <section className={`drow ${outcome.verdict}`}>
          <h4><VerdictTag v={outcome.verdict} /> {ev.terminalNode?.title}</h4>
          <p>{ev.terminalNode?.scene}</p>
          <p><b>{tr('Итог: ')}</b>{outcome.summary}</p>
          <p><b>{tr('Технологический вывод: ')}</b>{outcome.lesson}</p>
        </section>
      )}

      <section className="panel">
        <h2>{tr('Хронология ваших решений')}</h2>
        {ev.steps.map((st, idx) => (
          <div key={`${st.node.id}-${idx}`} className={`drow ${st.choice.verdict}`}>
            <h4>
              <VerdictTag v={st.choice.verdict} /> {idx + 1}. {st.node.title}
            </h4>
            <p className="yours"><b>{tr('Ваш выбор: ')}</b>{st.choice.label}</p>
            <p>{st.choice.consequence}</p>
          </div>
        ))}
      </section>

      <Transfer
        lab={lab}
        answers={s.transfer}
        onAnswer={(i, v) => set((x) => { x.transfer[i] = v })}
      />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
