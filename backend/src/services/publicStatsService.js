import { ROLES, VIDEO_STATUS } from '../config/constants.js'
import { env } from '../config/env.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { logger } from '../utils/logger.js'
import { upstashRedis } from './cache/upstashRedis.js'

const CACHE_KEY = 'signpak:public-stats:v1'
const CACHE_TTL_SECONDS = 12 * 60 * 60

function isValidStats(value) {
  return value
    && Number.isInteger(value.contributors) && value.contributors >= 0
    && Number.isInteger(value.publishedVideos) && value.publishedVideos >= 0
    && Number.isInteger(value.categories) && value.categories >= 0
}

async function loadStats() {
  const [contributors, publishedVideos, categories] = await Promise.all([
    userRepo.countByRole(ROLES.USER),
    videoRepo.count({ status: VIDEO_STATUS.PUBLISHED, category: { $ne: null } }),
    categoryRepo.count(),
  ])
  return { contributors, publishedVideos, categories }
}

export const publicStatsService = {
  async get() {
    if (!upstashRedis.enabled) return loadStats()

    try {
      const cached = await upstashRedis.get(CACHE_KEY)
      if (cached !== null) {
        const stats = JSON.parse(cached)
        if (isValidStats(stats)) return stats
        logger.warn('Ignoring invalid cached public stats from Upstash Redis.')
      }
    } catch (error) {
      logger.warn({ err: error }, 'Could not read public stats from Upstash Redis; querying the database.')
    }

    const stats = await loadStats()
    try {
      await upstashRedis.set(CACHE_KEY, stats, CACHE_TTL_SECONDS)
    } catch (error) {
      logger.warn({ err: error }, 'Could not cache public stats in Upstash Redis.')
    }
    return stats
  },
}
