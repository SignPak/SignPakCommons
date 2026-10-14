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
  for (const key of ['createdAt', 'updatedAt', 'submittedAt', 'cooldownStartedAt', 'readAt']) {
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

/**
 * POST a FormData body with real upload progress (fetch cannot report it).
 * Rejects with the same Error shape as request(); an aborted upload rejects with name 'AbortError'.
 */
function uploadWithProgress(path, body, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    xhr.open('POST', path)
    xhr.withCredentials = true
    const deviceId = getDeviceId()
    if (deviceId) xhr.setRequestHeader('X-Device-ID', deviceId)
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded / event.total) }
    xhr.onload = () => {
      let payload = {}
      try { payload = JSON.parse(xhr.responseText) } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(payload.data); return }
      const error = new Error(payload.error?.message || `Request failed (${xhr.status})`)
      error.fields = payload.error?.fields || {}
      error.status = xhr.status
      reject(error)
    }
    xhr.onerror = () => reject(new Error('The connection was lost while uploading. Check your internet and try again.'))
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' }))
    if (signal?.aborted) {
      reject(Object.assign(new Error('Upload cancelled.'), { name: 'AbortError' }))
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
    xhr.onloadend = () => signal?.removeEventListener('abort', abort)
    xhr.send(body)
  })
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })
const normalizeList = (items) => (items || []).map(normalize)
const PUBLIC_STATS_CACHE_KEY = `${PREFIX}public-stats`
const PUBLIC_STATS_CACHE_TTL_MS = 30 * 60 * 1000
let publicStatsRequest

function isPublicStats(value) {
  return value
    && Number.isInteger(value.contributors) && value.contributors >= 0
    && Number.isInteger(value.publishedVideos) && value.publishedVideos >= 0
    && Number.isInteger(value.categories) && value.categories >= 0
}

function readCachedPublicStats() {
  try {
    const raw = window.localStorage.getItem(PUBLIC_STATS_CACHE_KEY)
    if (!raw) return null

    const cached = JSON.parse(raw)
    if (!isPublicStats(cached?.value) || !Number.isFinite(cached?.savedAt)) {
      window.localStorage.removeItem(PUBLIC_STATS_CACHE_KEY)
      return null
    }
    if (Date.now() - cached.savedAt >= PUBLIC_STATS_CACHE_TTL_MS) {
      window.localStorage.removeItem(PUBLIC_STATS_CACHE_KEY)
      return null
    }
    return cached.value
  } catch {
    return null
  }
}

