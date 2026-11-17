import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import YAML from 'yaml'

// Проверяем настоящий авторский валидатор на испорченных копиях контента.
const checker = path.resolve('scripts/check-content.mjs')
function check(change: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faza-content-'))
  try {
    fs.cpSync('content', path.join(dir, 'content'), { recursive: true })
    change(path.join(dir, 'content'))
    const r = spawnSync(process.execPath, [checker], { cwd: dir, encoding: 'utf8', timeout: 5000 })
    if (r.error) throw r.error
    return { status: r.status, text: r.stdout + r.stderr }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
function edit(dir: string, file: string, fn: (data: any) => void) {
  const p = path.join(dir, file), data = YAML.parse(fs.readFileSync(p, 'utf8'))
  fn(data); fs.writeFileSync(p, YAML.stringify(data))
}

describe('Защита связей учебного контента', () => {
  it('отклоняет битую перекрёстную ссылку словаря', () => {
    const r = check((dir) => edit(dir, 'glossary.yaml', (xs) => { xs[0].see = ['missing-term'] }))
    expect(r.status).toBe(1); expect(r.text).toContain('нет термина see «missing-term»')
  })
  it('находит цикл предпосылок до запуска построителя маршрута', () => {
    const r = check((dir) => edit(dir, 'curriculum.yaml', (c) => {
      const [a, b] = c.sections.flatMap((s: any) => s.modules.flatMap((m: any) => m.topics))
      a.prereq = [b.id]; b.prereq = [a.id]
    }))
    expect(r.status).toBe(1); expect(r.text).toContain('цикл предпосылок'); expect(r.text).not.toContain('RangeError')
  })
  it('отклоняет отсутствующую предпосылку и неизвестную тему цели', () => {
    const r = check((dir) => edit(dir, 'curriculum.yaml', (c) => {
      c.sections[0].modules[0].topics[0].prereq = ['missing-prereq']
      c.goals[0].order.push('missing-goal-topic')
    }))
    expect(r.status).toBe(1); expect(r.text).toContain('нет предпосылки «missing-prereq»'); expect(r.text).toContain('неизвестная тема missing-goal-topic')
  })
  it('не допускает одинаковые id тем и занятий', () => {
    const r = check((dir) => {
      fs.copyFileSync(path.join(dir, 'topics/ph-buffers.md'), path.join(dir, 'topics/duplicate.md'))
      fs.copyFileSync(path.join(dir, 'labs/ph-sheet.yaml'), path.join(dir, 'labs/duplicate.yaml'))
    })
    expect(r.status).toBe(1); expect(r.text).toContain('повтор id «ph-buffers»'); expect(r.text).toContain('повтор id «ph-sheet»')
  })
  it('отклоняет бесконечный ответ и отрицательную погрешность расчёта', () => {
    const r = check((dir) => edit(dir, 'labs/solutions-sheet.yaml', (l) => {
      l.steps[0].questions[0].answer = Infinity; l.steps[0].questions[1].tol = -0.1
    }))
    expect(r.status).toBe(1); expect(r.text).toContain('нет конечного числового ответа'); expect(r.text).toContain('некорректный допуск tol')
  })
})
