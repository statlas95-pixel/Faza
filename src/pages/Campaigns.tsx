import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import {
  CAMPAIGNS,
  computeCampaignReport,
  evaluateCampaignLabFormula,
  type CampaignDefinition,
  type CampaignId,
} from '../../shared/campaigns'
import type { FormulaInput } from '../../shared/formulation'
import { ingredients } from '../content'
import { resetCampaign, saveCampaignProgress, useProgress } from '../store'
import { showToast } from '../components/Toast'
import { useTitle } from './util'

export default function CampaignsPage() {
  useTitle(tr('Кампании запуска продукта'))
  const en = language === 'en'
  const nav = useNavigate()
  const progress = useProgress()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialId = (searchParams.get('id') as CampaignId) || 'spf50-city-fluid'
  const [activeId, setActiveId] = useState<CampaignId>(
    CAMPAIGNS.some((c) => c.id === initialId) ? initialId : 'spf50-city-fluid',
  )
  const def: CampaignDefinition = CAMPAIGNS.find((c) => c.id === activeId) ?? CAMPAIGNS[0]
  const rec = progress.campaigns[activeId]
  const unlockedStage = rec?.stage ?? 0
  const [viewStage, setViewStage] = useState<number>(Math.min(4, unlockedStage))
  const [selectedSavedId, setSelectedSavedId] = useState<string>('')

  function switchCampaign(id: CampaignId) {
    setActiveId(id)
    setSearchParams({ id }, { replace: true })
    const nextRec = progress.campaigns[id]
    setViewStage(Math.min(4, nextRec?.stage ?? 0))
  }

  const stage = def.stages[Math.min(def.stages.length - 1, Math.max(0, viewStage))]
  const pickedChoiceId = rec?.choices?.[String(stage.index)]
  const pickedOption = stage.options?.find((o) => o.id === pickedChoiceId)

  // Для Этапа 2: текущая рабочая формула кампании (из Лаборатории, из сохранённых, либо стартовый шаблон)
  const activeLabFormula: FormulaInput = useMemo(() => {
    if (selectedSavedId) {
      const found = progress.savedFormulas.find((f) => f.id === selectedSavedId)
      if (found) return found.formula
    }
    return (rec?.labFormula as FormulaInput | undefined) ?? def.starterFormula
  }, [selectedSavedId, progress.savedFormulas, rec?.labFormula, def.starterFormula])

  const labCheck = useMemo(
    () => evaluateCampaignLabFormula(def.id, activeLabFormula, ingredients),
    [def.id, activeLabFormula],
  )

  const report = useMemo(() => computeCampaignReport(def, rec), [def, rec])
  const isFinished = unlockedStage >= 5

  function pickDecision(optionId: string) {
    const nextStage = Math.max(unlockedStage, stage.index + 1)
    const nextChoices = { ...(rec?.choices ?? {}), [String(stage.index)]: optionId }
    const nextRec = {
      ...(rec ?? { id: def.id, stage: 0, choices: {}, at: Date.now() }),
      stage: nextStage,
      choices: nextChoices,
      at: Date.now(),
    }
    const nextReport = computeCampaignReport(def, nextRec)
    saveCampaignProgress(def.id, {
      stage: nextStage,
      choices: { [String(stage.index)]: optionId },
      ...(nextStage >= 5 ? { finalScore: nextReport.totalScore, completedAt: Date.now() } : {}),
    })
    if (nextStage >= 5) {
      showToast(tr('Кампания запуска завершена — сформирован итоговый отчёт!'))
    }
  }

  function submitLabFormulaToCampaign(formulaToCommit: FormulaInput) {
    const res = evaluateCampaignLabFormula(def.id, formulaToCommit, ingredients)
    const nextStage = Math.max(unlockedStage, 2)
    saveCampaignProgress(def.id, {
      stage: nextStage,
      labFormula: JSON.parse(JSON.stringify(formulaToCommit)),
      labSummary: {
        score: res.score,
        passed: res.passed,
        costPerKg: res.costPerKg,
        errors: res.errors,
        spf: res.spf,
        notes: res.notes,
      },
    })
    showToast(tr('Рецептура зафиксирована в Этапе 2 кампании'))
    setViewStage(2)
  }

  function handleReset() {
    resetCampaign(def.id)
    setViewStage(0)
    setSelectedSavedId('')
    showToast(tr('Прогресс кампании сброшен'))
  }

  return (
    <div className="page campaigns-page">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Кампании запуска: от R&D-брифа до серии 1 000 кг')}</h1>
        </div>
        {rec && (
          <button type="button" className="btn small ghost" onClick={handleReset}>
            {tr('Начать кампанию заново')}
          </button>
        )}
      </div>

      <p className="lead">
        {tr('Выберите флагманский продукт и проведите его через все 5 этапов реального запуска. Рецептура собирается в живой Лаборатории на Этапе 2, а ошибки и компромиссы переносятся в стресс-тесты, реактор и рекламацию с рынка.')}
      </p>

      {/* Выбор из 2 сквозных кампаний */}
      <div className="camp-picker" role="tablist" aria-label={tr('Выбор кампании запуска')}>
        {CAMPAIGNS.map((c) => {
          const cRec = progress.campaigns[c.id]
          const doneStages = Math.min(5, cRec?.stage ?? 0)
          const active = c.id === activeId
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`camp-card-tab ${active ? 'on' : ''}`}
              onClick={() => switchCampaign(c.id)}
            >
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="rx-tab-cat">{en ? c.badgeEn : c.badgeRu}</span>
                <span className="tag num">
                  {doneStages}/5 {cRec?.finalScore !== undefined ? `· ${cRec.finalScore}/100` : ''}
                </span>
              </div>
              <b>{en ? c.titleEn : c.titleRu}</b>
              <span className="small muted">{en ? c.subtitleEn : c.subtitleRu}</span>
            </button>
          )
        })}
      </div>

      {/* Степпер 5 этапов */}
      <nav className="camp-stepper" aria-label={tr('Этапы кампании')}>
        {def.stages.map((st) => {
          const done = unlockedStage > st.index
          const locked = st.index > unlockedStage
          const cur = viewStage === st.index
          return (
            <button
              key={st.code}
              type="button"
              disabled={locked}
              className={`camp-step ${cur ? 'cur' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => setViewStage(st.index)}
            >
              <span className="camp-step-num num">{done ? '✓' : st.index + 1}</span>
              <span className="camp-step-txt">
                <b>{en ? st.roleEn : st.roleRu}</b>
                <span className="small">{en ? st.titleEn.replace(/^Stage \d+ · /, '') : st.titleRu.replace(/^Этап \d+ · /, '')}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Перенесённые последствия с прошлых этапов */}
      {report.carriedConsequencesRu.length > 0 && viewStage > 0 && (
        <section className="panel camp-conseq" role="region" aria-label={tr('Перенесённые последствия')}>
          <b>{tr('Перенесённые технологические последствия прошлых этапов:')}</b>
          <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {(en ? report.carriedConsequencesEn : report.carriedConsequencesRu).map((txt, idx) => (
              <li key={idx}>{txt}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Активный этап кампании */}
      <section className="panel camp-stage-panel">
        <div className="sandbox-head-row">
          <div>
            <p className="eyebrow">{en ? stage.roleEn : stage.roleRu} · {def.batchScaleKg} {tr('кг')}</p>
            <h2>{en ? stage.titleEn : stage.titleRu}</h2>
          </div>
          <span className="tag num">{tr('Этап')} {stage.index + 1} / 5</span>
        </div>

        <p>{en ? stage.promptEn : stage.promptRu}</p>

        {/* Вариант A: Этап решения (Этапы 1, 3, 4, 5) */}
        {stage.kind === 'decision' && stage.options && (
          <div className="camp-options">
            {stage.options.map((opt) => {
              const selected = pickedChoiceId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`camp-opt ${selected ? 'on' : ''}`}
                  onClick={() => pickDecision(opt.id)}
                >
                  <div className="camp-opt-head">
                    <b>{en ? opt.labelEn : opt.labelRu}</b>
                    {opt.costImpactRubPerKg !== 0 && (
                      <span className="tag num">
                        {opt.costImpactRubPerKg > 0 ? `+${opt.costImpactRubPerKg}` : opt.costImpactRubPerKg} {tr('₽/кг')}
                      </span>
                    )}
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>{en ? opt.detailEn : opt.detailRu}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Обратная связь по принятому решению */}
        {pickedOption && (
          <div className={`rx-verdict ${pickedOption.scoreDelta >= 15 ? 'ok' : 'warn'}`} role="status">
            <div>
              <b>{pickedOption.scoreDelta >= 15 ? tr('✓ Решение утверждено') : tr('⚠ Решение принято с технологическим риском')}</b>{' '}
              <span className="num">({pickedOption.scoreDelta}/20)</span>
            </div>
            <p className="small" style={{ margin: '6px 0 0' }}>
              {en ? pickedOption.feedbackEn : pickedOption.feedbackRu}
            </p>
            {stage.index < 4 && (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn small primary"
                  onClick={() => setViewStage(stage.index + 1)}
                >
                  {tr('Перейти к следующему этапу →')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Вариант B: Этап 2 — Живая связка с Лабораторией рецептур */}
        {stage.kind === 'lab-formula' && (
          <div className="camp-lab-box">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => nav(`/sandbox?campaign=${def.id}`)}
              >
                {tr('Открыть и доработать рецептуру в Лаборатории →')}
              </button>
              {progress.savedFormulas.length > 0 && (
                <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>{tr('Или выбрать из Портфолио:')}</span>
                  <select value={selectedSavedId} onChange={(e) => setSelectedSavedId(e.target.value)}>
                    <option value="">{rec?.labFormula ? tr('Текущая рецептура кампании') : tr('Стартовый шаблон с ошибками')}</option>
                    {progress.savedFormulas.map((sf) => (
                      <option key={sf.id} value={sf.id}>{sf.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <dl className="outcome" style={{ marginTop: 12 }}>
              <div>
                <dt>{tr('Балл рецептуры (Этап 2)')}</dt>
                <dd className="num"><b>{labCheck.score} / 20</b></dd>
              </div>
              <div>
                <dt>{tr('Себестоимость сырья')}</dt>
                <dd className="num"><b>{labCheck.costPerKg} {tr('₽/кг')}</b></dd>
              </div>
              <div>
                <dt>{tr('Критические ошибки')}</dt>
                <dd className="num"><b>{labCheck.errors}</b></dd>
              </div>
              {labCheck.spf !== undefined && (
                <div>
                  <dt>in-silico SPF / UVA</dt>
                  <dd className="num"><b>SPF {labCheck.spf} · {labCheck.uvaRatio}</b></dd>
                </div>
              )}
            </dl>

            <ul className="sandbox-goals" style={{ marginTop: 10 }}>
              {labCheck.checks.map((c) => (
                <li key={c.id} className={c.passed ? 'ok' : 'pending'}>
                  <span aria-hidden>{c.passed ? '✓' : '○'}</span> {en ? c.labelEn : c.labelRu}
                </li>
              ))}
            </ul>

            {labCheck.notes.length > 0 && (
              <ul className="linklist small" style={{ marginTop: 8 }}>
                {labCheck.notes.map((n, i) => <li key={i} className="warnline">⚠ {n}</li>)}
              </ul>
            )}

            <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => submitLabFormulaToCampaign(activeLabFormula)}
              >
                {labCheck.passed
                  ? tr('Утвердить эту рецептуру и перейти к Этапу 3 →')
                  : tr('Передать как есть (с рисками) к Этапу 3 →')}
              </button>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => submitLabFormulaToCampaign(def.referenceGoodFormula)}
              >
                {tr('Применить эталонную R&D-рецептуру')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Итоговый отчёт запуска после завершения Этапа 5 */}
      {isFinished && (
        <section className="panel camp-report" role="region" aria-label={tr('Итоговый отчёт запуска')}>
          <p className="eyebrow">{tr('Итоговый отчёт запуска продукта')} · {def.batchScaleKg} {tr('кг')}</p>
          <h2>{en ? report.gradeEn : report.gradeRu}</h2>
          <dl className="outcome">
            <div>
              <dt>{tr('Индекс готовности запуска')}</dt>
              <dd className="num"><b>{report.totalScore} / 100</b></dd>
            </div>
            <div>
              <dt>{tr('Итоговая себестоимость сырья')}</dt>
              <dd className="num"><b>{report.estimatedCostPerKg} {tr('₽/кг')}</b></dd>
            </div>
            <div>
              <dt>{tr('Прогноз риска брака / возвратов')}</dt>
              <dd className="num"><b>{report.defectRiskPct} %</b></dd>
            </div>
            <div>
              <dt>{tr('Объём промышленной партии')}</dt>
              <dd className="num"><b>{def.batchScaleKg} {tr('кг')}</b></dd>
            </div>
          </dl>
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <Link className="btn primary" to="/sandbox">{tr('Открыть Лабораторию рецептур')}</Link>
            <Link className="btn" to="/reactions">{tr('Изучить кинетику реакций')}</Link>
            <button type="button" className="btn ghost" onClick={handleReset}>
              {tr('Пройти кампанию ещё раз')}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
