import { useEffect, useMemo, useRef } from 'react'
import { tr } from '../../shared/locale'
import {
  diffCardUpgrades,
  evaluateScientistDeck,
  tierLabel,
  type CardTier,
  type ModuleDeckInput,
} from '../../shared/scientist-cards'
import { curriculum, skills, useLearning } from '../learning'
import { useProgress } from '../store'
import { showToast } from './Toast'

export function buildModuleDeckInputs(): ModuleDeckInput[] {
  const out: ModuleDeckInput[] = []
  for (const sec of curriculum.sections) {
    for (const mod of sec.modules) {
      const topicIds = mod.topics.map((t) => t.id)
      const modSkills = skills.filter((sk) => sk.topics.some((tid) => topicIds.includes(tid)))
      const skillIds = modSkills.map((sk) => sk.id)
      const labIds = [...new Set(modSkills.flatMap((sk) => sk.labs))]
      out.push({ id: mod.id, topicIds, skillIds, labIds })
    }
  }
  return out
}

const MODULE_DECK_INPUTS = buildModuleDeckInputs()

export function useScientistCards() {
  const progress = useProgress()
  const learning = useLearning()
  return useMemo(
    () => evaluateScientistDeck(progress, learning.states, MODULE_DECK_INPUTS),
    [progress, learning.states],
  )
}

/** Фоновый наблюдатель: деликатно оповещает при открытии или повышении ранга карточки учёного. */
export function CardUnlockWatcher() {
  const progress = useProgress()
  const cards = useScientistCards()
  const prevTiers = useRef<Record<string, CardTier> | null>(null)

  useEffect(() => {
    const curMap = Object.fromEntries(cards.map((c) => [c.def.id, c.tier])) as Record<string, CardTier>
    if (prevTiers.current === null) {
      prevTiers.current = curMap
      return
    }
    const upgrades = diffCardUpgrades(prevTiers.current, cards)
    prevTiers.current = curMap
    if (progress.settings.cardToasts === false || upgrades.length === 0) return

    const top = upgrades[0]
    const label = tierLabel(top.tier)
    const msg =
      top.tier === 'common'
        ? `✦ ${tr('Открыта карточка учёного:')} ${top.def.name} (${label})`
        : `✦ ${tr('Ранг карточки повышен:')} ${top.def.name} → ${label}`
    showToast(msg)
  }, [cards, progress.settings.cardToasts])

  return null
}
