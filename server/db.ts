import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

// Встроенный в Node SQLite: не требует компиляции и отдельного сервера БД. Файл — <папка данных>/faza.db.
// Собственные таблицы платформы версионируются здесь; таблицы авторизации создаёт better-auth (server/auth.ts).
const MIGRATIONS: string[] = [
  // 1 — версия 0.2
  `CREATE TABLE user_state (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
   CREATE TABLE attempts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, lab_id TEXT NOT NULL, at INTEGER NOT NULL, summary TEXT NOT NULL, detail TEXT);
   CREATE INDEX attempts_user ON attempts(user_id, at);
   CREATE TABLE imports (user_id TEXT NOT NULL, import_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, import_id));
   CREATE TABLE search_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL);
   CREATE TABLE ai_usage (user_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day));`,
  // One learner can import the same guest attempt into another account.
  `ALTER TABLE attempts RENAME TO attempts_v1;
   CREATE TABLE attempts (id TEXT NOT NULL, user_id TEXT NOT NULL, lab_id TEXT NOT NULL, at INTEGER NOT NULL, summary TEXT NOT NULL, detail TEXT, PRIMARY KEY(user_id, id));
   INSERT INTO attempts SELECT id, user_id, lab_id, at, summary, detail FROM attempts_v1;
   DROP TABLE attempts_v1;
   CREATE INDEX attempts_user ON attempts(user_id, at);`,
  `CREATE TABLE traffic_visitors (day TEXT NOT NULL, visitor TEXT NOT NULL,
     PRIMARY KEY(day, visitor)) WITHOUT ROWID;
   CREATE TABLE traffic_pages (day TEXT NOT NULL, page TEXT NOT NULL, views INTEGER NOT NULL, completions INTEGER NOT NULL,
     PRIMARY KEY(day, page)) WITHOUT ROWID;`,
]
export function transaction<T>(db: DatabaseSync, write: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = write()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
export function openDb(dataDir: string, file = 'faza.db') {
  const db = new DatabaseSync(file === ':memory:' ? file : path.join(dataDir, file))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, at INTEGER NOT NULL)')
  const done = new Set(db.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version))
  MIGRATIONS.forEach((sql, i) => {
    if (done.has(i + 1)) return
    db.exec('BEGIN'); try { db.exec(sql); db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(i + 1, Date.now()); db.exec('COMMIT') } catch (e) { db.exec('ROLLBACK'); throw e }
  })
  return db
}
export type Db = ReturnType<typeof openDb>
