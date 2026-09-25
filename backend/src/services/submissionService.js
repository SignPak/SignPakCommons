import { MAX_RECORDING_SECONDS, ROLES, TRIM_TOLERANCE_SECONDS, VIDEO_STATUS } from '../config/constants.js'
import { env } from '../config/env.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { conflict, notFound, validationError } from '../utils/AppError.js'
import { sniffVideo } from '../utils/files.js'
import { storageService } from './storage/index.js'

const cooling = (remainingMs) => conflict(`Wait ${Math.ceil(remainingMs / 1000)}s before recording this video again.`)
const archiveSlug = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'untitled'

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
    const category = await categoryRepo.findById(video.category)
    if (!category) throw notFound('That video category is not available.')

    const claimed = await submissionRepo.claimCooldown(user._id, video._id, env.SUBMISSION_COOLDOWN_MS)
    if (!claimed) throw cooling(await submissionRepo.cooldownRemaining(user._id, video._id))

    const sequence = await submissionRepo.countForPair(user._id, video._id)
    const categoryName = archiveSlug(category.label)
    const videoName = archiveSlug(video.title)
    const archiveFolder = `commons/${user._id}_${sequence}/${categoryName}/${videoName}`
    const recording = await storageService.archive({
      tempPath: upload.path, originalName: upload.originalname, mimeType: kind.mimeType, ext: kind.ext,
      folder: archiveFolder, fileName: `${videoName}${kind.ext}`,
    })
    try {
      return await submissionRepo.create({
        user: user._id, video: video._id, trimStart: input.trimStart, trimEnd: input.trimEnd,
        mirrored: input.mirrored, duration: input.duration, recording,
      })
    } catch (error) {
      await submissionRepo.releaseCooldown(user._id, video._id) // this attempt never landed, so it should not cost the contributor their cooldown
      throw error
    }
  },

  /** Contributors see their own submissions; admins see all of them. */
  async list(user) {
    const isAdmin = user.role === ROLES.ADMIN
    const submissions = await submissionRepo.list(isAdmin ? {} : { userId: user._id })
    return submissions.map((submission) => {
      const result = submission.toJSON()
      if (!isAdmin) delete result.archivePath
      return result
    })
  },

}
