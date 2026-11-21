import { CONSENT_VERSION, MAX_RECORDING_SECONDS, ROLES, TRIM_TOLERANCE_SECONDS, VIDEO_STATUS } from '../config/constants.js'
import { env } from '../config/env.js'
import { deletedAccountRepo, deletionLogRepo } from '../repositories/deletionRepo.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { categoryRepo } from '../repositories/categoryRepo.js'
import { videoRepo } from '../repositories/videoRepo.js'
import { AppError, conflict, notFound, validationError } from '../utils/AppError.js'
import { attemptCleanup } from '../utils/cleanup.js'
import { hashEmail } from '../utils/emailHash.js'
import { logger } from '../utils/logger.js'
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
   * #claimCooldown) before doing any of the expensive work (storage upload, DB write). A
   * submission is never updated: each recording, once in, stays exactly as submitted. The only
   * deletion is removeAllForUser below, an admin acting on a recording/data deletion request
   * (FR13.13, C3); it removes all of one contributor's recordings and logs that it did.
   */
  async create(user, input, upload) {
    if (user.role === ROLES.USER && user.consent?.version !== CONSENT_VERSION) {
      throw new AppError(403, 'CONSENT_REQUIRED', 'Accept the consent notice before submitting a recording.')
    }
    if (!upload) throw validationError({ recording: 'Attach your recording.' })
    const kind = await sniffVideo(upload.path)
    if (!kind) throw validationError({ recording: 'That does not look like an MP4, WebM or MOV video.' })
    assertTrimIsSane(input)

    const video = await videoRepo.findById(input.videoId)
    if (!video || video.status !== VIDEO_STATUS.PUBLISHED || !video.category) throw notFound('That video is not available.')
    const category = await categoryRepo.findById(video.category)
    if (!category) throw notFound('That video category is not available.')

    const cooldownStartedAt = await submissionRepo.claimCooldown(user._id, video._id, env.SUBMISSION_COOLDOWN_MS)
    if (!cooldownStartedAt) throw cooling(await submissionRepo.cooldownRemaining(user._id, video._id))

    let recording
    try {
      const sequence = await submissionRepo.countForPair(user._id, video._id)
      const categoryName = archiveSlug(category.label)
      const videoName = archiveSlug(video.title)
      const archiveFolder = `commons/${user._id}_${sequence}/${categoryName}/${videoName}`
      recording = await storageService.archive({
        tempPath: upload.path, originalName: upload.originalname, mimeType: kind.mimeType, ext: kind.ext,
        folder: archiveFolder, fileName: `${videoName}${kind.ext}`,
      })
      return await submissionRepo.create({
        user: user._id, video: video._id, trimStart: input.trimStart, trimEnd: input.trimEnd,
        mirrored: input.mirrored, duration: input.duration, recording, cooldownStartedAt,
      })
    } catch (error) {
      // B1: each step on its own, so a Drive failure here cannot leave the cooldown stuck,
      // and the contributor sees what actually went wrong, not the clean-up's error.
      await attemptCleanup('remove archived recording', () => storageService.remove(recording), { key: recording?.key })
      await attemptCleanup('release submission cooldown', () => submissionRepo.releaseCooldown(user._id, video._id))
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

  /** Admin: one page of a contributor's submissions (C3: what a deletion would remove). */
  async pageForUser(userId, { limit, cursor }) {
    const page = await submissionRepo.pageForUser(userId, { limit, cursor })
    return { ...page, items: page.items.map((submission) => submission.toJSON()) }
  },

  /**
   * C3: deletes every recording of one contributor (a deletion request, FR13.13): each stored
   * file, then its Submission document, then the contributor's cooldowns, and writes a
   * DeletionLog. A file that can't be removed is reported and its document is kept, so the
   * pointer to it is never lost and running this again finishes the job. Works for an account
   * that no longer exists, because account deletion keeps the recordings.
   */
  async removeAllForUser(userId, admin, { requestMessageId = null, accountDeletion = false } = {}) {
    const [submissions, user] = await Promise.all([submissionRepo.allForUser(userId), userRepo.findById(userId)])
    const deletedAccount = user ? null : await deletedAccountRepo.latestForUser(userId)
    if (!submissions.length && !user && !deletedAccount) throw notFound('There is no contributor with that ID.')

    const removed = []
    const failed = []
    for (const submission of submissions) {
      try {
        await storageService.remove(submission.recording)
        removed.push(submission._id)
      } catch (error) {
        logger.error({ err: error, submissionId: String(submission._id) }, 'Could not delete a recording file')
        failed.push({ id: String(submission._id), reason: 'The file could not be deleted from storage. Try again.' })
      }
    }
    if (removed.length) await submissionRepo.removeMany(removed)
    await attemptCleanup('clear cooldowns of a deleted contributor', () => submissionRepo.clearCooldownsForUser(userId))

    await deletionLogRepo.create({
      userId,
      emailHash: user ? hashEmail(user.email) : deletedAccount?.emailHash ?? null,
      deleted: removed.length,
      failed: failed.length,
      accountDeleted: accountDeletion && failed.length === 0,
      requestMessageId,
      adminId: admin._id,
    })
    return { deleted: removed.length, failed }
  },

}
