import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  Check,
  ClipboardList,
  Download,
  FileBarChart,
  Search,
  Upload,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import StatusBadge from '../components/StatusBadge'
import EmployeeMultiSelect from '../components/EmployeeMultiSelect'
import TablePager from '../components/TablePager'
import { DEFAULT_PAGE_SIZE, usePageSlice } from '../lib/pageSlice'
import {
  attendanceRemarkText,
  badgeStatus,
  currentMonthISO,
  displayPunches,
  isLateRecord,
  punchIssue,
} from '../lib/attendance'

function formatMonthLabel(ym, locale) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  try {
    return new Date(y, m - 1, 1).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
    })
  } catch {
    return ym
  }
}

/** e.g. 2026-08-01 – 2026-08-31 */
function formatMonthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const last = new Date(y, m, 0).getDate()
  const pad = (n) => String(n).padStart(2, '0')
  return `${y}-${pad(m)}-01 – ${y}-${pad(m)}-${pad(last)}`
}

function safeFileStem(name, fallback = 'company') {
  const stem = String(name || '')
    .trim()
    .replace(/[^\w\u0E00-\u0E7F\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return stem || fallback
}

function downloadExcel(filename, sheetName, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const colCount = rows[0]?.length || 0
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => {
    let max = 10
    for (const row of rows) {
      const cell = row[i]
      const len = String(cell ?? '').length
      if (len > max) max = Math.min(len, 40)
    }
    return { wch: max + 1 }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Sheet1')
  XLSX.writeFile(wb, filename)
}

/** Click-to-edit remark — buttons sit inside the input; one cell focused at a time. */
function SummaryRemarkCell({
  value,
  placeholder,
  editing,
  onStartEdit,
  onSave,
  onCancel,
}) {
  const [draft, setDraft] = useState(value || '')

  useEffect(() => {
    if (editing) setDraft(value || '')
  }, [editing, value])

  function save() {
    const next = draft.trim()
    if (next !== (value || '').trim()) onSave(next)
    else onCancel()
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={onStartEdit}
        title={value || placeholder}
        className="block w-full truncate text-center text-xs text-slate-500 hover:text-teal-700"
      >
        {value ? (
          <span className="text-slate-700">{value}</span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </button>
    )
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-teal-400 bg-white py-1 pr-14 pl-2 text-center text-xs text-slate-800 outline-none"
      />
      <div className="absolute top-1/2 right-0.5 flex -translate-y-1/2 items-center">
        <button
          type="button"
          onClick={save}
          className="rounded p-0.5 text-teal-700 hover:bg-teal-50"
          aria-label="save"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="cancel"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}

export default function Summary() {
  const {
    employees,
    employeeMap,
    records,
    summaryNotes,
    setSummaryNote,
    hasData,
    availableMonths,
    companyName,
  } = useApp()
  const { t, locale } = useI18n()
  const [reportType, setReportType] = useState('attendance') // attendance | summary
  const [month, setMonth] = useState(currentMonthISO())
  const [query, setQuery] = useState('')
  const [employeeIds, setEmployeeIds] = useState([]) // empty = all
  const [deptFilter, setDeptFilter] = useState('all')
  const [attendanceSort, setAttendanceSort] = useState('name') // name | date | dept
  const [summarySort, setSummarySort] = useState('name') // name | dept
  const [page, setPage] = useState(1)
  const [editingRemarkId, setEditingRemarkId] = useState(null)

  useEffect(() => {
    setEditingRemarkId(null)
  }, [month, page, reportType])

  useEffect(() => {
    if (!availableMonths.length) return
    if (!availableMonths.includes(month)) {
      setMonth(availableMonths[0])
    }
  }, [availableMonths, month])

  const monthRecords = useMemo(() => {
    const nameOf = (r) =>
      employeeMap[r.employeeId]?.name || r.employeeId

    return records
      .filter((r) => r.date.startsWith(month))
      .map((r) => {
        const punches = displayPunches(r)
        const issue = punchIssue(r)
        return {
          ...r,
          displayIn: punches.actualIn,
          displayOut: punches.actualOut,
          issue,
        }
      })
      .sort((a, b) => {
        const deptOf = (r) => employeeMap[r.employeeId]?.department || ''
        if (attendanceSort === 'date') {
          return (
            a.date.localeCompare(b.date) ||
            nameOf(a).localeCompare(nameOf(b), locale)
          )
        }
        if (attendanceSort === 'dept') {
          return (
            deptOf(a).localeCompare(deptOf(b), locale) ||
            nameOf(a).localeCompare(nameOf(b), locale) ||
            a.date.localeCompare(b.date)
          )
        }
        return (
          nameOf(a).localeCompare(nameOf(b), locale) ||
          a.date.localeCompare(b.date)
        )
      })
  }, [records, month, employeeMap, attendanceSort, locale])

  const summaryRows = useMemo(() => {
    return employees
      .map((emp) => {
        const empRecs = records.filter(
          (r) => r.employeeId === emp.id && r.date.startsWith(month),
        )
        if (!empRecs.length) return null

        const workDays = empRecs.filter((r) =>
          ['Normal', 'Late', 'Holiday-Worked'].includes(r.status),
        ).length
        const lateCount = empRecs.filter((r) => isLateRecord(r)).length
        const otHours = empRecs.reduce((sum, r) => sum + (r.otHours || 0), 0)
        const leaveDays = empRecs.filter((r) =>
          String(r.status || '').startsWith('Leave-'),
        ).length
        const swapped = empRecs.filter((r) => r.isSwapped).length
        return {
          ...emp,
          workDays,
          lateCount,
          otHours: Math.round(otHours * 100) / 100,
          leaveDays,
          swapped,
          remark: summaryNotes?.[emp.id]?.[month] || '',
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const deptA = a.department || ''
        const deptB = b.department || ''
        if (summarySort === 'dept') {
          return (
            deptA.localeCompare(deptB, locale) ||
            a.name.localeCompare(b.name, locale)
          )
        }
        return (
          a.name.localeCompare(b.name, locale) ||
          deptA.localeCompare(deptB, locale)
        )
      })
  }, [employees, records, month, locale, summarySort, summaryNotes])

  const q = query.trim().toLowerCase()

  const monthEmployees = useMemo(() => {
    const ids = new Set(monthRecords.map((r) => r.employeeId))
    return employees
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [employees, monthRecords, locale])

  const departments = useMemo(() => {
    const set = new Set()
    for (const e of monthEmployees) {
      const d = String(e.department || '').trim()
      if (d && d !== '—') set.add(d)
    }
    return [...set].sort((a, b) => a.localeCompare(b, locale))
  }, [monthEmployees, locale])

  const employeeOptions = useMemo(() => {
    if (deptFilter === 'all') return monthEmployees
    return monthEmployees.filter((e) => (e.department || '') === deptFilter)
  }, [monthEmployees, deptFilter])

  const optionIdSet = useMemo(
    () => new Set(employeeOptions.map((e) => e.id)),
    [employeeOptions],
  )

  useEffect(() => {
    if (!employeeIds.length) return
    const next = employeeIds.filter((id) => optionIdSet.has(id))
    if (next.length !== employeeIds.length) setEmployeeIds(next)
  }, [optionIdSet, employeeIds])

  useEffect(() => {
    if (deptFilter !== 'all' && !departments.includes(deptFilter)) {
      setDeptFilter('all')
    }
  }, [departments, deptFilter])

  const employeeIdSet = useMemo(() => new Set(employeeIds), [employeeIds])
  const employeeFilterActive =
    employeeIds.length > 0 &&
    employeeIds.length < employeeOptions.length

  const hasActiveFilter =
    Boolean(q) || employeeFilterActive || deptFilter !== 'all'

  const filteredMonthRecords = useMemo(() => {
    return monthRecords.filter((r) => {
      if (employeeFilterActive && !employeeIdSet.has(r.employeeId)) {
        return false
      }
      const emp = employeeMap[r.employeeId]
      const dept = emp?.department || ''
      if (deptFilter !== 'all' && dept !== deptFilter) return false
      if (!q) return true
      const name = (emp?.name || '').toLowerCase()
      const id = String(r.employeeId || '').toLowerCase()
      return (
        name.includes(q) ||
        id.includes(q) ||
        dept.toLowerCase().includes(q)
      )
    })
  }, [
    monthRecords,
    employeeMap,
    q,
    employeeFilterActive,
    employeeIdSet,
    deptFilter,
  ])

  const filteredSummaryRows = useMemo(() => {
    return summaryRows.filter((r) => {
      if (employeeFilterActive && !employeeIdSet.has(r.id)) return false
      if (deptFilter !== 'all' && (r.department || '') !== deptFilter) {
        return false
      }
      if (!q) return true
      const name = (r.name || '').toLowerCase()
      const id = String(r.id || '').toLowerCase()
      const dept = (r.department || '').toLowerCase()
      return name.includes(q) || id.includes(q) || dept.includes(q)
    })
  }, [summaryRows, q, employeeFilterActive, employeeIdSet, deptFilter])

  useEffect(() => {
    setPage(1)
  }, [
    reportType,
    month,
    query,
    employeeIds,
    deptFilter,
    attendanceSort,
    summarySort,
  ])

  const attPage = usePageSlice(filteredMonthRecords, page)
  const sumPage = usePageSlice(filteredSummaryRows, page)
  const activePage = reportType === 'attendance' ? attPage : sumPage

  useEffect(() => {
    if (page !== activePage.page) setPage(activePage.page)
  }, [page, activePage.page])

  function formatShiftCell(r) {
    if (r.scheduledIn === 'OFF') return 'OFF'
    if (r.scheduledIn === '—' || r.scheduledOut === '—') return '—'
    const range = `${r.scheduledIn}–${r.scheduledOut}`
    return r.shiftLabel ? `${range} (${r.shiftLabel})` : range
  }

  function exportAttendanceExcel() {
    const header = [
      t('report.col.date'),
      t('report.col.employee'),
      t('report.col.dept'),
      t('report.col.shift'),
      t('report.col.in'),
      t('report.col.out'),
      t('report.col.status'),
      t('report.col.remark'),
    ]
    const rows = filteredMonthRecords.map((r) => {
      const emp = employeeMap[r.employeeId]
      const name = emp?.name || r.employeeId
      const resolved = badgeStatus(r)
      const statusLabel = t(`status.${resolved}`)
      const status = [
        statusLabel.startsWith('status.') ? resolved : statusLabel,
        r.isSwapped ? t('status.Swapped') : '',
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        r.date,
        name,
        emp?.department || '',
        formatShiftCell(r),
        r.displayIn,
        r.displayOut,
        status,
        attendanceRemarkText(r, t) || '',
      ]
    })
    downloadExcel(
      `${safeFileStem(companyName)}_Attendance_${month}.xlsx`,
      t('report.attendance'),
      [header, ...rows],
    )
  }

  function exportSummaryExcel() {
    const period = formatMonthRange(month)
    const header = [
      t('report.col.date'),
      t('report.col.employee'),
      t('report.col.dept'),
      t('report.col.workDays'),
      t('report.col.leave'),
      t('report.col.late'),
      t('report.col.ot'),
      t('report.col.swapped'),
      t('report.col.remark'),
    ]
    const rows = filteredSummaryRows.map((r) => [
      period,
      r.name,
      r.department,
      r.workDays,
      r.leaveDays,
      r.lateCount,
      r.otHours,
      r.swapped,
      r.remark || '',
    ])
    downloadExcel(
      `${safeFileStem(companyName)}_Summary_${month}.xlsx`,
      t('report.summary'),
      [header, ...rows],
    )
  }

  function handleExport() {
    if (reportType === 'attendance') exportAttendanceExcel()
    else exportSummaryExcel()
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('report.title')}
          </h2>
          <p className="mt-1 text-slate-500">{t('report.subtitleEmpty')}</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <Upload className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-600">{t('report.empty')}</p>
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
            {t('report.title')}
          </h2>
          <p className="mt-1 text-slate-500">
            {companyName} · {t('report.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Download className="h-4 w-4" />
          {t('common.exportExcel')}
        </button>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setReportType('attendance')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            reportType === 'attendance'
              ? 'bg-teal-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          {t('report.attendance')}
        </button>
        <button
          type="button"
          onClick={() => setReportType('summary')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            reportType === 'summary'
              ? 'bg-teal-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FileBarChart className="h-4 w-4" />
          {t('report.summary')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('report.search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.month')}
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            {(availableMonths.length ? availableMonths : [month]).map((ym) => (
              <option key={ym} value={ym}>
                {formatMonthLabel(ym, locale)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.employee')}
          </label>
          <EmployeeMultiSelect
            options={employeeOptions}
            value={employeeIds}
            onChange={setEmployeeIds}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.department')}
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="min-w-[8rem] rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="all">{t('common.all')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.sortBy')}
          </label>
          {reportType === 'attendance' ? (
            <select
              value={attendanceSort}
              onChange={(e) => setAttendanceSort(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="name">{t('common.sortName')}</option>
              <option value="dept">{t('common.sortDept')}</option>
              <option value="date">{t('common.sortDate')}</option>
            </select>
          ) : (
            <select
              value={summarySort}
              onChange={(e) => setSummarySort(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="name">{t('common.sortName')}</option>
              <option value="dept">{t('common.sortDept')}</option>
            </select>
          )}
        </div>
      </div>

      {reportType === 'attendance' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">
              {t('report.attTitle')}
            </h3>
            <p className="text-xs text-slate-500">
              {formatMonthLabel(month, locale)} · {filteredMonthRecords.length}
              {hasActiveFilter ? ` / ${monthRecords.length}` : ''}{' '}
              {t('report.attHint')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.date')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.employee')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.dept')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.shift')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('report.col.in')}</th>
                  <th className="px-4 py-3 font-medium">{t('report.col.out')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.status')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.remark')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attPage.slice.map((r) => {
                  const emp = employeeMap[r.employeeId]
                  const displayName = emp?.name || r.employeeId
                  const showId =
                    r.employeeId &&
                    r.employeeId !== displayName
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {r.date}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="font-medium text-slate-900">
                          {displayName}
                        </div>
                        {showId && (
                          <div className="text-xs text-slate-400">
                            {r.employeeId}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {emp?.department || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {r.scheduledIn === 'OFF' ? (
                          'OFF'
                        ) : r.scheduledIn === '—' || r.scheduledOut === '—' ? (
                          '—'
                        ) : (
                          <div>
                            <div>{`${r.scheduledIn}–${r.scheduledOut}`}</div>
                            {r.shiftLabel && (
                              <div className="text-xs text-slate-400">
                                {r.shiftLabel}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.displayIn}</td>
                      <td className="px-4 py-3">{r.displayOut}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-center gap-1">
                          <StatusBadge status={r.status} remark={r.remark} />
                          {r.isSwapped && <StatusBadge status="Swapped" />}
                        </div>
                      </td>
                      <td className="max-w-[180px] px-4 py-3 text-xs text-slate-500">
                        {attendanceRemarkText(r, t) || '—'}
                      </td>
                    </tr>
                  )
                })}
                {filteredMonthRecords.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      {t('report.noRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePager
            page={attPage.page}
            totalPages={attPage.totalPages}
            total={attPage.total}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setPage}
          />
          {attPage.total <= DEFAULT_PAGE_SIZE && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              {filteredMonthRecords.length} {t('report.exportHint')}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">
              {t('report.sumTitle')}
            </h3>
            <p className="text-xs text-slate-500">
              {formatMonthLabel(month, locale)} · {filteredSummaryRows.length}
              {hasActiveFilter ? ` / ${summaryRows.length}` : ''}{' '}
              {t('report.sumHint')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">
                    {t('report.col.date')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.employee')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.dept')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.workDays')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.leave')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.late')}
                  </th>
                  <th className="px-4 py-3 font-medium">{t('report.col.ot')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('report.col.swapped')}
                  </th>
                  <th className="w-[180px] max-w-[180px] px-4 py-3 font-medium">
                    {t('report.col.remark')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sumPage.slice.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatMonthRange(month)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      {r.id && r.id !== r.name && (
                        <div className="text-xs text-slate-400">{r.id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.department}</td>
                    <td className="px-4 py-3">{r.workDays}</td>
                    <td className="px-4 py-3">{r.leaveDays}</td>
                    <td className="px-4 py-3">{r.lateCount}</td>
                    <td className="px-4 py-3">{r.otHours}</td>
                    <td className="px-4 py-3">{r.swapped}</td>
                    <td className="w-[180px] max-w-[180px] overflow-hidden px-4 py-3 text-xs text-slate-500">
                      <SummaryRemarkCell
                        value={r.remark || ''}
                        placeholder={t('report.summaryRemarkPh')}
                        editing={editingRemarkId === r.id}
                        onStartEdit={() => setEditingRemarkId(r.id)}
                        onSave={(next) => {
                          setSummaryNote(r.id, month, next)
                          setEditingRemarkId(null)
                        }}
                        onCancel={() => setEditingRemarkId(null)}
                      />
                    </td>
                  </tr>
                ))}
                {filteredSummaryRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      {t('report.noSummary')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TablePager
            page={sumPage.page}
            totalPages={sumPage.totalPages}
            total={sumPage.total}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={setPage}
          />
          {sumPage.total <= DEFAULT_PAGE_SIZE && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
              {filteredSummaryRows.length} {t('report.employees')} ·{' '}
              {formatMonthLabel(month, locale)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
