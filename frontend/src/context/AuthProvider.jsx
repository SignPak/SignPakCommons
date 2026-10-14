import { useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const sessionRequest = useRef(null)

  const ensureSession = useCallback(() => {
    if (sessionChecked && !sessionError) return Promise.resolve(user)
    if (sessionRequest.current) return sessionRequest.current

    setLoading(true)
    setSessionError('')
    const request = api.auth.session()
      .then((session) => {
        setUser(session)
        return session
      }).catch((error) => {
        setUser(null)
        setSessionError(error?.message || 'Unable to check your session. Try again.')
        return null
      })
      .finally(() => {
        sessionRequest.current = null
        setSessionChecked(true)
        setLoading(false)
      })
    sessionRequest.current = request
    return request
  }, [sessionChecked, sessionError, user])

  const login = useCallback(async (email, password) => {
    const nextUser = await api.auth.login(email, password)
    setUser(nextUser)
    setSessionChecked(true)
    setSessionError('')
    return nextUser
  }, [])
  const signup = useCallback((values) => api.auth.register(values), [])
  // A valid code only returns a consent token; the account is created (and logged in) by completeSignup.
  const verifyEmail = useCallback((email, code) => api.auth.verifyEmail(email, code), [])
  const completeSignup = useCallback(async (consentToken, version) => {
    const nextUser = await api.auth.completeSignup(consentToken, version)
    setUser(nextUser)
    setSessionChecked(true)
    setSessionError('')
    return nextUser
  }, [])
  const declineSignup = useCallback((consentToken) => api.auth.declineSignup(consentToken), [])
  const logout = useCallback(async () => {
    try { await api.auth.logout() } finally {
      setUser(null)
      setSessionChecked(true)
      setSessionError('')
    }
  }, [])
  const deleteAccount = useCallback(async (password) => {
    await api.users.removeMe(password)
    setUser(null)
    setSessionChecked(true)
    setSessionError('')
  }, [])
  const acceptConsent = useCallback(async (version) => {
    setUser(await api.auth.acceptConsent(version))
  }, [])
  const saveConnections = useCallback(async (connections) => {
    if (user) setUser(await api.auth.saveConnections(user.id, connections))
  }, [user])

  const value = useMemo(
    () => ({ user, loading, sessionChecked, sessionError, ensureSession, isAdmin: user?.role === 'admin', login, signup, verifyEmail, logout, deleteAccount, saveConnections, acceptConsent, completeSignup, declineSignup }),
    [user, loading, sessionChecked, sessionError, ensureSession, login, signup, verifyEmail, logout, deleteAccount, saveConnections, acceptConsent, completeSignup, declineSignup],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
