import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  evaluateCoaAudit,
  evaluateLabelAudit,
  evaluateShiftTrend,
  type CoaLabData,
  type LabelAuditLabData,
  type ShiftTrendLabData,
} from '../shared/domain-trainers'

const shiftLab: ShiftTrendLabData = YAML.parse(fs.readFileSync(path.join('content', 'labs', 'shift-log-trend.yaml'), 'utf8'))
const coaLab: CoaLabData = YAML.parse(fs.readFileSync(path.join('content', 'labs', 'coa-incoming-control.yaml'), 'utf8'))
const labelLab: LabelAuditLabData = YAML.parse(fs.readFileSync(path.join('content', 'labs', 'label-claims-audit.yaml'), 'utf8'))

describe('Новые тренажёры: тренд смены, CoA и аудит этикетки', () => {
  it('Разбор смены оценивает попадание в минуту сбоя, причину и корректирующее действие', () => {
    const ok = evaluateShiftTrend(shiftLab, { selectedMin: 35, causeId: 'vacuum-loss', actionId: 'check-seal-interlock' })
    expect(ok.score).toBe(1)
    expect(ok.timeVerdict).toBe('ok')

    const bad = evaluateShiftTrend(shiftLab, { selectedMin: 10, causeId: 'motor-overload', actionId: 'raise-rpm' })
    expect(bad.score).toBe(0)
  })

  it('Входной контроль CoA различает одобрение, карантин и отклонение окисленного масла', () => {
    const ok = evaluateCoaAudit(coaLab, {
      'lot-almond': 'reject',
      'lot-sles': 'approve',
      'lot-xanthan': 'quarantine',
      'lot-phenox': 'quarantine',
    })
    expect(ok.score).toBe(1)

    const partial = evaluateCoaAudit(coaLab, {
      'lot-almond': 'quarantine', // частичный балл 0.5 вместо reject
      'lot-sles': 'approve',
      'lot-xanthan': 'approve', // ошибка
      'lot-phenox': 'approve', // ошибка
    })
    expect(partial.score).toBe(0.375)
  })

  it('Аудит этикетки находит ошибки порядка INCI, аллергена, лечебных клеймов и PAO', () => {
    const expected = labelLab.items.filter((i) => i.hasViolation).map((i) => i.id)
    expect(evaluateLabelAudit(labelLab, expected).score).toBe(1)
    expect(evaluateLabelAudit(labelLab, ['lbl-under1']).score).toBe(0)
  })
})
