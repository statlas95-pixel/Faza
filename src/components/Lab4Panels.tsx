import { useState } from 'react'
import { tr } from '../../shared/locale'
import type { FormulaEvaluation } from '../../shared/formulation'
import { computeSurfactantProfile, computeUnitEconomics } from '../../shared/formulation-lab4'

const PACK_PRESETS = [
  { id: 'tube50', label: 'Туба 50 мл (ПЭ/АБЛ)', unitGrams: 50, packagingRub: 28, labelRub: 8, laborRub: 18 },
  { id: 'airless50', label: 'Airless-флакон 50 мл', unitGrams: 50, packagingRub: 68, labelRub: 10, laborRub: 22 },
  { id: 'jar50', label: 'Банка 50 мл + вкладыш', unitGrams: 50, packagingRub: 46, labelRub: 12, laborRub: 20 },
  { id: 'bottle250', label: 'Флакон 250 мл (шампунь/гель)', unitGrams: 250, packagingRub: 34, labelRub: 10, laborRub: 16 },
]

/** Панель экономики 1 единицы (COGS) + профиль активных ПАВ (% ASM) — Лаборатория 4.0. */
export function Lab4Panels({ ev, batchGrams }: { ev: FormulaEvaluation; batchGrams: number }) {
  const [unitGrams, setUnitGrams] = useState(50)
  const [lossPct, setLossPct] = useState(5)
  const [packagingRub, setPackagingRub] = useState(28)
  const [labelRub, setLabelRub] = useState(8)
  const [laborRub, setLaborRub] = useState(18)

  const econ = computeUnitEconomics(ev, batchGrams, { unitGrams, lossPct, packagingRub, labelRub, laborRub })
  const asm = computeSurfactantProfile(ev)

  return (
    <>
      {asm && (
        <section className="panel lab4-panel">
          <p className="eyebrow">{tr('Анализ моющей / кондиционирующей базы')}</p>
          <h2>{tr('Активные ПАВ (% ASM) и индекс мягкости')}</h2>
          <dl className="outcome">
            <div><dt>{tr('Сумма активных ПАВ (ASM)')}</dt><dd className="num">{asm.totalAsmPct} %</dd></div>
            <div><dt>{tr('Анионные / Амфотерные')}</dt><dd className="num">{asm.anionicPct}% / {asm.amphotericPct}%</dd></div>
            <div><dt>{tr('Неионогенные / Катионные')}</dt><dd className="num">{asm.nonionicPct}% / {asm.cationicPct}%</dd></div>
            <div><dt>{tr('Соотношение со-ПАВ : анион.')}</dt><dd className="num">{asm.coToAnionicRatio !== null ? `${asm.coToAnionicRatio} : 1` : '—'}</dd></div>
          </dl>
          <p style={{ marginTop: 12 }}>
            <span className={`verdict ${asm.mildnessVerdict === 'intense' ? 'weak' : 'ok'}`}>
              {tr(asm.mildnessLabel)}
            </span>{' '}
            <span className="small"><b>{tr('Категория:')}</b> {tr(asm.categoryFit)}</span>
          </p>
          <p className="small muted" style={{ marginBottom: 0 }}>{tr(asm.advice)}</p>
        </section>
      )}

      <section className="panel lab4-panel">
        <div className="sandbox-head-row">
          <div>
            <p className="eyebrow">{tr('Экономика R&D (COGS на 1 готовую единицу)')}</p>
            <h2>{tr('Себестоимость флакона с учётом тары и потерь')}</h2>
          </div>
          <div className="row">
            {PACK_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => {
                  setUnitGrams(p.unitGrams)
                  setPackagingRub(p.packagingRub)
                  setLabelRub(p.labelRub)
                  setLaborRub(p.laborRub)
                }}
              >
                {tr(p.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="lab4-econ-grid">
          <label>
            <span className="small">{tr('Наполнение, г')}</span>
            <input type="number" min="5" max="5000" step="5" value={unitGrams} onChange={(e) => setUnitGrams(Math.max(1, Number(e.target.value) || 50))} />
          </label>
          <label>
            <span className="small">{tr('Потери варки/фасовки, %')}</span>
            <input type="number" min="0" max="30" step="1" value={lossPct} onChange={(e) => setLossPct(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label>
            <span className="small">{tr('Тара (флакон/туба), ₽')}</span>
            <input type="number" min="0" step="2" value={packagingRub} onChange={(e) => setPackagingRub(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label>
            <span className="small">{tr('Этикетка / коробка, ₽')}</span>
            <input type="number" min="0" step="1" value={labelRub} onChange={(e) => setLabelRub(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label>
            <span className="small">{tr('Варка + фасовка, ₽')}</span>
            <input type="number" min="0" step="1" value={laborRub} onChange={(e) => setLaborRub(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        </div>

        <dl className="outcome">
          <div><dt>{tr('Масса + потери')} ({lossPct}%)</dt><dd className="num">{econ.bulkCostPerUnit} ₽</dd></div>
          <div><dt>{tr('Тара + этикетка + работа')}</dt><dd className="num">{econ.packagingTotal} ₽</dd></div>
          <div><dt>{tr('Итого COGS за 1 шт.')}</dt><dd className="num"><b>{econ.totalCogs} ₽</b></dd></div>
          <div><dt>{tr('Выход из партии')} ({batchGrams} {tr('г')})</dt><dd className="num">{econ.unitsPerBatch} {tr('шт.')}</dd></div>
        </dl>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          {tr('Ориентир розничной цены (маржа ритейла/маркетплейса ×3…×5):')} <b className="num">{econ.suggestedRetail3x} – {econ.suggestedRetail5x} ₽</b>
        </p>
      </section>
    </>
  )
}
