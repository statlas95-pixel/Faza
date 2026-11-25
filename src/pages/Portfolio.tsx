import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { tr } from '../../shared/locale'
import {
  buildCompetencyProfile,
  computeCareerGrade,
  createProgressBackup,
  importProgressBackup,
  type CompetencyDomainSummary,
} from '../../shared/competencies'
import { labById, labs } from '../content'
import { skills, useLearning } from '../learning'
import { syncNow, useAccount } from '../account'
import { getProgress, replaceState, useProgress } from '../store'
import { useTitle } from './util'

/** Шестиугольная диаграмма профиля компетенций (чистый SVG без внешних зависимостей). */
function CompetencyRadar({ domains }: { domains: CompetencyDomainSummary[] }) {
  const cx = 150, cy = 140, R = 95
  const n = domains.length
  const point = (index: number, ratio: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n
    return [cx + Math.cos(angle) * R * ratio, cy + Math.sin(angle) * R * ratio] as const
  }
  const polygon = (ratio: number) =>
    domains.map((_, i) => point(i, ratio).map((v) => v.toFixed(1)).join(',')).join(' ')
  const valuePoly = domains
    .map((d, i) => point(i, Math.max(0.08, d.percent / 100)).map((v) => v.toFixed(1)).join(','))
    .join(' ')

  return (
    <svg viewBox="0 0 300 280" className="comp-radar" role="img" aria-label={tr('Профиль компетенций по 6 направлениям')}>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={polygon(r)} fill="none" stroke="currentColor" opacity="0.2" strokeWidth="1" />
      ))}
      {domains.map((d, i) => {
        const [x2, y2] = point(i, 1)
        const [lx, ly] = point(i, 1.24)
        return (
          <g key={d.def.id}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" opacity="0.18" strokeWidth="1" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="comp-radar-lbl">
              {tr(d.def.shortTitle)}
            </text>
          </g>
        )
      })}
      <polygon points={valuePoly} fill="rgba(14,124,123,0.28)" stroke="var(--teal)" strokeWidth="2.2" />
      {domains.map((d, i) => {
        const [vx, vy] = point(i, Math.max(0.08, d.percent / 100))
        return <circle key={d.def.id} cx={vx} cy={vy} r="4" fill="var(--teal)" />
      })}
    </svg>
  )
}

