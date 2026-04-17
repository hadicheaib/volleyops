import { Outlet } from 'react-router-dom'
import Navbar  from './Navbar'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <>
      <Navbar />
      <div className="app-shell" style={{ height: 'calc(100vh - 60px)' }}>
        <Sidebar />
        <main className="app-main">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  )
}
