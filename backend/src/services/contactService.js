import { env } from '../config/env.js'
import { contactQuotaRepo } from '../repositories/contactQuotaRepo.js'
import { messageRepo } from '../repositories/messageRepo.js'
import { accessRestrictionService } from './accessRestrictionService.js'
import { sendContactWeb3Forms } from './external/sendContactWeb3Forms.js'
import { conflict, forbidden, tooManyRequests } from '../utils/AppError.js'

const utcDay = () => new Date().toISOString().slice(0, 10)
const dailyLimitError = () => tooManyRequests('The contact form has reached its daily message limit. Try again tomorrow.')

export const contactService = {
  deliver: sendContactWeb3Forms,

  async send({ name, email, message }, { user, ip, deviceId }) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!user || normalizedEmail !== user.email) {
      await accessRestrictionService.temporarilyRestrictRequest(
        ip,
        deviceId,
        user ? 'Contact form email does not match the signed-in account.' : 'Anonymous contact form submission.',
        env.CONTACT_ABUSE_BLOCK_MINUTES * 60_000,
      )
      throw forbidden(user ? 'Use the email address on your account to contact us.' : 'Log in with a verified account to contact us.')
    }

    const day = utcDay()
    const userClaimed = await contactQuotaRepo.claimUser(user._id, day)
    if (!userClaimed) throw conflict('You can send one contact message per day.')

    let dailyClaimed = false
    let savedMessage
    try {
      dailyClaimed = await contactQuotaRepo.claimDaily(day, env.CONTACT_DAILY_LIMIT)
      if (!dailyClaimed) {
        await accessRestrictionService.temporarilyRestrictRequest(
          ip,
          deviceId,
          'Daily contact message limit exceeded.',
          env.CONTACT_ABUSE_BLOCK_MINUTES * 60_000,
        )
        throw dailyLimitError()
      }

      savedMessage = await messageRepo.create({ user: user._id, name, email: normalizedEmail, message })
      await this.deliver({ name, email: normalizedEmail, message })
      return savedMessage
    } catch (error) {
      if (savedMessage) await messageRepo.remove(savedMessage._id).catch(() => {})
      if (dailyClaimed) await contactQuotaRepo.releaseDaily(day)
      await contactQuotaRepo.releaseUser(user._id, day)
      throw error
    }
  },

  list: (limit) => messageRepo.list(limit),
}
