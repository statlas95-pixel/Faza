import { useEffect, useId, useMemo, useState } from 'react'
import { tr } from '../../shared/locale'
import { mediaByFile, mediaSvgRaw, mediaUrl } from '../content'

/**
 * Превращает статический светлый SVG из content/media/*.svg в адаптивный
 * Liquid Glass Inline SVG:
 *  - подставляет семантические CSS-переменные (--svg-*) под Light и Deep Obsidian Dark темы;
 *  - подтягивает фирменную типографику сайта (Playfair Display, Golos Text, JetBrains Mono);
 *  - добавляет мягкое стеклянное свечение и изолирует внутренние SVG id от коллизий.
 */
const COLOR_TOKEN_MAP: [RegExp, string][] = [
  // Основной фон холста и белых карточек
  [/fill="#(?:F7FAFC|FBF8F3|FFF8EE|F6E6D6)"/gi, 'fill="var(--svg-canvas)"'],
  [/fill="#(?:FFFFFF|fff)"/gi, 'fill="var(--svg-card)"'],
  [/stop-color="#(?:FFFFFF|fff)"/gi, 'stop-color="var(--svg-card)"'],
  [/stop-color="#DDF3EC"/gi, 'stop-color="var(--svg-emerald-bg)"'],
  // Скруглённые светлые пастельные панели
  [/fill="#(?:EFF9FF|E6F6FE|E4F4F2|E3F4F2|E0F2FE|CDECEA|BAE6FD)"/gi, 'fill="var(--svg-sky-bg)"'],
  [/fill="#(?:FFF1F0|FFEAE7)"/gi, 'fill="var(--svg-coral-bg)"'],
  [/fill="#(?:FFF7ED|FFFBEB|FEF3C7|FEF9C3|FDE68A)"/gi, 'fill="var(--svg-amber-bg)"'],
  [/fill="#(?:ECFDF5|E8F7EE|DDF3EC|BFE8D9)"/gi, 'fill="var(--svg-emerald-bg)"'],
  [/fill="#(?:F2FBD9)"/gi, 'fill="var(--svg-lime-bg)"'],
  [/fill="#(?:F5F3FF|F1EEFC|EDE4FF)"/gi, 'fill="var(--svg-violet-bg)"'],
  [/fill="#(?:E2E8F0|CBD5E1)"/gi, 'fill="var(--svg-neutral-bg)"'],
  // Контуры карточек и сетки
  [/stroke="#(?:DCE6EE|E4DACB|E6DACB|CBD5E1|D8D0E3)"/gi, 'stroke="var(--svg-border)"'],
  [/stroke="#(?:FFFFFF|fff)"/gi, 'stroke="var(--svg-card)"'],
  // Тёмные шрифты и подписи → адаптивные
  [/fill="#(?:182026|2A1B3D|1E293B|222|1F1A2B)"/gi, 'fill="var(--svg-ink)"'],
  [/stroke="#(?:2A1B3D|182026|334155)"/gi, 'stroke="var(--svg-ink-soft)"'],
  [/fill="#(?:5B6770|475569|5B4C6E|4A3D5C|64748B|6B7280|5A5470|8E86A0)"/gi, 'fill="var(--svg-muted)"'],
  [/stroke="#(?:64748B|94A3B8|8A7D9A)"/gi, 'stroke="var(--svg-axis)"'],
  // Насыщенные цветные заголовки и контуры → яркие на тёмном стекле, глубокие на светлом
  [/fill="#(?:0C5E80|0369A1|0284C7|0B5553|0E7C7B|0E8B99)"/gi, 'fill="var(--svg-sky-ink)"'],
  [/stroke="#(?:0C5E80|0369A1|0284C7|1F648A|0B5553|0E7C7B|0E8B99)"/gi, 'stroke="var(--svg-sky-ink)"'],
  [/fill="#(?:9A3528|B91C1C|DC2626|D9482B|B3321C|C4382A|C4532B)"/gi, 'fill="var(--svg-coral-ink)"'],
  [/stroke="#(?:9A3528|B91C1C|DC2626|D9482B|C4382A|C4532B|C84B2A|E05545)"/gi, 'stroke="var(--svg-coral-ink)"'],
  [/fill="#(?:92400E|9A3412|B45309|78350F|7C2D12|713F12|9A6800|C2410C|5A220C)"/gi, 'fill="var(--svg-amber-ink)"'],
  [/stroke="#(?:92400E|9A3412|B45309|C98A00|CA8A04)"/gi, 'stroke="var(--svg-amber-ink)"'],
  [/fill="#(?:065F46|047857|059669|0B6B5D|0E7B68)"/gi, 'fill="var(--svg-emerald-ink)"'],
  [/stroke="#(?:065F46|047857|059669)"/gi, 'stroke="var(--svg-emerald-ink)"'],
  [/fill="#(?:3F6212|3D5A08)"/gi, 'fill="var(--svg-lime-ink)"'],
  [/stroke="#(?:3F6212|3D5A08)"/gi, 'stroke="var(--svg-lime-ink)"'],
  [/fill="#(?:5B21B6|4C1D95|4B2E83|6D28D9|6E4FA3|5B3FA8)"/gi, 'fill="var(--svg-violet-ink)"'],
  [/stroke="#(?:5B21B6|4C1D95|4B2E83|6D28D9|6E4FA3|5B3FA8|7C3AED)"/gi, 'stroke="var(--svg-violet-ink)"'],
]

