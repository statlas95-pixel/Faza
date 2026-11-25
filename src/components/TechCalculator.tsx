import { useState } from 'react'
import { tr } from '../../shared/locale'
import { convertCommercialRaw, diluteSolution, solveHlbMix } from '../../shared/formulation-sim'

type Tab = 'raw' | 'hlb' | 'dilute'

/** Выдвижной «Калькулятор технолога» — доступен с любой страницы платформы. */
export function TechCalculator() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('raw')

  // Пересчёт товарного сырья
  const [activePct, setActivePct] = useState('10')
  const [assayPct, setAssayPct] = useState('27')
  const [batchG, setBatchG] = useState('1000')

  // Правило креста (ГЛБ)
  const [hlb1, setHlb1] = useState('4.7')
  const [hlb2, setHlb2] = useState('14.9')
  const [targetHlb, setTargetHlb] = useState('9.5')
  const [totalEmul, setTotalEmul] = useState('4')

  // Разведение раствора
  const [c1, setC1] = useState('50')
  const [c2, setC2] = useState('10')
  const [targetG, setTargetG] = useState('200')

  const rawRes = convertCommercialRaw(Number(activePct), Number(assayPct), Number(batchG))
  const hlbRes = solveHlbMix(Number(hlb1), Number(hlb2), Number(targetHlb), Number(totalEmul))
  const dilRes = diluteSolution(Number(c1), Number(c2), Number(targetG))

  return (
    <>
      <button
        type="button"
        className="calc-fab"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        🧮 <span>{tr('Калькулятор')}</span>
      </button>

      {open && (
        <aside className="calc-drawer" role="dialog" aria-label={tr('Калькулятор технолога')}>
          <header>
            <b>{tr('Калькулятор технолога')}</b>
            <button type="button" className="btn" onClick={() => setOpen(false)} aria-label={tr('Закрыть')}>
              ×
            </button>
          </header>

          <div className="seg calc-tabs" role="tablist">
            <label className={tab === 'raw' ? 'on' : ''}>
              <input type="radio" name="calc-tab" checked={tab === 'raw'} onChange={() => setTab('raw')} />
              {tr('Сырьё %')}
            </label>
            <label className={tab === 'hlb' ? 'on' : ''}>
              <input type="radio" name="calc-tab" checked={tab === 'hlb'} onChange={() => setTab('hlb')} />
              {tr('ГЛБ-крест')}
            </label>
            <label className={tab === 'dilute' ? 'on' : ''}>
              <input type="radio" name="calc-tab" checked={tab === 'dilute'} onChange={() => setTab('dilute')} />
              {tr('Разведение')}
            </label>
          </div>

          {tab === 'raw' && (
            <div className="calc-body">
              <p className="small">{tr('Пересчёт товарной формы (напр., 27 % SLES или 70 % AHA) на массу загрузки.')}</p>
              <label>{tr('Нужно активного вещества, %')}<input type="number" step="0.1" value={activePct} onChange={(e) => setActivePct(e.target.value)} /></label>
              <label>{tr('Концентрация товарного сырья, %')}<input type="number" step="1" value={assayPct} onChange={(e) => setAssayPct(e.target.value)} /></label>
              <label>{tr('Масса партии, г')}<input type="number" step="50" value={batchG} onChange={(e) => setBatchG(e.target.value)} /></label>
              {rawRes ? (
                <div className="okline num">
                  <div>{tr('Товарного сырья:')} <b>{rawRes.commercialPct} %</b> ({rawRes.commercialGrams} {tr('г')})</div>
                  <div>{tr('Внесёт воды в баланс:')} <b>{rawRes.carriedWaterGrams} {tr('г')}</b></div>
                </div>
              ) : <p className="small">{tr('Введите корректные числа (концентрация 1–100 %).')}</p>}
            </div>
          )}

          {tab === 'hlb' && (
            <div className="calc-body">
              <p className="small">{tr('Расчёт соотношения двух эмульгаторов под целевой требуемый ГЛБ.')}</p>
              <label>{tr('ГЛБ эмульгатора 1')}<input type="number" step="0.1" value={hlb1} onChange={(e) => setHlb1(e.target.value)} /></label>
              <label>{tr('ГЛБ эмульгатора 2')}<input type="number" step="0.1" value={hlb2} onChange={(e) => setHlb2(e.target.value)} /></label>
              <label>{tr('Целевой ГЛБ фазы')}<input type="number" step="0.1" value={targetHlb} onChange={(e) => setTargetHlb(e.target.value)} /></label>
              <label>{tr('Суммарный ввод эмульгаторов, %')}<input type="number" step="0.5" value={totalEmul} onChange={(e) => setTotalEmul(e.target.value)} /></label>
              {hlbRes ? (
                <div className="okline num">
                  <div>{tr('Эмульгатор 1:')} <b>{hlbRes.pct1} %</b> ({hlbRes.share1Pct} % {tr('смеси')})</div>
                  <div>{tr('Эмульгатор 2:')} <b>{hlbRes.pct2} %</b> ({hlbRes.share2Pct} % {tr('смеси')})</div>
                </div>
              ) : <p className="small">{tr('Целевой ГЛБ должен лежать между ГЛБ₁ и ГЛБ₂.')}</p>}
            </div>
          )}

          {tab === 'dilute' && (
            <div className="calc-body">
              <p className="small">{tr('Приготовление рабочего раствора (например, 10 % NaOH из 50 % концентрата).')}</p>
              <label>{tr('Исходная концентрация C₁, %')}<input type="number" step="1" value={c1} onChange={(e) => setC1(e.target.value)} /></label>
              <label>{tr('Целевая концентрация C₂, %')}<input type="number" step="0.5" value={c2} onChange={(e) => setC2(e.target.value)} /></label>
              <label>{tr('Нужная масса раствора, г')}<input type="number" step="10" value={targetG} onChange={(e) => setTargetG(e.target.value)} /></label>
              {dilRes ? (
                <div className="okline num">
                  <div>{tr('Концентрата C₁:')} <b>{dilRes.stockGrams} {tr('г')}</b></div>
                  <div>{tr('Воды очищенной:')} <b>{dilRes.waterGrams} {tr('г')}</b></div>
                </div>
              ) : <p className="small">{tr('Нужно C₁ ≥ C₂ > 0 и масса > 0.')}</p>}
            </div>
          )}
        </aside>
      )}
    </>
  )
}
