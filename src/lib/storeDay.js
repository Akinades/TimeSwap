import {
  computeLateMinutes,
  computeOtHours,
  deriveStatus,
  formatTime,
  punchIssue,
  syncAttendanceRemark,
} from './attendance.js'
import { classifyByRoutine, normalizeSettings } from './shiftRoutine.js'
import { writeRecord } from './workflow.js'

/**
 * Set one date as a work day or holiday for a single employee.
 * Mutates `records`. Used when the store adds a holiday or opens a day
 * without pairing it with another date.
 *
 * Work day always applies company standard schedule (replaces prior hours).
 * When `useStandard` is true, punch in/out are also replaced with those hours.
 */
export function writeStoreDay(
  records,
  employeeId,
  date,
  dayType,
  { cfg, useStandard, nextId, department },
) {
  const settings = normalizeSettings(cfg)
  const existing =
    [...records]
      .reverse()
      .find((r) => r.employeeId === employeeId && r.date === date) || null
  const isOff = dayType === 'off'

  let scheduledIn
  let scheduledOut
  let punchIn
  let punchOut
  let status
  let lateMinutes = 0
  let otHours = 0
  let scheduleSource = 'manual'
  let shiftLabel
  let shiftId

  if (isOff) {
    scheduledIn = 'OFF'
    scheduledOut = 'OFF'
    punchIn = '—'
    punchOut = '—'
    status = 'Holiday'
  } else {
    if (useStandard) {
      punchIn = formatTime(settings.standardIn)
      punchOut = formatTime(settings.standardOut)
    } else {
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
      punchIn = keptIn && keptIn !== '—' && keptIn !== 'OFF' ? keptIn : '—'
      punchOut = keptOut && keptOut !== '—' && keptOut !== 'OFF' ? keptOut : '—'
    }

    const punched = punchIn !== '—' || punchOut !== '—'
    const canInfer =
      punched &&
      settings.inferShiftFromPunch &&
      settings.shiftTemplates.length > 0

    if (canInfer) {
      const classified = classifyByRoutine({
        date,
        actualIn: punchIn,
        actualOut: punchOut,
        settings,
        department,
      })
      scheduledIn = classified.scheduledIn
      scheduledOut = classified.scheduledOut
      status = classified.status
      lateMinutes = classified.lateMinutes
      otHours = classified.otHours
      scheduleSource = classified.scheduleSource || 'inferred'
      shiftLabel = classified.shiftLabel || undefined
      shiftId = classified.shiftId || undefined
    } else {
      scheduledIn = formatTime(settings.standardIn)
      scheduledOut = formatTime(settings.standardOut)
      status = deriveStatus({
        scheduledIn,
        actualIn: punchIn,
        actualOut: punchOut,
      })
      lateMinutes = computeLateMinutes(scheduledIn, punchIn)
      otHours = computeOtHours(scheduledOut, punchOut)
    }
  }

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
    lateMinutes,
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
    lateMinutes,
    otHours,
    scheduleSource,
    shiftLabel,
    shiftId,
    remark: syncedRemark || undefined,
  }

  writeRecord(records, record)
  return record
}
