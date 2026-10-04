import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { randomUUID } from 'node:crypto'
import pinoHttp from 'pino-http'
import { API_PREFIX } from './config/constants.js'
import { env } from './config/env.js'
import { openapi } from './docs/openapi.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { enforceAccessRestrictions } from './middlewares/enforceAccessRestrictions.js'
import { ensureServicesInitialized } from './services/initialization.js'
import { apiLimiter } from './middlewares/rateLimiter.js'
import { verifyOrigin } from './middlewares/verifyOrigin.js'
import routes from './routes/index.js'
import { logger } from './utils/logger.js'
import swaggerUi from 'swagger-ui-express'

const app = express()

app.disable('x-powered-by')
if (env.TRUST_PROXY) app.set('trust proxy', 1) // needed behind nginx/Render/Railway so rate limits see real IPs

app.use(ensureServicesInitialized)

// Request logging with an id that is also sent back, so a support report can be matched to a log line.
app.use(pinoHttp({
  logger,
  genReqId: (req, res) => { const id = req.headers['x-request-id'] || randomUUID(); res.setHeader('X-Request-Id', id); return id },
  autoLogging: { ignore: (req) => req.url.endsWith('/health') },
  customLogLevel: (req, res, error) => (error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
}))

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: env.clientOrigins, credentials: true }))
app.use(compression())
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.get('/', (req, res) => res.json({ data: {
  name: 'SignPak Commons API',
  api: API_PREFIX,
  health: `${API_PREFIX}/health`,
  docs: env.isProduction ? `${API_PREFIX}/docs.json` : '/docs',
} }))
app.get('/favicon.ico', (req, res) => res.status(204).end())
// The raw OpenAPI JSON has no filesystem dependency, so it stays available in every
// environment; only the interactive Swagger UI (below) is gated out of production.
app.get('/docs.json', (req, res) => res.json(openapi))
app.get('/api-docs.json', (req, res) => res.json(openapi))
if (!env.isProduction) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }))
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }))
}

app.use(API_PREFIX, apiLimiter, verifyOrigin, enforceAccessRestrictions, routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
