import { useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import {
  autoBalanceWater,
  checkPresetGoals,
  evaluateFormula,
  type FormulaInput,
  type FormulaRow,
  type IngredientRole,
  type Phase,
  type ProductType,
} from '../../shared/formulation'
import { ingredientById, ingredients, sandboxPresets } from '../content'
import { useTitle } from './util'

const SAVED_KEY = 'faza.sandbox.saved.v1'

export interface SavedFormula {
  id: string
  name: string
  at: number
  presetId?: string
  formula: FormulaInput
}

function loadSavedFormulas(): SavedFormula[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeSavedFormulas(items: SavedFormula[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 30)))
  } catch { /* ignore */ }
}

const blankFormula = (): FormulaInput => ({
  productType: 'leave-on',
  targetPh: 5.5,
  batchGrams: 500,
  phaseTempC: { A: 75, B: 75, C: 38 },
  rows: [
    { ingredientId: 'aqua', phase: 'A', pct: 80.2 },
    { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
    { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 8.0 },
    { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 3.0 },
    { ingredientId: 'sorbitan-stearate', phase: 'B', pct: 2.0 },
    { ingredientId: 'polysorbate-60', phase: 'B', pct: 2.0 },
    { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
  ],
})

const roleLabels: Record<IngredientRole, string> = {
  solvent: tr('Растворитель'),
  humectant: tr('Увлажнитель'),
  emollient: tr('Эмолент'),
  emulsifier: tr('Эмульгатор'),
  thickener: tr('Загуститель'),
  surfactant: tr('ПАВ'),
  active: tr('Актив'),
  preservative: tr('Консервант'),
  uv_filter: tr('УФ-фильтр'),
  ph_adjuster: tr('Регулятор pH'),
  electrolyte: tr('Электролит'),
  antioxidant: tr('Антиоксидант'),
  fragrance: tr('Отдушка'),
}

const phaseName: Record<Phase, string> = {
  A: tr('Фаза A (водная)'),
  B: tr('Фаза B (масляная)'),
  C: tr('Фаза C (активы и консерванты)'),
}

export default function SandboxPage() {
  useTitle(tr('Песочница рецептур'))
  const [presetId, setPresetId] = useState<string>(sandboxPresets[0]?.id ?? '')
  const [formula, setFormula] = useState<FormulaInput>(() => {
    const p = sandboxPresets[0]
    return p
      ? { productType: p.productType, targetPh: p.targetPh, batchGrams: p.batchGrams, phaseTempC: { ...p.phaseTempC }, rows: p.rows.map((r) => ({ ...r })) }
      : blankFormula()
  })
  const [selectedAdd, setSelectedAdd] = useState<string>(ingredients[0]?.id ?? 'aqua')
  const [saveName, setSaveName] = useState('')
  const [saved, setSaved] = useState<SavedFormula[]>(loadSavedFormulas)
  const [copied, setCopied] = useState(false)

  const activePreset = sandboxPresets.find((p) => p.id === presetId) ?? null
  const evaluation = useMemo(() => evaluateFormula(formula, ingredients), [formula])
  const goals = useMemo(
    () => (activePreset ? checkPresetGoals(evaluation, formula, activePreset.goals) : []),
    [activePreset, evaluation, formula],
  )
  const allGoalsPassed = goals.length > 0 && goals.every((g) => g.passed)

  function selectPreset(id: string) {
    setPresetId(id)
    if (!id) {
      setFormula(blankFormula())
      return
    }
    const p = sandboxPresets.find((x) => x.id === id)
    if (!p) return
    setFormula({
      productType: p.productType,
      targetPh: p.targetPh,
      batchGrams: p.batchGrams,
      phaseTempC: { ...p.phaseTempC },
      rows: p.rows.map((r) => ({ ...r })),
    })
  }

  function updateRow(idx: number, patch: Partial<FormulaRow>) {
    setFormula((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
  }

  function removeRow(idx: number) {
    setFormula((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))
  }

  function addIngredient() {
    const ing = ingredientById(selectedAdd)
    if (!ing) return
    const defaultPct = Number(((ing.typicalRange[0] + Math.min(ing.typicalRange[1], ing.typicalRange[0] + 2)) / 2).toFixed(2))
    setFormula((prev) => ({
      ...prev,
      rows: [...prev.rows, { ingredientId: ing.id, phase: ing.recommendedPhase, pct: defaultPct }],
    }))
  }

  function balanceWater() {
    setFormula((prev) => ({ ...prev, rows: autoBalanceWater(prev.rows) }))
  }

  function handleSave() {
    const label = saveName.trim() || activePreset?.title || tr('Рецептура без названия')
    const entry: SavedFormula = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: label,
      at: Date.now(),
      presetId: presetId || undefined,
      formula: JSON.parse(JSON.stringify(formula)),
    }
    const next = [entry, ...saved].slice(0, 30)
    setSaved(next)
    writeSavedFormulas(next)
    setSaveName('')
  }

  function deleteSaved(id: string) {
    const next = saved.filter((x) => x.id !== id)
    setSaved(next)
    writeSavedFormulas(next)
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      name: saveName.trim() || activePreset?.title || 'Faza Formula',
      formula,
      summary: {
        totalPct: evaluation.totalPct,
        requiredHlb: evaluation.requiredHlb,
        actualHlb: evaluation.actualHlb,
        costPerKgRub: evaluation.costPerKg,
        batchCostRub: evaluation.batchCost,
        inci: [...evaluation.inci.aboveOne, ...evaluation.inci.oneOrLess],
        errorsCount: evaluation.errorsCount,
        warningsCount: evaluation.warningsCount,
      },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faza-formula-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fullInci = [...evaluation.inci.aboveOne, ...evaluation.inci.oneOrLess].join(', ')

  function copyInci() {
    if (!fullInci) return
    navigator.clipboard?.writeText(fullInci).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return (
    <div className="page sandbox">
      <p className="eyebrow">{tr('Интерактивный конструктор · детерминированный расчёт')}</p>
      <h1>{tr('Песочница рецептур и фаз')}</h1>
      <p className="lead">
        {tr('Собирайте косметические рецептуры по фазам A, B и C с автоматическим пересчётом загрузок, балансом 100 %, расчётом ГЛБ, проверкой химической совместимости и лимитов ТР ТС 009/2011 и EU 1223/2009.')}
      </p>

      <section className="panel sandbox-presets">
        <div className="sandbox-preset-bar">
          <label>
            <b>{tr('Режим или учебный кейс')}</b>
            <select value={presetId} onChange={(e) => selectPreset(e.target.value)}>
              <option value="">{tr('Свободная песочница (базовый шаблон)')}</option>
              {sandboxPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
          {activePreset && (
            <button type="button" className="btn" onClick={() => selectPreset(activePreset.id)}>
              {tr('Сбросить кейс')}
            </button>
          )}
        </div>
        {activePreset && (
          <>
            <p className="sandbox-summary">{activePreset.summary}</p>
            <ul className="sandbox-goals">
              {goals.map((g) => (
                <li key={g.id} className={g.passed ? 'ok' : 'pending'}>
                  <span aria-hidden>{g.passed ? '✓' : '○'}</span> {tr(g.label)}
                </li>
              ))}
            </ul>
            {allGoalsPassed && (
              <p className="okline" role="status">
                {tr('Все требования кейса выполнены! Рецептура сбалансирована и проходит проверки.')}
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel sandbox-params">
        <h2>{tr('Параметры процесса и партии')}</h2>
        <div className="sandbox-param-grid">
          <label>
            {tr('Тип продукта (регуляторика)')}
            <select
              value={formula.productType}
              onChange={(e) => setFormula((prev) => ({ ...prev, productType: e.target.value as ProductType }))}
            >
              <option value="leave-on">{tr('Несмываемый (leave-on)')}</option>
              <option value="rinse-off">{tr('Смываемый (rinse-off)')}</option>
            </select>
          </label>
          <label>
            {tr('Целевой pH')}
            <input
              type="number"
              step="0.1"
              min="2"
              max="11"
              value={formula.targetPh}
              onChange={(e) => setFormula((prev) => ({ ...prev, targetPh: Number(e.target.value) || 5.5 }))}
            />
          </label>
          <label>
            {tr('Загрузка партии, г')}
            <input
              type="number"
              step="50"
              min="10"
              max="1000000"
              value={formula.batchGrams}
              onChange={(e) => setFormula((prev) => ({ ...prev, batchGrams: Math.max(1, Number(e.target.value) || 100) }))}
            />
          </label>
          {(['A', 'B', 'C'] as Phase[]).map((ph) => (
            <label key={ph}>
              {tr(`Температура фазы ${ph}, °C`)}
              <input
                type="number"
                step="1"
                min="15"
                max="95"
                value={formula.phaseTempC[ph]}
                onChange={(e) =>
                  setFormula((prev) => ({
                    ...prev,
                    phaseTempC: { ...prev.phaseTempC, [ph]: Number(e.target.value) || 20 },
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="row sandbox-batch-chips">
          <span className="small">{tr('Быстрая загрузка:')}</span>
          {[100, 500, 1000, 5000, 50000].map((g) => (
            <button
              key={g}
              type="button"
              className={`chip ${formula.batchGrams === g ? 'on' : ''}`}
              onClick={() => setFormula((prev) => ({ ...prev, batchGrams: g }))}
            >
              {g >= 1000 ? `${g / 1000} ${tr('кг')}` : `${g} ${tr('г')}`}
            </button>
          ))}
        </div>
      </section>

      <dl className="traffic-totals sandbox-kpis">
        <div className={`panel ${evaluation.balanced ? 'kpi-ok' : 'kpi-bad'}`}>
          <dt>{tr('Сумма рецептуры')}</dt>
          <dd>{evaluation.totalPct} %</dd>
        </div>
        <div className="panel">
          <dt>{tr('Требуемый / факт. ГЛБ')}</dt>
          <dd>
            {evaluation.requiredHlb !== null ? evaluation.requiredHlb : '—'}
            {' / '}
            {evaluation.actualHlb !== null ? evaluation.actualHlb : '—'}
          </dd>
        </div>
        <div className="panel">
          <dt>{tr('Ошибки / предупреждения')}</dt>
          <dd>{evaluation.errorsCount} / {evaluation.warningsCount}</dd>
        </div>
        <div className="panel">
          <dt>{tr('Условная стоимость сырья')}</dt>
          <dd>{evaluation.costPerKg} {tr('₽/кг')}</dd>
        </div>
      </dl>

      <section className="panel">
        <div className="sandbox-head-row">
          <h2>{tr('Состав по фазам (A / B / C)')}</h2>
          <button type="button" className="btn primary" onClick={balanceWater}>
            {tr('Довести воду до 100 % (q.s.)')}
          </button>
        </div>

        <div className="sandbox-add-row">
          <select aria-label={tr('Выбрать ингредиент')} value={selectedAdd} onChange={(e) => setSelectedAdd(e.target.value)}>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                [{ing.recommendedPhase}] {ing.name} ({ing.inci}) — {roleLabels[ing.role]}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={addIngredient}>
            {tr('+ Добавить компонент')}
          </button>
        </div>

        <div className="table-wrap">
          <table className="sandbox-table">
            <thead>
              <tr>
                <th>{tr('Фаза')}</th>
                <th>{tr('Компонент / INCI')}</th>
                <th>{tr('Доля, %')}</th>
                <th>{tr('На загрузку, г')}</th>
                <th>{tr('Стоимость, ₽')}</th>
                <th aria-label={tr('Действия')} />
              </tr>
            </thead>
            <tbody>
              {formula.rows.map((row, idx) => {
                const ing = ingredientById(row.ingredientId)
                if (!ing) return null
                const evRow = evaluation.rows[idx]
                return (
                  <tr key={`${row.ingredientId}-${idx}`}>
                    <td>
                      <select
                        aria-label={tr('Фаза ввода')}
                        value={row.phase}
                        onChange={(e) => updateRow(idx, { phase: e.target.value as Phase })}
                      >
                        <option value="A">A ({formula.phaseTempC.A}°C)</option>
                        <option value="B">B ({formula.phaseTempC.B}°C)</option>
                        <option value="C">C ({formula.phaseTempC.C}°C)</option>
                      </select>
                    </td>
                    <td>
                      <b>{ing.name}</b>
                      <div className="small">
                        <code>{ing.inci}</code> · {roleLabels[ing.role]}
                        {ing.hlb !== undefined ? ` · HLB ${ing.hlb}` : ''}
                        {ing.reqHlb !== undefined ? ` · reqHLB ${ing.reqHlb}` : ''}
                        {ing.maxTempC !== undefined ? ` · ≤ ${ing.maxTempC} °C` : ''}
                      </div>
                    </td>
                    <td>
                      <input
                        className="sandbox-pct"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        aria-label={`${ing.name}, %`}
                        value={row.pct}
                        onChange={(e) => updateRow(idx, { pct: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </td>
                    <td className="num">{evRow?.grams ?? 0}</td>
                    <td className="num">{evRow?.cost ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        aria-label={`${tr('Удалить')} ${ing.name}`}
                        onClick={() => removeRow(idx)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(['A', 'B', 'C'] as Phase[]).map((ph) => (
                <tr key={ph} className="sandbox-subtotal">
                  <td colSpan={2}>{phaseName[ph]} ({formula.phaseTempC[ph]} °C)</td>
                  <td className="num">{evaluation.phaseTotals[ph].pct} %</td>
                  <td className="num">{evaluation.phaseTotals[ph].grams} {tr('г')}</td>
                  <td colSpan={2} />
                </tr>
              ))}
              <tr className="sandbox-total">
                <td colSpan={2}><b>{tr('Итого на партию')}</b></td>
                <td className="num"><b>{evaluation.totalPct} %</b></td>
                <td className="num"><b>{formula.batchGrams} {tr('г')}</b></td>
                <td className="num"><b>{evaluation.batchCost} ₽</b></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>{tr('Автоматическая проверка рецептуры и регуляторики')}</h2>
        {evaluation.issues.length === 0 ? (
          <p className="okline" role="status">
            {tr('Ошибок и предупреждений не найдено: баланс 100 %, температурные режимы, химическая совместимость и лимиты соблюдены.')}
          </p>
        ) : (
          <div className="sandbox-issues">
            {evaluation.issues.map((issue) => (
              <div
                key={issue.code}
                className={`drow ${issue.severity === 'error' ? 'wrong' : issue.severity === 'warn' ? 'weak' : 'ok'}`}
              >
                <h4>{issue.title}</h4>
                <p>{issue.detail}</p>
              </div>
            ))}
          </div>
        )}
        <p className="small">
          {tr('О данных: цены сырья синтетические (учебные ориентиры); значения требуемого ГЛБ справочные для эмульсий O/W; для промышленного выпуска сверяйте действующую редакцию ТР ТС 009/2011 и Регламента (ЕС) № 1223/2009.')}
        </p>
      </section>

      <section className="panel">
        <div className="sandbox-head-row">
          <h2>{tr('Автоматическая декларация INCI (ст. 19 EU 1223/2009 · ТР ТС 009/2011)')}</h2>
          <button type="button" className="btn" onClick={copyInci} disabled={!fullInci}>
            {copied ? tr('Скопировано') : tr('Скопировать INCI')}
          </button>
        </div>
        <p className="sandbox-inci">
          <b>{tr('Строго по убыванию (> 1 %):')}</b>{' '}
          {evaluation.inci.aboveOne.length ? evaluation.inci.aboveOne.join(', ') : '—'}
        </p>
        <p className="sandbox-inci">
          <b>{tr('В любом порядке (≤ 1 %):')}</b>{' '}
          {evaluation.inci.oneOrLess.length ? evaluation.inci.oneOrLess.join(', ') : '—'}
        </p>
      </section>

      <section className="panel">
        <h2>{tr('Сохранение и экспорт рецептуры')}</h2>
        <div className="sandbox-save-row">
          <input
            type="text"
            placeholder={tr('Название рецептуры для сохранения в браузере…')}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <button type="button" className="btn primary" onClick={handleSave}>
            {tr('Сохранить в портфолио')}
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            {tr('Экспорт JSON')}
          </button>
        </div>
        {saved.length > 0 && (
          <ul className="sandbox-saved-list">
            {saved.map((item) => (
              <li key={item.id}>
                <span>
                  <b>{item.name}</b> · {item.formula.productType} · pH {item.formula.targetPh} · {item.formula.batchGrams} {tr('г')}
                </span>
                <span className="row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPresetId(item.presetId ?? '')
                      setFormula(JSON.parse(JSON.stringify(item.formula)))
                    }}
                  >
                    {tr('Открыть')}
                  </button>
                  <button type="button" className="btn" onClick={() => deleteSaved(item.id)}>
                    {tr('Удалить')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
