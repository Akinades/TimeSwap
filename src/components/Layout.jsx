import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  FileBarChart,
  Clock,
  Users,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import AccountMenu from './AccountMenu'

const PAGE_TITLES = [
  { path: '/', labelKey: 'nav.dashboard', end: true },
  { path: '/employees', labelKey: 'nav.employees' },
  { path: '/attendance', labelKey: 'nav.attendance' },
  { path: '/swaps', labelKey: 'nav.swaps' },
  { path: '/summary', labelKey: 'nav.reports' },
  { path: '/profile', labelKey: 'profile.title' },
]

function pageTitleKey(pathname) {
  const hit = PAGE_TITLES.find((p) =>
    p.end ? pathname === p.path : pathname.startsWith(p.path),
  )
  return hit?.labelKey || 'nav.dashboard'
}

export default function Layout() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const titleKey = pageTitleKey(pathname)

  const navItems = [
    { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
    { to: '/employees', labelKey: 'nav.employees', icon: Users },
    { to: '/attendance', labelKey: 'nav.attendance', icon: ClipboardList },
    { to: '/swaps', labelKey: 'nav.swaps', icon: CalendarDays },
    { to: '/summary', labelKey: 'nav.reports', icon: FileBarChart },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-slate-900 text-slate-100">
        <div className="flex items-center gap-2.5 border-b border-slate-700 px-5 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">TimeSwap</p>
            <p className="text-[11px] text-slate-400">{t('nav.appTag')}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-700 px-5 py-4 text-xs text-slate-500">
          {t('nav.footer')}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-900">
              {t(titleKey)}
            </p>
          </div>

          <div className="flex shrink-0 items-center">
            <AccountMenu />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
