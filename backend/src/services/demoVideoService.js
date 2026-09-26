import { env } from '../config/env.js'
import { demoVideoRepo } from '../repositories/demoVideoRepo.js'
import { notFound, validationError } from '../utils/AppError.js'
import { sniffVideo } from '../utils/files.js'
import { logger } from '../utils/logger.js'
import { storageService } from './storage/index.js'

export const demoVideoService = {
  get: () => demoVideoRepo.find(),

  async upload(input, upload) {
    if (!upload) throw validationError({ video: 'Choose a demo video to upload.' })
    const kind = await sniffVideo(upload.path)
    if (!kind) throw validationError({ video: 'That does not look like an MP4, WebM or MOV video.' })

    const videoFile = await storageService.save({
      tempPath: upload.path,
      originalName: upload.originalname,
      mimeType: kind.mimeType,
      ext: kind.ext,
    }, { folder: 'demo' })

    try {
      const current = await demoVideoRepo.find()
      const saved = await demoVideoRepo.replace({ title: input.title, durationSec: input.durationSec, videoFile })
      await storageService.remove(current?.videoFile)
      return saved
    } catch (error) {
      await storageService.remove(videoFile)
      throw error
    }
  },

  async remove() {
    const current = await demoVideoRepo.remove()
    await storageService.remove(current?.videoFile)
  },

  async getFile() {
    const current = await demoVideoRepo.find()
    if (!current) throw notFound('No demo video is available.')
    try {
      return await storageService.describe(current.videoFile)
    } catch (error) {
      logger.error({ err: error, key: current.videoFile.key }, 'Demo video file could not be read')
      throw notFound('The demo video file is missing.')
    }
  },
}
