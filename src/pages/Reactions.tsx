import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import {
  getDefaultReactionParams,
  REACTIONS_CATALOG,
  simulateReaction,
  type ReactionDefinition,
  type ReactionId,
  type ReactionSimulationResult,
} from '../../shared/reactions-sim'
import { topicById } from '../content'
import { showToast } from '../components/Toast'
import { useTitle } from './util'

/** Анимированная SVG-сцена молекулярного / коллоидного механизма для выбранной реакции. */
function ReactionMechanismScene({
  def,
  sim,
  params,
  playing,
}: {
  def: ReactionDefinition
  sim: ReactionSimulationResult
  params: Record<string, number>
  playing: boolean
}) {
  const en = language === 'en'
  const animCls = playing ? 'rx-anim-on' : 'rx-anim-off'

  return (
    <svg
      viewBox="0 0 420 230"
      className={`rx-scene-svg ${animCls}`}
      role="img"
      aria-label={en ? def.titleEn : def.titleRu}
    >
      <defs>
        <linearGradient id="rx-water-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(14,165,233,0.14)" />
          <stop offset="100%" stopColor="rgba(14,165,233,0.04)" />
        </linearGradient>
        <radialGradient id="rx-oil-drop">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>

      {/* Фон реакционной ячейки */}
      <rect x="6" y="6" width="408" height="218" rx="16" fill="url(#rx-water-bg)" stroke="rgba(148,163,184,0.28)" />

      {/* 1. In-situ омыление стеариновой кислоты на границе фаз */}
      {def.id === 'saponification-stearate' && (() => {
        const heads = Math.max(4, Math.round(sim.progressRatio * 18))
        const cold = (params.tempC ?? 75) < 68
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">{en ? 'Aqueous phase (TEA)' : 'Водная фаза (TEA)'}</text>
            <text x="210" y="28" textAnchor="middle" className="rx-lbl-accent">
              {cold ? (en ? 'Solid stearic chunks (< 68 °C)' : 'Твёрдая стеариновая к-та (< 68 °C)') : (en ? 'Interfacial TEA-Stearate assembly' : 'Самосборка стеарата TEA на границе')}
            </text>
            {/* Масляная капля в центре */}
            <circle cx="210" cy="122" r={cold ? 56 : 48} fill="url(#rx-oil-drop)" opacity="0.88" stroke="#D97706" strokeWidth="1.5" />
            <text x="210" y="126" textAnchor="middle" fontSize="11" fontWeight="700" fill="#78350F">
              {en ? 'Oil + C₁₇H₃₅COOH' : 'Масло + R—COOH'}
            </text>
            {/* Молекулы стеарата TEA по периметру капли */}
            {Array.from({ length: heads }).map((_, i) => {
              const a = (i * 2 * Math.PI) / heads
              const rIn = cold ? 44 : 36
              const rOut = cold ? 64 : 60
              const x1 = 210 + Math.cos(a) * rIn
              const y1 = 122 + Math.sin(a) * rIn
              const x2 = 210 + Math.cos(a) * rOut
              const y2 = 122 + Math.sin(a) * rOut
              return (
                <g key={i} className="rx-pulse">
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0284C7" strokeWidth="2.2" />
                  <circle cx={x2} cy={y2} r="4.5" fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="1.2" />
                </g>
              )
            })}
            {/* Свободные молекулы TEA, диффундирующие к границе */}
            {[[68, 76], [84, 158], [344, 82], [336, 162]].map(([x, y], i) => (
              <g key={i} className="rx-float">
                <circle cx={x} cy={y} r="9" fill="rgba(139,92,246,0.22)" stroke="#8B5CF6" strokeWidth="1.6" />
                <text x={x} y={y + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#7C3AED">TEA</text>
              </g>
            ))}
          </g>
        )
      })()}

      {/* 2. Нейтрализация карбомера и солевой коллапс */}
      {def.id === 'carbomer-neutralization' && (() => {
        const exp = sim.progressRatio // 0 = сжатый клубок, 1 = расправленная сеть
        const saltCount = Math.round(sim.shieldingRatio * 14)
        const amp = 12 + exp * 46
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">
              {en ? `Polymer expansion: ${Math.round(exp * 100)}%` : `Расправление сетки ПАК: ${Math.round(exp * 100)} %`}
            </text>
            <text x="400" y="28" textAnchor="end" className="rx-lbl-accent">
              {saltCount > 4 ? (en ? 'Na⁺ Debye screening!' : 'Экранирование Na⁺!') : (en ? 'Electrostatic —COO⁻ repulsion' : 'Отталкивание —COO⁻')}
            </text>
            {/* Полимерные сшитые цепи (физически расправляются/сжимаются от exp) */}
            {[82, 126, 170].map((cy, row) => {
              const span = 50 + exp * 130
              const x0 = 210 - span
              const x1 = 210 + span
              const d = `M${x0},${cy} Q${210 - span * 0.5},${cy - amp * 0.55} 210,${cy} T${x1},${cy}`
              return (
                <g key={row}>
                  <path d={d} fill="none" stroke={exp > 0.35 ? '#0EA5E9' : '#64748B'} strokeWidth="3.2" strokeLinecap="round" />
                  {/* Заряды COO⁻ вдоль цепи */}
                  {exp > 0.15 && [0.15, 0.38, 0.62, 0.85].map((u, j) => {
                    const cx = x0 + (x1 - x0) * u
                    return (
                      <g key={j}>
                        <circle cx={cx} cy={cy - (j % 2 === 0 ? 10 : -10) * exp} r="6.5" fill="#10B981" opacity="0.88" />
                        <text x={cx} y={cy - (j % 2 === 0 ? 10 : -10) * exp + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#FFF">−</text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
            {/* Сшивки между цепями */}
            <line x1="175" y1="82" x2="185" y2="126" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
            <line x1="245" y1="126" x2="235" y2="170" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
            {/* Ионы Na⁺ при солевом коллапсе */}
            {Array.from({ length: saltCount }).map((_, i) => {
              const x = 90 + ((i * 53) % 240)
              const y = 66 + ((i * 37) % 120)
              return (
                <g key={i} className="rx-float">
                  <circle cx={x} cy={y} r="7.5" fill="#EF4444" opacity="0.9" />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFF">Na⁺</text>
                </g>
              )
            })}
          </g>
        )
      })()}

      {/* 3. Цепное перекисное окисление ПНЖК */}
      {def.id === 'lipid-peroxidation' && (() => {
        const hasEdta = (params.edtaPct ?? 0.1) >= 0.04
        const hasVitE = (params.tocopherolPct ?? 0.2) >= 0.05
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">{en ? 'PUFA chain initiation & propagation' : 'Цепное окисление липидов (ПНЖК)'}</text>
            {/* Углеродная цепь ПНЖК */}
            <path d="M36,122 L64,102 L92,122 L120,102 L148,122 L176,102 L204,122" fill="none" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="94" y1="115" x2="118" y2="97" stroke="#F59E0B" strokeWidth="1.8" />
            <line x1="150" y1="115" x2="174" y2="97" stroke="#F59E0B" strokeWidth="1.8" />
            <text x="118" y="144" textAnchor="middle" fontSize="10" fontWeight="600" fill="#B45309">LH (C=C—CH₂—C=C)</text>

            {/* Катализатор Fe²⁺ и клетка EDTA */}
            <g transform="translate(88, 62)">
              <circle cx="0" cy="0" r="12" fill="#EF4444" opacity="0.88" />
              <text x="0" y="3.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFF">Fe²⁺</text>
              {hasEdta && (
                <g>
                  <polygon points="-22,0 -11,-19 11,-19 22,0 11,19 -11,19" fill="none" stroke="#0EA5E9" strokeWidth="2.4" strokeDasharray="4 2" />
                  <text x="0" y="-23" textAnchor="middle" fontSize="9" fontWeight="700" fill="#0284C7">EDTA</text>
                </g>
              )}
            </g>

            {/* Радикал LOO• */}
            <path d="M212,116 L264,116" stroke="#EF4444" strokeWidth="2.2" strokeDasharray="5 3" className="rx-flow" />
            <g transform="translate(292, 116)" className="rx-pulse">
              <circle cx="0" cy="0" r="22" fill="rgba(239,68,68,0.18)" stroke="#EF4444" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#DC2626">LOO•</text>
            </g>

            {/* Токоферол — перехват цепи */}
            {hasVitE ? (
              <g transform="translate(362, 116)">
                <rect x="-32" y="-22" width="64" height="44" rx="12" fill="rgba(16,185,129,0.2)" stroke="#10B981" strokeWidth="2" />
                <text x="0" y="-2" textAnchor="middle" fontSize="10" fontWeight="700" fill="#059669">Vit E</text>
                <text x="0" y="12" textAnchor="middle" fontSize="8.5" fill="#047857">{en ? 'H• quench' : 'обрыв цепи'}</text>
              </g>
            ) : (
              <g transform="translate(362, 116)">
                <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#DC2626">→ LOOH!</text>
              </g>
            )}
          </g>
        )
      })()}

      {/* 4. Гидролиз мочевины и ниацинамида */}
      {def.id === 'urea-niacinamide-hydrolysis' && (() => {
        const buffered = (params.bufferPct ?? 60) >= 40
        const acidic = (params.initialPh ?? 6.0) < 4.6
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">{en ? 'Hydrolysis & buffer interception' : 'Гидролиз и буферный перехват'}</text>
            {/* Мочевина */}
            <g transform="translate(94, 108)">
              <rect x="-56" y="-26" width="112" height="52" rx="14" fill="rgba(14,165,233,0.16)" stroke="#0EA5E9" strokeWidth="2" />
              <text x="0" y="-3" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369A1">H₂N—CO—NH₂</text>
              <text x="0" y="13" textAnchor="middle" fontSize="9" fill="#0284C7">{en ? 'Urea + H₂O' : 'Мочевина + H₂O'}</text>
            </g>
            <path d="M156,108 L212,108" stroke="#F97316" strokeWidth="2.2" strokeDasharray="4 3" className="rx-flow" />
            {/* Выделение NH3 и буфер */}
            <g transform="translate(248, 108)" className="rx-float">
              <circle cx="0" cy="0" r="22" fill="rgba(249,115,22,0.18)" stroke="#F97316" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C2410C">NH₃↑</text>
            </g>
            <g transform="translate(344, 108)">
              <rect x="-48" y="-28" width="96" height="56" rx="14" fill={buffered ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.14)'} stroke={buffered ? '#10B981' : '#EF4444'} strokeWidth="2" />
              <text x="0" y="-4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={buffered ? '#047857' : '#B91C1C'}>
                {buffered ? (en ? 'Lactate Buffer' : 'Лактат-буфер') : (en ? 'No Buffer!' : 'Нет буфера!')}
              </text>
              <text x="0" y="12" textAnchor="middle" fontSize="8.5" fill={buffered ? '#065F46' : '#991B1B'}>
                {buffered ? 'NH₃ → NH₄⁺' : (en ? 'pH drift ↑↑' : 'рост pH ↑↑')}
              </text>
            </g>
            {/* Предупреждение по ниацинамиду при кислом pH */}
            <rect x="44" y="168" width="332" height="36" rx="10" fill={acidic ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)'} stroke={acidic ? '#EF4444' : '#10B981'} />
            <text x="210" y="190" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={acidic ? '#B91C1C' : '#047857'}>
              {acidic
                ? (en ? 'pH < 4.6: Niacinamide hydrolyzes → Nicotinic Acid (skin flushing!)' : 'pH < 4,6: Ниацинамид гидролизуется → Никотиновая к-та (гиперемия!)')
                : (en ? 'pH 5.0–7.0: Niacinamide amide bond stays stable' : 'pH 5,0–7,0: Амидная связь ниацинамида стабильна')}
            </text>
          </g>
        )
      })()}

      {/* 5. Деградация L-аскорбиновой кислоты (живой флакон + O2) */}
      {def.id === 'ascorbic-retinol-degradation' && (() => {
        const o2Count = Math.max(1, Math.round(((params.oxygenPct ?? 20) / 100) * 8))
        const shielded = (params.ferulicSynergy ?? 80) >= 50
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">{en ? 'In-bottle oxidation (L-AA → DHA → DKG)' : 'Окисление во флаконе (L-AA → ДГК → ДКГ)'}</text>
            {/* Флакон с живым цветом сыворотки */}
            <rect x="52" y="72" width="96" height="126" rx="16" fill={sim.swatchHex ?? '#F8FAFC'} stroke="#475569" strokeWidth="2.4" />
            <rect x="78" y="50" width="44" height="22" rx="6" fill="#334155" />
            <text x="100" y="142" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1E293B">L-AA</text>
            <text x="100" y="158" textAnchor="middle" fontSize="9" fill="#334155">pH {params.pH}</text>
            {/* Молекулы O2, проникающие сверху */}
            {Array.from({ length: o2Count }).map((_, i) => (
              <g key={i} className="rx-float">
                <circle cx={68 + (i % 4) * 20} cy={88 + Math.floor(i / 4) * 22} r="7" fill="rgba(239,68,68,0.22)" stroke="#EF4444" strokeWidth="1.4" />
                <text x={68 + (i % 4) * 20} y={91 + Math.floor(i / 4) * 22} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#B91C1C">O₂</text>
              </g>
            ))}
            {/* Цепочка L-AA -> DHA -> DKG */}
            <g transform="translate(182, 118)">
              <rect x="0" y="-22" width="60" height="44" rx="10" fill="rgba(14,165,233,0.18)" stroke="#0EA5E9" strokeWidth="1.8" />
              <text x="30" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369A1">L-AA</text>
              <path d="M64,0 L86,0" stroke="#F59E0B" strokeWidth="2.2" className="rx-flow" />
              <rect x="90" y="-22" width="54" height="44" rx="10" fill="rgba(245,158,11,0.2)" stroke="#F59E0B" strokeWidth="1.8" />
              <text x="117" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#B45309">DHA</text>
              <path d="M148,0 L168,0" stroke="#B45309" strokeWidth="2.2" className="rx-flow" />
              <rect x="172" y="-22" width="56" height="44" rx="10" fill="rgba(180,83,9,0.26)" stroke="#B45309" strokeWidth="1.8" />
              <text x="200" y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#78350F">DKG</text>
            </g>
            {shielded && (
              <text x="292" y="174" textAnchor="middle" fontSize="10" fontWeight="600" fill="#047857">
                ✓ {en ? 'Ferulic + Vit E regenerates ascorbate radical' : 'Феруловая + вит. E восстанавливают аскорбил-радикал'}
              </text>
            )}
          </g>
        )
      })()}

      {/* 6. Мицеллярный катализ и основания Шиффа */}
      {def.id === 'micellar-schiff-interfacial' && (() => {
        const hasMicelles = (params.cmcRatio ?? 3) >= 1
        return (
          <g>
            <text x="20" y="28" className="rx-lbl">
              {hasMicelles ? (en ? 'Above CMC: aldehyde trapped in micelle core' : 'Выше ККМ: альдегид заперт в ядре мицеллы') : (en ? 'Below CMC: direct aldehyde + amine attack!' : 'Ниже ККМ: прямая атака альдегида амином!')}
            </text>
            {/* Мицелла солюбилизатора */}
            {hasMicelles ? (
              <g transform="translate(154, 126)">
                <circle cx="0" cy="0" r="54" fill="rgba(14,165,233,0.12)" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="5 3" />
                {Array.from({ length: 14 }).map((_, i) => {
                  const a = (i * 2 * Math.PI) / 14
                  return (
                    <g key={i}>
                      <line x1={Math.cos(a) * 26} y1={Math.sin(a) * 26} x2={Math.cos(a) * 52} y2={Math.sin(a) * 52} stroke="#0284C7" strokeWidth="2" />
                      <circle cx={Math.cos(a) * 54} cy={Math.sin(a) * 54} r="4.5" fill="#0EA5E9" />
                    </g>
                  )
                })}
                <circle cx="0" cy="0" r="24" fill="#FDE68A" stroke="#D97706" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#78350F">R—CHO</text>
              </g>
            ) : (
              <g transform="translate(154, 126)" className="rx-pulse">
                <circle cx="0" cy="0" r="24" fill="#FDE68A" stroke="#D97706" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#78350F">R—CHO</text>
              </g>
            )}
            {/* Аминодонор в водной фазе */}
            <g transform="translate(278, 126)" className="rx-float">
              <circle cx="0" cy="0" r="22" fill="rgba(139,92,246,0.2)" stroke="#8B5CF6" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#6D28D9">R′—NH₂</text>
            </g>
            {/* Результат (свотч крема) */}
            <rect x="332" y="88" width="64" height="76" rx="14" fill={sim.swatchHex ?? '#F8FAFC'} stroke="#475569" strokeWidth="2" />
            <text x="364" y="182" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor">
              {en ? 'Cream color' : 'Цвет крема'}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

export default function ReactionsPage() {
  useTitle(tr('Реакции и механизмы'))
  const en = language === 'en'

  const [selectedId, setSelectedId] = useState<ReactionId>('saponification-stearate')
  const [paramState, setParamState] = useState<Record<ReactionId, Record<string, number>>>(() => {
    const init = {} as Record<ReactionId, Record<string, number>>
    for (const r of REACTIONS_CATALOG) init[r.id] = getDefaultReactionParams(r.id)
    return init
  })
  const [playing, setPlaying] = useState(true)

  const def = REACTIONS_CATALOG.find((r) => r.id === selectedId) ?? REACTIONS_CATALOG[0]
  const curParams = paramState[selectedId]
  const sim = useMemo(() => simulateReaction(selectedId, curParams), [selectedId, curParams])

  function setParam(paramId: string, val: number) {
    setParamState((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [paramId]: val },
    }))
  }

  function resetParams() {
    setParamState((prev) => ({
      ...prev,
      [selectedId]: getDefaultReactionParams(selectedId),
    }))
  }

  function copySmiles(smiles: string, name: string) {
    navigator.clipboard?.writeText(smiles).then(() => {
      showToast(`${tr('SMILES скопирован:')} ${name}`)
    }).catch(() => {})
  }

  // Геометрия графика кинетики SVG
  const W = 420
  const H = 225
  const padL = 44
  const padR = 16
  const padT = 16
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const xMin = sim.times[0] ?? 0
  const xMax = sim.tMax
  const xSpan = Math.max(0.001, xMax - xMin)
  const xOf = (t: number) => padL + ((t - xMin) / xSpan) * plotW
  const yOf = (v: number) => padT + plotH - (Math.min(sim.yMax, Math.max(0, v)) / sim.yMax) * plotH

  return (
    <div className="page reactions-page">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Реакции и механизмы косметической химии')}</h1>
        </div>
        <div className="row">
          <button type="button" className="btn small" onClick={() => setPlaying((p) => !p)}>
            {playing ? tr('⏸ Пауза анимации') : tr('▶ Запустить анимацию')}
          </button>
          <button type="button" className="btn small" onClick={resetParams}>
            {tr('Сбросить параметры')}
          </button>
        </div>
      </div>

      <p className="lead">
        {tr('Интерактивное моделирование ключевых органических и коллоидных реакций: меняйте температуру, pH, электролиты, антиоксиданты и солюбилизаторы, наблюдая кинетику и перестройку молекул в реальном времени.')}
      </p>

      {/* Переключатель 6 реакций */}
      <div className="rx-selector" role="tablist" aria-label={tr('Выбор реакции')}>
        {REACTIONS_CATALOG.map((item) => {
          const active = item.id === selectedId
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`rx-tab ${active ? 'on' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="rx-tab-cat">{en ? item.categoryEn : item.categoryRu}</span>
              <b>{en ? item.titleEn : item.titleRu}</b>
            </button>
          )
        })}
      </div>

      {/* Основная панель выбранной реакции */}
      <section className="panel rx-main">
        <div className="rx-head">
          <p className="eyebrow">{en ? def.categoryEn : def.categoryRu}</p>
          <h2>{en ? def.titleEn : def.titleRu}</h2>
          <p className="small muted">{en ? def.subtitleEn : def.subtitleRu}</p>
          <div className="rx-eq num">{en ? def.equationEn : def.equation}</div>
        </div>

        {/* Визуал механизма + график кинетики */}
        <div className="rx-visual-grid">
          <div className="rx-box">
            <div className="lab6-chart-head">
              <b>{tr('Молекулярно-коллоидный механизм')}</b>
              {sim.swatchHex && (
                <span className="rx-swatch-pill small">
                  <span className="rx-swatch-dot" style={{ background: sim.swatchHex }} />
                  {en ? sim.swatchLabelEn : sim.swatchLabelRu}
                </span>
              )}
            </div>
            <ReactionMechanismScene def={def} sim={sim} params={curParams} playing={playing} />
            <p className="small" style={{ margin: '6px 0 0' }}>
              {en ? def.mechanismSummaryEn : def.mechanismSummaryRu}
            </p>
          </div>

          <div className="rx-box">
            <div className="lab6-chart-head">
              <b>{tr('Расчётная кривая кинетики / равновесия')}</b>
              <span className="tag num">RK4 · {sim.times.length} pts</span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="lab6-rheogram"
              role="img"
              aria-label={tr('График кинетики реакции')}
            >
              {[0.25, 0.5, 0.75, 1].map((f) => {
                const y = padT + plotH * (1 - f)
                return (
                  <g key={f}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="currentColor" opacity="0.12" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3} textAnchor="end" className="lab6-axis-lbl">
                      {Math.round(sim.yMax * f)}
                    </text>
                  </g>
                )
              })}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const tVal = xMin + xSpan * f
                const x = xOf(tVal)
                return (
                  <g key={f}>
                    <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="currentColor" opacity="0.1" />
                    <text x={x} y={H - 16} textAnchor="middle" className="lab6-axis-lbl">
                      {xSpan <= 10 ? tVal.toFixed(1) : Math.round(tVal)}
                    </text>
                  </g>
                )
              })}
              <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" opacity="0.4" />
              <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="currentColor" opacity="0.4" />
              <text x={W / 2 + 14} y={H - 3} textAnchor="middle" className="lab6-axis-title">
                {en ? def.timeUnitEn : def.timeUnitRu}
              </text>
              <text
                x={12}
                y={padT + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90 12 ${padT + plotH / 2})`}
                className="lab6-axis-title"
              >
                {en ? sim.yUnitEn : sim.yUnitRu}
              </text>

              {sim.series.map((s) => {
                const d = s.values
                  .map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(sim.times[i]).toFixed(1)},${yOf(v).toFixed(1)}`)
                  .join(' ')
                return <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth="2.4" />
              })}
            </svg>
            <div className="row small" style={{ justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              {sim.series.map((s) => (
                <span key={s.id}>
                  <span className="swdot" style={{ background: s.color }} />
                  {en ? s.labelEn : s.labelRu}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Ползунки условий реакции */}
        <div className="rx-params-grid">
          {def.params.map((spec) => {
            const val = curParams[spec.id] ?? spec.defaultValue
            return (
              <label key={spec.id} className="rx-param-card">
                <span className="sb-param-head small">
                  <b>{en ? spec.labelEn : spec.labelRu}</b>
                  <b className="num">{val} {en ? spec.unitEn : spec.unitRu}</b>
                </span>
                <input
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={val}
                  onChange={(e) => setParam(spec.id, Number(e.target.value))}
                />
              </label>
            )
          })}
        </div>

        {/* Итоговые KPI + инженерный вердикт */}
        <dl className="outcome rx-kpis">
          {sim.kpis.map((k, idx) => (
            <div key={idx} className={k.tone ? `rx-tone-${k.tone}` : ''}>
              <dt>{en ? k.labelEn : k.labelRu}</dt>
              <dd className="num"><b>{k.value}</b></dd>
            </div>
          ))}
        </dl>

        <p className={`rx-verdict ${sim.collapseRatio >= 0.5 ? 'warn' : 'ok'}`} role="status">
          {en ? sim.verdictEn : sim.verdictRu}
        </p>

        {/* Пошаговый механизм + Молекулы/SMILES + Связанные темы */}
        <div className="rx-bottom-grid">
          <div className="rx-subcard">
            <h3>{tr('Стадии механизма')}</h3>
            <ol className="small rx-steps">
              {(en ? sim.stepsEn : sim.stepsRu).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          <div className="rx-subcard">
            <h3>{tr('Ключевые молекулы и SMILES (для хемоинформатики)')}</h3>
            <ul className="rx-mol-list small">
              {def.molecules.map((m) => (
                <li key={m.smiles}>
                  <div>
                    <b>{en ? m.nameEn : m.nameRu}</b> <span className="muted num">({m.formula})</span>
                    <div className="rx-smiles num">{m.smiles}</div>
                  </div>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => copySmiles(m.smiles, en ? m.nameEn : m.nameRu)}
                  >
                    SMILES
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {def.relatedTopicIds.length > 0 && (
          <div className="row small" style={{ marginTop: 10, alignItems: 'center' }}>
            <span className="muted"><b>{tr('Связанные темы курса:')}</b></span>
            {def.relatedTopicIds.map((tid) => {
              const t = topicById(tid)
              if (!t) return null
              return (
                <Link key={tid} className="chip" to={`/topics/${tid}`}>
                  {t.title} →
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
