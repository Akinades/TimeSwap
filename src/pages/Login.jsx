import { useState } from 'react'
import { Clock, Shield, User } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nContext'

export default function Login() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState('login') // login | admin
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const isAdminTab = tab === 'admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password, {
        adminOnly: isAdminTab,
        redirectTo: isAdminTab ? '/accounts' : null,
      })
    } catch (err) {
      setError(err.message || t('auth.loginFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(13,148,136,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 75%, rgba(56,189,248,0.18), transparent 50%), linear-gradient(165deg, #0f172a 0%, #020617 100%)',
        }}
      />
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500 shadow-lg shadow-teal-500/30">
            <Clock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            TimeSwap
          </h1>
          <p className="mt-2 text-sm text-slate-400">{t('auth.subtitle')}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-5 shadow-2xl backdrop-blur sm:p-7">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setTab('login')
                setError('')
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                !isAdminTab
                  ? 'bg-white text-teal-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('auth.tabLogin')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('admin')
                setError('')
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isAdminTab
                  ? 'bg-white text-violet-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              {t('auth.tabAdmin')}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <h2 className="text-lg font-semibold text-slate-900">
              {isAdminTab ? t('auth.adminLoginTitle') : t('auth.loginTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isAdminTab ? t('auth.adminLoginHint') : t('auth.loginHint')}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {t('auth.username')}
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  {t('auth.password')}
                </label>
                <PasswordInput
                  withIcon
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className={`mt-6 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isAdminTab
                  ? 'bg-violet-700 hover:bg-violet-800'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {busy
                ? t('auth.loggingIn')
                : isAdminTab
                  ? t('auth.adminLogin')
                  : t('auth.login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
