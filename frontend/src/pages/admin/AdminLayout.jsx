import { NavLink, Outlet } from 'react-router-dom'
import { ButtonLink, Eyebrow } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { greeting } from '../../utils/format'

const tabs = [['/admin', 'Dashboard', true], ['/admin/videos', 'Videos', false], ['/admin/categories', 'Categories', false]]

export default function AdminLayout() {
  const { user } = useAuth()
  return <main className="page">
    <section className="shell admin-head">
      <div><Eyebrow>Admin workspace</Eyebrow><h1 className="display display-xl">{greeting()}, <em>{user.firstName}.</em></h1></div>
      <ButtonLink variant="outline" to="/profile">← Profile</ButtonLink>
    </section>
    <nav className="shell admin-tabs" aria-label="Admin sections">
      {tabs.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-tab ${isActive ? 'is-active' : ''}`}>{label}</NavLink>)}
    </nav>
    <div className="shell admin-body"><Outlet /></div>
  </main>
}
