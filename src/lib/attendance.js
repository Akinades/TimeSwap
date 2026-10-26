import { shiftRules } from '../config.js'

/** Parse "HH:mm" or "H:mm" to minutes since midnight. Returns null if invalid/OFF/empty. */
export function timeToMinutes(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw || raw === '—' || raw === '-' || /^off$/i.test(raw)) return null
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatTime(value) {
  if (value == null || value === '') return '—'
  const raw = String(value).trim()
  if (!raw || /^off$/i.test(raw)) return 'OFF'

  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/)
  if (ampm) {
    let h = Number(ampm[1])
    const m = ampm[2]
    const period = ampm[3].toUpperCase()
    if (period === 'AM') {
      if (h === 12) h = 0
    } else if (h !== 12) {
      h += 12
    }
    return `${String(h).padStart(2, '0')}:${m}`
  }

  if (raw.includes(':')) {
    const parts = raw.split(':')
    const mm = parts[1].replace(/\D/g, '').slice(0, 2)
    return `${parts[0].padStart(2, '0')}:${mm.padStart(2, '0')}`
  }
  return raw
}

export function computeLateMinutes(scheduledIn, actualIn, threshold = shiftRules.lateThresholdMinutes) {
  const sched = timeToMinutes(scheduledIn)
  const actual = timeToMinutes(actualIn)
  if (sched == null || actual == null) return 0
  const diff = actual - sched
  return diff > threshold ? diff : 0
}

export function computeOtHours(scheduledOut, actualOut, grace = shiftRules.otAfterMinutes) {
  const sched = timeToMinutes(scheduledOut)
  const actual = timeToMinutes(actualOut)
  if (sched == null || actual == null) return 0
  const diff = actual - sched
  if (diff <= grace) return 0
  return Math.round((diff / 60) * 100) / 100
}

export const LEAVE_STATUSES = [
  'Leave-Personal',
  'Leave-Sick',
  'Leave-Vacation',
]

/**
 * Detect leave type from status / remark text (Thai or English).
 * Returns Leave-Personal | Leave-Sick | Leave-Vacation | null
 */
export function detectLeaveStatus(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  if (LEAVE_STATUSES.includes(raw)) return raw

  const s = raw.toLowerCase()
  if (
    /leave-vacation|annual\s*leave|vacation|ลาพัก|พักร้อน|ลาประจำปี/.test(s)
  ) {
    return 'Leave-Vacation'
  }
  if (/leave-sick|sick\s*leave|ลาป่วย/.test(s)) return 'Leave-Sick'
  if (
    /leave-personal|personal\s*leave|ลากิจ|ลาส่วนตัว|business\s*leave/.test(s)
  ) {
    return 'Leave-Personal'
  }
  // Generic "ลา" / leave (not holiday-worked)
  if (
    /ลา/.test(raw) &&
    !/holiday-worked|ทำงานวันหยุด|วันทำงาน/.test(s)
  ) {
    return 'Leave-Personal'
  }
  if (/\bleave\b/i.test(raw) && !/holiday-worked/i.test(s)) {
    return 'Leave-Personal'
  }
  return null
}

/**
 * Effective status for display: remark leave text overrides holiday/normal.
 */
export function effectiveStatus(recordOrStatus, remark) {
  if (recordOrStatus && typeof recordOrStatus === 'object') {
    const leave =
      detectLeaveStatus(recordOrStatus.status) ||
      detectLeaveStatus(recordOrStatus.remark)
    return leave || recordOrStatus.status
  }
  return detectLeaveStatus(remark) || detectLeaveStatus(recordOrStatus) || recordOrStatus
}

/**
 * Derive attendance status when the file does not provide one.
 */
export function deriveStatus({
  scheduledIn,
  actualIn,
  actualOut,
  statusHint,
  remark,
}) {
  const leave =
    detectLeaveStatus(statusHint) || detectLeaveStatus(remark)
  if (leave) return leave

  const hint = String(statusHint ?? '').trim().toLowerCase()
  const hintIsHoliday =
    ['holiday', 'off', 'วันหยุด'].includes(hint) || hint === 'holiday'
  const hintIsHolidayWorked = [
    'holiday-worked',
    'holiday worked',
    'ทำงานวันหยุด',
  ].includes(hint)

  const isOff =
    hintIsHoliday ||
    !scheduledIn ||
    scheduledIn === 'OFF' ||
    /^off$/i.test(String(scheduledIn))

  const hasIn = timeToMinutes(actualIn) != null
  const hasOut = timeToMinutes(actualOut) != null

  if (hintIsHolidayWorked) return 'Holiday-Worked'
  if (isOff) {
    return hasIn || hasOut ? 'Holiday-Worked' : 'Holiday'
  }

  if (['absent', 'ขาด', 'ขาดงาน'].includes(hint) && !hasIn && !hasOut) {
    return 'Absent'
  }
  if (!hasIn && !hasOut) return 'Absent'
  if (['late', 'สาย', 'มาสาย'].includes(hint)) return 'Late'
  if (computeLateMinutes(scheduledIn, actualIn) > 0) return 'Late'
  return 'Normal'
}

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentMonthISO() {
  return todayISO().slice(0, 7)
}

