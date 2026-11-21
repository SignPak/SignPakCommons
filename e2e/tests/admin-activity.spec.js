import { expect, routeThirdParty, test } from '../support/test.js'
import { webOrigin } from '../playwright.config.js'

/**
 * Phase 7 (S7, D5): two separate admin accounts. The second one (admin2@signpak.test) is a
 * normal account seeded by the E2E server and promoted by the startup sync because it is in
 * ADMIN_EMAILS. Each admin makes a change, and Admin → Activity names the right admin for each.
 */

const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345', name: 'Admin Signpak' }
const SECOND = { email: 'admin2@signpak.test', password: process.env.E2E_ADMIN2_PASSWORD || 'Admin2@12345', name: 'Nida Second' }

async function logIn(page, { email, password }) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** A category made from this browser session, through the site's API proxy. */
async function addCategory(page, label) {
  const made = await page.request.post(`${webOrigin}/api/v1/categories`, { data: { label, tone: 'green' } })
  expect(made.status(), await made.text()).toBe(201)
}

test('S7: two admins each make a change, and Activity shows the right name for each', async ({ page, browser }, testInfo) => {
  const tag = `${testInfo.project.name}-${Date.now()}`
  const firstLabel = `First ${tag}`
  const secondLabel = `Second ${tag}`

  await logIn(page, ADMIN)
  await addCategory(page, firstLabel)

  const secondContext = await browser.newContext()
  await routeThirdParty(secondContext)
  const second = await secondContext.newPage()
  await logIn(second, SECOND)
  await second.goto('/admin')
  await expect(second.getByRole('navigation', { name: 'Admin sections' })).toBeVisible()
  await addCategory(second, secondLabel)

  for (const viewer of [page, second]) {
    await viewer.goto('/admin/activity')
    await viewer.getByLabel('Action').selectOption('category.create')
    const firstRow = viewer.locator('tr', { hasText: firstLabel })
    const secondRow = viewer.locator('tr', { hasText: secondLabel })
    await expect(firstRow.getByText(ADMIN.name, { exact: true })).toBeVisible()
    await expect(secondRow.getByText(SECOND.name, { exact: true })).toBeVisible()
    await expect(secondRow.getByText('Added a category')).toBeVisible()
  }

  // The promotion itself is in the log, by the system.
  await page.getByLabel('Action').selectOption('admin.promote')
  await expect(page.locator('tr', { hasText: 'Made an admin' }).first().getByText('System', { exact: true })).toBeVisible()
  await secondContext.close()
})
