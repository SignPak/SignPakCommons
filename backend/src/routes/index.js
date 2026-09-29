import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { isDbReady } from '../config/db.js'
import { env } from '../config/env.js'
import { openapi } from '../docs/openapi.js'
import adminRoutes from './adminRoutes.js'
import authRoutes from './authRoutes.js'
import categoryRoutes from './categoryRoutes.js'
import contactRoutes from './contactRoutes.js'
import demoVideoRoutes from './demoVideoRoutes.js'
import submissionRoutes from './submissionRoutes.js'
import userRoutes from './userRoutes.js'
import videoRoutes from './videoRoutes.js'

const router = Router()

router.get('/health', (req, res) => {
  const db = isDbReady()
  res.status(db ? 200 : 503).json({ data: { status: db ? 'ok' : 'degraded', database: db ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) } })
})

router.get('/docs.json', (req, res) => res.json(openapi))
// Kept out of production: swagger-ui-express serves bundled static assets from disk, and
// exposing the full interactive API surface publicly isn't worth it once this is live.
// /docs.json above still works everywhere for tooling that needs the raw spec.
if (!env.isProduction) {
  router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }))
}

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/categories', categoryRoutes)
router.use('/demo-video', demoVideoRoutes)
router.use('/videos', videoRoutes)
router.use('/submissions', submissionRoutes)
router.use('/contact', contactRoutes)
router.use('/admin', adminRoutes)

export default router
