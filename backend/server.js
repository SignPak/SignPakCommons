import app from './src/app.js'
import { env } from './src/config/env.js'
import { initServices } from './src/services/initialization.js'
import { logger } from './src/utils/logger.js'

// Vercel serverless handler export
async function handler(req, res) {
  return app(req, res)
}

// Standalone execution (Railway / Docker / Local Node)
// Ignore process.env.VERCEL if running via direct `node server.js` command
const PORT = env.PORT || process.env.PORT || 5000

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`)
  console.log(`API SERVER LISTENING ON http://0.0.0.0:${PORT}`)
  console.log(`==================================================`)
})

// Trigger background initialization immediately after port binding
initServices().catch((error) => {
  console.error('[BOOT ERROR] Service initialization failed on boot:', error.message)
})

export default handler
