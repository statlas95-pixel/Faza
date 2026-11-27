import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import { evaluateCampaignLabFormula, getCampaign, type CampaignId } from '../../shared/campaigns'
import {
  autoBalanceWater,
  checkPresetGoals,
  evaluateFormula,
  type FormulaInput,
  type FormulaRow,
  type IngredientRole,
  type Phase,
  type ProductType,
  type ProductZone,
} from '../../shared/formulation'
import {
  ANTIPATTERNS,
  diffFormulas,
  predictProcessAppearance,
} from '../../shared/formulation-sim'
import {
  computeSensoryProfile,
  findIngredientSubstitutes,
  generateBatchProtocol,
  simulateAcceleratedStability,
} from '../../shared/formulation-lab3'
import { api, ApiError, useAccount } from '../account'
import { BatchProtocolPanel, SensoryProfilePanel, StabilityLabPanel } from '../components/Lab3Panels'
import { Lab4Panels } from '../components/Lab4Panels'
import { Lab5Panels } from '../components/Lab5Panels'
import { Lab6Instruments } from '../components/Lab6Instruments'
import { FormulaDefenseModal } from '../components/FormulaDefenseModal'
import { NoteBox } from '../components/NoteBox'
import { showToast } from '../components/Toast'
import { HlbGauge, PreservativePhCurve, ProcessSimulatorPanel } from '../components/SandboxVisuals'
import { buildFormulaCsv, decodeShareFormula, encodeShareFormula } from '../../shared/formulation-lab5'
import { computeIso16128 } from '../../shared/engineering-tools'
import { ingredientById, ingredients, sandboxPresets } from '../content'
import { renderSafe } from '../md'
import { deleteSavedFormula, saveCampaignProgress, saveFormula, useProgress, type SavedFormulaRecord } from '../store'
import { useTitle } from './util'

const ONBOARD_KEY = 'faza.lab.onboard.v1'

export type SavedFormula = SavedFormulaRecord

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
  chelator: tr('Хелатор'),
  solubilizer: tr('Солюбилизатор'),
  colorant: tr('Пигмент / краситель'),
}

const phaseName: Record<Phase, string> = {
  A: tr('Фаза A (водная)'),
  B: tr('Фаза B (масляная)'),
  C: tr('Фаза C (активы и консерванты)'),
}

