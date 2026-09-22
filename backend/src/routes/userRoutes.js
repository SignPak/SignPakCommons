import { Router } from 'express'
import { userController } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { validate } from '../middlewares/validate.js'
import { updateMeSchema } from '../middlewares/validators/userSchemas.js'

const router = Router()

router.use(authenticate)
router.get('/me', userController.me)
router.patch('/me', validate({ body: updateMeSchema }), userController.updateMe)

export default router
