import { expect, test } from '@playwright/test'
import { apiOrigin } from '../playwright.config.js'

/**
 * Smoke test for the whole sign-up flow: form -> emailed six-digit code -> consent -> library.
 *
 * The code is read from the test-only /__test/emails hook, which the capture email driver
 * fills in. That hook only exists because the E2E server sets NODE_ENV=test and
 * E2E_TEST_HOOKS=true; env.js refuses to boot with either in production.
 */

/** A fresh address per browser project and run, since the API keeps one database per run. */
const uniqueEmail = (project) => `e2e-${project}-${process.hrtime.bigint()}@example.com`

async function latestCode(request, email) {
  const response = await request.get(`${apiOrigin}/__test/emails`, {
    params: { to: email, purpose: 'email-verification' },
  })
  expect(response.status(), 'the test email hook must be mounted').toBe(200)
  const [newest] = (await response.json()).data
  expect(newest, `no verification code was captured for ${email}`).toBeTruthy()
  return newest.code
}

test('sign-up: form, emailed code, consent, then the library', async ({ page, request }, testInfo) => {
  const email = uniqueEmail(testInfo.project.name)

  await page.goto('/signup')
  await page.getByLabel('First name').fill('Sara')
  await page.getByLabel('Surname').fill('Ahmed')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('button', { name: /create account|sign up|create my account/i }).click()

  // The app sends the visitor to the verification page with the address pre-filled.
  await expect(page).toHaveURL(/\/verify-email/)
  await expect(page.getByLabel('Email address')).toHaveValue(email)

  await page.getByLabel('Six-digit code').fill(await latestCode(request, email))
  await page.getByRole('button', { name: 'Verify email' }).click()

  // Consent is what actually creates the account.
  await expect(page).toHaveURL(/\/signup\/consent/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Accept and create my account' }).click()

  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sara')
})
