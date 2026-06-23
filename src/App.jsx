import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Approvals from './pages/Approvals'
import Villages from './pages/Villages'
import Analytics from './pages/Analytics'
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
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
