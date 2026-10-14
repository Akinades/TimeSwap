import { Navigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import AdminUsersPanel from '../components/AdminUsersPanel'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nContext'

export default function UserAccounts() {
  const { isAdmin } = useAuth()
  const { t } = useI18n()

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-5 py-6 text-white sm:px-7 sm:py-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 70% 80% at 90% 10%, rgba(20,184,166,0.35), transparent 55%)',
          }}
        />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-500 shadow-lg shadow-teal-500/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t('auth.adminPanelTitle')}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-300">
              {t('auth.adminPanelHint')}
            </p>
          </div>
        </div>
      </header>

      <AdminUsersPanel />
    </div>
  )
}
