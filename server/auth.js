import crypto from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(crypto.scrypt)
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7 // 7 days

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing ${name} in .env`)
    process.exit(1)
  }
  return value
}

export const AUTH_USERNAME = requireEnv('AUTH_USERNAME')
export const AUTH_PASSWORD = requireEnv('AUTH_PASSWORD')
export const AUTH_SECRET = requireEnv('AUTH_SECRET')

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function signToken(payload, ttlSec = TOKEN_TTL_SEC) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJson({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  })
  const data = `${header}.${body}`
  const sig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(data)
    .digest('base64url')
  return `${data}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const data = `${header}.${body}`
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(data)
    .digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const derived = await scrypt(String(password), salt, 64)
  return `${salt.toString('hex')}:${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const derived = await scrypt(String(password), salt, 64)
    const actual = Buffer.from(derived)
    if (actual.length !== expected.length) return false
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function publicUser(doc) {
  if (!doc) return null
  return {
    id: String(doc._id),
    username: doc.username,
    role: doc.role === 'admin' ? 'admin' : 'user',
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = verifyToken(token)
  if (!payload?.sub || !payload?.uid) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.user = {
    username: payload.sub,
    role: payload.role === 'admin' ? 'admin' : 'user',
    id: String(payload.uid),
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'ต้องเป็นแอดมินเท่านั้น' })
  }
  next()
}
