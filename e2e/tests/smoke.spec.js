import { expect, test } from '../support/test.js'

/**
 * @smoke (FIX-PLAN Phase 10 item 4): a short, read-only check that can run against the real
 * site with a test account: `npm run e2e:smoke -- --base-url=https://commons.signpak.tech`
 * (see e2e/README.md). It signs in, opens the library and the profile, and logs out. It creates
 * nothing: no sign-up, no recordings, no messages.
 *
 * Locally (and in the full suite) it signs in as the contributor backend/scripts/e2e-server.js
 * seeds. Against production, SMOKE_EMAIL and SMOKE_PASSWORD name a real test account;
 * scripts/smoke.js refuses to run there without them. Every test still runs under the CSP
 * fixture, so a production run also checks the headers Vercel really sends.
 */

const ACCOUNT = {
  email: process.env.SMOKE_EMAIL || 'smoke@signpak.test',
  password: process.env.SMOKE_PASSWORD || 'Smoke@12345',
}

async function logIn(page) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await page.getByLabel('Email address').fill(ACCOUNT.email)
  await page.getByLabel('Password', { exact: true }).fill(ACCOUNT.password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).toHaveURL(/\/home$/)
}

test.describe('smoke', { tag: '@smoke' }, () => {
  test('Smoke: the landing page loads with the security headers', async ({ page }) => {
    const response = await page.goto('/')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-security-policy']).toContain("default-src 'self'")
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
  })

  test('Smoke: a contributor logs in and sees the library', async ({ page }) => {
    await logIn(page)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Checking your session…')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Library' })).toBeVisible()
  })

  test('Smoke: the profile shows the account, and logging out ends the session', async ({ page }) => {
    await logIn(page)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My space' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByText(ACCOUNT.email)).toBeVisible()

    // Exact: the profile also has "Log out of all devices", which a smoke run must never press.
    await page.getByRole('main').getByRole('button', { name: 'Log out', exact: true }).click()
    await expect(page).not.toHaveURL(/\/profile$/)
    // Signed out: the profile now sends the visitor to the login page.
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login/)
  })
})
