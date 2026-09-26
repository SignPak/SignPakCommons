import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { demoVideoController } from '../controllers/demoVideoController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { uploadLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { demoVideoUpload } from '../middlewares/upload.js'
import { uploadDemoVideoSchema } from '../middlewares/validators/demoVideoSchemas.js'

const router = Router()
const adminOnly = [authenticate, requireRole(ROLES.ADMIN)]

router.get('/', demoVideoController.get)
router.get('/file', demoVideoController.file)
router.post('/', ...adminOnly, uploadLimiter, demoVideoUpload, validate({ body: uploadDemoVideoSchema }), demoVideoController.upload)
router.delete('/', ...adminOnly, demoVideoController.remove)

export default router
