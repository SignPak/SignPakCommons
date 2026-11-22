import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { PageLoading } from '../../components/Layouts'
import PageErrorBoundary from '../../components/PageErrorBoundary'
import { ButtonLink, Eyebrow } from '../../components/ui'
import { paths } from '../../routes/appRoutes'
import { useAuth } from '../../context/AuthContext'
import { greeting } from '../../utils/format'

const tabs = [['/admin', 'Dashboard', true], ['/admin/users', 'Users', false], ['/admin/videos', 'Videos', false], ['/admin/categories', 'Categories', false], ['/admin/submissions', 'Submissions', false], ['/admin/messages', 'Messages', false], ['/admin/activity', 'Activity', false]]

export default function AdminLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  return <main className="page">
    <section className="shell admin-head">
      <div><Eyebrow>Admin workspace</Eyebrow><h1 className="display display-xl">{greeting()}, <em>{user.firstName}.</em></h1></div>
      <ButtonLink variant="outline" to={paths.profile}>Profile</ButtonLink>
    </section>
    <nav className="shell admin-tabs" aria-label="Admin sections">
      {tabs.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-tab ${isActive ? 'is-active' : ''}`}>{label}</NavLink>)}
    </nav>
    {/* Each tab is loaded on first visit; the tabs above stay while it does. */}
    <div className="shell admin-body"><PageErrorBoundary resetKey={pathname}><Suspense fallback={<PageLoading />}><Outlet /></Suspense></PageErrorBoundary></div>
  </main>
}
