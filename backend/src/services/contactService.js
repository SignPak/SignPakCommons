import { messageRepo } from '../repositories/messageRepo.js'

export const contactService = {
  send: ({ name, email, message }) => messageRepo.create({ name, email, message }),
  list: (limit) => messageRepo.list(limit),
}