export default function SandboxPage() {
  useTitle(tr('Лаборатория рецептур'))
  const acc = useAccount()
  const progress = useProgress()

  const [presetId, setPresetId] = useState<string>(sandboxPresets[0]?.id ?? '')
  const [formula, setFormula] = useState<FormulaInput>(() => {
    const p = sandboxPresets[0]
    return p
      ? { productType: p.productType, targetPh: p.targetPh, batchGrams: p.batchGrams, phaseTempC: { ...p.phaseTempC }, rows: p.rows.map((r) => ({ ...r })) }
      : blankFormula()
  })
  const [snapshot, setSnapshot] = useState<FormulaInput | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catQuery, setCatQuery] = useState('')
  const [catPhase, setCatPhase] = useState<'all' | Phase>('all')
  const [catRole, setCatRole] = useState<'all' | IngredientRole>('all')
  const [saveName, setSaveName] = useState('')
  const saved = progress.savedFormulas
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [activeCampaignId, setActiveCampaignId] = useState<CampaignId | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()
  const simRef = useRef<HTMLDivElement>(null)
  const [showOnboard, setShowOnboard] = useState(() => {
    try { return localStorage.getItem(ONBOARD_KEY) !== 'done' } catch { return true }
  })

  function dismissOnboard() {
    setShowOnboard(false)
    try { localStorage.setItem(ONBOARD_KEY, 'done') } catch { /* ignore */ }
  }

  // Обработка ?add=<ingredientId> (из Ctrl+K), ?load=<savedId> (из Портфолио) и ?template=reverse-inci
  useEffect(() => {
    const addId = searchParams.get('add')
    const loadId = searchParams.get('load')
    const tpl = searchParams.get('template')
    const shareToken = searchParams.get('share')
    const campParam = searchParams.get('campaign')
    if (campParam) {
      const camp = getCampaign(campParam)
      if (camp) {
        const existing = progress.campaigns[camp.id]?.labFormula
        loadFormulaState(existing ?? camp.starterFormula, '')
        setActiveCampaignId(camp.id)
        setSaveName(language === 'en' ? camp.titleEn : camp.titleRu)
      }
      setSearchParams({}, { replace: true })
    } else if (shareToken) {
      const validIds = new Set(ingredients.map((i) => i.id))
      const decoded = decodeShareFormula(shareToken, validIds)
      if (decoded) {
        loadFormulaState(decoded.formula, '')
        if (decoded.name) setSaveName(decoded.name)
      }
      setSearchParams({}, { replace: true })
    } else if (addId) {
      const ing = ingredientById(addId)
      if (ing) {
        const defaultPct = Number(((ing.typicalRange[0] + Math.min(ing.typicalRange[1], ing.typicalRange[0] + 2)) / 2).toFixed(2))
        setFormula((prev) => ({
          ...prev,
          rows: [...prev.rows, { ingredientId: ing.id, phase: ing.recommendedPhase, pct: defaultPct }],
        }))
      }
      setSearchParams({}, { replace: true })
    } else if (loadId) {
      const found = saved.find((x) => x.id === loadId)
      if (found) loadFormulaState(found.formula, found.presetId ?? '')
      setSearchParams({}, { replace: true })
    } else if (tpl === 'reverse-inci') {
      loadFormulaState({
        productType: 'leave-on',
        targetPh: 5.6,
        batchGrams: 500,
        phaseTempC: { A: 75, B: 75, C: 38 },
        rows: [
          { ingredientId: 'aqua', phase: 'A', pct: 74.6 },
          { ingredientId: 'glycerin', phase: 'A', pct: 4.5 },
          { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
          { ingredientId: 'disodium-edta', phase: 'A', pct: 0.1 },
          { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 7.0 },
          { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 2.5 },
          { ingredientId: 'glyceryl-stearate', phase: 'B', pct: 2.0 },
          { ingredientId: 'peg-100-stearate', phase: 'B', pct: 1.5 },
          { ingredientId: 'shea-butter', phase: 'B', pct: 1.5 },
          { ingredientId: 'dimethicone', phase: 'B', pct: 1.0 },
          { ingredientId: 'niacinamide', phase: 'C', pct: 3.5 },
          { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
          { ingredientId: 'panthenol', phase: 'C', pct: 0.5 },
          { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
        ],
      }, '')
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, saved, setSearchParams])

  // ИИ-наставник для разбора текущей рецептуры
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiErr, setAiErr] = useState('')
  const [subRowIdx, setSubRowIdx] = useState<number | null>(null)
  const [defenseOpen, setDefenseOpen] = useState(false)

  const activePreset = sandboxPresets.find((p) => p.id === presetId) ?? null
  const evaluation = useMemo(() => evaluateFormula(formula, ingredients), [formula])
  const iso16128 = useMemo(() => computeIso16128(formula.rows, ingredients), [formula.rows])
  const forecast = useMemo(() => predictProcessAppearance(evaluation, formula), [evaluation, formula])
  const stabilityTests = useMemo(() => simulateAcceleratedStability(evaluation, formula), [evaluation, formula])
  const sensory = useMemo(() => computeSensoryProfile(evaluation, formula), [evaluation, formula])
  const protocol = useMemo(() => generateBatchProtocol(evaluation, formula), [evaluation, formula])
  const goals = useMemo(
    () => (activePreset ? checkPresetGoals(evaluation, formula, activePreset.goals) : []),
    [activePreset, evaluation, formula],
  )
  const diff = useMemo(
    () => (snapshot ? diffFormulas(snapshot, formula, ingredients) : null),
    [snapshot, formula],
  )
  const allGoalsPassed = goals.length > 0 && goals.every((g) => g.passed)

  const filteredCatalog = useMemo(() => {
    const q = catQuery.trim().toLowerCase()
    return ingredients.filter((ing) => {
      if (catPhase !== 'all' && ing.recommendedPhase !== catPhase) return false
      if (catRole !== 'all' && ing.role !== catRole) return false
      if (!q) return true
      return (
        ing.name.toLowerCase().includes(q) ||
        ing.inci.toLowerCase().includes(q) ||
        ing.note.toLowerCase().includes(q)
      )
    })
  }, [catQuery, catPhase, catRole])

  function loadFormulaState(next: FormulaInput, nextPreset = '') {
    setPresetId(nextPreset)
    setFormula(JSON.parse(JSON.stringify(next)))
    setAiAnswer('')
    setAiErr('')
  }

  function selectPreset(id: string) {
    if (!id) {
      loadFormulaState(blankFormula(), '')
      return
    }
    const p = sandboxPresets.find((x) => x.id === id)
    if (!p) return
    loadFormulaState({
      productType: p.productType,
      targetPh: p.targetPh,
      batchGrams: p.batchGrams,
      phaseTempC: { ...p.phaseTempC },
      rows: p.rows.map((r) => ({ ...r })),
    }, id)
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

  function addIngredientById(id: string) {
    const ing = ingredientById(id)
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
    saveFormula(entry)
    setSaveName('')
    showToast(tr('Рецептура сохранена в портфолио'))
  }

  function deleteSaved(id: string) {
    deleteSavedFormula(id)
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

  function exportCsv() {
    const title = saveName.trim() || activePreset?.title || 'Faza Formula'
    const csv = buildFormulaCsv(evaluation, formula, title)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faza-batch-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(tr('Технологическая карта выгружена в CSV'))
  }

  function copyShareLink() {
    const title = saveName.trim() || activePreset?.title || undefined
    const token = encodeShareFormula(formula, title)
    const shareUrl = `${window.location.origin}${window.location.pathname}#/sandbox?share=${token}`
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setShareCopied(true)
      showToast(tr('Ссылка на рецептуру скопирована в буфер'))
      setTimeout(() => setShareCopied(false), 2000)
    }).catch(() => {})
  }

  async function askTutorAboutFormula() {
    setAiBusy(true)
    setAiErr('')
    setAiAnswer('')
    try {
      const status = await api<any>('GET', '/api/ai/status')
      const model = progress.settings.aiModel || status?.models?.[0]?.id
      if (!status?.configured || !model) {
        setAiErr(tr('ИИ-наставник не настроен на сервере.'))
        return
      }
      const topicId = evaluation.issues.some((i) => i.code.startsWith('ph:') || i.code.startsWith('reg:'))
        ? 'preservation'
        : evaluation.issues.some((i) => i.code.includes('carbomer'))
          ? 'polymer-thickeners'
          : 'emulsifier-selection'
      const summary = (language === 'en'
        ? [
            `Formula (${formula.productType}, pH ${formula.targetPh}, phases A=${formula.phaseTempC.A}°C / B=${formula.phaseTempC.B}°C / C=${formula.phaseTempC.C}°C):`,
            ...evaluation.rows.map((r) => `[${r.phase}] ${r.ingredient.inci} ${r.pct}%`),
            evaluation.issues.length
              ? `Validator findings: ${evaluation.issues.map((i) => i.title).join('; ')}`
              : 'No critical validator errors found.',
            'Briefly explain the physicochemical reasons behind the findings and suggest 1–2 practical improvement steps.',
          ]
        : [
            `Рецептура (${formula.productType}, pH ${formula.targetPh}, фазы A=${formula.phaseTempC.A}°C / B=${formula.phaseTempC.B}°C / C=${formula.phaseTempC.C}°C):`,
            ...evaluation.rows.map((r) => `[${r.phase}] ${r.ingredient.inci} ${r.pct}%`),
            evaluation.issues.length
              ? `Найдены замечания валидатора: ${evaluation.issues.map((i) => i.title).join('; ')}`
              : 'Критических ошибок валидатор не нашёл.',
            'Кратко объясни физико-химические причины замечаний и предложи 1–2 практических шага улучшения.',
          ]
      ).join('\n').slice(0, 1400)
      const res = await api<any>('POST', '/api/ai/tutor', {
        language,
        model,
        mode: 'review',
        kind: 'topic',
        id: topicId,
        level: progress.settings.level,
        message: summary,
      })
      setAiAnswer(res.text ?? '')
    } catch (e: any) {
      setAiErr(e instanceof ApiError ? e.message : tr('Не удалось получить разбор наставника.'))
    } finally {
      setAiBusy(false)
    }
  }

  const fullInci = [...evaluation.inci.aboveOne, ...evaluation.inci.oneOrLess].join(', ')

  function copyInci() {
    if (!fullInci) return
    navigator.clipboard?.writeText(fullInci).then(() => {
      setCopied(true)
      showToast(tr('Декларация INCI скопирована'))
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return (
    <div className="page sandbox">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Лаборатория рецептур и фаз')}</h1>
        </div>
        <div className="row sb-top-actions">
          <button
            type="button"
            className={`btn ${snapshot ? 'primary' : ''}`}
            onClick={() => setSnapshot(snapshot ? null : JSON.parse(JSON.stringify(formula)))}
          >
            {snapshot ? tr('Скрыть «До / После»') : tr('Зафиксировать «До»')}
          </button>
          <button type="button" className="btn primary" onClick={() => setDefenseOpen(true)}>
            🛡 {tr('QA-защита')}
          </button>
          <button type="button" className="btn" onClick={exportCsv}>
            📊 {tr('Excel / CSV карта')}
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            🖨 {tr('Карта варки (печать)')}
          </button>
          <Link to="/tools" className="btn ghost">
            🧰 {tr('Утилиты 2.0')}
          </Link>
        </div>
      </div>
      <p className="lead">
        {tr('Собирайте косметические рецептуры по фазам A, B и C с прогнозом внешнего вида на 5 стадиях, микроскопией, балансом 100 %, расчётом ГЛБ, проверкой конфликтов и лимитов ТР ТС 009/2011 и EU 1223/2009.')}
      </p>
      {defenseOpen && (
        <FormulaDefenseModal
          formula={formula}
          evaluation={evaluation}
          catalog={ingredients}
          onClose={() => setDefenseOpen(false)}
          onAskAi={askTutorAboutFormula}
        />
      )}

      {/* Баннер активной кампании запуска (передача рецептуры в Этап 2) */}
      {activeCampaignId && (() => {
        const camp = getCampaign(activeCampaignId)
        if (!camp) return null
        const check = evaluateCampaignLabFormula(camp.id, formula, ingredients)
        return (
          <section className="panel camp-handoff-bar" role="region" aria-label={tr('Связка с кампанией запуска')}>
            <div className="sandbox-head-row">
              <div>
                <p className="eyebrow">{tr('Активная кампания запуска · Этап 2')}</p>
                <b>{language === 'en' ? camp.titleEn : camp.titleRu}</b>{' '}
                <span className="tag num">{check.score}/20 · {check.passed ? tr('✓ Готово к Этапу 3') : tr('Требует доработки')}</span>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => {
                    const prevStage = progress.campaigns[camp.id]?.stage ?? 0
                    saveCampaignProgress(camp.id, {
                      stage: Math.max(prevStage, 2),
                      labFormula: JSON.parse(JSON.stringify(formula)),
                      labSummary: {
                        score: check.score,
                        passed: check.passed,
                        costPerKg: check.costPerKg,
                        errors: check.errors,
                        spf: check.spf,
                        notes: check.notes,
                      },
                    })
                    showToast(tr('Рецептура передана в Этап 2 кампании!'))
                    nav(`/campaigns?id=${camp.id}`)
                  }}
                >
                  {tr('Передать рецептуру в кампанию →')}
                </button>
                <button type="button" className="btn small ghost" onClick={() => setActiveCampaignId(null)}>×</button>
              </div>
            </div>
          </section>
        )
      })()}

      {/* Короткий онбординг «Первая варка» */}
      {showOnboard && (
        <section className="panel sb-onboard" aria-label={tr('Быстрый старт в Лаборатории')}>
          <div className="sandbox-head-row">
            <div>
              <b>{tr('Быстрый старт: первая варка за 30 секунд')}</b>
              <ol className="sb-onboard-steps small">
                <li>{tr('Выберите кейс ниже (или начните с «Базового крема O/W» — в нём специально заложены 3 ошибки).')}</li>
                <li>{tr('Поправьте эмульгатор/фазу и нажмите «Автобаланс воды», чтобы сумма стала ровно 100 %.')}</li>
                <li>{tr('Нажмите «▶ Провести варку» и проследите, как исчезают дефекты на всех 5 стадиях и под микроскопом.')}</li>
              </ol>
            </div>
            <button type="button" className="btn small ghost" onClick={dismissOnboard}>
              {tr('Понятно, скрыть')}
            </button>
          </div>
        </section>
      )}

      {/* Прилипающая панель живой сводки */}
      <div className="sb-sticky-bar" role="region" aria-label={tr('Живая сводка рецептуры')}>
        <div className="sb-sticky-metrics num">
          <span className={`sb-pill ${evaluation.balanced ? 'ok' : 'bad'}`}>
            {tr('Сумма:')} <b>{evaluation.totalPct} %</b>
          </span>
          <span className="sb-pill">
            {tr('ГЛБ:')} <b>{evaluation.requiredHlb ?? '—'} / {evaluation.actualHlb ?? '—'}</b>
          </span>
          <span className={`sb-pill ${evaluation.errorsCount === 0 ? 'ok' : 'bad'}`}>
            {tr('Ошибки:')} <b>{evaluation.errorsCount}</b>
          </span>
          <span className="sb-pill" title={tr('Индекс натурального происхождения ISO 16128 (с водой)')}>
            ISO 16128: <b>{iso16128.noiWithWaterPct} %</b>
          </span>
          <span className="sb-pill">
            <b>{evaluation.costPerKg} {tr('₽/кг')}</b>
          </span>
        </div>
        <div className="row sb-sticky-actions">
          <button type="button" className="btn small" onClick={balanceWater}>
            {tr('Баланс воды → 100 %')}
          </button>
          <button
            type="button"
            className="btn small primary"
            onClick={() => simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            ▶ {tr('К варке')}
          </button>
        </div>
      </div>

      {/* Выбор кейса */}
      <section className="panel sandbox-presets">
        <div className="sandbox-preset-bar">
          <label>
            <b>{tr('Режим или учебный кейс')}</b>
            <select value={presetId} onChange={(e) => selectPreset(e.target.value)}>
              <option value="">{tr('Свободная лаборатория (базовый шаблон)')}</option>
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

      {/* Анимированный прогноз внешнего вида на 5 стадиях + микроскопия */}
      <div ref={simRef}>
        <ProcessSimulatorPanel forecast={forecast} evaluation={evaluation} />
      </div>

      {/* Сравнение «До / После» */}
      {diff && (
        <section className="panel sb-diff-panel">
          <h2>{tr('Сравнение рецептуры «До / После»')}</h2>
          <div className="row sb-diff-chips num">
            <span className="tag">{tr('Δ Ошибки:')} {diff.errorsDelta > 0 ? `+${diff.errorsDelta}` : diff.errorsDelta}</span>
            <span className="tag">{tr('Δ Предупреждения:')} {diff.warningsDelta > 0 ? `+${diff.warningsDelta}` : diff.warningsDelta}</span>
            <span className="tag">{tr('Δ Стоимость:')} {diff.costDelta > 0 ? `+${diff.costDelta}` : diff.costDelta} {tr('₽/кг')}</span>
            <span className="tag">{tr('ГЛБ:')} {diff.hlbDeltaChange}</span>
          </div>
          {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 ? (
            <p className="small muted">{tr('Пока отличий от зафиксированного снимка «До» нет — внесите правки в рецептуру.')}</p>
          ) : (
            <ul className="small sb-diff-list">
              {diff.added.map((a) => <li key={`+${a}`} className="diff-add">+ {a}</li>)}
              {diff.removed.map((r) => <li key={`-${r}`} className="diff-rem">− {r}</li>)}
              {diff.changed.map((c) => (
                <li key={c.id}>
                  ~ <b>{c.name}</b>: {c.beforePct} % ({c.beforePhase}) → <b>{c.afterPct} % ({c.afterPhase})</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Параметры процесса */}
      <section className="panel sandbox-params">
        <h2>{tr('Параметры процесса и партии')}</h2>
        <div className="sandbox-param-grid">
          <label>
            <span className="sb-param-head"><span>{tr('Тип и зона продукта (регуляторика)')}</span></span>
            <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
              <select
                value={formula.productType}
                aria-label={tr('Тип продукта (регуляторика)')}
                onChange={(e) => setFormula((prev) => ({ ...prev, productType: e.target.value as ProductType }))}
              >
                <option value="leave-on">{tr('Несмываемый (leave-on)')}</option>
                <option value="rinse-off">{tr('Смываемый (rinse-off)')}</option>
              </select>
              <select
                value={formula.productZone ?? 'face'}
                aria-label={tr('Зона нанесения')}
                onChange={(e) => setFormula((prev) => ({ ...prev, productZone: e.target.value as ProductZone }))}
              >
                <option value="face">{tr('Лицо / руки')}</option>
                <option value="body">{tr('Тело (body)')}</option>
                <option value="hair">{tr('Волосы (hair)')}</option>
                <option value="spray">{tr('Спрей / аэрозоль')}</option>
              </select>
            </div>
          </label>
          <label>
            <span className="sb-param-head"><span>{tr('Целевой pH')}</span><b className="num">{formula.targetPh}</b></span>
            <input
              type="range"
              step="0.1"
              min="2.5"
              max="9.0"
              value={formula.targetPh}
              onChange={(e) => setFormula((prev) => ({ ...prev, targetPh: Number(e.target.value) }))}
            />
          </label>
          <label>
            <span className="sb-param-head"><span>{tr('Загрузка партии, г')}</span></span>
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
              <span className="sb-param-head">
                <span className={`phase-pill p-${ph}`}>{tr('Фаза')} {ph}</span>
                <b className="num">{formula.phaseTempC[ph]} °C</b>
              </span>
              <input
                type="range"
                step="1"
                min="20"
                max="85"
                value={formula.phaseTempC[ph]}
                onChange={(e) =>
                  setFormula((prev) => ({
                    ...prev,
                    phaseTempC: { ...prev.phaseTempC, [ph]: Number(e.target.value) },
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

      {/* Ключевые метрики + Шкала ГЛБ + Кривая pH */}
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

      {(evaluation.requiredHlb !== null || evaluation.rows.some((r) => r.pct > 0 && r.ingredient.pKa !== undefined)) && (
        <section className="panel sb-gauges-grid">
          <HlbGauge requiredHlb={evaluation.requiredHlb} actualHlb={evaluation.actualHlb} />
          <PreservativePhCurve evaluation={evaluation} targetPh={formula.targetPh} />
        </section>
      )}

      {/* Состав по фазам + умный каталог сырья */}
      <section className="panel">
        <div className="sandbox-head-row">
          <h2>{tr('Состав по фазам (A / B / C)')}</h2>
          <div className="row">
            <button type="button" className="btn" onClick={() => setCatalogOpen((v) => !v)}>
              {catalogOpen ? tr('Скрыть каталог сырья') : `${tr('+ Каталог сырья')} (${ingredients.length})`}
            </button>
            <button type="button" className="btn primary" onClick={balanceWater}>
              {tr('Довести воду до 100 % (q.s.)')}
            </button>
          </div>
        </div>

        {catalogOpen && (
          <div className="sb-catalog">
            <div className="sb-catalog-filters">
              <input
                type="search"
                placeholder={tr('Поиск по INCI, названию или свойству (напр. Olivem, Squalane, Retinol, EDTA)…')}
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
              />
              <div className="row">
                {(['all', 'A', 'B', 'C'] as const).map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    className={`chip ${catPhase === ph ? 'on' : ''}`}
                    onClick={() => setCatPhase(ph)}
                  >
                    {ph === 'all' ? tr('Все фазы') : `${tr('Фаза')} ${ph}`}
                  </button>
                ))}
                <select value={catRole} onChange={(e) => setCatRole(e.target.value as any)}>
                  <option value="all">{tr('Все функции')}</option>
                  {(Object.keys(roleLabels) as IngredientRole[]).map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sb-catalog-list">
              {filteredCatalog.map((ing) => (
                <div key={ing.id} className="sb-cat-item">
                  <div>
                    <span className={`phase-pill p-${ing.recommendedPhase}`}>{ing.recommendedPhase}</span>{' '}
                    <b>{ing.name}</b> <code className="small">{ing.inci}</code>
                    <div className="small">
                      {roleLabels[ing.role]} · {ing.typicalRange[0]}–{ing.typicalRange[1]} %
                      {ing.hlb !== undefined ? ` · HLB ${ing.hlb}` : ''}
                      {ing.reqHlb !== undefined ? ` · reqHLB ${ing.reqHlb}` : ''}
                      {ing.regulatory?.length ? ` · ⚖ ${tr('регламент')}` : ''}
                    </div>
                  </div>
                  <button type="button" className="btn" onClick={() => addIngredientById(ing.id)}>
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                const sliderMax = ing.id === 'aqua' ? 100 : Math.max(20, ing.typicalRange[1] * 2)
                return (
                  <tr key={`${row.ingredientId}-${idx}`}>
                    <td>
                      <div className="phase-switch" role="group" aria-label={tr('Фаза ввода')}>
                        {(['A', 'B', 'C'] as Phase[]).map((ph) => (
                          <button
                            key={ph}
                            type="button"
                            className={`phase-btn p-${ph} ${row.phase === ph ? 'on' : ''}`}
                            onClick={() => updateRow(idx, { phase: ph })}
                          >
                            {ph}
                          </button>
                        ))}
                      </div>
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
                      <div className="sb-pct-ctl">
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
                        <input
                          className="sb-pct-slider"
                          type="range"
                          step="0.1"
                          min="0"
                          max={sliderMax}
                          aria-label={`${ing.name} slider`}
                          value={Math.min(sliderMax, row.pct)}
                          onChange={(e) => updateRow(idx, { pct: Number(e.target.value) })}
                        />
                      </div>
                    </td>
                    <td className="num">{evRow?.grams ?? 0}</td>
                    <td className="num">{evRow?.cost ?? 0}</td>
                    <td>
                      <div className="row lab3-row-acts">
                        {ing.id !== 'aqua' && (
                          <button
                            type="button"
                            className={`btn small ${subRowIdx === idx ? 'primary' : 'ghost'}`}
                            title={tr('Подобрать функциональный аналог сырья')}
                            aria-label={`${tr('Аналоги для')} ${ing.name}`}
                            onClick={() => setSubRowIdx((cur) => (cur === idx ? null : idx))}
                          >
                            ⇄
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn small"
                          aria-label={`${tr('Удалить')} ${ing.name}`}
                          onClick={() => { setSubRowIdx(null); removeRow(idx) }}
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              {(['A', 'B', 'C'] as Phase[]).map((ph) => (
                <tr key={ph} className="sandbox-subtotal">
                  <td colSpan={2}>
                    <span className={`phase-pill p-${ph}`}>{ph}</span> {phaseName[ph]} ({formula.phaseTempC[ph]} °C)
                  </td>
                  <td className="num">{evaluation.phaseTotals[ph].pct} %</td>
                  <td className="num">{evaluation.phaseTotals[ph].grams} {tr('г')}</td>
                  <td colSpan={2} />
                </tr>
              ))}
              <tr className="sandbox-total">
                <td colSpan={2}><b>{tr('Итого на партию')}</b></td>
                <td className="num"><b>{evaluation.totalPct} %</b></td>
                <td className="num"><b>{formula.batchGrams} {tr('г')}</b></td>
                <td className="num"><b>{evaluation.batchCost} {tr('₽')}</b></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {subRowIdx !== null && formula.rows[subRowIdx] && (() => {
          const curRow = formula.rows[subRowIdx]
          const curIng = ingredientById(curRow.ingredientId)
          const subs = findIngredientSubstitutes(curRow.ingredientId, ingredients)
          if (!curIng) return null
          return (
            <div className="lab3-sub-box">
              <div className="sandbox-head-row">
                <b>{tr('Функциональные аналоги для:')} {curIng.name}</b>
                <button type="button" className="btn small ghost" onClick={() => setSubRowIdx(null)}>
                  {tr('Закрыть')}
                </button>
              </div>
              {subs.length === 0 ? (
                <p className="small muted">{tr('Для этого компонента в каталоге нет прямых аналогов той же функции.')}</p>
              ) : (
                <div className="lab3-sub-grid">
                  {subs.map((s) => (
                    <div key={s.ingredient.id} className="lab3-sub-card">
                      <div>
                        <b>{s.ingredient.name}</b> <code className="small">{s.ingredient.inci}</code>
                        <div className="small num">{s.deltaNote}</div>
                        <p className="small muted">{s.reason}</p>
                      </div>
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => {
                          updateRow(subRowIdx, { ingredientId: s.ingredient.id, phase: s.ingredient.recommendedPhase })
                          setSubRowIdx(null)
                        }}
                      >
                        {tr('Заменить')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </section>

      {/* Лаборатория 6.0: Живые приборы (Вискозиметр Брукфильда + Поляризационный микроскоп) */}
      <Lab6Instruments formula={formula} ev={evaluation} />

      {/* Лаборатория 3.0, 4.0 и 5.0: Ускоренное старение, Сенсорика, COGS/ASM, SPF/Пигменты, A/B-радар и SOP */}
      <StabilityLabPanel tests={stabilityTests} />
      <SensoryProfilePanel profile={sensory} />
      <Lab4Panels ev={evaluation} batchGrams={formula.batchGrams} />
      <Lab5Panels
        formula={formula}
        ev={evaluation}
        catalog={ingredients}
        savedFormulas={saved}
        presets={sandboxPresets}
      />
      <BatchProtocolPanel steps={protocol} />

      {/* Диагностика, регуляторика и кнопка ИИ-наставника */}
      <section className="panel">
        <div className="sandbox-head-row">
          <h2>{tr('Автоматическая проверка рецептуры и регуляторики')}</h2>
          {acc.status === 'user' ? (
            <button type="button" className="btn" disabled={aiBusy} onClick={askTutorAboutFormula}>
              {aiBusy ? tr('Наставник анализирует…') : tr('💬 Разобрать с ИИ-наставником')}
            </button>
          ) : (
            <Link className="btn" to="/account">{tr('Войти для разбора с наставником')}</Link>
          )}
        </div>

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

        {aiErr && <p className="warnline">{aiErr}</p>}
        {aiAnswer && (
          <div className="tutor-answer sb-ai-box">
            <h3>{tr('Комментарий ИИ-наставника (расчёты проверены кодом)')}</h3>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderSafe(aiAnswer) }} />
          </div>
        )}

        <p className="small">
          {tr('О данных: цены сырья синтетические (учебные ориентиры); значения требуемого ГЛБ справочные для эмульсий O/W; для промышленного выпуска сверяйте действующую редакцию ТР ТС 009/2011 и Регламента (ЕС) № 1223/2009.')}
        </p>
      </section>

      {/* INCI */}
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

      {/* Галерея антипаттернов */}
      <section className="panel sb-antipatterns">
        <h2>{tr('Галерея антипаттернов и дефектов рецептур')}</h2>
        <p className="small">{tr('Откройте любой классический дефект прямо в Лаборатории, посмотрите прогноз внешнего вида и микроскопию, а затем исправьте формулу.')}</p>
        <div className="cards">
          {ANTIPATTERNS.map((ap) => (
            <article key={ap.id} className="card">
              <h3>{tr(ap.title)}</h3>
              <p className="small"><b>{tr('Симптом:')}</b> {tr(ap.symptom)}</p>
              <p className="small"><b>{tr('Причина:')}</b> {tr(ap.mechanism)}</p>
              <p className="small"><b>{tr('Как исправить:')}</b> {tr(ap.fixHint)}</p>
              <button
                type="button"
                className="btn wide"
                onClick={() => {
                  loadFormulaState(ap.formula, '')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                {tr('Открыть дефект в Лаборатории →')}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Личный лабораторный блокнот к текущей рецептуре */}
      <NoteBox
        noteId={`formula:${presetId || 'custom'}`}
        kind="formula"
        targetId={presetId || 'custom'}
        title={activePreset?.title ?? tr('Свободная рецептура Лаборатории')}
      />

      {/* Сохранение и экспорт */}
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
          <button type="button" className="btn" onClick={exportCsv}>
            📊 {tr('Таблица CSV (Excel)')}
          </button>
          <button type="button" className="btn" onClick={copyShareLink}>
            🔗 {shareCopied ? tr('Ссылка скопирована!') : tr('Поделиться ссылкой')}
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
                    onClick={() => loadFormulaState(item.formula, item.presetId ?? '')}
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
