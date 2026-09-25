import { apiRoutes } from './apiRoutes'

const PREFIX = 'signpak:v1:'

const readLocal = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

const writeLocal = (key, value) => window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
const asTimestamp = (value) => value ? Date.parse(value) || value : value
const normalize = (value) => {
  if (!value || typeof value !== 'object') return value
  const result = { ...value }
  for (const key of ['createdAt', 'updatedAt', 'submittedAt', 'readAt']) {
    if (result[key]) result[key] = asTimestamp(result[key])
  }
  return result
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
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
      if (poster instanceof Blob) body.append('poster', poster, 'poster.webp')
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
