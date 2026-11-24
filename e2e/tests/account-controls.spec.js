import { expect, prepareContext, test } from '../support/test.js'
import { webOrigin } from '../playwright.config.js'
import { ADMIN, expectInLibrary, logInThroughUi, publishedVideo, signUpThroughUi, tinyWebm, uniqueEmail } from '../support/flows.js'

/**
 * FR13.12 (the §10.6 production checklist): an admin's account controls, through Admin → Users.
 * - A suspended contributor can't submit from an open session or log in; Reactivate restores both.
 * - A restricted device is refused; removing the restriction restores access.
 *
 * IP restrictions are covered by the API test I-45 and the manual list: every spec here runs from
 * 127.0.0.1, so restricting it would block the shared E2E server for the other specs.
 */

const DEVICE_KEY = 'signpak:v1:device-id'

async function adminOnUsersPage(browser) {
  const context = await browser.newContext()
  await prepareContext(context)
  const admin = await context.newPage()
  await logInThroughUi(admin, ADMIN)
  await expect(admin).not.toHaveURL(/\/login/)
  await admin.goto('/admin/users')
  await expect(admin.getByRole('heading', { name: 'Manage users.' })).toBeVisible()
  return { context, admin }
}

/** The contributor's row in Admin → Users, found through the search box. */
async function userRow(admin, email) {
  await admin.getByLabel('Search accounts').fill(email)
  const row = admin.getByRole('row').filter({ hasText: email })
  await expect(row).toHaveCount(1)
  return row
}

test('FR13.12: a suspended contributor can neither submit nor log in, and Reactivate restores access', async ({ page, request, browser, playwright }, testInfo) => {
  const password = 'password1'
  const email = uniqueEmail(`suspend-${testInfo.project.name}`)
  const { video } = await publishedVideo(playwright, `suspend-${testInfo.project.name}-${Date.now()}`)
  await signUpThroughUi(page, request, { email, password, firstName: 'Saima' })

  const { context, admin } = await adminOnUsersPage(browser)
  try {
    const row = await userRow(admin, email)
    await row.getByRole('button', { name: 'Suspend' }).click()
    await expect(admin.getByText('Saima Ahmed is suspended.')).toBeVisible()
    await expect(row.getByText('suspended', { exact: true })).toBeVisible()

    // The contributor's open session can no longer submit a recording.
    const submit = await page.request.post(`${webOrigin}/api/v1/submissions`, {
      multipart: { videoId: video.id, duration: '3', trimStart: '0', trimEnd: '2', mirrored: 'false', recording: { name: 'take.webm', mimeType: 'video/webm', buffer: tinyWebm() } },
    })
    expect(submit.status()).toBe(401)
    expect((await submit.json()).error.message).toBe('This account is suspended.')

    // Nor can they log in again; the form says why.
    await page.context().clearCookies()
    await logInThroughUi(page, { email, password })
    await expect(page.getByText('This account is suspended.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)

    // Reactivate: logging in works again.
    await row.getByRole('button', { name: 'Reactivate' }).click()
    await expect(admin.getByText('Saima Ahmed is active.')).toBeVisible()
    await logInThroughUi(page, { email, password })
    await expectInLibrary(page, 'Saima')
  } finally {
    await context.close()
  }
})

test('FR13.12: a restricted device is refused, and removing the restriction restores access', async ({ page, request, browser }, testInfo) => {
  const email = uniqueEmail(`device-${testInfo.project.name}`)
  await signUpThroughUi(page, request, { email, firstName: 'Dania' })
  const deviceId = await page.evaluate((key) => localStorage.getItem(key), DEVICE_KEY)
  expect(deviceId).toMatch(/^[0-9a-f-]{36}$/)

  const { context, admin } = await adminOnUsersPage(browser)
  const restrictions = admin.locator('.restriction-list')
  try {
    await admin.getByLabel('Restriction type').selectOption('device')
    await admin.getByLabel('Device ID').fill(deviceId)
    await admin.getByLabel('Reason (optional)').fill(`E2E ${testInfo.project.name}`)
    await admin.getByRole('button', { name: 'Add restriction' }).click()
    await expect(admin.getByText('Device restricted.')).toBeVisible()

    // Every API call from that device is refused with the reason, so the library can't load.
    const refused = page.waitForResponse((response) => response.url().includes('/api/v1/') && response.status() === 403)
    await page.reload()
    const response = await refused
    expect((await response.json()).error.message).toBe('Access from this network or device has been restricted.')
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Dania')

    // The admin removes it; the same device gets in again.
    const item = restrictions.getByRole('listitem').filter({ hasText: `E2E ${testInfo.project.name}` })
    await item.getByRole('button', { name: 'Remove' }).click()
    await expect(admin.getByText('Restriction removed.')).toBeVisible()
    await page.goto('/home')
    await expectInLibrary(page, 'Dania')
  } finally {
    // Never leave a restriction behind for the other specs, even when an assertion failed.
    const leftover = restrictions.getByRole('listitem').filter({ hasText: `E2E ${testInfo.project.name}` })
    if (await leftover.count()) await leftover.getByRole('button', { name: 'Remove' }).click()
    await context.close()
  }
})
