import { Router } from 'express'
import { submissionController } from '../controllers/submissionController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { uploadLimiter } from '../middlewares/rateLimiter.js'
import { recordingUpload } from '../middlewares/upload.js'
import { validate } from '../middlewares/validate.js'
import { createSubmissionSchema } from '../middlewares/validators/submissionSchemas.js'

const router = Router()

router.use(authenticate)
router.get('/', submissionController.list)
router.post('/', uploadLimiter, recordingUpload, validate({ body: createSubmissionSchema }), submissionController.create)

// No read, PATCH, or DELETE route exists: archived submissions are append-only.

export default router