/**
 * When only one punch exists, decide if it is In or Out by comparing
 * to scheduled work times (closer wins). Fallback: before noon = In.
 */
export function assignSinglePunch(punchTime, scheduledIn, scheduledOut) {
  const punch = timeToMinutes(punchTime)
  if (punch == null) {
    return { actualIn: '—', actualOut: '—' }
  }

  const schedIn = timeToMinutes(
    scheduledIn && scheduledIn !== 'OFF' && scheduledIn !== '—'
      ? scheduledIn
      : shiftRules.standardIn,
  )
  const schedOut = timeToMinutes(
    scheduledOut && scheduledOut !== 'OFF' && scheduledOut !== '—'
      ? scheduledOut
      : shiftRules.standardOut,
  )

  const formatted = formatTime(punchTime)
  if (schedIn != null && schedOut != null) {
    const distIn = Math.abs(punch - schedIn)
    const distOut = Math.abs(punch - schedOut)
    if (distOut < distIn) {
      return { actualIn: '—', actualOut: formatted }
    }
    if (distIn < distOut) {
      return { actualIn: formatted, actualOut: '—' }
    }
    // Equal distance — prefer Out if afternoon/evening
    if (punch >= 12 * 60) {
      return { actualIn: '—', actualOut: formatted }
    }
    return { actualIn: formatted, actualOut: '—' }
  }

  if (punch >= 12 * 60) {
    return { actualIn: '—', actualOut: formatted }
  }
  return { actualIn: formatted, actualOut: '—' }
}

/**
 * Normalize in/out pair for display & issue checks.
 * Fixes cases where a lone evening punch was stored as actualIn.
 */
export function resolvePunches(record) {
  if (!record) return { actualIn: '—', actualOut: '—' }

  const rawIn = timeToMinutes(record.actualIn) != null ? record.actualIn : null
  const rawOut = timeToMinutes(record.actualOut) != null ? record.actualOut : null

  if (rawIn && rawOut) {
    return {
      actualIn: formatTime(rawIn),
      actualOut: formatTime(rawOut),
    }
  }
  if (!rawIn && rawOut) {
    return { actualIn: '—', actualOut: formatTime(rawOut) }
  }
  if (rawIn && !rawOut) {
    return assignSinglePunch(rawIn, record.scheduledIn, record.scheduledOut)
  }
  return { actualIn: '—', actualOut: '—' }
}

/**
 * Detect missing punch on a working day (after resolving single-punch vs schedule).
 * Returns null | 'no-in' | 'no-out' | 'no-both'
 */
export const DAY_TYPES = [
  'work',
  'off',
  'leave-personal',
  'leave-sick',
  'leave-vacation',
]

const DAY_TYPE_STATUS = {
  'leave-personal': 'Leave-Personal',
  'leave-sick': 'Leave-Sick',
  'leave-vacation': 'Leave-Vacation',
}

export function isLeaveStatus(status) {
  return LEAVE_STATUSES.includes(status)
}

export function isOffDayRecord(record) {
  if (!record) return false
  return (
    record.scheduledIn === 'OFF' ||
    record.status === 'Holiday' ||
    isLeaveStatus(record.status)
  )
}

export function dayTypeFromRecord(record) {
  if (!record) return 'work'
  if (record.status === 'Leave-Personal') return 'leave-personal'
  if (record.status === 'Leave-Sick') return 'leave-sick'
  if (record.status === 'Leave-Vacation') return 'leave-vacation'
  if (isOffDayRecord(record)) return 'off'
  return 'work'
}

export function statusForDayType(dayType) {
  return DAY_TYPE_STATUS[dayType] || null
}

