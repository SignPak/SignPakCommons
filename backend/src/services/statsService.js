import { ROLES, VIDEO_STATUS } from '../config/constants.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'

const DAY_MS = 24 * 60 * 60 * 1000
const startOfUtcDay = (time) => { const d = new Date(time); d.setUTCHours(0, 0, 0, 0); return d }
const byId = (docs) => new Map(docs.map((doc) => [doc.id, doc]))

export const statsService = {
  /** Numbers for the admin dashboard. Days are UTC days. */
  async overview({ days }) {
    const start = startOfUtcDay(Date.now() - (days - 1) * DAY_MS)
    const [learners, videos, published, submissions, categories, createdDates, perVideo, videoCategories, recent] = await Promise.all([
      userRepo.countByRole(ROLES.USER),
      videoRepo.count(),
      videoRepo.count({ status: VIDEO_STATUS.PUBLISHED }),
      submissionRepo.count(),
      categoryRepo.list(),
      submissionRepo.createdSince(start),
      submissionRepo.countsByVideo(),
      videoRepo.categoryOfEach(),
      submissionRepo.recent(6),
    ])

    const perDay = new Map()
    for (const { createdAt } of createdDates) {
      const key = createdAt.toISOString().slice(0, 10)
      perDay.set(key, (perDay.get(key) || 0) + 1)
    }
    const activity = Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10)
      return { date, count: perDay.get(date) || 0 }
    })

    const categoryOfVideo = new Map(videoCategories.map((video) => [video.id, video.category ? String(video.category) : null]))
    const perCategory = new Map()
    for (const { _id, count } of perVideo) {
      const categoryId = categoryOfVideo.get(String(_id))
      if (categoryId) perCategory.set(categoryId, (perCategory.get(categoryId) || 0) + count)
    }
    const byCategory = categories.map((category) => ({ categoryId: category.id, label: category.label, tone: category.tone, count: perCategory.get(category.id) || 0 }))

    const [users, recentVideos] = await Promise.all([
      userRepo.findManyByIds(recent.map((item) => item.user)),
      videoRepo.findManyByIds(recent.map((item) => item.video)),
    ])
    const userMap = byId(users)
    const videoMap = byId(recentVideos)
    const categoryMap = byId(categories)
    const recentSubmissions = recent.map((item) => {
      const learner = userMap.get(String(item.user))
      const video = videoMap.get(String(item.video))
      const category = video?.category && categoryMap.get(String(video.category))
      return {
        id: item.id,
        submittedAt: item.createdAt,
        learner: learner ? { id: learner.id, name: `${learner.firstName} ${learner.surname}` } : null,
        video: video ? { id: video.id, title: video.title } : null,
        category: category ? { id: category.id, label: category.label } : null,
      }
    })

    return {
      totals: { learners, videos, publishedVideos: published, submissions, categories: categories.length },
      activity,
      byCategory,
      recent: recentSubmissions,
    }
  },
}
