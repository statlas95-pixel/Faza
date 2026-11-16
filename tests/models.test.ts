import { describe, it, expect } from 'vitest'
import * as P from '../src/models/physics'
import YAML from 'yaml'
import fs from 'node:fs'

const lab = (id: string) => YAML.parse(fs.readFileSync(`content/labs/${id}.yaml`, 'utf8'))

describe('Стокс', () => {
  it('пример из темы: 5 мкм, Δρ 80, вода → ≈94 мм/сут', () => {
    const v = P.stokesVelocity(80, 5e-6, 1e-3)
    expect(v * 1000 * 86400).toBeCloseTo(94.2, 0)
  })
  it('квадратичная зависимость от диаметра', () => {
    expect(P.stokesVelocity(80, 6e-6, 1) / P.stokesVelocity(80, 2e-6, 1)).toBeCloseTo(9, 6)
  })
  it('ZnO: вязкость для 1 мм/год ≈ 316 Па·с', () => {
    const vMax = 1e-3 / (365 * 86400)
    const eta = (4600 * 9.81 * 4e-12) / (18 * vMax)
    expect(eta).toBeGreaterThan(300); expect(eta).toBeLessThan(330)
  })
})

describe('Стенд стабильности', () => {
  const m = lab('stability-bench').model as P.BenchModel
  const run = (dRho: number, d: number, c: number, phi = 0.15) => P.benchRun(m, { dRho, d_um: d, c, phi })
  it('исходный прототип не проходит', () => {
    const r = run(150, 5, 0.1)
    expect(r.stableOk).toBe(false)
  })
  it('есть несколько разных решений', () => {
    expect(run(150, 3, 0.3).stableOk && run(150, 3, 0.3).sprayOk).toBe(true)
    expect(run(55, 5, 0.3).stableOk && run(55, 5, 0.3).sprayOk).toBe(true)
    expect(run(150, 0.5, 0.2).stableOk && run(150, 0.5, 0.2).sprayOk).toBe(true)
  })
  it('загустить «с запасом» нельзя: 0,5 % не распыляется', () => {
    expect(run(150, 5, 0.5).sprayOk).toBe(false)
  })
  it('центрифуга строже линейного пересчёта для псевдопластичной среды', () => {
    const r = run(150, 5, 0.3)
    expect(r.centrifuge_mm).toBeGreaterThan(r.centrifuge_naive_mm)
  })
  it('Кросс: η(1000) совпадает с таблицей', () => {
    expect(P.crossViscosity(30, 0.013, 1000)).toBeCloseTo(0.013, 4)
  })
})

describe('Масштабирование', () => {
  const p = lab('scale-up-2000').params as P.ScaleParams
  it('окружная скорость лаборатории 12,57 м/с', () => expect(P.tipSpeed(p.lab.D, p.lab.rpm)).toBeCloseTo(12.57, 2))
  it('обороты по критериям', () => {
    expect(P.rpmForCriterion(p, 'tip')).toBeCloseTo(1200, 0)
    expect(P.rpmForCriterion(p, 'weber')).toBeCloseTo(537, 0)
    expect(P.rpmForCriterion(p, 'eps')).toBeCloseTo(2052, 0)
  })
  it('размер капель по учебной модели', () => {
    expect(P.d32AtPlant(p, 1200)).toBeCloseTo(5.71, 1)
    expect(P.d32AtPlant(p, 1500)).toBeCloseTo(4.37, 1)
    expect(P.d32AtPlant(p, 2052)).toBeCloseTo(3.0, 1)
    expect(P.d32ByTip(p, 1200)).toBeCloseTo(3.0, 2)
  })
  it('проходы и тепло', () => {
    expect(P.labPasses(p)).toBeCloseTo(30, 6)
    expect(P.plantPasses(p, 1200, 5)).toBeCloseTo(1.5, 6)
    expect(P.unprocessed(1.5)).toBeCloseTo(0.223, 3)
    expect(P.homogHeat(p, 1500, 20)).toBeCloseTo(4.74, 1)
  })
  it('охлаждение: 61 мин на реакторе, ≈8 мин в лаборатории', () => {
    expect(P.coolingMinutes(2000, 3800, 300, 7, 75, 40, 20)).toBeCloseTo(61, 0)
    expect(P.coolingMinutes(5, 3800, 300, 0.135, 75, 40, 20)).toBeCloseTo(7.9, 0)
    expect(P.coolingMinutes(2000, 3800, 300, 7, 75, 40, 7)).toBeCloseTo(43.6, 0)
  })
})

describe('Реология', () => {
  const samples = lab('rheo-cabinet').samples as (P.HB & { id: string })[]
  it('все образцы дают ≈12 Па·с при 4 с⁻¹', () => {
    for (const s of samples) expect(P.hbViscosity(s, 4)).toBeCloseTo(12, 0)
  })
  it('скорость сдвига в канале дозатора ≈1130 с⁻¹', () => expect(P.pipeWallRate(3e-6, 1.5e-3)).toBeCloseTo(1132, -1))
  it('напряжение в слое 1 мм ≈ 9,8 Па', () => expect(P.filmStress(1000, 1e-3)).toBeCloseTo(9.81, 2))
  it('слой 1 мм не удерживает только образец B', () => {
    expect(samples.filter((s) => s.sy < P.filmStress(1000, 1e-3)).map((s) => s.id)).toEqual(['B'])
  })
  it('самый тугой в дозаторе — A', () => {
    const v = samples.map((s) => [s.id, P.hbViscosity(s, 1132)] as const).sort((a, b) => b[1] - a[1])
    expect(v[0][0]).toBe('A')
  })
})

