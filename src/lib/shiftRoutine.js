import { shiftRules } from '../config.js'
import {
  computeLateMinutes,
  computeOtHours,
  deriveStatus,
  punchIssue,
  syncAttendanceRemark,
  timeToMinutes,
} from './attendance.js'

/** JS Date.getDay(): 0=Sun … 6=Sat */
export const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 0] // Mon→Sun display order

function newTemplateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8)
  }
  return `sh_${Date.now().toString(36)}`
}

export function defaultSettings() {
  return {
    offWeekdays: [],
    standardIn: shiftRules.standardIn,
    standardOut: shiftRules.standardOut,
    /** @type {Record<string, { in: string, out: string }>} */
    departmentShifts: {},
    /**
     * Named shift templates e.g. เช้า / สาย.
     * When inferShiftFromPunch is on and punches exist, pick closest template.
     * @type {{ id: string, name: string, in: string, out: string }[]}
     */
    shiftTemplates: [],
    /** Match scheduled hours from punch times against shiftTemplates */
    inferShiftFromPunch: true,
    /**
     * Fixed special shifts for selected weekdays e.g. Sat–Sun 08:00–19:00.
     * @type {{ id: string, name: string, days: number[], in: string, out: string }[]}
     */
    weekdayShiftRules: [],
  }
}

function normalizeTime(value) {
  const s = String(value || '').trim()
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function normalizeDepartmentShifts(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [dept, times] of Object.entries(raw)) {
    const key = String(dept || '').trim()
    if (!key || key === '—') continue
    const inn = normalizeTime(times?.in ?? times?.scheduledIn)
    const outt = normalizeTime(times?.out ?? times?.scheduledOut)
    if (inn && outt) out[key] = { in: inn, out: outt }
  }
  return out
}

function normalizeShiftTemplates(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const inn = normalizeTime(row.in ?? row.scheduledIn)
    const outt = normalizeTime(row.out ?? row.scheduledOut)
    if (!inn || !outt) continue
    const name = String(row.name || '').trim() || `${inn}–${outt}`
    let id = String(row.id || '').trim() || newTemplateId()
    if (seen.has(id)) id = newTemplateId()
    seen.add(id)
    out.push({ id, name, in: inn, out: outt })
  }
  return out
}

function normalizeWeekdayShiftRules(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const inn = normalizeTime(row.in ?? row.scheduledIn)
    const outt = normalizeTime(row.out ?? row.scheduledOut)
    if (!inn || !outt) continue
    const days = [
      ...new Set(
        (Array.isArray(row.days) ? row.days : [])
          .map(Number)
          .filter((d) => d >= 0 && d <= 6),
      ),
    ].sort((a, b) => a - b)
    if (!days.length) continue
    let id = String(row.id || '').trim() || newTemplateId()
    if (seen.has(id)) id = newTemplateId()
    seen.add(id)
    const name = String(row.name || '').trim() || `${inn}–${outt}`
    // Empty departments = applies to all positions
    const departments = Array.isArray(row.departments)
      ? [
          ...new Set(
            row.departments
              .map((d) => String(d || '').trim())
              .filter((d) => d && d !== '—'),
          ),
        ].sort((a, b) => a.localeCompare(b, 'th'))
      : []
    out.push({ id, name, days, in: inn, out: outt, departments })
  }
  return out
}

function ruleAppliesToDepartment(rule, department) {
  const depts = rule.departments || []
  if (!depts.length) return true
  const key = String(department || '').trim()
  if (!key || key === '—') return false
  return depts.includes(key)
}

/** Find special weekday rule for a JS getDay() + department. */
export function findWeekdayShift(settings, dow, department) {
  const cfg = normalizeSettings(settings)
  if (dow == null) return null
  return (
    cfg.weekdayShiftRules.find(
      (rule) =>
        rule.days.includes(dow) && ruleAppliesToDepartment(rule, department),
    ) || null
  )
}

