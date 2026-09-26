import { ROLES } from '../config/constants.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { storageService } from './storage/index.js'
import { conflict, forbidden, notFound } from '../utils/AppError.js'

export const userService = {
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
    return userRepo.save(user)
  },

  async remove(id, actor) {
    const user = await userRepo.findById(id)
    if (!user) throw notFound('That user does not exist.')
    if (user.id === actor.id) throw forbidden('You cannot delete your own account.')
    if (user.role === ROLES.ADMIN && user.status === 'active' && await userRepo.countActiveAdmins() <= 1) {
      throw conflict('The last active administrator cannot be deleted.')
    }
    const recordings = await submissionRepo.removeForUser(user._id)
    await userRepo.remove(user._id)
    await Promise.all(recordings.map((recording) => storageService.remove(recording)))
  },
}
