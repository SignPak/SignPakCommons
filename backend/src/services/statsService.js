import mongoose from 'mongoose'
import { ROLES, VIDEO_STATUS } from '../config/constants.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'

const DAY_MS = 24 * 60 * 60 * 1000
const startOfUtcDay = (time) => { const d = new Date(time); d.setUTCHours(0, 0, 0, 0); return d }
const byId = (docs) => new Map(docs.map((doc) => [doc.id, doc]))
const nameOf = (user) => `${user.firstName} ${user.surname}`

/**
 * B7: submissions per UTC day, `days` entries from `start`. Each entry of `items` is a Date (one
 * submission) or `{ date, count }` (already grouped by day). Dates outside the range are left out.
 */
export function bucketByDay(items, start, days) {
  const perDay = new Map()
  for (const item of items) {
    const date = item instanceof Date ? item : new Date(item.date)
    const key = date.toISOString().slice(0, 10)
    perDay.set(key, (perDay.get(key) || 0) + (item instanceof Date ? 1 : item.count))
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10)
    return { date, count: perDay.get(date) || 0 }
  })
}

const objectId = (id) => new mongoose.Types.ObjectId(String(id))

export const statsService = {
  /**
   * Numbers for the admin dashboard. Days are UTC days. B7: `userId` and `categoryId` narrow
   * everything except `totals` (all-time) and `totalsByCategory` (all-time, per category).
   */
  async overview({ days, userId, categoryId }) {
    const start = startOfUtcDay(Date.now() - (days - 1) * DAY_MS)
    const match = { createdAt: { $gte: start } }
    if (userId) match.user = objectId(userId)
    if (categoryId) match.video = { $in: (await videoRepo.idsInCategory(categoryId)).map(objectId) }

    const [contributors, videos, published, submissions, categories, perVideoAllTime, allVideos, ranged, recent] = await Promise.all([
      userRepo.countVerified(ROLES.USER), // B2: finished sign-ups only
      videoRepo.count(),
      videoRepo.count({ status: VIDEO_STATUS.PUBLISHED }),
      submissionRepo.count(),
      categoryRepo.list(),
      submissionRepo.countsByVideo(),
      videoRepo.titlesAndCategories(),
      submissionRepo.statsFor(match),
      submissionRepo.recentMatching(match, 6),
    ])

    const videoMap = byId(allVideos)
    const categoryMap = byId(categories)
    const categoryOf = (videoId) => {
      const video = videoMap.get(String(videoId))
      return video?.category ? String(video.category) : null
    }
    const perCategory = (rows) => {
      const counts = new Map()
      for (const { _id, count } of rows) {
        const id = categoryOf(_id)
        if (id) counts.set(id, (counts.get(id) || 0) + count)
      }
      return counts
    }

    const rangedByCategory = perCategory(ranged.byVideo)
    const byCategory = categories.map((category) => ({ categoryId: category.id, label: category.label, tone: category.tone, count: rangedByCategory.get(category.id) || 0 }))
    const allTimeByCategory = perCategory(perVideoAllTime)
    const totalsByCategory = categories.map((category) => ({ categoryId: category.id, count: allTimeByCategory.get(category.id) || 0 }))
    const top = byCategory.reduce((winner, item) => (item.count > (winner?.count ?? 0) ? item : winner), null)

    const topVideos = ranged.byVideo
      .map(({ _id, count }) => {
        const video = videoMap.get(String(_id))
        const category = video?.category ? categoryMap.get(String(video.category)) : null
        return { videoId: String(_id), title: video?.title ?? 'Removed video', categoryId: category?.id ?? null, tone: category?.tone ?? null, count }
      })
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
      .slice(0, 6)

    const [rangedUsers, recentUsers] = await Promise.all([
      userRepo.findManyByIds(ranged.byUser.map((row) => row._id)),
      userRepo.findManyByIds(recent.map((item) => item.user)),
    ])
    const rangedUserMap = byId(rangedUsers)
    const topContributors = ranged.byUser
      .map(({ _id, count }) => {
        const user = rangedUserMap.get(String(_id))
        return { userId: String(_id), name: user ? nameOf(user) : 'Deleted account', count }
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5)

    const userMap = byId(recentUsers)
    const recentSubmissions = recent.map((item) => {
      const contributor = userMap.get(String(item.user))
      const video = videoMap.get(String(item.video))
      const category = video?.category && categoryMap.get(String(video.category))
      return {
        id: item.id,
        submittedAt: item.createdAt,
        contributor: contributor ? { id: contributor.id, name: nameOf(contributor) } : null,
        video: video ? { id: video.id, title: video.title } : null,
        category: category ? { id: category.id, label: category.label } : null,
      }
    })

    return {
      totals: { contributors, videos, publishedVideos: published, submissions, categories: categories.length },
      totalsByCategory,
      activity: bucketByDay(ranged.byDay.map(({ _id, count }) => ({ date: _id, count })), start, days),
      byCategory,
      summary: {
        recordings: ranged.total,
        activeContributors: ranged.byUser.length,
        videosRecorded: ranged.byVideo.length,
        topCategory: top ? { categoryId: top.categoryId, label: top.label, count: top.count } : null,
      },
      topVideos,
      topContributors,
      recent: recentSubmissions,
    }
  },
}