export function punchIssue(record) {
  if (!record) return null
  if (isOffDayRecord(record)) {
    return null
  }

  const { actualIn, actualOut } = resolvePunches(record)
  const hasIn = timeToMinutes(actualIn) != null
  const hasOut = timeToMinutes(actualOut) != null

  // Absent with no punches at all is expected
  if (record.status === 'Absent' && !hasIn && !hasOut) return null

  if (!hasIn && !hasOut) {
    // Working day with no punches
    if (record.scheduledIn === '—' || !record.scheduledIn) {
      // punch-only import day typed as work without times — treat as holiday/off, no alert
      return null
    }
    return 'no-both'
  }
  if (!hasIn) return 'no-in'
  if (!hasOut) return 'no-out'
  return null
}

export function punchIssueKey(issue) {
  if (issue === 'no-in') return 'punch.noIn'
  if (issue === 'no-out') return 'punch.noOut'
  if (issue === 'no-both') return 'punch.noBoth'
  return null
}

/** @param {(key: string) => string} [t] optional i18n translator */
export function punchIssueLabel(issue, t) {
  const key = punchIssueKey(issue)
  if (!key) return ''
  if (typeof t === 'function') return t(key)
  if (issue === 'no-in') return 'ไม่สแกนเข้า'
  if (issue === 'no-out') return 'ไม่สแกนออก'
  if (issue === 'no-both') return 'ไม่มีเวลาเข้า-ออก'
  return ''
}

/** Known auto-generated missing-punch remarks (any locale) */
const AUTO_PUNCH_REMARKS = new Set([
  'ไม่สแกนเข้า',
  'ไม่สแกนออก',
  'ไม่มีเวลาเข้า-ออก',
  'ขาดเข้า',
  'ขาดออก',
  'Missing clock-in',
  'Missing clock-out',
  'No in/out times',
  'Missed in',
  'Missed out',
  '未打上班卡',
  '未打下班卡',
  '无上下班时间',
  '缺上班',
  '缺下班',
])

export function isAutoPunchRemark(remark) {
  const s = String(remark || '').trim()
  if (!s) return false
  return AUTO_PUNCH_REMARKS.has(s)
}

/**
 * Keep custom remarks; sync auto missing-punch notes with the current issue.
 * Empty remark is treated as auto-managed.
 */
export function syncRemarkWithPunchIssue(currentRemark, issue, labelFn) {
  const trimmed = String(currentRemark || '').trim()
  const autoManaged = !trimmed || isAutoPunchRemark(trimmed)
  if (!autoManaged) return trimmed
  if (!issue) return ''
  if (typeof labelFn === 'function') return labelFn(issue) || ''
  return punchIssueLabel(issue)
}

/** Canonical leave remarks stored on the record (Thai). */
export function leaveRemarkForDayType(dayType) {
  if (dayType === 'leave-personal') return 'ลากิจ'
  if (dayType === 'leave-sick') return 'ลาป่วย'
  if (dayType === 'leave-vacation') return 'ลาพักร้อน'
  return ''
}

const AUTO_LEAVE_REMARKS = new Set([
  'ลากิจ',
  'ลาป่วย',
  'ลาพักร้อน',
  'ลาส่วนตัว',
  'Personal leave',
  'Sick leave',
  'Annual leave',
  'Vacation',
  '事假',
  '病假',
  '年假',
])

export function isAutoLeaveRemark(remark) {
  const s = String(remark || '').trim()
  if (!s) return false
  return AUTO_LEAVE_REMARKS.has(s)
}

export function isAutoManagedRemark(remark) {
  const s = String(remark || '').trim()
  if (!s) return true
  return isAutoPunchRemark(s) || isAutoLeaveRemark(s)
}

/**
 * Sync remark for day type + punch issue.
 * Leave → ลากิจ / ลาป่วย / ลาพักร้อน
 * Work with missing punch → ไม่สแกน…
 * Custom remarks are never overwritten.
 */
export function syncAttendanceRemark(currentRemark, { dayType, issue } = {}) {
  const trimmed = String(currentRemark || '').trim()
  if (!isAutoManagedRemark(trimmed)) return trimmed

  if (dayType && String(dayType).startsWith('leave-')) {
    return leaveRemarkForDayType(dayType)
  }

  if (dayType === 'work' && issue) {
    return punchIssueLabel(issue)
  }

  return ''
}

/** Display-ready times after schedule-aware single-punch fix */
export function displayPunches(record) {
  return resolvePunches(record)
}
