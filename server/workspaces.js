const LEGACY_WORKSPACE_ID = 'default'

export function workspaceIdForUser(userId) {
  if (!userId) throw new Error('Missing user id for workspace')
  return `user:${userId}`
}

export function emptyWorkspace() {
  return { companies: [], activeCompanyId: null }
}

/**
 * One-time: move shared "default" workspace onto the first admin account.
 */
export async function migrateLegacyWorkspace(db) {
  const legacy = await db
    .collection('workspaces')
    .findOne({ _id: LEGACY_WORKSPACE_ID })
  if (!legacy) return

  const admin = await db.collection('users').findOne({ role: 'admin' })
  if (!admin) return

  const targetId = workspaceIdForUser(String(admin._id))
  const existing = await db.collection('workspaces').findOne({ _id: targetId })
  if (existing) {
    // Admin already has a workspace — drop legacy shared doc
    await db.collection('workspaces').deleteOne({ _id: LEGACY_WORKSPACE_ID })
    console.log('Removed legacy shared workspace (admin already has one)')
    return
  }

  const { _id, ...rest } = legacy
  await db.collection('workspaces').insertOne({
    ...rest,
    _id: targetId,
    userId: String(admin._id),
    migratedFrom: LEGACY_WORKSPACE_ID,
    updatedAt: new Date().toISOString(),
  })
  await db.collection('workspaces').deleteOne({ _id: LEGACY_WORKSPACE_ID })
  console.log(`Migrated legacy workspace → ${targetId}`)
}

export async function getWorkspaceForUser(db, userId) {
  const doc = await db
    .collection('workspaces')
    .findOne({ _id: workspaceIdForUser(userId) })
  if (!doc) return emptyWorkspace()
  return {
    companies: Array.isArray(doc.companies) ? doc.companies : [],
    activeCompanyId: doc.activeCompanyId ?? null,
  }
}

export async function saveWorkspaceForUser(db, userId, workspace) {
  const payload = {
    companies: workspace.companies ?? [],
    activeCompanyId: workspace.activeCompanyId ?? null,
    userId: String(userId),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('workspaces').updateOne(
    { _id: workspaceIdForUser(userId) },
    { $set: payload },
    { upsert: true },
  )
  return {
    companies: payload.companies,
    activeCompanyId: payload.activeCompanyId,
  }
}
