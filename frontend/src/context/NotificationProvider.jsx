import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { NotificationContext } from './NotificationContext'

/**
 * Per-user notifications, backed by the same mock storage as everything else so they
 * survive a reload. Read-only observers (like the cooldown timer in Player) call `notify`
 * to add one; the bell in the header renders whatever this holds.
 */
export default function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const userId = user?.id

  const refresh = useCallback(async () => {
    if (!userId) { setItems([]); return }
    setItems(await api.notifications.list(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    api.notifications.list(userId).then((list) => { if (active) setItems(list) })
    return () => { active = false }
  }, [userId])

  // `forUserId` lets a caller notify a user the instant they become known (e.g. right after
  // signup), without waiting for this provider's own re-render to pick up the new session —
  // context state updates one render behind the component that triggered them, so a notify()
  // call made in the same tick as a fresh login/signup would otherwise silently no-op.
  const notify = useCallback(async (payload, forUserId) => {
    const target = forUserId || userId
    if (!target) return
    await api.notifications.create(target, payload)
    if (target === userId) await refresh()
  }, [userId, refresh])

  const markRead = useCallback(async (id) => {
    if (!userId) return
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: item.readAt || Date.now() } : item))) // optimistic
    await api.notifications.markRead(userId, id)
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || Date.now() })))
    await api.notifications.markAllRead(userId)
  }, [userId])

  const value = useMemo(() => {
    // Derived rather than reset in an effect, so switching users (logout, then a different
    // login in the same tab) never briefly shows the previous person's notifications.
    const visible = userId ? items : []
    return { notifications: visible, unreadCount: visible.filter((item) => !item.readAt).length, notify, markRead, markAllRead, refresh }
  }, [items, userId, notify, markRead, markAllRead, refresh])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
