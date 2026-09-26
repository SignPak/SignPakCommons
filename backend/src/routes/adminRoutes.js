import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { adminController } from '../controllers/adminController.js'
import { accessRestrictionController } from '../controllers/accessRestrictionController.js'
import { contactController } from '../controllers/contactController.js'
import { userController } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validate } from '../middlewares/validate.js'
import { limitQuerySchema, statsQuerySchema } from '../middlewares/validators/miscSchemas.js'
import { accessRestrictionSchema, updateUserStatusSchema } from '../middlewares/validators/adminSchemas.js'
import { idParams } from '../middlewares/validators/common.js'

const router = Router()

router.use(authenticate, requireRole(ROLES.ADMIN))
router.get('/users', userController.list)
router.patch('/users/:id', validate({ params: idParams, body: updateUserStatusSchema }), userController.updateStatus)
router.delete('/users/:id', validate({ params: idParams }), userController.remove)
router.get('/restrictions', accessRestrictionController.list)
router.post('/restrictions', validate({ body: accessRestrictionSchema }), accessRestrictionController.create)
router.delete('/restrictions/:id', validate({ params: idParams }), accessRestrictionController.remove)
router.get('/stats', validate({ query: statsQuerySchema }), adminController.stats)
router.get('/messages', validate({ query: limitQuerySchema }), contactController.list)

export default router
