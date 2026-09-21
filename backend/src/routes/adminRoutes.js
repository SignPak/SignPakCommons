import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { adminController } from '../controllers/adminController.js'
import { contactController } from '../controllers/contactController.js'
import { userController } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validate } from '../middlewares/validate.js'
import { limitQuerySchema, statsQuerySchema } from '../middlewares/validators/miscSchemas.js'

const router = Router()

router.use(authenticate, requireRole(ROLES.ADMIN))
router.get('/users', userController.list)
router.get('/stats', validate({ query: statsQuerySchema }), adminController.stats)
router.get('/messages', validate({ query: limitQuerySchema }), contactController.list)

export default router
