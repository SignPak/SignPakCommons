import { MAX_RECORDING_SECONDS, ROLES, TRIM_TOLERANCE_SECONDS, VIDEO_STATUS } from '../config/constants.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { conflict, notFound, validationError } from '../utils/AppError.js'
import { sniffVideo } from '../utils/files.js'
import { logger } from '../utils/logger.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'
import { storageService } from './storage/index.js'

const locked = () => conflict('You have already submitted this lesson. Submitted recordings are locked.')

function assertTrimIsSane({ trimStart, trimEnd, duration }) {
  if (duration <= 0 || duration > MAX_RECORDING_SECONDS) throw validationError({ duration: `A recording must be between 0 and ${MAX_RECORDING_SECONDS} seconds.` })
  if (trimEnd <= trimStart) throw validationError({ trimEnd: 'The trim end must come after the trim start.' })
  if (trimEnd > duration + TRIM_TOLERANCE_SECONDS) throw validationError({ trimEnd: 'The trim end is past the end of the recording.' })
}

export const submissionService = {
  /**
   * The lock rule lives here and in the database: one submission per learner per lesson, and
   * there is deliberately no update or delete for learners. Once it is in, it stays in.
   */
  async create(user, input, upload) {
    if (!upload) throw validationError({ recording: 'Attach your recording.' })
    const kind = await sniffVideo(upload.path)
    if (!kind) throw validationError({ recording: 'That does not look like an MP4, WebM or MOV video.' })
    assertTrimIsSane(input)

    const video = await videoRepo.findById(input.videoId)
    if (!video || video.status !== VIDEO_STATUS.PUBLISHED || !video.category) throw notFound('That lesson is not available.')
    if (await submissionRepo.findByUserAndVideo(user._id, video._id)) throw locked()

    const recording = await storageService.save({ tempPath: upload.path, originalName: upload.originalname, mimeType: kind.mimeType, ext: kind.ext }, { folder: 'recordings' })
    try {
      return await submissionRepo.create({
        user: user._id, video: video._id, trimStart: input.trimStart, trimEnd: input.trimEnd,
        mirrored: input.mirrored, duration: input.duration, recording,
      })
    } catch (error) {
      await storageService.remove(recording)
      if (isDuplicateKeyError(error)) throw locked() // a double-click or a second tab won the race
      throw error
    }
  },

  /** Learners see their own submissions; admins see all of them. */
  list: (user) => submissionRepo.list(user.role === ROLES.ADMIN ? {} : { userId: user._id }),

  /** Admin only (enforced by the route). Learners can never play their own submission back. */
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
