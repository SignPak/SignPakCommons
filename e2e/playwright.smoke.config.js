import { defineConfig } from '@playwright/test'
import base, { webOrigin } from './playwright.config.js'

/**
 * The @smoke subset against any site (FIX-PLAN Phase 10 item 4). Run it through
 * `npm run e2e:smoke -- --base-url=<url>` (scripts/smoke.js), which sets SMOKE_BASE_URL and
 * checks the credentials first.
 *
 * A local URL starts the same local stack as the full suite; any other URL is used as it is,
 * with no local servers and no retries (a production failure should be seen, not retried away).
 */

const baseURL = process.env.SMOKE_BASE_URL || webOrigin
const local = new URL(baseURL).hostname === '127.0.0.1' || new URL(baseURL).hostname === 'localhost'

export default defineConfig({
  ...base,
  grep: /@smoke/,
  retries: 0,
  outputDir: './test-results-smoke',
  use: { ...base.use, baseURL },
  webServer: local ? base.webServer : undefined,
})
