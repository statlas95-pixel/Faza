import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { FLASHCARDS, FLASHCARD_DECKS, getDueFlashcards, reviewCardSM2 } from '../shared/flashcards'
import { generateFormulaDefense } from '../shared/formula-defense'
import { buildActivityHeatmap } from '../shared/activity-heatmap'
import { evaluateFormula, type FormulaInput, type Ingredient } from '../shared/formulation'
import { emptyProgress, mergeProgress } from '../shared/merge'

const catalog = YAML.parse(fs.readFileSync('content/ingredients.yaml', 'utf8')) as Ingredient[]

describe('Пакет S: 120 SM-2 флеш-карт, QA-защита рецептуры и 12-недельный heatmap', () => {
  it('содержит ровно 120 уникальных двуязычных карточек (по 30 в 4 колодах) без кириллицы в EN', () => {
    expect(FLASHCARDS).toHaveLength(120)
    const ids = new Set(FLASHCARDS.map((c) => c.id))
    expect(ids.size).toBe(120)
    for (const d of FLASHCARD_DECKS) {
      expect(FLASHCARDS.filter((c) => c.deck === d.id)).toHaveLength(30)
    }
    for (const c of FLASHCARDS) {
      expect(c.frontRu.trim().length).toBeGreaterThan(3)
      expect(c.backRu.trim().length).toBeGreaterThan(3)
      expect(/[а-яё]/i.test(c.frontEn), `Cyrillic in frontEn of ${c.id}`).toBe(false)
      expect(/[а-яё]/i.test(c.backEn), `Cyrillic in backEn of ${c.id}`).toBe(false)
    }
  })

  it('корректно планирует интервалы SM-2 и фильтрует карточки к повторению', () => {
    const now = 1_700_000_000_000
    const r1 = reviewCardSM2(undefined, 4, now)
    expect(r1.reps).toBe(1)
    expect(r1.intervalDays).toBe(1)
    const r2 = reviewCardSM2(r1, 4, now + 86400000)
    expect(r2.reps).toBe(2)
    expect(r2.intervalDays).toBe(6)
    const r3 = reviewCardSM2(r2, 5, now + 7 * 86400000)
    expect(r3.reps).toBe(3)
    expect(r3.intervalDays).toBeGreaterThanOrEqual(14)
    const reset = reviewCardSM2(r3, 0, now + 20 * 86400000)
    expect(reset.reps).toBe(0)
    expect(reset.intervalDays).toBe(1)

    const due = getDueFlashcards({ [FLASHCARDS[0].id]: r2 }, 'all', now + 86400000)
    expect(due.some((c) => c.id === FLASHCARDS[0].id)).toBe(false)
  })

  it('генерирует 3 сократовских вопроса QA-защиты с ровно 1 верным ответом под реальную формулу', () => {
    const f: FormulaInput = {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 80 },
        { ingredientId: 'carbomer', phase: 'A', pct: 0.4 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 12 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 5 },
        { ingredientId: 'glycerin', phase: 'A', pct: 1.8 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    }
    const ev = evaluateFormula(f, catalog)
    const qs = generateFormulaDefense(f, ev, catalog)
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      expect(q.options.filter((o) => o.correct)).toHaveLength(1)
    }
  })

  it('строит 84-дневный (12 недель) heatmap и сливает flashcards в mergeProgress', () => {
    const now = Date.now()
    const a = emptyProgress()
    a.visited['raw-functions'] = now - 86400000
    a.flashcards['inci-1'] = { reps: 1, intervalDays: 1, ease: 2.5, dueAt: now + 86400000, lastAt: now }
    const b = emptyProgress()
    b.flashcards['inci-1'] = { reps: 2, intervalDays: 6, ease: 2.6, dueAt: now + 6 * 86400000, lastAt: now + 1000 }

    const merged = mergeProgress(a, b)
    expect(merged.flashcards['inci-1'].reps).toBe(2)

    const hm = buildActivityHeatmap(merged, now)
    expect(hm.days).toHaveLength(84)
    expect(hm.weeks).toHaveLength(12)
    expect(hm.activeDays).toBeGreaterThanOrEqual(2)
  })
})
