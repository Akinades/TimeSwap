import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeStoreDay } from '../src/lib/storeDay.js'
import { dedupeRecords, writeRecord } from '../src/lib/workflow.js'

const cfg = { standardIn: '09:00', standardOut: '18:00' }

test('extra store holiday clears punches without a paired work day', () => {
  const records = [
    {
      id: 1,
      employeeId: 'e1',
      date: '2026-10-27',
      scheduledIn: '09:00',
      scheduledOut: '18:00',
      actualIn: '09:05',
      actualOut: '18:10',
      status: 'Normal',
      remark: 'ไม่สแกนออก',
    },
  ]
  writeStoreDay(records, 'e1', '2026-10-27', 'off', {
    cfg,
    useStandard: false,
    nextId: () => 99,
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].scheduledIn, 'OFF')
  assert.equal(records[0].actualIn, '—')
  assert.equal(records[0].actualOut, '—')
  assert.equal(records[0].status, 'Holiday')
  assert.equal(records[0].lateMinutes, 0)
  assert.equal(records[0].remark, undefined)
})

test('store work day with useStandard replaces schedule and punches', () => {
  const records = [
    {
      id: 2,
      employeeId: 'e1',
      date: '2026-10-28',
      scheduledIn: '08:30',
      scheduledOut: '17:30',
      actualIn: '08:59',
      actualOut: '17:02',
      status: 'Late',
    },
  ]
  writeStoreDay(records, 'e1', '2026-10-28', 'work', {
    cfg,
    useStandard: true,
    nextId: () => 100,
  })
  assert.equal(records[0].scheduledIn, '09:00')
  assert.equal(records[0].scheduledOut, '18:00')
  assert.equal(records[0].actualIn, '09:00')
  assert.equal(records[0].actualOut, '18:00')
  assert.equal(records[0].status, 'Normal')
  assert.equal(records[0].lateMinutes, 0)
})

test('store work day without useStandard replaces schedule but keeps punches', () => {
  const records = [
    {
      id: 3,
      employeeId: 'e1',
      date: '2026-10-28',
      scheduledIn: '08:30',
      scheduledOut: '17:30',
      actualIn: '08:59',
      actualOut: '17:02',
      status: 'Late',
    },
  ]
  writeStoreDay(records, 'e1', '2026-10-28', 'work', {
    cfg,
    useStandard: false,
    nextId: () => 101,
  })
  assert.equal(records[0].scheduledIn, '09:00')
  assert.equal(records[0].scheduledOut, '18:00')
  assert.equal(records[0].actualIn, '08:59')
  assert.equal(records[0].actualOut, '17:02')
})

test('creates a holiday row when the employee has no record that day', () => {
  const records = []
  writeStoreDay(records, 'e2', '2026-10-27', 'off', {
    cfg,
    useStandard: false,
    nextId: () => 7,
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].id, 7)
  assert.equal(records[0].employeeId, 'e2')
  assert.equal(records[0].status, 'Holiday')
})

test('writeStoreDay collapses duplicate employee|date rows', () => {
  const records = [
    {
      id: 1,
      employeeId: 'e1',
      date: '2026-10-14',
      scheduledIn: 'OFF',
      scheduledOut: 'OFF',
      actualIn: '—',
      actualOut: '—',
      status: 'Holiday',
    },
    {
      id: 2,
      employeeId: 'e1',
      date: '2026-10-14',
      scheduledIn: 'OFF',
      scheduledOut: 'OFF',
      actualIn: '—',
      actualOut: '—',
      status: 'Holiday',
    },
  ]
  writeStoreDay(records, 'e1', '2026-10-14', 'work', {
    cfg,
    useStandard: true,
    nextId: () => 99,
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].scheduledIn, '09:00')
  assert.equal(records[0].status, 'Normal')
  assert.equal(records[0].actualIn, '09:00')
})

test('store work with punches matches shift template not standard hours', () => {
  const records = [
    {
      id: 4,
      employeeId: 'e1',
      date: '2026-10-06',
      scheduledIn: 'OFF',
      scheduledOut: 'OFF',
      actualIn: '—',
      actualOut: '—',
      status: 'Holiday',
    },
  ]
  // Simulate table edit: keep punches 08:30–19:00 on a work day
  records[0].actualIn = '08:30'
  records[0].actualOut = '19:00'
  writeStoreDay(records, 'e1', '2026-10-06', 'work', {
    cfg: {
      standardIn: '08:00',
      standardOut: '19:00',
      inferShiftFromPunch: true,
      shiftTemplates: [
        { id: '1', name: 'กะเช้า', in: '08:00', out: '18:00' },
        { id: '2', name: 'กะสาย', in: '08:30', out: '19:00' },
      ],
    },
    useStandard: false,
    nextId: () => 102,
  })
  assert.equal(records[0].scheduledIn, '08:30')
  assert.equal(records[0].scheduledOut, '19:00')
  assert.equal(records[0].shiftLabel, 'กะสาย')
  assert.equal(records[0].status, 'Normal')
  assert.equal(records[0].lateMinutes, 0)
})

test('dedupeRecords keeps last row per employee|date', () => {
  const rows = dedupeRecords([
    { id: 1, employeeId: 'e1', date: '2026-10-01', status: 'Holiday' },
    { id: 2, employeeId: 'e1', date: '2026-10-01', status: 'Normal' },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 2)
  assert.equal(rows[0].status, 'Normal')
})

test('writeRecord replaces every matching key', () => {
  const records = [
    { id: 1, employeeId: 'e1', date: '2026-10-01', status: 'A' },
    { id: 2, employeeId: 'e1', date: '2026-10-01', status: 'B' },
  ]
  writeRecord(records, {
    id: 9,
    employeeId: 'e1',
    date: '2026-10-01',
    status: 'C',
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].status, 'C')
})
