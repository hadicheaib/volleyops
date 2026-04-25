import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'

import Landing        from './pages/Landing'
import Login          from './pages/Login'
import Register       from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import Dashboard      from './pages/Dashboard'
import Players        from './pages/Players'
import Teams          from './pages/Teams'
import Payments       from './pages/Payments'
import Messages       from './pages/Messages'
import TacticsBoard   from './pages/TacticsBoard'
import Standings      from './pages/Standings'
import Schedule       from './pages/Schedule'
import Users          from './pages/Users'
import Profile        from './pages/Profile'
import Tryouts        from './pages/Tryouts'
import Evaluations    from './pages/Evaluations'
import AIPlacement    from './pages/AIPlacement'
import Attendance     from './pages/Attendance'
import Analytics      from './pages/Analytics'
import PublicStandings from './pages/PublicStandings'

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/"                  element={<Landing />} />
            <Route path="/login"             element={<Login />} />
            <Route path="/register"          element={<Register />} />
            <Route path="/forgot-password"   element={<ForgotPassword />} />
            <Route path="/reset-password"    element={<ResetPassword />} />

            {/* Protected – wrapped in AppLayout (sidebar + topnav) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/players"   element={<Players />} />
                <Route path="/teams"     element={<Teams />} />
                <Route path="/payments"  element={<Payments />} />
                <Route path="/messages"  element={<Messages />} />
                <Route path="/tactics"   element={<TacticsBoard />} />
                <Route path="/standings" element={<Standings />} />
                <Route path="/schedule"  element={<Schedule />} />
                <Route path="/users"        element={<Users />} />
                <Route path="/profile"      element={<Profile />} />
                <Route path="/tryouts"      element={<Tryouts />} />
                <Route path="/evaluations"  element={<Evaluations />} />
                <Route path="/ai-placement" element={<AIPlacement />} />
                <Route path="/attendance"   element={<Attendance />} />
                <Route path="/analytics"   element={<Analytics />} />
              </Route>
            </Route>

            <Route path="/leaderboard" element={<PublicStandings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
