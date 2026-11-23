import { expect } from '@playwright/test'
import { apiOrigin } from '../playwright.config.js'

/** A fresh address per browser project and run, since the API keeps one database per run. */
export const uniqueEmail = (label) => `e2e-${label}-${process.hrtime.bigint()}@example.com`

/**
 * The newest six-digit code the capture email driver recorded for `email`. Read through the
 * test-only /__test/emails hook, which exists only because the E2E API runs with
 * NODE_ENV=test and E2E_TEST_HOOKS=true (env.js refuses both in production).
 */
export async function latestCode(request, email, purpose = 'email-verification') {
  const response = await request.get(`${apiOrigin}/__test/emails`, { params: { to: email, purpose } })
  expect(response.status(), 'the test email hook must be mounted').toBe(200)
  const [newest] = (await response.json()).data
  expect(newest, `no ${purpose} code was captured for ${email}`).toBeTruthy()
  return newest.code
}

/**
 * Sign-up through the real UI: form -> emailed code -> consent -> library.
 * `site` is the origin to drive (defaults to the page's baseURL).
 */
export async function signUpThroughUi(page, request, { email, password = 'password1', firstName = 'Sara', surname = 'Ahmed', site = '' }) {
  await page.goto(`${site}/signup`)
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel('Surname').fill(surname)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // The app sends the visitor to the verification page with the address pre-filled.
  await expect(page).toHaveURL(/\/verify-email/)
  await expect(page.getByLabel('Email address')).toHaveValue(email)

  await page.getByLabel('Six-digit code').fill(await latestCode(request, email))
  // B3 (Phase 6): the password chosen at sign-up goes with the code.
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Verify email' }).click()

  // Consent is what actually creates the account and starts the session.
  await expect(page).toHaveURL(/\/signup\/consent/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Accept and create my account' }).click()

  await expectInLibrary(page, firstName)
}

/** The signed-in library greets the contributor by first name. */
export async function expectInLibrary(page, firstName = 'Sara') {
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(firstName)
}

/** The seeded admin of the E2E API (backend/scripts/e2e-server.js). */
export const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345' }

/** A few kilobytes that pass the API's WebM signature check; enough for API-level uploads. */
export const tinyWebm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 7)])

/** An API request context signed in as `account` (the seeded admin by default). Dispose it after use. */
export async function apiSession(playwright, account = ADMIN) {
  const session = await playwright.request.newContext({ baseURL: apiOrigin })
  const response = await session.post('/api/v1/auth/login', { data: account })
  expect(response.status(), await response.text()).toBe(200)
  return session
}

/** A category of its own with one published reference video, so a test's data stays separate. */
export async function publishedVideo(playwright, label) {
  const admin = await apiSession(playwright)
  const category = await admin.post('/api/v1/categories', { data: { label: `E2E ${label}`, tone: 'yellow' } })
  expect(category.status(), await category.text()).toBe(201)
  const categoryId = (await category.json()).data.id
  const made = await admin.post('/api/v1/videos', {
    multipart: { title: `Greeting ${label}`, categoryId, durationSec: '3', status: 'published', video: { name: 'video.webm', mimeType: 'video/webm', buffer: tinyWebm() } },
  })
  expect(made.status(), await made.text()).toBe(201)
  const video = (await made.json()).data
  await admin.dispose()
  return { categoryId, video }
}

/**
 * Logs in through the form. Waits for the login page itself first: pages load lazily, and React
 * keeps the previous page on screen until the next one has loaded (Phase 9).
 */
export async function logInThroughUi(page, { email, password }) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
}
