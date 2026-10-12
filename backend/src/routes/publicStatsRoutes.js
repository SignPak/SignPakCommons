import { Router } from 'express'
import { publicStatsController } from '../controllers/publicStatsController.js'

const router = Router()

router.get('/stats', publicStatsController.get)

export default router
