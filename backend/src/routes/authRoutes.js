import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { optionalAuthenticate } from '../middlewares/authenticate.js'
import { authLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { emailOnlySchema, loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from '../middlewares/validators/authSchemas.js'

const router = Router()

router.post('/signup', authLimiter, validate({ body: signupSchema }), authController.signup)
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login)
router.post('/verify-email', authLimiter, validate({ body: verifyEmailSchema }), authController.verifyEmail)
router.post('/resend-verification', authLimiter, validate({ body: emailOnlySchema }), authController.resendVerification)
router.post('/forgot-password', authLimiter, validate({ body: emailOnlySchema }), authController.forgotPassword)
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), authController.resetPassword)
router.post('/logout', authController.logout)
router.get('/session', optionalAuthenticate, authController.session)

export default router
