// Карта компетенций по 6 направлениям косметической химии и технологии
// + безопасный экспорт/импорт резервной копии прогресса и рецептур в JSON.

import type { SkillState } from './mastery'
import { language } from './locale'
import { mergeProgress, normalize, type Progress } from './merge'

export interface CompetencyDomainDef {
  id: 'emulsions' | 'surfactants' | 'rheology' | 'preservation' | 'scaleup' | 'gmp'
  title: string
  shortTitle: string
  description: string
  skills: string[]
}

export interface CompetencyDomainSummary {
  def: CompetencyDomainDef
  percent: number
  avgLevel: number
  mastered: number
  started: number
  total: number
  nextSkillId?: string
}

export const COMPETENCY_DOMAINS: CompetencyDomainDef[] = [
  {
    id: 'emulsions',
    title: 'Эмульсии и дисперсные системы',
    shortTitle: 'Эмульсии',
    description: 'Механизмы нестабильности, подбор ГЛБ, ламеллярные сетки, диспергирование порошков и испытания стабильности.',
    skills: ['mech', 'struct', 'emul', 'stabtest', 'disperse', 'emulsifier-selection', 'colloidstab', 'oil-oxidation', 'particle-sizing', 'powder-wetting', 'sunscreens-spf'],
  },
  {
    id: 'surfactants',
    title: 'ПАВ-системы и очищение',
    shortTitle: 'ПАВ-системы',
    description: 'ККМ, адсорбция, солевая кривая, мягкость моющих систем, солюбилизация отдушек, уход за волосами и управление пеной.',
    skills: ['surf', 'surface', 'surface-adsorption', 'micellar-solubility', 'cleanser-mildness', 'foam-control', 'ionic-strength', 'hair-care-systems'],
  },
  {
    id: 'rheology',
    title: 'Реология и полимерные загустители',
    shortTitle: 'Реология',
    description: 'Чтение кривых течения и предела текучести, выбор загустителей и расчёт течения вязких сред в трубах.',
    skills: ['rheo', 'polymer-thickeners', 'flow'],
  },
  {
    id: 'preservation',
    title: 'Консервация, активы, pH и сырьё',
    shortTitle: 'Консервация',
    description: 'Активная форма консервантов при заданном pH, стабильность активов, буферы, вода как сырьё, чтение INCI и спецификаций сырья.',
    skills: ['micro', 'water', 'acidbase', 'solcalc', 'inci', 'ingredient-documents', 'dissolve', 'unstable-actives'],
  },
  {
    id: 'scaleup',
    title: 'Оборудование, процессы и масштабирование',
    shortTitle: 'Масштабирование',
    description: 'Перенос со стакана на реактор, перемешивание, теплообмен, вакуумирование, насосы, фильтрование и планирование эксперимента (DoE).',
    skills: ['scale', 'mixing', 'heat', 'vacuum', 'pump-selection', 'porous-flow', 'impeller-geometry', 'fat-melting', 'flow-exchangers', 'filtration', 'doe', 'fractional-design'],
  },
  {
    id: 'gmp',
    title: 'GMP (ISO 22716), санитария и упаковка',
    shortTitle: 'GMP',
    description: 'Маршрутные карты Batch Record, критические контрольные точки (CCP), отклонения, CAPA, верификация CIP, санитария воды и совместимость с упаковкой.',
    skills: ['cip-verification', 'water-sanitation', 'packaging-compatibility'],
  },
]

/** Строит агрегированный профиль компетенций по 6 доменам на основе текущих состояний навыков. */
export function buildCompetencyProfile(states: Record<string, SkillState>): CompetencyDomainSummary[] {
  return COMPETENCY_DOMAINS.map((def) => {
    const total = def.skills.length
    let sumLevels = 0
    let mastered = 0
    let started = 0
    let nextSkillId: string | undefined

    for (const id of def.skills) {
      const st = states[id]
      const lvl = st?.level ?? 0
      sumLevels += lvl
      if (lvl >= 3) mastered += 1
      if (lvl >= 1) started += 1
      if (!nextSkillId && lvl < 3) nextSkillId = id
    }

    const avgLevel = total ? Number((sumLevels / total).toFixed(2)) : 0
    const percent = total ? Math.round((sumLevels / (total * 4)) * 100) : 0
    return { def, percent, avgLevel, mastered, started, total, nextSkillId }
  })
}

