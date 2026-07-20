import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Approvals from './pages/Approvals'
import Villages from './pages/Villages'
import Citizens from './pages/Citizens'
import Officers from './pages/Officers'
import Complaints from './pages/Complaints'
import Analytics from './pages/Analytics'
import AIInsights from './pages/AIInsights'
import HelpDesk from './pages/HelpDesk'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import AuditLogs from './pages/AuditLogs'
import './styles/tokens.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="villages" element={<Villages />} />
            <Route path="citizens" element={<Citizens />} />
            <Route path="officers" element={<Officers />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="ai-insights" element={<AIInsights />} />
            <Route path="help-desk" element={<HelpDesk />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
