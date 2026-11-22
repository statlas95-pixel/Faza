import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'

const numeric = (id: string) => {
  const l = YAML.parse(fs.readFileSync(`content/labs/${id}.yaml`, 'utf8'))
  return l.steps.flatMap((s: any) => s.questions).filter((q: any) => q.type === 'num')
}
function answers(id: string, expected: number[]) {
  const qs = numeric(id)
  expect(qs).toHaveLength(expected.length)
  qs.forEach((q: any, i: number) => expect(Math.abs(q.answer - expected[i]), `${id}: ${q.q}`).toBeLessThanOrEqual((q.tol ?? 0.05) * Math.abs(expected[i])))
}

describe('Независимый пересчёт числовых ответов занятий', () => {
  it('перенос новых моделей: другое k и другой перепад давления', () => {
    const load = (id: string) => YAML.parse(fs.readFileSync(`content/labs/${id}.yaml`, 'utf8'))
    expect(load('dissolution-sheet').transfer.questions[0].answer).toBeCloseTo(-Math.log(0.1) / 0.05, 1)
    expect(load('deaeration-sheet').transfer.questions[0].answer).toBe(100 / 50)
  })
  it('растворение: начальная скорость, экспоненциальное приближение и изменение k', () => {
    answers('dissolution-sheet', [0.1 * 100, -Math.log(0.1) / 0.1, 0.1 * (100 - 90), -Math.log(0.1) / 0.2])
  })
  it('деаэрация: абсолютное и парциальное давление, пузырёк и доля газа', () => {
    answers('deaeration-sheet', [100 - 80, 100 / 20, 0.95 + 0.05 * 100 / 20, 100 * (20 - 7.4) / (100 - 7.4), 100 * (1 - 0.969 / 1.020)])
  })
  it('растворы: масса вещества, моногидрат и баланс товарных ПАВ', () => {
    const mono = 20 * 0.1 * 210.14 / 192.12
    answers('solutions-sheet', [mono, 20 - mono, 30 * 0.1 / 0.5, 100 * (6 * 1.52 * 0.5) / (6 * 1.52 + 24), 800 * 0.09 / 0.7, 800 * 0.09 / 0.7 - 72 + 800 * 0.03 / 0.3 - 24])
  })
  it('pH и буфер: соотношение форм и максимум буферной ёмкости', () => {
    answers('ph-sheet', [3.86 + Math.log10(2), 10 ** (4.5 - 3.86), Math.log(10) * 0.1 / 4])
  })
  it('ККМ: наклон изотермы, Гиббс и площадь молекулы', () => {
    const slope = (56 - 36) / (Math.log10(1) - Math.log10(0.1))
    const gamma = slope / 1000 / (Math.log(10) * 8.314 * 298.15)
    answers('cmc-sheet', [1, slope, gamma * 1e6, 1e18 / (6.022e23 * gamma)])
  })
  it('ДЛФО: ионная сила, дебаевская длина и валентность противоиона', () => {
    answers('dlvo-sheet', [0.304 / Math.sqrt(0.001), 0.5 * (0.01 * 4 + 0.02), 0.304 / Math.sqrt(0.15), 2 ** 6])
  })
  it('шланг: скорость, ламинарный Re и перепад давления в бар', () => {
    const Q = 2 / 3600, d = 0.05, v = Q / (Math.PI * d * d / 4)
    answers('pump-sheet', [v, 1000 * v * d / 10, 128 * 10 * 10 * Q / (Math.PI * d ** 4) / 1e5, (0.065 / d) ** 4])
  })
  it('рубашка: сумма сопротивлений, доля продукта и тепловой поток', () => {
    const wall = 0.006 / 16, total = 1 / 150 + wall + 1 / 2000
    answers('jacket-sheet', [1 / total, 100 / 150 / total, 4 * 40 / total / 1000, 1 / (1 / 150 + wall + 1 / 3000), 1 / (1 / 600 + wall + 1 / 2000)])
  })
  it('мешалки: обороты переведены в с⁻¹, мощность в кВт', () => {
    answers('mixing-sheet', [1000 * 2 * 0.4 ** 2 / 0.001, 1000 * 2 * 0.4 ** 2 / 40, 1000 * 0.5 * 1.14 ** 2 / 40, 300 * 40 * 0.5 ** 2 * 1.14 ** 3 / 1000, 60 * Math.sqrt(5500 / (300 * 80 * 1.14 ** 3))])
  })
})

