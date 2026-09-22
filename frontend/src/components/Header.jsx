import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { Arrow, Brand, ButtonLink } from './ui'
import { Avatar } from './ui/Avatar'

const publicLinks = [['How it works', '/demo'], ['About', '/#about'], ['Policy', '/#policy'], ['Contact', '/#contact']]
const memberLinks = [['Library', '/home'], ['My space', '/profile']]

export default function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links = user ? memberLinks : publicLinks
  const close = () => setOpen(false)
  const handleLogout = async () => { close(); await logout(); navigate('/') }

  return <header className="site-header">
    <div className="site-header-bar">
      <Brand />
      <nav className="site-nav" aria-label="Main">{links.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}</nav>
      <div className="site-actions">
        <ThemeToggle />
        {user
          ? <><Link to="/profile" className="chip-link"><Avatar user={user} size="sm" /></Link></>
          : <><ButtonLink variant="ghost" to="/login" className="hide-on-mobile">Log in</ButtonLink><ButtonLink to="/signup">Get started <Arrow /></ButtonLink></>}
        <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
      </div>
    </div>
    {open && <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
      {links.map(([label, to]) => <Link key={to} to={to} onClick={close}>{label}</Link>)}
      {user ? <button type="button" onClick={handleLogout}>Log out</button> : <Link to="/login" onClick={close}>Log in</Link>}
    </nav>}
  </header>
}
