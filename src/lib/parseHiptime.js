import * as XLSX from 'xlsx'
import { shiftRules } from '../config'
import {
  assignSinglePunch,
  computeLateMinutes,
  computeOtHours,
  deriveStatus,
  detectLeaveStatus,
  formatTime,
} from './attendance'
import {
  normalizeEmployeeId,
  normalizePersonName,
} from './employeeIdentity'
import {
  classifyByRoutine,
  enforceKitchenWeeklyShifts,
  normalizeSettings,
  resolveSchedule as resolveScheduleFromSettings,
} from './shiftRoutine'

export { normalizeEmployeeId, normalizePersonName } from './employeeIdentity'

/**
 * Aliases ordered longest/most-specific first where possible.
 * Matching prefers exact normalized equality, then startsWith, then includes.
 */
const FIELD_ALIASES = {
  name: [
    'ชื่อพนักงาน',
    'namesurname',
    'employeename',
    'employee_name',
    'fullname',
    'name',
    'ชื่อ-นามสกุล',
    'ชื่อนามสกุล',
    'ชื่อ',
  ],
  employeeId: [
    'รหัสพนักงาน',
    'รหัสพนง',
    'รหัสประจำตัว',
    'employeeid',
    'employee_id',
    'empcode',
    'empno',
    'staffid',
    'staffcode',
    'empid',
  ],
  /** Matched only to exclude — never used as employee identity */
  machineId: [
    'รหัสที่เครื่องบันทึกเวลา',
    'รหัสที่เครื่อง',
    'รหัสเครื่อง',
    'หมายเลขเครื่องบันทึกเวลา',
    'หมายเลขเครื่อง',
    'เลขเครื่อง',
    'machineno',
    'machineid',
    'machinenumber',
    'deviceno',
    'deviceid',
    'terminalid',
  ],
  department: ['department', 'dept', 'section', 'แผนก', 'หน่วยงาน', 'ฝ่าย'],
  date: [
    'วันเวลา',
    'วันที่ทำงาน',
    'workdate',
    'att_date',
    'วันที่',
    'date',
    'วัน',
  ],
  /** Combined schedule column e.g. "08:30 ~19:00" */
  scheduleRange: [
    'เข้าออก',
    'เวลาเข้าออก',
    'กำหนดเข้าออก',
    'กะทำงาน',
    'shift',
    'schedule',
    'เข้า-ออก',
  ],
  scheduledIn: [
    'scheduledin',
    'shiftin',
    'planin',
    'กำหนดเข้า',
    'เวลาเข้ากำหนด',
    'กะเข้า',
  ],
  scheduledOut: [
    'scheduledout',
    'shiftout',
    'planout',
    'กำหนดออก',
    'เวลาออกกำหนด',
    'กะออก',
  ],
  actualIn: [
    'actualin',
    'timein',
    'checkin',
    'clockin',
    'scanin',
    'เวลาเข้า',
    'สแกนเข้า',
    'เข้า',
  ],
  actualOut: [
    'actualout',
    'timeout',
    'checkout',
    'clockout',
    'scanout',
    'เวลาออก',
    'สแกนออก',
    'ออก',
  ],
  status: ['attendance_status', 'attstatus', 'status', 'สถานะ', 'ประเภท'],
  remark: ['remark', 'remarks', 'note', 'หมายเหตุ'],
  workDuration: ['เวลาทำงาน', 'ชั่วโมงทำงาน', 'workhours', 'worktime'],
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\]+/g, '')
    .replace(/[\[\](){}]/g, '')
    .replace(/\d+$/g, '')
}

/** Headers that are clock-machine codes, not HR employee IDs */
function isMachineIdHeader(headerKey) {
  if (!headerKey) return false
  return (
    /เครื่อง|machine|device|terminal|recorder/.test(headerKey) ||
    /รหัสที่เครื่อง|หมายเลขเครื่อง|เลขเครื่อง/.test(headerKey)
  )
}

