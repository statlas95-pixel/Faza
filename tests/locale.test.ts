import { afterEach, expect, it } from 'vitest'
import fs from 'node:fs'
import YAML from 'yaml'
import { configureLanguage, localizeMaterial, tr } from '../shared/locale'
import { parseNum } from '../src/ui'

const en = JSON.parse(fs.readFileSync('content/locales/en.json', 'utf8'))
afterEach(() => configureLanguage('ru', {}))

it('переводит каждый диагностический вопрос и варианты ответа, сохраняя ключи оценки', () => {
  const items = YAML.parse(fs.readFileSync('content/diagnostic.yaml', 'utf8'))
  configureLanguage('en', en)
  for (const question of items) {
    const localized = localizeMaterial(question)
    expect(localized.q).not.toBe(question.q)
    expect(localized.id).toBe(question.id)
    expect(localized.answer).toBe(question.answer)
    expect(localized.after).toEqual(question.after)
    question.options?.forEach((option: any, index: number) => {
      expect(localized.options[index].result).toBe(option.result)
      if (/[а-я]/i.test(option.text)) expect(localized.options[index].text).not.toBe(option.text)
    })
  }
})

it('сохраняет ссылки, идентификаторы виджетов и формулы в английском тексте тем', () => {
  configureLanguage('en', en)
  const structure = (s: string) => s.match(/\[\[[\w-]+|\[@[^\]]+\]|\{\{widget:[^}]+\}\}|\$\$[\s\S]*?\$\$|\$[^$\n]+?\$/g) ?? []
  for (const file of fs.readdirSync('content/topics')) {
    const body = fs.readFileSync('content/topics/' + file, 'utf8').split(/^---\s*$/m)[2]
    expect(structure(tr(body)), file).toEqual(structure(body))
  }
})

it('принимает числовой ответ целиком с точкой или запятой', () => {
  expect(parseNum(' 0,25 ')).toBe(0.25)
  expect(parseNum('1.2e-3')).toBe(0.0012)
  expect(parseNum('2.5.3')).toBeNaN()
  expect(parseNum('2 кг')).toBeNaN()
  expect(parseNum('')).toBeNaN()
})

it('сохраняет технические единицы в английском тексте', () => {
  const units: [string, RegExp][] = [
    ['об/мин', /rpm|rev\/min/i], ['мкСм/см', /[μµu]S\/cm/i],
    ['мН/м', /mN\/m/], ['мПа·с', /mPa\s*[·.⋅ ]\s*s/],
    ['Па·с', /Pa\s*[·.⋅ ]\s*s/], ['кг/м³', /kg\s*\/\s*m[³3]|kg·m⁻³/i],
    ['моль/кг', /mol\s*\/\s*kg/i], ['моль/л', /mol\s*\/\s*L|\bM\b/i],
    ['кВт', /kW/], ['м²', /m[²2]/],
  ]
  for (const [source, translation] of Object.entries(en as Record<string, string>)) {
    const prose = (text: string) => text.replace(/\$[^$]*\$/g, '')
    for (const [unit, expected] of units) {
      if (prose(source).includes(unit)) expect(prose(translation), source).toMatch(expected)
    }
  }
})
