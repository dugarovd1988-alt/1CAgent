import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { analyzeWithGigaChat } from './gigachat.js'
import { initDirectories, validateDocument, createReceipt } from './oneCAdapter.js'
import { logger } from './logger.js'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

const dataDir = path.resolve('data')
fs.mkdirSync(dataDir, { recursive: true })
const db = new Database(path.join(dataDir, 'app.sqlite'))
db.pragma('journal_mode = WAL')
db.exec(
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('accountant','admin')),password_hash TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS journal_entries(id TEXT PRIMARY KEY,data TEXT NOT NULL,created_at INTEGER NOT NULL);`
)
initDirectories(db)

const uid = () => crypto.randomUUID()
const now = () => Date.now()

// Логирование запросов и ошибок
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) logger.info(`${req.method} ${req.path} -> ${res.statusCode}`)
  })
  next()
})

// Простой in-memory rate limit для /api/auth/login
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_WINDOW_MS = 15 * 60_000
const LOGIN_MAX_ATTEMPTS = 10
function loginRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || 'unknown'
  const entry = loginAttempts.get(key)
  const current = entry && entry.resetAt > now() ? entry : { count: 0, resetAt: now() + LOGIN_WINDOW_MS }
  current.count++
  loginAttempts.set(key, current)
  if (current.count > LOGIN_MAX_ATTEMPTS) {
    logger.info(`rate limit: слишком много попыток входа с ${key}`)
    return res.status(429).json({ error: 'Слишком много попыток входа, попробуйте позже' })
  }
  next()
}
setInterval(() => {
  for (const [key, entry] of loginAttempts) if (entry.resetAt <= now()) loginAttempts.delete(key)
}, LOGIN_WINDOW_MS).unref()

// Администратор управляется переменной ADMIN_PASSWORD: при старте пароль из
// окружения применяется к учётной записи (создаётся при первом запуске,
// обновляется при смене значения). Без ADMIN_PASSWORD генерируется случайный.
const email = process.env.ADMIN_EMAIL || 'admin@example.com'
let initialPassword: string | null = null
if (!process.env.ADMIN_PASSWORD) {
  initialPassword = crypto.randomBytes(12).toString('base64url')
  logger.info('ADMIN_PASSWORD не задан: сгенерирован случайный пароль администратора')
}
const password = process.env.ADMIN_PASSWORD || initialPassword!
const admin = db.prepare('SELECT * FROM users WHERE email=?').get(email) as any
if (!admin)
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(uid(), email, 'Администратор', 'admin', bcrypt.hashSync(password, 12), 0, now())
else if (process.env.ADMIN_PASSWORD && !bcrypt.compareSync(password, admin.password_hash))
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 12), admin.id)

type Req = express.Request & { user?: any }
function auth(req: Req, res: express.Response, next: express.NextFunction) {
  const u = req.cookies.sid &&
    db
      .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?')
      .get(req.cookies.sid, now()) as any
  if (!u || u.disabled) return res.status(401).json({ error: 'Требуется авторизация' })
  req.user = u
  next()
}
function isAdmin(req: Req, res: express.Response, next: express.NextFunction) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Недостаточно прав' })
  next()
}
const pub = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role })

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase()) as any
  if (!u || u.disabled || !bcrypt.compareSync(String(password || ''), u.password_hash))
    return res.status(401).json({ error: 'Неверный email или пароль' })
  const sid = uid()
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(sid, u.id, now() + 7 * 864e5)
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5 })
  res.json({ user: pub(u) })
})

app.post('/api/auth/logout', auth, (req: Req, res) => {
  db.prepare('DELETE FROM sessions WHERE id=?').run(req.cookies.sid)
  res.clearCookie('sid')
  res.json({ ok: true })
})

app.get('/api/auth/me', auth, (req: Req, res) => res.json({ user: pub(req.user) }))

app.post('/api/auth/change-password', auth, (req: Req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  if (!newPassword || String(newPassword).length < 8 || !bcrypt.compareSync(String(currentPassword || ''), req.user.password_hash))
    return res.status(400).json({ error: 'Неверный текущий пароль или новый пароль короче 8 символов' })
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPassword, 12), req.user.id)
  res.json({ ok: true })
})

app.get('/api/users', auth, isAdmin, (req, res) =>
  res.json({ users: db.prepare('SELECT id,email,name,role,disabled,created_at createdAt FROM users ORDER BY created_at').all() })
)

app.post('/api/users', auth, isAdmin, (req, res) => {
  const { email, name, role = 'accountant', password } = req.body || {}
  if (!email || !name || !password || String(password).length < 8)
    return res.status(400).json({ error: 'Заполните email, имя и пароль от 8 символов' })
  try {
    const id = uid()
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(id, String(email).toLowerCase(), name, role, bcrypt.hashSync(password, 12), 0, now())
    res.status(201).json({ id })
  } catch {
    return res.status(409).json({ error: 'Пользователь уже существует' })
  }
})

app.patch('/api/users/:id', auth, isAdmin, (req, res) => {
  const { role, disabled, name } = req.body || {}
  const result = db
    .prepare('UPDATE users SET role=COALESCE(?,role),disabled=COALESCE(?,disabled),name=COALESCE(?,name) WHERE id=?')
    .run(role, disabled == null ? null : disabled ? 1 : 0, name, req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Пользователь не найден' })
  res.json({ ok: true })
})

app.get('/api/journal', auth, (req, res) =>
  res.json({ entries: db.prepare('SELECT data FROM journal_entries ORDER BY created_at DESC').all().map((r: any) => JSON.parse(r.data)) })
)

app.post('/api/journal', auth, (req, res) => {
  const e = req.body
  if (!e?.id) return res.status(400).json({ error: 'Не указан идентификатор записи' })
  db.prepare('INSERT INTO journal_entries VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(e.id, JSON.stringify(e), e.createdAt || now())
  res.status(201).json(e)
})

app.patch('/api/journal/:id', auth, (req, res) => {
  const result = db.prepare('UPDATE journal_entries SET data=? WHERE id=?').run(JSON.stringify(req.body), req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Запись журнала не найдена' })
  res.json(req.body)
})

app.delete('/api/journal/:id', auth, (req, res) => {
  db.prepare('DELETE FROM journal_entries WHERE id=?').run(req.params.id)
  res.json({ ok: true })
})

app.get('/api/directories/counterparties', auth, (req, res) =>
  res.json({ items: db.prepare('SELECT id,name,inn,kpp FROM counterparties ORDER BY name').all() })
)

app.get('/api/directories/items', auth, (req, res) =>
  res.json({ items: db.prepare('SELECT id,name,unit FROM items ORDER BY name').all() })
)

app.post('/api/ai/analyze', auth, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'Введите текст заявки' })
    res.json({ data: await analyzeWithGigaChat(text) })
  } catch (e) {
    logger.error('GigaChat analyze failed', e)
    res.status(502).json({ error: e instanceof Error ? e.message : 'Ошибка GigaChat' })
  }
})

app.post('/api/documents/preview', auth, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'Введите текст заявки' })
    if (text.length > 50_000) return res.status(413).json({ error: 'Текст заявки слишком большой' })
    const ai = await analyzeWithGigaChat(text)
    const result = validateDocument(db, ai)
    res.json(result)
  } catch (e) {
    logger.error('document preview failed', e)
    res.status(502).json({ error: e instanceof Error ? e.message : 'Ошибка подготовки предпросмотра' })
  }
})

app.post('/api/documents/create', auth, (req: Req, res) => {
  try {
    const requestId = String(req.body?.requestId || '').trim()
    if (!requestId) return res.status(400).json({ error: 'Не указан идентификатор заявки' })
    if (!req.body?.draft) return res.status(400).json({ error: 'Черновик не передан' })
    const result = createReceipt(db, requestId, req.body.draft, req.user.id)
    if (!result.created)
      return res.status(422).json({ error: 'Документ не прошёл проверку', validation: result.validation, issues: result.validation.errors })
    res.status(result.duplicate ? 200 : 201).json({
      id: result.id,
      docNumber: result.number,
      documentType: result.documentType,
      createdAt: result.createdAt,
      duplicate: result.duplicate,
      counterparty: result.validation.counterparty,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка создания документа'
    logger.error('document create failed', e)
    res.status(message.includes('поддерживается') || message.includes('структур') ? 400 : 500).json({ error: message })
  }
})

const distDir = path.resolve('dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

if (process.argv.includes('--init-only')) process.exit(0)
app.listen(Number(process.env.PORT || 3001), () => {
  console.log(`API listening on http://localhost:${process.env.PORT || 3001}`)
  if (initialPassword) console.log(`Пароль администратора (${email}): ${initialPassword} — сохраните его и задайте ADMIN_PASSWORD в .env`)
})
