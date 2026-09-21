import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.auth.session().then((session) => {
      if (!active) return
      setUser(session)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const login = useCallback(async (email, password) => setUser(await api.auth.login(email, password)), [])
  const signup = useCallback(async (values) => setUser(await api.auth.register(values)), [])
  const logout = useCallback(async () => { await api.auth.logout(); setUser(null) }, [])
  const saveConnections = useCallback(async (connections) => {
    setUser(await api.auth.saveConnections(user.id, connections))
  }, [user])

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, signup, logout, saveConnections }),
    [user, loading, login, signup, logout, saveConnections],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
