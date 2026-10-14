import { api } from '../services/api'

/**
 * In-memory cache of reference videos. A video that has been fetched stays in the browser for
 * VIDEO_TTL_MS, so replaying it or coming back to it needs no download, and the next video can be
 * fetched ahead of time. It lives at module level, so it survives navigating between pages.
 *
 * Why not rely on the browser's HTTP cache: <video> streams use Range requests, which browsers cache
 * unpredictably (Safari and Firefox often skip them), so "kept for 5 minutes" could not be promised.
 */
export const VIDEO_TTL_MS = 5 * 60 * 1000
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // bigger files are streamed from the network instead
const MAX_TOTAL_BYTES = 250 * 1024 * 1024 // oldest entries are dropped past this

const entries = new Map() // videoUrl -> entry

function dispose(entry) {
  clearTimeout(entry.timer)
  if (entries.get(entry.key) === entry) entries.delete(entry.key)
  entry.expired = true
  if (!entry.holders && entry.url) { URL.revokeObjectURL(entry.url); entry.url = '' }
  entry.listeners.clear()
}

function enforceBudget(keep) {
  let total = 0
  for (const entry of entries.values()) total += entry.blob?.size || 0
  for (const entry of [...entries.values()].sort((a, b) => a.fetchedAt - b.fetchedAt)) {
    if (total <= MAX_TOTAL_BYTES) break
    if (entry === keep || !entry.blob) continue
    total -= entry.blob.size
    dispose(entry)
  }
}

/**
 * Starts (or joins) the download for a video. Resolves with its entry once cached: { url, blob }.
 * Rejects when the file is too large or the request fails; callers then play from the network.
 */
export function loadVideo(video, onProgress) {
  const key = video.videoUrl
  let entry = entries.get(key)
  if (entry && !entry.expired) {
    if (entry.blob) {
      onProgress?.(1)
    } else if (onProgress) {
      entry.listeners.add(onProgress)
    }
    return entry.promise
  }
  entry = { key, blob: null, url: '', fetchedAt: 0, holders: 0, expired: false, timer: null, listeners: new Set(onProgress ? [onProgress] : []) }
  entry.promise = api.media.fetchVideo(key, {
    maxBytes: MAX_VIDEO_BYTES,
    onProgress: (fraction) => entry.listeners.forEach((listener) => listener(fraction)),
  }).then((blob) => {
    entry.blob = blob
    entry.url = URL.createObjectURL(blob)
    entry.fetchedAt = Date.now()
    entry.timer = setTimeout(() => dispose(entry), VIDEO_TTL_MS)
    enforceBudget(entry)
    entry.listeners.forEach((listener) => listener(1))
    entry.listeners.clear()
    return entry
  }).catch((error) => {
    if (entries.get(key) === entry) entries.delete(key)
    throw error
  })
  entries.set(key, entry)
  return entry.promise
}

/** Fire-and-forget download, e.g. for the next video in a category. Errors are ignored. */
export function prefetchVideo(video) {
  if (video?.videoUrl) loadVideo(video).catch(() => {})
}

export function removeVideoProgressListener(videoUrl, listener) {
  entries.get(videoUrl)?.listeners.delete(listener)
}

/** A player holds an entry while it plays from it, so its object URL is not revoked mid-playback. */
export const holdVideo = (entry) => { entry.holders += 1 }
export function releaseVideo(entry) {
  entry.holders = Math.max(0, entry.holders - 1)
  if (entry.expired && !entry.holders && entry.url) { URL.revokeObjectURL(entry.url); entry.url = '' }
}
