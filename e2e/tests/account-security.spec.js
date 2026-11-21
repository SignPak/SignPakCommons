import { expect, routeThirdParty, test } from '../support/test.js'
import { apiOrigin } from '../playwright.config.js'
import { expectInLibrary, latestCode, signUpThroughUi, uniqueEmail } from '../support/flows.js'

/** Phase 6: account lockout (S2), a password reset ending other sessions (S6), consent reload (B4). */

/** The reset code is emailed after the API answers, so wait for it to be captured. */
async function resetCode(request, email) {
  let code
  await expect.poll(async () => {
    const response = await request.get(`${apiOrigin}/__test/emails`, { params: { to: email, purpose: 'password-reset' } })
    code = (await response.json()).data[0]?.code
    return code
  }, { message: `no password-reset code was captured for ${email}` }).toMatch(/^\d{6}$/)
  return code
}

async function logIn(page, email, password) {
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
}

test('S2: five wrong passwords lock the account, and the right one is refused until the lock passes', async ({ page, request }, testInfo) => {
  const email = uniqueEmail(`lockout-${testInfo.project.name}`)
  await signUpThroughUi(page, request, { email })
  await page.context().clearCookies()

  await page.goto('/login')
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await logIn(page, email, 'wrong-password')
    await expect(page.getByText('That email and password do not match. Check them and try again.')).toBeVisible()
  }
  await logIn(page, email, 'wrong-password')
  await expect(page.getByText('Too many failed attempts. Try again in 15 minutes.')).toBeVisible()

  await logIn(page, email, 'password1')
  await expect(page.getByText('Too many failed attempts. Try again in 15 minutes.')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('S6: resetting the password on another device logs out the old session', async ({ page, browser, request }, testInfo) => {
  const email = uniqueEmail(`reset-${testInfo.project.name}`)
  await signUpThroughUi(page, request, { email })
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/profile/)

  // Another device: forgot password → code → new password.
  const otherContext = await browser.newContext()
  await routeThirdParty(otherContext)
  const other = await otherContext.newPage()
  await other.goto('/forgot-password')
  await other.getByLabel('Email address').fill(email)
  await other.getByRole('button', { name: 'Send reset code' }).click()
  await expect(other).toHaveURL(/step=reset/)
  await other.getByLabel('Six-digit code').fill(await resetCode(request, email))
  await other.getByLabel('New password', { exact: true }).fill('brandnew123')
  await other.getByLabel('Confirm new password').fill('brandnew123')
  await other.getByRole('button', { name: 'Reset password' }).click()
  await expect(other).toHaveURL(/\/login/)
  await logIn(other, email, 'brandnew123')
  await expectInLibrary(other)
  await otherContext.close()

  // The first device's session has ended.
  await page.reload()
  await expect(page).toHaveURL(/\/login/)
})

test('B4: reloading the consent page keeps the visitor on it, and accepting still works', async ({ page, request }, testInfo) => {
  const email = uniqueEmail(`consent-reload-${testInfo.project.name}`)
  await page.goto('/signup')
  await page.getByLabel('First name').fill('Sara')
  await page.getByLabel('Surname').fill('Ahmed')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByLabel('Confirm password').fill('password1')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page).toHaveURL(/\/verify-email/)
  await page.getByLabel('Six-digit code').fill(await latestCode(request, email))
  await page.getByLabel('Password', { exact: true }).fill('password1')
  await page.getByRole('button', { name: 'Verify email' }).click()
  await expect(page).toHaveURL(/\/signup\/consent/)

  await page.reload()
  await expect(page).toHaveURL(/\/signup\/consent/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Accept and create my account' }).click()
  await expectInLibrary(page)
})
