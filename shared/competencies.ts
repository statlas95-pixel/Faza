// Карта компетенций по 6 направлениям косметической химии и технологии
// + безопасный экспорт/импорт резервной копии прогресса и рецептур в JSON.

import type { SkillState } from './mastery'
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
    skills: ['mech', 'struct', 'emul', 'stabtest', 'disperse', 'emulsifier-selection', 'colloidstab', 'oil-oxidation', 'particle-sizing', 'powder-wetting'],
  },
  {
    id: 'surfactants',
    title: 'ПАВ-системы и очищение',
    shortTitle: 'ПАВ-системы',
    description: 'ККМ, адсорбция, солевая кривая, мягкость моющих систем, солюбилизация отдушек и управление пеной.',
    skills: ['surf', 'surface', 'surface-adsorption', 'micellar-solubility', 'cleanser-mildness', 'foam-control', 'ionic-strength'],
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
    title: 'Консервация, pH и сырьё',
    shortTitle: 'Консервация',
    description: 'Активная форма консервантов при заданном pH, буферы, вода как сырьё, чтение INCI и спецификаций сырья.',
    skills: ['micro', 'water', 'acidbase', 'solcalc', 'inci', 'ingredient-documents', 'dissolve'],
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
    title: 'GMP (ISO 22716) и санитарный контроль',
    shortTitle: 'GMP',
    description: 'Маршрутные карты Batch Record, критические контрольные точки (CCP), отклонения, CAPA, верификация CIP и санитария воды.',
    skills: ['cip-verification', 'water-sanitation'],
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
