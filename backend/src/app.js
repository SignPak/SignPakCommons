import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
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
import testHookRoutes from './routes/testHooks.js'
import { logger } from './utils/logger.js'
import { requestIdFrom } from './utils/requestId.js'
import { requestLogProps, requestLogSerializer } from './utils/requestLog.js'
import swaggerUi from 'swagger-ui-express'

const app = express()

app.disable('x-powered-by')
// Behind Nginx (deploy/nginx/api.conf) every request comes from 127.0.0.1; trusting exactly one
// proxy hop makes req.ip the visitor's address from X-Forwarded-For (S3). Never trust more hops.
if (env.TRUST_PROXY) app.set('trust proxy', 1)

app.use(ensureServicesInitialized)

// Request logging with an id that is also sent back, so a support report can be matched to a log line.
app.use(pinoHttp({
  logger,
  // S10: a caller's X-Request-Id is kept only if it is 1-64 letters, digits or hyphens.
  genReqId: (req, res) => { const id = requestIdFrom(req.headers['x-request-id']); res.setHeader('X-Request-Id', id); return id },
  autoLogging: { ignore: (req) => req.url.endsWith('/health') },
  customProps: requestLogProps, // the visitor's IP (req.ip), not the proxy's socket address
  serializers: { req: requestLogSerializer }, // no email address in logged URLs (C3)
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

// Playwright needs to read the codes the capture email driver "sent". Both conditions are
// required, and env.js refuses to start if either is set in production, so this cannot ship.
if (env.isTest && env.E2E_TEST_HOOKS) app.use('/__test', testHookRoutes)

app.use(API_PREFIX, apiLimiter, verifyOrigin, enforceAccessRestrictions, routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