function cachePublicStats(value) {
  try {
    window.localStorage.setItem(PUBLIC_STATS_CACHE_KEY, JSON.stringify({ value, savedAt: Date.now() }))
  } catch {
    // The stats request still succeeds when browser storage is unavailable or full.
  }
}

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
  public: {
    stats() {
      const cached = readCachedPublicStats()
      if (cached) return Promise.resolve(cached)
      if (!publicStatsRequest) {
        publicStatsRequest = request(apiRoutes.public.stats())
          .then((stats) => {
            if (!isPublicStats(stats)) throw new Error('The server returned invalid community statistics.')
            cachePublicStats(stats)
            return stats
          })
          .finally(() => { publicStatsRequest = null })
      }
      return publicStatsRequest
    },
  },

  auth: {
    async session() { return normalize(await request(apiRoutes.auth.session())) },
    async register(values) { return normalize(await request(apiRoutes.auth.signup(), json('POST', values))) },
    async login(email, password) { return normalize(await request(apiRoutes.auth.login(), json('POST', { email, password }))) },
    // A valid code returns { consentToken }; the account is only created by completeSignup.
    async verifyEmail(email, code) { return request(apiRoutes.auth.verifyEmail(), json('POST', { email, code })) },
    async completeSignup(consentToken, version) { return normalize(await request(apiRoutes.auth.consent(), json('POST', { consentToken, accepted: true, version }))) },
    async declineSignup(consentToken) { await request(apiRoutes.auth.declineConsent(), json('POST', { consentToken })) },
    async resendVerification(email) { return request(apiRoutes.auth.resendVerification(), json('POST', { email })) },
    async forgotPassword(email) { return request(apiRoutes.auth.forgotPassword(), json('POST', { email })) },
    async resetPassword(values) { return request(apiRoutes.auth.resetPassword(), json('POST', values)) },
    async logout() { await request(apiRoutes.auth.logout(), { method: 'POST' }) },
    async acceptConsent(version) { return normalize(await request(apiRoutes.users.consent(), json('POST', { accepted: true, version }))) },
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
    async create({ file, poster, title, categoryId, status, durationSec, width, height }) {
      const body = new FormData()
      body.append('video', file)
      const posterBlob = await toBlob(poster)
      if (posterBlob) body.append('poster', posterBlob, poster?.name || 'poster.jpg')
      body.append('title', title)
      body.append('categoryId', categoryId || '')
      body.append('status', status)
      body.append('durationSec', String(durationSec || 0))
      body.append('width', String(width || 0))
      body.append('height', String(height || 0))
      return normalize(await request(apiRoutes.videos.create(), { method: 'POST', body }))
    },
    async update(id, patch) { return normalize(await request(apiRoutes.videos.update(id), json('PATCH', patch))) },
    async remove(id) { await request(apiRoutes.videos.remove(id), { method: 'DELETE' }) },
  },

  demoVideo: {
    async get() { return normalize(await request(apiRoutes.demoVideo.get())) },
    async upload({ file, title, durationSec, width, height }) {
      const body = new FormData()
      body.append('video', file)
      body.append('title', title)
      body.append('durationSec', String(durationSec || 0))
      body.append('width', String(width || 0))
      body.append('height', String(height || 0))
      return normalize(await request(apiRoutes.demoVideo.upload(), { method: 'POST', body }))
    },
    async remove() { await request(apiRoutes.demoVideo.remove(), { method: 'DELETE' }) },
  },

  media: {
    /**
     * Downloads a whole video into a Blob, reporting progress as a 0-1 fraction (or null when the
     * size is unknown). Throws an Error with code 'TOO_LARGE' before downloading when it exceeds maxBytes.
     */
    async fetchVideo(url, { onProgress, signal, maxBytes } = {}) {
      const headers = new Headers()
      const deviceId = getDeviceId()
      if (deviceId) headers.set('X-Device-ID', deviceId)
      const response = await fetch(url, { credentials: 'include', headers, signal })
      if (!response.ok) throw new Error(`The video could not be loaded (${response.status}).`)
      const total = Number(response.headers.get('Content-Length')) || 0
      if (maxBytes && total > maxBytes) throw Object.assign(new Error('The video is too large to keep in the browser.'), { code: 'TOO_LARGE' })
      const type = response.headers.get('Content-Type') || 'video/mp4'
      if (!response.body) {
        const blob = await response.blob()
        if (maxBytes && blob.size > maxBytes) throw Object.assign(new Error('The video is too large to keep in the browser.'), { code: 'TOO_LARGE' })
        return blob
      }
      const reader = response.body.getReader()
      const chunks = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.length
        if (maxBytes && loaded > maxBytes) {
          await reader.cancel().catch(() => {})
          throw Object.assign(new Error('The video is too large to keep in the browser.'), { code: 'TOO_LARGE' })
        }
        onProgress?.(total ? Math.min(loaded / total, 1) : null)
      }
      return new Blob(chunks, { type })
    },
  },

  submissions: {
    async list() { return normalizeList(await request(apiRoutes.submissions.list())) },
    /** Same as create(), but reports upload progress (0-1) and can be aborted with `signal`. */
    async upload({ recording, videoId, trimStart, trimEnd, mirrored, duration, onProgress, signal }) {
      const body = new FormData()
      body.append('recording', recording, 'recording.webm')
      body.append('videoId', videoId)
      body.append('trimStart', String(trimStart))
      body.append('trimEnd', String(trimEnd))
      body.append('mirrored', String(Boolean(mirrored)))
      body.append('duration', String(duration))
      return normalize(await uploadWithProgress(apiRoutes.submissions.create(), body, { onProgress, signal }))
    },
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
