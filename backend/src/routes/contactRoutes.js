import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/authenticate.js'
import { contactController } from '../controllers/contactController.js'
import { contactLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { contactSchema } from '../middlewares/validators/miscSchemas.js'

const router = Router()

router.post('/', contactLimiter, optionalAuthenticate, validate({ body: contactSchema }), contactController.send)

export default router
