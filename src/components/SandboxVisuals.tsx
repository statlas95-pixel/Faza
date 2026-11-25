import { useEffect, useState } from 'react'
import { tr } from '../../shared/locale'
import { undissociatedFractionPct, type FormulaEvaluation, type FormulaInput } from '../../shared/formulation'
import type { MicroscopeType, ProcessAppearanceForecast, ProcessStageVisual } from '../../shared/formulation-sim'

/** Анимированная SVG-сцена лабораторного процесса для выбранной стадии. */
function StageArtwork({
  stage,
  phaseAPct,
  phaseBPct,
  playing,
}: {
  stage: ProcessStageVisual
  phaseAPct: number
  phaseBPct: number
  playing: boolean
}) {
  const fillA = Math.max(18, Math.min(82, phaseAPct * 0.85))
  const fillB = Math.max(14, Math.min(72, phaseBPct * 2.2))
  const hot = stage.tempC >= 55
  const hasSplit = stage.defects.includes('phase-split')
  const hasFloc = stage.defects.includes('flocculation')
  const hasUnmelted = stage.defects.includes('unmelted-wax')
  const hasCrystals = stage.defects.includes('crystals')
  const hasBubbles = stage.defects.includes('bubbles')
  const hasCollapse = stage.defects.includes('gel-collapse')

  return (
    <svg viewBox="0 0 320 190" className={`sb-stage-svg ${playing ? 'playing' : ''}`} role="img" aria-label={tr(stage.title)}>
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="20%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="85%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
      </defs>

      {/* Стол / плита */}
      <rect x="16" y="164" width="288" height="10" rx="5" fill="rgba(42,27,61,0.14)" />
      {hot && (
        <rect x="92" y="158" width="136" height="8" rx="4" fill="#E86A42" opacity="0.75" />
      )}

      {/* Стадия 1: Фаза A */}
      {stage.id === 'phaseA' && (
        <g>
          {hot && (
            <g className="sb-steam" stroke="#0E7C7B" strokeWidth="2" fill="none" opacity="0.55">
              <path d="M135 50 Q130 38 138 26" />
              <path d="M160 46 Q155 34 163 22" />
              <path d="M185 50 Q180 38 188 26" />
            </g>
          )}
          <rect x="108" y={156 - fillA} width="104" height={fillA} rx="6" fill={stage.colorHex} />
          {hasCrystals && (
            <g stroke="#2A1B3D" strokeWidth="1.4" opacity="0.75">
              <line x1="125" y1="145" x2="137" y2="136" />
              <line x1="152" y1="148" x2="165" y2="140" />
              <line x1="178" y1="144" x2="192" y2="135" />
            </g>
          )}
          <path d="M104 58 L104 150 Q104 158 112 158 L208 158 Q216 158 216 150 L216 58" fill="url(#glass)" stroke="#0E7C7B" strokeWidth="2.5" />
          <text x="160" y="178" textAnchor="middle" className="sb-svg-cap">A · {stage.tempC} °C</text>
        </g>
      )}

      {/* Стадия 2: Фаза B */}
      {stage.id === 'phaseB' && (
        <g>
          {hot && (
            <g className="sb-steam" stroke="#C98A00" strokeWidth="2" fill="none" opacity="0.65">
              <path d="M135 54 Q130 42 138 30" />
              <path d="M160 50 Q155 38 163 26" />
              <path d="M185 54 Q180 42 188 30" />
            </g>
          )}
          <rect x="112" y={156 - fillB} width="96" height={fillB} rx="6" fill={stage.colorHex} />
          {hasUnmelted && (
            <g fill="#FFFDF5" stroke="#B8860B" strokeWidth="1.2">
              <polygon points="130,140 142,134 146,146 132,149" />
              <polygon points="164,138 178,136 180,148 166,147" />
              <polygon points="148,148 158,142 162,152 149,153" />
            </g>
          )}
          <path d="M108 62 L108 150 Q108 158 116 158 L204 158 Q212 158 212 150 L212 62" fill="url(#glass)" stroke="#C98A00" strokeWidth="2.5" />
          <text x="160" y="178" textAnchor="middle" className="sb-svg-cap">B · {stage.tempC} °C</text>
        </g>
      )}

      {/* Стадия 3: Эмульгирование (A + B + ротор) */}
      {stage.id === 'emulsify' && (
        <g>
          {/* Струя переливания фазы B */}
          {phaseBPct > 0 && (
            <path d="M236 32 Q204 36 188 92" fill="none" stroke="#E8B647" strokeWidth="5" strokeLinecap="round" className="sb-pour" />
          )}
          {/* Масса в реакторе */}
          <rect x="98" y="84" width="124" height="72" rx="8" fill={stage.colorHex} />
          {hasSplit && stage.topLayerHex && (
            <rect x="98" y="82" width="124" height="18" rx="4" fill={stage.topLayerHex} opacity="0.92" />
          )}
          {hasFloc && (
            <g fill="#FFFFFF" stroke="#9B8E7B" strokeWidth="0.8">
              <circle cx="122" cy="142" r="5" /><circle cx="145" cy="146" r="6" />
              <circle cx="176" cy="143" r="5" /><circle cx="198" cy="147" r="4" />
            </g>
          )}
          {hasBubbles && (
            <g fill="rgba(255,255,255,0.75)" stroke="#0E7C7B" strokeWidth="0.8">
              <circle cx="118" cy="92" r="4" /><circle cx="132" cy="88" r="5" /><circle cx="195" cy="90" r="4" /><circle cx="206" cy="94" r="3" />
            </g>
          )}
          {/* Вал и ротор гомогенизатора */}
          <rect x="157" y="16" width="6" height="114" rx="2" fill="#4B3B6B" />
          <g className="sb-rotor" style={{ transformOrigin: '160px 130px' }}>
            <rect x="134" y="126" width="52" height="8" rx="4" fill="#6E4FA3" />
          </g>
          {/* Вихревые дуги */}
          <path d="M120 112 Q160 120 200 112" fill="none" stroke="rgba(110,79,163,0.4)" strokeWidth="2" strokeDasharray="6 4" className="sb-vortex" />
          <path d="M94 52 L94 150 Q94 158 102 158 L218 158 Q226 158 226 150 L226 52" fill="url(#glass)" stroke="#4B3B6B" strokeWidth="2.5" />
          <text x="160" y="178" textAnchor="middle" className="sb-svg-cap">A + B · {stage.tempC} °C</text>
        </g>
      )}

      {/* Стадия 4: Охлаждение и ввод фазы C */}
      {stage.id === 'coolingC' && (
        <g>
          {/* Пипетка фазы C */}
          <path d="M154 14 L166 14 L162 46 L158 46 Z" fill="#8E6AD6" />
          <circle cx="160" cy="60" r="4" fill="#8E6AD6" className="sb-drop" />
          <circle cx="160" cy="76" r="3.5" fill="#8E6AD6" className="sb-drop sb-drop-2" />
          {/* Масса */}
          <rect x="98" y={hasCollapse ? 112 : 88} width="124" height={hasCollapse ? 44 : 68} rx="8" fill={stage.colorHex} />
          {hasSplit && stage.topLayerHex && (
            <rect x="98" y="86" width="124" height="16" rx="4" fill={stage.topLayerHex} opacity="0.92" />
          )}
          {hasFloc && (
            <g fill="#FFFFFF" stroke="#9B8E7B" strokeWidth="0.9">
              <circle cx="126" cy="144" r="5" /><circle cx="158" cy="148" r="6" /><circle cx="188" cy="145" r="5" />
            </g>
          )}
          {/* Рубашка охлаждения */}
          <path d="M88 76 L88 152 Q88 162 100 162 L220 162 Q232 162 232 152 L232 76" fill="none" stroke="#3FA7D6" strokeWidth="3" strokeDasharray="5 3" opacity="0.8" />
          <path d="M94 56 L94 150 Q94 158 102 158 L218 158 Q226 158 226 150 L226 56" fill="url(#glass)" stroke="#6E4FA3" strokeWidth="2.5" />
          <text x="160" y="178" textAnchor="middle" className="sb-svg-cap">C · {stage.tempC} °C</text>
        </g>
      )}

      {/* Стадия 5: Готовый продукт (баночка / стакан через 24 ч) */}
      {stage.id === 'final24h' && (
        <g>
          <rect x="100" y={hasCollapse ? 114 : 84} width="120" height={hasCollapse ? 42 : 72} rx="10" fill={stage.colorHex} stroke="rgba(42,27,61,0.12)" />
          {hasSplit && stage.topLayerHex && (
            <rect x="100" y="84" width="120" height="22" rx="6" fill={stage.topLayerHex} />
          )}
          {!hasSplit && !hasCollapse && !hasFloc && (
            <path d="M112 96 Q160 88 208 96" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="4" strokeLinecap="round" />
          )}
          {hasFloc && (
            <g fill="#FFF" stroke="#9A8F82" strokeWidth="0.9">
              <circle cx="122" cy="145" r="5" /><circle cx="144" cy="148" r="6" />
              <circle cx="170" cy="144" r="5.5" /><circle cx="194" cy="147" r="4.5" />
            </g>
          )}
          {hasCrystals && (
            <g stroke="#4B3B6B" strokeWidth="1.5">
              <line x1="120" y1="120" x2="136" y2="112" /><line x1="162" y1="130" x2="176" y2="122" /><line x1="184" y1="114" x2="196" y2="106" />
            </g>
          )}
          <path d="M96 62 L96 148 Q96 158 106 158 L214 158 Q224 158 224 148 L224 62" fill="url(#glass)" stroke={stage.defects.length ? '#C0392B' : '#0E7C7B'} strokeWidth="2.6" />
          <text x="160" y="178" textAnchor="middle" className="sb-svg-cap">24 h · {stage.tempC} °C</text>
        </g>
      )}
    </svg>
  )
}

