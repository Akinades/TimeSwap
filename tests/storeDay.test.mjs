import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeStoreDay } from '../src/lib/storeDay.js'

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

test('store work day keeps existing punches and fills only missing ones', () => {
  const records = [
    {
      id: 2,
      employeeId: 'e1',
      date: '2026-10-28',
      scheduledIn: 'OFF',
      scheduledOut: 'OFF',
      actualIn: '10:00',
      actualOut: '—',
      status: 'Holiday',
    },
  ]
  writeStoreDay(records, 'e1', '2026-10-28', 'work', {
    cfg,
    useStandard: true,
    nextId: () => 100,
  })
  assert.equal(records[0].scheduledIn, '09:00')
  assert.equal(records[0].actualIn, '10:00')
  assert.equal(records[0].actualOut, '18:00')
  assert.equal(records[0].status, 'Late')
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
