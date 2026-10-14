import { useMemo, useState } from 'react'
import { Trash2, X } from 'lucide-react'
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

export default function ClearDataModal({ open, onClose }) {
  const { availableMonths, records, clearData } = useApp()
  const { t, locale } = useI18n()
  const [scope, setScope] = useState('month')
  const [selected, setSelected] = useState([])

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

  function handleConfirm() {
    if (scope === 'all') {
      if (!confirm(t('clear.confirmAll'))) return
      clearData({ scope: 'all' })
      onClose()
      return
    }
    if (!selected.length) return
    const labels = selected
      .slice()
      .sort()
      .map((ym) => formatMonthLabel(ym, locale))
      .join(', ')
    if (!confirm(`${t('clear.confirmMonths')} ${labels}?`)) return
    clearData({ scope: 'month', months: selected })
    setSelected([])
    onClose()
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
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-slate-900">
              {t('clear.title')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">{t('clear.hint')}</p>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setScope('month')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              scope === 'month'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            {t('clear.byMonth')}
          </button>
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              scope === 'all'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-slate-500'
            }`}
          >
            {t('clear.all')}
          </button>
        </div>

        {scope === 'month' ? (
          <div className="space-y-3">
            {availableMonths.length === 0 ? (
              <p className="text-sm text-slate-400">{t('clear.noMonths')}</p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelected(availableMonths)}
                    className="text-xs text-teal-700 hover:underline"
                  >
                    {t('clear.selectAllMonths')}
                  </button>
                </div>
                <ul className="max-h-56 space-y-1 overflow-auto rounded-xl border border-slate-200 p-2">
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
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t('clear.allWarn')}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={scope === 'month' && selected.length === 0}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scope === 'all'
              ? t('clear.deleteAll')
              : `${t('clear.deleteMonths')} ${selected.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  )
}
