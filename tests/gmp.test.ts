import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { evaluateGmp, validateGmpLab, type GmpLabData } from '../shared/gmp'

const gmpLab: GmpLabData = YAML.parse(fs.readFileSync(path.join('content', 'labs', 'gmp-batch-record.yaml'), 'utf8'))

describe('Тренажёр по GMP (ISO 22716)', () => {
  it('учебный файл gmp-batch-record.yaml проходит строгую валидацию', () => {
    expect(validateGmpLab(gmpLab)).toEqual([])
  })

  it('безошибочный аудит маршрутной карты даёт 100 %', () => {
    const ev = evaluateGmp(gmpLab, {
      ccps: gmpLab.steps.filter((s) => s.isCcp).map((s) => s.id),
      deviations: gmpLab.steps.filter((s) => s.hasDeviation).map((s) => s.id),
      disposition: 'quarantine',
      capa: gmpLab.capa.filter((c) => c.valid).map((c) => c.id),
    })
    expect(ev.score).toBe(1)
    expect(ev.deviations.missed).toEqual([])
    expect(ev.deviations.extra).toEqual([])
    expect(ev.capa.extra).toEqual([])
  })

  it('штрафует за пропуск критических отклонений, ложные отметки и фальсификацию CAPA', () => {
    const ev = evaluateGmp(gmpLab, {
      ccps: ['s1'],
      deviations: ['s1', 's3'], // s3 — норма, пропущены s2, s6, s7
      disposition: 'release',
      capa: ['capa-rewrite'],
    })
    expect(ev.score).toBeLessThan(0.25)
    expect(ev.dispositionScore).toBe(0)
    expect(ev.deviations.extra).toContain('s3')
    expect(ev.deviations.missed).toContain('s6')
  })
})
