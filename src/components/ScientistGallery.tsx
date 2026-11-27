import { useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import {
  tierLabel,
  type CardTier,
  type ScientistCardState,
} from '../../shared/scientist-cards'
import { useScientistCards } from './ScientistWatcher'

const portraitModules = import.meta.glob('../assets/scientists/*.jpg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

function portraitUrl(id: string): string | undefined {
  return portraitModules[`../assets/scientists/${id}.jpg`]
}

function tierStars(tier: CardTier): string {
  switch (tier) {
    case 'common': return '●'
    case 'rare': return '●●'
    case 'epic': return '●●●'
    case 'legendary': return '✦'
    default: return '○'
  }
}

function ScientistCardTile({ card }: { card: ScientistCardState }) {
  const [flipped, setFlipped] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false })
  const locked = card.tier === 'locked'
  const img = portraitUrl(card.def.id)

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / Math.max(1, rect.width)
    const py = (e.clientY - rect.top) / Math.max(1, rect.height)
    setTilt({
      rx: (0.5 - py) * 14,
      ry: (px - 0.5) * 16,
      mx: Math.round(px * 100),
      my: Math.round(py * 100),
      active: true,
    })
  }

  function onLeave() {
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50, active: false })
  }

  return (
    <div
      className={`sc-scene tier-${card.tier} accent-${card.def.accent} ${flipped ? 'is-flipped' : ''} ${tilt.active ? 'is-tilting' : ''}`}
      style={{
        ['--rx' as any]: `${tilt.rx.toFixed(2)}deg`,
        ['--ry' as any]: `${tilt.ry.toFixed(2)}deg`,
        ['--mx' as any]: `${tilt.mx}%`,
        ['--my' as any]: `${tilt.my}%`,
      }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div
        className="sc-card"
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={`${card.def.name} — ${tierLabel(card.tier)}. ${tr('Нажмите, чтобы перевернуть карточку')}`}
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFlipped((v) => !v)
          }
        }}
      >
        {/* Лицевая сторона */}
        <div className="sc-face sc-front">
          {img && (
            <img
              src={img}
              alt={locked ? '' : card.def.name}
              className="sc-portrait"
              loading="lazy"
              draggable={false}
            />
          )}
          <div className="sc-vignette" aria-hidden="true" />
          <div className="sc-foil" aria-hidden="true" />
          <div className="sc-glare" aria-hidden="true" />

          <div className="sc-top-bar">
            <span className={`sc-tier-pill t-${card.tier}`}>
              <span aria-hidden="true">{tierStars(card.tier)}</span> {tierLabel(card.tier)}
            </span>
            <span className="sc-era num">{card.def.era}</span>
          </div>

          {locked && (
            <div className="sc-lock-crest" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          )}

          <div className="sc-plaque">
            <span className="sc-disc">{card.def.discipline}</span>
            <h3>{card.def.name}</h3>
            <div className="sc-foot-row">
              <span className="sc-eq-mini num">{card.def.equation}</span>
              <span className="sc-flip-cue" aria-hidden="true">↻</span>
            </div>
          </div>
        </div>

        {/* Оборотная сторона: строгий научный паспорт */}
        <div className="sc-face sc-back">
          <div className="sc-back-head">
            <span className={`sc-tier-pill t-${card.tier}`}>
              {tierStars(card.tier)} {tierLabel(card.tier)}
            </span>
            <span className="sc-era num">{card.def.era}</span>
          </div>
          <h3>{card.def.name}</h3>
          <p className="sc-back-disc">{card.def.discipline}</p>
          <div className="sc-eq-box num">{card.def.equation}</div>
          <p className="sc-contrib">{card.def.contribution}</p>

          <div className="sc-mastery-box">
            <div className="sc-mastery-row">
              <span>{tr('Прогресс ранга')}</span>
              <b className="num">{card.progressPct} %</b>
            </div>
            <div className="sc-bar"><span style={{ width: `${Math.max(4, card.progressPct)}%` }} /></div>
            <p className="sc-next-hint">{card.nextHint}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScientistGallery() {
  const cards = useScientistCards()
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'legendary' | 'locked'>('all')

  const unlockedCount = cards.filter((c) => c.tier !== 'locked').length
  const legendaryCount = cards.filter((c) => c.tier === 'legendary').length
  const epicCount = cards.filter((c) => c.tier === 'epic').length

  const visible = useMemo(() => {
    if (filter === 'unlocked') return cards.filter((c) => c.tier !== 'locked')
    if (filter === 'legendary') return cards.filter((c) => c.tier === 'legendary')
    if (filter === 'locked') return cards.filter((c) => c.tier === 'locked')
    return cards
  }, [cards, filter])

  return (
    <section className="sc-gallery no-print" aria-label={tr('Галерея великих химиков')}>
      <div className="panel sc-gallery-head">
        <div className="sandbox-head-row">
          <div>
            <h2>{tr('Галерея великих химиков')}</h2>
            <p className="small muted" style={{ margin: 0 }}>
              {tr('18 коллекционных научных карточек: открываются и повышают редкость строго за доказанное мастерство (темы, практикумы ≥ 90 % без подсказок, кампании и рецептуры) — без случайности. Наведите для 3D-перелива и нажмите, чтобы перевернуть.')}
            </p>
          </div>
          <div className="sc-counters num">
            <span>{tr('Открыто:')} <b>{unlockedCount} / {cards.length}</b></span>
            <span>✦ {tr('Легендарных:')} <b>{legendaryCount}</b></span>
            <span>{tr('Эпических:')} <b>{epicCount}</b></span>
          </div>
        </div>

        <div className="filters" style={{ marginBottom: 0 }}>
          {([
            ['all', `${tr('Все')} (${cards.length})`],
            ['unlocked', `${tr('Открытые')} (${unlockedCount})`],
            ['legendary', `✦ ${tr('Легендарные')} (${legendaryCount})`],
            ['locked', `${tr('Закрытые')} (${cards.length - unlockedCount})`],
          ] as const).map(([key, lbl]) => (
            <button
              key={key}
              type="button"
              className={`chip ${filter === key ? 'on' : ''}`}
              onClick={() => setFilter(key)}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {tr('В этом фильтре пока нет карточек — изучите любую тему на Карте знаний или пройдите практикум, чтобы открыть первую карточку.')}
          </p>
        </div>
      ) : (
        <div className="sc-grid">
          {visible.map((card) => (
            <ScientistCardTile key={card.def.id} card={card} />
          ))}
        </div>
      )}

      <p className="small muted" style={{ marginTop: 14 }}>
        {tr('Примечание: при печати PDF-портфолио для работодателя или HR коллекционная галерея автоматически скрывается.')}
      </p>
    </section>
  )
}
