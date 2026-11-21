import { Router } from 'express'
import { userController } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { authLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { changePasswordSchema } from '../middlewares/validators/authSchemas.js'
import { acceptConsentSchema, deleteAccountSchema, updateMeSchema } from '../middlewares/validators/userSchemas.js'

const router = Router()

router.use(authenticate)
router.get('/me', userController.me)
router.patch('/me', validate({ body: updateMeSchema }), userController.updateMe)
router.delete('/me', validate({ body: deleteAccountSchema }), userController.removeMe)
router.post('/me/consent', validate({ body: acceptConsentSchema }), userController.acceptConsent)
// Password change while logged in: ends every other session, keeps this one.
router.post('/me/password', authLimiter, validate({ body: changePasswordSchema }), userController.changePassword)

export default router
