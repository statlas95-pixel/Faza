// Список внешних источников, которые пользователи предложили редактору: npm run candidates
// Читает базу <данные>/faza.db. Источник попадает в учебную базу только после проверки и записи в content/sources.yaml.
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
const file = path.join(process.env.FAZA_DATA_DIR ?? 'data', 'faza.db')
if (!fs.existsSync(file)) { console.log(`База ${file} не найдена — сервер ещё не запускался.`); process.exit(0) }
const db = new DatabaseSync(file, { readOnly: true })
const seen = new Map()
for (const r of db.prepare('SELECT data FROM user_state').all()) for (const s of JSON.parse(r.data).savedSources ?? []) if (s.suggested) { const x = seen.get(s.key) ?? { ...s, votes: 0, notes: [] }; x.votes++; if (s.note) x.notes.push(s.note); seen.set(s.key, x) }
if (!seen.size) console.log('Предложенных источников нет.')
for (const s of [...seen.values()].sort((a, b) => b.votes - a.votes)) console.log(`\n[${s.votes}] ${s.authors} (${s.year}). ${s.title}\n    ${s.doi ? 'doi:' + s.doi : s.url}  · тема: ${s.topic ?? '—'}${s.notes.length ? '\n    заметки: ' + s.notes.join(' | ') : ''}`)
