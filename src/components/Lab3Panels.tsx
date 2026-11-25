import { useState } from 'react'
import { tr } from '../../shared/locale'
import type {
  ProtocolStep,
  SensoryProfile,
  StabilityTestResult,
  TubeVisual,
} from '../../shared/formulation-lab3'

function TubeSvg({ visual }: { visual: TubeVisual }) {
  return (
    <svg viewBox="0 0 56 124" className="lab3-tube-svg" aria-hidden>
      {/* Крышка */}
      <rect x="12" y="4" width="32" height="12" rx="3" fill="#4B3B6B" />
      {/* Стеклянная пробирка */}
      <path
        d="M14 16 L14 96 Q14 116 28 116 Q42 116 42 96 L42 16 Z"
        fill="rgba(255,255,255,0.22)"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.8"
      />
      {/* Содержимое */}
      {visual === 'uniform' && (
        <path d="M16 34 L16 96 Q16 113 28 113 Q40 113 40 96 L40 34 Z" fill="#F3EFE6" />
      )}
      {visual === 'creaming' && (
        <>
          <path d="M16 48 L16 96 Q16 113 28 113 Q40 113 40 96 L40 48 Z" fill="#E8E4DA" />
          <rect x="16" y="34" width="24" height="15" fill="#F8E2B0" />
        </>
      )}
      {visual === 'split' && (
        <>
          <path d="M16 62 L16 96 Q16 113 28 113 Q40 113 40 96 L40 62 Z" fill="#CFEAE6" />
          <rect x="16" y="34" width="24" height="28" fill="#E6B84C" />
        </>
      )}
      {visual === 'syneresis' && (
        <>
          <path d="M16 44 L16 96 Q16 113 28 113 Q40 113 40 96 L40 44 Z" fill="#ECE7DC" />
          <rect x="16" y="34" width="24" height="10" fill="#BFE8EC" />
        </>
      )}
      {visual === 'crystals' && (
        <>
          <path d="M16 34 L16 96 Q16 113 28 113 Q40 113 40 96 L40 34 Z" fill="#F0ECE2" />
          <g stroke="#4B2E83" strokeWidth="1.4" strokeLinecap="round">
            <line x1="21" y1="74" x2="29" y2="82" />
            <line x1="34" y1="68" x2="26" y2="78" />
            <line x1="22" y1="92" x2="34" y2="100" />
            <line x1="35" y1="88" x2="25" y2="98" />
          </g>
        </>
      )}
      {visual === 'darkened' && (
        <path d="M16 34 L16 96 Q16 113 28 113 Q40 113 40 96 L40 34 Z" fill="#C9924A" />
      )}
    </svg>
  )
}