export function normalizeSettings(raw) {
  const base = defaultSettings()
  if (!raw || typeof raw !== 'object') return base
  const off = Array.isArray(raw.offWeekdays)
    ? [...new Set(raw.offWeekdays.map(Number).filter((d) => d >= 0 && d <= 6))]
    : []
  const infer =
    raw.inferShiftFromPunch == null
      ? base.inferShiftFromPunch
      : Boolean(raw.inferShiftFromPunch)
  return {
    offWeekdays: off,
    standardIn: normalizeTime(raw.standardIn) || base.standardIn,
    standardOut: normalizeTime(raw.standardOut) || base.standardOut,
    departmentShifts: normalizeDepartmentShifts(raw.departmentShifts),
    shiftTemplates: normalizeShiftTemplates(raw.shiftTemplates),
    inferShiftFromPunch: infer,
    weekdayShiftRules: normalizeWeekdayShiftRules(raw.weekdayShiftRules),
  }
}

/** Fallback schedule when we cannot infer from punch. */
export function resolveSchedule(settings, department) {
  const cfg = normalizeSettings(settings)
  const key = String(department || '').trim()
  const custom =
    key && key !== '—' ? cfg.departmentShifts[key] : null
  if (custom) {
    return {
      scheduledIn: custom.in,
      scheduledOut: custom.out,
      shiftLabel: null,
      shiftId: null,
    }
  }
  const only = cfg.shiftTemplates.length === 1 ? cfg.shiftTemplates[0] : null
  if (only) {
    return {
      scheduledIn: only.in,
      scheduledOut: only.out,
      shiftLabel: only.name,
      shiftId: only.id,
    }
  }
  return {
    scheduledIn: cfg.standardIn,
    scheduledOut: cfg.standardOut,
    shiftLabel: null,
    shiftId: null,
  }
}

/**
 * Pick shift by clock-in + clock-out fit.
 * Score = |in−start| + |out−end| + lateMinutes (late for a start costs extra),
 * so in 08:12 / out 19:01 → กะสาย 08:30–19:00 (on time + end match),
 * not กะเช้า 08:00–18:00 or กะปกติ 08:00–19:00 (ทั้งคู่สายเข้า).
 * Missing punch side uses the other side only.
 */
export function matchShiftFromPunch(templates, actualIn, actualOut) {
  const list = normalizeShiftTemplates(templates)
  if (!list.length) return null

  const inMin = timeToMinutes(actualIn)
  const outMin = timeToMinutes(actualOut)

  if (inMin == null && outMin == null) return null
  if (list.length === 1) return list[0]

  let best = null
  let bestScore = Infinity

  for (const tpl of list) {
    const sIn = timeToMinutes(tpl.in)
    const sOut = timeToMinutes(tpl.out)
    let score = 0
    let parts = 0
    if (inMin != null && sIn != null) {
      const deltaIn = Math.abs(inMin - sIn)
      const late = Math.max(0, inMin - sIn)
      score += deltaIn + late
      parts += 1
    }
    if (outMin != null && sOut != null) {
      score += Math.abs(outMin - sOut)
      parts += 1
    }
    if (!parts) continue
    // Tie-break: earlier start, then earlier end (เช้า before ปกติ / สาย)
    if (
      score < bestScore ||
      (score === bestScore &&
        best &&
        ((sIn != null && sIn < timeToMinutes(best.in)) ||
          (sIn === timeToMinutes(best.in) &&
            sOut != null &&
            sOut < timeToMinutes(best.out))))
    ) {
      bestScore = score
      best = tpl
    }
  }
  return best || list[0]
}

export function isKitchenDepartment(dept) {
  return /ครัว/i.test(String(dept || ''))
}

