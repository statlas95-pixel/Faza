import { configureLanguage, type Language } from '../shared/locale'

function preferredLanguage(): Language {
  const query = new URL(location.href).searchParams.get('lang')
  if (query === 'en' || query === 'ru') return query
  try { return localStorage.getItem('faza.language') === 'en' ? 'en' : 'ru' }
  catch { return 'ru' }
}

export async function loadLanguage() {
  const language = preferredLanguage()
  const messages = language === 'en' ? (await import('../content/locales/en.json')).default : {}
  configureLanguage(language, messages)
  document.documentElement.lang = language
}

export function chooseLanguage(language: Language) {
  const url = new URL(location.href)
  url.searchParams.set('lang', language)
  try { localStorage.setItem('faza.language', language) } catch { /* URL works without storage. */ }
  location.assign(url.href)
}
