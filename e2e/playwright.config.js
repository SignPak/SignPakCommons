import { defineConfig, devices } from '@playwright/test'

/**
 * Two servers, both started by Playwright:
 *   - the API from backend/scripts/e2e-server.js (in-memory MongoDB, local storage,
 *     capture email driver, /__test/emails enabled)
 *   - the production frontend build served by `vite preview`, which proxies /api to the API
 *     so the site and the API share one origin and the session cookie behaves identically in
 *     Chromium, Firefox and WebKit. (Phase 1 adds the deliberate cross-hostname cookie test.)
 */

const API_PORT = Number(process.env.E2E_API_PORT || 5099)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4173)

export const apiOrigin = `http://127.0.0.1:${API_PORT}`
export const webOrigin = `http://127.0.0.1:${WEB_PORT}`

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
      env: { E2E_API_PORT: String(API_PORT), E2E_CLIENT_ORIGIN: `${webOrigin},http://localhost:${WEB_PORT}` },
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
  ],
})
