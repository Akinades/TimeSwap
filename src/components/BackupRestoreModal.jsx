import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'

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

export default function BackupRestoreModal({
  open,
  onClose,
  initialTab = 'backup',
}) {
  const { availableMonths, records, downloadBackup, restoreBackup, companyName } =
    useApp()
  const { t, locale } = useI18n()
  const [tab, setTab] = useState(initialTab)
  const [scope, setScope] = useState('month')
  const [selected, setSelected] = useState([])
  const [restoreMode, setRestoreMode] = useState('replace')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTab(initialTab)
      setError('')
    }
  }, [open, initialTab])

  const monthCounts = useMemo(() => {
    const map = {}
    records.forEach((r) => {
      const key = String(r.date).slice(0, 7)
      map[key] = (map[key] || 0) + 1
    })
    return map
  }, [records])

  if (!open) return null

  function toggleMonth(ym) {
    setSelected((prev) =>
      prev.includes(ym) ? prev.filter((x) => x !== ym) : [...prev, ym],
    )
  }

  async function handleBackup() {
    setError('')
    setBusy(true)
    try {
      downloadBackup({
        scope,
        months: scope === 'month' ? selected : [],
      })
      onClose()
    } catch (err) {
      setError(err.message || t('backup.backingUp'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRestoreFile(files) {
    const file = files?.[0]
    if (!file) return
    setError('')
    setBusy(true)
    try {
      await restoreBackup(file, { mode: restoreMode })
      onClose()
    } catch (err) {
      setError(err.message || t('backup.restoring'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
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
              {t('backup.title')}
            </h3>
            <p className="text-xs text-slate-500">{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('backup')
              setError('')
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'backup'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <Download className="h-4 w-4" />
            {t('backup.tabBackup')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('restore')
              setError('')
            }}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'restore'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            <Upload className="h-4 w-4" />
            {t('backup.tabRestore')}
          </button>
        </div>

        {tab === 'backup' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{t('backup.hint')}</p>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setScope('month')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  scope === 'month'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {t('backup.byMonth')}
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  scope === 'all'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {t('backup.all')}
              </button>
            </div>

            {scope === 'month' ? (
              availableMonths.length === 0 ? (
                <p className="text-sm text-slate-400">{t('backup.noData')}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelected(availableMonths)}
                      className="text-xs text-teal-700 hover:underline"
                    >
                      {t('backup.selectAllMonths')}
                    </button>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2">
                    {availableMonths.map((ym) => (
                      <li key={ym}>
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                          <span className="flex items-center gap-2 text-sm text-slate-800">
                            <input
                              type="checkbox"
                              checked={selected.includes(ym)}
                              onChange={() => toggleMonth(ym)}
                            />
                            {formatMonthLabel(ym, locale)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {monthCounts[ym] || 0}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {t('backup.allHint')} ({records.length})
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBackup}
                disabled={
                  busy ||
                  (scope === 'month' && selected.length === 0) ||
                  (scope === 'all' && records.length === 0)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {busy ? t('backup.backingUp') : t('backup.download')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{t('backup.restoreHint')}</p>

            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'replace'}
                  onChange={() => setRestoreMode('replace')}
                />
                {t('backup.replace')}
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="radio"
                  name="restoreMode"
                  checked={restoreMode === 'merge'}
                  onChange={() => setRestoreMode('merge')}
                />
                {t('backup.merge')}
              </label>
            </div>

            {restoreMode === 'replace' && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t('backup.replaceWarn')}
              </div>
            )}

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-teal-400">
              <Upload className="mb-2 h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {busy ? t('backup.restoring') : t('backup.chooseJson')}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={busy}
                onChange={(e) => handleRestoreFile(e.target.files)}
              />
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
