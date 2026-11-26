import { language, tr } from '../../shared/locale'
import {
  dosePhBatch,
  evaluatePhBatch,
  initialPhBatchState,
  type PhBatchState,
} from '../../shared/package-b-sim'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

interface S {
  phase: 'brief' | 'work' | 'debrief'
  batch: PhBatchState
  transfer: Record<number, any>
  finished?: boolean
}

export default function PhTitrationSim({ lab }: { lab: LabMeta }) {
  const [s, set, reset] = useLabState<S>(lab.id, () => ({
    phase: 'brief',
    batch: initialPhBatchState(),
    transfer: {},
  }))

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Титрование партии'), tr('Итоги подгонки')]}
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
        resumed={s.batch.step > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const b = s.batch

  if (s.phase === 'work') {
    const inTarget = b.ph >= 5.7 && b.ph <= 6.3
    const finish = () => {
      const ev = evaluatePhBatch(b)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `pH ${b.ph} · ${b.viscosityMpas} ${tr('мПа·с')} · ${Math.round(ev.score * 100)} %`,
        { ph: b.ph, viscosityMpas: b.viscosityMpas, naoh10Kg: b.naoh10Kg, citric10Kg: b.citric10Kg },
        ev.score,
      )
    }

    // Точки графика pH по шагам
    const maxStep = Math.max(6, b.history.length - 1)
    const xAt = (st: number) => 48 + (st / maxStep) * 460
    const yAt = (ph: number) => 172 - ((Math.max(2.5, Math.min(10.5, ph)) - 2.5) / 8) * 144

    return frame(
      <div className="reactor-grid">
        <section className="panel">
          <p className="eyebrow">{tr('Реактор 500 кг · 0,5 % Carbomer + 0,2 % Citric Acid')}</p>
          <h2>{tr('Кривая подгонки pH в реальном времени')}</h2>
          <dl className="outcome">
            <div><dt>{tr('Текущий pH (норма 5,7–6,3)')}</dt><dd className="num"><b>{b.ph}</b></dd></div>
            <div><dt>{tr('Вязкость (норма ≥ 18 000)')}</dt><dd className="num">{b.viscosityMpas.toLocaleString('ru-RU')} {tr('мПа·с')}</dd></div>
            <div><dt>{tr('Внесено 10 % NaOH')}</dt><dd className="num">{b.naoh10Kg} {tr('кг')}</dd></div>
            <div><dt>{tr('Побочные соли')}</dt><dd className="num">{b.saltPct} %</dd></div>
          </dl>

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <svg viewBox="0 0 540 198" className="trend-svg" role="img" aria-label={tr('Кривая титрования pH по порциям')}>
              {/* Целевая полоса pH 5.7..6.3 */}
              <rect x="48" y={yAt(6.3)} width="468" height={yAt(5.7) - yAt(6.3)} fill="rgba(14,124,123,0.18)" />
              <text x="512" y={yAt(6.3) - 4} textAnchor="end" fontSize="9.5" fill="#0E7C7B">{tr('Целевое окно pH 5,7–6,3')}</text>
              <line x1="48" y1="172" x2="516" y2="172" stroke="currentColor" opacity="0.25" />
              <line x1="48" y1="24" x2="48" y2="172" stroke="currentColor" opacity="0.25" />
              {[3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <text key={v} x="38" y={yAt(v) + 3} textAnchor="end" fontSize="9.5" fill="currentColor" opacity="0.7">{v}</text>
              ))}
              <polyline
                points={b.history.map((h) => `${xAt(h.step).toFixed(1)},${yAt(h.ph).toFixed(1)}`).join(' ')}
                fill="none"
                stroke="var(--coral)"
                strokeWidth="2.6"
              />
              {b.history.map((h) => (
                <circle key={h.step} cx={xAt(h.step)} cy={yAt(h.ph)} r="4" fill="var(--coral)" />
              ))}
            </svg>
          </div>
          {inTarget && (
            <p className="okline" style={{ marginTop: 12 }}>
              ✓ {tr('Партия в целевом окне pH 5,7–6,3! Можно передавать пробу в ОКК.')}
            </p>
          )}
        </section>

        <section className="panel">
          <h2>{tr('Дозирование реагентов порциями')}</h2>
          <p className="small">{tr('Вводите 10 % раствор NaOH ступенчато: около pH 5,0 кривая резко ускоряется — уменьшайте шаг дозировки, чтобы не перелететь!')}</p>

          <div className="reactor-ctl-block">
            <span className="eyebrow">{tr('1. Нейтрализация: 10 % раствор NaOH')}</span>
            <div className="row">
              {[0.2, 0.5, 1.0, 2.0].map((kg) => (
                <button
                  key={kg}
                  type="button"
                  className="btn"
                  onClick={() => set((x) => { x.batch = dosePhBatch(x.batch, 'naoh', kg) })}
                >
                  +{kg} {tr('кг NaOH')}
                </button>
              ))}
            </div>
          </div>

          <div className="reactor-ctl-block">
            <span className="eyebrow">{tr('2. Аварийный откат при перелёте: 10 % лимонная кислота')}</span>
            <div className="row">
              {[0.2, 0.5].map((kg) => (
                <button
                  key={kg}
                  type="button"
                  className="btn ghost"
                  onClick={() => set((x) => { x.batch = dosePhBatch(x.batch, 'citric', kg) })}
                >
                  +{kg} {tr('кг кислоты')}
                </button>
              ))}
            </div>
          </div>

          <div className="reactor-ctl-block">
            <button type="button" className="btn primary" onClick={finish}>
              {tr('Зафиксировать pH и сдать партию в ОКК →')}
            </button>
          </div>

          <div className="reactor-log">
            <span className="eyebrow">{tr('Протокол дозировок')}</span>
            <ul className="small">
              {[...b.history].reverse().slice(0, 8).map((h) => (
                <li key={h.step}><b>#{h.step}:</b> {h.action} → pH <b>{h.ph}</b> ({h.viscosityMpas.toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')} {tr('мПа·с')})</li>
              ))}
            </ul>
          </div>
        </section>
      </div>,
    )
  }

  const ev = evaluatePhBatch(b)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Протокол ОКК по нейтрализации')}</p>
        <h1>{tr('Итог подгонки pH')} — {Math.round(ev.score * 100)} %</h1>
        <dl className="outcome">
          <div><dt>{tr('Итоговый pH')}</dt><dd className="num">{b.ph}</dd></div>
          <div><dt>{tr('Вязкость геля')}</dt><dd className="num">{b.viscosityMpas.toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')} {tr('мПа·с')}</dd></div>
          <div><dt>{tr('Расход 10 % NaOH')}</dt><dd className="num">{b.naoh10Kg} {tr('кг')}</dd></div>
          <div><dt>{tr('Обратная кислота')}</dt><dd className="num">{b.citric10Kg} {tr('кг')}</dd></div>
        </dl>
      </div>
      <div className={`drow ${ev.phOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.phOk ? 'ok' : 'wrong'} /> {tr('Попадание в целевое окно pH (5,7–6,3)')}</h4>
        <p>{ev.summary}</p>
      </div>
      <div className={`drow ${ev.noOvershoot ? 'ok' : 'weak'}`}>
        <h4><VerdictTag v={ev.noOvershoot ? 'ok' : 'weak'} /> {tr('Отсутствие перелёта и солевых качелей')}</h4>
        <p>{ev.noOvershoot
          ? tr('Вы подошли к точке нейтрализации плавно, не допустив перелёта и образования лишнего цитрата натрия.')
          : tr('Из-за перелёта в щелочную зону пришлось вводить кислоту — накопленная соль снизила предельную вязкость карбомера.')}</p>
      </div>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
