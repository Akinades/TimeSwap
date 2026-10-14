import { ObjectId } from 'mongodb'
import {
  AUTH_PASSWORD,
  AUTH_USERNAME,
  hashPassword,
  publicUser,
  verifyPassword,
} from './auth.js'

export async function ensureAdminUser(db) {
  const users = db.collection('users')
  await users.createIndex({ username: 1 }, { unique: true })
  const count = await users.countDocuments()
  if (count > 0) return

  const now = new Date().toISOString()
  await users.insertOne({
    username: AUTH_USERNAME,
    passwordHash: await hashPassword(AUTH_PASSWORD),
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  })
  console.log(`Seeded admin user "${AUTH_USERNAME}" from .env`)
}

export async function findUserByUsername(db, username) {
  return db.collection('users').findOne({
    username: String(username || '').trim(),
  })
}

export async function findUserById(db, id) {
  try {
    return db.collection('users').findOne({ _id: new ObjectId(id) })
  } catch {
    return null
  }
}

export async function listUsers(db) {
  const docs = await db
    .collection('users')
    .find({})
    .project({ passwordHash: 0 })
    .sort({ role: 1, username: 1 })
    .toArray()
  return docs.map(publicUser)
}

export async function createUser(db, { username, password, role = 'user' }) {
  const name = String(username || '').trim()
  if (!name) throw new Error('กรุณากรอกชื่อผู้ใช้')
  if (name.length < 2) throw new Error('ชื่อผู้ใช้สั้นเกินไป')
  if (!password || String(password).length < 6) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  }
  const nextRole = role === 'admin' ? 'admin' : 'user'
  const existing = await findUserByUsername(db, name)
  if (existing) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว')

  const now = new Date().toISOString()
  const doc = {
    username: name,
    passwordHash: await hashPassword(password),
    role: nextRole,
    createdAt: now,
    updatedAt: now,
  }
  const result = await db.collection('users').insertOne(doc)
  return publicUser({ ...doc, _id: result.insertedId })
}

export async function updateUserPassword(db, id, password) {
  if (!password || String(password).length < 6) {
    throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
  }
  const user = await findUserById(db, id)
  if (!user) throw new Error('ไม่พบผู้ใช้')
  await db.collection('users').updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await hashPassword(password),
        updatedAt: new Date().toISOString(),
      },
    },
  )
  return publicUser(user)
}

export async function updateUserRole(db, id, role) {
  const nextRole = role === 'admin' ? 'admin' : 'user'
  const user = await findUserById(db, id)
  if (!user) throw new Error('ไม่พบผู้ใช้')

  if (user.role === 'admin' && nextRole !== 'admin') {
    const adminCount = await db.collection('users').countDocuments({ role: 'admin' })
    if (adminCount <= 1) {
      throw new Error('ต้องเหลือแอดมินอย่างน้อย 1 คน')
    }
  }

  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { role: nextRole, updatedAt: new Date().toISOString() } },
  )
  return publicUser({ ...user, role: nextRole })
}

export async function deleteUser(db, id, actorId) {
  const user = await findUserById(db, id)
  if (!user) throw new Error('ไม่พบผู้ใช้')
  if (String(user._id) === String(actorId)) {
    throw new Error('ลบบัญชีตัวเองไม่ได้')
  }
  if (user.role === 'admin') {
    const adminCount = await db.collection('users').countDocuments({ role: 'admin' })
    if (adminCount <= 1) {
      throw new Error('ต้องเหลือแอดมินอย่างน้อย 1 คน')
    }
  }
  await db.collection('users').deleteOne({ _id: user._id })
  // Remove that account's private workspace too
  await db.collection('workspaces').deleteOne({ _id: `user:${String(user._id)}` })
  return { ok: true }
}

export async function authenticateUser(db, username, password) {
  const user = await findUserByUsername(db, username)
  if (!user) return null
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return null
  return user
}
