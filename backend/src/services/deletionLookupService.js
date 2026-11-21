import { deletedAccountRepo } from '../repositories/deletionRepo.js'
import { messageRepo } from '../repositories/messageRepo.js'
import { submissionRepo } from '../repositories/submissionRepo.js'
import { userRepo } from '../repositories/userRepo.js'
import { notFound } from '../utils/AppError.js'
import { hashEmail } from '../utils/emailHash.js'

/**
 * C3: finds whose recordings a deletion request is about. The email (given, or taken from the
 * contact message) is matched against the current accounts and, through its keyed hash,
 * against deleted accounts, whose recordings stay until a deletion request removes them. Both
 * can match: someone who deleted their account and later signed up again.
 */
export const deletionLookupService = {
  async find({ email, messageId }) {
    if (messageId) {
      const message = await messageRepo.findById(messageId)
      if (!message) throw notFound('That message does not exist.')
      email = message.email
    }
    const [user, deleted] = await Promise.all([
      userRepo.findByEmail(email),
      deletedAccountRepo.findByEmailHash(hashEmail(email)),
    ])

    const matches = []
    if (user) {
      matches.push({
        kind: 'user',
        userId: user.id,
        name: `${user.firstName} ${user.surname}`,
        email: user.email,
        role: user.role,
        status: user.status,
        submissionCount: await submissionRepo.countForUser(user._id),
      })
    }
    for (const account of deleted) {
      matches.push({
        kind: 'deleted',
        userId: String(account.userId),
        deletedAt: account.deletedAt,
        deletedBy: account.by,
        submissionCount: await submissionRepo.countForUser(account.userId),
      })
    }
    return { matches }
  },
}
