import { loadConfig } from './config'
import { openDb } from './db'
import { createAuth } from './auth'
import { loadContent } from './content'
import { createTutor } from './ai'
import { createApp } from './app'

const cfg = loadConfig()
const db = openDb(cfg.dataDir)
const auth = await createAuth(cfg, db)
const tutor = createTutor(cfg)
const app = createApp({ cfg, db, auth, content: loadContent(), tutor })
app.listen(cfg.port, () => {
  const st = tutor.status()
  console.log(`Фаза 0.2 — сервер запущен: ${cfg.baseUrl}`)
  console.log(`  данные: ${cfg.dataDir} · почта: ${cfg.smtp ? 'SMTP' : `папка ${cfg.dataDir}/outbox`}`)
  console.log(`  ИИ-наставник: ${st.configured ? st.models.map((m) => m.id).join(', ') : 'не настроен (см. .env.example)'}`)
})
