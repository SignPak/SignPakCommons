import { POSTER_MAX_BYTES, ROLES, VIDEO_STATUS } from '../config/constants.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { notFound, validationError } from '../utils/AppError.js'
import { sniffImage, sniffVideo } from '../utils/files.js'
import { logger } from '../utils/logger.js'
import { storageService } from './storage/index.js'

const isAdmin = (user) => user?.role === ROLES.ADMIN

async function assertCategoryExists(categoryId) {
  if (categoryId && !(await categoryRepo.findById(categoryId))) throw validationError({ categoryId: 'That category does not exist.' })
}

/** Learners only get published videos that sit in a category; anything else looks like it does not exist. */
async function findVisible(id, requester) {
  const video = await videoRepo.findById(id)
  const visible = video && (isAdmin(requester) || (video.status === VIDEO_STATUS.PUBLISHED && video.category))
  if (!visible) throw notFound('That video is not available.')
  return video
}

async function describeOrNotFound(ref) {
  try {
    return await storageService.describe(ref)
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
    if (!upload) throw validationError({ video: 'Choose a video to upload.' })

    const videoKind = await sniffVideo(upload.path)
    if (!videoKind) throw validationError({ video: 'That does not look like an MP4, WebM or MOV video.' })
    let posterKind = null
    if (posterUpload) {
      if (posterUpload.size > POSTER_MAX_BYTES) throw validationError({ poster: 'Poster images must be under 2 MB.' })
      posterKind = await sniffImage(posterUpload.path)
      if (!posterKind) throw validationError({ poster: 'The poster must be a JPEG, PNG or WebP image.' })
    }
    await assertCategoryExists(input.categoryId)

    const stored = []
    try {
      const videoFile = await storageService.save({ tempPath: upload.path, originalName: upload.originalname, mimeType: videoKind.mimeType, ext: videoKind.ext }, { folder: 'videos' })
      stored.push(videoFile)
      let posterFile = null
      if (posterUpload) {
        posterFile = await storageService.save({ tempPath: posterUpload.path, originalName: posterUpload.originalname, mimeType: posterKind.mimeType, ext: posterKind.ext }, { folder: 'posters' })
        stored.push(posterFile)
      }
      const order = input.categoryId ? (await videoRepo.maxOrder(input.categoryId)) + 1 : 1
      return await videoRepo.create({
        title: input.title, level: input.level, status: input.status, durationSec: input.durationSec,
        category: input.categoryId, order, videoFile, posterFile, createdBy: admin._id,
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
    for (const key of ['title', 'level', 'status', 'order']) {
      if (patch[key] !== undefined) video[key] = patch[key]
    }
    return videoRepo.save(video)
  },

  async remove(id) {
    const video = await videoRepo.findById(id)
    if (!video) throw notFound('That video does not exist.')
    await videoRepo.remove(video.id)
    // Learners' past submissions are kept on record; only the base video's own files go.
    await Promise.all([storageService.remove(video.videoFile), storageService.remove(video.posterFile)])
  },

  async getFile(id, requester) {
    const video = await findVisible(id, requester)
    return describeOrNotFound(video.videoFile)
  },

  async getPoster(id, requester) {
    const video = await findVisible(id, requester)
    if (!video.posterFile) throw notFound('That video has no poster.')
    return describeOrNotFound(video.posterFile)
  },
}
