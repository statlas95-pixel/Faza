// Only public learning pages enter the report. Searches and personal routes never do.
export const publicPages = ['/', '/route', '/map', '/catalog', '/diagnostic', '/labs', '/sources', '/find', '/glossary', '/about']

export function publicPage(path: string) {
  if (publicPages.includes(path)) return path
  if (/^\/(glossary|sources)\/[\w-]+$/.test(path)) return path.split('/').slice(0, 2).join('/')
  return /^\/(topics|labs)\/[\w-]{1,80}$/.test(path) ? path : null
}

export interface StatisticsReport {
  collectionStart: string
  start: string
  end: string
  visitors: number
  returning: number
  accounts: number
  daily: { day: string; visitors: number; views: number; completions: number }[]
  popular: { page: string; views: number; completions: number }[]
}
