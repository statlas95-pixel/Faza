import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  dosePhBatch,
  evaluateChallengeTest,
  evaluatePhBatch,
  initialPhBatchState,
  type ChallengeTestLabData,
} from '../shared/package-b-sim'

describe('Пакет B — Challenge Test ISO 11930, Бриф заказчика и Титрование pH 500 кг', () => {
  it('точно оценивает протокол Challenge Test ISO 11930 из YAML', () => {
    const lab = YAML.parse(
      fs.readFileSync(path.join('content', 'labs', 'challenge-test-iso11930.yaml'), 'utf8'),
    ) as ChallengeTestLabData

    expect(lab.strains).toHaveLength(5)
    const correctRemedy = lab.remedies.find((r) => r.correct)!
    const ok = evaluateChallengeTest(lab, {
      strainId: lab.failedStrainId,
      criterion: lab.expectedCriterion,
      remedyId: correctRemedy.id,
    })
    expect(ok.score).toBe(1)
    expect(ok.strainOk).toBe(true)
    expect(ok.critOk).toBe(true)
    expect(ok.remedyOk).toBe(true)

    const bad = evaluateChallengeTest(lab, {
      strainId: 'pa',
      criterion: 'B',
      remedyId: 'release-anyway',
    })
    expect(bad.score).toBe(0)
  })

  it('подтверждает связность сценария «Бриф от заказчика: Маркетинг vs Химия»', () => {
    const brief = YAML.parse(
      fs.readFileSync(path.join('content', 'labs', 'marketing-brief-branch.yaml'), 'utf8'),
    ) as any
    const byId = new Map<string, any>(brief.nodes.map((n: any) => [n.id, n]))
    let cur = byId.get(brief.start)
    let steps = 0
    while (cur && !cur.outcome && steps < 10) {
      const okChoice = cur.choices.find((c: any) => c.verdict === 'ok')
      expect(okChoice).toBeTruthy()
      cur = byId.get(okChoice.next)
      steps++
    }
    expect(steps).toBe(3)
    expect(cur.outcome.score).toBe(1)
    expect(cur.outcome.verdict).toBe('ok')
  })

  it('награждает 100 % за плавную подгонку pH 500 кг карбомера и штрафует за перелёт с солевыми качелями', () => {
    // 1. Плавная нейтрализация без перелёта: +2.0, +1.0, +0.5, +0.2, +0.2 = 3.9 кг 10% NaOH
    let ok = initialPhBatchState()
    expect(ok.ph).toBeLessThan(3.5)
    ok = dosePhBatch(ok, 'naoh', 2.0)
    ok = dosePhBatch(ok, 'naoh', 1.0)
    ok = dosePhBatch(ok, 'naoh', 0.5)
    ok = dosePhBatch(ok, 'naoh', 0.2)
    ok = dosePhBatch(ok, 'naoh', 0.2)
    expect(ok.ph).toBeGreaterThanOrEqual(5.7)
    expect(ok.ph).toBeLessThanOrEqual(6.3)
    expect(ok.viscosityMpas).toBeGreaterThanOrEqual(18000)
    expect(ok.saltPct).toBe(0)
    const evOk = evaluatePhBatch(ok)
    expect(evOk.score).toBe(1)
    expect(evOk.noOvershoot).toBe(true)

    // 2. Перелёт в щелочную зону (+6.0 кг NaOH) и обратная коррекция лимонной кислотой
    let over = initialPhBatchState()
    over = dosePhBatch(over, 'naoh', 2.0)
    over = dosePhBatch(over, 'naoh', 2.0)
    over = dosePhBatch(over, 'naoh', 2.0)
    expect(over.ph).toBeGreaterThan(8.0)
    for (let i = 0; i < 7; i++) {
      over = dosePhBatch(over, 'citric', 0.5)
    }
    expect(over.ph).toBeGreaterThanOrEqual(5.7)
    expect(over.ph).toBeLessThanOrEqual(6.3)
    expect(over.saltPct).toBeGreaterThan(0.08)
    expect(over.viscosityMpas).toBeLessThan(16000)
    const evOver = evaluatePhBatch(over)
    expect(evOver.noOvershoot).toBe(false)
    expect(evOver.score).toBeLessThan(0.8)
  })
})
