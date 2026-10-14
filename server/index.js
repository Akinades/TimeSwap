import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { MongoClient } from 'mongodb'

const PORT = Number(process.env.PORT) || 3001
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'timeswap'
const WORKSPACE_ID = 'default'

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '25mb' }))

let client
let db

async function getDb() {
  if (db) return db
  client = new MongoClient(MONGODB_URI)
  await client.connect()
  db = client.db(DB_NAME)
  return db
}

function emptyWorkspace() {
  return { companies: [], activeCompanyId: null }
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

app.get('/api/workspace', async (_req, res) => {
  try {
    const database = await getDb()
    const doc = await database.collection('workspaces').findOne({ _id: WORKSPACE_ID })
    if (!doc) {
      return res.json(emptyWorkspace())
    }
    res.json({
      companies: Array.isArray(doc.companies) ? doc.companies : [],
      activeCompanyId: doc.activeCompanyId ?? null,
    })
  } catch (err) {
    console.error('GET /api/workspace', err)
    res.status(500).json({ error: err.message || 'Failed to load workspace' })
  }
})

app.put('/api/workspace', async (req, res) => {
  try {
    const { companies, activeCompanyId } = req.body || {}
    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'companies must be an array' })
    }

    const database = await getDb()
    const payload = {
      companies,
      activeCompanyId: activeCompanyId ?? null,
      updatedAt: new Date().toISOString(),
    }

    await database.collection('workspaces').updateOne(
      { _id: WORKSPACE_ID },
      { $set: payload },
      { upsert: true },
    )

    res.json({
      companies: payload.companies,
      activeCompanyId: payload.activeCompanyId,
    })
  } catch (err) {
    console.error('PUT /api/workspace', err)
    res.status(500).json({ error: err.message || 'Failed to save workspace' })
  }
})

const server = app.listen(PORT, () => {
  console.log(`TimeSwap API listening on http://localhost:${PORT}`)
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
