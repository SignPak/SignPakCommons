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
