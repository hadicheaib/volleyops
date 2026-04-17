import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { section: 'Overview',    items: [
    { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { to: '/schedule',  icon: '📅', label: 'Schedule' },
    { to: '/standings', icon: '📊', label: 'Standings' },
  ]},
  { section: 'Management', items: [
    { to: '/users',    icon: '👤', label: 'Users',          roles: ['admin'] },
    { to: '/players',  icon: '📝', label: 'Registration',  roles: ['admin','coach'] },
    { to: '/teams',    icon: '👥', label: 'Team Rosters',  roles: ['admin','coach','assistant_coach'] },
    { to: '/payments', icon: '💳', label: 'Payments',      roles: ['admin','coach','assistant_coach','player'] },
  ]},
  { section: 'Tools', items: [
    { to: '/tactics',  icon: '🎯', label: 'Tactics Board', roles: ['coach','assistant_coach'] },
    { to: '/messages', icon: '💬', label: 'Communication' },
  ]},
]

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="sidebar">
      {NAV.map(({ section, items }) => {
        const visible = items.filter(
          (item) => !item.roles || item.roles.includes(user?.role)
        )
        if (!visible.length) return null
        return (
          <div key={section}>
            <div className="sidebar-label">{section}</div>
            <div style={{ padding: '0 12px' }}>
              {visible.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    'sidebar-item' + (isActive ? ' active' : '')
                  }
                >
                  <span className="s-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )
      })}
    </aside>
  )
}
