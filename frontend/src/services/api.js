import { apiRoutes } from './apiRoutes'

const PREFIX = 'signpak:v1:'

const readLocal = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

const writeLocal = (key, value) => window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
function getDeviceId() {
  try {
    const key = `${PREFIX}device-id`
    let id = window.localStorage.getItem(key)
    if (!id) {
      const bytes = new Uint8Array(16)
      window.crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
      id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
      window.localStorage.setItem(key, id)
    }
    return id
  } catch { return '' }
}
const asTimestamp = (value) => value ? Date.parse(value) || value : value
const apiOrigin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
const normalize = (value) => {
  if (!value || typeof value !== 'object') return value
  const result = { ...value }
  for (const key of ['createdAt', 'updatedAt', 'submittedAt', 'readAt']) {
    if (result[key]) result[key] = asTimestamp(result[key])
  }
  for (const key of ['videoUrl', 'poster']) {
    if (result[key]?.startsWith('/')) result[key] = `${apiOrigin}${result[key]}`
  }
  return result
}

const toBlob = async (value) => {
  if (value instanceof Blob) return value
  if (typeof value === 'string' && value.startsWith('data:')) return fetch(value).then((response) => response.blob())
  return null
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  const deviceId = getDeviceId()
  if (deviceId) headers.set('X-Device-ID', deviceId)
  const isForm = options.body instanceof FormData
  if (!isForm && options.body !== undefined) headers.set('Content-Type', 'application/json')
  const response = await fetch(path, { ...options, headers, credentials: 'include' })
  if (response.status === 204) return undefined
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed (${response.status})`)
    error.fields = payload.error?.fields || {}
    error.status = response.status
    throw error
  }
  return payload.data
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })
const normalizeList = (items) => (items || []).map(normalize)

const notifications = {
  async list(userId) { return readLocal('notifications', []).filter((item) => item.userId === userId).sort((a, b) => b.createdAt - a.createdAt) },
  async create(userId, payload) {
    const item = { id: `note_${Date.now()}_${Math.random().toString(36).slice(2)}`, userId, ...payload, createdAt: Date.now(), readAt: null }
    writeLocal('notifications', [...readLocal('notifications', []), item])
    return item
  },
  async markRead(userId, id) {
    writeLocal('notifications', readLocal('notifications', []).map((item) => item.id === id && item.userId === userId ? { ...item, readAt: Date.now() } : item))
  },
  async markAllRead(userId) {
    writeLocal('notifications', readLocal('notifications', []).map((item) => item.userId === userId ? { ...item, readAt: Date.now() } : item))
  },
}

export const api = {
  auth: {
    async session() { return normalize(await request(apiRoutes.auth.session())) },
    async register(values) { return normalize(await request(apiRoutes.auth.signup(), json('POST', values))) },
    async login(email, password) { return normalize(await request(apiRoutes.auth.login(), json('POST', { email, password }))) },
    async logout() { await request(apiRoutes.auth.logout(), { method: 'POST' }) },
    async saveConnections(_userId, connections) { return normalize(await request(apiRoutes.users.me(), json('PATCH', { connections }))) },
  },

  users: {
    async list() { return normalizeList(await request(apiRoutes.users.list())) },
    async setStatus(id, patch) { return normalize(await request(apiRoutes.users.update(id), json('PATCH', patch))) },
    async remove(id) { await request(apiRoutes.users.remove(id), { method: 'DELETE' }) },
  },

  admin: {
    async restrictions() { return normalizeList(await request(apiRoutes.admin.restrictions())) },
    async createRestriction(values) { return normalize(await request(apiRoutes.admin.createRestriction(), json('POST', values))) },
    async removeRestriction(id) { await request(apiRoutes.admin.removeRestriction(id), { method: 'DELETE' }) },
  },

  categories: {
    async list() { return normalizeList(await request(apiRoutes.categories.list())) },
    async create(values) { return normalize(await request(apiRoutes.categories.create(), json('POST', values))) },
    async update(id, patch) { return normalize(await request(apiRoutes.categories.update(id), json('PATCH', patch))) },
    async remove(id) { await request(apiRoutes.categories.remove(id), { method: 'DELETE' }) },
  },

  videos: {
    async list() { return normalizeList(await request(apiRoutes.videos.list())) },
    async create({ file, poster, title, categoryId, status, durationSec }) {
      const body = new FormData()
      body.append('video', file)
      const posterBlob = await toBlob(poster)
      if (posterBlob) body.append('poster', posterBlob, 'poster.jpg')
      body.append('title', title)
      body.append('categoryId', categoryId || '')
      body.append('status', status)
      body.append('durationSec', String(durationSec || 0))
      return normalize(await request(apiRoutes.videos.create(), { method: 'POST', body }))
    },
    async update(id, patch) { return normalize(await request(apiRoutes.videos.update(id), json('PATCH', patch))) },
    async remove(id) { await request(apiRoutes.videos.remove(id), { method: 'DELETE' }) },
  },

  submissions: {
    async list() { return normalizeList(await request(apiRoutes.submissions.list())) },
    async create({ recording, videoId, trimStart, trimEnd, mirrored, duration }) {
      const body = new FormData()
      body.append('recording', recording, 'recording.webm')
      body.append('videoId', videoId)
      body.append('trimStart', String(trimStart))
      body.append('trimEnd', String(trimEnd))
      body.append('mirrored', String(Boolean(mirrored)))
      body.append('duration', String(duration))
      return normalize(await request(apiRoutes.submissions.create(), { method: 'POST', body }))
    },
  },

  contact: {
    async send(payload) { return request(apiRoutes.contact.send(), json('POST', payload)) },
  },

  notifications,
}
