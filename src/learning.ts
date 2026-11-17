import YAML from 'yaml'
import { useMemo } from 'react'
import { topics, labs, topicById, labById } from './content'
import { useProgress, registerLabSkills, update, addEvidence, getProgress } from './store'
import { skillState, buildRoute, nextDiagItem, diagProgress, type DiagTrack, type DiagItem, type SkillState, type Result, type Evidence, type TopicRef } from '../shared/mastery'
import curRaw from '/content/curriculum.yaml?raw'
import skillsRaw from '/content/skills.yaml?raw'
import diagRaw from '/content/diagnostic.yaml?raw'
import tracksRaw from '/content/diagnostic-tracks.yaml?raw'

export interface Skill { id: string; name: string; outcome: string; topics: string[]; labs: string[] }
export const curriculum = YAML.parse(curRaw) as { goals: { id: string; name: string; hint: string; order: string[] }[]; contexts: { id: string; name: string }[]; sections: { id: string; name: string; text: string; color: string; modules: { id: string; name: string; topics: { id: string; prereq?: string[] }[]; also?: string[]; planned?: string[] }[] }[] }
export const skills = YAML.parse(skillsRaw) as Skill[]
export const diagItems = YAML.parse(diagRaw) as DiagItem[]
export const diagTracks = YAML.parse(tracksRaw) as { id: DiagTrack; name: string; description: string; time: string }[]
export const diagDomainLabel = { physical: 'Физическая химия', colloid: 'Коллоидная химия', process: 'Процессы и аппараты', cosmetics: 'Косметическая технология' }
export const skillById = (id?: string) => skills.find((s) => s.id === id)
export const skillOfTopic = (topicId: string) => skills.find((s) => s.topics.includes(topicId))
export const skillsOfLab = (labId: string) => skills.filter((s) => s.labs.includes(labId))
export const topicRefs: TopicRef[] = curriculum.sections.flatMap((s) => s.modules.flatMap((m) => m.topics.map((t) => ({ id: t.id, skill: skillOfTopic(t.id)?.id, prereq: t.prereq ?? [] })))).filter((t) => topicById(t.id))
export const moduleOfTopic = (topicId: string) => { for (const s of curriculum.sections) for (const m of s.modules) if (m.topics.some((t) => t.id === topicId)) return { section: s, module: m }; return undefined }
registerLabSkills((id) => ({ skills: skillsOfLab(id).map((s) => s.id), title: labById(id)?.title ?? id, transferOf: labById(id)?.transferOf }))

export function useLearning() {
  const p = useProgress()
  return useMemo(() => {
    const legacy = (sk: Skill) => sk.labs.filter((l) => p.labDone[l] && !p.evidence.some((e) => e.kind === 'lab' && e.src === l))
    const states: Record<string, SkillState> = Object.fromEntries(skills.map((s) => [s.id, skillState(s.id, p.evidence, legacy(s))]))
    const goal = curriculum.goals.find((g) => g.id === p.profile.goal)
    const progress = diagProgress(diagItems, p.diag.answers, p.diag.track)
    const diagDone = !!p.diag.finishedAt
    const route = goal ? buildRoute(goal.order, topicRefs, states, diagDone) : []
    const started = Object.keys(p.visited).length > 0 || Object.keys(p.labDone).length > 0 || Object.keys(p.labs).length > 0
    return { p, states, goal, route, diagDone, diagAnswered: progress.answered, diagTotal: progress.total, next: route.find((r) => r.status === 'now'), started, nextItem: goal ? nextDiagItem(diagItems, p.diag.answers, goal.id, p.diag.track) : undefined }
  }, [p])
}
export function setGoal(goal: string, context?: string) { update((p) => { p.profile = { goal, context: context ?? p.profile.context, at: Date.now() } }) }
export function answerDiag(item: DiagItem, result: Result, note?: string, value?: string) {
  const at = Math.max(Date.now(), getProgress().diag.changedAt ?? 0)
  update((p) => { p.diag.startedAt ??= at; p.diag.answers[item.id] = { result, note, value, at } })
  if (result !== 'skip') addEvidence([{ id: `diag:${item.id}`, skill: item.skill, kind: 'diag', item: item.kind, result, src: item.id, label: item.short, note, at }])
  const p = getProgress()
  if (!nextDiagItem(diagItems, p.diag.answers, p.profile.goal ?? 'base', p.diag.track)) update((x) => { x.diag.finishedAt = Date.now() })
}
export function restartDiag(track?: DiagTrack) { update((p) => { p.diag = { answers: {}, track, changedAt: Math.max(Date.now(), (p.diag.changedAt ?? 0) + 1) }; p.evidence = p.evidence.filter((e) => e.kind !== 'diag') }) }
/** Проверка понимания в теме: одно свидетельство на тему, обновляется при повторном ответе. */
export function recordCheck(topicId: string) {
  const p = getProgress(), t = topicById(topicId), sk = skillOfTopic(topicId); if (!t || !sk) return
  const a = p.checks[topicId] ?? {}; if (Object.keys(a).length < t.checks.length) return
  const right = t.checks.filter((c, i) => c.options[a[i]]?.correct).length
  addEvidence([{ id: `check:${topicId}`, skill: sk.id, kind: 'check', item: 'recognize', result: right >= Math.ceil((2 * t.checks.length) / 3) ? 'ok' : right > 0 ? 'partial' : 'wrong', src: topicId, label: `проверка понимания в теме «${t.title}» (${right} из ${t.checks.length})`, at: Date.now() }])
}
export function recordTransfer(labId: string, allCorrect: boolean) {
  const l = labById(labId); if (!l) return
  addEvidence(skillsOfLab(labId).map((s): Evidence => ({ id: `transfer:${labId}:${s.id}`, skill: s.id, kind: 'transfer', item: 'transfer', result: allCorrect ? 'ok' : 'partial', src: labId, label: `перенос после занятия «${l.title}»`, at: Date.now() })))
}
export const labsOfTopic = (topicId: string) => labs.filter((l) => topicById(topicId)?.labs.includes(l.id))
export { topics }
