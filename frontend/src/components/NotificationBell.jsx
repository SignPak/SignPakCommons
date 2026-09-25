import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

const icon = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

function timeAgo(ts) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  const openItem = (item) => {
    markRead(item.id)
    setOpen(false)
    if (item.href) navigate(item.href)
  }

  return <div className="notif" ref={wrap}>
    <button type="button" className="notif-trigger" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" {...icon}><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
      {unreadCount > 0 && <span className="notif-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </button>
    {open && <div className="notif-panel" role="region" aria-label="Notifications">
      <div className="notif-panel-head">
        <span>Notifications</span>
        {unreadCount > 0 && <button type="button" onClick={markAllRead}>Mark all read</button>}
      </div>
      {notifications.length
        ? <ul className="notif-list">{notifications.slice(0, 20).map((item) => (
          <li key={item.id}>
            <button type="button" className={`notif-item ${item.readAt ? '' : 'is-unread'}`} onClick={() => openItem(item)}>
              <span className="notif-dot" aria-hidden="true" />
              <span>
                <b>{item.title}</b>
                {item.body && <small>{item.body}</small>}
                <time>{timeAgo(item.createdAt)}</time>
              </span>
            </button>
          </li>
        ))}</ul>
        : <p className="notif-empty">You're all caught up. Nothing here yet.</p>}
    </div>}
  </div>
}
