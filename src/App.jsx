import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
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

function AppRoutes() {
  const { hasCompany, loadError } = useApp()

  if (!hasCompany) {
    return (
      <>
        {loadError ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            {loadError}
          </div>
        ) : null}
        <CompanySetup />
      </>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="swaps" element={<ShiftSwap />} />
        <Route path="calendar" element={<Navigate to="/swaps" replace />} />
        <Route path="summary" element={<Summary />} />
        <Route path="history" element={<History />} />
        <Route path="profile" element={<CompanyProfile />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </I18nProvider>
  )
}
