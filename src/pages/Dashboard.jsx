import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  ClockAlert,
  CircleAlert,
  ArrowUpRight,
  Upload,
  CheckCircle2,
  History,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { punchIssue, punchIssueLabel, todayISO } from '../lib/attendance'
import ImportPreview from '../components/ImportPreview'

export default function Dashboard() {
  const {
    companyName,
    records,
    employees,
    employeeMap,
    importHiptime,
    importing,
    uploadFeedback,
    lastImport,
    activeCompanyId,
    importPreview,
  } = useApp()
  const { t, locale } = useI18n()
  const dates = records.map((r) => r.date).sort()
  const latest = dates.at(-1) || todayISO()
  const [range, setRange] = useState(null)
  const from =
    range?.companyId === activeCompanyId
      ? range.from
      : latest.slice(0, 7) + '-01'
  const to = range?.companyId === activeCompanyId ? range.to : latest
  const invalid = from > to
  const selected = records.filter((r) => r.date >= from && r.date <= to)
  const issues = selected
    .filter((r) => punchIssue(r) || r.status === 'Absent')
    .sort((a, b) => b.date.localeCompare(a.date))
  const [page, setPage] = useState(0)
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(issues.length / 8) - 1),
  )
  const [dragging, setDragging] = useState(false)
  const setDates = (a, b) => {
    setRange({ companyId: activeCompanyId, from: a, to: b })
    setPage(0)
  }
  const upload = (files) => {
    if (files?.[0] && !importing) importHiptime(files[0])
  }
  const cards = [
    [
      'dash.totalEmployees',
      employees.length,
      Users,
      'bg-slate-100 text-slate-700',
    ],
    [
      'flow.present',
      selected.filter((r) =>
        ['Normal', 'Late', 'Holiday-Worked'].includes(r.status),
      ).length,
      UserCheck,
      'bg-teal-50 text-teal-700',
    ],
    [
      'flow.late',
      selected.filter((r) => Number(r.lateMinutes) > 0 || r.status === 'Late')
        .length,
      ClockAlert,
      'bg-amber-50 text-amber-700',
    ],
    ['flow.review', issues.length, CircleAlert, 'bg-orange-50 text-orange-700'],
  ]
  return (
    <div className="w-full min-w-0 space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm font-medium text-teal-700">
            {companyName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t('flow.overview')}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t('flow.overviewHint')}
          </p>
        </div>
        <Link to="/history" className="btn-secondary">
          <History size={16} />
          {t('flow.history')}
        </Link>
      </section>
      {!records.length && (
        <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <h2 className="mb-3 font-semibold text-teal-900">
            {t('flow.getStarted')}
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary" to="/profile">
              {t('flow.step1')}
            </Link>
            <a className="btn-primary" href="#import">
              {t('flow.step2')}
            </a>
            <Link className="btn-secondary" to="/summary">
              {t('flow.step3')}
            </Link>
          </div>
        </section>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-medium text-slate-600">
              {t('common.dateFrom')}
              <input
                type="date"
                value={from}
                onChange={(e) => setDates(e.target.value, to)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              {t('common.dateTo')}
              <input
                type="date"
                value={to}
                onChange={(e) => setDates(from, e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['today', todayISO(), todayISO()],
              ['latest', latest.slice(0, 7) + '-01', latest],
              ['all', dates[0] || latest, latest],
            ].map(([key, a, b]) => (
              <button
                key={key}
                onClick={() => setDates(a, b)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium hover:bg-teal-50"
              >
                {t(`flow.${key}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            {records.length
              ? `${t('flow.through')} ${latest}`
              : t('common.noData')}
          </span>
          {!records.some((r) => r.date === todayISO()) && (
            <span className="text-amber-700">{t('flow.noToday')}</span>
          )}
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {t('flow.invalidRange')}
          </p>
        )}
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, Icon, tone]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">{t(label)}</p>
              <span className={`rounded-lg p-2 ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums">
              {label !== 'dash.totalEmployees' && (!selected.length || invalid)
                ? '—'
                : value}
            </p>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <CircleAlert size={18} className="text-orange-600" />
              {t('flow.review')}
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                {issues.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('flow.reviewHint')}
            </p>
          </div>
          {!issues.length ? (
            <div className="px-5 py-14 text-center">
              <CheckCircle2 className="mx-auto mb-3 text-teal-600" size={28} />
              <p className="text-sm text-slate-500">
                {!selected.length ? t('flow.noPeriod') : t('flow.noIssues')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {issues.slice(currentPage * 8, currentPage * 8 + 8).map((r) => (
                <li
                  key={`${r.employeeId}|${r.date}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {employeeMap[r.employeeId]?.name || r.employeeId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.date} ·{' '}
                      <span className="text-orange-700">
                        {punchIssue(r)
                          ? punchIssueLabel(punchIssue(r), t)
                          : t('status.Absent')}
                      </span>
                    </p>
                  </div>
                  <Link
                    to={`/swaps?employee=${encodeURIComponent(r.employeeId)}&date=${r.date}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50"
                  >
                    {t('flow.fix')}
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {issues.length > 8 && (
            <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs">
              <button
                className="btn-secondary"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                {t('pager.prev')}
              </button>
              <span>
                {currentPage + 1} / {Math.ceil(issues.length / 8)}
              </span>
              <button
                className="btn-secondary"
                disabled={(currentPage + 1) * 8 >= issues.length}
                onClick={() => setPage(currentPage + 1)}
              >
                {t('pager.next')}
              </button>
            </div>
          )}
        </section>
        <section
          id="import"
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Upload size={20} className="text-teal-600" />
            {t('flow.import')}
          </h2>
          <p className="mb-5 mt-2 text-sm leading-relaxed text-slate-500">
            {t('flow.importHint')}
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              upload(e.dataTransfer.files)
            }}
            className={`flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center sm:min-h-80 ${dragging ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}
          >
            <Upload className="mx-auto mb-5 text-teal-600" size={40} />
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-600">{t('dash.dropHint')}</p>
            <label className="btn-primary relative min-h-12 cursor-pointer px-8">
              {importing ? t('dash.reading') : t('dash.chooseFile')}
              <input
                aria-label={t('dash.chooseFile')}
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={importing}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  upload(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          {uploadFeedback && (
            <p
              role="status"
              className={`mt-3 rounded-lg p-3 text-xs ${uploadFeedback.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-700'}`}
            >
              {uploadFeedback.message}
            </p>
          )}
          {lastImport && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <p>{t('dash.lastImport')}</p>
              <p className="mt-1 break-all font-medium text-slate-700">
                {lastImport.fileName}
              </p>
              <p className="mt-1">
                {new Date(lastImport.importedAt).toLocaleString(locale)}
              </p>
            </div>
          )}
        </section>
      </div>
      <ImportPreview key={importPreview?.parsed.meta.fileName || 'empty'} />
    </div>
  )
}
