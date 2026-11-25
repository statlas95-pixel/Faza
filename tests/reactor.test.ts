import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import {
  addPhaseB,
  addPhaseC,
  evaluateReactorRun,
  evaluateReverseInci,
  initialReactorState,
  stepReactor,
  type ReverseInciLabData,
} from '../shared/reactor-sim'

describe('Иммерсивные тренажёры Спринта 3 — Реактор и Реверс-INCI', () => {
  it('проходит идеальную варку на 100 % при правильной технологии и ловит завоздушивание/перегрев при ошибках', () => {
    // 1. Идеальная варка
    let s = initialReactorState()
    // Нагреваем фазу A с якорной мешалкой до >= 72 °C
    for (let i = 0; i < 7; i++) {
      s = stepReactor(s, { jacket: 'heat', anchorOn: true, homogenizerOn: false, vacuumOn: false }, 2)
    }
    expect(s.tempC).toBeGreaterThanOrEqual(72)
    s = addPhaseB(s)
    // Включаем вакуум и 1 шаг набираем вакуум, потом гомогенизируем 3 шага
    s = stepReactor(s, { jacket: 'off', anchorOn: true, homogenizerOn: false, vacuumOn: true }, 2)
    for (let i = 0; i < 3; i++) {
      s = stepReactor(s, { jacket: 'off', anchorOn: true, homogenizerOn: true, vacuumOn: true }, 2)
    }
    expect(s.dropletUm).toBeLessThanOrEqual(4)
    expect(s.airPct).toBeLessThanOrEqual(3)
    // Охлаждаем с якорной мешалкой без гомогенизатора до <= 38 °C
    for (let i = 0; i < 8; i++) {
      s = stepReactor(s, { jacket: 'cool', anchorOn: true, homogenizerOn: false, vacuumOn: true }, 2)
    }
    expect(s.tempC).toBeLessThanOrEqual(38)
    s = addPhaseC(s)
    s = stepReactor(s, { jacket: 'cool', anchorOn: true, homogenizerOn: false, vacuumOn: true }, 2)
    const evOk = evaluateReactorRun(s)
    expect(evOk.score).toBe(1)

    // 2. Ошибочная варка: фаза B в холодную воду + гомогенизатор без вакуума + фаза C в горячую массу
    let bad = initialReactorState()
    bad = addPhaseB(bad)
    bad = stepReactor(bad, { jacket: 'heat', anchorOn: false, homogenizerOn: true, vacuumOn: false }, 4)
    expect(bad.airPct).toBeGreaterThan(10)
    const evBad = evaluateReactorRun(bad)
    expect(evBad.score).toBeLessThan(0.5)
  })

  it('точно оценивает тренажёр «Реверс-инжиниринг INCI» из content/labs/reverse-inci.yaml', () => {
    const lab = YAML.parse(fs.readFileSync(path.join('content', 'labs', 'reverse-inci.yaml'), 'utf8')) as ReverseInciLabData
    const perfect = evaluateReverseInci(lab, {
      marker: lab.onePercentMarker,
      phases: Object.fromEntries(lab.phaseTargets.map((t) => [t.inci, t.expected])),
      qAnswers: Object.fromEntries(lab.questions.map((q) => [q.id, q.options.find((o) => o.correct)!.id])),
    })
    expect(perfect.score).toBe(1)
    expect(perfect.markerOk).toBe(true)

    const wrong = evaluateReverseInci(lab, {
      marker: 'Aqua',
      phases: {},
      qAnswers: {},
    })
    expect(wrong.score).toBe(0)
  })
})