export default function PortfolioPage() {
  useTitle(tr('Карта компетенций и портфолио'))
  const learning = useLearning()
  const progress = useProgress()
  const acc = useAccount()
  const formulas = progress.savedFormulas
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const profile = useMemo(() => buildCompetencyProfile(learning.states), [learning.states])
  const totalMastered = profile.reduce((s, d) => s + d.mastered, 0)
  const totalSkills = profile.reduce((s, d) => s + d.total, 0)
  const completedLabs = Object.entries(progress.labDone).sort((a, b) => b[1].at - a[1].at)
  const grade = useMemo(() => computeCareerGrade(profile, completedLabs.length), [profile, completedLabs.length])

  function handleExport() {
    const backup = createProgressBackup(getProgress(), formulas)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `faza-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setStatusMsg({ kind: 'ok', text: tr('Резервная копия прогресса и рецептур сохранена в JSON.') })
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((raw) => {
      const res = importProgressBackup(raw, getProgress(), formulas)
      if (!res.ok) {
        setStatusMsg({ kind: 'err', text: tr(res.error) })
      } else {
        replaceState(res.progress)
        if (acc.status === 'user') void syncNow()
        setStatusMsg({ kind: 'ok', text: tr('Резервная копия успешно объединена с текущим прогрессом без потерь.') })
      }
      if (fileRef.current) fileRef.current.value = ''
    }).catch(() => {
      setStatusMsg({ kind: 'err', text: tr('Не удалось прочитать выбранный файл.') })
    })
  }

  return (
    <div className="page portfolio">
      <div className="sandbox-head-row">
        <div>
          <p className="eyebrow">{tr('Профиль специалиста · 6 направлений')}</p>
          <h1>{tr('Карта компетенций и портфолио кейсов')}</h1>
        </div>
        <button type="button" className="btn no-print" onClick={() => window.print()}>
          🖨 {tr('PDF-портфолио (печать)')}
        </button>
      </div>
      <p className="lead">
        {tr('Агрегированный прогресс по шести ключевым доменам косметической технологии, грейд технолога, история решённых кейсов и синхронизированные рецептуры.')}
      </p>

      {/* Профессиональный грейд технолога */}
      <section className="panel grade-card" aria-label={tr('Профессиональный грейд')}>
        <div className="grade-head">
          <div>
            <span className="grade-badge">{tr(grade.badge)}</span>
            <h2>{tr(grade.title)}</h2>
            <p className="small">{tr(grade.description)}</p>
          </div>
          <div className="grade-pct num">
            <b>{grade.progressPct} %</b>
            <span className="small muted">{grade.nextTitle ? `${tr('до:')} ${tr(grade.nextTitle)}` : tr('Максимальный уровень')}</span>
          </div>
        </div>
        <div className="bar"><span style={{ width: `${Math.max(4, grade.progressPct)}%` }} /></div>
        {grade.nextRequirement && <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{tr(grade.nextRequirement)}</p>}
      </section>

      <dl className="traffic-totals">
        <div className="panel"><dt>{tr('Освоено навыков (≥ 3 ур.)')}</dt><dd>{totalMastered} / {totalSkills}</dd></div>
        <div className="panel"><dt>{tr('Пройдено занятий')}</dt><dd>{completedLabs.length} / {labs.length}</dd></div>
        <div className="panel"><dt>{tr('Записано попыток')}</dt><dd>{progress.attempts.length}</dd></div>
        <div className="panel"><dt>{tr('Рецептур в портфолио')}</dt><dd>{formulas.length}</dd></div>
      </dl>

      <section className="panel comp-overview">
        <h2>{tr('Профиль по 6 направлениям')}</h2>
        <div className="comp-grid">
          <div className="comp-radar-wrap">
            <CompetencyRadar domains={profile} />
          </div>
          <div className="comp-cards">
            {profile.map((d) => {
              const nextSkill = d.nextSkillId ? skills.find((sk) => sk.id === d.nextSkillId) : undefined
              const nextLabId = nextSkill?.labs[0]
              return (
                <article key={d.def.id} className="comp-card">
                  <div className="comp-card-head">
                    <h3>{tr(d.def.title)}</h3>
                    <span className="num"><b>{d.percent} %</b></span>
                  </div>
                  <div className="dprog" aria-hidden>
                    <span style={{ width: `${d.percent}%` }} />
                  </div>
                  <p className="small">{tr(d.def.description)}</p>
                  <p className="small num">
                    {tr('Освоено: ')}{d.mastered}/{d.total} · {tr('начато: ')}{d.started}/{d.total} · {tr('ср. уровень: ')}{d.avgLevel}/4
                  </p>
                  {nextLabId && (
                    <p className="small">
                      <Link to={`/labs/${nextLabId}`}>{tr('Рекомендуемый практикум →')}</Link>
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{tr('Портфолио решённых кейсов')}</h2>
        {progress.attempts.length === 0 ? (
          <p className="muted">
            {tr('Пока нет завершённых кейсов. ')}
            <Link to="/labs">{tr('Открыть список занятий')}</Link>
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr('Дата')}</th>
                  <th>{tr('Занятие / кейс')}</th>
                  <th>{tr('Результат')}</th>
                  <th>{tr('Разбор')}</th>
                </tr>
              </thead>
              <tbody>
                {progress.attempts.slice(0, 25).map((att) => {
                  const lab = labById(att.labId)
                  const score = att.detail?.score !== undefined ? `${Math.round(att.detail.score * 100)} %` : '—'
                  return (
                    <tr key={att.id}>
                      <td className="num">{new Date(att.at).toLocaleDateString()}</td>
                      <td>
                        <Link to={`/labs/${att.labId}`}>{lab?.title ?? att.labId}</Link>
                        {att.summary && <div className="small">{att.summary}</div>}
                      </td>
                      <td className="num">{score}</td>
                      <td><Link to={`/attempts/${att.id}`}>{tr('Открыть')}</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="sandbox-head-row">
          <h2>{tr('Сохранённые рецептуры из Лаборатории')}</h2>
          <Link className="btn" to="/sandbox">{tr('Открыть Лабораторию')}</Link>
        </div>
        {formulas.length === 0 ? (
          <p className="muted">{tr('Сохранённых рецептур пока нет — соберите и сохраните первую рецептуру в Лаборатории.')}</p>
        ) : (
          <ul className="sandbox-saved-list">
            {formulas.map((f) => (
              <li key={f.id}>
                <span>
                  <b>{f.name}</b> · {f.formula.productType} · pH {f.formula.targetPh} · {f.formula.batchGrams} {tr('г')} ({f.formula.rows.length} {tr('комп.')})
                </span>
                <span className="row">
                  <span className="small num">{new Date(f.at).toLocaleDateString()}</span>
                  <Link className="btn small" to={`/sandbox?load=${encodeURIComponent(f.id)}`}>{tr('Открыть')}</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>{tr('Резервная копия прогресса (экспорт / импорт JSON)')}</h2>
        <p className="small">
          {tr('Даже без аккаунта вы можете выгрузить весь учебный прогресс, пройденные кейсы и сохранённые рецептуры в JSON-файл и перенести на другое устройство. Импорт объединяет данные без потери уже пройденного.')}
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={handleExport}>
            {tr('Скачать резервную копию (JSON)')}
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            {tr('Импортировать JSON')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        {statusMsg && (
          <p className={statusMsg.kind === 'ok' ? 'okline' : 'warnline'} role="status">
            {statusMsg.text}
          </p>
        )}
      </section>
    </div>
  )
}
