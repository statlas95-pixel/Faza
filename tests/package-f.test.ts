import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import {
  computeSpfLabMetrics,
  defaultSpfState,
  evaluatePackCompat,
  evaluateSpfLab,
  evaluateStabilityTriage,
  evaluateWpuAudit,
} from '../shared/package-f-sim'
import { DAILY_CASES } from '../shared/daily-case'
import { evaluateGradeExam, getExamQuestionsForGrade } from '../shared/grade-exam'
import { emptyProgress, mergeProgress } from '../shared/merge'

describe('Пакет F: тренажёры упаковки, SPF 50+, петли WPU, триажа, 24 микро-кейса и аттестация грейда', () => {
  it('оценивает матрицу совместимости упаковки ISO/TR 18811 (packaging-iso18811)', () => {
    const lab = YAML.parse(fs.readFileSync('content/labs/packaging-iso18811.yaml', 'utf8'))
    const okAns = {
      selectedPacks: Object.fromEntries(lab.products.map((p: any) => [p.id, p.correctPackId])),
      quiz: Object.fromEntries(lab.questions.map((q: any) => [q.id, q.options.find((o: any) => o.correct).id])),
    }
    const ev = evaluatePackCompat(lab, okAns)
    expect(ev.score).toBe(1)

    const badEv = evaluatePackCompat(lab, { selectedPacks: { 'citrus-oil': 'ldpe-bottle' }, quiz: {} })
    expect(badEv.score).toBeLessThan(0.3)
  })

  it('рассчитывает спектр 290–400 нм, растворимость кристаллов и фотостабильность SPF 50+ (spf-formulator-lab)', () => {
    const start = computeSpfLabMetrics(defaultSpfState())
    expect(start.photostable).toBe(false)
    expect(start.crystalFree).toBe(false)
    expect(start.inSilicoSpf).toBeLessThan(40)

    const balanced = {
      dhhb: 4.5,
      bemotrizinol: 4.0,
      ethylhexylTriazone: 3.5,
      avobenzone: 0,
      ensulizole: 2.0,
      polarEsterPct: 18,
    }
    const ev = evaluateSpfLab(balanced)
    expect(ev.metrics.inSilicoSpf).toBeGreaterThanOrEqual(50)
    expect(ev.metrics.uvaRatio).toBeGreaterThanOrEqual(0.33)
    expect(ev.metrics.criticalWavelengthNm).toBeGreaterThanOrEqual(370)
    expect(ev.metrics.crystalFree).toBe(true)
    expect(ev.metrics.photostable).toBe(true)
    expect(ev.metrics.regCompliant).toBe(true)
    expect(ev.score).toBe(1)
  })

  it('локализует тупик биоплёнки B. cepacia в петле WPU и валидирует CAPA (wpu-biofilm-hunt)', () => {
    const lab = YAML.parse(fs.readFileSync('content/labs/wpu-biofilm-hunt.yaml', 'utf8'))
    const ev = evaluateWpuAudit(lab, {
      pointId: lab.hotspotPointId,
      condReasonId: lab.conductivityQuestions.find((q: any) => q.correct).id,
      capaIds: lab.capaOptions.filter((c: any) => c.valid).map((c: any) => c.id),
    })
    expect(ev.score).toBe(1)
  })

  it('диагностирует все 4 рекламационных кейса триажа (stability-triage)', () => {
    const lab = YAML.parse(fs.readFileSync('content/labs/stability-triage.yaml', 'utf8'))
    const ans = Object.fromEntries(
      lab.cases.map((c: any) => [
        c.id,
        {
          mechId: c.mechanisms.find((m: any) => m.correct).id,
          fixId: c.fixes.find((f: any) => f.correct).id,
        },
      ]),
    )
    expect(evaluateStabilityTriage(lab, ans).score).toBe(1)
  })

  it('содержит 24 ежедневных микро-кейса и проверяет билет аттестации на грейд + слияние заметок/аттестаций', () => {
    expect(DAILY_CASES).toHaveLength(24)
    const qs = getExamQuestionsForGrade(3)
    expect(qs).toHaveLength(5)
    const rightAns = Object.fromEntries(qs.map((q) => [q.id, q.options.find((o) => o.correct)!.id]))
    const res = evaluateGradeExam(qs, rightAns)
    expect(res.passed).toBe(true)
    expect(res.score).toBe(1)

    const a = emptyProgress()
    const b = emptyProgress()
    a.certifiedGrades['2'] = { level: 2, score: 0.8, at: 100 }
    b.certifiedGrades['2'] = { level: 2, score: 1.0, at: 200 }
    b.notes['topic:sunscreens-spf'] = {
      id: 'topic:sunscreens-spf',
      kind: 'topic',
      targetId: 'sunscreens-spf',
      title: 'SPF',
      text: 'Держать полярные эфиры ≥ 16 %',
      at: 250,
    }
    const merged = mergeProgress(a, b)
    expect(merged.certifiedGrades['2'].score).toBe(1.0)
    expect(merged.notes['topic:sunscreens-spf'].text).toContain('16 %')
  })
})
