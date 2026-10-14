import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { I18nProvider } from './i18n/I18nContext'
import Layout from './components/Layout'
import CompanySetup from './pages/CompanySetup'
import Dashboard from './pages/Dashboard'
import Attendance from './pages/Attendance'
import ShiftSwap from './pages/ShiftSwap'
import Summary from './pages/Summary'
import CompanyProfile from './pages/CompanyProfile'
import Employees from './pages/Employees'
import History from './pages/History'
import Login from './pages/Login'
import UserAccounts from './pages/UserAccounts'

function PostLoginRedirect() {
  const navigate = useNavigate()
  const { postLoginPath, consumePostLoginPath } = useAuth()

  useEffect(() => {
    if (!postLoginPath) return
    const path = consumePostLoginPath()
    if (path) navigate(path, { replace: true })
  }, [postLoginPath, consumePostLoginPath, navigate])

  return null
}

function AppRoutes() {
  const { hasCompany, loadError } = useApp()
  const { isAdmin } = useAuth()

  return (
    <>
      <PostLoginRedirect />
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="accounts"
            element={
              isAdmin ? <UserAccounts /> : <Navigate to="/" replace />
            }
          />
          {hasCompany ? (
            <>
              <Route index element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="swaps" element={<ShiftSwap />} />
              <Route
                path="calendar"
                element={<Navigate to="/swaps" replace />}
              />
              <Route path="summary" element={<Summary />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<CompanyProfile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route
                index
                element={
                  <>
                    {loadError ? (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                        {loadError}
                      </div>
                    ) : null}
                    <CompanySetup />
                  </>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>
      </Routes>
    </>
  )
}

function AuthGate() {
  const { ready, isAuthenticated } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-300">
        TimeSwap…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AuthGate />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
