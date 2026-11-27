import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { Ingredient } from '../shared/formulation'
import {
  CAMPAIGNS,
  computeCampaignReport,
  evaluateCampaignLabFormula,
} from '../shared/campaigns'
import { fingerprint, mergeProgress, normalize } from '../shared/merge'

const catalog: Ingredient[] = YAML.parse(
  fs.readFileSync(path.resolve('content/ingredients.yaml'), 'utf8'),
)
const validIds = new Set(catalog.map((i) => i.id))

describe('Launch Campaigns (Direction H)', () => {
  it('defines 2 complete 5-stage campaigns with valid catalog ingredient IDs', () => {
    expect(CAMPAIGNS.length).toBe(2)
    for (const c of CAMPAIGNS) {
      expect(c.stages.length).toBe(5)
      for (const r of [...c.starterFormula.rows, ...c.referenceGoodFormula.rows]) {
        expect(validIds.has(r.ingredientId)).toBe(true)
      }
    }
  })

  it('scores reference formulas as passing and flags starter defects on Stage 2', () => {
    for (const c of CAMPAIGNS) {
      const startRes = evaluateCampaignLabFormula(c.id, c.starterFormula, catalog)
      const goodRes = evaluateCampaignLabFormula(c.id, c.referenceGoodFormula, catalog)
      expect(goodRes.passed).toBe(true)
      expect(goodRes.score).toBeGreaterThanOrEqual(16)
      expect(goodRes.score).toBeGreaterThan(startRes.score)
    }
  })

  it('propagates consequences across stages and preserves campaign progress in merge/fingerprint', () => {
    const spf = CAMPAIGNS[0]
    const bestRec = {
      id: spf.id,
      stage: 5,
      choices: {
        '0': 'modern-photostable',
        '2': 'opaque-airless-evoh',
        '3': 'vacuum-scraper-phe',
        '4': 'capa-polarized-freeze',
      },
      labSummary: { score: 20, passed: true, costPerKg: 1950, errors: 0, spf: 55, notes: [] },
      at: 1000,
    }
    const worstRec = {
      id: spf.id,
      stage: 5,
      choices: {
        '0': 'avobenzone-octinoxate',
        '2': 'thin-ldpe-tube',
        '3': 'dilute-water-5',
        '4': 'cut-uv-filters',
      },
      labSummary: { score: 8, passed: false, costPerKg: 2100, errors: 2, spf: 25, notes: [] },
      at: 1000,
    }

    const bestReport = computeCampaignReport(spf, bestRec)
    const worstReport = computeCampaignReport(spf, worstRec)
    expect(bestReport.totalScore).toBe(100)
    expect(worstReport.totalScore).toBeLessThan(40)
    expect(worstReport.carriedConsequencesRu.length).toBeGreaterThanOrEqual(3)
    expect(worstReport.defectRiskPct).toBeGreaterThan(bestReport.defectRiskPct)

    // Backward-compatible Progress merge & fingerprint
    const emptyA = normalize({})
    const withCamp = normalize({ campaigns: { [spf.id]: bestRec } })
    const merged = mergeProgress(emptyA, withCamp)
    expect(merged.campaigns[spf.id]?.stage).toBe(5)
    expect(fingerprint(merged)).not.toBe(fingerprint(emptyA))
  })
})
