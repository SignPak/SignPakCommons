import { ROLES } from '../config/constants.js'
import { userRepo } from '../repositories/userRepo.js'

export const userService = {
  async updateConnections(user, connections) {
    // Only keys that were sent change; null disconnects.
    for (const key of ['github', 'linkedin']) {
      if (key in connections) user.connections[key] = connections[key]
    }
    return userRepo.save(user)
  },

  listLearners: () => userRepo.list({ role: ROLES.USER }),
  listAll: () => userRepo.list(),
}
