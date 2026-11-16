import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

// Вся конфигурация сервера — из переменных окружения (файл .env в корне проекта, см. .env.example).
// Секреты никогда не передаются в браузер и не пишутся в журнал.
try { if (fs.existsSync('.env')) process.loadEnvFile('.env') } catch { /* .env необязателен */ }
const env = process.env
const list = (v?: string) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export interface Config {
  port: number; dataDir: string; baseUrl: string; authSecret: string; trustedOrigins: string[]; production: boolean
  smtp?: { url: string; from: string }
  search: { crossrefMailto?: string; openalexKey?: string; timeoutMs: number; cacheHours: number; minGapMs: number }
  ai: { anthropicKey?: string; anthropicModels: string[]; openaiKey?: string; openaiBaseUrl?: string; openaiModels: string[]; dailyLimit: number; maxTokens: number; timeoutMs: number; maxInputChars: number }
}
export function loadConfig(over: Partial<Config> = {}): Config {
  const dataDir = over.dataDir ?? env.FAZA_DATA_DIR ?? 'data'
  fs.mkdirSync(dataDir, { recursive: true })
  // Секрет сессий: из окружения, иначе создаётся при первом запуске и хранится в папке данных (вне репозитория).
  let authSecret = env.FAZA_AUTH_SECRET
  if (!authSecret) {
    const f = path.join(dataDir, 'auth-secret')
    if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('base64url'), { mode: 0o600 })
    authSecret = fs.readFileSync(f, 'utf8').trim()
  }
  const port = Number(env.PORT ?? 8787)
  const baseUrl = (env.FAZA_BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, '')
  return {
    port, dataDir, baseUrl, authSecret, production: env.NODE_ENV === 'production',
    trustedOrigins: [baseUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', ...list(env.FAZA_TRUSTED_ORIGINS)],
    smtp: env.SMTP_URL ? { url: env.SMTP_URL, from: env.SMTP_FROM ?? 'faza@localhost' } : undefined,
    search: { crossrefMailto: env.CROSSREF_MAILTO || undefined, openalexKey: env.OPENALEX_API_KEY || undefined, timeoutMs: Number(env.SEARCH_TIMEOUT_MS ?? 15000), cacheHours: Number(env.SEARCH_CACHE_HOURS ?? 168), minGapMs: Number(env.SEARCH_MIN_GAP_MS ?? 1200) },
    ai: {
      anthropicKey: env.ANTHROPIC_API_KEY || undefined,
      anthropicModels: list(env.ANTHROPIC_MODELS ?? 'claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5'),
      openaiKey: env.OPENAI_API_KEY || undefined, openaiBaseUrl: env.OPENAI_BASE_URL || undefined, openaiModels: list(env.OPENAI_MODELS),
      dailyLimit: Number(env.AI_DAILY_LIMIT ?? 30), maxTokens: Number(env.AI_MAX_TOKENS ?? 8000),
      timeoutMs: Number(env.AI_TIMEOUT_MS ?? 90000), maxInputChars: Number(env.AI_MAX_INPUT_CHARS ?? 4000),
    },
    ...over,
  }
}
