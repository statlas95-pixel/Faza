import { tr } from './locale'
import type { Progress } from './merge'
import type { SkillState } from './mastery'

export type CardTier = 'locked' | 'common' | 'rare' | 'epic' | 'legendary'

export interface ScientistCardDef {
  id: string
  name: string
  era: string
  discipline: string
  moduleId?: string
  special?: 'campaign' | 'lab-formulas' | 'night-shift'
  equation: string
  contribution: string
  unlockHint: string
  accent: 'sky' | 'coral' | 'emerald' | 'amber' | 'violet'
}

export interface ScientistCardState {
  def: ScientistCardDef
  tier: CardTier
  tierIndex: number
  progressPct: number
  nextHint: string
}

export const TIER_ORDER: CardTier[] = ['locked', 'common', 'rare', 'epic', 'legendary']

export function tierLabel(tier: CardTier): string {
  switch (tier) {
    case 'common': return tr('Базовая')
    case 'rare': return tr('Редкая')
    case 'epic': return tr('Эпическая')
    case 'legendary': return tr('Легендарная')
    default: return tr('Не открыта')
  }
}

export function getScientistDeck(): ScientistCardDef[] {
  return [
    // 15 модулей Карты знаний
    {
      id: 'mendeleev',
      name: tr('Дмитрий Менделеев'),
      era: '1834–1907',
      discipline: tr('Сырьё и водные растворы'),
      moduleId: 'chem-raw',
      equation: 'm₁ · w₁ = m₂ · w₂',
      contribution: tr('Создатель периодического закона и гидратной теории растворов: фундамент расчётов концентраций, ионной силы и контроля чистоты сырья.'),
      unlockHint: tr('Изучите темы модуля «Сырьё и водные растворы» и выполните практикум по растворам / CoA.'),
      accent: 'sky',
    },
    {
      id: 'gibbs',
      name: tr('Джозайя Уиллард Гиббс'),
      era: '1839–1903',
      discipline: tr('Коллоидная и поверхностная химия'),
      moduleId: 'chem-colloid',
      equation: 'Γ = −(1 / RT) · (dγ / d ln c)',
      contribution: tr('Уравнение адсорбции Гиббса и термодинамика межфазных границ объясняют работу ПАВ, поверхностное натяжение и энергию дисперсий.'),
      unlockHint: tr('Освойте модуль «Основы коллоидной и поверхностной химии» и пройдите расчёт ККМ / адсорбции.'),
      accent: 'coral',
    },
    {
      id: 'mcbain',
      name: tr('Джеймс Уильям Макбейн'),
      era: '1882–1953',
      discipline: tr('ПАВ-системы и мицеллы'),
      moduleId: 'chem-surf',
      equation: 'c > CMC → [Surfactant]ₙ',
      contribution: tr('Ввёл понятие мицелл и объяснил скачкообразный рост солюбилизации и вязкости в растворах ПАВ (солевая кривая SLES/CAPB).'),
      unlockHint: tr('Пройдите темы модуля «ПАВ-системы» и тренажёр солевой кривой.'),
      accent: 'sky',
    },
    {
      id: 'griffin',
      name: tr('Уильям К. Гриффин'),
      era: '1914–2009',
      discipline: tr('Эмульсии и система ГЛБ'),
      moduleId: 'chem-disp',
      equation: 'HLB = 20 · (Mₕ / M)',
      contribution: tr('Разработал классическую шкалу ГЛБ (1949) для подбора пар эмульгаторов O/W и W/O под полярность масляной фазы.'),
      unlockHint: tr('Освойте модуль «Дисперсные системы и эмульсии» и расследуйте кейс ламеллярной партии.'),
      accent: 'amber',
    },
    {
      id: 'bingham',
      name: tr('Юджин Кук Бингам'),
      era: '1878–1945',
      discipline: tr('Реология и предел текучести'),
      moduleId: 'chem-rheo',
      equation: 'τ = τ₀ + ηₚ · γ̇',
      contribution: tr('Отец современной реологии: описал пластичное течение с пределом текучести, удерживающим пигменты и капли крема от оседания.'),
      unlockHint: tr('Пройдите модуль «Полимеры и реология» и реологический кабинет / титрование карбомера.'),
      accent: 'violet',
    },
    {
      id: 'arrhenius',
      name: tr('Сванте Аррениус'),
      era: '1859–1927',
      discipline: tr('Стабильность и кинетика старения'),
      moduleId: 'chem-stab',
      equation: 'k = A · exp(−Eₐ / RT)',
      contribution: tr('Уравнение Аррениуса лежит в основе ускоренного термического старения косметики (45 °C) и прогноза сроков годности активов.'),
      unlockHint: tr('Изучите модуль «Стабильность и эксперимент» и выполните стенд стабильности / DoE.'),
      accent: 'coral',
    },
    {
      id: 'pasteur',
      name: tr('Луи Пастер'),
      era: '1822–1895',
      discipline: tr('Микробиология и консервирование'),
      moduleId: 'chem-micro',
      equation: 'f(HA) = 1 / (1 + 10^(pH − pKₐ))',
      contribution: tr('Основатель микробиологии и асептики: доказал роль контаминации и заложил научную основу санитарии WPU и Challenge-тестов ISO 11930.'),
      unlockHint: tr('Пройдите модуль «Консервирование и микробиологическая чистота» и кейс ISO 11930 / WPU.'),
      accent: 'emerald',
    },
    {
      id: 'derjaguin',
      name: tr('Борис Дерягин'),
      era: '1902–1994',
      discipline: tr('Тонкие плёнки, SPF и активы'),
      moduleId: 'chem-applied',
      equation: 'V(h) = V_el(h) + V_vdW(h)',
      contribution: tr('Соавтор теории ДЛФО и открыватель расклинивающего давления тонких плёнок — ключа к стойкости суспензий УФ-фильтров и сложных систем.'),
      unlockHint: tr('Освойте модуль «Прикладные категории и упаковка» и симуляторы SPF / совместимости тары.'),
      accent: 'sky',
    },
    {
      id: 'young',
      name: tr('Томас Юнг'),
      era: '1773–1829',
      discipline: tr('Декоративная косметика, смачивание и оптика'),
      moduleId: 'chem-color',
      equation: 'cos θ = (γₛᵥ − γₛₗ) / γₗᵥ',
      contribution: tr('Автор уравнения смачивания Юнга и теории оптики цвета: фундамент диспергирования минеральных пигментов, маслоёмкости и подбора тона.'),
      unlockHint: tr('Изучите модуль «Декоративная косметика, стики и отдушки» и триаж стабильности.'),
      accent: 'coral',
    },
    {
      id: 'reynolds',
      name: tr('Осборн Рейнольдс'),
      era: '1842–1912',
      discipline: tr('Гидравлика и перекачка сред'),
      moduleId: 'proc-flow',
      equation: 'Re = ρ · v · d / μ',
      contribution: tr('Ввёл критерий Рейнольдса, разделяющий ламинарное и турбулентное течение при перекачке кремов, расчёте насосов и промывке CIP.'),
      unlockHint: tr('Пройдите модуль «Основы ПАХТ: гидравлика» и расчёт перепада давления / подбора насоса.'),
      accent: 'sky',
    },
    {
      id: 'stokes',
      name: tr('Джордж Габриэль Стокс'),
      era: '1819–1903',
      discipline: tr('Гидродинамика и перемешивание'),
      moduleId: 'proc-mix',
      equation: 'v = Δρ · g · d² / (18 · η)',
      contribution: tr('Закон Стокса количественно связывает диаметр капли, вязкость среды и скорость кримирования или оседания частиц в реакторе.'),
      unlockHint: tr('Освойте модуль «Гидродинамика и перемешивание» и пульт вакуумного реактора.'),
      accent: 'sky',
    },
    {
      id: 'ostwald',
      name: tr('Вильгельм Оствальд'),
      era: '1853–1932',
      discipline: tr('Диспергирование и гомогенизация'),
      moduleId: 'proc-disp',
      equation: 'r³(t) = r₀³ + ω · t',
      contribution: tr('Нобелевский лауреат и пионер коллоидной химии: описал оствальдово созревание мелких капель и законы устойчивости наноэмульсий.'),
      unlockHint: tr('Пройдите модуль «Диспергирование и гомогенизация» и расчёт числа проходов ротор-статора.'),
      accent: 'amber',
    },
    {
      id: 'fourier',
      name: tr('Жан-Батист Жозеф Фурье'),
      era: '1768–1830',
      discipline: tr('Теплообмен и охлаждение партий'),
      moduleId: 'proc-heat',
      equation: 'q = −λ · (dT / dx)',
      contribution: tr('Закон теплопроводности Фурье определяет расчёт рубашек реакторов, плавление восков и время охлаждения крупных серий.'),
      unlockHint: tr('Освойте модуль «Основы ПАХТ: теплообмен» и расчёт рубашки охлаждения.'),
      accent: 'coral',
    },
    {
      id: 'langmuir',
      name: tr('Ирвинг Ленгмюр'),
      era: '1881–1957',
      discipline: tr('Масштабирование и межфазные слои'),
      moduleId: 'proc-scale',
      equation: 'θ = K · c / (1 + K · c)',
      contribution: tr('Нобелевский лауреат (1932), раскрывший строение ориентированных монослоёв ПАВ на границе фаз — базис переноса эмульсий с 5 кг на 2000 кг.'),
      unlockHint: tr('Пройдите модуль «Масштабирование» и симулятор переноса на реактор 2000 кг.'),
      accent: 'violet',
    },
    {
      id: 'darcy',
      name: tr('Анри Дарси'),
      era: '1803–1858',
      discipline: tr('Деаэрация, фильтрация и CIP'),
      moduleId: 'proc-aux',
      equation: 'Q = k · A · ΔP / (μ · L)',
      contribution: tr('Закон Дарси управляет полирующей фильтрацией тоников и мицеллярных вод, а также расчётом перепада давления на фильтроэлементах.'),
      unlockHint: tr('Изучите модуль «Вспомогательные операции» и тренажёр GMP / трендов смены.'),
      accent: 'emerald',
    },

    // 3 особые мастер-карты
    {
      id: 'curie',
      name: tr('Мария Склодовская-Кюри'),
      era: '1867–1934',
      discipline: tr('Кампании запуска продукта'),
      special: 'campaign',
      equation: 'R&D → Stability → 1000 kg QA',
      contribution: tr('Дважды Нобелевский лауреат, эталон экспериментальной точности и выдержки при переводе тонкого химического процесса в промышленный масштаб.'),
      unlockHint: tr('Пройдите этапы Кампании запуска (SPF 50+ или Retinol 0,3 %); для Легендарной — финиш ≥ 85/100.'),
      accent: 'violet',
    },
    {
      id: 'lavoisier',
      name: tr('Антуан Лавуазье'),
      era: '1743–1794',
      discipline: tr('Мастер Лаборатории рецептур'),
      special: 'lab-formulas',
      equation: '∑ wᵢ = 100.00 %',
      contribution: tr('Сформулировал закон сохранения массы и современную химическую номенклатуру: ни один грамм рецептуры не теряется в материальном балансе.'),
      unlockHint: tr('Собирайте и сохраняйте сбалансированные рецептуры в Лаборатории; для Легендарной — ≥ 3 сохранённых рецептур (из них ≥ 1 на 100 %).'),
      accent: 'amber',
    },
    {
      id: 'fisher',
      name: tr('Рональд Эйлмер Фишер'),
      era: '1890–1962',
      discipline: tr('Ночная смена и дизайн эксперимента'),
      special: 'night-shift',
      equation: 'Y = β₀ + β₁A + β₂B + β₁₂AB',
      contribution: tr('Основатель планирования эксперимента (DoE) и статистического контроля качества: учит принимать безошибочные решения в условиях шума и стресса.'),
      unlockHint: tr('Пройдите «Ночную смену: генератор ЧП» или практикум DoE; для Легендарной — результат ≥ 90 % без подсказок.'),
      accent: 'emerald',
    },
  ]
}