function scoreHeaderMatch(headerKey, aliasKey) {
  if (!aliasKey) return 0
  if (headerKey === aliasKey) return 100 + aliasKey.length
  if (
    headerKey.startsWith(aliasKey) &&
    headerKey.length <= aliasKey.length + 2
  ) {
    return 80 + aliasKey.length
  }
  if (headerKey.includes(aliasKey) && aliasKey.length >= 3) {
    return 40 + aliasKey.length
  }
  return 0
}

function buildHeaderMap(headers) {
  const normalized = headers.map((h) => ({
    raw: h,
    key: normalizeHeader(h),
  }))
  const used = new Set()
  const map = {}

  // Reserve machine-number columns so they never become employeeId
  for (const h of normalized) {
    if (isMachineIdHeader(h.key)) {
      for (const alias of FIELD_ALIASES.machineId || []) {
        if (scoreHeaderMatch(h.key, normalizeHeader(alias)) > 0) {
          used.add(h.raw)
          break
        }
      }
      if (isMachineIdHeader(h.key)) used.add(h.raw)
    }
  }

  const order = [
    'scheduleRange',
    'name',
    'employeeId',
    'department',
    'date',
    'scheduledIn',
    'scheduledOut',
    'actualIn',
    'actualOut',
    'status',
    'remark',
    'workDuration',
  ]

  for (const field of order) {
    const aliases = FIELD_ALIASES[field] || []
    let best = null
    let bestScore = 0

    for (const h of normalized) {
      if (used.has(h.raw)) continue
      if (field === 'employeeId' && isMachineIdHeader(h.key)) continue
      if (field === 'actualIn' && h.key.includes('ออก')) continue
      if (field === 'actualIn' && h.key.includes('เข้าออก')) continue
      if (field === 'actualOut' && h.key.includes('เข้าออก')) continue
      if (
        field === 'actualOut' &&
        h.key.startsWith('เข้า') &&
        !h.key.includes('ออก')
      ) {
        continue
      }
      if (field === 'date' && h.key.includes('เวลาทำงาน')) continue
      // skip pure numeric punch headers here — handled separately
      if (/^\d+$/.test(String(h.raw).trim())) continue

      for (const alias of aliases) {
        const score = scoreHeaderMatch(h.key, normalizeHeader(alias))
        if (score > bestScore) {
          bestScore = score
          best = h
        }
      }
    }

    if (best && bestScore > 0) {
      map[field] = best.raw
      used.add(best.raw)
    }
  }

  return map
}

/**
 * Formats like aug.xls: headers "1","2","3","4" = punch times (no In/Out labels).
 * Uses first time as In, last time as Out.
 */
function attachPunchColumns(headers, headerMap, rows) {
  if (headerMap.actualIn && headerMap.actualOut) {
    return { headerMap, punchKeys: null }
  }

  const used = new Set(Object.values(headerMap).filter(Boolean))
  const numbered = headers
    .filter((h) => !used.has(h) && /^\d+$/.test(String(h).trim()))
    .sort((a, b) => Number(a) - Number(b))

  if (numbered.length >= 1) {
    return {
      headerMap: {
        ...headerMap,
        actualIn: numbered[0],
        actualOut: numbered[1] || numbered[0],
      },
      punchKeys: numbered,
    }
  }

  // Fallback: unused columns that contain time-like values
  const candidates = headers.filter((h) => !used.has(h))
  const timeCols = candidates.filter((h) =>
    rows.some((r) => parseTimeValue(r[h]) != null),
  )
  if (timeCols.length >= 1) {
    return {
      headerMap: {
        ...headerMap,
        actualIn: timeCols[0],
        actualOut: timeCols[1] || timeCols[0],
      },
      punchKeys: timeCols,
    }
  }

  return { headerMap, punchKeys: null }
}

