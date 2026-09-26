import { authService } from '../services/authService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { created, noContent, ok } from '../utils/response.js'
import { clearAuthCookie, setAuthCookie } from '../utils/tokens.js'

export const authController = {
  signup: asyncHandler(async (req, res) => {
    created(res, await authService.register(req.body))
  }),

  login: asyncHandler(async (req, res) => {
    const { user, token } = await authService.login(req.body)
    await authService.recordDevice(user, req.get('X-Device-ID'))
    setAuthCookie(res, token)
    ok(res, user)
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const { user, token } = await authService.verifyEmail(req.body)
    await authService.recordDevice(user, req.get('X-Device-ID'))
    setAuthCookie(res, token)
    ok(res, user)
  }),

  resendVerification: asyncHandler(async (req, res) => {
    await authService.resendVerification(req.body.email)
    ok(res, { message: 'If the account needs verification, a code will be sent.' })
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.requestPasswordReset(req.body.email)
    ok(res, { message: 'If an account exists for this email, a reset code will be sent.' })
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body)
    ok(res, { message: 'Password reset. You can now log in.' })
  }),

  logout: (req, res) => {
    clearAuthCookie(res)
    noContent(res)
  },

  // Answers 200 with null for visitors, so the app can ask "who am I?" on load without an error.
  session: (req, res) => ok(res, req.user),
}