export interface ProgressBackup {
  schema: 'faza.backup.v1'
  exportedAt: string
  progress: Progress
  sandboxFormulas: any[]
}

export function createProgressBackup(progress: Progress, sandboxFormulas: any[] = []): ProgressBackup {
  const norm = normalize(progress)
  const list = sandboxFormulas.length ? sandboxFormulas : norm.savedFormulas
  return {
    schema: 'faza.backup.v1',
    exportedAt: new Date().toISOString(),
    progress: { ...norm, savedFormulas: list },
    sandboxFormulas: Array.isArray(list) ? list : [],
  }
}

/** Проверяет и безопасно объединяет импортированную резервную копию с текущим прогрессом. */
export function importProgressBackup(
  rawJson: string,
  currentProgress: Progress,
  currentFormulas: any[] = [],
): { ok: true; progress: Progress; sandboxFormulas: any[] } | { ok: false; error: string } {
  let parsed: any
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return { ok: false, error: 'Файл не является корректным JSON.' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Некорректная структура резервной копии.' }
  }
  const incomingProgress = parsed.schema === 'faza.backup.v1' && parsed.progress && typeof parsed.progress === 'object'
    ? parsed.progress
    : parsed.visited || parsed.labDone || parsed.evidence
      ? parsed
      : null
  if (!incomingProgress) {
    return { ok: false, error: 'В файле не найден формат резервной копии «Фазы» (faza.backup.v1).' }
  }

  const mergedProgress = mergeProgress(currentProgress, incomingProgress)
  const incomingFormulas = Array.isArray(parsed.sandboxFormulas) ? parsed.sandboxFormulas : []
  const byId = new Map<string, any>()
  for (const f of [...mergedProgress.savedFormulas, ...currentFormulas, ...incomingFormulas]) {
    if (f && typeof f.id === 'string' && f.formula) {
      const prev = byId.get(f.id)
      if (!prev || (f.at ?? 0) >= (prev.at ?? 0)) byId.set(f.id, f)
    }
  }
  const mergedFormulas = [...byId.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 50)
  mergedProgress.savedFormulas = mergedFormulas
  return { ok: true, progress: mergedProgress, sandboxFormulas: mergedFormulas }
}

// ===== Профессиональные грейды технолога и интервальное повторение (Пакет A) =====

export interface CareerGrade {
  level: number // 1..5
  title: string
  badge: string
  description: string
  nextTitle?: string
  nextRequirement?: string
  progressPct: number
}

