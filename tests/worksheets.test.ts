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
