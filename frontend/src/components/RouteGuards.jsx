import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Button, PageState } from './ui'
import { useAuth } from '../context/AuthContext'
import { consentGiven } from '../utils/consent'

export function RequireAuth() {
  const { user, loading, sessionChecked, sessionError, ensureSession } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (!sessionChecked) void ensureSession()
  }, [sessionChecked, ensureSession])

  if (sessionError) return <PageState
    eyebrow="Connection problem"
    title="We couldn't check your session."
    action={<Button onClick={() => void ensureSession()}>Try again</Button>}
  >{sessionError}</PageState>
  if (!sessionChecked || loading) return <div className="boot" role="status">Checking your session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  // Contributors must accept the consent notice before using the library or recording.
  if (user.role !== 'admin' && !consentGiven(user) && location.pathname !== '/consent') return <Navigate to="/consent" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/home" replace />
}

/** Login and signup are for logged-out visitors. Anyone already in goes back to where they were headed. */
export function GuestOnly() {
  const { user, loading, sessionChecked, sessionError, ensureSession } = useAuth()
  const location = useLocation()
  useEffect(() => {
    if (!sessionChecked) void ensureSession()
  }, [sessionChecked, ensureSession])

  if (sessionError) return <PageState
    eyebrow="Connection problem"
    title="We couldn't check your session."
    action={<Button onClick={() => void ensureSession()}>Try again</Button>}
  >{sessionError}</PageState>
  if (!sessionChecked || loading) return <div className="boot" role="status">Checking your session…</div>
  if (user) return <Navigate to={location.state?.from?.pathname || '/home'} replace />
  return <Outlet />
}