function excelSerialToISO(serial) {
  const utc = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(utc)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toChristYear(year) {
  const y = Number(year)
  if (!Number.isFinite(y)) return y
  return y >= 2400 ? y - 543 : y
}

/** Detect M/D/YYYY vs D/M/YYYY from a sample of date strings */
export function detectDateOrder(values) {
  let mdy = 0
  let dmy = 0
  const firsts = []
  const seconds = []

  for (const value of values) {
    if (value == null || value === '') continue
    if (typeof value === 'number') continue
    const raw = String(value).trim()
    const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    const y = Number(m[3])
    firsts.push(a)
    seconds.push(b)
    if (a > 12 && b <= 12) dmy += 1
    else if (b > 12 && a <= 12) mdy += 1
    else if (y >= 2400) dmy += 1 // พ.ศ. มักเป็น วัน/เดือน/ปี
  }

  if (mdy > dmy) return 'MDY'
  if (dmy > mdy) return 'DMY'

  const maxF = firsts.length ? Math.max(...firsts) : 0
  const maxS = seconds.length ? Math.max(...seconds) : 0
  if (maxF <= 12 && maxS > 12) return 'MDY'
  if (maxS <= 12 && maxF > 12) return 'DMY'
  return 'DMY'
}

function parseDateValue(value, order = 'DMY') {
  if (value == null || value === '') return null
  if (typeof value === 'number') return excelSerialToISO(value)

  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split('-')
    return `${toChristYear(y)}-${m}-${d}`
  }

  const parts = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (parts) {
    const yyyy = String(toChristYear(parts[3]))
    if (order === 'MDY') {
      const mm = parts[1].padStart(2, '0')
      const dd = parts[2].padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    const dd = parts[1].padStart(2, '0')
    const mm = parts[2].padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${toChristYear(y)}-${m}-${day}`
  }
  return null
}

function parseTimeValue(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    // Excel time fraction, or mistaken serial — if < 1 treat as time-of-day
    if (value > 0 && value < 1) {
      const totalMinutes = Math.round(value * 24 * 60) % (24 * 60)
      const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
      const m = String(totalMinutes % 60).padStart(2, '0')
      return `${h}:${m}`
    }
    return null
  }
  const raw = String(value).trim()
  if (!raw || raw === '-' || raw === '—' || /^off$/i.test(raw)) return null

  if (/[AaPp][Mm]/.test(raw)) {
    const formatted = formatTime(raw)
    return formatted === '—' ? null : formatted
  }

  if (raw.includes('T') || /\d{4}-\d{2}-\d{2}/.test(raw)) {
    const timePart = raw.split(/[T\s]/).find((p) => /^\d{1,2}:\d{2}/.test(p))
    if (timePart) return formatTime(timePart)
  }
  if (!raw.includes(':')) return null
  return formatTime(raw)
}

function parseScheduleRange(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (!raw) return null
  const match = raw.match(/(\d{1,2}:\d{2})\s*[~\-–—ถึง]+\s*(\d{1,2}:\d{2})/)
  if (!match) return null
  return {
    scheduledIn: formatTime(match[1]),
    scheduledOut: formatTime(match[2]),
  }
}

function cell(row, headerMap, field) {
  const key = headerMap[field]
  if (!key) return undefined
  return row[key]
}

function extractPunches(row, headerMap, punchKeys, scheduledIn, scheduledOut) {
  let actualIn = '—'
  let actualOut = '—'

  if (punchKeys?.length) {
    const times = punchKeys.map((k) => parseTimeValue(row[k])).filter(Boolean)
    if (!times.length) return { actualIn: '—', actualOut: '—' }
    if (times.length === 1) {
      return assignSinglePunch(times[0], scheduledIn, scheduledOut)
    }
    actualIn = times[0]
    actualOut = times[times.length - 1]
    return { actualIn, actualOut }
  }

  actualIn = parseTimeValue(cell(row, headerMap, 'actualIn')) || '—'
  actualOut = parseTimeValue(cell(row, headerMap, 'actualOut')) || '—'

  // Explicit columns but only one side filled — still compare to schedule
  const hasIn = actualIn !== '—'
  const hasOut = actualOut !== '—'
  if (hasIn && !hasOut) {
    return assignSinglePunch(actualIn, scheduledIn, scheduledOut)
  }
  if (!hasIn && hasOut) {
    return { actualIn: '—', actualOut }
  }
  return { actualIn, actualOut }
}

/**
 * Parse a Hiptime (or compatible) Excel/CSV File into employees + attendance records.
 * Supports:
 * - Thai Hiptime export (เข้า/ออก, วันทำงาน/วันหยุด, พ.ศ.)
 * - Punch-pair exports like aug.xls (columns 1,2,3,4 = times, M/D/YYYY, AM/PM)
 */
export async function parseHiptimeFile(file, options = {}) {
  const settings = normalizeSettings(options.settings)
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('ไม่พบชีตในไฟล์')
  }
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
  if (!rows.length) {
    throw new Error('ไฟล์ไม่มีข้อมูล')
  }

  const headers = Object.keys(rows[0])
  let headerMap = buildHeaderMap(headers)
  const punched = attachPunchColumns(headers, headerMap, rows)
  headerMap = punched.headerMap
  const punchKeys = punched.punchKeys

  if (!headerMap.employeeId && !headerMap.name) {
    throw new Error(
      'ไม่พบคอลัมน์รหัสพนักงานหรือชื่อ — ตรวจหัวตารางในไฟล์อีกครั้ง',
    )
  }
  if (!headerMap.date) {
    throw new Error(
      `ไม่พบคอลัมน์วันที่ในไฟล์ (หัวตาราง: ${headers.join(', ')})`,
    )
  }

  const dateOrder = detectDateOrder(rows.map((r) => cell(r, headerMap, 'date')))
  const hasScheduleColumns = Boolean(
    headerMap.scheduleRange || headerMap.scheduledIn || headerMap.scheduledOut,
  )

  const employeeMap = new Map()
  const nameToId = new Map()
  const normIdToId = new Map()
  const records = []
  let skipped = 0
  const diagnostics = []

  rows.forEach((row, index) => {
    const date = parseDateValue(cell(row, headerMap, 'date'), dateOrder)
    let employeeId = String(cell(row, headerMap, 'employeeId') ?? '').trim()
    const name = String(cell(row, headerMap, 'name') ?? '').trim()
    const department =
      String(cell(row, headerMap, 'department') ?? '').trim() || '—'
    const remark = String(cell(row, headerMap, 'remark') ?? '').trim()

    if (
      !date ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    ) {
      diagnostics.push({ row: index + 1, reason: 'date' })
      skipped += 1
      return
    }
    if (!employeeId && !name) {
      diagnostics.push({ row: index + 1, reason: 'employee' })
      skipped += 1
      return
    }
    if (!employeeId) employeeId = name

    const nameKey = normalizePersonName(name)
    const normId = normalizeEmployeeId(employeeId)

    // Same person across rows: prefer existing by name, then by numeric ID
    if (nameKey && nameToId.has(nameKey)) {
      employeeId = nameToId.get(nameKey)
    } else if (normId && normIdToId.has(normId)) {
      employeeId = normIdToId.get(normId)
    }

    if (!employeeMap.has(employeeId)) {
      employeeMap.set(employeeId, {
        id: employeeId,
        name: name || employeeId,
        department,
      })
    } else {
      const prev = employeeMap.get(employeeId)
      employeeMap.set(employeeId, {
        ...prev,
        name: name || prev.name,
        department: department !== '—' ? department : prev.department,
      })
    }

    if (nameKey && !nameToId.has(nameKey)) nameToId.set(nameKey, employeeId)
    if (normId && !normIdToId.has(normId)) normIdToId.set(normId, employeeId)

    const statusHint = cell(row, headerMap, 'status')
    const statusText = String(statusHint ?? '').trim()
    const leaveFromText =
      detectLeaveStatus(statusText) || detectLeaveStatus(remark)
    const isHolidayDay =
      !leaveFromText &&
      /วันหยุด|holiday|off/i.test(statusText) &&
      !/วันทำงาน|holiday-worked|ทำงาน/i.test(statusText)

    const range = parseScheduleRange(cell(row, headerMap, 'scheduleRange'))
    let scheduledIn =
      parseTimeValue(cell(row, headerMap, 'scheduledIn')) ||
      range?.scheduledIn ||
      null
    let scheduledOut =
      parseTimeValue(cell(row, headerMap, 'scheduledOut')) ||
      range?.scheduledOut ||
      null

    const useRoutine = !hasScheduleColumns && !statusText
    const routineSchedule = useRoutine
      ? resolveScheduleFromSettings(settings, department)
      : null
    // Provisional schedule for single-punch assignment; final schedule comes from classify
    const scheduleForPunch = {
      in: isHolidayDay
        ? null
        : scheduledIn ||
          routineSchedule?.scheduledIn ||
          settings.standardIn ||
          shiftRules.standardIn,
      out: isHolidayDay
        ? null
        : scheduledOut ||
          routineSchedule?.scheduledOut ||
          settings.standardOut ||
          shiftRules.standardOut,
    }

    const { actualIn, actualOut } = extractPunches(
      row,
      headerMap,
      punchKeys,
      scheduleForPunch.in,
      scheduleForPunch.out,
    )
    const hasPunch = actualIn !== '—' || actualOut !== '—'

    let finalStatus
    let lateMinutes = 0
    let otHours = 0
    let scheduleSource = 'import'
    let shiftLabel
    let shiftId

    if (leaveFromText) {
      scheduledIn = 'OFF'
      scheduledOut = 'OFF'
      finalStatus = leaveFromText
      lateMinutes = 0
      otHours = 0
    } else if (useRoutine) {
      const classified = classifyByRoutine({
        date,
        actualIn,
        actualOut,
        settings,
        department,
      })
      scheduledIn = classified.scheduledIn
      scheduledOut = classified.scheduledOut
      finalStatus = classified.status
      lateMinutes = classified.lateMinutes
      otHours = classified.otHours
      scheduleSource = classified.scheduleSource || 'routine'
      shiftLabel = classified.shiftLabel || undefined
      shiftId = classified.shiftId || undefined
    } else if (isHolidayDay) {
      scheduledIn = 'OFF'
      scheduledOut = 'OFF'
      finalStatus = deriveStatus({
        scheduledIn: 'OFF',
        actualIn,
        actualOut,
        statusHint: 'Holiday',
      })
    } else if (hasScheduleColumns) {
      scheduledIn = scheduledIn || settings.standardIn || shiftRules.standardIn
      scheduledOut =
        scheduledOut || settings.standardOut || shiftRules.standardOut
      finalStatus = deriveStatus({
        scheduledIn,
        actualIn,
        actualOut,
        statusHint: statusText || null,
        remark,
      })
      lateMinutes = computeLateMinutes(scheduledIn, actualIn)
      otHours = computeOtHours(scheduledOut, actualOut)
    } else if (hasPunch) {
      scheduledIn = scheduledIn || '—'
      scheduledOut = scheduledOut || '—'
      finalStatus = 'Normal'
    } else {
      scheduledIn = 'OFF'
      scheduledOut = 'OFF'
      finalStatus = 'Holiday'
    }

    records.push({
      id: index + 1,
      employeeId,
      date,
      scheduledIn:
        scheduledIn === 'OFF' ? 'OFF' : scheduledIn === '—' ? '—' : scheduledIn,
      scheduledOut:
        scheduledOut === 'OFF'
          ? 'OFF'
          : scheduledOut === '—'
            ? '—'
            : scheduledOut,
      actualIn,
      actualOut,
      status: finalStatus,
      isSwapped: false,
      lateMinutes,
      otHours,
      scheduleSource,
      shiftLabel,
      shiftId,
      remark: remark || undefined,
    })
  })

  if (!records.length) {
    throw new Error('อ่านไฟล์ได้ แต่ไม่มีแถวที่แปลงเป็นรายการเข้างานได้')
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'th'),
  )
  const recordsFinal = enforceKitchenWeeklyShifts(records, settings, employees)

  return {
    employees,
    records: recordsFinal,
    meta: {
      fileName: file.name,
      sheetName,
      rowCount: records.length,
      skipped,
      diagnostics,
      mappedColumns: headerMap,
      dateOrder,
      punchKeys,
    },
  }
}
