import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import UploadToaster from '../components/UploadToaster'
import { api } from '../services/api'
import { watchUrl } from '../routes/appRoutes'
import { recordingLimitProblem } from '../utils/limits'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationContext'
import { UploadQueueContext } from './UploadQueueContext'

/** One recording uploading and one waiting in the browser. Failed ones still hold a slot until retried or discarded. */
export const MAX_QUEUED = 2
const SUCCESS_TOAST_MS = 7000

let nextId = 0
const newId = (prefix) => `${prefix}_${Date.now()}_${nextId++}`

/**
 * Uploads submitted recordings in the background, strictly one at a time, so a contributor can
 * keep browsing, watching and recording while earlier takes are still going up.
 *
 * Mounted above LibraryProvider on purpose: that provider swaps its children for a loading screen
 * while the library loads, which would otherwise unmount an upload in progress.
 * Recordings wait in memory only; leaving the tab with uploads pending shows the browser's warning.
 */
export default function UploadQueueProvider({ children }) {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const userId = user?.id
  const [items, setItems] = useState([]) // { id, videoId, title, status: waiting|uploading|failed, progress, error, recording }
  const [toasts, setToasts] = useState([]) // finished uploads, shown briefly
  const [lastSubmission, setLastSubmission] = useState(null)
  const running = useRef(null) // { id, controller }
  const notifyRef = useRef(notify)
  useEffect(() => { notifyRef.current = notify }, [notify])

  const patch = useCallback((id, changes) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }, [])

  const addToast = useCallback((toast) => {
    const id = newId('toast')
    setToasts((current) => [...current, { id, ...toast }])
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), SUCCESS_TOAST_MS)
  }, [])

  const run = useCallback(async (item) => {
    const controller = new AbortController()
    running.current = { id: item.id, controller }
    const { recording } = item
    try {
      const submission = await api.submissions.upload({
        videoId: item.videoId, recording: recording.blob, trimStart: recording.edit.start, trimEnd: recording.edit.end,
        mirrored: recording.edit.mirrored, duration: recording.duration, signal: controller.signal,
        onProgress: (progress) => patch(item.id, { progress }),
      })
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      setLastSubmission(submission)
      addToast({ title: 'Recording submitted', body: item.title })
      notifyRef.current({ type: 'submission', title: 'Recording submitted', body: item.title, href: watchUrl(item.videoId) }).catch(() => {})
    } catch (error) {
      if (error?.name === 'AbortError') return
      const message = error?.message || 'The upload failed.'
      patch(item.id, { status: 'failed', error: message })
      notifyRef.current({ type: 'submission', title: 'Recording not uploaded', body: `${item.title}: ${message}`, href: watchUrl(item.videoId) }).catch(() => {})
    } finally {
      if (running.current?.id === item.id) running.current = null
    }
  }, [addToast, patch])

  // The queue's heartbeat: whenever nothing is uploading, start the oldest waiting recording.
  useEffect(() => {
    if (running.current) return
    const next = items.find((item) => item.status === 'waiting')
    if (!next) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- advancing the queue is a state machine step; `running` guards against starting twice
    patch(next.id, { status: 'uploading', progress: 0 })
    void run(next)
  }, [items, patch, run])

  // A different person (or nobody) on this tab: drop their queue and stop the upload.
  useEffect(() => () => {
    running.current?.controller.abort()
    running.current = null
    setItems([])
    setToasts([])
  }, [userId])

  // Pending recordings only exist in this tab's memory, so warn before it is closed or reloaded.
  const pending = items.length > 0
  useEffect(() => {
    if (!pending) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pending])

  const enqueue = useCallback((video, recording) => {
    if (!userId) return { ok: false, reason: 'Log in to submit recordings.' }
    const limitProblem = recordingLimitProblem(recording)
    if (limitProblem) return { ok: false, reason: limitProblem }
    if (items.some((item) => item.videoId === video.id)) return { ok: false, reason: 'This video is already in the upload queue.' }
    if (items.length >= MAX_QUEUED) return { ok: false, reason: 'Two recordings are already queued. Submit this one when an upload finishes.' }
    setItems((current) => [...current, { id: newId('upload'), videoId: video.id, title: video.title, status: 'waiting', progress: 0, error: '', recording }])
    return { ok: true }
  }, [items, userId])

  const retry = useCallback((id) => patch(id, { status: 'waiting', progress: 0, error: '' }), [patch])
  const discard = useCallback((id) => {
    if (running.current?.id === id) running.current.controller.abort()
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])
  const dismissToast = useCallback((id) => setToasts((current) => current.filter((item) => item.id !== id)), [])

  const value = useMemo(() => ({
    items, lastSubmission, isFull: items.length >= MAX_QUEUED, enqueue, retry, discard,
    itemFor: (videoId) => items.find((item) => item.videoId === videoId) || null,
  }), [items, lastSubmission, enqueue, retry, discard])

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
      {userId && <UploadToaster items={items} toasts={toasts} onRetry={retry} onDiscard={discard} onDismiss={dismissToast} />}
    </UploadQueueContext.Provider>
  )
}
