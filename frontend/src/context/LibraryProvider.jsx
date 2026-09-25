import { useCallback, useEffect, useMemo, useState } from 'react'
import { SUBMISSION_COOLDOWN_MS } from '../mock/data'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { LibraryContext } from './LibraryContext'

const EMPTY = { ready: false, categories: [], videos: [], submissions: [] }

export default function LibraryProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState(EMPTY)

  const refresh = useCallback(async () => {
    const includeAll = user?.role === 'admin'
    const [categories, videos, submissions] = await Promise.all([
      api.categories.list(),
      api.videos.list(),
      api.submissions.list(user?.id, includeAll),
    ])
    setData({ ready: true, categories, videos, submissions })
  }, [user])

  useEffect(() => {
    let active = true
    const includeAll = user?.role === 'admin'
    Promise.all([
      api.categories.list(),
      api.videos.list(),
      api.submissions.list(user?.id, includeAll),
    ]).then(([categories, videos, submissions]) => {
      if (active) setData({ ready: true, categories, videos, submissions })
    })
    return () => { active = false }
  }, [user])

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
          userId: user.id, videoId: video.id, trimStart: recording.edit.start, trimEnd: recording.edit.end,
          mirrored: recording.edit.mirrored, duration: recording.duration, size: recording.blob.size, mimeType: recording.mimeType,
        })
        await refresh()
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

  if (!data.ready) return <div className="boot" role="status">Loading your library…</div>
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
