import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  BACKUP_VERSION,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createCompanyId,
  emptyCompanyData,
  shiftRules,
} from '../config'
import {
  computeLateMinutes,
  computeOtHours,
  deriveStatus,
  formatTime,
  statusForDayType,
  todayISO,
} from '../lib/attendance'
import { fetchWorkspace, saveWorkspace } from '../lib/api'
import { parseHiptimeFile } from '../lib/parseHiptime'
import {
  applyRoutineToRecords,
  enforceKitchenWeeklyShifts,
  normalizeSettings,
} from '../lib/shiftRoutine'

import { planImport, withHistory, undoHistory } from '../lib/workflow'

const AppContext = createContext(null)

function readLocalWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed?.companies)) return parsed
    }
  } catch {
    /* ignore */
  }

  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy) {
      const data = JSON.parse(legacy)
      const id = createCompanyId()
      return {
        companies: [
          {
            id,
            name: 'บริษัทของฉัน',
            createdAt: new Date().toISOString(),
            ...emptyCompanyData(),
            employees: data.employees ?? [],
            records: data.records ?? [],
            swapHistory: data.swapHistory ?? [],
            lastImport: data.lastImport ?? null,
          },
        ],
        activeCompanyId: id,
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

function clearLocalWorkspace() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }) {
  const [companies, setCompanies] = useState([])
  const [activeCompanyId, setActiveCompanyId] = useState(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadFeedback, setUploadFeedback] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const skipNextSave = useRef(true)
  const saveTimer = useRef(null)

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || null,
    [companies, activeCompanyId],
  )

  const employees = activeCompany?.employees ?? []
  const records = activeCompany?.records ?? []
  const swapHistory = activeCompany?.swapHistory ?? []
  const summaryNotes = activeCompany?.summaryNotes ?? {}
  const lastImport = activeCompany?.lastImport ?? null
  const companySettings = normalizeSettings(activeCompany?.settings)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const remote = await fetchWorkspace()
        if (cancelled) return

        const hasRemote =
          Array.isArray(remote?.companies) && remote.companies.length > 0

        if (hasRemote) {
          skipNextSave.current = true
          setCompanies(remote.companies)
          setActiveCompanyId(remote.activeCompanyId ?? remote.companies[0]?.id ?? null)
          clearLocalWorkspace()
        } else {
          const local = readLocalWorkspace()
          if (local?.companies?.length) {
            skipNextSave.current = true
            setCompanies(local.companies)
            setActiveCompanyId(
              local.activeCompanyId ?? local.companies[0]?.id ?? null,
            )
            await saveWorkspace(local)
            clearLocalWorkspace()
          } else {
            skipNextSave.current = true
            setCompanies([])
            setActiveCompanyId(null)
          }
        }
        setLoadError(null)
      } catch (err) {
        if (cancelled) return
        const local = readLocalWorkspace()
        if (local?.companies) {
          skipNextSave.current = true
          setCompanies(local.companies)
          setActiveCompanyId(local.activeCompanyId ?? null)
          setLoadError(
            `เชื่อมต่อ MongoDB ไม่ได้ — ใช้ข้อมูลในเครื่องชั่วคราว (${err.message})`,
          )
        } else {
          setLoadError(err.message || 'โหลดข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await saveWorkspace({ companies, activeCompanyId })
        setLoadError(null)
      } catch (err) {
        setLoadError(`บันทึก MongoDB ไม่สำเร็จ: ${err.message}`)
      } finally {
        setSaving(false)
      }
    }, 400)

    return () => clearTimeout(saveTimer.current)
  }, [companies, activeCompanyId, ready])

  function updateActiveCompany(patch) {
    setCompanies((prev) =>
      prev.map((c) => (c.id === activeCompanyId ? { ...c, ...patch } : c)),
    )
  }

  function patchActiveCompany(updater) {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== activeCompanyId) return c
        const next =
          typeof updater === 'function' ? updater(c) : { ...c, ...updater }
        return next
      }),
    )
  }

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees],
  )

  const metrics = useMemo(() => {
    const today = todayISO()
    const todayRecords = records.filter((r) => r.date === today)
    return {
      totalEmployees: employees.length,
      presentToday: todayRecords.filter((r) =>
        ['Normal', 'Late', 'Holiday-Worked'].includes(r.status),
      ).length,
      lateToday: todayRecords.filter((r) => r.status === 'Late').length,
      pendingSwaps: swapHistory.filter((s) => s.status === 'Pending').length,
      swappedShifts: records.filter((r) => r.isSwapped).length,
      totalRecords: records.length,
    }
  }, [employees, records, swapHistory])

  function addCompany(name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) throw new Error('กรุณากรอกชื่อบริษัท')
    const id = createCompanyId()
    const company = {
      id,
      name: trimmed,
      createdAt: new Date().toISOString(),
      ...emptyCompanyData(),
    }
    setCompanies((prev) => [...prev, company])
    setActiveCompanyId(id)
    return company
  }

  function switchCompany(id) {
    if (companies.some((c) => c.id === id)) {
      setActiveCompanyId(id)
      setUploadFeedback(null)
    }
  }

  function renameCompany(id, name) {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
    )
  }

  function addEmployee({
    id,
    name,
    department = '',
    phone = '',
    email = '',
    note = '',
  } = {}) {
    if (!activeCompanyId) throw new Error('ยังไม่มีบริษัทที่ใช้งาน')
    const trimmedName = String(name || '').trim()
    if (!trimmedName) throw new Error('กรุณากรอกชื่อพนักงาน')
    let empId = String(id || '').trim()
    if (!empId) empId = `e_${Date.now().toString(36)}`
    if (employees.some((e) => e.id === empId)) {
      throw new Error('รหัสพนักงานนี้มีอยู่แล้ว')
    }

    const created = {
      id: empId,
      name: trimmedName,
      department: String(department || '').trim() || '—',
      phone: String(phone || '').trim(),
      email: String(email || '').trim(),
      note: String(note || '').trim(),
      active: true,
    }
    patchActiveCompany((company) => ({
      ...company,
      employees: [...(company.employees || []), created].sort((a, b) =>
        a.name.localeCompare(b.name, 'th'),
      ),
    }))
    return created
  }

  function updateEmployee(id, patch = {}) {
    if (!activeCompanyId || !id) return
    patchActiveCompany((company) => {
      const employeesNext = (company.employees || []).map((e) => {
        if (e.id !== id) return e
        const next = { ...e }
        if (patch.name !== undefined) {
          const n = String(patch.name || '').trim()
          if (n) next.name = n
        }
        if (patch.department !== undefined) {
          next.department = String(patch.department || '').trim() || '—'
        }
        if (patch.phone !== undefined)
          next.phone = String(patch.phone || '').trim()
        if (patch.email !== undefined)
          next.email = String(patch.email || '').trim()
        if (patch.note !== undefined)
          next.note = String(patch.note || '').trim()
        if (patch.active !== undefined) next.active = Boolean(patch.active)
        return next
      })
      return {
        ...company,
        employees: employeesNext.sort((a, b) =>
          a.name.localeCompare(b.name, 'th'),
        ),
      }
    })
  }

  function removeEmployee(id, { deleteRecords = true } = {}) {
    if (!activeCompanyId || !id) return
    patchActiveCompany((company) => {
      const employeesNext = (company.employees || []).filter((e) => e.id !== id)
      const recordsNext = deleteRecords
        ? (company.records || []).filter((r) => r.employeeId !== id)
        : company.records || []
      const swapsNext = (company.swapHistory || []).filter(
        (s) => s.employeeId !== id,
      )
      const notes = { ...(company.summaryNotes || {}) }
      delete notes[id]
      return {
        ...company,
        employees: employeesNext,
        records: recordsNext,
        swapHistory: swapsNext,
        summaryNotes: notes,
      }
    })
  }

  /** Set / clear a monthly summary remark for one employee (YYYY-MM). */
  function setSummaryNote(employeeId, monthYm, note) {
    if (!activeCompanyId || !employeeId || !monthYm) return
    const text = String(note || '').trim()
    patchActiveCompany((company) => {
      const notes = { ...(company.summaryNotes || {}) }
      const byEmp = { ...(notes[employeeId] || {}) }
      if (!text) delete byEmp[monthYm]
      else byEmp[monthYm] = text
      if (Object.keys(byEmp).length === 0) delete notes[employeeId]
      else notes[employeeId] = byEmp
      return { ...company, summaryNotes: notes }
    })
  }

  function removeCompany(id) {
    setCompanies((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (activeCompanyId === id) {
        setActiveCompanyId(next[0]?.id ?? null)
      }
      return next
    })
  }

  async function importHiptime(file) {
    if (!activeCompanyId || importing) return
    const companyId = activeCompanyId
    setImporting(true)
    setImportPreview(null)
    setUploadFeedback(null)
    try {
      const parsed = await parseHiptimeFile(file, { settings: companySettings })
      setImportPreview({ companyId, parsed })
    } catch (err) {
      setUploadFeedback({
        type: 'error',
        message: err.message || 'นำเข้าไฟล์ไม่สำเร็จ',
      })
    } finally {
      setImporting(false)
    }
  }

  function confirmImport(mode = 'skip') {
    if (!importPreview || importPreview.companyId !== activeCompanyId) return
    const { parsed } = importPreview
    patchActiveCompany((company) => {
      const plan = planImport(company, parsed, mode)
      const next = {
        ...company,
        records: plan.records,
        employees: plan.employees,
        lastImport: {
          fileName: parsed.meta.fileName,
          importedAt: new Date().toISOString(),
          rowCount: parsed.meta.rowCount,
          added: plan.added,
          updated: plan.updated,
          skippedDup:
            mode === 'skip'
              ? plan.duplicates + plan.internalDuplicates
              : plan.internalDuplicates,
        },
      }
      return withHistory(company, next, 'import', parsed.meta.fileName, {
        added: plan.added,
        updated: plan.updated,
      })
    })
    setImportPreview(null)
    setUploadFeedback({
      type: 'success',
      message: `นำเข้า "${parsed.meta.fileName}" สำเร็จ`,
    })
  }

  function undoActivity(id) {
    patchActiveCompany((company) => undoHistory(company, id))
  }

  /**
   * scope: 'all' | 'month'
   * months: string[] of 'YYYY-MM' when scope === 'month'
   */
  function clearData({ scope = 'all', months = [] } = {}) {
    if (!activeCompanyId) return

    if (scope === 'all') {
      updateActiveCompany({
        ...emptyCompanyData(),
        settings: normalizeSettings(activeCompany?.settings),
      })
      setUploadFeedback({
        type: 'success',
        message: 'ล้างข้อมูลทั้งหมดของบริษัทนี้แล้ว',
      })
      setTimeout(() => setUploadFeedback(null), 3000)
      return
    }

    const monthSet = new Set(months.filter(Boolean))
    if (!monthSet.size) {
      setUploadFeedback({
        type: 'error',
        message: 'กรุณาเลือกเดือนที่ต้องการลบ',
      })
      setTimeout(() => setUploadFeedback(null), 3000)
      return
    }

    patchActiveCompany((company) => {
      const nextRecords = company.records.filter(
        (r) => !monthSet.has(String(r.date).slice(0, 7)),
      )
      const remainingIds = new Set(nextRecords.map((r) => r.employeeId))
      const nextEmployees = company.employees.filter((e) =>
        remainingIds.has(e.id),
      )
      const nextSwaps = (company.swapHistory || []).filter((s) => {
        const fromM = String(s.fromDate || '').slice(0, 7)
        const toM = String(s.toDate || '').slice(0, 7)
        return !monthSet.has(fromM) && !monthSet.has(toM)
      })
      const nextNotes = {}
      Object.entries(company.summaryNotes || {}).forEach(([empId, byMonth]) => {
        if (!remainingIds.has(empId)) return
        const kept = {}
        Object.entries(byMonth || {}).forEach(([ym, note]) => {
          if (!monthSet.has(ym)) kept[ym] = note
        })
        if (Object.keys(kept).length) nextNotes[empId] = kept
      })

      let nextLastImport = company.lastImport
      if (!nextRecords.length) nextLastImport = null

      return {
        ...company,
        records: nextRecords,
        employees: nextEmployees,
        swapHistory: nextSwaps,
        summaryNotes: nextNotes,
        activityHistory: (company.activityHistory || []).filter(
          (e) =>
            !e.changes.some((c) =>
              monthSet.has((c.after || c.before).date.slice(0, 7)),
            ),
        ),
        lastImport: nextLastImport,
      }
    })

    const label = [...monthSet].sort().join(', ')
    setUploadFeedback({
      type: 'success',
      message: `ลบข้อมูลเดือน ${label} แล้ว`,
    })
    setTimeout(() => setUploadFeedback(null), 3000)
  }

  function clearAllData() {
    clearData({ scope: 'all' })
  }

  const availableMonths = useMemo(() => {
    const set = new Set()
    records.forEach((r) => {
      if (r.date && r.date.length >= 7) set.add(r.date.slice(0, 7))
    })
    return [...set].sort().reverse()
  }, [records])

  function applyPersonSwap(records, employeeId, workDate, holidayDate) {
    const next = [...records]
    const nextId = () => Math.max(0, ...next.map((r) => r.id), 0) + 1

    const workIdx = next.findIndex(
      (r) => r.employeeId === employeeId && r.date === workDate,
    )
    const holidayIdx = next.findIndex(
      (r) => r.employeeId === employeeId && r.date === holidayDate,
    )

    if (workIdx >= 0) {
      next[workIdx] = {
        ...next[workIdx],
        scheduledIn: 'OFF',
        scheduledOut: 'OFF',
        actualIn: '—',
        actualOut: '—',
        status: 'Holiday',
        isSwapped: true,
        lateMinutes: 0,
        otHours: 0,
      }
    } else {
      next.push({
        id: nextId(),
        employeeId,
        date: workDate,
        scheduledIn: 'OFF',
        scheduledOut: 'OFF',
        actualIn: '—',
        actualOut: '—',
        status: 'Holiday',
        isSwapped: true,
        lateMinutes: 0,
        otHours: 0,
      })
    }

    if (holidayIdx >= 0) {
      const existing = next[holidayIdx]
      next[holidayIdx] = {
        ...existing,
        scheduledIn:
          existing.scheduledIn !== 'OFF'
            ? existing.scheduledIn
            : shiftRules.standardIn,
        scheduledOut:
          existing.scheduledOut !== 'OFF'
            ? existing.scheduledOut
            : shiftRules.standardOut,
        actualIn:
          existing.actualIn !== '—' ? existing.actualIn : shiftRules.standardIn,
        actualOut:
          existing.actualOut !== '—'
            ? existing.actualOut
            : shiftRules.standardOut,
        status: 'Holiday-Worked',
        isSwapped: true,
      }
    } else {
      next.push({
        id: nextId() + 1,
        employeeId,
        date: holidayDate,
        scheduledIn: shiftRules.standardIn,
        scheduledOut: shiftRules.standardOut,
        actualIn: shiftRules.standardIn,
        actualOut: shiftRules.standardOut,
        status: 'Holiday-Worked',
        isSwapped: true,
        lateMinutes: 0,
        otHours: 0,
      })
    }

    return next
  }

  /**
   * scope: 'person' | 'store'
   * - person: สลับเฉพาะ employeeId
   * - store: สลับทั้งร้าน (ทุกพนักงานในบริษัท)
   */
  function swapShift({ scope = 'person', employeeId, workDate, holidayDate }) {
    if (!activeCompanyId || !workDate || !holidayDate) return

    patchActiveCompany((company) => {
      const targets =
        scope === 'store'
          ? company.employees.map((e) => e.id)
          : employeeId
            ? [employeeId]
            : []

      if (!targets.length) return company

      let nextRecords = company.records
      targets.forEach((id) => {
        nextRecords = applyPersonSwap(nextRecords, id, workDate, holidayDate)
      })

      const swapEntry = {
        id: `SWAP-${createCompanyId()}`,
        scope,
        employeeId: scope === 'store' ? null : employeeId,
        employeeCount: targets.length,
        fromDate: workDate,
        toDate: holidayDate,
        type: scope === 'store' ? 'Store Work ↔ Holiday' : 'Work ↔ Holiday',
        status: 'Approved',
        createdAt: new Date().toISOString(),
      }

      return withHistory(
        company,
        {
          ...company,
          records: nextRecords,
          swapHistory: [swapEntry, ...(company.swapHistory || [])],
        },
        'swap',
        `${workDate} → ${holidayDate}`,
      )
    })
  }

  /**
   * Create or update one attendance cell (employee + date).
   * dayType: 'work' | 'off'
   */
  function upsertAttendanceRecord({
    employeeId,
    date,
    actualIn,
    actualOut,
    dayType = 'work',
    remark,
  }) {
    if (!activeCompanyId || !employeeId || !date) return

    const inTime = actualIn ? formatTime(actualIn) : '—'
    const outTime = actualOut ? formatTime(actualOut) : '—'
    const normalizedIn =
      !actualIn || inTime === '—' || inTime === 'OFF' ? '—' : inTime
    const normalizedOut =
      !actualOut || outTime === '—' || outTime === 'OFF' ? '—' : outTime

    patchActiveCompany((company) => {
      const cfg = normalizeSettings(company.settings)
      const next = [...company.records]
      const idx = next.findIndex(
        (r) => r.employeeId === employeeId && r.date === date,
      )
      const existing = idx >= 0 ? next[idx] : null

      const leaveStatus = statusForDayType(dayType)
      const isLeave = Boolean(leaveStatus)
      const isOff = dayType === 'off' || isLeave

      let scheduledIn
      let scheduledOut
      let punchIn = normalizedIn
      let punchOut = normalizedOut

      if (isOff) {
        scheduledIn = 'OFF'
        scheduledOut = 'OFF'
        // Holiday / leave — no punch expected
        punchIn = '—'
        punchOut = '—'
      } else if (
        existing?.scheduledIn &&
        existing.scheduledIn !== 'OFF' &&
        existing.scheduledIn !== '—'
      ) {
        scheduledIn = existing.scheduledIn
        scheduledOut =
          existing.scheduledOut && existing.scheduledOut !== 'OFF'
            ? existing.scheduledOut
            : cfg.standardOut
      } else {
        scheduledIn = cfg.standardIn
        scheduledOut = cfg.standardOut
      }

      const status = isLeave
        ? leaveStatus
        : deriveStatus({
            scheduledIn,
            actualIn: punchIn,
            actualOut: punchOut,
            statusHint: dayType === 'off' ? 'Holiday' : null,
          })

      const lateMinutes =
        scheduledIn === 'OFF' ? 0 : computeLateMinutes(scheduledIn, punchIn)
      const otHours =
        scheduledOut === 'OFF' ? 0 : computeOtHours(scheduledOut, punchOut)

      const record = {
        id: existing?.id ?? Math.max(0, ...next.map((r) => r.id), 0) + 1,
        employeeId,
        date,
        scheduledIn,
        scheduledOut,
        actualIn: punchIn,
        actualOut: punchOut,
        status,
        isSwapped: existing?.isSwapped || false,
        lateMinutes,
        otHours,
        scheduleSource: 'manual',
        leaveType: isLeave ? dayType : undefined,
        remark: remark !== undefined ? remark || undefined : existing?.remark,
      }

      if (idx >= 0) next[idx] = record
      else next.push(record)

      return withHistory(
        company,
        { ...company, records: next },
        'edit',
        `${employeeId} · ${date}`,
      )
    })
  }

  /**
   * Build a JSON backup payload for the active company.
   * scope: 'all' | 'month'
   * months: string[] of 'YYYY-MM' when scope === 'month'
   */
  function buildBackup({ scope = 'all', months = [] } = {}) {
    if (!activeCompany) {
      throw new Error('ยังไม่มีบริษัทที่ใช้งาน')
    }

    const monthSet = new Set(months.filter(Boolean))
    let exportRecords = activeCompany.records || []
    let exportSwaps = activeCompany.swapHistory || []

    if (scope === 'month') {
      if (!monthSet.size) {
        throw new Error('กรุณาเลือกเดือนที่ต้องการสำรอง')
      }
      exportRecords = exportRecords.filter((r) =>
        monthSet.has(String(r.date).slice(0, 7)),
      )
      exportSwaps = exportSwaps.filter((s) => {
        const fromM = String(s.fromDate || '').slice(0, 7)
        const toM = String(s.toDate || '').slice(0, 7)
        return monthSet.has(fromM) || monthSet.has(toM)
      })
    }

    const remainingIds = new Set(exportRecords.map((r) => r.employeeId))
    const exportEmployees = (activeCompany.employees || []).filter((e) =>
      remainingIds.has(e.id),
    )

    let exportNotes = activeCompany.summaryNotes || {}
    if (scope === 'month') {
      const filtered = {}
      Object.entries(exportNotes).forEach(([empId, byMonth]) => {
        if (!remainingIds.has(empId)) return
        const kept = {}
        Object.entries(byMonth || {}).forEach(([ym, note]) => {
          if (monthSet.has(ym)) kept[ym] = note
        })
        if (Object.keys(kept).length) filtered[empId] = kept
      })
      exportNotes = filtered
    }

    return {
      app: 'TimeSwap',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      scope,
      months: scope === 'month' ? [...monthSet].sort() : [],
      company: {
        id: activeCompany.id,
        name: activeCompany.name,
        createdAt: activeCompany.createdAt,
        settings: normalizeSettings(activeCompany.settings),
        employees: exportEmployees,
        records: exportRecords,
        swapHistory: exportSwaps,
        summaryNotes: exportNotes,
        lastImport: activeCompany.lastImport ?? null,
        activityHistory: (activeCompany.activityHistory || []).filter(
          (e) =>
            scope === 'all' ||
            (e.changes.length > 0 &&
              e.changes.every((c) =>
                monthSet.has((c.after || c.before).date.slice(0, 7)),
              )),
        ),
      },
    }
  }

  /**
   * Save company shift routine settings.
   * applyToExisting: reclassify soft / punch-only rows with the new routine.
   */
  function updateCompanySettings(
    nextSettings,
    { applyToExisting = true } = {},
  ) {
    if (!activeCompanyId) return
    const settings = normalizeSettings(nextSettings)
    patchActiveCompany((company) => {
      const recordsNext = applyToExisting
        ? applyRoutineToRecords(
            company.records || [],
            settings,
            company.employees || [],
          )
        : company.records || []
      return {
        ...company,
        settings,
        records: recordsNext,
      }
    })
    setUploadFeedback({
      type: 'success',
      message: applyToExisting
        ? 'บันทึกการตั้งค่ากะ และอัปเดตข้อมูลที่มีอยู่แล้ว'
        : 'บันทึกการตั้งค่ากะแล้ว',
    })
    setTimeout(() => setUploadFeedback(null), 4000)
  }

  function downloadBackup({ scope = 'all', months = [] } = {}) {
    const payload = buildBackup({ scope, months })
    const safeName = (payload.company.name || 'company')
      .replace(/[^\w\u0E00-\u0E7F\-]+/g, '_')
      .slice(0, 40)
    const stamp = new Date().toISOString().slice(0, 10)
    const monthPart =
      scope === 'month' && payload.months.length
        ? `_${payload.months.join('-')}`
        : '_all'
    const filename = `TimeSwap_backup_${safeName}${monthPart}_${stamp}.json`

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    setUploadFeedback({
      type: 'success',
      message: `สำรองข้อมูลแล้ว — ${filename} (${payload.company.records.length} รายการ)`,
    })
    setTimeout(() => setUploadFeedback(null), 5000)
    return payload
  }

  /**
   * Restore from a TimeSwap JSON backup.
   * mode: 'replace' | 'merge'
   */
  async function restoreBackup(file, { mode = 'replace' } = {}) {
    if (!activeCompanyId) {
      throw new Error('ยังไม่มีบริษัทที่ใช้งาน')
    }

    const text = await file.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง')
    }

    if (!data?.company || !Array.isArray(data.company.records)) {
      throw new Error('ไฟล์สำรองไม่ใช่รูปแบบ TimeSwap')
    }

    const incoming = data.company
    const incomingRecords = incoming.records || []
    const incomingEmployees = incoming.employees || []
    const incomingSwaps = incoming.swapHistory || []

    if (mode === 'replace') {
      const remainingIds = new Set(incomingRecords.map((r) => r.employeeId))
      const employeesNext =
        incomingEmployees.length > 0
          ? incomingEmployees
          : (activeCompany?.employees || []).filter((e) =>
              remainingIds.has(e.id),
            )

      updateActiveCompany({
        employees: employeesNext,
        records: incomingRecords,
        swapHistory: incomingSwaps,
        summaryNotes: incoming.summaryNotes || {},
        activityHistory: incoming.activityHistory || [],
        lastImport: incoming.lastImport ?? null,
        settings: incoming.settings
          ? normalizeSettings(incoming.settings)
          : normalizeSettings(activeCompany?.settings),
      })
    } else {
      patchActiveCompany((company) => {
        const empMap = new Map(company.employees.map((e) => [e.id, e]))
        incomingEmployees.forEach((e) => empMap.set(e.id, e))

        const keyOf = (r) => `${r.employeeId}|${r.date}`
        const recMap = new Map(company.records.map((r) => [keyOf(r), r]))
        const maxId = Math.max(0, ...company.records.map((r) => r.id), 0)
        let nextId = maxId + 1

        incomingRecords.forEach((r) => {
          const key = keyOf(r)
          if (recMap.has(key)) {
            recMap.set(key, {
              ...recMap.get(key),
              ...r,
              id: recMap.get(key).id,
            })
          } else {
            recMap.set(key, { ...r, id: nextId++ })
          }
        })

        const notes = { ...(company.summaryNotes || {}) }
        Object.entries(incoming.summaryNotes || {}).forEach(
          ([empId, byMonth]) => {
            notes[empId] = { ...(notes[empId] || {}), ...(byMonth || {}) }
          },
        )

        return {
          ...company,
          settings: incoming.settings
            ? normalizeSettings(incoming.settings)
            : normalizeSettings(company.settings),
          employees: Array.from(empMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'th'),
          ),
          records: Array.from(recMap.values()),
          swapHistory: [...incomingSwaps, ...(company.swapHistory || [])],
          summaryNotes: notes,
          activityHistory: [
            ...new Map(
              [
                ...(company.activityHistory || []),
                ...(incoming.activityHistory || []),
              ].map((e) => [e.id, e]),
            ).values(),
          ].sort((a, b) => b.at.localeCompare(a.at)),
          lastImport: incoming.lastImport ?? company.lastImport,
        }
      })
    }

    setUploadFeedback({
      type: 'success',
      message: `กู้คืนจาก "${file.name}" สำเร็จ — ${incomingRecords.length} รายการ (${mode === 'replace' ? 'แทนที่' : 'รวม'})`,
    })
    setTimeout(() => setUploadFeedback(null), 5000)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        กำลังโหลดข้อมูลจาก MongoDB…
      </div>
    )
  }

  const value = {
    importPreview:
      importPreview?.companyId === activeCompanyId ? importPreview : null,
    cancelImport: () => setImportPreview(null),
    confirmImport,
    undoActivity,
    activityHistory: activeCompany?.activityHistory || [],
    companies,
    activeCompany,
    activeCompanyId,
    companyName: activeCompany?.name ?? '',
    hasCompany: companies.length > 0,
    ready,
    saving,
    loadError,
    employees,
    employeeMap,
    records,
    swapHistory,
    summaryNotes,
    pendingSwaps: swapHistory,
    metrics,
    uploadFeedback,
    importing,
    lastImport,
    shiftRules,
    companySettings,
    hasData: records.length > 0,
    availableMonths,
    addCompany,
    switchCompany,
    renameCompany,
    removeCompany,
    addEmployee,
    updateEmployee,
    removeEmployee,
    setSummaryNote,
    importHiptime,
    clearData,
    clearAllData,
    swapShift,
    upsertAttendanceRecord,
    updateCompanySettings,
    downloadBackup,
    restoreBackup,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
