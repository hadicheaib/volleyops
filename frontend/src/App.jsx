import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

import Landing    from './pages/Landing'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import Players    from './pages/Players'
import Teams      from './pages/Teams'
import Payments   from './pages/Payments'
import Messages   from './pages/Messages'
import TacticsBoard from './pages/TacticsBoard'
import Standings  from './pages/Standings'
import Schedule   from './pages/Schedule'
import Users      from './pages/Users'

// Redirects admins away from routes they shouldn't access
function NoAdminRoute({ children }) {
  const { isAdmin } = useAuth()
  if (isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<Landing />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected – wrapped in AppLayout (sidebar + topnav) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/players"   element={<Players />} />
                <Route path="/teams"     element={<Teams />} />
                <Route path="/payments"  element={<Payments />} />
                <Route path="/messages"  element={<Messages />} />
                <Route path="/tactics"   element={<NoAdminRoute><TacticsBoard /></NoAdminRoute>} />
                <Route path="/standings" element={<Standings />} />
                <Route path="/schedule"  element={<Schedule />} />
                <Route path="/users"    element={<Users />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
