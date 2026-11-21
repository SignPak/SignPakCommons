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
import { auditService } from './auditService.js'
import { storageService } from './storage/index.js'

const cooling = (remainingMs) => conflict(`Wait ${Math.ceil(remainingMs / 1000)}s before recording this video again.`)
const archiveSlug = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'untitled'

function assertTrimIsSane({ trimStart, trimEnd, duration }) {
  if (duration <= 0 || duration > MAX_RECORDING_SECONDS) throw validationError({ duration: `A recording must be between 0 and ${MAX_RECORDING_SECONDS} seconds.` })
  if (trimEnd <= trimStart) throw validationError({ trimEnd: 'The trim end must come after the trim start.' })
  if (trimEnd > duration + TRIM_TOLERANCE_SECONDS) throw validationError({ trimEnd: 'The trim end is past the end of the recording.' })
}

const DAY_MS = 24 * 60 * 60 * 1000

/** B5: the export's columns, in order. No names, no emails; `userId` is the raw account id. */
export const EXPORT_COLUMNS = [
  'submissionId', 'userId', 'videoId', 'videoTitle', 'categoryId', 'categoryLabel',
  'driveFileId', 'archivePath', 'mimeType', 'size', 'duration',
  'trimStart', 'trimEnd', 'mirrored', 'submittedAt', 'storageDriver',
]

/** One export row from a submission (a lean document) and the video and category maps. */
function exportRow(submission, videos, categories) {
  const video = videos.get(String(submission.video))
  const categoryId = video?.category ? String(video.category) : null
  const category = categoryId ? categories.get(categoryId) : null
  const recording = submission.recording || {}
  return {
    submissionId: String(submission._id),
    userId: String(submission.user),
    videoId: String(submission.video),
    videoTitle: video?.title ?? null,
    categoryId,
    categoryLabel: category?.label ?? null,
    driveFileId: recording.key ?? null,
    archivePath: recording.archivePath ?? null,
    mimeType: recording.mimeType ?? null,
    size: recording.size ?? null,
    duration: submission.duration,
    trimStart: submission.trimStart,
    trimEnd: submission.trimEnd,
    mirrored: Boolean(submission.mirrored),
    submittedAt: new Date(submission.createdAt).toISOString(),
    storageDriver: recording.driver ?? null,
  }
}

async function lookupMaps() {
  const [videos, categories] = await Promise.all([videoRepo.titlesAndCategories(), categoryRepo.list()])
  return { videos: new Map(videos.map((video) => [video.id, video])), categories: new Map(categories.map((category) => [category.id, category])) }
}

/**
 * B5: the MongoDB filter for the admin list and the export. `to` is inclusive to the end of that
 * UTC day. A category becomes the ids of its videos (videos can move between categories, so this
 * is the video's current category).
 */
async function submissionFilter({ categoryId, videoId, userId, from, to } = {}) {
  const filter = {}
  if (userId) filter.user = userId
  if (categoryId) {
    const ids = await videoRepo.idsInCategory(categoryId)
    filter.video = { $in: videoId ? ids.filter((id) => id === videoId) : ids }
  } else if (videoId) filter.video = videoId
  if (from || to) {
    filter.createdAt = {}
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`)
    if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + DAY_MS)
  }
  return filter
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

  /**
   * Contributors see their own submissions; admins see all of them, or only their own with
   * `mine` (B7: an admin's library). With `limit` the answer is one page,
   * `{ items, nextCursor, total }`; without it, the whole array as before.
   */
  async list(user, { mine = false, limit, cursor } = {}) {
    const isAdmin = user.role === ROLES.ADMIN
    const ownOnly = !isAdmin || mine
    const shape = (submission) => {
      const result = submission.toJSON()
      if (!isAdmin) delete result.archivePath
      return result
    }
    if (limit) {
      const page = await submissionRepo.page(ownOnly ? { user: user._id } : {}, { limit, cursor })
      return { ...page, items: page.items.map(shape) }
    }
    const submissions = await submissionRepo.list(ownOnly ? { userId: user._id } : {})
    return submissions.map(shape)
  },

  /**
   * B5: GET /admin/submissions. One page of the export rows, newest first, each with the
   * contributor's name for the admin table (the export itself never has names).
   */
  async adminPage({ limit, cursor, ...filters }) {
    const [page, maps] = await Promise.all([submissionRepo.page(await submissionFilter(filters), { limit, cursor }), lookupMaps()])
    const users = new Map((await userRepo.findManyByIds(page.items.map((item) => item.user))).map((user) => [user.id, user]))
    return {
      ...page,
      items: page.items.map((submission) => {
        const user = users.get(String(submission.user))
        return { ...exportRow(submission, maps.videos, maps.categories), contributorName: user ? `${user.firstName} ${user.surname}` : 'Deleted account' }
      }),
    }
  },

  /**
   * B5: the rows of GET /admin/submissions/export, as an async iterable read from a database
   * cursor, so an export of any size streams without being held in memory. Writes one
   * submissions.export activity entry.
   */
  async exportRows(filters, admin, { format }) {
    const [filter, maps] = await Promise.all([submissionFilter(filters), lookupMaps()])
    await auditService.record({ actor: admin, action: 'submissions.export', targetType: 'submissions', meta: { format, ...filters } })
    const cursor = submissionRepo.exportCursor(filter)
    return (async function* rows() {
      for await (const submission of cursor) yield exportRow(submission, maps.videos, maps.categories)
    })()
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
  async removeAllForUser(userId, admin, { requestMessageId = null } = {}) {
    const { deleted, failed } = await this.removeRecordings(userId, admin, { requestMessageId })
    return { deleted, failed }
  },

  /**
   * removeAllForUser, also returning the DeletionLog it wrote, so an account deletion can mark
   * it accountDeleted once the account is gone (userService.remove, Phase 7 item 5). The log is
   * always written with accountDeleted false. S7: one activity entry, recordings.delete.
   */
  async removeRecordings(userId, admin, { requestMessageId = null } = {}) {
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

    const log = await deletionLogRepo.create({
      userId,
      emailHash: user ? hashEmail(user.email) : deletedAccount?.emailHash ?? null,
      deleted: removed.length,
      failed: failed.length,
      accountDeleted: false,
      requestMessageId,
      adminId: admin._id,
    })
    await auditService.record({
      actor: admin, action: 'recordings.delete', targetType: 'user', targetId: String(userId),
      meta: { deleted: removed.length, failed: failed.length, requestMessageId: requestMessageId ? String(requestMessageId) : null },
    })
    return { deleted: removed.length, failed, log }
  },

}
