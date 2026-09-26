import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      setUser(await api.auth.session())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshSession, 0)
    window.addEventListener('storage', refreshSession)
    window.addEventListener('signpak:auth-change', refreshSession)
    return () => {
      window.clearTimeout(initialRefresh)
      window.removeEventListener('storage', refreshSession)
      window.removeEventListener('signpak:auth-change', refreshSession)
    }
  }, [refreshSession])

  const login = useCallback(async (email, password) => setUser(await api.auth.login(email, password)), [])
  const signup = useCallback((values) => api.auth.register(values), [])
  const verifyEmail = useCallback(async (email, code) => setUser(await api.auth.verifyEmail(email, code)), [])
  const logout = useCallback(async () => {
    try { await api.auth.logout() } finally { setUser(null) }
  }, [])
  const saveConnections = useCallback(async (connections) => {
    if (user) setUser(await api.auth.saveConnections(user.id, connections))
  }, [user])

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, signup, verifyEmail, logout, saveConnections }),
    [user, loading, login, signup, verifyEmail, logout, saveConnections],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
