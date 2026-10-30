import { createCompanyId } from '../config.js'
import {
  normalizeEmployeeId,
  normalizePersonName,
} from './employeeIdentity.js'

export const recordKey = (r) => `${r.employeeId}|${r.date}`
const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Keep a single row per employee|date (last write wins).
 * Prevents store-wide edits updating one copy while person view reads another.
 */
export function dedupeRecords(records) {
  const map = new Map()
  for (const r of records || []) {
    if (!r?.employeeId || !r?.date) continue
    map.set(recordKey(r), r)
  }
  return [...map.values()]
}

/** Replace all rows for employee|date with one record. Mutates and returns `records`. */
export function writeRecord(records, record) {
  const key = recordKey(record)
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (recordKey(records[i]) === key) records.splice(i, 1)
  }
  records.push(record)
  return records
}

/**
 * Map an imported employee onto an existing one when the ID differs
 * but the person is the same (name match, or numeric ID with leading zeros).
 */
function resolveCanonicalEmployeeId(imported, employees, byName, byNormId) {
  if (employees.has(imported.id)) return imported.id

  const normId = normalizeEmployeeId(imported.id)
  if (normId && byNormId.has(normId)) return byNormId.get(normId)

  const nameKey = normalizePersonName(imported.name)
  if (nameKey && byName.has(nameKey)) return byName.get(nameKey)

  return imported.id
}

export function planImport(company, parsed, mode = 'skip') {
  const employees = new Map(company.employees.map((e) => [e.id, e]))
  const byName = new Map()
  const byNormId = new Map()
  for (const e of company.employees) {
    const nameKey = normalizePersonName(e.name)
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, e.id)
    const normId = normalizeEmployeeId(e.id)
    if (normId && !byNormId.has(normId)) byNormId.set(normId, e.id)
  }

  const idRemap = new Map()
  for (const e of parsed.employees || []) {
    const canonicalId = resolveCanonicalEmployeeId(
      e,
      employees,
      byName,
      byNormId,
    )
    if (canonicalId !== e.id) idRemap.set(e.id, canonicalId)

    if (employees.has(canonicalId)) {
      const prev = employees.get(canonicalId)
      employees.set(canonicalId, {
        ...prev,
        name: e.name || prev.name,
        department:
          e.department && e.department !== '—'
            ? e.department
            : prev.department,
      })
    } else {
      employees.set(canonicalId, { ...e, id: canonicalId })
      const nameKey = normalizePersonName(e.name)
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, canonicalId)
      const normId = normalizeEmployeeId(canonicalId)
      if (normId && !byNormId.has(normId)) byNormId.set(normId, canonicalId)
    }
  }

  const existing = new Map(company.records.map((r) => [recordKey(r), r]))
  const seen = new Set()
  const rows = []
  let added = 0,
    updated = 0,
    duplicates = 0,
    internalDuplicates = 0
  let nextId = Math.max(0, ...company.records.map((r) => Number(r.id) || 0)) + 1
  for (const r of parsed.records) {
    const employeeId = idRemap.get(r.employeeId) ?? r.employeeId
    const mapped = { ...r, employeeId }
    const key = recordKey(mapped)
    if (seen.has(key)) {
      internalDuplicates++
      continue
    }
    seen.add(key)
    const old = existing.get(key)
    if (old) duplicates++
    const action = old ? (mode === 'replace' ? 'update' : 'skip') : 'add'
    rows.push({ ...mapped, action })
    if (action === 'skip') continue
    if (old) updated++
    else added++
    existing.set(key, { ...mapped, id: old?.id ?? nextId++ })
  }
  return {
    records: [...existing.values()],
    employees: [...employees.values()],
    rows,
    added,
    updated,
    duplicates,
    internalDuplicates,
  }
}

export function withHistory(company, next, type, detail = '', summary = {}) {
  if (type === 'import')
    return {
      ...next,
      activityHistory: [
        {
          id: createCompanyId(),
          at: new Date().toISOString(),
          type,
          detail,
          summary,
          changes: [],
        },
        ...(company.activityHistory || []),
      ],
    }
  const before = new Map(company.records.map((r) => [recordKey(r), r]))
  const after = new Map(next.records.map((r) => [recordKey(r), r]))
  const keys = new Set([...before.keys(), ...after.keys()])
  const changes = [...keys]
    .filter((k) => !equal(before.get(k), after.get(k)))
    .map((k) => ({
      key: k,
      before: before.get(k) ?? null,
      after: after.get(k) ?? null,
    }))
  if (!changes.length && type !== 'import') return next
  const entry = {
    id: createCompanyId(),
    at: new Date().toISOString(),
    type,
    detail,
    changes,
    swapId: type === 'swap' ? next.swapHistory[0]?.id : null,
  }
  return {
    ...next,
    activityHistory: [entry, ...(company.activityHistory || [])],
  }
}

export function canUndo(company, entry) {
  if (
    !entry ||
    entry.undoneAt ||
    !['edit', 'swap'].includes(entry.type) ||
    !entry.changes.length
  )
    return false
  const current = new Map(company.records.map((r) => [recordKey(r), r]))
  return entry.changes.every((c) => equal(current.get(c.key), c.after))
}

export function undoHistory(company, id) {
  const entry = company.activityHistory?.find((e) => e.id === id)
  if (!canUndo(company, entry)) return company
  const records = new Map(company.records.map((r) => [recordKey(r), r]))
  entry.changes.forEach((c) =>
    c.before ? records.set(c.key, c.before) : records.delete(c.key),
  )
  return {
    ...company,
    records: [...records.values()],
    swapHistory: company.swapHistory.filter((s) => s.id !== entry.swapId),
    activityHistory: company.activityHistory.map((e) =>
      e.id === id ? { ...e, undoneAt: new Date().toISOString() } : e,
    ),
  }
}
