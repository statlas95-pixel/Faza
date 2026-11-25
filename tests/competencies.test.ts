import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import {
  COMPETENCY_DOMAINS,
  buildCompetencyProfile,
  buildRefreshQueue,
  computeCareerGrade,
  createProgressBackup,
  importProgressBackup,
} from '../shared/competencies'
import { DAILY_CASES, getDailyCase } from '../shared/daily-case'
import { skillState } from '../shared/mastery'
import { emptyProgress } from '../shared/merge'

const skills = YAML.parse(fs.readFileSync('content/skills.yaml', 'utf8')) as { id: string }[]

describe('Карта компетенций по 6 направлениям и экспорт/импорт JSON', () => {
  it('каждый навык из content/skills.yaml входит ровно в одно из 6 направлений', () => {
    const mapped = COMPETENCY_DOMAINS.flatMap((d) => d.skills)
    expect(COMPETENCY_DOMAINS).toHaveLength(6)
    expect(new Set(mapped).size).toBe(mapped.length)
    for (const sk of skills) {
      expect(mapped, `навык ${sk.id} не отнесён к домену`).toContain(sk.id)
    }
  })

  it('корректно считает процент освоения, число освоенных навыков и следующий шаг по домену', () => {
    const states = {
      'cip-verification': skillState('cip-verification', [
        { id: 'lab:1', skill: 'cip-verification', kind: 'lab', item: 'lab', result: 'ok', score: 1, hints: 0, src: 'gmp-batch-record', label: 'GMP', at: 10 },
        { id: 'tr:1', skill: 'cip-verification', kind: 'transfer', item: 'transfer', result: 'ok', src: 'gmp-batch-record', label: 'GMP', at: 11 },
      ]),
    }
    const profile = buildCompetencyProfile(states)
    const gmp = profile.find((d) => d.def.id === 'gmp')!
    expect(gmp.total).toBe(2)
    expect(gmp.mastered).toBe(1)
    expect(gmp.percent).toBe(50) // 4 из 8 возможных баллов
    expect(gmp.nextSkillId).toBe('water-sanitation')
  })

  it('экспортирует и безопасно объединяет резервную копию JSON без потери текущих данных', () => {
    const current = emptyProgress()
    current.visited['emulsion-stability'] = 100
    current.labDone['batch-2417'] = { at: 100, attempts: 1, summary: 'ok' }

    const remote = emptyProgress()
    remote.visited['preservation'] = 200
    remote.labDone['gmp-batch-record'] = { at: 200, attempts: 1, summary: '100%' }

    const backup = createProgressBackup(remote, [
      { id: 'f1', name: 'Крем O/W', at: 200, formula: { productType: 'leave-on', targetPh: 5.5, batchGrams: 500, phaseTempC: { A: 75, B: 75, C: 38 }, rows: [] } },
    ])
    const res = importProgressBackup(JSON.stringify(backup), current, [])
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.progress.visited['emulsion-stability']).toBe(100)
      expect(res.progress.visited['preservation']).toBe(200)
      expect(res.progress.labDone['batch-2417']).toBeTruthy()
      expect(res.progress.labDone['gmp-batch-record']).toBeTruthy()
      expect(res.sandboxFormulas).toHaveLength(1)
    }

    expect(importProgressBackup('not-json', current, []).ok).toBe(false)
    expect(importProgressBackup('{"foo":1}', current, []).ok).toBe(false)
  })

  it('рассчитывает грейд технолога, очередь интервального повторения и микро-кейс дня', () => {
    const emptyProfile = buildCompetencyProfile({})
    expect(computeCareerGrade(emptyProfile, 0).level).toBe(1)
    expect(computeCareerGrade(emptyProfile, 2).level).toBe(2)

    const now = Date.now()
    const states: any = {
      mech: { level: 2, confidence: 1, gap: true, evidence: [{ at: now }] },
      rheo: { level: 2, confidence: 1, gap: false, evidence: [{ at: now - 5 * 86400000 }] },
    }
    const queue = buildRefreshQueue(states, [
      { id: 'mech', name: 'Механизмы', topics: ['emulsion-stability'], labs: ['stability-bench'] },
      { id: 'rheo', name: 'Реология', topics: ['rheology-basics'], labs: ['rheo-cabinet'] },
    ], now)
    expect(queue.map((q) => q.skillId)).toEqual(['mech', 'rheo'])

    expect(DAILY_CASES.length).toBeGreaterThanOrEqual(8)
    for (const c of DAILY_CASES) {
      expect(c.options.filter((o) => o.correct)).toHaveLength(1)
    }
    const c0 = getDailyCase(new Date('2026-11-25'), 0)
    const c1 = getDailyCase(new Date('2026-11-25'), 1)
    expect(c0.id).not.toBe(c1.id)
  })
})
