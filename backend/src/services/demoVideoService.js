import { env } from '../config/env.js'
import { demoVideoRepo } from '../repositories/demoVideoRepo.js'
import { notFound, validationError } from '../utils/AppError.js'
import { attemptCleanup } from '../utils/cleanup.js'
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

    let saved
    let previousFile
    try {
      const current = await demoVideoRepo.find()
      saved = await demoVideoRepo.replace({ title: input.title, durationSec: input.durationSec, width: input.width, height: input.height, videoFile })
      previousFile = current?.videoFile
    } catch (error) {
      await attemptCleanup('remove new demo video after a failed save', () => storageService.remove(videoFile), { key: videoFile.key })
      throw error
    }

    // The database now points at the new file, so the upload has succeeded. The old file is a
    // leftover: if removing it fails, log it rather than roll back (which would delete the file
    // the database now uses and break the demo video).
    await attemptCleanup('remove previous demo video', () => storageService.remove(previousFile), { key: previousFile?.key })
    return saved
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
