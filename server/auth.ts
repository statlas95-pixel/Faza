import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Config } from './config'
import type { Db } from './db'

// Авторизация: библиотека better-auth (email + пароль, серверные сессии в httpOnly-cookie, сброс пароля).
// Письмо со ссылкой сброса уходит по SMTP, если он настроен. Без SMTP (локальный запуск) письмо кладётся
// в папку <данные>/outbox — её видит только тот, кто запустил сервер. В журнал ссылки и токены не пишутся.
export async function createAuth(cfg: Config, db: Db) {
  async function deliver(to: string, subject: string, text: string) {
    if (cfg.smtp) {
      const nodemailer = (await import('nodemailer')).default
      await nodemailer.createTransport(cfg.smtp.url).sendMail({ from: cfg.smtp.from, to, subject, text })
      return
    }
    const dir = path.join(cfg.dataDir, 'outbox'); fs.mkdirSync(dir, { recursive: true })
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.createHash('sha256').update(to).digest('hex').slice(0, 8)}.txt`
    fs.writeFileSync(path.join(dir, name), `Кому: ${to}\nТема: ${subject}\n\n${text}\n`, { mode: 0o600 })
  }
  const auth = betterAuth({
    database: db as any, secret: cfg.authSecret, baseURL: cfg.baseUrl, basePath: '/api/auth', trustedOrigins: cfg.trustedOrigins,
    emailAndPassword: {
      enabled: true, minPasswordLength: 10, autoSignIn: true, resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, token }) => {
        await deliver(user.email, 'Фаза: восстановление доступа',
          `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${cfg.baseUrl}/#/account?reset=${token}\n\nЕсли вы не запрашивали восстановление, ничего делать не нужно.`)
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    advanced: { useSecureCookies: cfg.baseUrl.startsWith('https://') },
    logger: { level: 'error' },
  })
  const { runMigrations } = await getMigrations(auth.options)
  await runMigrations()
  return auth
}
export type Auth = Awaited<ReturnType<typeof createAuth>>
