import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import PageErrorBoundary from './PageErrorBoundary'
import { PageLoading } from './PageLoading'

export { PageLoading }

/** Scrolls to the top on page changes and to #anchors on the landing page. */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      // Wait a tick so the target section has rendered after a route change.
      const timer = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 50)
      return () => clearTimeout(timer)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export function AppLayout() {
  const { pathname } = useLocation()
  return <div className="app"><ScrollManager /><Header /><PageErrorBoundary resetKey={pathname}><Suspense fallback={<PageLoading />}><Outlet /></Suspense></PageErrorBoundary></div>
}
