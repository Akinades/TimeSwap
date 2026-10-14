import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, ChevronDown, LogOut, Plus, Shield } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nContext'

export default function AccountMenu() {
  const { companies, activeCompanyId, companyName, switchCompany, addCompany } =
    useApp()
  const { username, logout, isAdmin } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const root = useRef(null)
  const trigger = useRef(null)

  function close() {
    setOpen(false)
    setAdding(false)
    setName('')
    setError('')
  }

  useEffect(() => {
    if (!open) return
    const outside = (event) => {
      if (!root.current?.contains(event.target)) close()
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        close()
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  function create(event) {
    event.preventDefault()
    try {
      addCompany(name)
      close()
      trigger.current?.focus()
    } catch (err) {
      setError(err.message || t('company.nameRequired'))
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="company-switcher"
        aria-label={`${t('company.select')}: ${companyName}`}
        className="flex max-w-[200px] items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 transition hover:bg-slate-50 sm:max-w-[260px]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Building2 size={15} />
        </span>
        <span className="truncate font-medium">
          {companyName || t('company.select')}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          id="company-switcher"
          className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {t('company.title')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('nav.companyHint')}</p>
            {username ? (
              <p className="mt-1 text-[11px] text-slate-400">
                {t('auth.signedInAs', { name: username })}
              </p>
            ) : null}
          </div>
          <ul className="max-h-64 overflow-y-auto p-1.5">
            {companies.map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchCompany(company.id)
                    close()
                    trigger.current?.focus()
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
                    company.id === activeCompanyId
                      ? 'bg-teal-50 font-medium text-teal-800'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{company.name}</span>
                  {company.id === activeCompanyId && (
                    <Check size={16} className="shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 p-3">
            {adding ? (
              <form onSubmit={create} className="space-y-3">
                <label className="block text-xs font-medium text-slate-600">
                  {t('company.name')}
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setError('')
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                {error && (
                  <p role="alert" className="text-xs text-red-700">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false)
                      setError('')
                    }}
                    className="btn-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim()}
                    className="btn-primary"
                  >
                    {t('company.add')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
                >
                  <Plus size={16} />
                  {t('company.add')}
                </button>
                {isAdmin ? (
                  <Link
                    to="/accounts"
                    onClick={close}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
                  >
                    <Shield size={16} />
                    {t('auth.manageUsers')}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    close()
                    logout()
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <LogOut size={16} />
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
