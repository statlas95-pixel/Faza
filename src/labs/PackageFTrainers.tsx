import { useState } from 'react'
import { tr } from '../../shared/locale'
import {
  computeSpfLabMetrics,
  defaultSpfState,
  evaluatePackCompat,
  evaluateSpfLab,
  evaluateStabilityTriage,
  evaluateWpuAudit,
  type PackCompatLabData,
  type SpfFilterState,
  type StabilityTriageLabData,
  type WpuAuditLabData,
} from '../../shared/package-f-sim'
import type { LabMeta } from '../content'
import { VerdictTag } from '../ui'
import { Brief, DebriefLinks, LabFrame, markFinished, Transfer, useLabState } from './LabPage'

// ============================================================================
// 1. Симулятор упаковки и совместимости ISO/TR 18811 (engine: 'pack-compat')
// ============================================================================

interface PackState {
  phase: 'brief' | 'work' | 'debrief'
  activeProdId?: string
  selectedPacks: Record<string, string>
  quiz: Record<string, string>
  transfer: Record<number, any>
  finished?: boolean
}

export function PackCompatSim({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as PackCompatLabData
  const [s, set, reset] = useLabState<PackState>(lab.id, () => ({
    phase: 'brief',
    activeProdId: data.products[0]?.id,
    selectedPacks: {},
    quiz: {},
    transfer: {},
  }))
  const [warn, setWarn] = useState('')

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Термошкаф +45 °C'), tr('Заключение ISO/TR 18811')]}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={Object.keys(s.selectedPacks).length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const activeProd = data.products.find((p) => p.id === s.activeProdId) ?? data.products[0]
    const submit = () => {
      const missingProds = data.products.filter((p) => !s.selectedPacks[p.id])
      const missingQuiz = data.questions.filter((q) => !s.quiz[q.id])
      if (missingProds.length || missingQuiz.length) {
        setWarn(tr('Утвердите упаковку для всех 3 продуктов и ответьте на оба контрольных вопроса ниже.'))
        return
      }
      const ev = evaluatePackCompat(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `ISO/TR 18811 · ${Math.round(ev.score * 100)} %`,
        { selectedPacks: s.selectedPacks, quiz: s.quiz },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="panel">
          <p className="eyebrow">{tr('Матрица совместимости · 4 недели при +45 °C · RH 75 %')}</p>
          <h2>{tr('1. Исследуйте поведение тары для каждого продукта')}</h2>
          <div className="chips" style={{ marginBottom: 14 }}>
            {data.products.map((prod, idx) => {
              const chosen = s.selectedPacks[prod.id]
              return (
                <button
                  key={prod.id}
                  type="button"
                  className={`chip ${activeProd.id === prod.id ? 'on' : ''}`}
                  onClick={() => set((x) => { x.activeProdId = prod.id })}
                >
                  {idx + 1}. {tr(prod.name).slice(0, 42)}{tr(prod.name).length > 42 ? '…' : ''} {chosen ? '✓' : ''}
                </button>
              )
            })}
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <h3>{tr(activeProd.name)}</h3>
            <p className="small muted">{tr(activeProd.composition)}</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr('Вариант упаковки')}</th>
                    <th>{tr('Потеря массы')}</th>
                    <th>{tr('Корпус / стенки')}</th>
                    <th>{tr('Органолептика / титр')}</th>
                    <th>{tr('Работа укупорки')}</th>
                    <th>{tr('Выбор')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProd.results.map((res) => {
                    const pack = data.packs.find((pk) => pk.id === res.packId)
                    const picked = s.selectedPacks[activeProd.id] === res.packId
                    return (
                      <tr key={res.packId} className={picked ? 'row-warn' : ''}>
                        <td>
                          <b>{pack ? tr(pack.name) : res.packId}</b>
                          {pack && <div className="small muted">{tr(pack.material)}</div>}
                        </td>
                        <td className="num">
                          <b style={{ color: res.weightLossPct > 2.0 ? 'var(--rust)' : 'inherit' }}>
                            {res.weightLossPct.toFixed(1)} %
                          </b>
                        </td>
                        <td className="small">{tr(res.wallState)}</td>
                        <td className="small">{tr(res.organoleptic)}</td>
                        <td className="small">{tr(res.pumpState)}</td>
                        <td>
                          <button
                            type="button"
                            className={`btn small ${picked ? 'primary' : ''}`}
                            onClick={() => set((x) => { x.selectedPacks[activeProd.id] = res.packId })}
                          >
                            {picked ? tr('Выбрано ✓') : tr('Утвердить')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {data.questions.map((q, qi) => (
          <section key={q.id} className="panel">
            <h3><span className="ptag">{qi + 2}</span>{tr(q.prompt)}</h3>
            <div className="choices">
              {q.options.map((o) => (
                <label key={o.id} className={`choice ${s.quiz[q.id] === o.id ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name={`pk-${q.id}`}
                    checked={s.quiz[q.id] === o.id}
                    onChange={() => set((x) => { x.quiz[q.id] = o.id })}
                  />
                  <span>{tr(o.text)}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Утвердить спецификации упаковки →')}
        </button>
      </div>,
    )
  }

  const ev = evaluatePackCompat(data, s)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Протокол совместимости ISO/TR 18811')}</p>
        <h1>{tr('Результат подбора тары')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      {ev.productChecks.map((pc) => {
        const prod = data.products.find((p) => p.id === pc.productId)!
        const pack = data.packs.find((pk) => pk.id === pc.chosenPackId)
        return (
          <div key={pc.productId} className={`drow ${pc.ok ? 'ok' : 'wrong'}`}>
            <h4>
              <VerdictTag v={pc.ok ? 'ok' : 'wrong'} /> {tr(prod.name)} → {pack ? tr(pack.name) : '—'}
            </h4>
            <p>{pc.cell ? tr(pc.cell.why) : ''}</p>
          </div>
        )
      })}
      {ev.quizChecks.map((qc) => {
        const q = data.questions.find((x) => x.id === qc.qId)!
        return (
          <div key={qc.qId} className={`drow ${qc.ok ? 'ok' : 'wrong'}`}>
            <h4><VerdictTag v={qc.ok ? 'ok' : 'wrong'} /> {tr(q.prompt)}</h4>
            <p>{qc.opt ? tr(qc.opt.why) : ''}</p>
          </div>
        )
      })}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}

// ============================================================================
// 2. Интерактивный конструктор SPF 50+ / UVA-PF (engine: 'spf-lab')
// ============================================================================

interface SpfLabUiState {
  phase: 'brief' | 'work' | 'debrief'
  filters: SpfFilterState
  transfer: Record<number, any>
  finished?: boolean
}

const FILTER_META: {
  key: keyof SpfFilterState
  label: string
  sub: string
  max: number
  min?: number
  step: number
}[] = [
  { key: 'dhhb', label: 'DHHB (Uvinul A Plus · UVA1 354 нм)', sub: 'Твёрдый жирорастворимый фотостабильный UVA1-фильтр (лимит ≤ 10 %)', max: 12, step: 0.5 },
  { key: 'bemotrizinol', label: 'Bemotrizinol (Tinosorb S · UVB+UVA 310/344 нм)', sub: 'Широкополосный триазин и мощный фотостабилизатор авобензона (лимит ≤ 10 %)', max: 12, step: 0.5 },
  { key: 'ethylhexylTriazone', label: 'Ethylhexyl Triazone (Uvinul T 150 · UVB 314 нм)', sub: 'Рекордная экстинкция в UVB, требователен к полярным маслам (лимит ≤ 5 %)', max: 7, step: 0.5 },
  { key: 'avobenzone', label: 'Butyl Methoxydibenzoylmethane (Avobenzone · UVA1 358 нм)', sub: 'Классический UVA1-фильтр: распадается на солнце без Tinosorb S (лимит ≤ 5 %)', max: 7, step: 0.5 },
  { key: 'ensulizole', label: 'Phenylbenzimidazole Sulfonic Acid (Ensulizole · UVB 303 нм)', sub: 'Водорастворимый бустер фазы A (при pH ≥ 6,8–7,0, лимит ≤ 8 %)', max: 10, step: 0.5 },
  { key: 'polarEsterPct', label: 'Полярные эфиры фазы B (C12-15 Alkyl Benzoate + Dicaprylyl Carbonate)', sub: 'Растворяют кристаллические УФ-фильтры и удерживают их от выпадания при +4 °C', min: 4, max: 24, step: 1 },
]

export function SpfFormulatorSim({ lab }: { lab: LabMeta }) {
  const [s, set, reset] = useLabState<SpfLabUiState>(lab.id, () => ({
    phase: 'brief',
    filters: defaultSpfState(),
    transfer: {},
  }))

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('Оптическая скамья 290–400 нм'), tr('Протокол SPF / UVA')]}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={!!s.finished}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  const m = computeSpfLabMetrics(s.filters)
  const xAt = (nm: number) => 52 + ((nm - 290) / 110) * 476
  const yAt = (abs: number) => 176 - (Math.min(2.6, abs) / 2.6) * 144

  if (s.phase === 'work') {
    const submit = () => {
      const ev = evaluateSpfLab(s.filters)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `SPF ${m.inSilicoSpf} · UVA-PF ${m.uvaPf} · ${Math.round(ev.score * 100)} %`,
        { filters: s.filters, spf: m.inSilicoSpf, uvaPf: m.uvaPf },
        ev.score,
      )
    }

    const initPts = m.spectrum.map((p) => `${xAt(p.nm).toFixed(1)},${yAt(p.absInitial).toFixed(1)}`).join(' ')
    const postPts = m.spectrum.map((p) => `${xAt(p.nm).toFixed(1)},${yAt(p.absAfterUv).toFixed(1)}`).join(' ')

    return frame(
      <div className="gmp-work">
        <dl className="traffic-totals">
          <div className={`panel ${m.inSilicoSpf >= 50 ? '' : 'warn-card'}`}>
            <dt>{tr('Прогноз in-silico SPF')}</dt>
            <dd>{m.inSilicoSpf} <span className="small muted">{tr('(цель ≥ 50)')}</span></dd>
          </div>
          <div className="panel">
            <dt>{tr('UVA-PF и отношение к SPF')}</dt>
            <dd>{m.uvaPf} <span className="small muted">({m.uvaRatio} · λc {m.criticalWavelengthNm} {tr('нм')})</span></dd>
          </div>
          <div className="panel">
            <dt>{tr('Растворимость (+4 °C)')}</dt>
            <dd>{m.crystalFree ? tr('Норма') : tr('Кристаллы!')} <span className="small muted">({s.filters.polarEsterPct}/{m.minPolarRequiredPct} %)</span></dd>
          </div>
          <div className="panel">
            <dt>{tr('Сумма УФ-фильтров')}</dt>
            <dd>{m.totalFiltersPct} % <span className="small muted">(≤ 22 %)</span></dd>
          </div>
        </dl>

        <section className="panel">
          <h2>{tr('Спектр монохроматического поглощения A(λ) до и после УФ-дозы')}</h2>
          <p className="small">
            {tr('Сплошная линия — спектр после инсоляции (учитывается в SPF и UVA-PF); пунктир — исходная плёнка до облучения. Граница 320 нм разделяет UVB и UVA.')}
          </p>
          <div className="table-wrap">
            <svg viewBox="0 0 560 210" className="trend-svg" role="img" aria-label={tr('Спектр поглощения УФ-фильтров 290–400 нм')}>
              {/* Зона UVB и UVA */}
              <rect x={xAt(290)} y="28" width={xAt(320) - xAt(290)} height="148" fill="rgba(255,150,138,0.10)" />
              <rect x={xAt(320)} y="28" width={xAt(400) - xAt(320)} height="148" fill="rgba(56,189,248,0.08)" />
              <line x1={xAt(320)} y1="28" x2={xAt(320)} y2="176" stroke="currentColor" strokeDasharray="4 3" opacity="0.35" />
              <text x={xAt(305)} y="42" textAnchor="middle" fontSize="9.5" fill="currentColor" opacity="0.7">UVB</text>
              <text x={xAt(360)} y="42" textAnchor="middle" fontSize="9.5" fill="currentColor" opacity="0.7">UVA II + UVA I</text>
              <line x1={xAt(370)} y1="28" x2={xAt(370)} y2="176" stroke="#16A34A" strokeDasharray="3 3" opacity="0.55" />
              <text x={xAt(370) + 4} y="54" fontSize="8.5" fill="#16A34A">λc 370 {tr('нм')}</text>

              <line x1="52" y1="176" x2="528" y2="176" stroke="currentColor" opacity="0.28" />
              <line x1="52" y1="28" x2="52" y2="176" stroke="currentColor" opacity="0.28" />
              {[290, 310, 330, 350, 370, 390, 400].map((nm) => (
                <text key={nm} x={xAt(nm)} y="194" textAnchor="middle" fontSize="9.5" fill="currentColor">{nm}</text>
              ))}
              {[0, 0.5, 1.0, 1.5, 2.0, 2.5].map((a) => (
                <text key={a} x="44" y={yAt(a) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.75">{a.toFixed(1)}</text>
              ))}
              <polyline points={initPts} fill="none" stroke="#94A3B8" strokeDasharray="5 3" strokeWidth="1.8" />
              <polyline points={postPts} fill="none" stroke="#0EA5E9" strokeWidth="2.8" />
            </svg>
          </div>
        </section>

        <section className="panel">
          <h2>{tr('Настройка матрицы УФ-фильтров и полярного растворителя (% масс.)')}</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            {FILTER_META.map((fm) => {
              const val = s.filters[fm.key]
              return (
                <div key={fm.key} className="ctrl-row" style={{ display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                    <label htmlFor={`spf-${fm.key}`}><b>{tr(fm.label)}</b></label>
                    <span className="num"><b>{val.toFixed(1)} %</b></span>
                  </div>
                  <span className="small muted">{tr(fm.sub)}</span>
                  <input
                    id={`spf-${fm.key}`}
                    type="range"
                    min={fm.min ?? 0}
                    max={fm.max}
                    step={fm.step}
                    value={val}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      set((x) => { x.filters[fm.key] = v })
                    }}
                  />
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel">
          <h3>{tr('Чек-лист допуска рецептуры SPF 50+ (5 критериев)')}</h3>
          <ul className="linklist">
            <li>{m.inSilicoSpf >= 50 ? '✅' : '❌'} {tr('Расчётный SPF ≥ 50')} ({m.inSilicoSpf})</li>
            <li>{m.uvaRatio >= 0.33 && m.criticalWavelengthNm >= 370 ? '✅' : '❌'} {tr('Критерий UVA-кружка ЕС: UVA-PF ≥ 1/3 SPF и λc ≥ 370 нм')} ({m.uvaRatio}, {m.criticalWavelengthNm} {tr('нм')})</li>
            <li>{m.crystalFree ? '✅' : '❌'} {tr('Отсутствие холодной кристаллизации твёрдых фильтров при +4 °C')} ({tr('нужно ≥')} {m.minPolarRequiredPct} % {tr('полярных эфиров')})</li>
            <li>{m.photostable ? '✅' : '❌'} {tr('Фотостабильность UVA-диапазона под солнечной инсоляцией')}</li>
            <li>{m.regCompliant ? '✅' : '❌'} {tr('Соблюдение лимитов Прил. VI EU 1223/2009 / Прил. 5 ТР ТС 009/2011 и бюджета ≤ 22 %')}</li>
          </ul>
          {m.warnings.map((w, i) => (
            <p key={i} className="warnline" style={{ marginTop: 8 }}>{w}</p>
          ))}
        </section>

        <button type="button" className="btn primary" onClick={submit}>
          {tr('Отправить формулу SPF на валидацию ISO 24443/24444 →')}
        </button>
      </div>,
    )
  }

  const ev = evaluateSpfLab(s.filters)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Валидация солнцезащитной матрицы')}</p>
        <h1>SPF {m.inSilicoSpf} · UVA-PF {m.uvaPf} — {Math.round(ev.score * 100)} %</h1>
      </div>
      <div className={`drow ${ev.spfOk && ev.uvaOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.spfOk && ev.uvaOk ? 'ok' : 'wrong'} /> {tr('Широкополосная защита UVB + UVA')}</h4>
        <p>
          SPF = {m.inSilicoSpf}, UVA-PF = {m.uvaPf} ({tr('отношение')} {m.uvaRatio}, λc = {m.criticalWavelengthNm} {tr('нм')}).{' '}
          {ev.spfOk && ev.uvaOk
            ? tr('Профиль равномерно перекрывает UVB и длинноволновый UVA1 (340–400 нм), выполняя критерий европейского знака UVA в кружке.')
            : tr('Для честного SPF 50+ с кружком UVA необходимо сочетать мощный UVB-триазон с длинноволновыми UVA-фильтрами (DHHB + Tinosorb S).')}
        </p>
      </div>
      <div className={`drow ${m.crystalFree && m.photostable && m.regCompliant ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={m.crystalFree && m.photostable && m.regCompliant ? 'ok' : 'wrong'} /> {tr('Стабильность кристаллов, фотохимия и регуляторика')}</h4>
        <p>
          {m.warnings.length === 0
            ? tr('Все кристаллические фильтры надёжно удерживаются в полярных эфирах при +4 °C, фотодеградация исключена, лимиты ТР ТС и ЕС соблюдены.')
            : m.warnings.join(' ')}
        </p>
      </div>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}

// ============================================================================
// 3. Охота за биоплёнкой в петле воды очищенной WPU (engine: 'wpu-audit')
// ============================================================================

interface WpuUiState {
  phase: 'brief' | 'work' | 'debrief'
  inspectId?: string
  pointId?: string
  condReasonId?: string
  capaIds: string[]
  transfer: Record<number, any>
  finished?: boolean
}

export function WpuBiofilmSim({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as WpuAuditLabData
  const [s, set, reset] = useLabState<WpuUiState>(lab.id, () => ({
    phase: 'brief',
    inspectId: data.points[0]?.id,
    capaIds: [],
    transfer: {},
  }))
  const [warn, setWarn] = useState('')

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Инцидент GMP'), tr('Инспекция кольца WPU'), tr('План CAPA')]}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={!!s.pointId || s.capaIds.length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const activePt = data.points.find((p) => p.id === s.inspectId) ?? data.points[0]
    const toggleCapa = (id: string) => {
      set((x) => {
        const idx = x.capaIds.indexOf(id)
        if (idx >= 0) x.capaIds.splice(idx, 1)
        else x.capaIds.push(id)
      })
    }

    const submit = () => {
      if (!s.pointId || !s.condReasonId || s.capaIds.length === 0) {
        setWarn(tr('Укажите очаг биоплёнки, объяснение показаний кондуктометра и выберите меры CAPA.'))
        return
      }
      const ev = evaluateWpuAudit(data, s)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `WPU Audit · ${Math.round(ev.score * 100)} %`,
        { pointId: s.pointId, condReasonId: s.condReasonId, capaIds: s.capaIds },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <section className="panel">
          <p className="eyebrow">{tr('Мнемосхема циркуляционной петли воды очищенной (WPU)')}</p>
          <p className="small">{tr(data.incidentSummary)}</p>

          {/* Интерактивная SVG-схема кольца с точками T1–T4 */}
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <svg viewBox="0 0 580 185" className="trend-svg" role="img" aria-label={tr('Схема циркуляционной петли WPU с точками T1–T4')}>
              <rect x="18" y="54" width="84" height="52" rx="10" fill="rgba(14,165,233,0.14)" stroke="#0EA5E9" strokeWidth="1.6" />
              <text x="60" y="77" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor">RO + EDI</text>
              <text x="60" y="93" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.75">0.6 μS/cm</text>

              <rect x="150" y="42" width="76" height="76" rx="12" fill="rgba(14,165,233,0.12)" stroke="#0EA5E9" strokeWidth="1.6" />
              <text x="188" y="76" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor">{tr('Ёмкость')}</text>
              <text x="188" y="92" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.75">+ UV 254 {tr('нм')}</text>

              {/* Подающая и возвратная магистраль */}
              <path d="M102 80 L150 80 M226 62 L510 62 L510 142 L188 142 L188 118" fill="none" stroke="#0EA5E9" strokeWidth="3" />
              {/* Тупиковый отвод на T4 */}
              <path d="M390 62 L390 112 L456 112" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="5 2" />
              <text x="458" y="106" fontSize="9" fill="#EF4444">Dead leg 0,9 {tr('м')} (L/D=36)</text>

              {[
                { id: 'pt-t1', code: 'T1', x: 126, y: 80 },
                { id: 'pt-t2', code: 'T2', x: 275, y: 62 },
                { id: 'pt-t4', code: 'T4', x: 390, y: 112 },
                { id: 'pt-t3', code: 'T3', x: 295, y: 142 },
              ].map((nd) => {
                const active = activePt.id === nd.id
                return (
                  <g
                    key={nd.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => set((x) => { x.inspectId = nd.id })}
                  >
                    <circle cx={nd.x} cy={nd.y} r={active ? 16 : 13} fill={nd.code === 'T4' ? '#F97316' : '#0EA5E9'} opacity={active ? 1 : 0.85} />
                    <text x={nd.x} y={nd.y + 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#FFFFFF">{nd.code}</text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="chips" style={{ marginTop: 10, marginBottom: 12 }}>
            {data.points.map((pt) => (
              <button
                key={pt.id}
                type="button"
                className={`chip ${activePt.id === pt.id ? 'on' : ''}`}
                onClick={() => set((x) => { x.inspectId = pt.id })}
              >
                {pt.code}: {tr(pt.name)}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr('Точка')}</th>
                  <th>{tr('Скорость потока')}</th>
                  <th>L/D {tr('(норма ≤ 3)')}</th>
                  <th>{tr('T санитации')}</th>
                  <th>{tr('Проводимость')}</th>
                  <th>TOC</th>
                  <th>{tr('Посев R2A (5 сут.)')}</th>
                </tr>
              </thead>
              <tbody>
                {data.points.map((pt) => (
                  <tr
                    key={pt.id}
                    className={activePt.id === pt.id ? 'row-warn' : ''}
                    onClick={() => set((x) => { x.inspectId = pt.id })}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><b>{pt.code}</b> · {tr(pt.name)}</td>
                    <td className="num">{pt.velocityMs} {tr('м/с')}</td>
                    <td className="num"><b>{pt.deadLegRatioLd} D</b></td>
                    <td className="num">{pt.sanitizationTempC} °C</td>
                    <td className="num">{pt.conductivityUsCm} {tr('мкСм/см')}</td>
                    <td className="num">{pt.tocPpb} ppb</td>
                    <td><b>{tr(pt.cfuPerMl)}</b><div className="small muted">{tr(pt.gramStain)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">1</span>{tr('Укажите точку кольца, где сформировалась зрелая биоплёнка — первичный очаг заражения серий')}</h3>
          <div className="choices">
            {data.points.map((pt) => (
              <label key={pt.id} className={`choice ${s.pointId === pt.id ? 'on' : ''}`}>
                <input type="radio" name="wpu-pt" checked={s.pointId === pt.id} onChange={() => set((x) => { x.pointId = pt.id })} />
                <span><b>{pt.code}</b> — {tr(pt.name)} ({tr(pt.locationDesc)})</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">2</span>{tr('Почему поточный кондуктометр показывал идеальные 0,8 мкСм/см при массивном росте B. cepacia?')}</h3>
          <div className="choices">
            {data.conductivityQuestions.map((cq) => (
              <label key={cq.id} className={`choice ${s.condReasonId === cq.id ? 'on' : ''}`}>
                <input type="radio" name="wpu-cond" checked={s.condReasonId === cq.id} onChange={() => set((x) => { x.condReasonId = cq.id })} />
                <span>{tr(cq.text)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">3</span>{tr('Отметьте ВСЕ корректные инженерные и микробиологические меры CAPA (без ложных действий)')}</h3>
          <div className="choices">
            {data.capaOptions.map((c) => {
              const checked = s.capaIds.includes(c.id)
              return (
                <label key={c.id} className={`choice ${checked ? 'on' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCapa(c.id)} />
                  <span>{tr(c.text)}</span>
                </label>
              )
            })}
          </div>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Утвердить акт расследования GMP и CAPA →')}
        </button>
      </div>,
    )
  }

  const ev = evaluateWpuAudit(data, s)
  const hot = data.points.find((p) => p.id === data.hotspotPointId)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Акт расследования петли WPU')}</p>
        <h1>{tr('Оценка аудита и CAPA')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      <div className={`drow ${ev.pointOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.pointOk ? 'ok' : 'wrong'} /> {tr('Первичный очаг биоплёнки:')} {hot?.code} ({hot ? tr(hot.name) : ''})</h4>
        <p>{tr('Тупиковый тройник L/D = 36 с нулевой циркуляцией (0,05 м/с) и шаровым краном прогревался при санитации лишь до 58 °C — идеальный инкубатор для Burkholderia cepacia, откуда сгустки срывались и давали единичные КОЕ в обратке T3.')}</p>
      </div>
      <div className={`drow ${ev.condOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.condOk ? 'ok' : 'wrong'} /> {tr('Парадокс электропроводности 0,8 мкСм/см')}</h4>
        <p>{ev.condOpt ? tr(ev.condOpt.why) : ''}</p>
      </div>
      <div className={`drow ${ev.capaOk ? 'ok' : 'wrong'}`}>
        <h4><VerdictTag v={ev.capaOk ? 'ok' : 'wrong'} /> {tr('Пакет корректирующих и предупреждающих мер (CAPA)')}</h4>
        <ul className="linklist">
          {data.capaOptions.map((c) => (
            <li key={c.id}>
              <b>{c.valid ? '✓' : '✕'}</b> {tr(c.text)} — <span className="small muted">{tr(c.why)}</span>
            </li>
          ))}
        </ul>
      </div>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}

// ============================================================================
// 4. Триаж рекламаций рынка и стабильности (engine: 'triage')
// ============================================================================

interface TriageUiState {
  phase: 'brief' | 'work' | 'debrief'
  activeCaseId?: string
  ans: Record<string, { mechId?: string; fixId?: string }>
  transfer: Record<number, any>
  finished?: boolean
}

export function StabilityTriageSim({ lab }: { lab: LabMeta }) {
  const data = lab as unknown as StabilityTriageLabData
  const [s, set, reset] = useLabState<TriageUiState>(lab.id, () => ({
    phase: 'brief',
    activeCaseId: data.cases[0]?.id,
    ans: {},
    transfer: {},
  }))
  const [warn, setWarn] = useState('')

  const frame = (ch: React.ReactNode) => (
    <LabFrame
      lab={lab}
      steps={[tr('Вводная'), tr('4 досье рекламаций'), tr('Разбор решений')]}
      step={{ brief: 0, work: 1, debrief: 2 }[s.phase]}
      debrief={s.phase === 'debrief'}
      onRestart={reset}
    >
      {ch}
    </LabFrame>
  )

  if (s.phase === 'brief') {
    return frame(
      <Brief
        lab={lab}
        resumed={Object.keys(s.ans).length > 0}
        onStart={() => set((x) => { x.phase = 'work' })}
      />,
    )
  }

  if (s.phase === 'work') {
    const activeCase = data.cases.find((c) => c.id === s.activeCaseId) ?? data.cases[0]
    const curAns = s.ans[activeCase.id] ?? {}

    const submit = () => {
      const incomplete = data.cases.filter((c) => !s.ans[c.id]?.mechId || !s.ans[c.id]?.fixId)
      if (incomplete.length > 0) {
        setWarn(tr('Заполните механизм и инженерное решение для всех 4 рекламационных досье (переключайте вкладки кейсов сверху).'))
        return
      }
      const ev = evaluateStabilityTriage(data, s.ans)
      set((x) => { x.phase = 'debrief'; x.finished = true })
      window.scrollTo(0, 0)
      markFinished(
        lab.id,
        `Triage · ${Math.round(ev.score * 100)} %`,
        { ans: s.ans },
        ev.score,
      )
    }

    return frame(
      <div className="gmp-work">
        <div className="chips">
          {data.cases.map((c, idx) => {
            const done = !!s.ans[c.id]?.mechId && !!s.ans[c.id]?.fixId
            return (
              <button
                key={c.id}
                type="button"
                className={`chip ${activeCase.id === c.id ? 'on' : ''}`}
                onClick={() => set((x) => { x.activeCaseId = c.id })}
              >
                {tr('Досье')} #{idx + 1} {done ? '✓' : '○'}
              </button>
            )
          })}
        </div>

        <section className="panel">
          <p className="eyebrow">{tr('Претензионное досье')}</p>
          <h2>{tr(activeCase.product)}</h2>
          <p><b>{tr('Претензия с рынка:')}</b> {tr(activeCase.complaint)}</p>
          <p className="small"><b>{tr('Данные аналитической лаборатории:')}</b> {tr(activeCase.labFindings)}</p>
        </section>

        <section className="panel">
          <h3><span className="ptag">A</span>{tr('Физико-химический механизм деградации')}</h3>
          <div className="choices">
            {activeCase.mechanisms.map((m) => (
              <label key={m.id} className={`choice ${curAns.mechId === m.id ? 'on' : ''}`}>
                <input
                  type="radio"
                  name={`tr-m-${activeCase.id}`}
                  checked={curAns.mechId === m.id}
                  onChange={() => set((x) => {
                    x.ans[activeCase.id] = { ...(x.ans[activeCase.id] ?? {}), mechId: m.id }
                  })}
                />
                <span>{tr(m.text)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3><span className="ptag">B</span>{tr('Корректная переработка рецептуры и процесса')}</h3>
          <div className="choices">
            {activeCase.fixes.map((f) => (
              <label key={f.id} className={`choice ${curAns.fixId === f.id ? 'on' : ''}`}>
                <input
                  type="radio"
                  name={`tr-f-${activeCase.id}`}
                  checked={curAns.fixId === f.id}
                  onChange={() => set((x) => {
                    x.ans[activeCase.id] = { ...(x.ans[activeCase.id] ?? {}), fixId: f.id }
                  })}
                />
                <span>{tr(f.text)}</span>
              </label>
            ))}
          </div>
        </section>

        {warn && <p className="warnline" role="alert">{warn}</p>}
        <button type="button" className="btn primary" onClick={submit}>
          {tr('Закрыть все 4 рекламации и выпустить протокол R&D →')}
        </button>
      </div>,
    )
  }

  const ev = evaluateStabilityTriage(data, s.ans)
  return frame(
    <div className="debrief">
      <div className="debrief-head">
        <p className="eyebrow">{tr('Итог триажа рекламаций')}</p>
        <h1>{tr('Точность диагностики и решений')} — {Math.round(ev.score * 100)} %</h1>
      </div>
      {ev.rows.map((r) => {
        const c = data.cases.find((x) => x.id === r.caseId)!
        const bothOk = r.mechOk && r.fixOk
        return (
          <div key={r.caseId} className={`drow ${bothOk ? 'ok' : 'wrong'}`}>
            <h4><VerdictTag v={bothOk ? 'ok' : 'wrong'} /> {tr(c.product)}</h4>
            <p><b>{tr('Механизм:')}</b> {r.mech ? tr(r.mech.why) : ''}</p>
            <p><b>{tr('Решение:')}</b> {r.fix ? tr(r.fix.why) : ''}</p>
          </div>
        )
      })}
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
    </div>,
  )
}
