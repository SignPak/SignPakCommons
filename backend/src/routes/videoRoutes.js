import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { videoController } from '../controllers/videoController.js'
import { authenticate, optionalAuthenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { uploadLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { idParams } from '../middlewares/validators/common.js'
import { createVideoSchema, updateVideoSchema } from '../middlewares/validators/videoSchemas.js'
import { videoUpload } from '../middlewares/upload.js'

const router = Router()
const adminOnly = [authenticate, requireRole(ROLES.ADMIN)]

// Metadata and posters: anonymous visitors see published videos only, admins see everything.
router.get('/', optionalAuthenticate, videoController.list)
router.get('/:id', optionalAuthenticate, validate({ params: idParams }), videoController.get)
router.get('/:id/poster', optionalAuthenticate, validate({ params: idParams }), videoController.poster)

// Published video files are public reference media; unpublished/admin media still requires visibility checks in the service.
router.get('/:id/file', optionalAuthenticate, validate({ params: idParams }), videoController.file)
router.get('/:id/file', authenticate, validate({ params: idParams }), videoController.file)

// Order matters: log in, check role, then accept the upload, then validate the text fields that came with it.
router.post('/', ...adminOnly, uploadLimiter, videoUpload, validate({ body: createVideoSchema }), videoController.create)
router.patch('/:id', ...adminOnly, validate({ params: idParams, body: updateVideoSchema }), videoController.update)
router.delete('/:id', ...adminOnly, validate({ params: idParams }), videoController.remove)

export default router
