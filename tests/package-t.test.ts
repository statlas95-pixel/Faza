import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { MICRO3D_MODELS, projectPoint3D } from '../shared/micro3d'
import { emptyProgress, mergeProgress } from '../shared/merge'

describe('Пакет T: 3D-микромир, PWA v2 и настройки тактильного звука', () => {
  it('содержит 6 валидных двуязычных 3D-моделей со связями и корректной 3D-проекцией', () => {
    expect(MICRO3D_MODELS).toHaveLength(6)
    for (const m of MICRO3D_MODELS) {
      expect(m.nodes.length).toBeGreaterThanOrEqual(8)
      expect(m.edges.length).toBeGreaterThanOrEqual(8)
      const ids = new Set(m.nodes.map((n) => n.id))
      for (const e of m.edges) {
        expect(ids.has(e.from), `${m.id} missing ${e.from}`).toBe(true)
        expect(ids.has(e.to), `${m.id} missing ${e.to}`).toBe(true)
      }
      expect(/[а-яё]/i.test(m.titleEn)).toBe(false)
      expect(/[а-яё]/i.test(m.descEn)).toBe(false)
    }

    const p0 = projectPoint3D({ x: 100, y: 0, z: 0 }, 0, 0, 1, 200, 150)
    expect(p0.sx).toBeCloseTo(300, 1)
    expect(p0.sy).toBeCloseTo(150, 1)
    const pRot = projectPoint3D({ x: 100, y: 0, z: 0 }, 0, Math.PI / 2, 1, 200, 150)
    expect(pRot.sx).toBeCloseTo(200, 1)
    expect(pRot.depth).toBeCloseTo(100, 1)
  })

  it('содержит валидный PWA manifest.webmanifest с иконками/ярлыками и Service Worker v2', () => {
    const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'))
    expect(manifest.display).toBe('standalone')
    expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length).toBeGreaterThanOrEqual(3)

    const sw = fs.readFileSync('public/sw.js', 'utf8')
    expect(sw).toContain('faza-static-v2')
    expect(sw).toContain('/api/')
  })

  it('сохраняет опциональную настройку тактильного звука в mergeProgress', () => {
    const a = emptyProgress()
    const b = emptyProgress()
    b.settings.sound = true
    expect(mergeProgress(a, b).settings.sound).toBe(true)
  })
})
