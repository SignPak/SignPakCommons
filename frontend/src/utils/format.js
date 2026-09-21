export function formatTime(totalSeconds = 0) {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function initialsOf(user) {
  if (!user) return ''
  return `${user.firstName?.[0] || ''}${user.surname?.[0] || ''}`.toUpperCase()
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
