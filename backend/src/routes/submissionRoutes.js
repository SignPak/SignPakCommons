import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { submissionController } from '../controllers/submissionController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { uploadLimiter } from '../middlewares/rateLimiter.js'
import { requireRole } from '../middlewares/requireRole.js'
import { recordingUpload } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { idParams } from '../middlewares/validators/common.js'
import { createSubmissionSchema } from '../middlewares/validators/submissionSchemas.js'

const router = Router()

router.use(authenticate)
router.get('/', submissionController.list)
router.post('/', uploadLimiter, recordingUpload, validate({ body: createSubmissionSchema }), submissionController.create)

// No PATCH or DELETE exists on purpose: a submission cannot be changed or taken back.
router.get('/:id/recording', requireRole(ROLES.ADMIN), validate({ params: idParams }), submissionController.recording)

export default router
