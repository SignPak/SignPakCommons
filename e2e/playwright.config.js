import { defineConfig, devices } from '@playwright/test'

/**
 * Three servers, all started by Playwright:
 *   - the API from backend/scripts/e2e-server.js (in-memory MongoDB, local storage,
 *     capture email driver, /__test/emails enabled)
 *   - the production frontend build served by `vite preview`, which proxies /api to the API
 *     so most specs run on one origin;
 *   - a second build, pointed at the API's own hostname (VITE_API_ORIGIN), served on
 *     commons.localtest.me: the production layout of D2 (site and API on two hosts of one
 *     site), used by tests/cross-host-cookie.spec.js.
 */

const API_PORT = Number(process.env.E2E_API_PORT || 5099)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4173)

const CROSS_HOST_WEB_PORT = Number(process.env.E2E_CROSS_HOST_WEB_PORT || 4174)

export const apiOrigin = `http://127.0.0.1:${API_PORT}`
export const webOrigin = `http://127.0.0.1:${WEB_PORT}`

// api.localtest.me and commons.localtest.me resolve to this machine (127.0.0.1 and ::1), and
// localtest.me is not on the Public Suffix List, so they are two hosts of one site, like
// api.commons.signpak.tech and commons.signpak.tech. The servers listen on both IPv4 and IPv6 loopback.
export const crossHost = {
  apiHostname: 'api.localtest.me',
  api: `http://api.localtest.me:${API_PORT}`,
  site: `http://commons.localtest.me:${CROSS_HOST_WEB_PORT}`,
  // The same build reached by IP: a different *site* from api.localtest.me whose CSP still
  // allows connecting to it (the C4 negative control in cross-host-cookie.spec.js).
  otherSite: `http://127.0.0.1:${CROSS_HOST_WEB_PORT}`,
}

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false, // one API with one database: tests share server state
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],

  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // A fake camera, so recording flows can run unattended (used from Phase 2 on).
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: '../backend',
      url: `${apiOrigin}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000, // first run may start a fresh in-memory MongoDB
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        E2E_API_PORT: String(API_PORT),
        E2E_API_HOST: '::', // dual-stack: localtest.me also resolves to ::1
        E2E_CLIENT_ORIGIN: `${webOrigin},http://localhost:${WEB_PORT},${crossHost.site},${crossHost.otherSite}`,
      },
    },
    {
      command: `npm run build && npm run preview -- --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      cwd: '../frontend',
      url: webOrigin,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { E2E_API_PORT: String(API_PORT) },
    },
    {
      // Separate output folder so it never collides with the build above.
      command: `npx vite build --outDir dist-crosshost --emptyOutDir --logLevel warn && npx vite preview --outDir dist-crosshost --port ${CROSS_HOST_WEB_PORT} --strictPort --host ::`,
      cwd: '../frontend',
      url: `http://127.0.0.1:${CROSS_HOST_WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { VITE_API_ORIGIN: crossHost.api, E2E_API_PORT: String(API_PORT) },
    },
  ],
})
