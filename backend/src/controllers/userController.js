import { userService } from '../services/userService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { noContent, ok } from '../utils/response.js'
import { authService } from '../services/authService.js'
import { clearAuthCookie, setAuthCookie } from '../utils/tokens.js'

export const userController = {
  me: (req, res) => ok(res, req.user),
  updateMe: asyncHandler(async (req, res) => ok(res, await userService.updateConnections(req.user, req.body.connections))),
  acceptConsent: asyncHandler(async (req, res) => ok(res, await userService.acceptConsent(req.user, req.body.version))),
  removeMe: asyncHandler(async (req, res) => {
    await userService.removeSelf(req.user.id, req.body.password)
    clearAuthCookie(res)
    noContent(res)
  }),
  changePassword: asyncHandler(async (req, res) => {
    setAuthCookie(res, await authService.changePassword(req.user, req.body))
    noContent(res)
  }),
  list: asyncHandler(async (req, res) => ok(res, await userService.listAll(req.query))),
  updateStatus: asyncHandler(async (req, res) => ok(res, await userService.updateStatus(req.params.id, req.user, req.body))),
  remove: asyncHandler(async (req, res) => { await userService.remove(req.params.id, req.user, req.query); noContent(res) }),
}
