import { expect, test } from '@playwright/test'
import { apiOrigin, webOrigin } from '../playwright.config.js'
import { signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * Phase 5 (C3, FR13.13): a deletion request goes all the way to "0 recordings left".
 *
 * The two recordings are uploaded through the API from the contributor's own browser session,
 * with a minimal WebM file, so the test needs no camera; the recording UI has its own tests.
 * The E2E API stores files with the local driver, so deleting them is real file deletion.
 */

const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345' }
// EBML header: what the API's content check looks for in a WebM file.
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 7)])

/** An admin API session that creates a category with two published videos. */
async function referenceVideos(playwright, label) {
  const admin = await playwright.request.newContext({ baseURL: apiOrigin })
  expect((await admin.post('/api/v1/auth/login', { data: ADMIN })).status()).toBe(200)
  const category = await admin.post('/api/v1/categories', { data: { label: `Deletion ${label}`, tone: 'yellow' } })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).data.id
  const videos = []
  for (const title of ['First', 'Second']) {
    const made = await admin.post('/api/v1/videos', {
      multipart: { title: `${title} ${label}`, categoryId, durationSec: '3', video: { name: 'video.webm', mimeType: 'video/webm', buffer: webm() } },
    })
    expect(made.status(), await made.text()).toBe(201)
    videos.push((await made.json()).data)
  }
  await admin.dispose()
  return videos
}

const profileCount = (page) => page.locator('.profile-count')

test('C3: a deletion request ends with 0 recordings left for that contributor', async ({ page, browser, request, playwright }, testInfo) => {
  const label = `${testInfo.project.name}-${Date.now()}`
  const videos = await referenceVideos(playwright, label)
  const email = uniqueEmail(`deletion-admin-${testInfo.project.name}`)

  // 1. A contributor with two recordings.
  await signUpThroughUi(page, request, { email })
  for (const video of videos) {
    const sent = await page.request.post(`${webOrigin}/api/v1/submissions`, {
      multipart: { videoId: video.id, trimStart: '0', trimEnd: '2', duration: '3', mirrored: 'false', recording: { name: 'take.webm', mimeType: 'video/webm', buffer: webm() } },
    })
    expect(sent.status(), await sent.text()).toBe(201)
  }
  await page.goto('/profile')
  await expect(profileCount(page)).toHaveText(/^2\//)

  // 2. They ask for their recordings to be deleted (signed in, so it is verified at once).
  await page.goto('/#contact')
  const form = page.locator('form.contact-card')
  // The signed-in form (General first) appears once the session check finishes.
  await expect(form.getByLabel('Contact topic')).toHaveValue('general')
  await form.getByLabel('Contact topic').selectOption('recording-deletion')
  await form.getByLabel('Your message').fill('Please delete my recordings and contribution data.')
  await form.getByRole('button', { name: /send deletion request/i }).click()
  await expect(page.getByRole('heading', { name: 'Message received.' })).toBeVisible()

  // 3. An admin finds the request, deletes the recordings and closes it.
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await admin.goto('/login')
  await admin.getByLabel('Email address').fill(ADMIN.email)
  await admin.getByLabel('Password', { exact: true }).fill(ADMIN.password)
  await admin.getByRole('button', { name: /log in/i }).click()
  await expect(admin).not.toHaveURL(/\/login/)

  await admin.goto('/admin/messages')
  await admin.getByLabel('Topic').selectOption('recording-deletion')
  const row = admin.locator('tr', { hasText: email }).first()
  await expect(row.getByText('Verified')).toBeVisible()
  await row.getByRole('button', { name: 'Find contributor' }).click()

  const lookup = admin.locator('.admin-lookup', { hasText: email })
  await expect(lookup).toContainText('(current account): 2 recordings')
  admin.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('Delete 2 recordings')
    void dialog.accept()
  })
  await lookup.getByRole('button', { name: 'Delete recordings' }).click()
  await expect(admin.getByText('Deleted 2 recordings.', { exact: false })).toBeVisible()
  await expect(lookup).toContainText('(current account): 0 recordings')

  await row.getByRole('button', { name: 'Mark done' }).click()
  await expect(row.getByText('Done')).toBeVisible()
  await adminContext.close()

  // 4. The contributor's profile shows no recordings left.
  await page.goto('/profile')
  await expect(profileCount(page)).toHaveText(/^0\//)
})
