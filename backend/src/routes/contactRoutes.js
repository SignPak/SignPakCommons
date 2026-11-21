import { Router } from 'express'
import { optionalAuthenticate } from '../middlewares/authenticate.js'
import { contactController } from '../controllers/contactController.js'
import { contactCodeLimiter, contactLimiter } from '../middlewares/rateLimiter.js'
import { validate } from '../middlewares/validate.js'
import { idParams } from '../middlewares/validators/common.js'
import { contactCodeSchema, contactSchema } from '../middlewares/validators/miscSchemas.js'

const router = Router()

router.post('/', contactLimiter, optionalAuthenticate, validate({ body: contactSchema }), contactController.send)
// D4: confirming a signed-out deletion request. Open to everyone; the message id and the
// emailed code are the proof, and both answers are the same whether or not an account exists.
router.post('/:id/verify', contactCodeLimiter, validate({ params: idParams, body: contactCodeSchema }), contactController.verify)
router.post('/:id/resend', contactCodeLimiter, validate({ params: idParams }), contactController.resend)

export default router
