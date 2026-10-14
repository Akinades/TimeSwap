import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import express from 'express'
import { MongoClient } from 'mongodb'
import {
  authMiddleware,
  publicUser,
  requireAdmin,
  signToken,
  verifyToken,
} from './auth.js'
import {
  authenticateUser,
  createUser,
  deleteUser,
  ensureAdminUser,
  findUserByUsername,
  listUsers,
  updateUserPassword,
  updateUserRole,
} from './users.js'
import {
  getWorkspaceForUser,
  migrateLegacyWorkspace,
  saveWorkspaceForUser,
} from './workspaces.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const PORT = Number(process.env.PORT) || 3001
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'timeswap'

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '25mb' }))

let client
let db
let migrated = false

async function getDb() {
  if (db) return db
  client = new MongoClient(MONGODB_URI)
  await client.connect()
  db = client.db(DB_NAME)
  await ensureAdminUser(db)
  if (!migrated) {
    await migrateLegacyWorkspace(db)
    migrated = true
  }
  return db
}

function issueAuthResponse(user) {
  const pub = publicUser(user)
  const token = signToken({
    sub: pub.username,
    role: pub.role,
    uid: pub.id,
  })
  return { token, username: pub.username, role: pub.role, id: pub.id }
}

app.get('/api/health', async (_req, res) => {
  try {
    const database = await getDb()
    await database.command({ ping: 1 })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    const database = await getDb()
    const user = await authenticateUser(database, username, password)
    if (!user) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }
    if (req.body?.adminOnly && user.role !== 'admin') {
      return res.status(403).json({ error: 'บัญชีนี้ไม่ใช่แอดมิน' })
    }
    res.json(issueAuthResponse(user))
  } catch (err) {
    console.error('POST /api/auth/login', err)
    res.status(500).json({ error: err.message || 'Login failed' })
  }
})

app.get('/api/auth/me', async (req, res) => {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const payload = verifyToken(token)
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const database = await getDb()
    const user = await findUserByUsername(database, payload.sub)
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const pub = publicUser(user)
    res.json(pub)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed' })
  }
})

app.get('/api/admin/users', authMiddleware, requireAdmin, async (_req, res) => {
  try {
    const database = await getDb()
    res.json({ users: await listUsers(database) })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list users' })
  }
})

app.post('/api/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const database = await getDb()
    const user = await createUser(database, {
      username: req.body?.username,
      password: req.body?.password,
      role: req.body?.role,
    })
    res.status(201).json({ user })
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create user' })
  }
})

app.patch(
  '/api/admin/users/:id/password',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const database = await getDb()
      const user = await updateUserPassword(
        database,
        req.params.id,
        req.body?.password,
      )
      res.json({ user })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to update password' })
    }
  },
)

app.patch(
  '/api/admin/users/:id/role',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const database = await getDb()
      const user = await updateUserRole(database, req.params.id, req.body?.role)
      res.json({ user })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to update role' })
    }
  },
)

app.delete(
  '/api/admin/users/:id',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const database = await getDb()
      await deleteUser(database, req.params.id, req.user.id)
      res.json({ ok: true })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Failed to delete user' })
    }
  },
)

app.get('/api/workspace', authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const database = await getDb()
    res.json(await getWorkspaceForUser(database, req.user.id))
  } catch (err) {
    console.error('GET /api/workspace', err)
    res.status(500).json({ error: err.message || 'Failed to load workspace' })
  }
})

app.put('/api/workspace', authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const { companies, activeCompanyId } = req.body || {}
    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'companies must be an array' })
    }

    const database = await getDb()
    const saved = await saveWorkspaceForUser(database, req.user.id, {
      companies,
      activeCompanyId,
    })
    res.json(saved)
  } catch (err) {
    console.error('PUT /api/workspace', err)
    res.status(500).json({ error: err.message || 'Failed to save workspace' })
  }
})

app.use(express.static(DIST))
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'), (err) => {
    if (err) res.status(404).end()
  })
})

// Bind all interfaces for Railway / Render / Docker
const server = app.listen(PORT, '0.0.0.0', async () => {
  try {
    await getDb()
    console.log(`TimeSwap listening on http://0.0.0.0:${PORT}`)
  } catch (err) {
    console.error('Failed to connect MongoDB', err)
    process.exit(1)
  }
})

async function shutdown() {
  try {
    await client?.close()
  } finally {
    process.exit(0)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

server.on('error', (err) => {
  console.error(err)
  process.exit(1)
})
