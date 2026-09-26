import { authService } from '../services/authService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'
import { clearAuthCookie, setAuthCookie } from '../utils/tokens.js'

export const authController = {
  signup: asyncHandler(async (req, res) => {
    const { user, token } = await authService.register(req.body)
    await authService.recordDevice(user, req.get('X-Device-ID'))
    setAuthCookie(res, token)
    created(res, user)
  }),

  login: asyncHandler(async (req, res) => {
    const { user, token } = await authService.login(req.body)
    await authService.recordDevice(user, req.get('X-Device-ID'))
    setAuthCookie(res, token)
    ok(res, user)
  }),

  logout: (req, res) => {
    clearAuthCookie(res)
    noContent(res)
  },

  // Answers 200 with null for visitors, so the app can ask "who am I?" on load without an error.
  session: (req, res) => ok(res, req.user),
}