describe('Солевая кривая', () => {
  const l = lab('salt-batch'), c = l.curve as P.SaltCurve
  const eta = (s: number) => P.saltViscosity(c, s)
  it('исходная партия ≈2800 мПа·с, обычная ≈790', () => {
    expect(eta(l.batch.saltNow)).toBeGreaterThan(2700); expect(eta(l.batch.saltNow)).toBeLessThan(2900)
    expect(eta(l.batch.saltTypical)).toBeGreaterThan(700); expect(eta(l.batch.saltTypical)).toBeLessThan(900)
  })
  it('добавка по ТИ (0,8 %) выводит партию выше нормы', () => expect(eta(l.batch.saltNow + 0.8)).toBeGreaterThan(l.spec.max))
  it('окно нормы слева от пика: +0,30…+0,55 %', () => {
    expect(eta(l.batch.saltNow + 0.30)).toBeLessThan(l.spec.min); expect(eta(l.batch.saltNow + 0.33)).toBeGreaterThan(l.spec.min)
    expect(eta(l.batch.saltNow + 0.55)).toBeLessThan(l.spec.max); expect(eta(l.batch.saltNow + 0.58)).toBeGreaterThan(l.spec.max)
  })
  it('на обычном сырье ТИ работает', () => { const v = eta(l.batch.saltTypical + 0.8); expect(v).toBeGreaterThan(l.spec.min); expect(v).toBeLessThan(l.spec.max) })
  it('расчёт соли из паспортов сходится с заявленным', () => {
    const calc = (l.batch.capbDose * l.batch.capbNaCl + l.batch.slesDose * l.batch.slesNaCl) / 100
    expect(calc).toBeCloseTo(l.batch.saltNow, 1)
  })
  it('разбавление возвращает пересоленную партию в окно слева', () => {
    const v = eta(P.dilutedSalt(l.batch.saltNow + 0.8, 0.2)); expect(v).toBeGreaterThan(l.spec.min); expect(v).toBeLessThan(l.spec.max)
  })
  it('шум детерминирован', () => expect(P.seededNoise(3)).toBe(P.seededNoise(3)))
})

describe('Планирование эксперимента', () => {
  const l = lab('doe-gel'), m = l.model as P.DoeModel
  const run = (A: number, B: number, C: number, y?: number): P.DoeRun => ({ A, B, C, y: y ?? P.doeTrue(m, A, B, C) })
  it('цель достижима только при верхнем уровне загустителя с активом', () => {
    expect(P.doeTrue(m, 1, 1, -1)).toBe(40); expect(P.doeTrue(m, -1, 1, -1)).toBe(26)
    expect(P.doeTrue(m, 1, 1, -1)).toBeGreaterThanOrEqual(l.target.min); expect(P.doeTrue(m, 1, 1, -1)).toBeLessThanOrEqual(l.target.max)
  })
  it('прогноз «по одному фактору» расходится с истиной на удвоенное взаимодействие', () => {
    const base = P.doeTrue(m, -1, -1, -1), ofat = base + (P.doeTrue(m, 1, -1, -1) - base) + (P.doeTrue(m, -1, 1, -1) - base)
    expect(ofat).toBe(60); expect(ofat - P.doeTrue(m, 1, 1, -1)).toBe(-4 * m.ab)
  })
  it('эффекты из полного плана без шума совпадают с моделью', () => {
    const full = [-1, 1].flatMap((A) => [-1, 1].flatMap((B) => [-1, 1].map((C) => run(A, B, C))))
    expect(P.doeMainEffect(full, 'A').value).toBeCloseTo(2 * m.a); expect(P.doeMainEffect(full, 'B').value).toBeCloseTo(2 * m.b)
    expect(P.doeMainEffect(full, 'C').value).toBeCloseTo(0); expect(P.doeInteraction(full).value).toBeCloseTo(2 * m.ab)
    expect(P.doeCells(full).sd).toBeUndefined()
  })
  it('план «по одному» не позволяет оценить взаимодействие', () => {
    const ofat = [run(-1, -1, -1), run(1, -1, -1), run(-1, 1, -1), run(-1, -1, 1)]
    expect(P.doeInteraction(ofat).estimable).toBe(false); expect(P.doeMainEffect(ofat, 'A')).toMatchObject({ estimable: true, pairs: 1 })
    expect(P.doeMainEffect(ofat, 'A').value).toBe(34)
  })
  it('интервал шире при малом числе повторов', () => { expect(P.tCrit(1)).toBeGreaterThan(P.tCrit(3)); expect(P.tCrit(0)).toBe(Infinity); expect(P.tCrit(50)).toBe(2.2) })
  it('пример из темы: 17, 13 и 7', () => {
    const d = [run(-1, -1, -1, 20), run(1, -1, -1, 30), run(-1, 1, -1, 26), run(1, 1, -1, 50)]
    expect(P.doeMainEffect(d, 'A').value).toBe(17); expect(P.doeMainEffect(d, 'B').value).toBe(13); expect(P.doeInteraction(d).value).toBe(7)
  })
  it('повторы дают оценку шума; без повторов её нет', () => {
    const d = [run(1, 1, -1, 39), run(1, 1, -1, 41), run(-1, 1, -1, 26)]
    const c = P.doeCells(d); expect(c.df).toBe(1); expect(c.sd).toBeCloseTo(Math.SQRT2, 6)
    expect(P.doeMainEffect(d, 'A').se).toBeCloseTo(Math.SQRT2 * Math.sqrt(1.5), 6)
  })
})
