/**
 * Mock API layer.
 *
 * Everything the UI needs from a server goes through this file, and every method is
 * async and returns plain JSON, so swapping in the Express/MongoDB backend later only
 * means replacing the bodies below with fetch() calls. Nothing else in the app needs to change.
 *
 * Storage: localStorage for records, IndexedDB (utils/blobStore) for uploaded base videos.
 */
import { buildSeedSubmissions, seedCategories, seedUsers, seedVideos, SUBMISSION_COOLDOWN_MS } from '../mock/data'
import { blobStore } from '../utils/blobStore'

const PREFIX = 'signpak:v1:'
const read = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
const write = (key, value) => window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const fail = (message) => { throw new Error(message) }
const publicUser = ({ password, passwordHash, ...user }) => { void password; void passwordHash; return user }

async function hashPassword(password) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function migrateUsers() {
  const users = read('users', [])
  const migrated = await Promise.all(users.map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: user.passwordHash || (password ? await hashPassword(password) : ''),
  })))
  if (users.some((user) => user.password || !user.passwordHash)) write('users', migrated)
}

async function ensureSeed() {
  if (read('seeded', false)) { await migrateUsers(); return }
  const users = await Promise.all(seedUsers.map(async ({ password, ...user }) => ({ ...user, passwordHash: await hashPassword(password) })))
  write('users', users)
  write('categories', seedCategories)
  write('videos', seedVideos)
  write('submissions', buildSeedSubmissions())
  write('messages', [])
  write('seeded', true)
}
const seedReady = ensureSeed()

const signalAuthChange = () => window.dispatchEvent(new Event('signpak:auth-change'))

// Uploaded videos live in IndexedDB; turn them into object URLs once per page load.
const urlCache = new Map()
async function withPlayableUrl(video) {
  if (!video.blobKey) return video
  if (!urlCache.has(video.blobKey)) {
    const blob = await blobStore.get(video.blobKey).catch(() => null)
    if (!blob) return { ...video, videoUrl: '' }
    urlCache.set(video.blobKey, URL.createObjectURL(blob))
  }
  return { ...video, videoUrl: urlCache.get(video.blobKey) }
}

