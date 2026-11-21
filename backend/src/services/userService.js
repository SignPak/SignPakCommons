import bcrypt from 'bcrypt'
import { CONSENT_VERSION, ROLES } from '../config/constants.js'
import { deletedAccountRepo, deletionLogRepo } from '../repositories/deletionRepo.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { conflict, forbidden, notFound, unauthorized } from '../utils/AppError.js'
import { hashEmail } from '../utils/emailHash.js'
import { attemptCleanup } from '../utils/cleanup.js'
import { auditService } from './auditService.js'
import { submissionService } from './submissionService.js'

/**
 * C3: account deletion keeps the recordings, so remember the account by its email hash. A later
 * deletion request can then be matched to the recordings it left behind.
 */
async function deleteAccount(user, by) {
  await deletedAccountRepo.create({ userId: user._id, emailHash: hashEmail(user.email), by })
  await submissionRepo.clearCooldownsForUser(user._id)
  await userRepo.remove(user._id)
}

export const userService = {
  /** Records the date and time the contributor accepted the consent notice (kept on the first acceptance of a version). */
  async acceptConsent(user, version) {
    if (version !== CONSENT_VERSION) throw conflict('The consent notice was updated. Reload the page and read the current version.')
    if (user.consent?.acceptedAt && user.consent.version === CONSENT_VERSION) return user
    user.consent = { acceptedAt: new Date(), version: CONSENT_VERSION }
    return userRepo.save(user)
  },

  async updateConnections(user, connections) {
    // Only keys that were sent change; null disconnects.
    for (const key of ['github', 'linkedin']) {
      if (key in connections) user.connections[key] = connections[key]
    }
    return userRepo.save(user)
  },

  listContributors: () => userRepo.list({ role: ROLES.USER }),
  async listAll() {
    const users = await userRepo.list({ includeDeviceIds: true })
    return users.map((user) => ({ ...user.toJSON(), lastDeviceId: user.lastDeviceId }))
  },

  async updateStatus(id, actor, { status, reason = '' }) {
    const user = await userRepo.findById(id)
    if (!user) throw notFound('That user does not exist.')
    if (user.id === actor.id) throw forbidden('You cannot suspend your own account.')
    if (user.role === ROLES.ADMIN && user.status === 'active' && status === 'suspended' && await userRepo.countActiveAdmins() <= 1) {
      throw conflict('The last active administrator cannot be suspended.')
    }
    user.status = status
    user.statusReason = status === 'suspended' ? reason : ''
    const saved = await userRepo.save(user)
    const action = status === 'suspended' ? 'user.suspend' : 'user.reactivate'
    await auditService.record({ actor, action, targetType: 'user', targetId: saved.id, meta: status === 'suspended' ? { reason } : {} })
    return saved
  },

  /**
   * Admin deletion of an account. With `withRecordings` (C3) the contributor's recordings go
   * first; if any file can't be deleted the account is kept (409), so it is never removed with
   * recordings still in storage. Running it again retries what is left.
   *
   * Phase 7 item 5: the DeletionLog is written with accountDeleted false, and only marked true
   * once deleteAccount() has succeeded, so it never claims a deletion that did not happen.
   */
  async remove(id, actor, { withRecordings = false } = {}) {
    const user = await userRepo.findById(id)
    if (!user) throw notFound('That user does not exist.')
    if (user.id === actor.id) throw forbidden('You cannot delete your own account.')
    if (user.role === ROLES.ADMIN && user.status === 'active' && await userRepo.countActiveAdmins() <= 1) {
      throw conflict('The last active administrator cannot be deleted.')
    }
    let log = null
    if (withRecordings) {
      const result = await submissionService.removeRecordings(user._id, actor)
      if (result.failed.length) {
        throw conflict(`${result.failed.length} recording(s) could not be deleted from storage (${result.deleted} deleted), so the account was kept. Try again.`)
      }
      log = result.log
    }
    await deleteAccount(user, 'admin')
    // The account is gone; a failure to update the log must not turn that into an error.
    if (log) await attemptCleanup('mark the deletion log as account deleted', () => deletionLogRepo.markAccountDeleted(log._id), { logId: String(log._id) })
    await auditService.record({ actor, action: 'user.delete', targetType: 'user', targetId: user.id, meta: { withRecordings: Boolean(withRecordings) } })
  },

  async removeSelf(id, password) {
    const user = await userRepo.findById(id, { withPassword: true })
    if (!user) throw notFound('That user does not exist.')
    if (user.role !== ROLES.USER) throw forbidden('Administrators cannot delete their own account here.')
    if (!await bcrypt.compare(password, user.passwordHash)) throw unauthorized('The password does not match this account.')
    await deleteAccount(user, 'self')
  },
}
