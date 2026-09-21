import { userService } from '../services/userService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ok } from '../utils/response.js'

export const userController = {
  me: (req, res) => ok(res, req.user),
  updateMe: asyncHandler(async (req, res) => ok(res, await userService.updateConnections(req.user, req.body.connections))),
  list: asyncHandler(async (req, res) => ok(res, await userService.listAll())),
}