export interface ModuleDeckInput {
  id: string
  topicIds: string[]
  skillIds: string[]
  labIds: string[]
}

function tierToIndex(t: CardTier): number {
  return TIER_ORDER.indexOf(t)
}

/**
 * Детерминированно вычисляет редкость каждой из 18 карточек учёных строго по освоенному мастерству.
 * Никакого рандома и лутбоксов: уровень карты = доказанный инженерный результат.
 */
export function evaluateScientistDeck(
  progress: Progress,
  skillStates: Record<string, SkillState>,
  modules: ModuleDeckInput[],
): ScientistCardState[] {
  const modMap = new Map(modules.map((m) => [m.id, m]))
  const deck = getScientistDeck()

  return deck.map((def) => {
    if (def.moduleId) {
      const mod = modMap.get(def.moduleId)
      const topicIds = mod?.topicIds ?? []
      const skillIds = mod?.skillIds ?? []
      const labIds = mod?.labIds ?? []

      const visitedCount = topicIds.filter((id) => Boolean(progress.visited[id])).length
      const checkedCount = topicIds.filter((id) => Object.keys(progress.checks[id] ?? {}).length > 0).length
      const labsCompleted = labIds.filter((id) => Boolean(progress.labDone[id])).length
      const states = skillIds.map((id) => skillStates[id]).filter(Boolean)
      const maxSkillLevel = states.reduce((m, s) => Math.max(m, s.level), 0)
      const hasIndependent90 = progress.evidence.some(
        (e) => skillIds.includes(e.skill) && e.kind === 'lab' && (e.score ?? 0) >= 0.9 && !e.hints,
      )
      const hasTransfer = states.some((s) => s.level >= 4)

      let tier: CardTier = 'locked'
      let progressPct = 0
      let nextHint = def.unlockHint

      if (hasTransfer || (hasIndependent90 && visitedCount >= topicIds.length && topicIds.length > 0)) {
        tier = 'legendary'
        progressPct = 100
        nextHint = tr('Максимальный ранг мастерства достигнут')
      } else if (maxSkillLevel >= 3 && visitedCount >= Math.max(1, Math.ceil(topicIds.length * 0.6))) {
        tier = 'epic'
        progressPct = 78
        nextHint = tr('До Легендарной: пройдите все темы модуля и сдайте практикум ≥ 90 % без подсказок (или блок переноса).')
      } else if (labsCompleted >= 1 || (topicIds.length > 0 && visitedCount >= topicIds.length && checkedCount >= 1)) {
        tier = 'rare'
        progressPct = 52
        nextHint = tr('До Эпической: подтвердите навык модуля на уровне 3 (≥ 80 % без подсказок).')
      } else if (visitedCount >= 1 || checkedCount >= 1 || maxSkillLevel >= 1) {
        tier = 'common'
        progressPct = 26
        nextHint = tr('До Редкой: пройдите практикум модуля или все его темы с проверкой понимания.')
      }

      return { def, tier, tierIndex: tierToIndex(tier), progressPct, nextHint }
    }

    if (def.special === 'campaign') {
      const camps = Object.values(progress.campaigns ?? {})
      const maxStage = camps.reduce((m, c) => Math.max(m, c.stage ?? 0), 0)
      const bestFinal = camps.reduce((m, c) => Math.max(m, c.finalScore ?? 0), 0)
      const completed = camps.filter((c) => Boolean(c.completedAt)).length

      let tier: CardTier = 'locked'
      let progressPct = 0
      let nextHint = def.unlockHint
      if (bestFinal >= 85 || completed >= 2) {
        tier = 'legendary'
        progressPct = 100
        nextHint = tr('Максимальный ранг мастерства достигнут')
      } else if (completed >= 1) {
        tier = 'epic'
        progressPct = 76
        nextHint = tr('До Легендарной: завершите любую Кампанию запуска с итоговым баллом ≥ 85 / 100.')
      } else if (maxStage >= 3) {
        tier = 'rare'
        progressPct = 50
        nextHint = tr('До Эпической: доведите Кампанию запуска до 5-го этапа QA-досье.')
      } else if (maxStage >= 1) {
        tier = 'common'
        progressPct = 24
        nextHint = tr('До Редкой: пройдите первые 3 этапа любой Кампании запуска.')
      }
      return { def, tier, tierIndex: tierToIndex(tier), progressPct, nextHint }
    }

    if (def.special === 'lab-formulas') {
      const count = progress.savedFormulas.length
      const balancedCount = progress.savedFormulas.filter((f) => {
        const rows = Array.isArray(f.formula?.rows) ? f.formula.rows : []
        const sum = rows.reduce((s: number, r: any) => s + (Number(r.percent) || 0), 0)
        return Math.abs(sum - 100) <= 0.15 && rows.length >= 4
      }).length

      let tier: CardTier = 'locked'
      let progressPct = 0
      let nextHint = def.unlockHint
      if (count >= 3 && balancedCount >= 2) {
        tier = 'legendary'
        progressPct = 100
        nextHint = tr('Максимальный ранг мастерства достигнут')
      } else if (count >= 2 && balancedCount >= 1) {
        tier = 'epic'
        progressPct = 74
        nextHint = tr('До Легендарной: сохраните не менее 3 рецептур в Лаборатории (из них ≥ 2 со строгим балансом 100 %).')
      } else if (balancedCount >= 1 || count >= 2) {
        tier = 'rare'
        progressPct = 48
        nextHint = tr('До Эпической: соберите 2 рецептуры с балансом 100 % и сохраните их в портфолио.')
      } else if (count >= 1) {
        tier = 'common'
        progressPct = 25
        nextHint = tr('До Редкой: сведите баланс сохранённой рецептуры ровно к 100,00 %.')
      }
      return { def, tier, tierIndex: tierToIndex(tier), progressPct, nextHint }
    }

    // special === 'night-shift' (R. A. Fisher — Night Shift & DoE)
    const nsAtts = progress.attempts.filter((a) => a.labId === 'night-shift-chp' || a.labId === 'doe-gel')
    const bestScore = nsAtts.reduce((m, a) => Math.max(m, Number(a.detail?.score ?? 0)), 0)
    const clean90 = nsAtts.some((a) => Number(a.detail?.score ?? 0) >= 0.9 && !Number(a.detail?.hints ?? 0))

    let tier: CardTier = 'locked'
    let progressPct = 0
    let nextHint = def.unlockHint
    if (clean90) {
      tier = 'legendary'
      progressPct = 100
      nextHint = tr('Максимальный ранг мастерства достигнут')
    } else if (bestScore >= 0.85) {
      tier = 'epic'
      progressPct = 76
      nextHint = tr('До Легендарной: сдайте «Ночную смену» или DoE на ≥ 90 % без подсказок.')
    } else if (bestScore >= 0.65) {
      tier = 'rare'
      progressPct = 50
      nextHint = tr('До Эпической: локализуйте ЧП в «Ночной смене» с баллом ≥ 85 %.')
    } else if (nsAtts.length >= 1 || Boolean(progress.labDone['night-shift-chp']) || Boolean(progress.labDone['doe-gel'])) {
      tier = 'common'
      progressPct = 25
      nextHint = tr('До Редкой: пройдите «Ночную смену» или практикум DoE на ≥ 65 %.')
    }
    return { def, tier, tierIndex: tierToIndex(tier), progressPct, nextHint }
  })
}

export function diffCardUpgrades(
  prev: Record<string, CardTier>,
  next: ScientistCardState[],
): ScientistCardState[] {
  const upgrades: ScientistCardState[] = []
  for (const c of next) {
    const oldTier = prev[c.def.id] ?? 'locked'
    if (c.tierIndex > tierToIndex(oldTier)) {
      upgrades.push(c)
    }
  }
  return upgrades
}