/** Панель ускоренного старения «Поставить на термостат» (4 испытания + пробирки). */
export function StabilityLabPanel({ tests }: { tests: StabilityTestResult[] }) {
  const [ran, setRan] = useState(false)
  const failCount = tests.filter((t) => t.verdict === 'fail').length
  const warnCount = tests.filter((t) => t.verdict === 'warn').length

  return (
    <section className="panel lab3-panel">
      <div className="sandbox-head-row">
        <div>
          <h2>{tr('Испытания ускоренного старения («Термостат и центрифуга»)')}</h2>
          <p className="small">
            {tr('Проверьте, выдержит ли собранная рецептура центрифугу 3000 об/мин, зимнюю заморозку, месяц при +45 °C и дневной свет.')}
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => setRan((v) => !v)}>
          {ran ? tr('Скрыть отчёт испытаний') : tr('🧪 Поставить на термостат')}
        </button>
      </div>

      {ran && (
        <>
          <p className="small" style={{ marginTop: 10 }}>
            {failCount > 0
              ? <span className="gapmark">{tr('Провалено тестов:')} {failCount} · {tr('Предупреждений:')} {warnCount}</span>
              : warnCount > 0
                ? <span className="verdict weak">{tr('Есть зоны риска:')} {warnCount}</span>
                : <span className="verdict ok">{tr('Все 4 экспресс-теста пройдены успешно')}</span>}
          </p>
          <div className="lab3-tubes-grid">
            {tests.map((t) => (
              <article key={t.id} className={`lab3-tube-card v-${t.verdict}`}>
                <div className="lab3-tube-top">
                  <TubeSvg visual={t.tubeVisual} />
                  <div>
                    <span className={`verdict ${t.verdict === 'pass' ? 'ok' : t.verdict === 'warn' ? 'weak' : 'wrong'}`}>
                      {t.verdict === 'pass' ? tr('Пройден') : t.verdict === 'warn' ? tr('Риск') : tr('Брак')}
                    </span>
                    <h4>{tr(t.title)}</h4>
                    <p className="small muted">{tr(t.condition)}</p>
                  </div>
                </div>
                <p className="small"><b>{tr(t.headline)}</b></p>
                <p className="small">{tr(t.mechanism)}</p>
                <p className="small muted"><b>{tr('Рекомендация:')}</b> {tr(t.advice)}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** 6-осевой радар «Сенсорная паутинка» для оценки тактильного профиля рецептуры. */
export function SensoryProfilePanel({ profile }: { profile: SensoryProfile }) {
  const cx = 160, cy = 140, R = 90
  const n = profile.axes.length
  const pt = (idx: number, ratio: number) => {
    const a = -Math.PI / 2 + (idx * 2 * Math.PI) / n
    return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio] as const
  }
  const poly = (ratio: number) =>
    profile.axes.map((_, i) => pt(i, ratio).map((v) => v.toFixed(1)).join(',')).join(' ')
  const valPoly = profile.axes
    .map((ax, i) => pt(i, Math.max(0.1, ax.score / 100)).map((v) => v.toFixed(1)).join(','))
    .join(' ')

  return (
    <section className="panel lab3-panel">
      <h2>{tr('Сенсорный профиль («Сенсорная паутинка»)')}</h2>
      <p className="small">{tr(profile.summary)}</p>
      <div className="comp-grid">
        <div className="comp-radar-wrap">
          <svg viewBox="0 0 320 280" className="comp-radar" role="img" aria-label={tr('Сенсорный профиль продукта по 6 осям')}>
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <polygon key={r} points={poly(r)} fill="none" stroke="currentColor" opacity="0.2" strokeWidth="1" />
            ))}
            {profile.axes.map((ax, i) => {
              const [x2, y2] = pt(i, 1)
              const [lx, ly] = pt(i, 1.24)
              return (
                <g key={ax.id}>
                  <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" opacity="0.18" strokeWidth="1" />
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="comp-radar-lbl">
                    {tr(ax.shortLabel)}
                  </text>
                </g>
              )
            })}
            <polygon points={valPoly} fill="rgba(226,91,59,0.22)" stroke="var(--coral)" strokeWidth="2.2" />
            {profile.axes.map((ax, i) => {
              const [vx, vy] = pt(i, Math.max(0.1, ax.score / 100))
              return <circle key={ax.id} cx={vx} cy={vy} r="4" fill="var(--coral)" />
            })}
          </svg>
        </div>
        <div className="comp-cards">
          {profile.axes.map((ax) => (
            <div key={ax.id} className="comp-card">
              <div className="comp-card-head">
                <h3>{tr(ax.label)}</h3>
                <span className="num"><b>{ax.score}</b> / 100</span>
              </div>
              <div className="bar"><span style={{ width: `${ax.score}%` }} /></div>
              <p className="small">{tr(ax.note)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Автоматически формируемый технологический протокол варки (SOP) с критическими точками (CCP). */
export function BatchProtocolPanel({ steps }: { steps: ProtocolStep[] }) {
  return (
    <section className="panel lab3-sop">
      <div className="sandbox-head-row">
        <div>
          <h2>{tr('Пошаговый протокол варки (SOP) и критические точки (CCP)')}</h2>
          <p className="small">{tr('Пересчитывается автоматически под текущую рецептуру, температуры фаз и загрузку партии. Входит в печатную карту варки.')}</p>
        </div>
        <button type="button" className="btn small" onClick={() => window.print()}>
          🖨 {tr('Печать SOP')}
        </button>
      </div>
      <ol className="lab3-sop-list">
        {steps.map((st) => (
          <li key={st.stepNo} className="lab3-sop-step">
            <div className="lab3-sop-head">
              <span className="ptag">{st.stepNo}</span>
              <b>{tr(st.title)}</b>
              <span className="tag num">{st.tempTarget}</span>
              <span className="small muted">{tr(st.mixing)}</span>
            </div>
            <ul className="small">
              {st.actions.map((a, idx) => <li key={idx}>{tr(a)}</li>)}
            </ul>
            {st.ccp && <p className="small lab3-ccp"><b>{tr(st.ccp)}</b></p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