export function themeSvgMarkup(raw: string, scopeId: string): string {
  let out = raw.trim()

  // 1. Скоупируем все id="..." и ссылки url(#...) / href="#...", чтобы 2 схемы на странице не конфликтовали
  const ids = [...out.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  for (const id of new Set(ids)) {
    const safe = `${scopeId}_${id}`
    out = out
      .split(`id="${id}"`).join(`id="${safe}"`)
      .split(`url(#${id})`).join(`url(#${safe})`)
      .split(`href="#${id}"`).join(`href="#${safe}"`)
  }

  // 2. Переводим цвета на адаптивные Liquid Glass токены
  for (const [re, rep] of COLOR_TOKEN_MAP) out = out.replace(re, rep)

  // 3. Единая типографика платформы (Playfair Display / Golos Text / JetBrains Mono)
  out = out
    .replace(/font-family="Georgia,?\s*serif"/gi, 'font-family="var(--serif)"')
    .replace(/font-family="Segoe UI, Arial, sans-serif"/gi, 'font-family="var(--sans)"')
    .replace(/font-family="sans-serif"/gi, 'font-family="var(--sans)"')
    .replace(/font-family="monospace"/gi, 'font-family="var(--mono)"')

  // 4. Добавляем фирменное мягкое Liquid Glass свечение внутрь SVG-холста (после открывающего <svg ...>)
  const glowDefs = `
  <defs>
    <radialGradient id="${scopeId}_lgSky" cx="14%" cy="16%" r="48%">
      <stop offset="0%" stop-color="#8ED6F8" stop-opacity="var(--svg-glow-op)"/>
      <stop offset="100%" stop-color="#8ED6F8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${scopeId}_lgCoral" cx="88%" cy="84%" r="46%">
      <stop offset="0%" stop-color="#FF968A" stop-opacity="var(--svg-glow-op)"/>
      <stop offset="100%" stop-color="#FF968A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${scopeId}_lgSheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="var(--svg-sheen-op)"/>
      <stop offset="22%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>`

  out = out.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const cleanAttrs = attrs.replace(/\sclass="[^"]*"/i, '')
    return `<svg${cleanAttrs} class="lg-svg">${glowDefs}`
  })

  // Вставляем атмосферные световые ореолы сразу после первого фонового <rect width="100%"|500-999.../>
  out = out.replace(
    /(<rect\b[^>]*width="(?:100%|[5-9]\d\d)"[^>]*\/>)/i,
    `$1<rect width="100%" height="100%" rx="18" fill="url(#${scopeId}_lgSky)" pointer-events="none"/><rect width="100%" height="100%" rx="18" fill="url(#${scopeId}_lgCoral)" pointer-events="none"/><rect width="100%" height="100%" rx="18" fill="url(#${scopeId}_lgSheen)" pointer-events="none"/>`,
  )

  return out
}

export function GlassFigure({
  file,
  alt,
  caption,
}: {
  file: string
  alt: string
  caption?: string
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [open, setOpen] = useState(false)
  const meta = mediaByFile(file)
  const rawSvg = mediaSvgRaw(file)
  const fallbackUrl = mediaUrl(file)

  const themedInline = useMemo(
    () => (rawSvg ? themeSvgMarkup(rawSvg, `fg${uid}`) : null),
    [rawSvg, uid],
  )
  const modalInline = useMemo(
    () => (rawSvg && open ? themeSvgMarkup(rawSvg, `lb${uid}`) : null),
    [rawSvg, open, uid],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!rawSvg && !fallbackUrl) {
    return <p className="broken">Нет файла content/media/{file}</p>
  }

  const displayAlt = meta?.alt ?? alt
  const displayCaption = caption ?? alt

  return (
    <>
      <figure className="fig glass-fig">
        <div
          className="glass-fig-frame"
          role="button"
          tabIndex={0}
          aria-label={`${tr('Открыть схему на весь экран:')} ${displayCaption}`}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
        >
          {themedInline ? (
            <div
              className="glass-fig-svg"
              aria-label={displayAlt}
              dangerouslySetInnerHTML={{ __html: themedInline }}
            />
          ) : (
            <img src={fallbackUrl} alt={displayAlt} loading="lazy" />
          )}
          <span className="glass-fig-zoom no-print" aria-hidden="true">⤢ {tr('Увеличить')}</span>
        </div>
        <figcaption>
          {displayCaption}
          <span className="credit">
            {meta ? (
              <>
                {meta.author}. <a href="#/about">{tr('Реестр изображений')}</a>
              </>
            ) : (
              tr('Нет записи в реестре изображений')
            )}
          </span>
        </figcaption>
      </figure>

      {open && (
        <div
          className="lightbox-bg no-print"
          role="dialog"
          aria-modal="true"
          aria-label={displayCaption}
          onClick={() => setOpen(false)}
        >
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-head">
              <b>{meta?.title ?? displayCaption}</b>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setOpen(false)}
                aria-label={tr('Закрыть')}
              >
                ✕ {tr('Закрыть')}
              </button>
            </div>
            <div className="lightbox-body">
              {modalInline ? (
                <div
                  className="glass-fig-svg"
                  dangerouslySetInnerHTML={{ __html: modalInline }}
                />
              ) : (
                <img src={fallbackUrl} alt={displayAlt} />
              )}
            </div>
            {displayCaption && <p className="small muted lightbox-cap">{displayCaption}</p>}
          </div>
        </div>
      )}
    </>
  )
}
