import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="boot" role="status">Checking your session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/home" replace />
}

/** Login and signup are for logged-out visitors. Anyone already in goes back to where they were headed. */
export function GuestOnly() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="boot" role="status">Checking your session…</div>
  if (user) return <Navigate to={location.state?.from?.pathname || '/home'} replace />
  return <Outlet />
}
