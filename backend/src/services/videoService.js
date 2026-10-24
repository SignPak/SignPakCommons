import { POSTER_MAX_BYTES, ROLES, VIDEO_STATUS } from '../config/constants.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { notFound, validationError } from '../utils/AppError.js'
import { safeName, sniffImage, sniffVideo } from '../utils/files.js'
import { logger } from '../utils/logger.js'
import { upstashRedis } from './cache/upstashRedis.js'
import { storageService } from './storage/index.js'

const isAdmin = (user) => user?.role === ROLES.ADMIN
const POSTER_CACHE_TTL_SECONDS = 5 * 60
const posterCacheKey = (id) => `signpak:video-poster:v1:${id}`

async function assertCategoryExists(categoryId) {
  if (categoryId && !(await categoryRepo.findById(categoryId))) throw validationError({ categoryId: 'That category does not exist.' })
}

/** Contributors only get published videos that sit in a category; anything else looks like it does not exist. */
async function findVisible(id, requester) {
  const video = await videoRepo.findById(id)
  const visible = video && (isAdmin(requester) || (video.status === VIDEO_STATUS.PUBLISHED && video.category))
  if (!visible) throw notFound('That video is not available.')
  return video
}

async function describeOrNotFound(ref, cachedMetadata) {
  try {
    return await storageService.describe(ref, cachedMetadata)
  } catch (error) {
    logger.error({ err: error, key: ref.key }, 'Stored file could not be read')
    throw notFound('That file is missing.')
  }
}

export const videoService = {
  list: (requester) => videoRepo.listVisible({ isAdmin: isAdmin(requester) }),
  get: findVisible,

  /** `files` is multer's { video: [file], poster?: [file] }. Files are checked by their real content. */
  async create(admin, input, files) {
    const upload = files?.video?.[0]
    const posterUpload = files?.poster?.[0]
    const externalVideoUrl = input.videoUrl?.trim() || null
    if (!upload && !externalVideoUrl) {
      throw validationError({ video: 'Choose a video to upload or provide a direct video URL.' })
    }
    if (Boolean(upload) === Boolean(externalVideoUrl)) {
      throw validationError({ video: 'Provide either a video upload or a direct video URL.' })
    }
    if (externalVideoUrl && !posterUpload) {
      throw validationError({ poster: 'Choose a poster image for an external video.' })
    }

    const videoKind = upload ? await sniffVideo(upload.path) : null
    if (upload && !videoKind) throw validationError({ video: 'That does not look like an MP4, WebM or MOV video.' })
    let posterKind = null
    if (posterUpload) {
      if (posterUpload.size > POSTER_MAX_BYTES) throw validationError({ poster: 'Poster images must be under 2 MB.' })
      posterKind = await sniffImage(posterUpload.path)
      if (!posterKind) throw validationError({ poster: 'The poster must be a JPEG, PNG or WebP image.' })
    }
    const category = input.categoryId ? await categoryRepo.findById(input.categoryId) : null
    if (input.categoryId && !category) throw validationError({ categoryId: 'That category does not exist.' })
    const folder = `videos/${safeName(category?.label, 'Unassigned')}`
    const base = safeName(input.title)

    const stored = []
    try {
      let videoFile = null
      if (upload) {
        videoFile = await storageService.save(
          { tempPath: upload.path, originalName: upload.originalname, mimeType: videoKind.mimeType, ext: videoKind.ext },
          { folder, fileName: `${base}${videoKind.ext}` },
        )
        stored.push(videoFile)
      }
      let posterFile = null
      if (posterUpload) {
        posterFile = await storageService.save(
          { tempPath: posterUpload.path, originalName: posterUpload.originalname, mimeType: posterKind.mimeType, ext: posterKind.ext },
          { folder, fileName: `${base} (poster)${posterKind.ext}` },
        )
        stored.push(posterFile)
      }
      const order = input.categoryId ? (await videoRepo.maxOrder(input.categoryId)) + 1 : 1
      return await videoRepo.create({
        title: input.title, status: input.status, durationSec: input.durationSec, width: input.width, height: input.height,
        category: input.categoryId, order, videoFile, externalVideoUrl, posterFile, createdBy: admin._id,
      })
    } catch (error) {
      await Promise.all(stored.map((ref) => storageService.remove(ref))) // no orphaned files if the database write fails
      throw error
    }
  },

  async update(id, patch) {
    const video = await videoRepo.findById(id)
    if (!video) throw notFound('That video does not exist.')

    if ('categoryId' in patch) {
      await assertCategoryExists(patch.categoryId)
      const moved = String(video.category ?? '') !== String(patch.categoryId ?? '')
      video.category = patch.categoryId
      // Moving into a category puts the video at the end of that path unless an order was given.
      if (moved && patch.categoryId && patch.order === undefined) video.order = (await videoRepo.maxOrder(patch.categoryId)) + 1
    }
    for (const key of ['title', 'status', 'order']) {
      if (patch[key] !== undefined) video[key] = patch[key]
    }
    return videoRepo.save(video)
  },

  async remove(id) {
    const video = await videoRepo.findById(id)
    if (!video) throw notFound('That video does not exist.')
    await videoRepo.remove(video.id)
    // Contributors' past submissions are kept on record; only the base video's own files go.
    await Promise.all([storageService.remove(video.videoFile), storageService.remove(video.posterFile)])
  },

  async getFile(id, requester) {
    const video = await findVisible(id, requester)
    if (!video.videoFile) throw notFound('That video is hosted externally.')
    return describeOrNotFound(video.videoFile)
  },

  async getPoster(id, requester) {
    const video = await findVisible(id, requester)
    if (!video.posterFile) throw notFound('That video has no poster.')
    let cachedMetadata
    if (upstashRedis.enabled) {
      try {
        const cached = await upstashRedis.get(posterCacheKey(video.id))
        if (cached !== null) {
          const metadata = JSON.parse(cached)
          if (
            metadata?.driver === video.posterFile.driver
            && metadata?.key === video.posterFile.key
            && Number.isSafeInteger(metadata.size)
            && metadata.size >= 0
            && metadata.mimeType === video.posterFile.mimeType
          ) cachedMetadata = metadata
          else logger.warn({ videoId: video.id }, 'Ignoring invalid cached poster metadata from Upstash Redis.')
        }
      } catch (error) {
        logger.warn({ err: error, videoId: video.id }, 'Could not read poster metadata from Upstash Redis.')
      }
    }
    if (cachedMetadata) return describeOrNotFound(video.posterFile, cachedMetadata)

    const file = await describeOrNotFound(video.posterFile)
    if (upstashRedis.enabled) {
      try {
        await upstashRedis.set(posterCacheKey(video.id), {
          driver: video.posterFile.driver,
          key: video.posterFile.key,
          size: file.size,
          mimeType: file.mimeType,
        }, POSTER_CACHE_TTL_SECONDS)
      } catch (error) {
        logger.warn({ err: error, videoId: video.id }, 'Could not cache poster metadata in Upstash Redis.')
      }
    }
    return file
  },
}
