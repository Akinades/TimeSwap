import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronDown,
  Languages,
  Plus,
  Settings,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'

export default function AccountMenu() {
  const {
    companies,
    activeCompanyId,
    companyName,
    switchCompany,
    addCompany,
  } = useApp()
  const { lang, setLang, langs, t } = useI18n()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [panel, setPanel] = useState('main') // main | company | language
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')

  const currentLang = langs.find((l) => l.code === lang) || langs[0]

  function closeMenu() {
    setOpen(false)
    setPanel('main')
    setAdding(false)
    setError('')
    setNewName('')
  }

  function openMenu() {
    setOpen((v) => !v)
    setPanel('main')
    setAdding(false)
    setError('')
  }

  function handleAdd(e) {
    e.preventDefault()
    try {
      addCompany(newName)
      setNewName('')
      setError('')
      setAdding(false)
      closeMenu()
    } catch (err) {
      setError(err.message || t('company.nameRequired'))
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openMenu}
        className={`flex max-w-[260px] items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition ${
          open
            ? 'border-teal-300 bg-teal-50'
            : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50'
        }`}
        title={companyName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Building2 className="h-4 w-4 shrink-0 text-teal-600" />
        <span className="min-w-0 truncate text-sm font-medium text-slate-800">
          {companyName || t('company.select')}
        </span>
        <span className="shrink-0 text-[10px] font-semibold tracking-wide text-slate-400">
          {currentLang.short}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-40 cursor-default"
            onClick={closeMenu}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            {panel === 'main' && (
              <>
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {companyName}
                  </p>
                  <p className="text-xs text-slate-400">{t('account.menuHint')}</p>
                </div>

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPanel('company')
                      setAdding(false)
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-teal-600" />
                      {t('company.select')}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-slate-400" />
                  </button>

                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={closeMenu}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50 ${
                      pathname === '/profile'
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-800'
                    }`}
                  >
                    <Settings className="h-4 w-4 text-teal-600" />
                    {t('profile.title')}
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setPanel('language')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Languages className="h-4 w-4 text-teal-600" />
                      {t('lang.label')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      {currentLang.short}
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                    </span>
                  </button>
                </div>
              </>
            )}

            {panel === 'company' && (
              <>
                <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setPanel('main')}
                    className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    ←
                  </button>
                  <span className="text-sm font-medium text-slate-700">
                    {t('company.title')}
                  </span>
                </div>
                <ul className="max-h-56 overflow-auto py-1">
                  {companies.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          switchCompany(c.id)
                          closeMenu()
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="truncate font-medium text-slate-800">
                          {c.name}
                        </span>
                        {c.id === activeCompanyId && (
                          <Check className="h-4 w-4 shrink-0 text-teal-600" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-slate-100 p-2">
                  {adding ? (
                    <form onSubmit={handleAdd} className="space-y-2 px-1 py-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          {t('company.addNew')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAdding(false)
                            setError('')
                          }}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => {
                          setNewName(e.target.value)
                          setError('')
                        }}
                        placeholder={t('company.name')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                      {error && <p className="text-xs text-red-600">{error}</p>}
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700"
                      >
                        {t('company.save')}
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
                    >
                      <Plus className="h-4 w-4" />
                      {t('company.add')}
                    </button>
                  )}
                </div>
              </>
            )}

            {panel === 'language' && (
              <>
                <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setPanel('main')}
                    className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                  >
                    ←
                  </button>
                  <span className="text-sm font-medium text-slate-700">
                    {t('lang.label')}
                  </span>
                </div>
                <ul className="py-1">
                  {langs.map((l) => (
                    <li key={l.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setLang(l.code)
                          closeMenu()
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                          l.code === lang
                            ? 'font-semibold text-teal-700'
                            : 'text-slate-700'
                        }`}
                      >
                        <span>
                          {l.label}
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            {l.short}
                          </span>
                        </span>
                        {l.code === lang && (
                          <Check className="h-4 w-4 shrink-0 text-teal-600" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
