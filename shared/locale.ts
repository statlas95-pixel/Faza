export type Language = 'ru' | 'en'

let messages: Record<string, string> = {}
export let language: Language = 'ru'

export function configureLanguage(selected: Language, translations: Record<string, string>) {
  language = selected
  messages = translations
}

/** Only use on authored messages. User input, progress keys and URLs are never translated. */
export function tr(source: string): string {
  if (language === 'ru') return source
  return translateText(source, messages)
}

function translateText(source: string, dictionary: Record<string, string>): string {
  return source.split('\n').map(line => {
    const key = line.trim()
    if (!key || !Object.prototype.hasOwnProperty.call(dictionary, key)) return line
    return line.replace(key, () => dictionary[key])
  }).join('\n')
}

/** Called after parsing the author's YAML. Preserve structure, numbers and answer keys. */
export function localizeMaterial(value: any, dictionary = messages): any {
  if (dictionary === messages && language === 'ru') return value
  if (typeof value === 'string') return translateText(value, dictionary)
  if (Array.isArray(value)) return value.map(item => localizeMaterial(item, dictionary))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, localizeMaterial(field, dictionary)]))
}
