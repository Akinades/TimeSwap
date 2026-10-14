import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  FileBarChart,
  Clock,
  Users,
  Menu,
  X,
  Settings,
  History,
  Shield,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import AccountMenu from './AccountMenu'

const PAGE_TITLES = [
  { path: '/', labelKey: 'nav.dashboard', end: true },
  { path: '/employees', labelKey: 'nav.employees' },
  { path: '/attendance', labelKey: 'nav.attendance' },
  { path: '/swaps', labelKey: 'nav.swaps' },
  { path: '/summary', labelKey: 'nav.reports' },
  { path: '/profile', labelKey: 'profile.title' },
  { path: '/history', labelKey: 'flow.history' },
  { path: '/accounts', labelKey: 'nav.accounts' },
]

function pageTitleKey(pathname) {
  const hit = PAGE_TITLES.find((p) =>
    p.end ? pathname === p.path : pathname.startsWith(p.path),
  )
  return hit?.labelKey || 'nav.dashboard'
}

export default function Layout() {
  const { t } = useI18n()
  const { loadError, saving, hasCompany } = useApp()
  const { isAdmin } = useAuth()
  const { pathname } = useLocation()
  const titleKey = pageTitleKey(pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const navItems = hasCompany
    ? [
        { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
        { to: '/employees', labelKey: 'nav.employees', icon: Users },
        { to: '/attendance', labelKey: 'nav.attendance', icon: ClipboardList },
        { to: '/swaps', labelKey: 'nav.swaps', icon: CalendarDays },
        { to: '/summary', labelKey: 'nav.reports', icon: FileBarChart },
      ]
    : []

  const secondaryItems = [
    ...(hasCompany
      ? [
          { to: '/history', labelKey: 'flow.history', icon: History },
          { to: '/profile', labelKey: 'flow.settings', icon: Settings },
        ]
      : []),
    ...(isAdmin
      ? [{ to: '/accounts', labelKey: 'nav.accounts', icon: Shield }]
      : []),
  ]
  const navigationLink = ({ to, labelKey, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}
      className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'}`}>
      <Icon className="h-[18px] w-[18px] shrink-0" />{t(labelKey)}
    </NavLink>
  )

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        {t('flow.skipContent')}
      </a>
      <aside className="relative flex shrink-0 flex-col bg-slate-900 text-slate-100 md:sticky md:top-0 md:h-dvh md:w-56">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">TimeSwap</p>
            <p className="text-[11px] text-slate-400">{t('nav.appTag')}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={t('flow.menu')}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen(!menuOpen)}
          className="absolute right-4 top-5 rounded-lg p-2 text-white hover:bg-slate-800 md:hidden"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          id="main-nav"
          aria-label="TimeSwap"
          className={`${menuOpen ? 'flex' : 'hidden'} flex-1 flex-col gap-1 p-3 md:flex`}
        >
          <p className="px-3 pb-2 pt-2 text-[11px] font-medium tracking-wide text-slate-500">{t('nav.workspace')}</p>
          {navItems.map(navigationLink)}
          <div className="mt-5 border-t border-white/10 pt-4 md:mt-auto">
            <p className="px-3 pb-2 text-[11px] font-medium tracking-wide text-slate-500">{t('nav.manage')}</p>
            <div className="space-y-1">{secondaryItems.map(navigationLink)}</div>
          </div>
        </nav>
        <div className="hidden px-6 pb-5 pt-2 text-[10px] leading-relaxed text-slate-500 md:block">
          {t('nav.footer')}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {t(titleKey)}
            </p>
            {saving ? (
              <p className="text-[11px] text-slate-400">กำลังบันทึก MongoDB…</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center">
            <AccountMenu />
          </div>
        </header>
        {loadError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6 lg:px-8">
            {loadError}
          </div>
        ) : null}
        <main
          id="main-content"
          className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
