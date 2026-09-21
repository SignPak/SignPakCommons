/**
 * Mock API layer.
 *
 * Everything the UI needs from a server goes through this file, and every method is
 * async and returns plain JSON, so swapping in the Express/MongoDB backend later only
 * means replacing the bodies below with fetch() calls. Nothing else in the app needs to change.
 *
 * Storage: localStorage for records, IndexedDB (utils/blobStore) for uploaded base videos.
 * Passwords are stored in plain text HERE ONLY because this is a local mock. The real backend must hash them (bcrypt/argon2).
 */
import { buildSeedSubmissions, seedCategories, seedUsers, seedVideos } from '../mock/data'
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
const publicUser = ({ password, ...user }) => { void password; return user }

function ensureSeed() {
  if (read('seeded', false)) return
  write('users', seedUsers)
  write('categories', seedCategories)
  write('videos', seedVideos)
  write('submissions', buildSeedSubmissions())
  write('messages', [])
  write('seeded', true)
}
ensureSeed()

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
      const id = read('session', null)
      const user = read('users', []).find((item) => item.id === id)
      return user ? publicUser(user) : null
    },
    async register({ email, firstName, surname, password }) {
      const users = read('users', [])
      const normalized = email.trim().toLowerCase()
      if (users.some((user) => user.email === normalized)) fail('An account with this email already exists. Log in instead.')
      const user = { id: uid('user'), email: normalized, firstName: firstName.trim(), surname: surname.trim(), password, role: 'user', createdAt: Date.now(), connections: {} }
      write('users', [...users, user])
      write('session', user.id)
      return publicUser(user)
    },
    async login(email, password) {
      const user = read('users', []).find((item) => item.email === email.trim().toLowerCase())
      if (!user || user.password !== password) fail('That email and password do not match. Check them and try again.')
      write('session', user.id)
      return publicUser(user)
    },
    async logout() { window.localStorage.removeItem(PREFIX + 'session') },
    async saveConnections(userId, connections) {
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
    async create({ label, copy, tone }) {
      const category = { id: uid('cat'), label: label.trim(), copy: copy.trim(), tone }
      write('categories', [...read('categories', []), category])
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
    async create({ file, title, categoryId, level, status, durationSec, poster }) {
      const videos = read('videos', [])
      const id = uid('video')
      const blobKey = `blob_${id}`
      await blobStore.put(blobKey, file)
      const order = Math.max(0, ...videos.filter((item) => item.categoryId === categoryId).map((item) => item.order || 0)) + 1
      const video = { id, title: title.trim(), level, status, categoryId: categoryId || null, order, durationSec, poster, blobKey, size: file.size, createdAt: Date.now() }
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
    async list() { return read('submissions', []) },
    /** Metadata only. With a real backend, also send the recorded Blob plus trimStart/trimEnd so the server can cut it. */
    async create({ userId, videoId, trimStart, trimEnd, mirrored, duration, size, mimeType }) {
      const submissions = read('submissions', [])
      if (submissions.some((item) => item.userId === userId && item.videoId === videoId)) fail('You have already submitted this lesson.')
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
}
