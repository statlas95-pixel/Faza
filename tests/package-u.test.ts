import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { CAMPAIGNS, evaluateCampaignLabFormula, getCampaign } from '../shared/campaigns'
import type { Ingredient } from '../shared/formulation'
import {
  buildExamQuestions,
  buildSignedExamResult,
  decodeExamConfig,
  decodeExamResult,
  encodeExamConfig,
  encodeExamResult,
  type ExamConfig,
} from '../shared/assessment'

const catalog = YAML.parse(fs.readFileSync('content/ingredients.yaml', 'utf8')) as Ingredient[]

describe('Пакет U: Кампания № 3 (Зелёный DMS ISO 16128) и режим экзамена для команд', () => {
  it('Кампания № 3 отклоняет стартовый шаблон с D5/EDTA и принимает эталонный DMS-крем ISO 16128 ≥ 96 %', () => {
    expect(CAMPAIGNS.length).toBeGreaterThanOrEqual(3)
    const dms = getCampaign('dms-green-iso16128')!
    expect(dms).toBeTruthy()
    expect(dms.stages).toHaveLength(5)

    const bad = evaluateCampaignLabFormula('dms-green-iso16128', dms.starterFormula, catalog)
    expect(bad.passed).toBe(false)

    const good = evaluateCampaignLabFormula('dms-green-iso16128', dms.referenceGoodFormula, catalog)
    expect(good.errors).toBe(0)
    expect(good.passed).toBe(true)
    expect(good.score).toBe(20)
  })

  it('детерминированно собирает экзаменационный билет по seed и верифицирует контрольную подпись результата', () => {
    const cfg: ExamConfig = { org: 'CosmoLab', role: 'Senior R&D', track: 'full', seed: 2026, count: 8, minutes: 15 }
    const token = encodeExamConfig(cfg)
    expect(decodeExamConfig(token)).toEqual(cfg)

    const q1 = buildExamQuestions(cfg)
    const q2 = buildExamQuestions(cfg)
    expect(q1).toHaveLength(8)
    expect(q1.map((x) => x.id)).toEqual(q2.map((x) => x.id))

    const perfectAnswers = Object.fromEntries(q1.map((q) => [q.id, q.options.find((o) => o.correct)!.id]))
    const res = buildSignedExamResult(cfg, 'Maria Petrova', q1, perfectAnswers, 420)
    expect(res.score).toBe(100)
    const code = encodeExamResult(res)
    const verified = decodeExamResult(code)!
    expect(verified.valid).toBe(true)
    expect(verified.payload.candidate).toBe('Maria Petrova')

    // Проверка защиты от подделки балла
    const tampered = { ...res, score: 99 }
    const fakeCode = `FAZA-EXAM-${btoa(JSON.stringify(tampered)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
    expect(decodeExamResult(fakeCode)?.valid).toBe(false)
  })
})
