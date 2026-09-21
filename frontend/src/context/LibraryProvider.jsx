import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import { LibraryContext } from './LibraryContext'

const EMPTY = { ready: false, categories: [], videos: [], submissions: [] }

export default function LibraryProvider({ children }) {
  const { user } = useAuth()
  const [data, setData] = useState(EMPTY)

  const refresh = useCallback(async () => {
    const [categories, videos, submissions] = await Promise.all([api.categories.list(), api.videos.list(), api.submissions.list()])
    setData({ ready: true, categories, videos, submissions })
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([api.categories.list(), api.videos.list(), api.submissions.list()]).then(([categories, videos, submissions]) => {
      if (active) setData({ ready: true, categories, videos, submissions })
    })
    return () => { active = false }
  }, [])

  const value = useMemo(() => {
    const { categories, videos, submissions } = data
    const categoryIds = new Set(categories.map((item) => item.id))
    const byOrder = (a, b) => (a.order || 0) - (b.order || 0)

    // Learners only ever see published videos that belong to an existing category.
    const publishedVideos = videos.filter((item) => item.status === 'published' && categoryIds.has(item.categoryId))
    const videosIn = (categoryId) => publishedVideos.filter((item) => item.categoryId === categoryId).sort(byOrder)
    const orderedPublished = categories.flatMap((category) => videosIn(category.id))

    const mySubmissions = submissions.filter((item) => item.userId === user?.id)
    const doneIds = new Set(mySubmissions.map((item) => item.videoId))
    const isDone = (videoId) => doneIds.has(videoId)
    const nextVideo = (video) => {
      const list = videosIn(video.categoryId)
      return list[list.findIndex((item) => item.id === video.id) + 1] || null
    }
    const nextUp = orderedPublished.find((item) => !doneIds.has(item.id)) || null

    return {
      ...data, publishedVideos, orderedPublished, mySubmissions, videosIn, isDone, nextVideo, nextUp, refresh,
      doneCount: orderedPublished.filter((item) => doneIds.has(item.id)).length,

      async submitRecording(video, recording) {
        await api.submissions.create({
          userId: user.id, videoId: video.id, trimStart: recording.edit.start, trimEnd: recording.edit.end,
          mirrored: recording.edit.mirrored, duration: recording.duration, size: recording.blob.size, mimeType: recording.mimeType,
        })
        await refresh()
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
