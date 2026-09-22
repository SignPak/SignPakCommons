import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { optionalAuthenticate } from '../middlewares/authenticate.js'
import { authLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { loginSchema, signupSchema } from '../middlewares/validators/authSchemas.js'

const router = Router()

router.post('/signup', authLimiter, validate({ body: signupSchema }), authController.signup)
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login)
router.post('/logout', authController.logout)
router.get('/session', optionalAuthenticate, authController.session)

export default router
