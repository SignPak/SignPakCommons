import { userService } from '../services/userService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { noContent, ok } from '../utils/response.js'

export const userController = {
  me: (req, res) => ok(res, req.user),
  updateMe: asyncHandler(async (req, res) => ok(res, await userService.updateConnections(req.user, req.body.connections))),
  list: asyncHandler(async (req, res) => ok(res, await userService.listAll())),
  updateStatus: asyncHandler(async (req, res) => ok(res, await userService.updateStatus(req.params.id, req.user, req.body))),
  remove: asyncHandler(async (req, res) => { await userService.remove(req.params.id, req.user); noContent(res) }),
}
