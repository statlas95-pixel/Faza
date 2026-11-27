import { useMemo, useState } from 'react'
import { language, tr } from '../../shared/locale'
import type { FormulaEvaluation, FormulaInput } from '../../shared/formulation'
import {
  analyzePolarizedMicroscopy,
  BROOKFIELD_RPMS,
  BROOKFIELD_SPINDLES,
  computeRheogram,
  deriveRheologyModel,
  measureBrookfield,
  type BrookfieldSpindle,
} from '../../shared/formulation-lab6'

interface Lab6Props {
  formula: FormulaInput
  ev: FormulaEvaluation
}

interface QcLogEntry {
  id: string
  spindle: BrookfieldSpindle
  rpm: number
  tempC: number
  viscosityMPas: number
  torquePct: number
  shearRate: number
  valid: boolean
}

function fmtVis(v: number): string {
  if (v >= 10000) return `${Math.round(v).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')}`
  if (v >= 100) return `${Math.round(v)}`
  return v.toFixed(1)
}

/**
 * Лаборатория 6.0 (Направление G — «Живые приборы»):
 * 1) Цифровой вискозиметр Брукфильда (LV шпиндели S61–S64, об/мин, Torque 10–90 %,
 *    живая кривая течения и петля тиксотропии, журнал замеров).
 * 2) Поляризационный микроскоп (×100 / ×400, скрещённые поляризаторы 0°–90°,
 *    λ-пластина 530 нм: мальтийские кресты LGN, кристаллы, пигменты, пузырьки).
 */
