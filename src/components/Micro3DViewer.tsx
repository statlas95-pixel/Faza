import { useEffect, useMemo, useRef, useState } from 'react'
import { language, tr } from '../../shared/locale'
import { MICRO3D_MODELS, projectPoint3D, type Micro3DId } from '../../shared/micro3d'

export function Micro3DViewer({ initialId = 'micelle' }: { initialId?: Micro3DId }) {
  const en = language === 'en'
  const [selectedId, setSelectedId] = useState<Micro3DId>(initialId)
  const [rotX, setRotX] = useState(0.35)
  const [rotY, setRotY] = useState(0.55)
  const [zoom, setZoom] = useState(1.0)
  const [autoSpin, setAutoSpin] = useState(true)
  const dragging = useRef<{ x: number; y: number } | null>(null)

  const model = useMemo(
    () => MICRO3D_MODELS.find((m) => m.id === selectedId) ?? MICRO3D_MODELS[0],
    [selectedId],
  )

  useEffect(() => {
    if (!autoSpin) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!dragging.current) setRotY((r) => r + dt * 0.45)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [autoSpin])

  const projected = useMemo(() => {
    const cx = 230
    const cy = 150
    const map = new Map<string, ReturnType<typeof projectPoint3D> & { r: number; color: string; label?: string; id: string }>()
    for (const n of model.nodes) {
      const p = projectPoint3D(n, rotX, rotY, zoom, cx, cy)
      map.set(n.id, { ...p, r: n.r, color: n.color, label: n.label, id: n.id })
    }
    const sortedNodes = [...map.values()].sort((a, b) => a.depth - b.depth)
    const edges = model.edges
      .map((e) => {
        const a = map.get(e.from)
        const b = map.get(e.to)
        if (!a || !b) return null
        return { a, b, depth: (a.depth + b.depth) / 2, color: e.color ?? '#94A3B8', width: e.width ?? 2 }
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => a.depth - b.depth)
    return { sortedNodes, edges }
  }, [model, rotX, rotY, zoom])

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { x: e.clientX, y: e.clientY }
    setAutoSpin(false)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return
    const dx = e.clientX - dragging.current.x
    const dy = e.clientY - dragging.current.y
    dragging.current = { x: e.clientX, y: e.clientY }
    setRotY((r) => r + dx * 0.012)
    setRotX((r) => Math.max(-1.4, Math.min(1.4, r + dy * 0.012)))
  }

  function onPointerUp() {
    dragging.current = null
  }

  return (
    <section className="panel micro3d-panel" aria-label={tr('3D-микромир косметической химии')}>
      <div className="sandbox-head-row">
        <div>
          <h2 style={{ margin: 0 }}>{tr('Интерактивный 3D-микромир')}</h2>
          <p className="small muted" style={{ margin: '3px 0 0' }}>
            {tr('Поверните структуру мышью или пальцем, чтобы рассмотреть пространственное строение мицелл, бислоёв, липосом и молекул активов.')}
          </p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn small ghost" onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))} aria-label={tr('Приблизить')}>+</button>
          <button type="button" className="btn small ghost" onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))} aria-label={tr('Отдалить')}>−</button>
          <button type="button" className={`btn small ${autoSpin ? 'primary' : 'ghost'}`} onClick={() => setAutoSpin((v) => !v)}>
            {autoSpin ? tr('Пауза 3D') : tr('Вращать 3D')}
          </button>
        </div>
      </div>

      <div className="tools-tabs" role="tablist" aria-label={tr('Выбор 3D-модели')} style={{ marginTop: 12 }}>
        {MICRO3D_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === model.id}
            className={`chip ${m.id === model.id ? 'on' : ''}`}
            onClick={() => { setSelectedId(m.id); setRotX(0.35); setRotY(0.55); setZoom(1) }}
          >
            {en ? m.titleEn : m.titleRu}
          </button>
        ))}
      </div>

      <div className="micro3d-grid">
        <div className="micro3d-stage">
          <svg
            viewBox="0 0 460 300"
            className="micro3d-svg"
            role="img"
            aria-label={en ? model.titleEn : model.titleRu}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <defs>
              <radialGradient id="m3d_glow" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="rgba(14,139,153,0.18)" />
                <stop offset="100%" stopColor="rgba(14,139,153,0)" />
              </radialGradient>
            </defs>
            <rect width="460" height="300" rx="16" fill="url(#m3d_glow)" />
            {projected.edges.map((e, i) => (
              <line
                key={i}
                x1={e.a.sx}
                y1={e.a.sy}
                x2={e.b.sx}
                y2={e.b.sy}
                stroke={e.color}
                strokeWidth={Math.max(1, e.width * ((e.a.scale + e.b.scale) / 2))}
                strokeOpacity={Math.max(0.28, Math.min(0.92, (e.depth + 140) / 240))}
                strokeLinecap="round"
              />
            ))}
            {projected.sortedNodes.map((n) => {
              const rad = Math.max(2.5, n.r * n.scale)
              const opacity = Math.max(0.38, Math.min(1, (n.depth + 150) / 230))
              return (
                <g key={n.id} opacity={opacity}>
                  <circle cx={n.sx} cy={n.sy} r={rad} fill={n.color} stroke="rgba(255,255,255,0.45)" strokeWidth={1.1} />
                  <circle cx={n.sx - rad * 0.28} cy={n.sy - rad * 0.28} r={rad * 0.32} fill="rgba(255,255,255,0.42)" />
                  {n.label && rad >= 7 && (
                    <text x={n.sx} y={n.sy + 3} textAnchor="middle" fontSize={Math.max(8, Math.min(11, rad * 0.78))} fontWeight="700" fill="#FFFFFF" style={{ pointerEvents: 'none' }}>
                      {n.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          <span className="small muted micro3d-hint">{tr('Перетаскивайте для вращения в 3D')}</span>
        </div>

        <div className="micro3d-info">
          <span className="grade-badge">{en ? model.categoryEn : model.categoryRu}</span>
          <h3 style={{ margin: '8px 0 4px' }}>{en ? model.titleEn : model.titleRu}</h3>
          <div className="small num muted" style={{ marginBottom: 10 }}>{model.formula}</div>
          <p style={{ margin: '0 0 12px', lineHeight: 1.55 }}>{en ? model.descEn : model.descRu}</p>
          <div className="micro3d-legend">
            {model.legend.map((item, i) => (
              <div key={i} className="micro3d-leg-row small">
                <span className="micro3d-dot" style={{ background: item.color }} />
                <span>{en ? item.labelEn : item.labelRu}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
