import { Router } from 'express'
import { isDbReady } from '../config/db.js'
import adminRoutes from './adminRoutes.js'
import authRoutes from './authRoutes.js'
import categoryRoutes from './categoryRoutes.js'
import contactRoutes from './contactRoutes.js'
import submissionRoutes from './submissionRoutes.js'
import userRoutes from './userRoutes.js'
import videoRoutes from './videoRoutes.js'

const router = Router()

router.get('/health', (req, res) => {
  const db = isDbReady()
  res.status(db ? 200 : 503).json({ data: { status: db ? 'ok' : 'degraded', database: db ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) } })
})

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/categories', categoryRoutes)
router.use('/videos', videoRoutes)
router.use('/submissions', submissionRoutes)
router.use('/contact', contactRoutes)
router.use('/admin', adminRoutes)

export default router
