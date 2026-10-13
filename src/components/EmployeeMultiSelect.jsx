import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

/**
 * Multi-select employee picker.
 * Empty `value` = no filter (everyone).
 * Checkbox state follows `value` exactly.
 */
export default function EmployeeMultiSelect({
  options = [],
  value = [],
  onChange,
  className = '',
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = useMemo(() => new Set(value), [value])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options
    return options.filter((o) => {
      const name = (o.name || '').toLowerCase()
      const id = String(o.id || '').toLowerCase()
      const dept = (o.department || '').toLowerCase()
      return (
        name.includes(needle) ||
        id.includes(needle) ||
        dept.includes(needle)
      )
    })
  }, [options, q])

  const triggerLabel =
    value.length === 0
      ? t('common.all')
      : t('report.employeeSelected', { count: value.length })

  function toggle(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  function selectAll() {
    onChange(options.map((o) => o.id))
  }

  function clearSelection() {
    onChange([])
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-w-[12rem] max-w-[18rem] items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none hover:border-slate-400 focus:border-teal-500"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('common.search')}
                className="w-full rounded-lg border border-slate-200 py-1.5 pr-2 pl-8 text-sm outline-none focus:border-teal-500"
                autoFocus
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  selectAll()
                }}
                className="rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
              >
                {t('common.selectAll')}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  clearSelection()
                }}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                {t('common.clearSelection')}
              </button>
            </div>
            <p className="mt-1.5 px-0.5 text-[11px] text-slate-400">
              {t('report.employeeMultiHint')}
            </p>
          </div>

          <ul
            className="max-h-56 overflow-y-auto py-1"
            role="listbox"
            aria-multiselectable="true"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-slate-400">
                {t('emp.noMatch')}
              </li>
            ) : (
              filtered.map((o) => {
                const checked = selected.has(o.id)
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(o.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-teal-600 bg-teal-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-800">
                          {o.name}
                        </span>
                        {o.department && o.department !== '—' && (
                          <span className="block truncate text-xs text-slate-400">
                            {o.department}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
