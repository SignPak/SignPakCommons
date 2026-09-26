import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, PageState } from '../components/ui'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { LibraryContext } from './LibraryContext'

const EMPTY = { ready: false, categories: [], videos: [], submissions: [] }
const SUBMISSION_COOLDOWN_MS = Number(import.meta.env.VITE_SUBMISSION_COOLDOWN_MS || 30_000)

function loadLibrary(user) {
  const includeAll = user?.role === 'admin'
  return Promise.all([
    api.categories.list(),
    api.videos.list(),
    user ? api.submissions.list(user.id, includeAll) : Promise.resolve([]),
  ])
}

export default function LibraryProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loadError, setLoadError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  const refresh = useCallback(async () => {
    const [categories, videos, submissions] = await loadLibrary(user)
    setData({ ready: true, categories, videos, submissions })
    setLoadError('')
  }, [user])

  useEffect(() => {
    let active = true
    setLoadError('')
    loadLibrary(user)
      .then(([categories, videos, submissions]) => {
        if (active) setData({ ready: true, categories, videos, submissions })
      })
      .catch((error) => {
        if (active) setLoadError(error?.message || 'Unable to load the library. Try again.')
      })
    return () => { active = false }
  }, [user, loadAttempt])

  const value = useMemo(() => {
    const { categories, videos, submissions } = data
    const categoryIds = new Set(categories.map((item) => item.id))
    const byOrder = (a, b) => (a.order || 0) - (b.order || 0)

    // Contributors only ever see published videos that belong to an existing category.
    const publishedVideos = videos.filter((item) => item.status === 'published' && categoryIds.has(item.categoryId))
    const videosIn = (categoryId) => publishedVideos.filter((item) => item.categoryId === categoryId).sort(byOrder)
    const orderedPublished = categories.flatMap((category) => videosIn(category.id))

    const mySubmissions = submissions.filter((item) => item.userId === user?.id)
    // A video can collect more than one recording over time, so "contributed" tracks whether
    // there is at least one, not whether the video is somehow finished or locked.
    const contributedIds = new Set(mySubmissions.map((item) => item.videoId))
    const hasSubmission = (videoId) => contributedIds.has(videoId)
    const submissionsFor = (videoId) => mySubmissions.filter((item) => item.videoId === videoId).sort((a, b) => b.submittedAt - a.submittedAt)
    const submissionCount = (videoId) => submissionsFor(videoId).length
    /** Timestamp of this user's most recent submission for a video, or null. Drives the record-again cooldown. */
    const lastSubmissionAt = (videoId) => submissionsFor(videoId)[0]?.submittedAt ?? null

    const nextVideo = (video) => {
      const list = videosIn(video.categoryId)
      return list[list.findIndex((item) => item.id === video.id) + 1] || null
    }
    // Steers a contributor toward videos nobody has recorded yet, for the widest coverage.
    const nextUp = orderedPublished.find((item) => !contributedIds.has(item.id)) || null

    return {
      ...data, publishedVideos, orderedPublished, mySubmissions, videosIn, hasSubmission, submissionsFor, submissionCount, lastSubmissionAt, nextVideo, nextUp, refresh,
      contributedCount: orderedPublished.filter((item) => contributedIds.has(item.id)).length,
      totalSubmissionCount: mySubmissions.length,
      cooldownMs: SUBMISSION_COOLDOWN_MS,

      async submitRecording(video, recording) {
        const submission = await api.submissions.create({
          videoId: video.id, recording: recording.blob, trimStart: recording.edit.start, trimEnd: recording.edit.end,
          mirrored: recording.edit.mirrored, duration: recording.duration, size: recording.blob.size, mimeType: recording.mimeType,
        })
        void refresh().catch(() => {
          setData((current) => ({
            ...current,
            submissions: [submission, ...current.submissions.filter((item) => item.id !== submission.id)],
          }))
        })
        return submission
      },
      async addCategory(values) { const created = await api.categories.create(values); await refresh(); return created },
      async editCategory(id, patch) { await api.categories.update(id, patch); await refresh() },
      async deleteCategory(id) { await api.categories.remove(id); await refresh() },
      async addVideo(values) { const created = await api.videos.create(values); await refresh(); return created },
      async editVideo(id, patch) { await api.videos.update(id, patch); await refresh() },
      async deleteVideo(id) { await api.videos.remove(id); await refresh() },
    }
  }, [data, user, refresh])

  if (!data.ready && loadError) {
    return <PageState
      eyebrow="Connection problem"
      title="We couldn't load the library."
      action={<Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button>}
    >{loadError}</PageState>
  }
  if (!data.ready) return <div className="boot" role="status">Loading your library…</div>
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
