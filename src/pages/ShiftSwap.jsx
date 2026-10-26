import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from 'date-fns'
import {
  AlertTriangle,
  ArrowLeftRight,
  Pencil,
  Store,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import StatusBadge from '../components/StatusBadge'
import TablePager, {
  DEFAULT_PAGE_SIZE,
  usePageSlice,
} from '../components/TablePager'
import TimeInput24 from '../components/TimeInput24'
import {
  currentMonthISO,
  dayTypeFromRecord,
  displayPunches,
  isLeaveStatus,
  isOffDayRecord,
  isAutoManagedRemark,
  leaveRemarkForDayType,
  punchIssue,
  punchIssueLabel,
} from '../lib/attendance'

function personDayStatus(record, t) {
  const issue = punchIssue(record)
  if (issue === 'no-in' || issue === 'no-out' || issue === 'no-both') {
    return {
      label:
        issue === 'no-in'
          ? t('swap.personNoIn')
          : issue === 'no-out'
            ? t('swap.personNoOut')
            : t('swap.personNoBoth'),
      className: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300',
      issue,
    }
  }
  if (!record) return { label: '—', className: 'bg-slate-50 text-slate-400' }
  if (record.status === 'Leave-Personal') {
    return {
      label: t('swap.leave.personalShort'),
      className: 'bg-violet-100 text-violet-800',
    }
  }
  if (record.status === 'Leave-Sick') {
    return {
      label: t('swap.leave.sickShort'),
      className: 'bg-fuchsia-100 text-fuchsia-800',
    }
  }
  if (record.status === 'Leave-Vacation') {
    return {
      label: t('swap.leave.vacationShort'),
      className: 'bg-cyan-100 text-cyan-800',
    }
  }
  if (isOffDayRecord(record)) {
    return { label: 'OFF', className: 'bg-slate-100 text-slate-600' }
  }
  if (record.status === 'Holiday-Worked') {
    return { label: 'HW', className: 'bg-sky-100 text-sky-800' }
  }
  if (record.status === 'Late') {
    return { label: 'Late', className: 'bg-amber-100 text-amber-800' }
  }
  if (record.status === 'Absent') {
    return { label: 'Abs', className: 'bg-red-100 text-red-800' }
  }
  return { label: 'Work', className: 'bg-emerald-100 text-emerald-800' }
}

function storeDayStatus({ work, off, total, swapped, incomplete }, t) {
  if (total === 0) {
    return { label: '—', className: 'bg-slate-50 text-slate-400', detail: '' }
  }
  const base = (() => {
    if (off === total) {
      return {
        label: t('swap.storeOff'),
        className: 'bg-slate-100 text-slate-700',
        detail: `${off}/${total}`,
      }
    }
    if (work === total) {
      return {
        label: t('swap.storeOpen'),
        className: 'bg-emerald-100 text-emerald-800',
        detail: `${work}/${total}`,
      }
    }
    return {
      label: t('swap.mixedShort'),
      className: 'bg-violet-100 text-violet-800',
      detail: t('swap.workOffDetail', { work, off }),
      swapped,
    }
  })()
  if (incomplete > 0) {
    return {
      ...base,
      className: `${base.className} ring-1 ring-orange-300`,
      incomplete,
    }
  }
  return base
}

export default function ShiftSwap() {
  const {
    employees,
    records,
    employeeMap,
    swapShift,
    setStoreDay,
    pendingSwaps,
    hasData,
    upsertAttendanceRecord,
    companySettings,
  } = useApp()
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('store') // 'store' | 'person'
  const [department, setDepartment] = useState('all')
  const [employeeId, setEmployeeId] = useState('')
  const [month, setMonth] = useState(currentMonthISO())
  const [modalOpen, setModalOpen] = useState(false)
  const [modalScope, setModalScope] = useState('store')
  /** store modal: 'swap' pairs two dates, 'set' assigns one date as work or off */
  const [modalAction, setModalAction] = useState('swap')
  const [storeDayType, setStoreDayType] = useState('off')
  const [storeUseStandard, setStoreUseStandard] = useState(false)
  const [workDate, setWorkDate] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editEmployeeId, setEditEmployeeId] = useState('')
  const [editBulkIds, setEditBulkIds] = useState([])
  /** Which punch side(s) the form should edit: 'in' | 'out' | 'both' */
  const [editPunchFocus, setEditPunchFocus] = useState('both')
  const [editDate, setEditDate] = useState('')
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [editDayType, setEditDayType] = useState('work')
  const [editRemark, setEditRemark] = useState('')
  const [editTimePreset, setEditTimePreset] = useState('') // '' | 'scheduled' | 'fallback'
  const [dayIssuesOpen, setDayIssuesOpen] = useState(false)
  const [dayIssuesDate, setDayIssuesDate] = useState('')
  const isBulkEdit = editBulkIds.length > 0
  const showEditIn = editPunchFocus !== 'out'
  const showEditOut = editPunchFocus !== 'in'
  const [matrixPage, setMatrixPage] = useState(1)

  const weekdays = t('swap.weekdays').split(',')

  const departments = useMemo(() => {
    const set = new Set()
    employees.forEach((e) => {
      if (e.department && e.department !== '—') set.add(e.department)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'th'))
  }, [employees])

  const filteredEmployees = useMemo(() => {
    if (department === 'all') return employees
    return employees.filter((e) => e.department === department)
  }, [employees, department])

  useEffect(() => {
    setMatrixPage(1)
  }, [department, month])

  const matrixPager = usePageSlice(filteredEmployees, matrixPage)

  useEffect(() => {
    if (matrixPage !== matrixPager.page) setMatrixPage(matrixPager.page)
  }, [matrixPage, matrixPager.page])

  useEffect(() => {
    if (!filteredEmployees.length) {
      setEmployeeId('')
      return
    }
    if (!filteredEmployees.some((e) => e.id === employeeId)) {
      setEmployeeId(filteredEmployees[0].id)
    }
  }, [filteredEmployees, employeeId])

  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`))
    const end = endOfMonth(start)
    return eachDayOfInterval({ start, end })
  }, [month])

  const empRecords = useMemo(() => {
    const map = {}
    records
      .filter((r) => r.employeeId === employeeId)
      .forEach((r) => {
        map[r.date] = r
      })
    return map
  }, [records, employeeId])

  const storeDayMap = useMemo(() => {
    const map = {}
    days.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd')
      let work = 0
      let off = 0
      let swapped = 0
      let total = 0
      let incomplete = 0
      const issues = []

      filteredEmployees.forEach((emp) => {
        const rec = records.find(
          (r) => r.employeeId === emp.id && r.date === key,
        )
        if (!rec) return
        total += 1
        if (rec.isSwapped) swapped += 1
        const issue = punchIssue(rec)
        if (issue) {
          incomplete += 1
          issues.push({ employeeId: emp.id, issue, record: rec })
        }
        if (isOffDayRecord(rec)) {
          off += 1
        } else {
          work += 1
        }
      })

      map[key] = { work, off, total, swapped, incomplete, issues }
    })
    return map
  }, [days, filteredEmployees, records])

  const matrix = useMemo(() => {
    const byEmpDate = {}
    records.forEach((r) => {
      if (!r.date.startsWith(month)) return
      byEmpDate[`${r.employeeId}|${r.date}`] = r
    })
    return { byEmpDate }
  }, [records, month])

  function openSwapModal({ scope, date }) {
    setModalScope(scope)
    setModalAction('swap')
    setStoreDayType('off')
    setStoreUseStandard(false)
    if (date) setWorkDate(date)
    setModalOpen(true)
  }

  function openEditModal({ employeeId: empId, date }) {
    const rec = records.find((r) => r.employeeId === empId && r.date === date)
    const punches = displayPunches(rec)
    const issue = punchIssue(rec)
    const dayType = dayTypeFromRecord(rec)
    setEditBulkIds([])
    setEditEmployeeId(empId)
    setEditDate(date)
    setEditDayType(dayType)
    setEditPunchFocus(
      issue === 'no-in' ? 'in' : issue === 'no-out' ? 'out' : 'both',
    )
    const leave = isLeaveStatus(rec?.status)
    const off = isOffDayRecord(rec) && !leave
    const noPunchDay = leave || off
    // Missing punch sides stay blank; keep existing times only for normal edits
    if (issue === 'no-out' || issue === 'no-in') {
      setEditIn('')
      setEditOut('')
    } else {
      setEditIn(
        noPunchDay ? '' : punches.actualIn !== '—' ? punches.actualIn : '',
      )
      setEditOut(
        noPunchDay ? '' : punches.actualOut !== '—' ? punches.actualOut : '',
      )
    }
    const existingRemark = rec?.remark || ''
    if (dayType.startsWith('leave-')) {
      setEditRemark(
        isAutoManagedRemark(existingRemark)
          ? leaveRemarkForDayType(dayType)
          : existingRemark,
      )
    } else if (issue === 'no-in' || issue === 'no-out' || issue === 'no-both') {
      setEditRemark(isAutoManagedRemark(existingRemark) ? '' : existingRemark)
    } else {
      setEditRemark(isAutoManagedRemark(existingRemark) ? '' : existingRemark)
    }
    setEditTimePreset('')
    setEditOpen(true)
  }

  function openBulkEditModal(date) {
    const issues = storeDayMap[date]?.issues || []
    if (!issues.length) return
    const ids = issues.map((item) => item.employeeId)
    const issueTypes = [...new Set(issues.map((item) => item.issue))]
    const onlyOut = issueTypes.length === 1 && issueTypes[0] === 'no-out'
    const onlyIn = issueTypes.length === 1 && issueTypes[0] === 'no-in'
    setEditBulkIds(ids)
    setEditEmployeeId('')
    setEditDate(date)
    setEditDayType('work')
    setEditPunchFocus(onlyOut ? 'out' : onlyIn ? 'in' : 'both')
    // Never auto-fill times — user enters only the missing side
    setEditIn('')
    setEditOut('')
    setEditRemark('')
    setEditTimePreset('')
    setDayIssuesOpen(false)
    setEditOpen(true)
  }

  useEffect(() => {
    const emp = searchParams.get('employee')
    const date = searchParams.get('date')
    if (emp && /^\d{4}-\d{2}-\d{2}$/.test(date || '') && employeeMap[emp]) {
      setMonth(date.slice(0, 7))
      setView('person')
      setEmployeeId(emp)
      openEditModal({ employeeId: emp, date })
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, employeeMap])

  function applyEditTimePreset() {
    const cfg = companySettings || {}
    const inn = cfg.standardIn || ''
    const out = cfg.standardOut || ''
    setEditIn(inn)
    setEditOut(out)
    setEditTimePreset('standard')
  }

  function handleSaveEdit() {
    if (!editDate) return
    const isLeave = editDayType.startsWith('leave-')
    const isOff = editDayType === 'off' || isLeave
    const targets = isBulkEdit
      ? editBulkIds
      : editEmployeeId
        ? [editEmployeeId]
        : []
    if (!targets.length) return

    targets.forEach((empId) => {
      const rec = records.find(
        (r) => r.employeeId === empId && r.date === editDate,
      )
      const punches = displayPunches(rec)
      const keepIn =
        punches.actualIn && punches.actualIn !== '—' ? punches.actualIn : ''
      const keepOut =
        punches.actualOut && punches.actualOut !== '—' ? punches.actualOut : ''

      let actualIn = ''
      let actualOut = ''
      if (!isOff) {
        if (editPunchFocus === 'out') {
          actualIn = keepIn
          actualOut = editOut || keepOut
        } else if (editPunchFocus === 'in') {
          actualIn = editIn || keepIn
          actualOut = keepOut
        } else if (isBulkEdit) {
          actualIn = editIn || keepIn
          actualOut = editOut || keepOut
        } else {
          actualIn = editIn
          actualOut = editOut
        }
      }

      upsertAttendanceRecord({
        employeeId: empId,
        date: editDate,
        actualIn,
        actualOut,
        dayType: editDayType,
        remark: editRemark,
      })
    })

    setSavedMsg(
      isBulkEdit
        ? t('swap.savedBulkEdit', {
            count: targets.length,
            date: editDate,
          })
        : t('swap.savedEdit', {
            name: employeeMap[editEmployeeId]?.name || editEmployeeId,
            date: editDate,
          }),
    )
    setEditOpen(false)
    setEditBulkIds([])
    setEditPunchFocus('both')
    setEditTimePreset('')
    setTimeout(() => setSavedMsg(''), 4000)
  }

  function closeEditModal() {
    setEditOpen(false)
    setEditBulkIds([])
    setEditPunchFocus('both')
    setEditTimePreset('')
  }

  function openDayIssues(date) {
    const stats = storeDayMap[date]
    if (stats?.incomplete > 0) {
      setDayIssuesDate(date)
      setDayIssuesOpen(true)
      return
    }
    openSwapModal({ scope: 'store', date })
  }

  function closeSwapModal() {
    setModalOpen(false)
    setWorkDate('')
    setHolidayDate('')
    setModalAction('swap')
    setStoreDayType('off')
    setStoreUseStandard(false)
  }

  function handleSaveSwap() {
    const assigningStoreDay = modalScope === 'store' && modalAction === 'set'

    if (assigningStoreDay) {
      if (!workDate) return
      setStoreDay({
        date: workDate,
        dayType: storeDayType,
        useStandard: storeDayType === 'work' && storeUseStandard,
      })
      setSavedMsg(
        t(storeDayType === 'off' ? 'swap.savedStoreOff' : 'swap.savedStoreWork', {
          date: workDate,
          count: employees.length,
        }),
      )
      closeSwapModal()
      setTimeout(() => setSavedMsg(''), 5000)
      return
    }

    if (!workDate || !holidayDate || workDate === holidayDate) return
    if (modalScope === 'person' && !employeeId) return

    swapShift({
      scope: modalScope,
      employeeId: modalScope === 'person' ? employeeId : null,
      workDate,
      holidayDate,
    })

    setSavedMsg(
      modalScope === 'store'
        ? t('swap.savedStore', {
            work: workDate,
            holiday: holidayDate,
            count: employees.length,
          })
        : t('swap.savedPerson', {
            name: employeeMap[employeeId]?.name || employeeId,
            work: workDate,
            holiday: holidayDate,
          }),
    )
    closeSwapModal()
    setTimeout(() => setSavedMsg(''), 5000)
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('swap.title')}
          </h2>
          <p className="mt-1 text-slate-500">{t('swap.subtitle')}</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <Upload className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-600">{t('swap.empty')}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('common.uploadFile')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('swap.title')}
          </h2>
          <p className="mt-1 text-slate-500">{t('swap.subtitleAlt')}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            openSwapModal({ scope: view === 'store' ? 'store' : 'person' })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          <ArrowLeftRight className="h-4 w-4" />
          {t('swap.btn')}
        </button>
      </div>

      {savedMsg && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {savedMsg}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('swap.viewMode')}
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setView('store')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                view === 'store'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <Store className="h-4 w-4" />
              {t('swap.store')}
            </button>
            <button
              type="button"
              onClick={() => setView('person')}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                view === 'person'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              <User className="h-4 w-4" />
              {t('swap.person')}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.department')}
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="min-w-[8rem] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="all">{t('common.allDepartments')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {view === 'person' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('common.employee')}
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="min-w-[10rem] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {filteredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.department && e.department !== '—'
                    ? ` (${e.department})`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.month')}
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {view === 'store' ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                {t('swap.storeOpen')}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5">
                {t('swap.storeOff')}
              </span>
              <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-800">
                {t('swap.mixed')}
              </span>
              <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-800">
                {t('swap.missingPunch')}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekdays.map((d) => (
                <div
                  key={d}
                  className="pb-1 text-center text-xs font-medium text-slate-400"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: (days[0].getDay() + 6) % 7 }).map(
                (_, i) => (
                  <div key={`pad-${i}`} />
                ),
              )}
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const stats = storeDayMap[key] || {
                  work: 0,
                  off: 0,
                  total: 0,
                  swapped: 0,
                  incomplete: 0,
                }
                const st = storeDayStatus(stats, t)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openDayIssues(key)}
                    className={`flex min-h-[72px] flex-col rounded-lg border border-slate-100 p-2 text-left transition hover:border-teal-300 ${st.className}`}
                  >
                    <span className="text-xs font-semibold">
                      {format(day, 'd')}
                    </span>
                    <span className="mt-1 text-[10px] font-medium leading-tight">
                      {st.label}
                    </span>
                    {st.detail && (
                      <span className="mt-auto text-[9px] opacity-80">
                        {st.detail}
                      </span>
                    )}
                    {stats.incomplete > 0 && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold text-orange-700">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {t('swap.missingShort')} {stats.incomplete}
                      </span>
                    )}
                    {stats.swapped > 0 && (
                      <span className="text-[9px] text-indigo-600">
                        swapped {stats.swapped}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">
                {t('swap.matrixTitle')}
              </h3>
              <p className="text-xs text-slate-500">{t('swap.matrixHint')}</p>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 z-20 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-medium">
                      {t('common.employee')}
                    </th>
                    {days.map((day) => (
                      <th
                        key={format(day, 'yyyy-MM-dd')}
                        className="min-w-[36px] px-1 py-2 text-center font-medium"
                      >
                        {format(day, 'd')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixPager.slice.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-800">
                        {emp.name}
                      </td>
                      {days.map((day) => {
                        const key = format(day, 'yyyy-MM-dd')
                        const rec = matrix.byEmpDate[`${emp.id}|${key}`]
                        const st = personDayStatus(rec, t)
                        const issue = punchIssue(rec)
                        return (
                          <td key={key} className="px-0.5 py-1 text-center">
                            <button
                              type="button"
                              title={
                                issue
                                  ? `${emp.name} · ${key} · ${punchIssueLabel(issue, t)}`
                                  : `${emp.name} · ${key} · ${t('swap.editTime')}`
                              }
                              onClick={() =>
                                openEditModal({ employeeId: emp.id, date: key })
                              }
                              className={`mx-auto flex h-7 w-7 items-center justify-center rounded text-[9px] font-semibold ${st.className}`}
                            >
                              {issue
                                ? '!'
                                : rec
                                  ? rec.scheduledIn === 'OFF' ||
                                    rec.status === 'Holiday'
                                    ? 'O'
                                    : rec.status === 'Holiday-Worked'
                                      ? 'H'
                                      : 'W'
                                  : '·'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager
              page={matrixPager.page}
              totalPages={matrixPager.totalPages}
              total={matrixPager.total}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setMatrixPage}
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
              {t('swap.legend.work')}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5">
              {t('swap.legend.off')}
            </span>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800">
              {t('swap.legend.hw')}
            </span>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
              {t('swap.legend.late')}
            </span>
            <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-800">
              {t('swap.legend.missing')}
            </span>
          </div>
          <p className="mb-3 text-xs text-slate-500">{t('swap.clickEdit')}</p>
          <div className="grid grid-cols-7 gap-2">
            {weekdays.map((d) => (
              <div
                key={d}
                className="pb-1 text-center text-xs font-medium text-slate-400"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const rec = empRecords[key]
              const st = personDayStatus(rec, t)
              const issue = punchIssue(rec)
              const punches = displayPunches(rec)
              const hasAnyPunch =
                punches.actualIn !== '—' || punches.actualOut !== '—'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openEditModal({ employeeId, date: key })}
                  className={`flex min-h-[72px] flex-col rounded-lg border border-slate-100 p-2 text-left transition hover:border-teal-300 ${st.className}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold">
                      {format(day, 'd')}
                    </span>
                    {issue && (
                      <AlertTriangle className="h-3 w-3 text-orange-600" />
                    )}
                  </span>
                  <span className="mt-1 text-[10px] font-medium">
                    {st.label}
                  </span>
                  {hasAnyPunch ? (
                    <span className="mt-auto text-[9px] leading-tight opacity-80">
                      {punches.actualIn !== '—'
                        ? punches.actualIn
                        : t('swap.noInShort')}
                      {' · '}
                      {punches.actualOut !== '—'
                        ? punches.actualOut
                        : t('swap.noOutShort')}
                    </span>
                  ) : (
                    !issue &&
                    rec?.scheduledIn !== 'OFF' &&
                    rec?.status !== 'Holiday' && (
                      <span className="mt-auto text-[9px] text-slate-400">
                        {t('swap.noTime')}
                      </span>
                    )
                  )}
                  {rec?.isSwapped && (
                    <span className="text-[9px] text-indigo-600">swapped</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-900">
          {t('swap.history')}
        </h3>
        {pendingSwaps.length === 0 ? (
          <p className="text-sm text-slate-400">{t('swap.noHistory')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendingSwaps.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {s.scope === 'store'
                      ? t('swap.historyStore', {
                          count: s.employeeCount || employees.length,
                        })
                      : employeeMap[s.employeeId]?.name || s.employeeId}
                  </span>
                  <span className="text-slate-400">
                    {' '}
                    ·{' '}
                    {s.dayType
                      ? t(
                          s.dayType === 'off'
                            ? 'swap.historySetOff'
                            : 'swap.historySetWork',
                          { date: s.fromDate },
                        )
                      : `${s.fromDate} ↔ ${s.toDate}`}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {s.scope === 'store' && <StatusBadge status="Store" />}
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeSwapModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalScope === 'store' && modalAction === 'set'
                  ? t('swap.modal.setTitle')
                  : t('swap.modal.title')}
              </h3>
              <button
                type="button"
                onClick={closeSwapModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setModalScope('store')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  modalScope === 'store'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {t('swap.modal.store')}
              </button>
              <button
                type="button"
                onClick={() => setModalScope('person')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  modalScope === 'person'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {t('swap.modal.person')}
              </button>
            </div>

            {modalScope === 'store' && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction('swap')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    modalAction === 'swap'
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {t('swap.modal.modeSwap')}
                </button>
                <button
                  type="button"
                  onClick={() => setModalAction('set')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    modalAction === 'set'
                      ? 'border-teal-600 bg-teal-50 text-teal-800'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {t('swap.modal.modeSet')}
                </button>
              </div>
            )}

            <p className="mb-4 text-sm text-slate-500">
              {modalScope === 'store'
                ? modalAction === 'set'
                  ? t('swap.modal.setHint', { count: employees.length })
                  : t('swap.storeHintCount', { count: employees.length })
                : t('swap.modal.personHint')}
            </p>

            <div className="space-y-3">
              {modalScope === 'person' && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('common.employee')}
                    </label>
                    <select
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {filteredEmployees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.department && e.department !== '—'
                            ? ` (${e.department})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('common.department')}
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="all">{t('common.allDepartments')}</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {modalScope === 'store' && modalAction === 'set' ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('swap.modal.setDate')}
                    </label>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('swap.modal.setDayType')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setStoreDayType('work')}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                          storeDayType === 'work'
                            ? 'border-teal-600 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {t('swap.edit.workDay')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStoreDayType('off')}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                          storeDayType === 'off'
                            ? 'border-teal-600 bg-slate-100 text-slate-800'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {t('swap.edit.offDay')}
                      </button>
                    </div>
                  </div>
                  {storeDayType === 'off' ? (
                    <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">
                      {t('swap.modal.offExtraHint')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {t('swap.modal.workExtraHint')}
                      </p>
                      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={storeUseStandard}
                          onChange={(e) => setStoreUseStandard(e.target.checked)}
                        />
                        <span>
                          {t('swap.edit.useStandard')}
                          {companySettings?.standardIn &&
                          companySettings?.standardOut ? (
                            <span className="text-slate-400">
                              {' '}
                              ({companySettings.standardIn}–
                              {companySettings.standardOut})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('swap.modal.workToOff')}
                    </label>
                    <input
                      type="date"
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      {t('swap.modal.offToWork')}
                    </label>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={(e) => setHolidayDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {modalScope === 'store' && modalAction === 'set' && workDate ? (
                <p className="text-xs leading-relaxed text-slate-500">
                  {t('swap.modal.setAffected', {
                    count: employees.length,
                    date: workDate,
                    day: t(
                      storeDayType === 'off'
                        ? 'swap.edit.offDay'
                        : 'swap.edit.workDay',
                    ),
                  })}
                </p>
              ) : workDate && holidayDate ? (
                <p className="text-xs leading-relaxed text-slate-500">
                  {t('flow.affected', {
                    count: modalScope === 'store' ? employees.length : 1,
                    from: workDate,
                    to: holidayDate,
                  })}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSwapModal}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSwap}
                  disabled={
                    modalScope === 'store' && modalAction === 'set'
                      ? !workDate
                      : !workDate ||
                        !holidayDate ||
                        workDate === holidayDate ||
                        (modalScope === 'person' && !employeeId)
                  }
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {modalScope === 'store' && modalAction === 'set'
                    ? t('swap.modal.saveSet')
                    : t('swap.modal.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeEditModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-teal-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  {isBulkEdit
                    ? t('swap.edit.bulkTitle', { count: editBulkIds.length })
                    : t('swap.edit.title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isBulkEdit ? (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {editPunchFocus === 'out'
                  ? t('swap.edit.fixOutOnly')
                  : editPunchFocus === 'in'
                    ? t('swap.edit.fixInOnly')
                    : t('swap.edit.bulkHint')}
              </p>
            ) : editPunchFocus === 'out' ? (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('swap.edit.fixOutOnly')}
              </p>
            ) : editPunchFocus === 'in' ? (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t('swap.edit.fixInOnly')}
              </p>
            ) : (
              <p className="mb-4 text-sm text-slate-500">{t('swap.edit.hint')}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('common.employee')}
                </label>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                  {isBulkEdit
                    ? editBulkIds
                        .map(
                          (id) => employeeMap[id]?.name || id,
                        )
                        .slice(0, 4)
                        .join(', ') +
                      (editBulkIds.length > 4
                        ? ` … (+${editBulkIds.length - 4})`
                        : '')
                    : `${employeeMap[editEmployeeId]?.name || editEmployeeId}${
                        employeeMap[editEmployeeId]?.department
                          ? ` · ${employeeMap[editEmployeeId].department}`
                          : ''
                      }`}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('common.date')}
                </label>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {editDate}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('swap.edit.dayType')}
                </label>
                <select
                  value={editDayType}
                  onChange={(e) => {
                    const next = e.target.value
                    setEditDayType(next)
                    setEditTimePreset('')
                    if (next === 'off' || next.startsWith('leave-')) {
                      setEditIn('')
                      setEditOut('')
                    }
                    setEditRemark((prev) => {
                      if (prev.trim() && !isAutoManagedRemark(prev)) return prev
                      if (next.startsWith('leave-')) {
                        return leaveRemarkForDayType(next)
                      }
                      return ''
                    })
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="work">{t('swap.edit.workDay')}</option>
                  <option value="off">{t('swap.edit.offDay')}</option>
                  <option value="leave-personal">
                    {t('swap.leave.personal')}
                  </option>
                  <option value="leave-sick">{t('swap.leave.sick')}</option>
                  <option value="leave-vacation">
                    {t('swap.leave.vacation')}
                  </option>
                </select>
              </div>
              {editDayType === 'off' || editDayType.startsWith('leave-') ? (
                <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  {editDayType === 'off'
                    ? t('swap.edit.offNoPunchHint')
                    : t('swap.leave.noPunchHint')}
                </p>
              ) : (
                <div className="space-y-3">
                  {editPunchFocus === 'both' && !editIn && !editOut && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editTimePreset === 'standard'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              applyEditTimePreset()
                            } else {
                              setEditTimePreset('')
                              setEditIn('')
                              setEditOut('')
                            }
                          }}
                        />
                        <span>
                          {t('swap.edit.useStandard')}
                          {companySettings?.standardIn &&
                          companySettings?.standardOut ? (
                            <span className="text-slate-400">
                              {' '}
                              ({companySettings.standardIn}–
                              {companySettings.standardOut})
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </div>
                  )}
                  {showEditIn ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        {t('swap.edit.in')}
                      </label>
                      <TimeInput24
                        value={editIn}
                        onChange={(v) => {
                          setEditIn(v)
                          setEditTimePreset('')
                        }}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                  {showEditOut ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">
                        {t('swap.edit.out')}
                      </label>
                      <TimeInput24
                        value={editOut}
                        onChange={(v) => {
                          setEditOut(v)
                          setEditTimePreset('')
                        }}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('common.remark')}
                </label>
                <input
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  placeholder={t('swap.edit.remarkPh')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {dayIssuesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDayIssuesOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {t('swap.issues.title')} · {dayIssuesDate}
                </h3>
                <p className="text-sm text-slate-500">
                  {t('swap.issues.hint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDayIssuesOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {(storeDayMap[dayIssuesDate]?.issues || []).map((item) => (
                <li key={item.employeeId}>
                  <button
                    type="button"
                    onClick={() => {
                      setDayIssuesOpen(false)
                      openEditModal({
                        employeeId: item.employeeId,
                        date: dayIssuesDate,
                      })
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-orange-50"
                  >
                    <span className="text-sm font-medium text-slate-800">
                      {employeeMap[item.employeeId]?.name || item.employeeId}
                    </span>
                    <span className="text-xs text-orange-700">
                      {punchIssueLabel(item.issue, t)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {view === 'store' ? (
                  <button
                    type="button"
                    onClick={() => openBulkEditModal(dayIssuesDate)}
                    className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    {t('swap.issues.editAll')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setDayIssuesOpen(false)
                    openSwapModal({ scope: 'store', date: dayIssuesDate })
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
                >
                  {t('swap.issues.storeSwap')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setDayIssuesOpen(false)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
