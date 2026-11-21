import { Router } from 'express'
import { ROLES } from '../config/constants.js'
import { adminController } from '../controllers/adminController.js'
import { accessRestrictionController } from '../controllers/accessRestrictionController.js'
import { contactController } from '../controllers/contactController.js'
import { userController } from '../controllers/userController.js'
import { authenticate } from '../middlewares/authenticate.js'
import { requireRole } from '../middlewares/requireRole.js'
import { validate } from '../middlewares/validate.js'
import { statsQuerySchema } from '../middlewares/validators/miscSchemas.js'
import {
  accessRestrictionSchema,
  adminSubmissionsQuerySchema,
  auditQuerySchema,
  exportSubmissionsQuerySchema,
  deletionLookupQuerySchema,
  messageStatusSchema,
  messagesQuerySchema,
  removeSubmissionsQuerySchema,
  removeUserQuerySchema,
  updateUserStatusSchema,
  userSubmissionsQuerySchema,
  usersQuerySchema,
} from '../middlewares/validators/adminSchemas.js'
import { idParams } from '../middlewares/validators/common.js'

const router = Router()

router.use(authenticate, requireRole(ROLES.ADMIN))
router.get('/users', validate({ query: usersQuerySchema }), userController.list)
router.patch('/users/:id', validate({ params: idParams, body: updateUserStatusSchema }), userController.updateStatus)
router.delete('/users/:id', validate({ params: idParams, query: removeUserQuerySchema }), userController.remove)
// C3: a contributor's recordings, and deleting them for a deletion request.
router.get('/users/:id/submissions', validate({ params: idParams, query: userSubmissionsQuerySchema }), adminController.userSubmissions)
router.delete('/users/:id/submissions', validate({ params: idParams, query: removeSubmissionsQuerySchema }), adminController.removeUserSubmissions)
router.get('/deletion-lookup', validate({ query: deletionLookupQuerySchema }), adminController.deletionLookup)
router.get('/restrictions', accessRestrictionController.list)
router.post('/restrictions', validate({ body: accessRestrictionSchema }), accessRestrictionController.create)
router.delete('/restrictions/:id', validate({ params: idParams }), accessRestrictionController.remove)
router.get('/stats', validate({ query: statsQuerySchema }), adminController.stats)
// B5: every submission, filtered and a page at a time, and the streamed export for the ML team.
router.get('/submissions', validate({ query: adminSubmissionsQuerySchema }), adminController.submissions)
router.get('/submissions/export', validate({ query: exportSubmissionsQuerySchema }), adminController.exportSubmissions)
// S7: who did what, and when.
router.get('/audit', validate({ query: auditQuerySchema }), adminController.audit)
router.get('/messages', validate({ query: messagesQuerySchema }), contactController.list)
router.patch('/messages/:id', validate({ params: idParams, body: messageStatusSchema }), contactController.setStatus)

export default router
