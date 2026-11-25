import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { evaluateBranchPath, validateBranchingLab, type BranchingLabData } from '../shared/branching'

const scaleupLab: BranchingLabData = YAML.parse(
  fs.readFileSync(path.join('content', 'labs', 'scaleup-troubleshooting.yaml'), 'utf8'),
)
const cloudingLab: BranchingLabData = YAML.parse(
  fs.readFileSync(path.join('content', 'labs', 'aqueous-clouding-branch.yaml'), 'utf8'),
)

describe('Ветвящийся симулятор брака и масштабирования', () => {
  it('оба ветвящихся кейса проходят строгую валидацию графа без циклов и битых ссылок', () => {
    expect(validateBranchingLab(scaleupLab)).toEqual([])
    expect(validateBranchingLab(cloudingLab)).toEqual([])
  })

  it('отклоняет граф с циклом или битой ссылкой next', () => {
    const cyclic = {
      start: 'a',
      nodes: [
        { id: 'a', title: 'A', scene: 's', choices: [{ id: 'c1', label: 'go', verdict: 'ok', consequence: 'x', next: 'b' }] },
        { id: 'b', title: 'B', scene: 's', choices: [{ id: 'c2', label: 'back', verdict: 'wrong', consequence: 'y', next: 'a' }] },
        { id: 'c', title: 'C', scene: 's', outcome: { verdict: 'ok', score: 1, title: 'ok', summary: 's', lesson: 'l' } },
      ],
    }
    expect(validateBranchingLab(cyclic).some((e) => e.includes('цикл'))).toBe(true)
  })

  it('оптимальная ветка масштабирования 500 г -> 500 кг даёт 100 %, а ранний высокий сдвиг — брак', () => {
    const ok = evaluateBranchPath(scaleupLab, [
      { nodeId: 'load-phase-b', choiceId: 'under-surface-vacuum' },
      { nodeId: 'shear-at-cooling', choiceId: 'no-late-shear' },
      { nodeId: 'cooling-and-phase-c', choiceId: 'controlled-cool-wait' },
    ])
    expect(ok.finished).toBe(true)
    expect(ok.score).toBe(1)
    expect(ok.verdict).toBe('ok')

    const fail = evaluateBranchPath(scaleupLab, [
      { nodeId: 'load-phase-b', choiceId: 'under-surface-vacuum' },
      { nodeId: 'shear-at-cooling', choiceId: 'run-late-homog' },
    ])
    expect(fail.finished).toBe(true)
    expect(fail.score).toBeLessThan(0.4)
    expect(fail.verdict).toBe('wrong')
  })

  it('ветвящийся кейс помутнения водной системы оценивает верное решение и пересол', () => {
    const ok = evaluateBranchPath(cloudingLab, [
      { nodeId: 'cloud-check', choiceId: 'premix-solubilizer' },
      { nodeId: 'viscosity-drop', choiceId: 'dilute-with-saltfree-base' },
    ])
    expect(ok.finished).toBe(true)
    expect(ok.score).toBe(1)

    const carbFail = evaluateBranchPath(cloudingLab, [
      { nodeId: 'cloud-check', choiceId: 'premix-solubilizer' },
      { nodeId: 'viscosity-drop', choiceId: 'add-carbomer-to-salty' },
    ])
    expect(carbFail.finished).toBe(true)
    expect(carbFail.score).toBeLessThan(0.4)
  })
})
