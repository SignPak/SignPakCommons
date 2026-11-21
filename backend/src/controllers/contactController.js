import { contactService } from '../services/contactService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, ok } from '../utils/response.js'

export const contactController = {
  send: asyncHandler(async (req, res) => {
    const result = await contactService.send(req.body, {
      user: req.user,
      ip: req.ip,
      deviceId: req.get('X-Device-ID')?.slice(0, 128),
    })
    created(res, result)
  }),
  verify: asyncHandler(async (req, res) => ok(res, await contactService.verify(req.params.id, req.body.code))),
  resend: asyncHandler(async (req, res) => ok(res, await contactService.resend(req.params.id), 202)),
  list: asyncHandler(async (req, res) => ok(res, await contactService.list(req.query))),
  setStatus: asyncHandler(async (req, res) => ok(res, await contactService.setStatus(req.params.id, req.body.status, req.user))),
}
