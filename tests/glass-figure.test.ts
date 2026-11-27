import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeSvgMarkup } from '../src/components/GlassFigure'

describe('Liquid Glass SVG theming (Package L)', () => {
  it('scopes internal SVG ids and remaps flat light colors to semantic CSS tokens', () => {
    const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 320">
      <defs><marker id="arr" viewBox="0 0 10 10"><path d="M0 0L10 5L0 10z"/></marker></defs>
      <rect width="760" height="320" rx="18" fill="#F7FAFC" stroke="#DCE6EE"/>
      <rect x="20" y="20" width="200" height="100" fill="#EFF9FF"/>
      <line x1="20" y1="20" x2="220" y2="20" marker-end="url(#arr)" stroke="#182026"/>
      <text x="30" y="50" font-family="Georgia, serif" fill="#0C5E80">Title</text>
      <text x="30" y="80" font-family="sans-serif" fill="#5B6770">Caption</text>
    </svg>`

    const out = themeSvgMarkup(sample, 'fgTest')
    expect(out).toContain('class="lg-svg"')
    expect(out).toContain('id="fgTest_arr"')
    expect(out).toContain('url(#fgTest_arr)')
    expect(out).toContain('fill="var(--svg-canvas)"')
    expect(out).toContain('fill="var(--svg-sky-bg)"')
    expect(out).toContain('fill="var(--svg-sky-ink)"')
    expect(out).toContain('fill="var(--svg-muted)"')
    expect(out).toContain('font-family="var(--serif)"')
    expect(out).toContain('font-family="var(--sans)"')
    expect(out).toContain('id="fgTest_lgSky"')
    expect(out).toContain('fill="url(#fgTest_lgCoral)"')
  })

  it('processes all 72 bilingual SVGs cleanly without leaving hardcoded white canvas backgrounds', () => {
    for (const dir of ['content/media', 'content/locales/en/media']) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))
      expect(files.length).toBeGreaterThanOrEqual(36)
      for (const f of files) {
        const raw = fs.readFileSync(path.join(dir, f), 'utf8')
        const out = themeSvgMarkup(raw, `t_${f.replace(/\W+/g, '')}`)
        expect(out).toContain('class="lg-svg"')
        expect(out).not.toContain('fill="#F7FAFC"')
        expect(out).not.toContain('fill="#FFFFFF"')
        expect(out).not.toContain('fill="#182026"')
      }
    }
  })
})