/** Окошко микроскопии ×400 (детерминированная визуализация микроструктуры). */
function MicroscopeLens({ type, caption }: { type: MicroscopeType; caption: string }) {
  return (
    <figure className="sb-micro">
      <svg viewBox="0 0 120 120" className="sb-micro-svg" role="img" aria-label={caption}>
        <circle cx="60" cy="60" r="54" fill="#F8F6FC" stroke="#4B3B6B" strokeWidth="3" />
        {type === 'fine-emulsion' && (
          <g fill="rgba(232,182,71,0.55)" stroke="#B8860B" strokeWidth="0.8">
            {[
              [34, 42, 4], [48, 36, 3.5], [64, 34, 4], [80, 44, 3.5],
              [30, 62, 4], [46, 56, 4.2], [62, 54, 3.6], [78, 60, 4], [90, 52, 3],
              [38, 78, 3.8], [54, 72, 4], [70, 76, 3.5], [84, 74, 3.8], [58, 90, 3.5],
            ].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
          </g>
        )}
        {type === 'coarse-emulsion' && (
          <g fill="rgba(232,150,50,0.65)" stroke="#A65E00" strokeWidth="1.2">
            <circle cx="44" cy="48" r="16" />
            <circle cx="76" cy="54" r="14" />
            <circle cx="56" cy="78" r="12" />
            <circle cx="82" cy="82" r="7" />
          </g>
        )}
        {type === 'flocculated' && (
          <g fill="#D5CFC7" stroke="#6E6259" strokeWidth="1.2">
            <path d="M32 52 Q42 36 56 46 Q66 56 50 66 Q34 68 32 52 Z" />
            <path d="M64 68 Q78 56 90 70 Q86 86 70 84 Q58 80 64 68 Z" />
            <circle cx="46" cy="82" r="6" />
          </g>
        )}
        {type === 'crystals' && (
          <g stroke="#4B2E83" strokeWidth="1.8" strokeLinecap="round">
            <line x1="28" y1="54" x2="56" y2="36" />
            <line x1="46" y1="78" x2="82" y2="52" />
            <line x1="34" y1="86" x2="64" y2="70" />
            <line x1="66" y1="36" x2="90" y2="58" />
          </g>
        )}
        {type === 'micelles' && (
          <g fill="none" stroke="#0E7C7B" strokeWidth="1.6" strokeDasharray="3 3" opacity="0.7">
            <path d="M26 48 Q50 38 74 52 T96 48" />
            <path d="M24 68 Q52 80 78 64 T96 72" />
            <path d="M36 86 Q60 76 84 88" />
          </g>
        )}
        {type === 'solution' && (
          <text x="60" y="63" textAnchor="middle" fontSize="10" fill="#6E627F">isotropic</text>
        )}
        {/* Масштабная линейка */}
        <line x1="70" y1="100" x2="94" y2="100" stroke="#2A1B3D" strokeWidth="2" />
        <text x="82" y="96" textAnchor="middle" fontSize="8" fill="#2A1B3D">20 μm</text>
      </svg>
      <figcaption className="small"><b>×400:</b> {caption}</figcaption>
    </figure>
  )
}

/** Панель прогноза внешнего вида по 5 узловым стадиям с кнопкой «Провести варку ▶». */
export function ProcessSimulatorPanel({
  forecast,
  evaluation,
}: {
  forecast: ProcessAppearanceForecast
  evaluation: FormulaEvaluation
}) {
  const [stageIdx, setStageIdx] = useState(4)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setStageIdx((prev) => {
        if (prev >= forecast.stages.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [playing, forecast.stages.length])

  const stage = forecast.stages[stageIdx] ?? forecast.stages[forecast.stages.length - 1]

  function runBrew() {
    setStageIdx(0)
    setPlaying(true)
  }

  return (
    <section className="panel sb-sim-panel">
      <div className="sandbox-head-row">
        <div>
          <h2>{tr('Прогноз внешнего вида по стадиям процесса')}</h2>
          <p className="small">{tr('Нажмите «Провести варку», чтобы проиграть технологическую цепочку, или выберите любую из 5 стадий.')}</p>
        </div>
        <button type="button" className="btn primary" onClick={playing ? () => setPlaying(false) : runBrew}>
          {playing ? tr('⏸ Пауза') : tr('▶ Провести варку')}
        </button>
      </div>

      <div className="sb-stage-tabs" role="tablist" aria-label={tr('Стадии варки')}>
        {forecast.stages.map((st, idx) => (
          <button
            key={st.id}
            type="button"
            role="tab"
            aria-selected={idx === stageIdx}
            className={`sb-stage-tab ${idx === stageIdx ? 'on' : ''} ${st.defects.length ? 'has-defect' : ''}`}
            onClick={() => { setPlaying(false); setStageIdx(idx) }}
          >
            <span className="sb-step-num">{st.stepNo}</span>
            <span>{tr(st.title)}</span>
          </button>
        ))}
      </div>

      <div className="sb-visual-grid">
        <div className="sb-artwork-box">
          <StageArtwork
            stage={stage}
            phaseAPct={evaluation.phaseTotals.A.pct}
            phaseBPct={evaluation.phaseTotals.B.pct}
            playing={playing}
          />
        </div>
        <div className="sb-stage-info">
          <p className="eyebrow">{tr('Стадия')} {stage.stepNo} / 5 · {stage.tempC} °C</p>
          <h3>{tr(stage.textureLabel)}</h3>
          <p>{tr(stage.summary)}</p>
          <dl className="sb-mini-meta">
            <div><dt>{tr('Прогноз вязкости')}</dt><dd>{stage.viscosityBand}</dd></div>
            <div><dt>{tr('Прозрачность')}</dt><dd>{tr(stage.opacity)}</dd></div>
          </dl>
          {stage.defects.length > 0 && (
            <p className="small">
              <span className="gapmark">{tr('Дефекты на стадии:')} {stage.defects.join(', ')}</span>
            </p>
          )}
        </div>
        <MicroscopeLens type={stage.microscopeType} caption={tr(stage.microscopeCaption)} />
      </div>
    </section>
  )
}

/** Визуальная шкала требуемого и фактического ГЛБ (0–20). */
export function HlbGauge({ requiredHlb, actualHlb }: { requiredHlb: number | null; actualHlb: number | null }) {
  if (requiredHlb === null && actualHlb === null) return null
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / 20) * 100))}%`
  const okZoneLeft = requiredHlb !== null ? Math.max(0, ((requiredHlb - 1) / 20) * 100) : 0
  const okZoneWidth = requiredHlb !== null ? Math.min(100 - okZoneLeft, (2 / 20) * 100) : 0
  return (
    <div className="sb-gauge">
      <div className="sb-gauge-head">
        <b>{tr('Шкала ГЛБ (0–20)')}</b>
        <span className="small num">
          {tr('Требуемый:')} {requiredHlb ?? '—'} · {tr('Фактический:')} {actualHlb ?? '—'}
        </span>
      </div>
      <div className="sb-gauge-track">
        {requiredHlb !== null && (
          <span className="sb-gauge-zone" style={{ left: `${okZoneLeft}%`, width: `${okZoneWidth}%` }} title={tr('Целевая зона ±1,0')} />
        )}
        {requiredHlb !== null && (
          <span className="sb-gauge-pin req" style={{ left: pos(requiredHlb) }} title={`reqHLB ${requiredHlb}`} />
        )}
        {actualHlb !== null && (
          <span className="sb-gauge-pin act" style={{ left: pos(actualHlb) }} title={`actual HLB ${actualHlb}`} />
        )}
      </div>
      <div className="sb-gauge-scale num">
        <span>0 (W/O)</span><span>5</span><span>10</span><span>15 (O/W)</span><span>20</span>
      </div>
    </div>
  )
}

/** График Гендерсона–Хассельбаха для органических кислотных консервантов в текущей формуле. */
export function PreservativePhCurve({ evaluation, targetPh }: { evaluation: FormulaEvaluation; targetPh: number }) {
  const acids = evaluation.rows.filter((r) => r.pct > 0 && r.ingredient.pKa !== undefined)
  if (!acids.length) return null
  const item = acids[0].ingredient
  const pKa = item.pKa!
  const pts: string[] = []
  for (let ph = 2; ph <= 8; ph += 0.25) {
    const x = 24 + ((ph - 2) / 6) * 232
    const frac = undissociatedFractionPct(ph, pKa)
    const y = 92 - (frac / 100) * 76
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  const curX = 24 + ((Math.max(2, Math.min(8, targetPh)) - 2) / 6) * 232
  const curFrac = undissociatedFractionPct(targetPh, pKa)
  const curY = 92 - (curFrac / 100) * 76

  return (
    <div className="sb-ph-curve">
      <div className="sb-gauge-head">
        <b>{tr('Активность консерванта по pH:')} {item.name}</b>
        <span className="small num">pKa {pKa} · {tr('при pH')} {targetPh}: <b>{curFrac} %</b></span>
      </div>
      <svg viewBox="0 0 272 110" className="sb-curve-svg" role="img" aria-label={tr('Кривая Гендерсона–Хассельбаха')}>
        <line x1="24" y1="92" x2="256" y2="92" stroke="currentColor" opacity="0.3" />
        <line x1="24" y1="16" x2="24" y2="92" stroke="currentColor" opacity="0.3" />
        <polyline points={pts.join(' ')} fill="none" stroke="var(--teal)" strokeWidth="2.4" />
        <line x1={curX} y1="16" x2={curX} y2="92" stroke="#E86A42" strokeWidth="1.2" strokeDasharray="3 3" />
        <circle cx={curX} cy={curY} r="4.5" fill="#E86A42" />
        <text x="24" y="105" fontSize="9" fill="currentColor">pH 2</text>
        <text x="132" y="105" fontSize="9" fill="currentColor">pH 5</text>
        <text x="236" y="105" fontSize="9" fill="currentColor">pH 8</text>
        <text x="4" y="22" fontSize="8" fill="currentColor">100%</text>
      </svg>
    </div>
  )
}
