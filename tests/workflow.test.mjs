import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  planImport,
  withHistory,
  canUndo,
  undoHistory,
} from '../src/lib/workflow.js'
const record = {
  id: 1,
  employeeId: 'e1',
  date: '2026-10-01',
  actualIn: '08:00',
  actualOut: '17:00',
  status: 'Normal',
}
const company = {
  records: [record],
  employees: [{ id: 'e1', name: 'Original', phone: '123' }],
  swapHistory: [],
}
const parsed = {
  records: [
    { ...record, actualIn: '09:00' },
    { ...record, date: '2026-10-02' },
    { ...record, date: '2026-10-02' },
  ],
  employees: [
    { id: 'e1', name: 'Imported' },
    { id: 'e2', name: 'New' },
  ],
}
test('preview leaves source data untouched, skips existing and in-file duplicates', () => {
  const before = JSON.stringify(company)
  const plan = planImport(company, parsed)
  assert.equal(JSON.stringify(company), before)
  assert.equal(plan.added, 1)
  assert.equal(plan.updated, 0)
  assert.equal(plan.duplicates, 1)
  assert.equal(plan.internalDuplicates, 1)
  assert.equal(plan.records.length, 2)
  assert.equal(plan.records[0].actualIn, '08:00')
  assert.equal(plan.employees[0].phone, '123')
})
test('replace only updates matching keys and preserves stable IDs', () => {
  const plan = planImport(company, parsed, 'replace')
  assert.equal(plan.updated, 1)
  assert.equal(plan.records[0].id, 1)
  assert.equal(plan.records[0].actualIn, '09:00')
  assert.equal(plan.records[1].id, 2)
})
test('edit logs before and after and can undo exactly once', () => {
  const changed = withHistory(
    company,
    { ...company, records: [{ ...record, actualIn: '09:00' }] },
    'edit',
  )
  const entry = changed.activityHistory[0]
  assert.equal(entry.changes[0].before.actualIn, '08:00')
  assert.equal(canUndo(changed, entry), true)
  const restored = undoHistory(changed, entry.id)
  assert.deepEqual(restored.records, company.records)
  assert.equal(canUndo(restored, restored.activityHistory[0]), false)
})
test('undo refuses to overwrite a subsequent edit', () => {
  const changed = withHistory(
    company,
    { ...company, records: [{ ...record, actualIn: '09:00' }] },
    'edit',
  )
  const later = { ...changed, records: [{ ...record, actualIn: '10:00' }] }
  assert.equal(canUndo(later, changed.activityHistory[0]), false)
  assert.equal(undoHistory(later, changed.activityHistory[0].id), later)
})
test('undo removes newly created records and the corresponding swap history', () => {
  const changed = withHistory(
    company,
    {
      ...company,
      records: [
        { ...record, status: 'Holiday' },
        { ...record, id: 2, date: '2026-10-02' },
      ],
      swapHistory: [{ id: 'swap-1' }],
    },
    'swap',
  )
  const restored = undoHistory(changed, changed.activityHistory[0].id)
  assert.deepEqual(restored.records, company.records)
  assert.equal(restored.swapHistory.length, 0)
})
test('import entries are reviewable but cannot be undone as time edits', () => {
  const changed = withHistory(
    company,
    { ...company, records: planImport(company, parsed).records },
    'import',
    'sample.csv',
  )
  assert.equal(canUndo(changed, changed.activityHistory[0]), false)
})
test('import merges same person when name matches but employee IDs differ', () => {
  const plan = planImport(company, {
    employees: [{ id: 'machine-99', name: 'Original', department: 'ครัว' }],
    records: [
      {
        ...record,
        id: 9,
        employeeId: 'machine-99',
        date: '2026-10-03',
      },
    ],
  })
  assert.equal(plan.employees.length, 1)
  assert.equal(plan.employees[0].id, 'e1')
  assert.equal(plan.records.some((r) => r.employeeId === 'e1' && r.date === '2026-10-03'), true)
  assert.equal(plan.records.every((r) => r.employeeId !== 'machine-99'), true)
})
test('import merges numeric IDs that differ only by leading zeros', () => {
  const base = {
    records: [],
    employees: [{ id: '001', name: 'Somchai' }],
    swapHistory: [],
  }
  const plan = planImport(base, {
    employees: [{ id: '1', name: 'Somchai' }],
    records: [
      {
        ...record,
        employeeId: '1',
        date: '2026-10-05',
      },
    ],
  })
  assert.equal(plan.employees.length, 1)
  assert.equal(plan.employees[0].id, '001')
  assert.equal(plan.records[0].employeeId, '001')
})
