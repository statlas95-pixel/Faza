import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { tr } from '../../shared/locale'
import {
  COMPETENCY_DOMAINS,
  buildCompetencyProfile,
  computeCareerGrade,
  createProgressBackup,
  importProgressBackup,
  type CompetencyDomainSummary,
} from '../../shared/competencies'
import {
  decodePortfolioSnapshot,
  encodePortfolioSnapshot,
  type PortfolioShareSnapshot,
} from '../../shared/portfolio-share'
import { labById, labs } from '../content'
import { skills, useLearning } from '../learning'
import { syncNow, useAccount } from '../account'
import { GradeExamModal } from '../components/GradeExamModal'
import { ActivityHeatmap } from '../components/ActivityHeatmap'
import { ScientistGallery } from '../components/ScientistGallery'
import { useScientistCards } from '../components/ScientistWatcher'
import { showToast } from '../components/Toast'
import { getProgress, replaceState, useProgress } from '../store'
import { useTitle } from './util'

/** Шестиугольная диаграмма профиля компетенций (чистый SVG без внешних зависимостей). */
function CompetencyRadar({ domains }: { domains: { id: string; shortTitle: string; percent: number }[] }) {
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
          <g key={d.id}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="currentColor" opacity="0.18" strokeWidth="1" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="comp-radar-lbl">
              {tr(d.shortTitle)}
            </text>
          </g>
        )
      })}
      <polygon points={valuePoly} fill="rgba(14,124,123,0.28)" stroke="var(--teal)" strokeWidth="2.2" />
      {domains.map((d, i) => {
        const [vx, vy] = point(i, Math.max(0.08, d.percent / 100))
        return <circle key={d.id} cx={vx} cy={vy} r="4" fill="var(--teal)" />
      })}
    </svg>
  )
}