describe('Расчёт и перенос для новых тем карты', () => {
  const cases: [string, number, number][] = [
    ['ionic-strength', (0.020 * 4 + 0.040) / 2, (0.010 * 4 + 0.020) / 2],
    ['micellar-solubility', 0.80 - 0.20, (0.80 - 0.20) * 0.50],
    ['oil-oxidation', 9 - 3, (9 - 3) - (5 - 3)],
    ['ingredient-documents', 2 / 0.25, 2 / 0.50],
    ['powder-wetting', 100 * 1.2 / 10, 100 * 0.4 / 10],
    ['surface-adsorption', (10 - 4) * 1 / 2, 3 * 2],
    ['foam-control', 100 * 40 / 80, 100 * 20 / 80],
    ['particle-sizing', 100 * 40 / 200, 100 * (200 - 40) / 200],
    ['emulsifier-selection', 0.4 * 4 + 0.6 * 14, 100 * (11 - 5) / (15 - 5)],
    ['cleanser-mildness', 10 * 0.30, 3 / 0.50],
    ['polymer-thickeners', 100 * 1.5 / 500, 100_000 * 1.5 / 500],
    ['fractional-design', 2 ** 3 / 2, 20 - 18],
    ['water-sanitation', 100 * 16 / 20, 100 * 4 / 8],
    ['pump-selection', (30 - 5) / (0.5 + 0.75), (30 - 17.5) / (0.5 + 0.75)],
    ['porous-flow', 1000 * 1e-12 * 20000 / (0.001 * 0.01), 1000 * 1e-12 * 20000 / (0.001 * 0.02)],
    ['impeller-geometry', 0.60 / 1.5, 2 * 0.60 / 1.5],
    ['fat-melting', 2 * (2 * 20 + 80), 3 * (2 * 20 + 80)],
    ['flow-exchangers', 0.20 * 3 * 20, 12 / (4 * 5)],
    ['filtration', 5 / (0.5 * 10 / 60), 2.5 / (0.5 * 10 / 60)],
    ['cip-verification', 100 * 9 / 10, 8 - 7],
  ]
  it.each(cases)('%s', (id, initial, transferred) => {
    const lab = YAML.parse(fs.readFileSync(`content/labs/${id}-sheet.yaml`, 'utf8'))
    expect(lab.steps[0].questions[0].answer).toBeCloseTo(initial, 6)
    expect(lab.transfer.questions[0].answer).toBeCloseTo(transferred, 6)
  })
})

describe('Числовые ключи переноса и входной диагностики', () => {
  const surfaceExcess = 0.030 / (Math.log(10) * 2 * 8.314 * 298.15)
  const jacketResistance = 1 / 300 + 0.008 / 16 + 1 / 2500
  const hoseFlow = 1 / 3600
  const examples: [string, number[]][] = [
    ['batch-6102', [100 / (1 + 10 ** (4.5 - 4.2)), 100 / (1 + 10 ** (5.5 - 4.2))]],
    ['cmc-sheet', [surfaceExcess * 1e6, 1e18 / (6.022e23 * surfaceExcess)]],
    ['dlvo-sheet', [0.5 * 2 * 0.05 * 2 ** 2, 0.304 / Math.sqrt(0.20)]],
    ['doe-gel', [((30 - 20) + (50 - 26)) / 2, ((50 - 26) - (30 - 20)) / 2, 20 + (30 - 20) + (26 - 20)]],
    ['jacket-sheet', [1 / jacketResistance, 100 / 300 / jacketResistance]],
    ['mixing-sheet', [1000 * (180 / 60) * 0.25 ** 2 / 5, 2 ** 2]],
    ['ph-sheet', [10 ** (5 - 4.76), 100 / (1 + 10 ** (4.76 - 4.76))]],
    ['pump-sheet', [128 * 5 * 20 * hoseFlow / (Math.PI * 0.04 ** 4) / 1e5, 4 * 1000 * hoseFlow / (Math.PI * 0.04 * 5)]],
    ['rheo-cabinet', [1000 * 9.81 * 0.0005, (8 + 12 * 500 ** 0.45) / 500]],
    ['salt-batch', [2400 * 0.006, 100 * (2400 * 0.0075 + 14.4) / 2400]],
    ['scale-up-2000', [6000 * 40 / 120, 5 * 500 / 250, 8 * Math.cbrt(500 / 5)]],
    ['solutions-sheet', [500 * 0.08 / 0.27, 10 * 0.20 / 0.50, 5 * 210.14 / 192.12]],
    ['stability-bench', [(2 / 0.2) ** 2, 4600 * 9.81 * (2e-6) ** 2 / (18 * (0.001 / (365 * 86400)))]],
  ]
  it.each(examples)('перенос в %s', (id, predictions) => {
    const lab = YAML.parse(fs.readFileSync(`content/labs/${id}.yaml`, 'utf8'))
    const quiz = lab.transferQuiz ?? lab.transfer
    const questions = quiz.questions.filter((q: { type: string }) => q.type === 'num')
    expect(questions).toHaveLength(predictions.length)
    predictions.forEach((value, i) => expect(Math.abs(questions[i].answer - value), questions[i].q).toBeLessThanOrEqual(0.01 * Math.abs(value)))
  })

  it('пристенный сдвиг при заданном расходе и радиусе канала', () => {
    const lab = YAML.parse(fs.readFileSync('content/labs/rheo-cabinet.yaml', 'utf8'))
    expect(lab.rateQuestion.answer).toBeCloseTo(4 * (1.5e-6 / 0.5) / (Math.PI * 0.0015 ** 3), 0)
  })

  it('каждый числовой диагностический вопрос пересчитан по его исходным данным', () => {
    const expected: Record<string, number> = {
      'd-rheo-calc': 1000 * 9.81 * 0.002,
      'd-scale': 6000 * 50 / 250,
      'd-sol': 20 * 0.1 / 0.5,
      'g-area': 1 / 0.5,
      'g-dilution': 20 * 0.1 / 0.5,
      's-fraction': 100 * 0.10,
      'e-scale': 6000 * 50 / 250,
      'e-ionic-calc': 0.5 * (0.01 * 4 + 0.02),
      'e-bubble-calc': 100 / 20,
    }
    const bank = YAML.parse(fs.readFileSync('content/diagnostic.yaml', 'utf8'))
    const numeric = bank.filter((q: { answer?: number }) => typeof q.answer === 'number')
    expect(numeric.map((q: { id: string }) => q.id).sort()).toEqual(Object.keys(expected).sort())
    for (const question of numeric) expect(question.answer, question.id).toBeCloseTo(expected[question.id], 1)
  })
})
