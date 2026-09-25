import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { categoryController } from '../controllers/categoryController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validate } from '../middlewares/validate.js'
import { createCategorySchema, updateCategorySchema } from '../middlewares/validators/categorySchemas.js'
import { idParams } from '../middlewares/validators/common.js'

const router = Router()
const adminOnly = [authenticate, requireRole(ROLES.ADMIN)]

router.get('/', categoryController.list) // public: the landing page shows how many paths exist
router.post('/', ...adminOnly, validate({ body: createCategorySchema }), categoryController.create)
router.patch('/:id', ...adminOnly, validate({ params: idParams, body: updateCategorySchema }), categoryController.update)
router.delete('/:id', ...adminOnly, validate({ params: idParams }), categoryController.remove)

export default router
