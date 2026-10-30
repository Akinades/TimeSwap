import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Upload } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import StatusBadge from '../components/StatusBadge'
import TablePager from '../components/TablePager'
import { DEFAULT_PAGE_SIZE, usePageSlice } from '../lib/pageSlice'
import { attendanceRemarkText, displayPunches } from '../lib/attendance'

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

export default function Attendance() {
  const { records, employeeMap, hasData } = useApp()
  const { t, locale } = useI18n()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const { latestYear, monthsInLatestYear } = useMemo(() => {
    let maxYear = 0
    const monthSet = new Set()
    records.forEach((r) => {
      if (!r.date || r.date.length < 7) return
      const y = Number(r.date.slice(0, 4))
      if (!Number.isFinite(y)) return
      if (y > maxYear) maxYear = y
    })
    records.forEach((r) => {
      if (!r.date || r.date.length < 7) return
      if (Number(r.date.slice(0, 4)) === maxYear) {
        monthSet.add(r.date.slice(0, 7))
      }
    })
    return {
      latestYear: maxYear || null,
      monthsInLatestYear: [...monthSet].sort().reverse(),
    }
  }, [records])

  // Default / sync selected month to latest available month of latest year
  useEffect(() => {
    if (!monthsInLatestYear.length) {
      setMonth('')
      return
    }
    if (!month || !monthsInLatestYear.includes(month)) {
      setMonth(monthsInLatestYear[0])
    }
  }, [monthsInLatestYear, month])

  const yearRecords = useMemo(() => {
    if (!latestYear) return []
    return records.filter((r) => r.date?.startsWith(String(latestYear)))
  }, [records, latestYear])

  const monthRecords = useMemo(() => {
    if (!month) return yearRecords
    return yearRecords.filter((r) => r.date.startsWith(month))
  }, [yearRecords, month])

  const filtered = useMemo(() => {
    return monthRecords
      .filter((r) => {
        const emp = employeeMap[r.employeeId]
        const nameMatch =
          !query ||
          emp?.name?.toLowerCase().includes(query.toLowerCase()) ||
          r.employeeId.toLowerCase().includes(query.toLowerCase())
        const statusMatch =
          status === 'all' ||
          (status === 'Swapped'
            ? r.isSwapped
            : status === 'Normal'
              ? r.status === 'Normal' || r.status === 'Late'
              : r.status === status)
        const fromMatch = !dateFrom || r.date >= dateFrom
        const toMatch = !dateTo || r.date <= dateTo
        return nameMatch && statusMatch && fromMatch && toMatch
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.employeeId.localeCompare(b.employeeId),
      )
  }, [monthRecords, employeeMap, query, status, dateFrom, dateTo])

  useEffect(() => {
    setPage(1)
  }, [query, status, month, dateFrom, dateTo])

  const {
    slice: pageRows,
    totalPages,
    page: safePage,
    total,
  } = usePageSlice(filtered, page)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  function handleMonthChange(value) {
    setMonth(value)
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          {t('att.title')}
        </h2>
        <p className="mt-1 text-slate-500">
          {t('att.subtitle')}
          {latestYear
            ? locale === 'th-TH'
              ? ` · ${t('att.yearLabel')} ${latestYear + 543} (${latestYear})`
              : ` · ${t('att.yearLabel')} ${latestYear}`
            : ''}
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <Upload className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-600">{t('att.empty')}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {t('common.uploadFile')}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t('att.search')}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t('common.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                <option value="all">{t('common.all')}</option>
                <option value="Normal">{t('status.Normal')}</option>
                <option value="Holiday">{t('status.Holiday')}</option>
                <option value="Leave-Personal">
                  {t('swap.leave.personal')}
                </option>
                <option value="Leave-Sick">{t('swap.leave.sick')}</option>
                <option value="Leave-Vacation">
                  {t('swap.leave.vacation')}
                </option>
                <option value="Absent">{t('status.Absent')}</option>
                <option value="Holiday-Worked">
                  {t('status.Holiday-Worked')}
                </option>
                <option value="Swapped">{t('status.Swapped')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t('common.yearLatest')}
              </label>
              <select
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              >
                {monthsInLatestYear.map((ym) => (
                  <option key={ym} value={ym}>
                    {formatMonthLabel(ym, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t('common.dateFrom')}
              </label>
              <input
                type="date"
                value={dateFrom}
                min={month ? `${month}-01` : undefined}
                max={month ? `${month}-31` : undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {t('common.dateTo')}
              </label>
              <input
                type="date"
                value={dateTo}
                min={month ? `${month}-01` : undefined}
                max={month ? `${month}-31` : undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t('att.col.employee')}
                    </th>
                    <th className="px-4 py-3 font-medium">{t('att.col.date')}</th>
                    <th className="px-4 py-3 font-medium">
                      {t('att.col.scheduled')}
                    </th>
                    <th className="px-4 py-3 font-medium">{t('att.col.in')}</th>
                    <th className="px-4 py-3 font-medium">{t('att.col.out')}</th>
                    <th className="px-4 py-3 font-medium">
                      {t('att.col.status')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('common.remark')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((r) => {
                    const emp = employeeMap[r.employeeId]
                    const punches = displayPunches(r)
                    const displayName = emp?.name || r.employeeId
                    const showId =
                      r.employeeId && r.employeeId !== displayName
                    const note = attendanceRemarkText(r, t)
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {displayName}
                          </div>
                          {(showId || emp?.department) && (
                            <div className="text-xs text-slate-400">
                              {[
                                showId ? r.employeeId : null,
                                emp?.department || null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{r.date}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.scheduledIn === 'OFF' ? (
                            'OFF'
                          ) : r.scheduledIn === '—' ||
                            r.scheduledOut === '—' ? (
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
                        <td className="px-4 py-3">{punches.actualIn}</td>
                        <td className="px-4 py-3">{punches.actualOut}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <StatusBadge status={r.status} remark={r.remark} />
                            {r.isSwapped && <StatusBadge status="Swapped" />}
                          </div>
                        </td>
                        <td className="max-w-[160px] px-4 py-3 text-xs text-slate-500">
                          {note || '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        {t('att.noMatch')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <TablePager
              page={safePage}
              totalPages={totalPages}
              total={total}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setPage}
            />
            {total <= DEFAULT_PAGE_SIZE && (
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                {t('att.showing')} {filtered.length} {t('att.of')}{' '}
                {monthRecords.length}
                {month ? ` · ${formatMonthLabel(month, locale)}` : ''}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
