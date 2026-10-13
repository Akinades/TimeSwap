import { useState } from 'react'
import { Building2, Clock } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function CompanySetup() {
  const { addCompany } = useApp()
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    try {
      addCompany(name)
    } catch (err) {
      setError(err.message || t('company.nameRequired'))
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-slate-200 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 text-white">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">TimeSwap</h1>
          <p className="mt-2 text-sm text-slate-500">{t('company.setupTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Building2 className="h-4 w-4 text-teal-600" />
              {t('company.name')}
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder={t('company.name')}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700"
          >
            {t('company.setupCta')}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          {t('company.setupHint')}
        </p>
      </div>
    </div>
  )
}
