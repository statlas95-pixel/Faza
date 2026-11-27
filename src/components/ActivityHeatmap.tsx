import { useMemo } from 'react'
import { tr } from '../../shared/locale'
import { buildActivityHeatmap } from '../../shared/activity-heatmap'
import type { Progress } from '../../shared/merge'

export function ActivityHeatmap({ progress }: { progress: Progress }) {
  const hm = useMemo(() => buildActivityHeatmap(progress), [progress])

  return (
    <section className="panel heatmap-card no-print" aria-label={tr('Ритм практики за 12 недель')}>
      <div className="sandbox-head-row">
        <div>
          <h2 style={{ margin: 0 }}>{tr('Ритм практики · 12 недель')}</h2>
          <p className="small muted" style={{ margin: '3px 0 0' }}>
            {tr('Спокойный журнал реальных действий: темы, практикумы, рецептуры, кампании и повторения карточек.')}
          </p>
        </div>
        <div className="row num" style={{ gap: 12 }}>
          <span className="chip">{tr('Действий:')} <b>{hm.totalActions}</b></span>
          <span className="chip">{tr('Активных дней:')} <b>{hm.activeDays} / 84</b></span>
          <span className="chip">{tr('Недель с практикой:')} <b>{hm.activeWeeks} / 12</b></span>
        </div>
      </div>

      <div className="hm-grid" role="img" aria-label={`${tr('Активных дней:')} ${hm.activeDays} / 84`}>
        {hm.weeks.map((week, wi) => (
          <div key={wi} className="hm-col">
            {week.map((day) => (
              <span
                key={day.dateKey}
                className={`hm-cell lv-${day.level} ${day.isToday ? 'today' : ''}`}
                title={`${day.dateKey}: ${day.count}`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="hm-legend small muted">
        <span>{tr('Меньше')}</span>
        <span className="hm-cell lv-0" />
        <span className="hm-cell lv-1" />
        <span className="hm-cell lv-2" />
        <span className="hm-cell lv-3" />
        <span className="hm-cell lv-4" />
        <span>{tr('Больше')}</span>
      </div>
    </section>
  )
}