/** Monday date key (YYYY-MM-DD) for week grouping */
export function weekMondayKey(dateISO) {
  const d = new Date(`${dateISO}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateISO
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function medianMinutes(values) {
  const sorted = values.filter((v) => v != null).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }
  return sorted[mid]
}

function isMonToFri(dateISO) {
  const dow = weekdayOf(dateISO)
  return dow != null && dow >= 1 && dow <= 5
}

/**
 * Pick one template for a Mon–Fri kitchen week from median clock-out
 * (primary) + median clock-in (tie-break). Out ~18 → กะเช้า, out ~19 → กะสาย/ปกติ.
 */
function pickKitchenWeekTemplate(templates, medianOut, medianIn) {
  const list = normalizeShiftTemplates(templates)
  if (!list.length) return null
  if (list.length === 1) return list[0]
  if (medianOut == null && medianIn == null) return null

  let best = null
  let bestScore = Infinity
  for (const tpl of list) {
    const sOut = timeToMinutes(tpl.out)
    const sIn = timeToMinutes(tpl.in)
    let score = Infinity
    if (medianOut != null && sOut != null) {
      score = Math.abs(medianOut - sOut) * 2
      if (medianIn != null && sIn != null) {
        score += Math.abs(medianIn - sIn)
      }
    } else if (medianIn != null && sIn != null) {
      score = Math.abs(medianIn - sIn)
    } else {
      continue
    }
    if (
      score < bestScore ||
      (score === bestScore &&
        sIn != null &&
        best &&
        sIn < timeToMinutes(best.in))
    ) {
      bestScore = score
      best = tpl
    }
  }
  return best
}

/**
 * Kitchen only — Mon–Fri one shift per week from median clock-out.
 * Weekend (กะพิเศษตามวัน) stays untouched. Prevents mixing กะเช้า/กะสาย mid-week.
 */
export function enforceKitchenWeeklyShifts(records, settings, employees = []) {
  const cfg = normalizeSettings(settings)
  if (!cfg.shiftTemplates.length) return records || []

  const empById = new Map((employees || []).map((e) => [e.id, e]))
  const groups = new Map()

  ;(records || []).forEach((r, idx) => {
    const dept = empById.get(r.employeeId)?.department
    if (!isKitchenDepartment(dept)) return
    if (!isMonToFri(r.date)) return
    if (r.isSwapped) return
    if (r.scheduleSource === 'weekday') return
    if (r.scheduleSource === 'import' || r.scheduleSource === 'manual') return
    if (r.scheduledIn === 'OFF') return
    const key = `${r.employeeId}|${weekMondayKey(r.date)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(idx)
  })

  const next = (records || []).slice()
  for (const idxs of groups.values()) {
    const outs = []
    const inns = []
    for (const i of idxs) {
      const r = next[i]
      const o = timeToMinutes(r.actualOut)
      const inn = timeToMinutes(r.actualIn)
      if (o != null) outs.push(o)
      if (inn != null) inns.push(inn)
    }
    if (outs.length + inns.length === 0) continue

    const tpl = pickKitchenWeekTemplate(
      cfg.shiftTemplates,
      medianMinutes(outs),
      medianMinutes(inns),
    )
    if (!tpl) continue

    for (const i of idxs) {
      const r = next[i]
      const lateMinutes = computeLateMinutes(tpl.in, r.actualIn)
      const status = deriveStatus({
        scheduledIn: tpl.in,
        actualIn: r.actualIn,
        actualOut: r.actualOut,
      })
      const draft = {
        ...r,
        scheduledIn: tpl.in,
        scheduledOut: tpl.out,
        status,
        lateMinutes,
      }
      next[i] = {
        ...draft,
        shiftLabel: tpl.name,
        shiftId: tpl.id,
        scheduleSource: 'inferred',
        otHours: computeOtHours(tpl.out, r.actualOut),
        remark:
          syncAttendanceRemark(r.remark, {
            dayType: 'work',
            issue: punchIssue(draft),
            lateMinutes,
          }) || undefined,
      }
    }
  }
  return next
}

