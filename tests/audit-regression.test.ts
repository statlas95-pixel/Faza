import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { evaluateFormula, type FormulaInput, type Ingredient } from '../shared/formulation'
import { simulateAcceleratedStability } from '../shared/formulation-lab3'
import { computeSurfactantProfile, computeUnitEconomics } from '../shared/formulation-lab4'
import { analyzeSpfAndPigments } from '../shared/formulation-lab5'
import { analyzePolarizedMicroscopy, deriveRheologyModel } from '../shared/formulation-lab6'
import { computeSpfLabMetrics } from '../shared/package-f-sim'
import { hbViscosity, tCrit } from '../src/models/physics'

const catalog: Ingredient[] = YAML.parse(
  fs.readFileSync(path.resolve('content/ingredients.yaml'), 'utf8'),
)
const catalogIds = new Set(catalog.map((i) => i.id))

describe('Пакет 0.1 — Регрессии научно-математического аудита (P0 + P1)', () => {
  it('не содержит «фантомных» ID ингредиентов в shared/formulation-lab6.ts и shared/campaigns.ts', () => {
    for (const file of ['shared/formulation-lab6.ts', 'shared/campaigns.ts']) {
      const src = fs.readFileSync(path.resolve(file), 'utf8')
      const matches = [...src.matchAll(/pctOf\('([a-z0-9-]+)'\)/g)].map((m) => m[1])
      expect(matches.length).toBeGreaterThan(0)
      for (const id of matches) {
        expect(catalogIds.has(id), `Missing ingredient ID "${id}" referenced in ${file}`).toBe(true)
      }
    }
  })

  it('не выдаёт ложную ошибку HLB для безводных бальзамов, BTAC-кондиционеров и исключает ZnO/TiO2 из жидкого reqHLB', () => {
    const balm: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 25, B: 82, C: 40 },
      rows: [
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 69.5 },
        { ingredientId: 'shea-butter', phase: 'B', pct: 20.0 },
        { ingredientId: 'beeswax', phase: 'B', pct: 10.0 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.5 },
      ],
    }
    const evBalm = evaluateFormula(balm, catalog)
    expect(evBalm.issues.some((i) => i.code === 'hlb:no-emulsifier')).toBe(false)
    expect(evBalm.errorsCount).toBe(0)

    const btacMask: FormulaInput = {
      productType: 'rinse-off',
      productZone: 'hair',
      targetPh: 4.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 86.2 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 6.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 5.0 },
        { ingredientId: 'behentrimonium-chloride', phase: 'B', pct: 2.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const evMask = evaluateFormula(btacMask, catalog)
    expect(evMask.issues.some((i) => i.code === 'hlb:no-emulsifier')).toBe(false)
    // Катионный бальзам не классифицируется как мицеллярный очиститель
    expect(computeSurfactantProfile(evMask)).toBeNull()

    // Твёрдые ZnO/TiO2 не искажают требуемый ГЛБ масляной фазы (10% CCT reqHLB = 5.0)
    const mineralSpf: FormulaInput = {
      productType: 'leave-on',
      targetPh: 6.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 69.2 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 10.0 },
        { ingredientId: 'zinc-oxide', phase: 'B', pct: 15.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    expect(evaluateFormula(mineralSpf, catalog).requiredHlb).toBe(5)
  })

  it('ловит электролитный коллапс SLES + Carbomer и не загущает солью бессульфатный Coco-Glucoside', () => {
    const slesCarb: FormulaInput = {
      productType: 'rinse-off',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 88.7 },
        { ingredientId: 'sles', phase: 'A', pct: 10.0 },
        { ingredientId: 'carbomer', phase: 'A', pct: 0.5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const ev = evaluateFormula(slesCarb, catalog)
    expect(ev.issues.some((i) => i.code === 'conflict:carbomer-electrolyte' && i.severity === 'error')).toBe(true)

    const glucosideGel: FormulaInput = {
      productType: 'rinse-off',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 87.2 },
        { ingredientId: 'coco-glucoside', phase: 'A', pct: 10.0 },
        { ingredientId: 'sodium-chloride', phase: 'A', pct: 2.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const rheo = deriveRheologyModel(evaluateFormula(glucosideGel, catalog), glucosideGel)
    expect(rheo.consistencyK).toBeLessThan(1.5)
    expect(rheo.notes.some((n) => /глюкозид|Sulfate-free/i.test(n))).toBe(true)
  })

  it('применяет зональные лимиты EU 2024/996, Homosalate (EU 2022/2195), CTAC+BTAC и запрет ZnO в спреях', () => {
    const bodyRetinol: FormulaInput = {
      productType: 'leave-on',
      productZone: 'body',
      targetPh: 5.8,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 94.0 },
        { ingredientId: 'retinol', phase: 'C', pct: 0.2 },
        { ingredientId: 'homosalate', phase: 'B', pct: 5.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const evBody = evaluateFormula(bodyRetinol, catalog)
    expect(evBody.issues.some((i) => i.code === 'reg:retinol' && i.severity === 'error')).toBe(true)
    expect(evBody.issues.some((i) => i.code === 'reg:homosalate' && i.severity === 'error')).toBe(true)

    const faceRetinol = evaluateFormula({ ...bodyRetinol, productZone: 'face' }, catalog)
    expect(faceRetinol.issues.some((i) => i.code === 'reg:retinol')).toBe(false)
    expect(faceRetinol.issues.some((i) => i.code === 'reg:homosalate')).toBe(false)

    const sprayZno = evaluateFormula({
      productType: 'leave-on',
      productZone: 'spray',
      targetPh: 6.5,
      batchGrams: 100,
      phaseTempC: { A: 25, B: 25, C: 25 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 89.2 },
        { ingredientId: 'zinc-oxide', phase: 'B', pct: 10.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }, catalog)
    expect(sprayZno.issues.some((i) => i.code === 'reg:mineral-spray' && i.severity === 'error')).toBe(true)
  })

  it('согласует Disteardimonium Hectorite в Lab 3, точную формулу COGS, фотодеградацию SPF, Pentylene Glycol с BHA и физику', () => {
    // 1. W/O ZnO + Disteardimonium Hectorite проходит центрифугу Lab 3 без жалобы на ксантан
    const woSpf: FormulaInput = {
      productType: 'leave-on',
      targetPh: 6.0,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 55.2 },
        { ingredientId: 'magnesium-sulfate', phase: 'A', pct: 0.8 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 20.0 },
        { ingredientId: 'zinc-oxide', phase: 'B', pct: 15.0 },
        { ingredientId: 'cetyl-peg-ppg-dimethicone', phase: 'B', pct: 4.0 },
        { ingredientId: 'beeswax', phase: 'B', pct: 3.0 },
        { ingredientId: 'disteardimonium-hectorite', phase: 'B', pct: 1.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const evWo = evaluateFormula(woSpf, catalog)
    const stWo = simulateAcceleratedStability(evWo, woSpf)
    expect(stWo.find((t) => t.id === 'centrifuge')?.verdict).toBe('pass')

    // 2. Точный делитель потерь COGS: при 20% потерь bulk = raw / 0.8 = 1.25 * raw
    const econ = computeUnitEconomics(evWo, 1000, { unitGrams: 100, lossPct: 20, packagingRub: 0, labelRub: 0, laborRub: 0 })
    expect(econ.bulkCostPerUnit).toBeCloseTo(econ.rawCostPerUnit / 0.8, 1)

    // 3. Pentylene Glycol (6%) удерживает 2% Salicylic Acid в растворе (нет ложных кристаллов)
    const bhaToner: FormulaInput = {
      productType: 'leave-on',
      targetPh: 3.8,
      batchGrams: 100,
      phaseTempC: { A: 35, B: 35, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 91.2 },
        { ingredientId: 'pentylene-glycol', phase: 'A', pct: 6.0 },
        { ingredientId: 'salicylic-acid', phase: 'C', pct: 2.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    expect(analyzePolarizedMicroscopy(evaluateFormula(bhaToner, catalog), bhaToner).hasCrystals).toBe(false)

    // 4. Lab 5 штрафует нестабилизированный Avobenzone + Octinoxate, а package-f отделяет 22% сенсорику от regCompliant
    const unstabSpf: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 100,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 74.2 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 10.0 },
        { ingredientId: 'avobenzone', phase: 'B', pct: 3.0 },
        { ingredientId: 'octinoxate', phase: 'B', pct: 7.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const stabSpf: FormulaInput = {
      ...unstabSpf,
      rows: [...unstabSpf.rows, { ingredientId: 'tinosorb-s', phase: 'B', pct: 2.0 }],
    }
    const rUnstab = analyzeSpfAndPigments(evaluateFormula(unstabSpf, catalog), unstabSpf)!
    const rStab = analyzeSpfAndPigments(evaluateFormula(stabSpf, catalog), stabSpf)!
    expect(rStab.estimatedUvaPf).toBeGreaterThan(rUnstab.estimatedUvaPf * 1.5)

    // 23% total filters within individual Annex VI caps -> legally compliant, sensory warning only
    const heavyLegal = computeSpfLabMetrics({ dhhb: 8, bemotrizinol: 8, ethylhexylTriazone: 4, avobenzone: 0, ensulizole: 3, polarEsterPct: 30 })
    expect(heavyLegal.regCompliant).toBe(true)
    expect(heavyLegal.warnings.some((w) => /22/.test(w))).toBe(true)

    // 5. physics.ts guards
    expect(Number.isFinite(hbViscosity({ sy: 10, K: 5, n: 0.5 }, 0))).toBe(true)
    expect(tCrit(50)).toBe(1.96)
  })
})
