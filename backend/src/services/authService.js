import bcrypt from 'bcrypt'
import { ROLES } from '../config/constants.js'
import { env } from '../config/env.js'
import { userRepo } from '../repositories/userRepo.js'
import { conflict, unauthorized } from '../utils/AppError.js'
import { logger } from '../utils/logger.js'
import { isDuplicateKeyError } from '../utils/mongoose.js'
import { signToken } from '../utils/tokens.js'

// Compared against when the email is unknown, so "no such user" takes as long as "wrong password".
const DUMMY_HASH = bcrypt.hashSync('signpak-timing-guard', env.BCRYPT_ROUNDS)

const emailTaken = () => conflict('An account with this email already exists. Log in instead.', { email: 'An account with this email already exists.' })

export const authService = {
  async register({ email, firstName, surname, password }) {
    if (await userRepo.findByEmail(email)) throw emailTaken()
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS)
    try {
      // `role` is never read from the request: everyone who signs up is a contributor.
      const user = await userRepo.create({ email, firstName, surname, passwordHash, role: ROLES.USER })
      return { user, token: signToken(user.id) }
    } catch (error) {
      if (isDuplicateKeyError(error)) throw emailTaken() // two signups racing for the same email
      throw error
    }
  },

  async login({ email, password }) {
    const user = await userRepo.findByEmail(email, { withPassword: true })
    const matches = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
    if (!user || !matches) throw unauthorized('That email and password do not match. Check them and try again.')
    return { user, token: signToken(user.id) }
  },

  /** Admin accounts come from environment variables, never from the signup form. Safe to run on every boot. */
  async ensureAdminFromEnv() {
    const existing = await userRepo.findByEmail(env.ADMIN_EMAIL)
    if (!existing) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS)
      await userRepo.create({ email: env.ADMIN_EMAIL, firstName: env.ADMIN_FIRST_NAME, surname: env.ADMIN_SURNAME, passwordHash, role: ROLES.ADMIN })
      logger.info({ email: env.ADMIN_EMAIL }, 'Admin account created from environment')
    } else if (existing.role !== ROLES.ADMIN) {
      existing.role = ROLES.ADMIN
      await userRepo.save(existing)
      logger.info({ email: env.ADMIN_EMAIL }, 'Existing account promoted to admin from environment')
    }
    // An existing admin's password is intentionally left alone; changing ADMIN_PASSWORD later does not reset it.
  },
}
