import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import {
  COMPETENCY_DOMAINS,
  buildCompetencyProfile,
  createProgressBackup,
  importProgressBackup,
} from '../shared/competencies'
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
})
