import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  ClockAlert,
  ArrowLeftRight,
  Upload,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  Trash2,
  Building2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import ClearDataModal from '../components/ClearDataModal'

function Metric({ label, value, icon: Icon, tone }) {
  const tones = {
    teal: 'text-teal-700 bg-teal-50',
    green: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50',
    indigo: 'text-indigo-700 bg-indigo-50',
  }
  return (
    <div className="flex items-center gap-3 px-1 py-1 sm:px-2">
      <div className={`rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const {
    companyName,
    metrics,
    importHiptime,
    importing,
    uploadFeedback,
    pendingSwaps,
    employeeMap,
    hasData,
    lastImport,
  } = useApp()
  const { t, locale } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const pending = pendingSwaps.filter((s) => s.status === 'Pending')

  const handleFiles = useCallback(
    async (files) => {
      const file = files?.[0]
      if (!file) return
      try {
        await importHiptime(file)
      } catch {
        /* feedback already set in context */
      }
    },
    [importHiptime],
  )

  return (
    <div className="space-y-8">
      {/* Company hero */}
      <section className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-slate-50 px-6 py-7 sm:px-8">
        <div
          className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-teal-200/30 blur-2xl"
          aria-hidden
        />
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
              {t('dash.companyLabel')}
            </p>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {companyName}
                </h2>
                <p className="mt-1.5 max-w-xl text-sm text-slate-500">
                  {t('dash.welcome')}
                </p>
                {lastImport ? (
                  <p className="mt-3 text-xs text-slate-400">
                    {t('dash.lastImport')}:{' '}
                    <span className="font-medium text-slate-600">
                      {lastImport.fileName}
                    </span>
                    {' · '}
                    {lastImport.rowCount} {t('dash.items')}
                    {' · '}
                    {new Date(lastImport.importedAt).toLocaleString(locale)}
                  </p>
                ) : (
                  <p className="mt-3 text-xs font-medium text-amber-700">
                    {t('dash.emptyHint')}
                  </p>
                )}
              </div>
            </div>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white/80 px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              {t('dash.clearData')}
            </button>
          )}
        </div>
      </section>

      {/* Today metrics */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-slate-500">
          {t('dash.todayTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-5 sm:grid-cols-4 sm:px-6">
          <Metric
            label={t('dash.totalEmployees')}
            value={metrics.totalEmployees}
            icon={Users}
            tone="teal"
          />
          <Metric
            label={t('dash.presentToday')}
            value={metrics.presentToday}
            icon={UserCheck}
            tone="green"
          />
          <Metric
            label={t('dash.lateToday')}
            value={metrics.lateToday}
            icon={ClockAlert}
            tone="amber"
          />
          <Metric
            label={t('dash.pendingSwaps')}
            value={metrics.pendingSwaps}
            icon={ArrowLeftRight}
            tone="indigo"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Upload — primary action */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900">
              {t('dash.uploadTitle')}
            </h3>
          </div>

          <p className="mb-3 text-xs text-slate-500">{t('dash.uploadHint')}</p>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
              dragging
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-200 bg-slate-50/80 hover:border-teal-400'
            }`}
          >
            <FileSpreadsheet className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
              {t('dash.dropHint')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('dash.dropFormats')}</p>
            <label className="mt-5 cursor-pointer rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700">
              {importing ? t('dash.reading') : t('dash.chooseFile')}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  handleFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {uploadFeedback && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                uploadFeedback.type === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {uploadFeedback.message}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-400">{t('dash.columnsHint')}</p>
        </section>

        {/* Shortcuts */}
        <aside className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              {t('dash.quickActions')}
            </h3>
            <div className="flex flex-col gap-2">
              <Link
                to="/employees"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                <Users className="h-4 w-4 text-teal-600" />
                {t('nav.employees')}
              </Link>
              <Link
                to="/swaps"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                <CalendarDays className="h-4 w-4 text-teal-600" />
                {t('dash.goSwaps')}
              </Link>
              <Link
                to="/attendance"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                <ClipboardList className="h-4 w-4 text-teal-600" />
                {t('dash.goAttendance')}
              </Link>
              <Link
                to="/summary"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                <FileBarChart className="h-4 w-4 text-teal-600" />
                {t('dash.goReports')}
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              {t('dash.pendingSwapsTitle')}
            </h3>
            <ul className="space-y-2">
              {pending.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-slate-800">
                    {s.scope === 'store'
                      ? t('swap.storeLabel')
                      : employeeMap[s.employeeId]?.name || s.employeeId}
                  </p>
                  <p className="text-xs text-slate-400">
                    {s.fromDate} → {s.toDate}
                  </p>
                </li>
              ))}
              {pending.length === 0 && (
                <li className="text-sm text-slate-400">{t('dash.noPending')}</li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      <ClearDataModal open={clearOpen} onClose={() => setClearOpen(false)} />
    </div>
  )
}