export function weekdayOf(dateISO) {
  const d = new Date(`${dateISO}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.getDay()
}

function hasPunchTimes(actualIn, actualOut) {
  return (
    (actualIn && actualIn !== '—') || (actualOut && actualOut !== '—')
  )
}

/**
 * Classify a day when the import file has no schedule/status columns.
 * Priority: off → weekday special → infer from punch → dept/standard fallback.
 */
export function classifyByRoutine({
  date,
  actualIn = '—',
  actualOut = '—',
  settings,
  department,
}) {
  const cfg = normalizeSettings(settings)
  const dow = weekdayOf(date)
  const isOff = dow != null && cfg.offWeekdays.includes(dow)
  const punched = hasPunchTimes(actualIn, actualOut)

  if (isOff) {
    return {
      scheduledIn: 'OFF',
      scheduledOut: 'OFF',
      status: punched ? 'Holiday-Worked' : 'Holiday',
      lateMinutes: 0,
      otHours: 0,
      scheduleSource: 'routine',
      shiftLabel: null,
      shiftId: null,
    }
  }

  let scheduledIn
  let scheduledOut
  let shiftLabel = null
  let shiftId = null
  let scheduleSource = 'routine'

  // Special weekday shift (e.g. Sat–Sun 08:00–19:00) for selected departments
  const weekdayRule = findWeekdayShift(cfg, dow, department)
  if (weekdayRule) {
    scheduledIn = weekdayRule.in
    scheduledOut = weekdayRule.out
    shiftLabel = weekdayRule.name
    shiftId = weekdayRule.id
    scheduleSource = 'weekday'
  }

  const canInfer =
    !scheduledIn &&
    cfg.inferShiftFromPunch &&
    punched &&
    cfg.shiftTemplates.length > 0

  if (canInfer) {
    const matched = matchShiftFromPunch(
      cfg.shiftTemplates,
      actualIn,
      actualOut,
    )
    if (matched) {
      scheduledIn = matched.in
      scheduledOut = matched.out
      shiftLabel = matched.name
      shiftId = matched.id
      scheduleSource = 'inferred'
    }
  }

  if (!scheduledIn) {
    const fallback = resolveSchedule(cfg, department)
    scheduledIn = fallback.scheduledIn
    scheduledOut = fallback.scheduledOut
    shiftLabel = fallback.shiftLabel
    shiftId = fallback.shiftId
  }

  const status = deriveStatus({
    scheduledIn,
    actualIn,
    actualOut,
  })
  return {
    scheduledIn,
    scheduledOut,
    status,
    lateMinutes: computeLateMinutes(scheduledIn, actualIn),
    otHours: computeOtHours(scheduledOut, actualOut),
    scheduleSource,
    shiftLabel,
    shiftId,
  }
}

/**
 * Soft rows that can be reclassified by routine / shift templates.
 * Swaps stay locked. Rows with punches rematch when infer + templates are on
 * (including table edits / import that stuck on standard 08:00–19:00).
 */
export function isRoutineEligible(record, settings) {
  if (!record || record.isSwapped) return false

  const cfg = settings ? normalizeSettings(settings) : null
  const canInferPunch =
    Boolean(cfg?.inferShiftFromPunch) &&
    (cfg?.shiftTemplates.length || 0) > 0 &&
    hasPunchTimes(record.actualIn, record.actualOut)

  // Manual OFF / empty days stay locked; punched days still rematch to templates
  if (record.scheduleSource === 'manual' && !canInferPunch) return false

  if (
    record.scheduleSource === 'routine' ||
    record.scheduleSource === 'inferred' ||
    record.scheduleSource === 'weekday'
  ) {
    return true
  }
  if (record.scheduledIn === '—' || record.scheduledOut === '—') return true
  // Empty OFF days from punch-only import (no real schedule from file)
  if (
    record.scheduledIn === 'OFF' &&
    record.scheduledOut === 'OFF' &&
    record.scheduleSource !== 'import'
  ) {
    return true
  }
  if (canInferPunch) return true
  return false
}

export function applyRoutineToRecords(records, settings, employees = []) {
  const cfg = normalizeSettings(settings)
  const empById = new Map((employees || []).map((e) => [e.id, e]))
  const classified = (records || []).map((r) => {
    if (!isRoutineEligible(r, cfg)) return r
    const department = empById.get(r.employeeId)?.department
    const next = classifyByRoutine({
      date: r.date,
      actualIn: r.actualIn,
      actualOut: r.actualOut,
      settings: cfg,
      department,
    })
    const draft = {
      ...r,
      scheduledIn: next.scheduledIn,
      scheduledOut: next.scheduledOut,
      status: next.status,
      lateMinutes: next.lateMinutes,
      otHours: next.otHours,
    }
    const dayType =
      next.status === 'Leave-Personal'
        ? 'leave-personal'
        : next.status === 'Leave-Sick'
          ? 'leave-sick'
          : next.status === 'Leave-Vacation'
            ? 'leave-vacation'
            : next.scheduledIn === 'OFF'
              ? 'off'
              : 'work'
    const syncedRemark = syncAttendanceRemark(r.remark, {
      dayType,
      issue: punchIssue(draft),
      lateMinutes: next.lateMinutes,
    })
    return {
      ...draft,
      scheduleSource: next.scheduleSource,
      shiftLabel: next.shiftLabel || undefined,
      shiftId: next.shiftId || undefined,
      remark: syncedRemark || undefined,
    }
  })
  return enforceKitchenWeeklyShifts(classified, cfg, employees)
}

export { newTemplateId }
