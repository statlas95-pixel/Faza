import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import {
  EU_ALLERGENS_CATALOG,
  INCI_BENCHMARK_EXAMPLES,
  SCCS_PRODUCT_CATEGORIES,
  analyzePastedInci,
  computeAllergenDeclaration,
  computeIso16128,
  computeSccsMoS,
  getIngredientNoi,
} from '../../shared/engineering-tools'
import type { ProductType } from '../../shared/formulation'
import { encodeShareFormula } from '../../shared/formulation-lab5'
import { ingredients, sandboxPresets } from '../content'
import { showToast } from '../components/Toast'
import { useProgress } from '../store'
import { useTitle } from './util'

type ToolTab = 'inci' | 'iso16128' | 'allergens' | 'mos'

const ALLERGEN_PRESETS: { id: string; labelRu: string; labelEn: string; fragPct: number; type: ProductType; map: Record<string, number> }[] = [
  {
    id: 'citrus',
    labelRu: 'Цитрус-бергамот (0,5 % leave-on)',
    labelEn: 'Citrus-Bergamot (0.5% leave-on)',
    fragPct: 0.5,
    type: 'leave-on',
    map: { limonene: 18.5, linalool: 6.2, 'linalyl-acetate': 8.4, citral: 1.4, 'citrus-aurantium': 12.0, pinene: 1.8, geraniol: 0.15 },
  },
  {
    id: 'floral',
    labelRu: 'Роза-лаванда (0,4 % leave-on)',
    labelEn: 'Rose-Lavender (0.4% leave-on)',
    fragPct: 0.4,
    type: 'leave-on',
    map: { citronellol: 9.0, geraniol: 4.5, linalool: 11.2, 'linalyl-acetate': 7.5, 'lavandula-oil': 6.0, 'rose-ketones': 0.08, 'benzyl-salicylate': 5.0 },
  },
  {
    id: 'woody-wash',
    labelRu: 'Древесный гель для душа (1,0 % rinse-off)',
    labelEn: 'Woody Shower Gel (1.0% rinse-off)',
    fragPct: 1.0,
    type: 'rinse-off',
    map: { 'iso-e-super': 14.0, limonene: 4.5, linalool: 2.1, 'pogostemon-cablin': 3.5, 'beta-caryophyllene': 0.8, coumarin: 0.9, vanillin: 1.2 },
  },
]

const MOS_PRESETS = [
  { id: 'retinol-face', labelRu: 'Ретинол 0,3 % — крем для лица', labelEn: 'Retinol 0.3% — face cream', catId: 'face-cream', concPct: 0.3, dermalAbsPct: 5.7, noael: 1.0 },
  { id: 'retinol-body', labelRu: 'Ретинол 0,3 % — лосьон для тела (провал!)', labelEn: 'Retinol 0.3% — body lotion (fail!)', catId: 'body-lotion', concPct: 0.3, dermalAbsPct: 5.7, noael: 1.0 },
  { id: 'phenoxy-face', labelRu: 'Феноксиэтанол 1,0 % — крем для лица', labelEn: 'Phenoxyethanol 1.0% — face cream', catId: 'face-cream', concPct: 1.0, dermalAbsPct: 80, noael: 357 },
  { id: 'salicylic-body', labelRu: 'Салициловая к-та 2,0 % — лосьон для тела', labelEn: 'Salicylic acid 2.0% — body lotion', catId: 'body-lotion', concPct: 2.0, dermalAbsPct: 22.6, noael: 75 },
]

