import { Router } from 'express'
import { listCapturedEmails } from '../services/email/index.js'
import { ok } from '../utils/response.js'

/**
 * Test-only hooks for the Playwright suite, so a browser test can read the six-digit code
 * that a sign-up or password reset just "sent". Mounted by app.js only when NODE_ENV=test
 * and E2E_TEST_HOOKS=true; env.js refuses to start if either is set in production.
 */
const router = Router()

router.get('/emails', (req, res) => {
  const to = typeof req.query.to === 'string' ? req.query.to : undefined
  const purpose = typeof req.query.purpose === 'string' ? req.query.purpose : undefined
  ok(res, listCapturedEmails({ to, purpose }))
})

export default router
