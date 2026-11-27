import { useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import type { FormulaEvaluation, FormulaInput, Ingredient, SandboxPreset } from '../../shared/formulation'
import { analyzeSpfAndPigments, compareFormulasAB } from '../../shared/formulation-lab5'
import type { SavedFormulaRecord } from '../store'

interface Lab5Props {
  formula: FormulaInput
  ev: FormulaEvaluation
  catalog: Ingredient[]
  savedFormulas: SavedFormulaRecord[]
  presets: SandboxPreset[]
}

/** Панели «Лаборатории 5.0»: 1) Оптический анализ SPF / пигментов; 2) A/B-сравнение двух рецептур с наложенным радаром. */
export function Lab5Panels({ formula, ev, catalog, savedFormulas, presets }: Lab5Props) {
  const spfPigment = useMemo(() => analyzeSpfAndPigments(ev, formula), [ev, formula])
  const [compareOpen, setCompareOpen] = useState(false)
  const [refKey, setRefKey] = useState<string>(() =>
    savedFormulas[0] ? `saved:${savedFormulas[0].id}` : presets[0] ? `preset:${presets[0].id}` : '',
  )

  const refTarget = useMemo<{ label: string; formula: FormulaInput } | null>(() => {
    if (refKey.startsWith('saved:')) {
      const id = refKey.slice(6)
      const f = savedFormulas.find((x) => x.id === id)
      if (f) return { label: f.name, formula: f.formula }
    }
    if (refKey.startsWith('preset:')) {
      const id = refKey.slice(7)
      const p = presets.find((x) => x.id === id)
      if (p) {
        return {
          label: tr(p.title),
          formula: {
            productType: p.productType,
            targetPh: p.targetPh,
            batchGrams: p.batchGrams,
            phaseTempC: { ...p.phaseTempC },
            rows: p.rows.map((r) => ({ ...r })),
          },
        }
      }
    }
    if (savedFormulas[0]) return { label: savedFormulas[0].name, formula: savedFormulas[0].formula }
    if (presets[0]) {
      const p = presets[0]
      return {
        label: tr(p.title),
        formula: {
          productType: p.productType,
          targetPh: p.targetPh,
          batchGrams: p.batchGrams,
          phaseTempC: { ...p.phaseTempC },
          rows: p.rows.map((r) => ({ ...r })),
        },
      }
    }
    return null
  }, [refKey, savedFormulas, presets])

  const ab = useMemo(
    () => (compareOpen && refTarget ? compareFormulasAB(formula, refTarget.formula, catalog) : null),
    [compareOpen, refTarget, formula, catalog],
  )

  // Геометрия двойной 6-осевой сенсорной паутинки
  const cx = 160, cy = 140, R = 88
  const point = (index: number, total: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total
    return [cx + Math.cos(angle) * R * ratio, cy + Math.sin(angle) * R * ratio] as const
  }

  return (
    <>
      {spfPigment && (
        <section className="panel lab4-panel">
          <h2>
            {spfPigment.hasUvFilters && spfPigment.hasPigments
              ? tr('Анализатор SPF / UVA-PF и пигментной суспензии')
              : spfPigment.hasUvFilters
                ? tr('Оценка солнцезащитной матрицы (in-silico SPF / UVA-PF)')
                : tr('Анализ пигментной нагрузки и суспензии')}
          </h2>

          <dl className="outcome">
            {spfPigment.hasUvFilters && (
              <>
                <div>
                  <dt>{tr('Оценка in-silico SPF')}</dt>
                  <dd className="num"><b>SPF {spfPigment.estimatedSpf}</b></dd>
                </div>
                <div>
                  <dt>{tr('UVA-PF и кружок ЕС')}</dt>
                  <dd className="num">
                    {spfPigment.estimatedUvaPf} ({spfPigment.uvaRatio}{' '}
                    {spfPigment.uvaCirclePass ? '✓ UVA' : '⚠ < 0.33'})
                  </dd>
                </div>
                <div>
                  <dt>{tr('Растворимость твёрдых УФ')}</dt>
                  <dd className="num">
                    {spfPigment.polarSolventPct} / {spfPigment.minPolarNeededPct} %
                  </dd>
                </div>
              </>
            )}
            {spfPigment.hasPigments && (
              <>
                <div>
                  <dt>{tr('Сумма пигментов и пудр')}</dt>
                  <dd className="num"><b>{spfPigment.pigmentLoadPct} %</b></dd>
                </div>
                <div>
                  <dt>{tr('Маслоёмкость фазы B')}</dt>
                  <dd className="num">~{spfPigment.oilAbsorptionGramsPer100} {tr('г/100 г')}</dd>
                </div>
                <div>
                  <dt>{tr('Диспергатор / Тиксотроп')}</dt>
                  <dd className="num">
                    {spfPigment.hasDispersant ? '✓' : '✕'} / {spfPigment.hasSuspender ? '✓' : '✕'}
                  </dd>
                </div>
              </>
            )}
          </dl>

          <ul className="linklist" style={{ marginTop: 10 }}>
            {spfPigment.notes.map((n, idx) => (
              <li key={idx} className={n.kind === 'warn' ? 'warnline' : 'small'}>
                {n.kind === 'ok' ? '✓ ' : '⚠ '}{n.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel lab4-panel">
        <div className="sandbox-head-row">
          <div>
            <h2>{tr('Матрица сравнения рецептур A / B и двойной сенсорный радар')}</h2>
          </div>
          <button type="button" className="btn" onClick={() => setCompareOpen((v) => !v)}>
            {compareOpen ? tr('Свернуть A/B-сравнение') : tr('⚖ Сравнить с эталоном (A / B)')}
          </button>
        </div>

        {compareOpen && refTarget && ab && (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 14 }}>
              <label style={{ flex: 1, minWidth: 240 }}>
                <span className="small"><b>{tr('Эталонная рецептура B для сравнения:')}</b></span>
                <select value={refKey} onChange={(e) => setRefKey(e.target.value)}>
                  {savedFormulas.length > 0 && (
                    <optgroup label={tr('Мои сохранённые рецептуры')}>
                      {savedFormulas.map((sf) => (
                        <option key={sf.id} value={`saved:${sf.id}`}>{sf.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={tr('Базовые шаблоны Лаборатории')}>
                    {presets.map((p) => (
                      <option key={p.id} value={`preset:${p.id}`}>{tr(p.title)}</option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>

            <div className="comp-grid">
              <div className="comp-radar-wrap">
                <svg viewBox="0 0 320 280" className="comp-radar" role="img" aria-label={tr('Двойная сенсорная паутинка A/B')}>
                  {[0.25, 0.5, 0.75, 1].map((r) => {
                    const pts = ab.sensoryA.axes
                      .map((_, i) => point(i, ab.sensoryA.axes.length, r).map((v) => v.toFixed(1)).join(','))
                      .join(' ')
                    return <polygon key={r} points={pts} fill="none" stroke="currentColor" opacity="0.18" />
                  })}
                  {ab.sensoryA.axes.map((ax, i) => {
                    const [x2, y2] = point(i, ab.sensoryA.axes.length, 1)
                    const [lx, ly] = point(i, ab.sensoryA.axes.length, 1.23)
                    return (
                      <g key={ax.id}>
                        <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" opacity="0.16" />
                        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="comp-radar-lbl">
                          {tr(ax.shortLabel)}
                        </text>
                      </g>
                    )
                  })}
                  {/* Полигон B (коралловый пунктир) */}
                  <polygon
                    points={ab.sensoryB.axes
                      .map((ax, i) => point(i, ab.sensoryB.axes.length, Math.max(0.08, ax.score / 100)).map((v) => v.toFixed(1)).join(','))
                      .join(' ')}
                    fill="rgba(249,115,22,0.18)"
                    stroke="#F97316"
                    strokeWidth="2"
                    strokeDasharray="5 3"
                  />
                  {/* Полигон A (небесно-голубой сплошной) */}
                  <polygon
                    points={ab.sensoryA.axes
                      .map((ax, i) => point(i, ab.sensoryA.axes.length, Math.max(0.08, ax.score / 100)).map((v) => v.toFixed(1)).join(','))
                      .join(' ')}
                    fill="rgba(14,165,233,0.24)"
                    stroke="#0EA5E9"
                    strokeWidth="2.4"
                  />
                </svg>
                <div className="row small" style={{ justifyContent: 'center', gap: 14 }}>
                  <span><span className="swdot" style={{ background: '#0EA5E9' }} /><b>A:</b> {tr('Текущая формула')}</span>
                  <span><span className="swdot" style={{ background: '#F97316' }} /><b>B:</b> {refTarget.label}</span>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tr('Показатель')}</th>
                      <th>A · {tr('Текущая')}</th>
                      <th>B · {refTarget.label}</th>
                      <th>Δ (A − B)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{tr('Стоимость сырья, ₽/кг')}</td>
                      <td className="num"><b>{ab.evA.costPerKg}</b></td>
                      <td className="num">{ab.evB.costPerKg}</td>
                      <td className="num">{ab.costDeltaPerKg > 0 ? `+${ab.costDeltaPerKg}` : ab.costDeltaPerKg}</td>
                    </tr>
                    <tr>
                      <td>{tr('Масляная фаза, %')}</td>
                      <td className="num">{ab.evA.oilPhasePct} %</td>
                      <td className="num">{ab.evB.oilPhasePct} %</td>
                      <td className="num">{ab.oilDeltaPct > 0 ? `+${ab.oilDeltaPct}` : ab.oilDeltaPct} %</td>
                    </tr>
                    <tr>
                      <td>{tr('ГЛБ (треб. / факт.)')}</td>
                      <td className="num">{ab.evA.requiredHlb ?? '—'} / {ab.evA.actualHlb ?? '—'}</td>
                      <td className="num">{ab.evB.requiredHlb ?? '—'} / {ab.evB.actualHlb ?? '—'}</td>
                      <td className="num">Δ {ab.evA.hlbDelta ?? '—'} vs {ab.evB.hlbDelta ?? '—'}</td>
                    </tr>
                    <tr>
                      <td>{tr('Ошибки / предупреждения')}</td>
                      <td className="num">{ab.evA.errorsCount} / {ab.evA.warningsCount}</td>
                      <td className="num">{ab.evB.errorsCount} / {ab.evB.warningsCount}</td>
                      <td className="num">{ab.evA.errorsCount - ab.evB.errorsCount}</td>
                    </tr>
                    <tr>
                      <td>{tr('Сенсорный архетип')}</td>
                      <td className="small">{tr(ab.sensoryA.archetype)}</td>
                      <td className="small">{tr(ab.sensoryB.archetype)}</td>
                      <td className="small">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