/** Рассчитывает профессиональный грейд по подтверждённым компетенциям и пройденным практическим кейсам. */
export function computeCareerGrade(profile: CompetencyDomainSummary[], completedLabs: number): CareerGrade {
  const mastered = profile.reduce((s, d) => s + d.mastered, 0)
  const avgPct = profile.length ? Math.round(profile.reduce((s, d) => s + d.percent, 0) / profile.length) : 0
  const strongDomains = profile.filter((d) => d.percent >= 50).length

  if (mastered >= 20 && completedLabs >= 18 && strongDomains >= 5) {
    return {
      level: 5,
      title: 'Главный технолог / R&D-директор',
      badge: 'Грейд V',
      description: 'Системное владение рецептурами, масштабированием, реологией, стабильностью и GMP.',
      progressPct: 100,
    }
  }
  if (mastered >= 12 && completedLabs >= 10 && strongDomains >= 3) {
    return {
      level: 4,
      title: 'Ведущий технолог',
      badge: 'Грейд IV',
      description: 'Уверенно ведёт разработку, перенос на реактор и расследование производственного брака.',
      nextTitle: 'Главный технолог / R&D-директор',
      nextRequirement: language === 'en'
        ? `For Grade V: ≥ 20 mastered skills (now ${mastered}), ≥ 18 labs (${completedLabs}), and 5 strong domains (${strongDomains}).`
        : `До V грейда: ≥ 20 освоенных навыков (сейчас ${mastered}), ≥ 18 кейсов (${completedLabs}) и 5 сильных доменов (${strongDomains}).`,
      progressPct: Math.min(99, Math.round(((mastered / 20) * 0.5 + (completedLabs / 18) * 0.5) * 100)),
    }
  }
  if (mastered >= 6 && completedLabs >= 5) {
    return {
      level: 3,
      title: 'Разработчик рецептур (R&D)',
      badge: 'Грейд III',
      description: 'Самостоятельно проектирует эмульсии/ПАВ-системы, проверяет комплаенс и анализирует отклонения.',
      nextTitle: 'Ведущий технолог',
      nextRequirement: language === 'en'
        ? `For Grade IV: ≥ 12 mastered skills (now ${mastered}), ≥ 10 labs (${completedLabs}), and 3 domains ≥ 50% (${strongDomains}).`
        : `До IV грейда: ≥ 12 освоенных навыков (сейчас ${mastered}), ≥ 10 кейсов (${completedLabs}) и 3 домена ≥ 50 % (${strongDomains}).`,
      progressPct: Math.min(99, Math.round(((mastered / 12) * 0.5 + (completedLabs / 10) * 0.5) * 100)),
    }
  }
  if (mastered >= 2 || completedLabs >= 2) {
    return {
      level: 2,
      title: 'Младший технолог',
      badge: 'Грейд II',
      description: 'Уверенно работает с базовыми расчётами, pH, ГЛБ и первыми лабораторными тренажёрами.',
      nextTitle: 'Разработчик рецептур (R&D)',
      nextRequirement: language === 'en'
        ? `For Grade III: ≥ 6 mastered skills (now ${mastered}) and ≥ 5 completed labs (${completedLabs}).`
        : `До III грейда: ≥ 6 освоенных навыков (сейчас ${mastered}) и ≥ 5 пройденных практических занятий (${completedLabs}).`,
      progressPct: Math.min(99, Math.round(((mastered / 6) * 0.5 + (completedLabs / 5) * 0.5) * 100)),
    }
  }
  return {
    level: 1,
    title: 'Стажёр-лаборант',
    badge: 'Грейд I',
    description: 'Начальный этап: пройдите первые 2 практических занятия или соберите и проверьте первую рецептуру.',
    nextTitle: 'Младший технолог',
    nextRequirement: language === 'en'
      ? `For Grade II: complete 2 practical labs (now ${completedLabs}) or master 2 skills (${mastered}).`
      : `До II грейда: пройдите 2 практических занятия (сейчас ${completedLabs}) или освойте 2 навыка (${mastered}).`,
    progressPct: Math.min(99, Math.max(avgPct, Math.round((completedLabs / 2) * 100))),
  }
}

export interface RefreshItem {
  skillId: string
  skillName: string
  reason: string
  priority: number
  topicId?: string
  labId?: string
}

/** Интервальное повторение: подбирает до 4 навыков, которые стоит освежить (ошибки, подсказки или давняя практика). */
export function buildRefreshQueue(
  states: Record<string, SkillState>,
  skillsMeta: { id: string; name: string; topics: string[]; labs: string[] }[],
  nowMs = Date.now(),
): RefreshItem[] {
  const out: RefreshItem[] = []
  const THREE_DAYS = 3 * 86400000

  for (const sk of skillsMeta) {
    const st = states[sk.id]
    if (!st || !st.evidence.length) continue
    const latest = st.evidence[0]
    const ageMs = nowMs - (latest?.at ?? nowMs)
    const hadHints = st.evidence.some((e) => (e.hints ?? 0) > 0)

    if (st.gap) {
      out.push({
        skillId: sk.id,
        skillName: sk.name,
        reason: 'Было затруднение — короткий повторный кейс закрепит механизм.',
        priority: 100,
        topicId: sk.topics[0],
        labId: sk.labs[0],
      })
    } else if (hadHints && st.level < 3) {
      out.push({
        skillId: sk.id,
        skillName: sk.name,
        reason: 'Решалось с подсказкой — попробуйте пройти самостоятельно без опоры.',
        priority: 80,
        topicId: sk.topics[0],
        labId: sk.labs[0],
      })
    } else if (st.level < 4 && ageMs >= THREE_DAYS) {
      const days = Math.max(3, Math.floor(ageMs / 86400000))
      out.push({
        skillId: sk.id,
        skillName: sk.name,
        reason: language === 'en'
          ? `Last practiced ${days} days ago — spaced repetition will reinforce confidence.`
          : `Последняя практика ${days} дн. назад — интервальное повторение укрепит уверенность.`,
        priority: 50 + Math.min(30, days),
        topicId: sk.topics[0],
        labId: sk.labs[0],
      })
    }
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 4)
}
