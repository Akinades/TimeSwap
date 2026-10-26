import {
  computeLateMinutes,
  computeOtHours,
  deriveStatus,
  formatTime,
  punchIssue,
  syncAttendanceRemark,
} from './attendance.js'

/**
 * Set one date as a work day or holiday for a single employee.
 * Mutates `records`. Used when the store adds a holiday or opens a day
 * without pairing it with another date.
 */
export function writeStoreDay(
  records,
  employeeId,
  date,
  dayType,
  { cfg, useStandard, nextId },
) {
  const idx = records.findIndex(
    (r) => r.employeeId === employeeId && r.date === date,
  )
  const existing = idx >= 0 ? records[idx] : null
  const isOff = dayType === 'off'

  let scheduledIn
  let scheduledOut
  let punchIn
  let punchOut

  if (isOff) {
    scheduledIn = 'OFF'
    scheduledOut = 'OFF'
    punchIn = '—'
    punchOut = '—'
  } else {
    scheduledIn =
      existing?.scheduledIn &&
      existing.scheduledIn !== 'OFF' &&
      existing.scheduledIn !== '—'
        ? existing.scheduledIn
        : cfg.standardIn
    scheduledOut =
      existing?.scheduledOut &&
      existing.scheduledOut !== 'OFF' &&
      existing.scheduledOut !== '—'
        ? existing.scheduledOut
        : cfg.standardOut

    const keptIn =
      existing?.actualIn &&
      existing.actualIn !== '—' &&
      existing.actualIn !== 'OFF'
        ? formatTime(existing.actualIn)
        : ''
    const keptOut =
      existing?.actualOut &&
      existing.actualOut !== '—' &&
      existing.actualOut !== 'OFF'
        ? formatTime(existing.actualOut)
        : ''
    const inTime =
      keptIn && keptIn !== '—' && keptIn !== 'OFF'
        ? keptIn
        : useStandard
          ? cfg.standardIn
          : ''
    const outTime =
      keptOut && keptOut !== '—' && keptOut !== 'OFF'
        ? keptOut
        : useStandard
          ? cfg.standardOut
          : ''
    punchIn = inTime ? formatTime(inTime) : '—'
    punchOut = outTime ? formatTime(outTime) : '—'
    if (punchIn === 'OFF') punchIn = '—'
    if (punchOut === 'OFF') punchOut = '—'
  }

  const status = isOff
    ? 'Holiday'
    : deriveStatus({
        scheduledIn,
        actualIn: punchIn,
        actualOut: punchOut,
      })

  const draft = {
    scheduledIn,
    scheduledOut,
    actualIn: punchIn,
    actualOut: punchOut,
    status,
  }
  const syncedRemark = syncAttendanceRemark(existing?.remark || '', {
    dayType,
    issue: punchIssue(draft),
  })

  const record = {
    id: existing?.id ?? nextId(),
    employeeId,
    date,
    scheduledIn,
    scheduledOut,
    actualIn: punchIn,
    actualOut: punchOut,
    status,
    isSwapped: false,
    lateMinutes:
      scheduledIn === 'OFF' ? 0 : computeLateMinutes(scheduledIn, punchIn),
    otHours:
      scheduledOut === 'OFF' ? 0 : computeOtHours(scheduledOut, punchOut),
    scheduleSource: 'manual',
    remark: syncedRemark || undefined,
  }

  if (idx >= 0) records[idx] = record
  else records.push(record)
  return record
}
