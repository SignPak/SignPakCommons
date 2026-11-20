// Imported first by a test file that needs Express to trust one proxy hop, as it does behind
// Nginx in production. Must run before anything imports src/config/env.js.
process.env.TRUST_PROXY = 'true'
