import { contactService } from '../services/contactService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, ok } from '../utils/response.js'

export const contactController = {
  send: asyncHandler(async (req, res) => { await contactService.send(req.body); created(res, { received: true }) }),
  list: asyncHandler(async (req, res) => ok(res, await contactService.list(req.query.limit))),
}
