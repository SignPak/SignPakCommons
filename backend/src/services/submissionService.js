import { MAX_RECORDING_SECONDS, ROLES, TRIM_TOLERANCE_SECONDS, VIDEO_STATUS } from '../config/constants.js'
import { env } from '../config/env.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { conflict, notFound, validationError } from '../utils/AppError.js'
import { sniffVideo } from '../utils/files.js'
import { logger } from '../utils/logger.js'
import { storageService } from './storage/index.js'

const cooling = (remainingMs) => conflict(`Wait ${Math.ceil(remainingMs / 1000)}s before recording this video again.`)

function assertTrimIsSane({ trimStart, trimEnd, duration }) {
  if (duration <= 0 || duration > MAX_RECORDING_SECONDS) throw validationError({ duration: `A recording must be between 0 and ${MAX_RECORDING_SECONDS} seconds.` })
  if (trimEnd <= trimStart) throw validationError({ trimEnd: 'The trim end must come after the trim start.' })
  if (trimEnd > duration + TRIM_TOLERANCE_SECONDS) throw validationError({ trimEnd: 'The trim end is past the end of the recording.' })
}

export const submissionService = {
  /**
   * This is a data-collection tool, not a one-shot quiz: a contributor can submit a video
   * more than once, since more varied takes make better training data. What is not allowed
   * is two submissions for the same (user, video) back to back — SUBMISSION_COOLDOWN_MS
   * apart, enforced by atomically claiming a cooldown window (repositories/submissionRepo.js
   * #claimCooldown) before doing any of the expensive work (storage upload, DB write). There
   * is still no update or delete for a submission once it exists: each individual recording,
   * once in, stays exactly as submitted.
   */
  async create(user, input, upload) {
    if (!upload) throw validationError({ recording: 'Attach your recording.' })
    const kind = await sniffVideo(upload.path)
    if (!kind) throw validationError({ recording: 'That does not look like an MP4, WebM or MOV video.' })
    assertTrimIsSane(input)

    const video = await videoRepo.findById(input.videoId)
    if (!video || video.status !== VIDEO_STATUS.PUBLISHED || !video.category) throw notFound('That video is not available.')

    const claimed = await submissionRepo.claimCooldown(user._id, video._id, env.SUBMISSION_COOLDOWN_MS)
    if (!claimed) throw cooling(await submissionRepo.cooldownRemaining(user._id, video._id))

    const recording = await storageService.save({ tempPath: upload.path, originalName: upload.originalname, mimeType: kind.mimeType, ext: kind.ext }, { folder: 'recordings' })
    try {
      return await submissionRepo.create({
        user: user._id, video: video._id, trimStart: input.trimStart, trimEnd: input.trimEnd,
        mirrored: input.mirrored, duration: input.duration, recording,
      })
    } catch (error) {
      await storageService.remove(recording)
      await submissionRepo.releaseCooldown(user._id, video._id) // this attempt never landed, so it should not cost the contributor their cooldown
      throw error
    }
  },

  /** Contributors see their own submissions; admins see all of them. */
  list: (user) => submissionRepo.list(user.role === ROLES.ADMIN ? {} : { userId: user._id }),

  /** Admin only (enforced by the route). Contributors can never play their own submission back. */
  async getRecording(id) {
    const submission = await submissionRepo.findById(id)
    if (!submission) throw notFound('That submission does not exist.')
    try {
      return await storageService.describe(submission.recording)
    } catch (error) {
      logger.error({ err: error, key: submission.recording.key }, 'Recording file could not be read')
      throw notFound('That recording file is missing.')
    }
  },
}