export const api = {
  auth: {
    async session() {
      await seedReady
      const id = read('session', null)
      const user = read('users', []).find((item) => item.id === id)
      if (id && !user) window.localStorage.removeItem(PREFIX + 'session')
      return user ? publicUser(user) : null
    },
    async register({ email, firstName, surname, password }) {
      await seedReady
      const users = read('users', [])
      const normalized = email.trim().toLowerCase()
      if (users.some((user) => user.email === normalized)) fail('An account with this email already exists. Log in instead.')
      const user = { id: uid('user'), email: normalized, firstName: firstName.trim(), surname: surname.trim(), passwordHash: await hashPassword(password), role: 'user', createdAt: Date.now(), connections: {} }
      write('users', [...users, user])
      write('session', user.id)
      signalAuthChange()
      return publicUser(user)
    },
    async login(email, password) {
      await seedReady
      const user = read('users', []).find((item) => item.email === email.trim().toLowerCase())
      if (!user || user.passwordHash !== await hashPassword(password)) fail('That email and password do not match. Check them and try again.')
      write('session', user.id)
      signalAuthChange()
      return publicUser(user)
    },
    async logout() {
      await seedReady
      const id = read('session', null)
      window.localStorage.removeItem(PREFIX + 'session')
      if (id) write('notifications', read('notifications', []).filter((item) => item.userId !== id))
      signalAuthChange()
    },
    async saveConnections(userId, connections) {
      await seedReady
      const users = read('users', []).map((user) => (user.id === userId ? { ...user, connections } : user))
      write('users', users)
      return publicUser(users.find((user) => user.id === userId))
    },
  },

  users: {
    async list() { return read('users', []).map(publicUser) },
  },

  categories: {
    async list() { return read('categories', []) },
    async create({ label, copy, tone, archived = false, order = null }) {
      const categories = read('categories', [])
      const nextOrder = order ?? (Math.max(0, ...categories.map((item) => item.order || 0)) + 1)
      const category = { id: uid('cat'), label: label.trim(), copy: copy.trim(), tone, archived, order: nextOrder }
      write('categories', [...categories, category])
      return category
    },
    async update(id, patch) {
      write('categories', read('categories', []).map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    async remove(id) {
      write('categories', read('categories', []).filter((item) => item.id !== id))
      write('videos', read('videos', []).map((item) => (item.categoryId === id ? { ...item, categoryId: null } : item)))
    },
  },

  videos: {
    async list() { return Promise.all(read('videos', []).map(withPlayableUrl)) },
    /** `file` is the uploaded base video. With a real backend this becomes a multipart upload. */
    async create({ file, title, categoryId, status, durationSec, poster }) {
      const videos = read('videos', [])
      const id = uid('video')
      const blobKey = `blob_${id}`
      await blobStore.put(blobKey, file)
      const order = Math.max(0, ...videos.filter((item) => item.categoryId === categoryId).map((item) => item.order || 0)) + 1
      const video = { id, title: title.trim(), status, categoryId: categoryId || null, order, durationSec, poster, blobKey, size: file.size, createdAt: Date.now() }
      write('videos', [...videos, video])
      return video
    },
    async update(id, patch) {
      write('videos', read('videos', []).map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    async remove(id) {
      const target = read('videos', []).find((item) => item.id === id)
      if (target?.blobKey) await blobStore.remove(target.blobKey).catch(() => {})
      write('videos', read('videos', []).filter((item) => item.id !== id))
    },
  },

  submissions: {
    async list(userId = null, includeAll = false) {
      await seedReady
      if (!userId && !includeAll) return []
      const submissions = read('submissions', [])
      return includeAll ? submissions : submissions.filter((item) => item.userId === userId)
    },
    /** The most recent submission this user has for this video, or null. Powers the cooldown countdown. */
    async lastFor(userId, videoId) {
      const mine = read('submissions', []).filter((item) => item.userId === userId && item.videoId === videoId)
      return mine.length ? mine.reduce((latest, item) => (item.submittedAt > latest.submittedAt ? item : latest)) : null
    },
    /**
     * Metadata only. With a real backend, also send the recorded Blob plus trimStart/trimEnd so the server can cut it.
     * A contributor can send more than one recording for the same video over time (this is a data-collection tool,
     * not a one-shot quiz), but not back to back: a fresh upload for a video they just submitted is refused until
     * SUBMISSION_COOLDOWN_MS has passed, checked here as a defensive backstop even though the UI already hides the
     * recorder during that window.
     */
    async create({ userId, videoId, trimStart, trimEnd, mirrored, duration, size, mimeType }) {
      const submissions = read('submissions', [])
      const last = submissions.filter((item) => item.userId === userId && item.videoId === videoId).sort((a, b) => b.submittedAt - a.submittedAt)[0]
      if (last) {
        const remaining = SUBMISSION_COOLDOWN_MS - (Date.now() - last.submittedAt)
        if (remaining > 0) fail(`Wait ${Math.ceil(remaining / 1000)}s before recording this video again.`)
      }
      const submission = { id: uid('sub'), userId, videoId, submittedAt: Date.now(), trimStart, trimEnd, mirrored, duration, size, mimeType }
      write('submissions', [...submissions, submission])
      return submission
    },
  },

  contact: {
    async send(payload) {
      write('messages', [...read('messages', []), { id: uid('msg'), ...payload, sentAt: Date.now() }])
    },
  },

  notifications: {
    async list(userId) { return read('notifications', []).filter((item) => item.userId === userId).sort((a, b) => b.createdAt - a.createdAt) },
    async create(userId, { type, title, body, href = null }) {
      const notification = { id: uid('note'), userId, type, title, body, href, createdAt: Date.now(), readAt: null }
      write('notifications', [...read('notifications', []), notification])
      return notification
    },
    async markRead(userId, id) {
      write('notifications', read('notifications', []).map((item) => (item.id === id && item.userId === userId && !item.readAt ? { ...item, readAt: Date.now() } : item)))
    },
    async markAllRead(userId) {
      write('notifications', read('notifications', []).map((item) => (item.userId === userId && !item.readAt ? { ...item, readAt: Date.now() } : item)))
    },
  },
}
