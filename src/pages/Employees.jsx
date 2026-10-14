import { useEffect, useMemo, useState } from 'react'
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { currentMonthISO } from '../lib/attendance'
import { computeTenure, formatStartDate } from '../lib/tenure'

function emptyForm() {
  return {
    id: '',
    name: '',
    department: '',
    phone: '',
    email: '',
    note: '',
    startDate: '',
  }
}

function formatTenureLabel(tenure, t) {
  if (!tenure) return null
  const parts = []
  if (tenure.years > 0) parts.push(t('emp.tenureYears', { n: tenure.years }))
  if (tenure.months > 0) parts.push(t('emp.tenureMonths', { n: tenure.months }))
  if (tenure.days > 0 || parts.length === 0) {
    parts.push(t('emp.tenureDays', { n: tenure.days }))
  }
  return parts.join(' ')
}

function StatBox({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-800',
    teal: 'bg-teal-50 text-teal-800',
    amber: 'bg-amber-50 text-amber-800',
    violet: 'bg-violet-50 text-violet-800',
    fuchsia: 'bg-fuchsia-50 text-fuchsia-800',
    cyan: 'bg-cyan-50 text-cyan-800',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl px-3 py-3 ${tones[tone]}`}>
      <p className="text-[11px] opacity-75">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function computeStats(empRecs) {
  const leavePersonal = empRecs.filter(
    (r) => r.status === 'Leave-Personal',
  ).length
  const leaveSick = empRecs.filter((r) => r.status === 'Leave-Sick').length
  const leaveVacation = empRecs.filter(
    (r) => r.status === 'Leave-Vacation',
  ).length
  return {
    workDays: empRecs.filter((r) =>
      ['Normal', 'Late', 'Holiday-Worked'].includes(r.status),
    ).length,
    late: empRecs.filter((r) => r.status === 'Late').length,
    lateMinutes: empRecs.reduce((s, r) => s + (r.lateMinutes || 0), 0),
    leave: leavePersonal + leaveSick + leaveVacation,
    leavePersonal,
    leaveSick,
    leaveVacation,
    absent: empRecs.filter((r) => r.status === 'Absent').length,
  }
}

export default function Employees() {
  const {
    employees,
    records,
    availableMonths,
    addEmployee,
    updateEmployee,
    removeEmployee,
  } = useApp()
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('all')
  const [periodType, setPeriodType] = useState('month') // month | year
  const [month, setMonth] = useState(
    () => availableMonths[0] || currentMonthISO(),
  )
  const [year, setYear] = useState(() =>
    String((availableMonths[0] || currentMonthISO()).slice(0, 4)),
  )
  const [selectedId, setSelectedId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState(null)

  const availableYears = useMemo(() => {
    const set = new Set()
    availableMonths.forEach((ym) => set.add(ym.slice(0, 4)))
    records.forEach((r) => {
      if (r.date?.length >= 4) set.add(r.date.slice(0, 4))
    })
    const list = [...set].sort().reverse()
    return list.length ? list : [String(new Date().getFullYear())]
  }, [availableMonths, records])

  const months = availableMonths.length ? availableMonths : [month]

  useEffect(() => {
    if (periodType === 'month' && months.length && !months.includes(month)) {
      setMonth(months[0])
    }
    if (periodType === 'year' && availableYears.length && !availableYears.includes(year)) {
      setYear(availableYears[0])
    }
  }, [periodType, months, month, availableYears, year])

  const periodKey = periodType === 'year' ? year : month

  const departments = useMemo(() => {
    const set = new Set()
    employees.forEach((e) => {
      if (e.department && e.department !== '—') set.add(e.department)
    })
    return [...set].sort((a, b) => a.localeCompare(b, locale))
  }, [employees, locale])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return employees
      .filter((e) => {
        if (department !== 'all' && e.department !== department) return false
        if (!q) return true
        return (
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q) ||
          (e.phone || '').includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [employees, query, department, locale])

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null)
      return
    }
    if (!filtered.some((e) => e.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = filtered.find((e) => e.id === selectedId) || null

  const selectedStats = useMemo(() => {
    if (!selected) return null
    const empRecs = records.filter(
      (r) =>
        r.employeeId === selected.id && String(r.date).startsWith(periodKey),
    )
    return computeStats(empRecs)
  }, [selected, records, periodKey])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(emp) {
    setEditingId(emp.id)
    setForm({
      id: emp.id,
      name: emp.name || '',
      department: emp.department === '—' ? '' : emp.department || '',
      phone: emp.phone || '',
      email: emp.email || '',
      note: emp.note || '',
      startDate: emp.startDate || '',
    })
    setError('')
    setModalOpen(true)
  }

  function handleSave(e) {
    e.preventDefault()
    setError('')
    try {
      if (editingId) {
        updateEmployee(editingId, {
          name: form.name,
          department: form.department,
          phone: form.phone,
          email: form.email,
          note: form.note,
          startDate: form.startDate,
        })
        setSelectedId(editingId)
      } else {
        const created = addEmployee(form)
        setSelectedId(created.id)
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.message || t('emp.errorSave'))
    }
  }

  const selectedTenure = selected
    ? computeTenure(selected.startDate)
    : null
  const selectedTenureLabel = formatTenureLabel(selectedTenure, t)
  const selectedStartLabel = selected
    ? formatStartDate(selected.startDate, locale.startsWith('zh') ? 'zh' : locale.startsWith('en') ? 'en' : 'th')
    : null

  function confirmDelete() {
    if (!deleteId) return
    removeEmployee(deleteId, { deleteRecords: true })
    if (selectedId === deleteId) setSelectedId(null)
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('emp.title')}
          </h2>
          <p className="mt-1 text-slate-500">{t('emp.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('emp.add')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('emp.search')}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('emp.searchPh')}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-teal-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('common.department')}
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="min-w-[8rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="all">{t('common.allDepartments')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t('emp.period')}
          </label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setPeriodType('month')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodType === 'month'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {t('emp.periodMonth')}
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('year')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                periodType === 'year'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {t('emp.periodYear')}
            </button>
          </div>
        </div>
        {periodType === 'month' ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('common.month')}
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {months.map((ym) => (
                <option key={ym} value={ym}>
                  {ym}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('common.year')}
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: names */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            <Users className="h-4 w-4 text-teal-600" />
            {filtered.length} {t('emp.people')}
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-14 text-center text-sm text-slate-400">
              {employees.length === 0 ? t('emp.empty') : t('emp.noMatch')}
            </div>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {filtered.map((emp) => {
                const active = emp.id === selected?.id
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(emp.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        active
                          ? 'bg-teal-50 text-teal-900'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          active
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {(emp.name || '?').slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{emp.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {emp.department || '—'}
                          {emp.startDate
                            ? ` · ${formatTenureLabel(computeTenure(emp.startDate), t) || ''}`
                            : ''}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Right: detail */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {selected.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selected.department || '—'}
                      <span className="text-slate-300"> · </span>
                      <span className="text-xs text-slate-400">{selected.id}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(selected)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('emp.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(selected.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('emp.delete')}
                  </button>
                </div>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-teal-50 px-3 py-2.5 sm:col-span-2">
                  <dt className="text-xs text-teal-700/70">{t('emp.tenure')}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-teal-900">
                    {selectedTenureLabel ? (
                      <>
                        {selectedTenureLabel}
                        {selectedStartLabel ? (
                          <span className="ml-2 font-normal text-teal-700/70">
                            ({t('emp.startDate')} {selectedStartLabel})
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="font-normal text-slate-500">
                        {t('emp.tenureNone')}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-400">{t('emp.phone')}</dt>
                  <dd className="mt-0.5 text-sm text-slate-800">
                    {selected.phone || '—'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <dt className="text-xs text-slate-400">{t('emp.email')}</dt>
                  <dd className="mt-0.5 truncate text-sm text-slate-800">
                    {selected.email || '—'}
                  </dd>
                </div>
                {selected.note ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-2">
                    <dt className="text-xs text-slate-400">{t('emp.note')}</dt>
                    <dd className="mt-0.5 text-sm text-slate-800">
                      {selected.note}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <p className="mb-3 text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {periodType === 'year'
                    ? t('emp.statsYear')
                    : t('emp.statsTitle')}{' '}
                  {periodKey}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatBox
                    label={t('emp.col.work')}
                    value={selectedStats?.workDays || 0}
                    tone="teal"
                  />
                  <StatBox
                    label={t('emp.col.late')}
                    value={selectedStats?.late || 0}
                    tone="amber"
                  />
                  <StatBox
                    label={t('emp.col.absent')}
                    value={selectedStats?.absent || 0}
                    tone="red"
                  />
                  <StatBox
                    label={t('swap.leave.personal')}
                    value={selectedStats?.leavePersonal || 0}
                    tone="violet"
                  />
                  <StatBox
                    label={t('swap.leave.sick')}
                    value={selectedStats?.leaveSick || 0}
                    tone="fuchsia"
                  />
                  <StatBox
                    label={t('swap.leave.vacation')}
                    value={selectedStats?.leaveVacation || 0}
                    tone="cyan"
                  />
                </div>
                {(selectedStats?.lateMinutes || 0) > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    {t('emp.lateMinutes')}: {selectedStats.lateMinutes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-slate-400">
              {t('emp.selectHint')}
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setModalOpen(false)}
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
                {editingId ? t('emp.editTitle') : t('emp.addTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              {!editingId && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {t('emp.id')}
                  </label>
                  <input
                    value={form.id}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, id: e.target.value }))
                    }
                    placeholder={t('emp.idPh')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('emp.col.name')} *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('common.department')}
                </label>
                <input
                  value={form.department}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, department: e.target.value }))
                  }
                  list="emp-dept-list"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <datalist id="emp-dept-list">
                  {departments.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('emp.startDate')}
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {t('emp.startDateHint')}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('emp.phone')}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('emp.email')}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {t('emp.note')}
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, note: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDeleteId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-semibold text-slate-900">
              {t('emp.deleteTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {t('emp.deleteHint', {
                name:
                  employees.find((e) => e.id === deleteId)?.name || deleteId,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('emp.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
