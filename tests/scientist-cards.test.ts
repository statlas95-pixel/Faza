import { describe, expect, it } from 'vitest'
import { emptyProgress } from '../shared/merge'
import { decodePortfolioSnapshot, encodePortfolioSnapshot } from '../shared/portfolio-share'
import {
  diffCardUpgrades,
  evaluateScientistDeck,
  getScientistDeck,
  type ModuleDeckInput,
} from '../shared/scientist-cards'

const SAMPLE_MODULES: ModuleDeckInput[] = [
  { id: 'chem-raw', topicIds: ['raw-functions', 'solutions-basics'], skillIds: ['inci', 'solcalc'], labIds: ['inci-sheet'] },
  { id: 'chem-colloid', topicIds: ['disperse-systems'], skillIds: ['disperse'], labIds: ['stability-bench'] },
]

describe('Scientist Cards & Portfolio 2.0 (Packages O & P)', () => {
  it('defines exactly 18 unique scientist cards (15 modules + 3 special mastery cards)', () => {
    const deck = getScientistDeck()
    expect(deck.length).toBe(18)
    expect(new Set(deck.map((c) => c.id)).size).toBe(18)
    expect(deck.filter((c) => Boolean(c.moduleId)).length).toBe(15)
    expect(deck.filter((c) => Boolean(c.special)).length).toBe(3)
  })

  it('deterministically upgrades card tiers from locked -> common -> rare -> epic -> legendary', () => {
    const p = emptyProgress()
    const base = evaluateScientistDeck(p, {}, SAMPLE_MODULES)
    expect(base.every((c) => c.tier === 'locked')).toBe(true)

    // Visit one topic in chem-raw -> Mendeleev becomes common
    p.visited['raw-functions'] = Date.now()
    const step1 = evaluateScientistDeck(p, {}, SAMPLE_MODULES)
    expect(step1.find((c) => c.def.id === 'mendeleev')?.tier).toBe('common')

    // Complete lab -> rare
    p.labDone['inci-sheet'] = { at: Date.now(), attempts: 1 }
    const step2 = evaluateScientistDeck(p, {}, SAMPLE_MODULES)
    expect(step2.find((c) => c.def.id === 'mendeleev')?.tier).toBe('rare')

    // Reach independent level 3 + all topics visited -> epic
    p.visited['solutions-basics'] = Date.now()
    const step3 = evaluateScientistDeck(
      p,
      { inci: { level: 3, confidence: 2, evidence: [], gap: false, legacy: false } },
      SAMPLE_MODULES,
    )
    expect(step3.find((c) => c.def.id === 'mendeleev')?.tier).toBe('epic')

    // Score >= 90% without hints -> legendary
    p.evidence.push({
      id: 'lab:1:inci',
      skill: 'inci',
      kind: 'lab',
      item: 'lab',
      result: 'ok',
      score: 0.95,
      hints: 0,
      src: 'inci-sheet',
      label: 'Lab',
      at: Date.now(),
    })
    const step4 = evaluateScientistDeck(
      p,
      { inci: { level: 3, confidence: 2, evidence: [], gap: false, legacy: false } },
      SAMPLE_MODULES,
    )
    expect(step4.find((c) => c.def.id === 'mendeleev')?.tier).toBe('legendary')

    // Special mastery cards: Curie, Lavoisier, Fisher
    p.campaigns['spf-50-city'] = { id: 'spf-50-city', stage: 5, choices: {}, finalScore: 91, completedAt: Date.now(), at: Date.now() }
    p.savedFormulas = [
      { id: 'f1', name: 'Cream 1', at: 1, formula: { rows: [{ percent: 70 }, { percent: 15 }, { percent: 10 }, { percent: 5 }] } },
      { id: 'f2', name: 'Cream 2', at: 2, formula: { rows: [{ percent: 75 }, { percent: 15 }, { percent: 5 }, { percent: 5 }] } },
      { id: 'f3', name: 'Cream 3', at: 3, formula: { rows: [{ percent: 80 }, { percent: 10 }, { percent: 5 }, { percent: 5 }] } },
    ]
    p.attempts.push({ id: 'a1', labId: 'night-shift-chp', at: Date.now(), summary: 'Saved', detail: { score: 0.95, hints: 0 } })
    const specials = evaluateScientistDeck(p, {}, SAMPLE_MODULES)
    expect(specials.find((c) => c.def.id === 'curie')?.tier).toBe('legendary')
    expect(specials.find((c) => c.def.id === 'lavoisier')?.tier).toBe('legendary')
    expect(specials.find((c) => c.def.id === 'fisher')?.tier).toBe('legendary')

    const prevMap = Object.fromEntries(step1.map((c) => [c.def.id, c.tier]))
    const upgrades = diffCardUpgrades(prevMap, specials)
    expect(upgrades.map((u) => u.def.id)).toEqual(expect.arrayContaining(['curie', 'lavoisier', 'fisher']))
  })

  it('round-trips Cyrillic portfolio share snapshots safely via base64url and rejects invalid tokens', () => {
    const snap = {
      v: 1 as const,
      n: 'Дмитрий Ростовский',
      d: '2026-11-27',
      g: 3,
      gt: 'Ведущий технолог R&D',
      gb: 'Senior R&D',
      gp: 84,
      c: [{ l: 3, s: 92, a: '2026-11-27' }],
      dom: [90, 82, 76, 88, 70, 95],
      m: 41,
      t: 49,
      lb: 38,
      lt: 54,
      fm: 5,
      cp: 2,
      sc: 14,
      sl: 6,
    }
    const token = encodePortfolioSnapshot(snap)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodePortfolioSnapshot(token)).toEqual(snap)
    expect(decodePortfolioSnapshot('invalid!!!')).toBeNull()
    expect(decodePortfolioSnapshot('')).toBeNull()
  })
})