function SharedPortfolioView({
  snap,
  onExit,
}: {
  snap: PortfolioShareSnapshot
  onExit: () => void
}) {
  const radarDomains = COMPETENCY_DOMAINS.map((def, idx) => ({
    id: def.id,
    shortTitle: def.shortTitle,
    title: def.title,
    description: def.description,
    percent: snap.dom[idx] ?? 0,
  }))

  return (
    <div className="page portfolio shared-portfolio">
      <div className="sandbox-head-row">
        <div>
          <span className="grade-badge">{tr('Подтверждённый профиль · Фаза')}</span>
          <h1 style={{ marginTop: 8 }}>{snap.n}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {tr(snap.gt)} · {tr('Срез портфолио от')} <span className="num">{snap.d}</span>
          </p>
        </div>
        <div className="row no-print">
          <button type="button" className="btn ghost" onClick={onExit}>
            ← {tr('К моему портфолио')}
          </button>
          <button type="button" className="btn primary" onClick={() => window.print()}>
            🖨 {tr('PDF-портфолио (печать)')}
          </button>
        </div>
      </div>

      <section className="panel grade-card" style={{ marginTop: 18 }}>
        <div className="grade-head">
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="grade-badge">{tr(snap.gb)}</span>
              {snap.c.map((cert) => (
                <span key={cert.l} className="chip on num">
                  ✓ {tr('Аттестован')} L{cert.l} ({cert.s} % · {cert.a})
                </span>
              ))}
            </div>
            <h2>{tr(snap.gt)}</h2>
          </div>
          <div className="grade-pct num">
            <b>{snap.gp} %</b>
            <span className="small muted">{tr('готовность грейда')}</span>
          </div>
        </div>
        <div className="bar"><span style={{ width: `${Math.max(4, snap.gp)}%` }} /></div>
      </section>

      <dl className="traffic-totals">
        <div className="panel"><dt>{tr('Освоено навыков (≥ 3 ур.)')}</dt><dd>{snap.m} / {snap.t}</dd></div>
        <div className="panel"><dt>{tr('Пройдено занятий')}</dt><dd>{snap.lb} / {snap.lt}</dd></div>
        <div className="panel"><dt>{tr('Завершено кампаний запуска')}</dt><dd>{snap.cp}</dd></div>
        <div className="panel"><dt>{tr('Рецептур в портфолио')}</dt><dd>{snap.fm}</dd></div>
      </dl>

      <section className="panel comp-overview">
        <h2>{tr('Профиль по 6 направлениям')}</h2>
        <div className="comp-grid">
          <div className="comp-radar-wrap">
            <CompetencyRadar domains={radarDomains} />
          </div>
          <div className="comp-cards">
            {radarDomains.map((d) => (
              <article key={d.id} className="comp-card">
                <div className="comp-card-head">
                  <h3>{tr(d.title)}</h3>
                  <span className="num"><b>{d.percent} %</b></span>
                </div>
                <div className="dprog" aria-hidden>
                  <span style={{ width: `${d.percent}%` }} />
                </div>
                <p className="small">{tr(d.description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <p className="small muted">
        {tr('Этот публичный профиль сформирован из локальных/серверных результатов образовательной платформы «Фаза» (косметическая химия и процессы производства).')}
      </p>
    </div>
  )
}

export default function PortfolioPage() {
  useTitle(tr('Карта компетенций и портфолио'))
  const [sp, setSp] = useSearchParams()
  const sharedToken = sp.get('card')
  const sharedSnap = useMemo(() => decodePortfolioSnapshot(sharedToken), [sharedToken])

  const learning = useLearning()
  const progress = useProgress()
  const acc = useAccount()
  const scientistCards = useScientistCards()
  const formulas = progress.savedFormulas
  const [tab, setTab] = useState<'resume' | 'gallery'>(() => (sp.get('tab') === 'gallery' ? 'gallery' : 'resume'))
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [examOpen, setExamOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const profile: CompetencyDomainSummary[] = useMemo(
    () => buildCompetencyProfile(learning.states),
    [learning.states],
  )
  const totalMastered = profile.reduce((s, d) => s + d.mastered, 0)
  const totalSkills = profile.reduce((s, d) => s + d.total, 0)
  const completedLabs = Object.entries(progress.labDone).sort((a, b) => b[1].at - a[1].at)
  const completedCampaigns = Object.values(progress.campaigns ?? {}).filter((c) => Boolean(c.completedAt)).length
  const grade = useMemo(() => computeCareerGrade(profile, completedLabs.length), [profile, completedLabs.length])
  const certified = progress.certifiedGrades[String(grade.level)]
  const unlockedCards = scientistCards.filter((c) => c.tier !== 'locked').length
  const legendaryCards = scientistCards.filter((c) => c.tier === 'legendary').length

  if (sharedSnap) {
    return (
      <SharedPortfolioView
        snap={sharedSnap}
        onExit={() => {
          sp.delete('card')
          setSp(sp)
        }}
      />
    )
  }

  function handleSharePortfolio() {
    const snap: PortfolioShareSnapshot = {
      v: 1,
      n: acc.status === 'user' && acc.user?.name ? acc.user.name : tr('Технолог платформы «Фаза»'),
      d: new Date().toISOString().slice(0, 10),
      g: grade.level,
      gt: grade.title,
      gb: grade.badge,
      gp: grade.progressPct,
      c: Object.values(progress.certifiedGrades).map((cert) => ({
        l: cert.level,
        s: Math.round(cert.score * 100),
        a: new Date(cert.at).toISOString().slice(0, 10),
      })),
      dom: profile.map((d) => d.percent),
      m: totalMastered,
      t: totalSkills,
      lb: completedLabs.length,
      lt: labs.length,
      fm: formulas.length,
      cp: completedCampaigns,
      sc: unlockedCards,
      sl: legendaryCards,
    }
    const token = encodePortfolioSnapshot(snap)
    const base = `${window.location.origin}${window.location.pathname}`
    const url = `${base}#/portfolio?card=${token}`
    setShareUrl(url)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showToast(tr('Ссылка на публичное портфолио скопирована')),
        () => showToast(tr('Ссылка на публичное портфолио сформирована')),
      )
    } else {
      showToast(tr('Ссылка на публичное портфолио сформирована'))
    }
  }

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

  const radarData = profile.map((d) => ({ id: d.def.id, shortTitle: d.def.shortTitle, percent: d.percent }))

  return (
    <div className="page portfolio">
      {/* Строгая деловая шапка только для печати PDF */}
      <div className="print-only print-resume-head">
        <b>{acc.status === 'user' && acc.user?.name ? acc.user.name : tr('Технолог платформы «Фаза»')}</b>
        <span>{tr('Платформа «Фаза» · Портфолио компетенций')} · {new Date().toISOString().slice(0, 10)}</span>
      </div>

      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Карта компетенций и портфолио кейсов')}</h1>
        </div>
        <div className="row no-print">
          <button type="button" className="btn ghost" onClick={handleSharePortfolio}>
            🔗 {tr('Поделиться ссылкой для HR')}
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            🖨 {tr('PDF-портфолио (печать)')}
          </button>
        </div>
      </div>
      <p className="lead">
        {tr('Агрегированный прогресс по шести ключевым доменам косметической технологии, грейд технолога, история решённых кейсов и синхронизированные рецептуры.')}
      </p>

      {shareUrl && (
        <section className="panel share-banner no-print" role="status">
          <div className="sandbox-head-row">
            <div>
              <b>{tr('Публичная ссылка на ваше портфолио готова')}</b>
              <p className="small muted" style={{ margin: '2px 0 0' }}>
                {tr('Ссылка содержит снимок вашего грейда, аттестаций и 6 доменов компетенций (без приватных заметок). Её можно отправить HR или приложить к резюме.')}
              </p>
            </div>
            <div className="row">
              <a className="btn small primary" href={shareUrl} target="_blank" rel="noreferrer">
                {tr('Открыть превью')}
              </a>
              <button type="button" className="btn small ghost" onClick={() => setShareUrl(null)}>
                {tr('Скрыть')}
              </button>
            </div>
          </div>
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label={tr('Ссылка на публичное портфолио')}
            onFocus={(e) => e.currentTarget.select()}
            className="share-url-input num"
          />
        </section>
      )}

      {/* Вкладки Портфолио 2.0 (скрыты при печати PDF) */}
      <div className="portfolio-tabs no-print" role="tablist" aria-label={tr('Разделы портфолио')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'resume'}
          className={`chip ${tab === 'resume' ? 'on' : ''}`}
          onClick={() => setTab('resume')}
        >
          {tr('Профиль и PDF-резюме')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'gallery'}
          className={`chip ${tab === 'gallery' ? 'on' : ''}`}
          onClick={() => setTab('gallery')}
        >
          ✦ {tr('Галерея учёных')} ({unlockedCards} / {scientistCards.length})
        </button>
      </div>

      {tab === 'gallery' ? (
        <ScientistGallery />
      ) : (
        <>
          {/* Профессиональный грейд технолога */}
          <section className="panel grade-card" aria-label={tr('Профессиональный грейд')}>
            <div className="grade-head">
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="grade-badge">{tr(grade.badge)}</span>
                  {certified && (
                    <span className="chip on num" title={tr('Подтверждено независимым экзаменом без подсказок')}>
                      ✓ {tr('Аттестован')} ({Math.round(certified.score * 100)} % · {new Date(certified.at).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <h2>{tr(grade.title)}</h2>
                <p className="small">{tr(grade.description)}</p>
              </div>
              <div className="grade-pct num">
                <b>{grade.progressPct} %</b>
                <span className="small muted">{grade.nextTitle ? `${tr('до:')} ${tr(grade.nextTitle)}` : tr('Максимальный уровень')}</span>
              </div>
            </div>
            <div className="bar"><span style={{ width: `${Math.max(4, grade.progressPct)}%` }} /></div>
            <div className="sandbox-head-row" style={{ marginTop: 10 }}>
              {grade.nextRequirement ? (
                <p className="small muted" style={{ margin: 0 }}>{tr(grade.nextRequirement)}</p>
              ) : <span />}
              <button type="button" className="btn small no-print" onClick={() => setExamOpen(true)}>
                🎓 {certified ? tr('Пересдать аттестацию на грейд') : tr('Пройти аттестацию на грейд')}
              </button>
            </div>
          </section>
          {examOpen && (
            <GradeExamModal
              level={grade.level}
              gradeTitle={grade.title}
              gradeBadge={grade.badge}
              onClose={() => setExamOpen(false)}
              onCertified={() => { if (acc.status === 'user') void syncNow() }}
            />
          )}

          {/* Компактная плашка-приглашение в Галерею учёных (не печатается в PDF) */}
          <section className="panel sc-teaser no-print">
            <div className="sandbox-head-row">
              <div>
                <b>✦ {tr('Галерея великих химиков')}: {unlockedCards} / {scientistCards.length}</b>
                <p className="small muted" style={{ margin: '2px 0 0' }}>
                  {tr('Коллекционные 3D-карточки учёных за реальное освоение модулей, практикумов ≥ 90 % и кампаний запуска.')}
                  {legendaryCards > 0 ? ` · ✦ ${tr('Легендарных:')} ${legendaryCards}` : ''}
                </p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Link to="/flashcards" className="btn small ghost">⚡ {tr('Флеш-тренажёр SM-2')}</Link>
                <button type="button" className="btn small primary" onClick={() => setTab('gallery')}>
                  {tr('Открыть галерею →')}
                </button>
              </div>
            </div>
          </section>

          <ActivityHeatmap progress={progress} />

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
                <CompetencyRadar domains={radarData} />
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
                        <p className="small no-print">
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
                      <th className="no-print">{tr('Разбор')}</th>
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
                          <td className="no-print"><Link to={`/attempts/${att.id}`}>{tr('Открыть')}</Link></td>
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
              <Link className="btn no-print" to="/sandbox">{tr('Открыть Лабораторию')}</Link>
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
                      <Link className="btn small no-print" to={`/sandbox?load=${encodeURIComponent(f.id)}`}>{tr('Открыть')}</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel no-print">
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
        </>
      )}
    </div>
  )
}