export function Lab6Instruments({ formula, ev }: Lab6Props) {
  const rheo = useMemo(() => deriveRheologyModel(ev, formula), [ev, formula])
  const [spindle, setSpindle] = useState<BrookfieldSpindle>('S63')
  const [rpm, setRpm] = useState<number>(12)
  const [tempC, setTempC] = useState<number>(22)
  const [qcLog, setQcLog] = useState<QcLogEntry[]>([])

  const reading = useMemo(
    () => measureBrookfield(rheo, spindle, rpm, tempC),
    [rheo, spindle, rpm, tempC],
  )
  const rheogram = useMemo(() => computeRheogram(rheo, tempC), [rheo, tempC])

  // Поляризационный микроскоп
  const micro = useMemo(() => analyzePolarizedMicroscopy(ev, formula), [ev, formula])
  const [mag, setMag] = useState<100 | 400>(400)
  const [polAngle, setPolAngle] = useState<number>(90)
  const [lambdaPlate, setLambdaPlate] = useState<boolean>(false)

  const polRatio = Math.sin((polAngle * Math.PI) / 180) ** 2 // закон Малюса I ∝ sin²(θ) для скрещённых поляризаторов
  const isCrossed = polAngle >= 75

  function recordReading() {
    setQcLog((prev) => [
      {
        id: `${Date.now().toString(36)}-${prev.length}`,
        spindle: reading.spindle,
        rpm: reading.rpm,
        tempC: reading.tempC,
        viscosityMPas: reading.viscosityMPas,
        torquePct: reading.torquePct,
        shearRate: reading.shearRate,
        valid: reading.status === 'ok',
      },
      ...prev.slice(0, 5),
    ])
  }

  function applyOptimalSpindle() {
    setSpindle(reading.recommendedSpindle)
    setRpm(reading.recommendedRpm)
  }

  // Геометрия SVG реограммы (τ от γ̇)
  const W = 380
  const H = 220
  const padL = 46
  const padR = 16
  const padT = 16
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xOf = (g: number) => padL + (Math.min(rheogram.maxShearRate, g) / rheogram.maxShearRate) * plotW
  const yOf = (tau: number) => padT + plotH - (Math.min(rheogram.maxStressPa * 1.08, tau) / (rheogram.maxStressPa * 1.08)) * plotH

  const upPath = rheogram.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.shearRate).toFixed(1)},${yOf(p.stressUpPa).toFixed(1)}`)
    .join(' ')
  const downPath = [...rheogram.points]
    .reverse()
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.shearRate).toFixed(1)},${yOf(p.stressDownPa).toFixed(1)}`)
    .join(' ')
  const loopAreaPath = `${upPath} ${[...rheogram.points]
    .reverse()
    .map((p) => `L${xOf(p.shearRate).toFixed(1)},${yOf(p.stressDownPa).toFixed(1)}`)
    .join(' ')} Z`

  // Рабочая точка текущего замера Брукфильда на реограмме
  const curX = xOf(reading.shearRate)
  const curY = yOf(reading.shearStressPa)

  // Детерминированные координаты объектов в поле зрения микроскопа
  const dropletCoords = useMemo(() => {
    const scale = mag === 400 ? 1 : 0.56
    const base: [number, number, number][] = [
      [78, 72, 14], [128, 66, 12], [174, 88, 15], [96, 124, 16],
      [152, 136, 13], [116, 174, 15], [178, 168, 11], [66, 152, 12],
      [134, 102, 11], [92, 186, 10], [160, 56, 10], [194, 126, 13],
    ]
    if (mag === 100) {
      base.push(
        [58, 108, 11], [112, 48, 10], [186, 62, 11], [148, 192, 12],
        [74, 182, 10], [198, 162, 11], [136, 156, 10], [84, 96, 9],
      )
    }
    return base.map(([x, y, r]) => [x, y, r * scale] as const)
  }, [mag])

  const activeSpindleSpec = BROOKFIELD_SPINDLES.find((s) => s.id === spindle) ?? BROOKFIELD_SPINDLES[2]

  // Фон окуляра микроскопа плавно темнеет с ростом угла анализатора (0° = светлое поле, 90° = тёмное поле / λ-пурпурный)
  const bgBrightR = 247, bgBrightG = 249, bgBrightB = 252
  const bgDarkR = lambdaPlate ? 132 : 11
  const bgDarkG = lambdaPlate ? 38 : 16
  const bgDarkB = lambdaPlate ? 124 : 26
  const fieldFill = `rgb(${Math.round(bgBrightR + (bgDarkR - bgBrightR) * polRatio)}, ${Math.round(bgBrightG + (bgDarkG - bgBrightG) * polRatio)}, ${Math.round(bgBrightB + (bgDarkB - bgBrightB) * polRatio)})`
  const scaleBarColor = polRatio > 0.45 ? '#E2E8F0' : '#1E293B'

  const torqueClamped = Math.min(100, Math.max(0, reading.torquePct))
  const torqueClass =
    reading.status === 'ok' ? 'ok' : reading.status === 'under' ? 'under' : 'over'

  return (
    <div className="lab6-stack">
      {/* Прибор 1: Цифровой вискозиметр Брукфильда + живая реограмма */}
      <section className="panel lab6-panel" aria-label={tr('Цифровой вискозиметр Брукфильда')}>
        <div className="sandbox-head-row">
          <div>
            <p className="eyebrow">{tr('Лаборатория 6.0 · Ротационная реометрия')}</p>
            <h2>{tr('Цифровой вискозиметр Брукфильда и петля тиксотропии')}</h2>
          </div>
          <div className="row">
            <button type="button" className="btn small" onClick={applyOptimalSpindle}>
              {tr('Подобрать шпиндель')} ({reading.recommendedSpindle} · {reading.recommendedRpm})
            </button>
            <button type="button" className="btn small primary" onClick={recordReading}>
              {tr('+ Замер в протокол')}
            </button>
          </div>
        </div>

        <p className="small muted" style={{ marginTop: 4 }}>
          {tr('Прибор измеряет вашу текущую рецептуру в реальном времени. Подберите шпиндель (S61–S64) и обороты так, чтобы крутящий момент попал в достоверное окно Torque 10–90 %.')}
        </p>

        <div className="lab6-grid">
          {/* Левая колонка: ЖК-табло прибора + управление */}
          <div className="lab6-bezel">
            <div className={`lab6-lcd ${torqueClass}`}>
              <div className="lab6-lcd-top num">
                <span>BROOKFIELD LV · {reading.spindle}</span>
                <span>{reading.rpm} {tr('об/мин')} · {reading.tempC} °C</span>
              </div>
              <div className="lab6-lcd-main num">
                <div>
                  <span className="lab6-lcd-val">
                    {reading.status === 'over' ? 'EEEE' : fmtVis(reading.viscosityMPas)}
                  </span>
                  <span className="lab6-lcd-unit">{tr('мПа·с')}</span>
                </div>
                <div className="lab6-lcd-torque">
                  <span>TORQUE</span>
                  <b>{reading.torquePct > 199 ? '>199' : reading.torquePct} %</b>
                </div>
              </div>
              {/* Шкала Torque 0–100% с подсвеченным окном 10–90% */}
              <div className="lab6-torque-bar" aria-label={`Torque ${reading.torquePct}%`}>
                <div className="lab6-torque-window" />
                <div className={`lab6-torque-fill ${torqueClass}`} style={{ width: `${torqueClamped}%` }} />
              </div>
              <div className="lab6-lcd-sub num">
                <span>γ̇ = {reading.shearRate} {tr('с⁻¹')}</span>
                <span>τ = {reading.shearStressPa} {tr('Па')}</span>
                <span>FSR = {fmtVis(reading.fsrMPas)}</span>
              </div>
            </div>

            <p className={`lab6-status small ${torqueClass}`} role="status">
              {reading.statusText}
            </p>

            {/* Переключатель шпинделей */}
            <div className="lab6-ctrl-block">
              <div className="sb-param-head small">
                <b>{tr('Шпиндель (LV)')}</b>
                <span className="muted">{language === 'en' ? activeSpindleSpec.noteEn : activeSpindleSpec.noteRu}</span>
              </div>
              <div className="row" role="group" aria-label={tr('Выбор шпинделя Брукфильда')}>
                {BROOKFIELD_SPINDLES.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    className={`chip ${spindle === sp.id ? 'on' : ''}`}
                    onClick={() => setSpindle(sp.id)}
                  >
                    {sp.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Переключатель скорости вращения */}
            <div className="lab6-ctrl-block">
              <div className="sb-param-head small">
                <b>{tr('Скорость вращения (об/мин)')}</b>
                <b className="num">{rpm} {tr('об/мин')}</b>
              </div>
              <div className="row lab6-rpm-chips" role="group" aria-label={tr('Скорость вращения шпинделя')}>
                {BROOKFIELD_RPMS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`chip ${rpm === v ? 'on' : ''}`}
                    onClick={() => setRpm(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Температура образца */}
            <label className="lab6-ctrl-block">
              <span className="sb-param-head small">
                <b>{tr('Температура образца (термостат)')}</b>
                <b className="num">{tempC} °C</b>
              </span>
              <input
                type="range"
                min={15}
                max={45}
                step={1}
                value={tempC}
                onChange={(e) => setTempC(Number(e.target.value))}
              />
            </label>
          </div>

          {/* Правая колонка: Кривая течения τ(γ̇) и петля гистерезиса */}
          <div className="lab6-chart-col">
            <div className="lab6-chart-head">
              <b>{tr('Кривая течения и тиксотропная петля')}</b>
              <span className="tag">{rheo.regimeLabel}</span>
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="lab6-rheogram"
              role="img"
              aria-label={tr('Кривая течения и петля тиксотропии рецептуры')}
            >
              {/* Сетка */}
              {[0.25, 0.5, 0.75, 1].map((f) => {
                const y = padT + plotH * (1 - f)
                const val = (rheogram.maxStressPa * 1.08 * f).toFixed(0)
                return (
                  <g key={f}>
                    <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="currentColor" opacity="0.12" strokeDasharray="3 3" />
                    <text x={padL - 6} y={y + 3} textAnchor="end" className="lab6-axis-lbl">{val}</text>
                  </g>
                )
              })}
              {[0, 25, 50, 75, 100].map((g) => {
                const x = xOf(g)
                return (
                  <g key={g}>
                    <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="currentColor" opacity="0.1" />
                    <text x={x} y={H - 16} textAnchor="middle" className="lab6-axis-lbl">{g}</text>
                  </g>
                )
              })}
              {/* Оси */}
              <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="currentColor" opacity="0.4" />
              <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="currentColor" opacity="0.4" />
              <text x={W / 2 + 12} y={H - 3} textAnchor="middle" className="lab6-axis-title">
                {tr('Скорость сдвига γ̇, с⁻¹')}
              </text>
              <text
                x={12}
                y={padT + plotH / 2}
                textAnchor="middle"
                transform={`rotate(-90 12 ${padT + plotH / 2})`}
                className="lab6-axis-title"
              >
                {tr('Напряжение τ, Па')}
              </text>

              {/* Петля гистерезиса */}
              <path d={loopAreaPath} fill="rgba(14,165,233,0.16)" />
              <path d={upPath} fill="none" stroke="#0EA5E9" strokeWidth="2.4" />
              <path d={downPath} fill="none" stroke="#F97316" strokeWidth="2" strokeDasharray="5 3" />

              {/* Текущая точка замера Брукфильда */}
              <line x1={curX} y1={padT + plotH} x2={curX} y2={curY} stroke="#EF4444" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
              <circle cx={curX} cy={curY} r="5.5" fill={reading.status === 'ok' ? '#10B981' : '#EF4444'} stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            <div className="row small" style={{ gap: 14, justifyContent: 'center', marginTop: 4 }}>
              <span><span className="swdot" style={{ background: '#0EA5E9' }} />{tr('Прямой ход (разгон)')}</span>
              <span><span className="swdot" style={{ background: '#F97316' }} />{tr('Обратный ход (сброс)')}</span>
              <span><span className="swdot" style={{ background: reading.status === 'ok' ? '#10B981' : '#EF4444' }} />{tr('Точка Брукфильда')}</span>
            </div>

            <dl className="outcome lab6-kpis">
              <div>
                <dt>{tr('Предел текучести τ₀')}</dt>
                <dd className="num"><b>{rheo.yieldStressPa} {tr('Па')}</b></dd>
              </div>
              <div>
                <dt>{tr('Индекс течения n')}</dt>
                <dd className="num"><b>{rheo.flowIndexN}</b></dd>
              </div>
              <div>
                <dt>{tr('Площадь тиксотропии')}</dt>
                <dd className="num"><b>{rheogram.hysteresisAreaPaPerS} {tr('Па/с')}</b></dd>
              </div>
              <div>
                <dt>{tr('Индекс разжижения η₁/η₁₀')}</dt>
                <dd className="num"><b>{rheogram.shearThinningRatio}×</b></dd>
              </div>
            </dl>

            <ul className="linklist small" style={{ marginTop: 8 }}>
              {rheo.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        </div>

        {qcLog.length > 0 && (
          <div className="lab6-log">
            <div className="sandbox-head-row">
              <b className="small">{tr('Протокол контрольных замеров вязкости')}</b>
              <button type="button" className="btn small ghost" onClick={() => setQcLog([])}>
                {tr('Очистить протокол')}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr('Шпиндель')}</th>
                    <th>{tr('Об/мин')}</th>
                    <th>T, °C</th>
                    <th>γ̇, {tr('с⁻¹')}</th>
                    <th>η, {tr('мПа·с')}</th>
                    <th>Torque, %</th>
                    <th>{tr('Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {qcLog.map((row) => (
                    <tr key={row.id}>
                      <td className="num">{row.spindle}</td>
                      <td className="num">{row.rpm}</td>
                      <td className="num">{row.tempC}</td>
                      <td className="num">{row.shearRate}</td>
                      <td className="num"><b>{fmtVis(row.viscosityMPas)}</b></td>
                      <td className="num">{row.torquePct} %</td>
                      <td>{row.valid ? tr('✓ В окне') : tr('⚠ Вне окна')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Прибор 2: Поляризационный микроскоп (×100 / ×400, поляризатор 0°–90°) */}
      <section className="panel lab6-panel" aria-label={tr('Поляризационный микроскоп')}>
        <div className="sandbox-head-row">
          <div>
            <p className="eyebrow">{tr('Лаборатория 6.0 · Оптическая и поляризационная микроскопия')}</p>
            <h2>{tr('Поляризационный микроскоп (×100 / ×400 · поляризатор 90°)')}</h2>
          </div>
          <div className="row">
            <button
              type="button"
              className={`chip ${!isCrossed ? 'on' : ''}`}
              onClick={() => setPolAngle(0)}
            >
              {tr('Светлое поле 0°')}
            </button>
            <button
              type="button"
              className={`chip ${isCrossed ? 'on' : ''}`}
              onClick={() => setPolAngle(90)}
            >
              {tr('Поляризатор 90°')}
            </button>
          </div>
        </div>

        <div className="lab6-micro-grid">
          {/* Круглый окуляр поляризационного микроскопа */}
          <div className="lab6-scope-wrap">
            <svg
              viewBox="0 0 260 260"
              className="lab6-scope-svg"
              role="img"
              aria-label={isCrossed ? micro.polarizedVerdict : micro.brightfieldVerdict}
            >
              <defs>
                <clipPath id="lab6-lens-clip">
                  <circle cx="130" cy="130" r="112" />
                </clipPath>
                {/* Радиальное свечение для анизотропного мальтийского креста */}
                <radialGradient id="lab6-maltese-glow">
                  <stop offset="18%" stopColor={lambdaPlate ? '#38BDF8' : '#FEF08A'} stopOpacity="0.95" />
                  <stop offset="68%" stopColor={lambdaPlate ? '#FACC15' : '#FFFFFF'} stopOpacity="0.82" />
                  <stop offset="100%" stopColor={lambdaPlate ? '#38BDF8' : '#BAE6FD'} stopOpacity="0" />
                </radialGradient>
                <radialGradient id="lab6-vignette">
                  <stop offset="76%" stopColor="rgba(0,0,0,0)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.34)" />
                </radialGradient>
              </defs>

              {/* Корпус окуляра */}
              <circle cx="130" cy="130" r="122" fill="#0F172A" stroke="rgba(148,163,184,0.45)" strokeWidth="3" />
              <circle cx="130" cy="130" r="112" fill={fieldFill} />

              <g clipPath="url(#lab6-lens-clip)">
                {/* 1. Светлопольные капли эмульсии (исчезают при 90°, т.к. изотропны) */}
                {(micro.emulsionState === 'fine' || micro.emulsionState === 'wo') && (
                  <g opacity={Math.max(0.06, 1 - polRatio * 0.94)}>
                    {dropletCoords.map(([x, y, r], idx) => (
                      <circle
                        key={`d-${idx}`}
                        cx={x}
                        cy={y}
                        r={r * (micro.emulsionState === 'wo' ? 0.72 : 0.62)}
                        fill={micro.emulsionState === 'wo' ? 'rgba(56,189,248,0.32)' : 'rgba(245,158,11,0.28)'}
                        stroke={micro.emulsionState === 'wo' ? '#0284C7' : '#B45309'}
                        strokeWidth="1.2"
                      />
                    ))}
                  </g>
                )}

                {micro.emulsionState === 'coarse' && (
                  <g opacity={Math.max(0.1, 1 - polRatio * 0.88)}>
                    {[
                      [86, 94, mag === 400 ? 34 : 21],
                      [164, 108, mag === 400 ? 28 : 17],
                      [116, 168, mag === 400 ? 30 : 18],
                      [178, 166, mag === 400 ? 18 : 11],
                      [70, 152, mag === 400 ? 15 : 9],
                    ].map(([x, y, r], idx) => (
                      <circle
                        key={`c-${idx}`}
                        cx={x}
                        cy={y}
                        r={r}
                        fill="rgba(245,158,11,0.38)"
                        stroke="#9A3412"
                        strokeWidth="1.8"
                      />
                    ))}
                  </g>
                )}

                {/* 2. Мальтийские кресты LGN (вспыхивают в скрещённых поляризаторах!) */}
                {micro.hasMalteseCrosses && polRatio > 0.08 && (
                  <g opacity={Math.min(1, polRatio * micro.lgnIntensity * 1.15)}>
                    {dropletCoords.map(([x, y, r], idx) => {
                      const R = r * 1.12
                      return (
                        <g key={`m-${idx}`} transform={`translate(${x} ${y}) rotate(${90 - polAngle})`}>
                          <circle cx="0" cy="0" r={R} fill="url(#lab6-maltese-glow)" />
                          {/* Четыре тёмных луча гашения (мальтийский крест) */}
                          <path
                            d={`M0,0 L${-R * 0.24},${-R} L${R * 0.24},${-R} Z M0,0 L${-R * 0.24},${R} L${R * 0.24},${R} Z M0,0 L${-R},${-R * 0.24} L${-R},${R * 0.24} Z M0,0 L${R},${-R * 0.24} L${R},${R * 0.24} Z`}
                            fill={fieldFill}
                          />
                          <circle cx="0" cy="0" r={R * 0.22} fill={fieldFill} />
                        </g>
                      )
                    })}
                  </g>
                )}

                {/* 3. Двулучепреломляющие кристаллы (видны в светлом поле, ярко вспыхивают при 90°) */}
                {micro.hasCrystals && (
                  <g>
                    {[
                      [76, 118, 132, 82],
                      [122, 166, 192, 118],
                      [84, 178, 146, 148],
                      [140, 74, 188, 108],
                      [62, 142, 102, 134],
                    ].map(([x1, y1, x2, y2], idx) => (
                      <line
                        key={`cr-${idx}`}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={polRatio > 0.35 ? (idx % 2 === 0 ? '#38BDF8' : '#FDE047') : '#475569'}
                        strokeWidth={polRatio > 0.35 ? 3.2 : 2}
                        strokeLinecap="round"
                        opacity={0.7 + polRatio * 0.3}
                      />
                    ))}
                  </g>
                )}

                {/* 4. Пигменты и минеральные УФ-фильтры */}
                {micro.hasPigments && (
                  micro.pigmentsAgglomerated ? (
                    <g fill={polRatio > 0.5 ? '#475569' : '#334155'} stroke="#0F172A" strokeWidth="1.2" opacity="0.92">
                      <path d="M72 86 Q86 72 104 82 Q112 98 94 108 Q74 106 72 86 Z" />
                      <path d="M148 136 Q168 122 188 138 Q192 158 168 164 Q146 156 148 136 Z" />
                      <path d="M98 164 Q112 156 124 168 Q120 184 102 182 Z" />
                    </g>
                  ) : (
                    <g fill={polRatio > 0.5 ? '#94A3B8' : '#64748B'} opacity="0.72">
                      {[
                        [64, 96], [82, 114], [108, 86], [134, 78], [156, 98], [182, 112],
                        [74, 146], [104, 152], [132, 140], [164, 154], [142, 178], [96, 184],
                      ].map(([x, y], idx) => <circle key={`p-${idx}`} cx={x} cy={y} r={mag === 400 ? 2.4 : 1.5} />)}
                    </g>
                  )
                )}

                {/* 5. Ионные хлопья */}
                {micro.hasIonicFlocs && (
                  <g fill="rgba(148,163,184,0.6)" stroke="#64748B" strokeWidth="1.2" opacity={1 - polRatio * 0.5}>
                    <path d="M70 112 Q88 94 114 108 Q122 128 96 138 Q68 134 70 112 Z" />
                    <path d="M142 146 Q166 130 188 150 Q182 176 154 172 Q132 166 142 146 Z" />
                  </g>
                )}

                {/* 6. Пузырьки воздуха (толстая тёмная кайма в светлом поле, полностью гаснут при 90°) */}
                {micro.hasAirBubbles && (
                  <g opacity={Math.max(0, 1 - polRatio * 1.15)}>
                    <circle cx="176" cy="84" r={mag === 400 ? 11 : 6.5} fill="rgba(255,255,255,0.65)" stroke="#0F172A" strokeWidth="3.2" />
                    <circle cx="88" cy="176" r={mag === 400 ? 8 : 5} fill="rgba(255,255,255,0.65)" stroke="#0F172A" strokeWidth="2.6" />
                  </g>
                )}

                {/* Виньетка объектива */}
                <circle cx="130" cy="130" r="112" fill="url(#lab6-vignette)" />
              </g>

              {/* Шкала и метка режима поверх окуляра */}
              <line x1="158" y1="214" x2="206" y2="214" stroke={scaleBarColor} strokeWidth="2.4" />
              <text x="182" y="208" textAnchor="middle" fontSize="11" fontWeight="600" fill={scaleBarColor}>
                {mag === 400 ? '20 μm' : '100 μm'}
              </text>
              <text x="130" y="34" textAnchor="middle" fontSize="10.5" fontWeight="600" fill={scaleBarColor} opacity="0.88">
                ×{mag} · {polAngle}°{lambdaPlate ? ' · λ 530 nm' : ''}
              </text>
            </svg>
          </div>

          {/* Панель управления оптикой и интерпретации */}
          <div className="lab6-micro-ctrl">
            <div className="lab6-ctrl-block">
              <div className="sb-param-head small">
                <b>{tr('Объектив (увеличение)')}</b>
                <b className="num">×{mag}</b>
              </div>
              <div className="row">
                <button type="button" className={`chip ${mag === 100 ? 'on' : ''}`} onClick={() => setMag(100)}>
                  ×100 ({tr('обзор поля')})
                </button>
                <button type="button" className={`chip ${mag === 400 ? 'on' : ''}`} onClick={() => setMag(400)}>
                  ×400 ({tr('капли и LGN')})
                </button>
              </div>
            </div>

            <label className="lab6-ctrl-block">
              <span className="sb-param-head small">
                <b>{tr('Угол анализатора (поляризация)')}</b>
                <b className="num">{polAngle}° {polAngle === 0 ? `(${tr('светлое поле')})` : polAngle === 90 ? `(${tr('скрещённые 90°')})` : ''}</b>
              </span>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={polAngle}
                onChange={(e) => setPolAngle(Number(e.target.value))}
              />
            </label>

            <label className="lab6-lambda-toggle small">
              <input
                type="checkbox"
                checked={lambdaPlate}
                onChange={(e) => setLambdaPlate(e.target.checked)}
              />
              <span>{tr('Компенсатор λ-пластина (530 нм) — цветной контраст двулучепреломления')}</span>
            </label>

            <dl className="outcome lab6-micro-kpis">
              <div>
                <dt>{tr('Светлое поле (0°)')}</dt>
                <dd>{micro.brightfieldVerdict}</dd>
              </div>
              <div>
                <dt>{tr('Скрещённые поляризаторы (90°)')}</dt>
                <dd><b>{micro.polarizedVerdict}</b></dd>
              </div>
            </dl>

            <ul className="linklist small" style={{ marginTop: 8 }}>
              {micro.findings.map((f, idx) => (
                <li key={idx} className={f.kind === 'warn' ? 'warnline' : ''}>
                  {f.kind === 'ok' ? '✓ ' : f.kind === 'warn' ? '⚠ ' : '• '}{f.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