export default function ToolsPage() {
  useTitle(tr('Инженерные утилиты 2.0'))
  const en = language === 'en'
  const nav = useNavigate()
  const progress = useProgress()
  const [tab, setTab] = useState<ToolTab>('inci')

  // ── 1. Paste-to-Lab INCI state ─────────────────────────────────────────────
  const [inciText, setInciText] = useState(INCI_BENCHMARK_EXAMPLES[0].inci)
  const [inciType, setInciType] = useState<ProductType>('leave-on')
  const inciReport = useMemo(() => analyzePastedInci(inciText, ingredients, inciType), [inciText, inciType])

  function openInciInLab() {
    if (!inciReport.draftFormula.rows.length) {
      showToast(tr('Не удалось распознать компоненты из каталога'))
      return
    }
    const token = encodeShareFormula(inciReport.draftFormula, en ? 'INCI Reconstructed Draft' : 'Черновик из INCI')
    nav(`/sandbox?share=${token}`)
  }

  // ── 2. ISO 16128 state ─────────────────────────────────────────────────────
  const [isoRows, setIsoRows] = useState<{ ingredientId: string; pct: number }[]>(() =>
    sandboxPresets[0]?.rows.map((r) => ({ ingredientId: r.ingredientId, pct: r.pct })) ?? [
      { ingredientId: 'aqua', pct: 76 },
      { ingredientId: 'glycerin', pct: 4 },
      { ingredientId: 'caprylic-triglyceride', pct: 10 },
      { ingredientId: 'c13-15-alkane', pct: 4 },
      { ingredientId: 'olivem-1000', pct: 5 },
      { ingredientId: 'phenoxyethanol', pct: 1 },
    ],
  )
  const [isoAddId, setIsoAddId] = useState('c13-15-alkane')
  const isoReport = useMemo(() => computeIso16128(isoRows, ingredients), [isoRows])

  function loadIsoFromSaved(idx: number) {
    const rec = progress.savedFormulas[idx]
    if (!rec?.formula?.rows) return
    setIsoRows(rec.formula.rows.map((r: any) => ({ ingredientId: r.ingredientId, pct: Number(r.pct) || 0 })))
    showToast(tr('Формула загружена в расчёт ISO 16128'))
  }

  // ── 3. Allergens EU 2023/1545 state ────────────────────────────────────────
  const [fragPct, setFragPct] = useState(0.5)
  const [algType, setAlgType] = useState<ProductType>('leave-on')
  const [algMap, setAlgMap] = useState<Record<string, number>>(ALLERGEN_PRESETS[0].map)
  const [algFilter, setAlgFilter] = useState<'all' | 'active' | 'new2023'>('all')
  const algReport = useMemo(() => computeAllergenDeclaration(fragPct, algType, algMap), [fragPct, algType, algMap])

  const visibleAllergens = useMemo(() => {
    if (algFilter === 'active') return EU_ALLERGENS_CATALOG.filter((a) => (algMap[a.id] ?? 0) > 0)
    if (algFilter === 'new2023') return EU_ALLERGENS_CATALOG.filter((a) => a.group === 'new2023')
    return EU_ALLERGENS_CATALOG
  }, [algFilter, algMap])

  function copyAllergenTail() {
    if (!algReport.inciTail) return
    navigator.clipboard?.writeText(algReport.inciTail).then(() => {
      showToast(tr('Хвост аллергенов скопирован в буфер'))
    }).catch(() => {})
  }

  // ── 4. SCCS MoS state ──────────────────────────────────────────────────────
  const [mosCatId, setMosCatId] = useState('face-cream')
  const [mosDailyG, setMosDailyG] = useState(1.54)
  const [mosRetention, setMosRetention] = useState(1.0)
  const [mosConcPct, setMosConcPct] = useState(0.3)
  const [mosDermalPct, setMosDermalPct] = useState(5.7)
  const [mosNoael, setMosNoael] = useState(1.0)
  const [mosBw, setMosBw] = useState(60)
  const mosResult = useMemo(
    () =>
      computeSccsMoS({
        dailyGrams: mosDailyG,
        retentionFactor: mosRetention,
        concPct: mosConcPct,
        dermalAbsPct: mosDermalPct,
        noaelMgKgDay: mosNoael,
        bodyWeightKg: mosBw,
      }),
    [mosDailyG, mosRetention, mosConcPct, mosDermalPct, mosNoael, mosBw],
  )

  function applyMosCategory(catId: string) {
    setMosCatId(catId)
    const cat = SCCS_PRODUCT_CATEGORIES.find((c) => c.id === catId)
    if (cat) {
      setMosDailyG(cat.dailyGrams)
      setMosRetention(cat.retentionFactor)
      setMosDermalPct(cat.defaultDermalAbsPct)
    }
  }

  function applyMosPreset(p: (typeof MOS_PRESETS)[number]) {
    const cat = SCCS_PRODUCT_CATEGORIES.find((c) => c.id === p.catId)
    setMosCatId(p.catId)
    if (cat) {
      setMosDailyG(cat.dailyGrams)
      setMosRetention(cat.retentionFactor)
    }
    setMosConcPct(p.concPct)
    setMosDermalPct(p.dermalAbsPct)
    setMosNoael(p.noael)
  }

  return (
    <div className="page tools-page">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Инженерные утилиты 2.0')}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {tr('Прикладные расчётные инструменты R&D-технолога: разбор этикеток INCI с переносом в Лабораторию, индекс натуральности ISO 16128, 82 аллергена EU 2023/1545 и расчёт безопасности SCCS MoS.')}
          </p>
        </div>
        <div className="row">
          <Link to="/sandbox" className="btn ghost">⚗ {tr('Лаборатория рецептур')}</Link>
          <Link to="/topics/toxicology-pif-cpsr-mos" className="btn ghost">📖 {tr('Теория CPSR и MoS')}</Link>
        </div>
      </div>

      <div className="tools-tabs" role="tablist" aria-label={tr('Инженерные утилиты')}>
        <button type="button" role="tab" aria-selected={tab === 'inci'} className={`chip ${tab === 'inci' ? 'on' : ''}`} onClick={() => setTab('inci')}>
          🔍 {tr('INCI → Лаборатория')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'iso16128'} className={`chip ${tab === 'iso16128' ? 'on' : ''}`} onClick={() => setTab('iso16128')}>
          🌿 {tr('Калькулятор ISO 16128 (NOI)')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'allergens'} className={`chip ${tab === 'allergens' ? 'on' : ''}`} onClick={() => setTab('allergens')}>
          🌸 {tr('Аллергены EU 2023/1545')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mos'} className={`chip ${tab === 'mos' ? 'on' : ''}`} onClick={() => setTab('mos')}>
          🛡 {tr('Токсикология SCCS MoS')}
        </button>
      </div>

      {tab === 'inci' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="sandbox-head-row">
            <div>
              <h2>{tr('Paste-to-Lab: анализ реального состава INCI')}</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                {tr('Вставьте список INCI с упаковки конкурента — алгоритм распознает сырьё по каталогу из 190 позиций, найдёт границу 1 %, выявит аллергены и соберёт редактируемый черновик в Лаборатории.')}
              </p>
            </div>
            <button type="button" className="btn primary" onClick={openInciInLab}>
              ⚗ {tr('Открыть черновик в Лаборатории')}
            </button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="small muted">{tr('Примеры INCI:')}</span>
            {INCI_BENCHMARK_EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="chip"
                onClick={() => { setInciText(ex.inci); setInciType(ex.productType) }}
              >
                {en ? ex.titleEn : ex.title}
              </button>
            ))}
            <select
              className="sel"
              aria-label={tr('Тип продукта (регуляторный)')}
              value={inciType}
              onChange={(e) => setInciType(e.target.value as ProductType)}
              style={{ marginLeft: 'auto' }}
            >
              <option value="leave-on">{tr('Несмываемое (leave-on)')}</option>
              <option value="rinse-off">{tr('Смываемое (rinse-off)')}</option>
            </select>
          </div>

          <textarea
            className="tools-textarea"
            rows={4}
            value={inciText}
            onChange={(e) => setInciText(e.target.value)}
            placeholder="Aqua, Glycerin, Caprylic/Capric Triglyceride, Niacinamide..."
            aria-label={tr('Список INCI для разбора')}
          />

          <div className="tools-kpi-row">
            <div className="tools-kpi">
              <span className="small muted">{tr('Распознано в каталоге')}</span>
              <b className="num">{inciReport.matchedCount} / {inciReport.items.length}</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Маркер 1 %')}</span>
              <b>{inciReport.markerIndex >= 0 ? `#${inciReport.markerIndex + 1} · ${inciReport.items[inciReport.markerIndex].raw}` : tr('Не найден')}</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('ISO 16128 (черновик)')}</span>
              <b className="num">{inciReport.iso16128.noiWithWaterPct} %</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Аллергены EU 2023/1545')}</span>
              <b className="num">{inciReport.allergensFound.length}</b>
            </div>
          </div>

          {inciReport.insights.length > 0 && (
            <ul className="tools-insights">
              {inciReport.insights.map((ins, i) => <li key={i}>{ins}</li>)}
            </ul>
          )}

          <div className="tbl-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>INCI</th>
                  <th>{tr('Функция')}</th>
                  <th>{tr('Фаза')}</th>
                  <th>{tr('Зона')}</th>
                  <th>{tr('Оценка %')}</th>
                </tr>
              </thead>
              <tbody>
                {inciReport.items.map((it) => (
                  <tr key={it.position} className={it.isMarker ? 'tools-row-marker' : ''}>
                    <td className="num">{it.position}</td>
                    <td>
                      <b>{it.raw}</b>
                      {it.matched && <span className="small muted"> — {tr(it.matched.name)}</span>}
                    </td>
                    <td><span className="chip">{it.inferredRole}</span></td>
                    <td className="num">{it.inferredPhase}</td>
                    <td>
                      {it.isMarker ? (
                        <span className="chip on">{tr('Граница 1 %')}</span>
                      ) : it.isAllergen ? (
                        <span className="chip">{tr('Аллерген')}</span>
                      ) : it.belowOnePct ? (
                        <span className="small muted">≤ 1 %</span>
                      ) : (
                        <span className="small">&gt; 1 %</span>
                      )}
                    </td>
                    <td className="num">{it.estimatedPct} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'iso16128' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="sandbox-head-row">
            <div>
              <h2>{tr('Калькулятор натуральности ISO 16128 (NOI)')}</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                {tr('Точный расчёт индекса натурального происхождения (Natural Origin Index) с учётом воды (Aqua = 1,00) и без учёта воды — для маркировки и бриф-контроля.')}
              </p>
            </div>
            {progress.savedFormulas.length > 0 && (
              <select
                className="sel"
                defaultValue=""
                aria-label={tr('Загрузить сохранённую рецептуру')}
                onChange={(e) => { if (e.target.value !== '') loadIsoFromSaved(Number(e.target.value)) }}
              >
                <option value="">{tr('Загрузить из моих рецептур…')}</option>
                {progress.savedFormulas.map((sf, idx) => (
                  <option key={sf.id} value={idx}>{sf.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="tools-kpi-row">
            <div className="tools-kpi accent">
              <span className="small muted">{tr('NOI с водой (ISO 16128)')}</span>
              <b className="num" style={{ fontSize: '1.6rem' }}>{isoReport.noiWithWaterPct} %</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('NOI без воды (сухая/масляная база)')}</span>
              <b className="num" style={{ fontSize: '1.6rem' }}>{isoReport.noiWithoutWaterPct} %</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Сумма рецептуры')}</span>
              <b className="num">{isoReport.totalPct} %</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Синтетическая доля')}</span>
              <b className="num">{isoReport.syntheticMassPct} %</b>
            </div>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <select className="sel" value={isoAddId} onChange={(e) => setIsoAddId(e.target.value)} aria-label={tr('Выбрать компонент')}>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.inci} ({tr('NOI')} {getIngredientNoi(ing).toFixed(2)})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (isoRows.some((r) => r.ingredientId === isoAddId)) return
                setIsoRows([...isoRows, { ingredientId: isoAddId, pct: 2 }])
              }}
            >
              + {tr('Добавить компонент')}
            </button>
          </div>

          <div className="tbl-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>INCI</th>
                  <th>{tr('Доля, %')}</th>
                  <th>NOI (0–1)</th>
                  <th>{tr('Вклад в NOI, %')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {isoRows.map((r, idx) => {
                  const ing = ingredients.find((x) => x.id === r.ingredientId)
                  const noi = ing ? getIngredientNoi(ing) : 0
                  return (
                    <tr key={`${r.ingredientId}-${idx}`}>
                      <td><b>{ing?.inci ?? r.ingredientId}</b> <span className="small muted">{ing ? tr(ing.name) : ''}</span></td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="num-in"
                          value={r.pct}
                          onChange={(e) => {
                            const next = [...isoRows]
                            next[idx] = { ...r, pct: Math.max(0, Number(e.target.value) || 0) }
                            setIsoRows(next)
                          }}
                        />
                      </td>
                      <td className="num">{noi.toFixed(2)}</td>
                      <td className="num">{((r.pct * noi)).toFixed(2)} %</td>
                      <td>
                        <button type="button" className="btn ghost" onClick={() => setIsoRows(isoRows.filter((_, i) => i !== idx))}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'allergens' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="sandbox-head-row">
            <div>
              <h2>{tr('Калькулятор 82 аллергенов отдушек (EU 2023/1545)')}</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                {tr('Задайте ввод парфюмерной композиции и проценты аллергенов из сертификата поставщика — калькулятор проверит пороги 0,001 % (leave-on) / 0,01 % (rinse-off) и соберёт готовый хвост INCI.')}
              </p>
            </div>
            <button type="button" className="btn primary" disabled={!algReport.inciTail} onClick={copyAllergenTail}>
              📋 {tr('Копировать хвост INCI')}
            </button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {ALLERGEN_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chip"
                onClick={() => { setFragPct(p.fragPct); setAlgType(p.type); setAlgMap(p.map) }}
              >
                {en ? p.labelEn : p.labelRu}
              </button>
            ))}
          </div>

          <div className="tools-form-grid" style={{ marginTop: 14 }}>
            <label>
              <span className="small muted">{tr('Ввод отдушки в рецептуру, %')}</span>
              <input type="number" step="0.05" min="0" max="10" className="num-in" value={fragPct} onChange={(e) => setFragPct(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label>
              <span className="small muted">{tr('Тип продукта (порог декларирования)')}</span>
              <select className="sel" value={algType} onChange={(e) => setAlgType(e.target.value as ProductType)}>
                <option value="leave-on">{tr('Несмываемое — порог 0,001 % (10 ppm)')}</option>
                <option value="rinse-off">{tr('Смываемое — порог 0,01 % (100 ppm)')}</option>
              </select>
            </label>
            <label>
              <span className="small muted">{tr('Фильтр списка')}</span>
              <select className="sel" value={algFilter} onChange={(e) => setAlgFilter(e.target.value as any)}>
                <option value="all">{tr('Все ключевые аллергены')} ({EU_ALLERGENS_CATALOG.length})</option>
                <option value="active">{tr('Только с ненулевым %')}</option>
                <option value="new2023">{tr('Только новые EU 2023/1545')}</option>
              </select>
            </label>
          </div>

          <div className="tools-inci-box" style={{ marginTop: 14 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>
              {tr('Готовый хвост INCI для этикетки')} ({algReport.declared.length} {tr('аллергенов ≥')} {algReport.thresholdPct} %):
            </div>
            <code>{algReport.inciTail || tr('Ни один аллерген не превышает порог декларирования.')}</code>
          </div>

          <div className="tbl-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>INCI (CAS)</th>
                  <th>{tr('Группа')}</th>
                  <th>{tr('% в отдушке')}</th>
                  <th>{tr('% в продукте')}</th>
                  <th>ppm</th>
                  <th>{tr('Статус')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleAllergens.map((a) => {
                  const inFrag = algMap[a.id] ?? 0
                  const inProd = (fragPct * inFrag) / 100
                  const ppm = inProd * 10000
                  const decl = inFrag > 0 && inProd >= algReport.thresholdPct - 1e-9
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{a.inci}</b> <span className="small muted">({a.cas})</span>
                        <div className="small muted">{en ? a.noteEn : a.noteRu}</div>
                      </td>
                      <td>
                        <span className={`chip ${a.group === 'new2023' ? 'on' : ''}`}>
                          {a.group === 'new2023' ? 'EU 2023/1545' : 'Classic 24'}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="num-in"
                          value={inFrag}
                          onChange={(e) => setAlgMap({ ...algMap, [a.id]: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="num">{inProd.toFixed(5)} %</td>
                      <td className="num">{ppm.toFixed(1)}</td>
                      <td>
                        {decl ? (
                          <span className="chip on">{tr('В INCI')}</span>
                        ) : (
                          <span className="small muted">{tr('Ниже порога')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'mos' && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{tr('Токсикологический калькулятор SCCS MoS (Margin of Safety)')}</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {tr('Оценка системной экспозиции SED и запаса безопасности MoS = NOAEL / SED по руководству SCCS Notes of Guidance (12th Revision) для отчёта CPSR.')}
          </p>

          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="small muted">{tr('Типовые кейсы:')}</span>
            {MOS_PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" onClick={() => applyMosPreset(p)}>
                {en ? p.labelEn : p.labelRu}
              </button>
            ))}
          </div>

          <div className="tools-form-grid" style={{ marginTop: 14 }}>
            <label>
              <span className="small muted">{tr('Категория продукта (SCCS 12th Rev)')}</span>
              <select className="sel" value={mosCatId} onChange={(e) => applyMosCategory(e.target.value)}>
                {SCCS_PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{en ? c.nameEn : c.nameRu} ({c.dailyGrams} g/d)</option>
                ))}
              </select>
            </label>
            <label>
              <span className="small muted">{tr('Суточное нанесение A, г/сут')}</span>
              <input type="number" step="0.01" min="0" className="num-in" value={mosDailyG} onChange={(e) => setMosDailyG(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label>
              <span className="small muted">{tr('Фактор удержания (Retention)')}</span>
              <input type="number" step="0.01" min="0.001" max="1" className="num-in" value={mosRetention} onChange={(e) => setMosRetention(Math.max(0, Math.min(1, Number(e.target.value) || 0)))} />
            </label>
            <label>
              <span className="small muted">{tr('Концентрация актива C, %')}</span>
              <input type="number" step="0.05" min="0" max="100" className="num-in" value={mosConcPct} onChange={(e) => setMosConcPct(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label>
              <span className="small muted">{tr('Кожная абсорбция DAp, %')}</span>
              <input type="number" step="0.5" min="0.1" max="100" className="num-in" value={mosDermalPct} onChange={(e) => setMosDermalPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            </label>
            <label>
              <span className="small muted">{tr('NOAEL (PoDsys), мг/(кг·сут)')}</span>
              <input type="number" step="0.5" min="0.01" className="num-in" value={mosNoael} onChange={(e) => setMosNoael(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label>
              <span className="small muted">{tr('Масса тела (по SCCS = 60 кг)')}</span>
              <input type="number" step="1" min="10" max="120" className="num-in" value={mosBw} onChange={(e) => setMosBw(Math.max(10, Number(e.target.value) || 60))} />
            </label>
          </div>

          <div className="tools-kpi-row" style={{ marginTop: 16 }}>
            <div className="tools-kpi">
              <span className="small muted">{tr('Системная экспозиция SED')}</span>
              <b className="num">{mosResult.sedMgKgDay} {en ? 'mg/kg bw/d' : 'мг/(кг·сут)'}</b>
            </div>
            <div className={`tools-kpi ${mosResult.passed ? 'ok' : 'err'}`}>
              <span className="small muted">{tr('Запас безопасности MoS')}</span>
              <b className="num" style={{ fontSize: '1.6rem' }}>{mosResult.mos >= 9999 ? '∞' : mosResult.mos}</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Вердикт CPSR (порог ≥ 100)')}</span>
              <b>{mosResult.passed ? tr('✓ Проходит (MoS ≥ 100)') : tr('✕ Не проходит (MoS < 100)')}</b>
            </div>
            <div className="tools-kpi">
              <span className="small muted">{tr('Макс. безопасный ввод при MoS = 100')}</span>
              <b className="num">{mosResult.maxSafePct} %</b>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
