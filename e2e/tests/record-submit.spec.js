import { expect, test } from '../support/test.js'
import { SUBMISSION_COOLDOWN_MS } from '../playwright.config.js'
import { apiSession, publishedVideo, signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * FR13.6–FR13.9 (FIX-PLAN §4.4 and the §10.6 production checklist): a contributor records a
 * video with the camera, trims it, mirrors it and submits it. The cooldown then shows the time
 * left, and once it runs out the same video can be recorded and submitted again.
 *
 * Chromium only: it is the project with a fake camera (playwright.config.js), like E-19.
 */

const recordButton = (page) => page.getByRole('button', { name: /Start recording|Record again/ })

async function recordTake(page) {
  await recordButton(page).click()
  const stop = page.getByRole('button', { name: /Stop recording/ })
  await expect(stop).toBeVisible({ timeout: 15_000 })
  // The contributor signs for a few seconds, so the take is long enough to trim.
  await page.waitForTimeout(3_000)
  await stop.click()
  await page.getByRole('button', { name: /Save and edit video/ }).click()
  await expect(page).toHaveURL(/\/watch\/edit/)
}

async function submitFromEditor(page) {
  await page.getByRole('button', { name: /Submit recording/ }).click()
  await page.getByRole('button', { name: 'Yes, submit' }).click()
  await expect(page).toHaveURL(/\/watch\?v=/)
}

test('FR13.8: record, trim, mirror and submit; the cooldown shows the time left, then the video can be recorded again', async ({ page, request, playwright, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'Recording needs the fake camera, which only the Chromium project has (playwright.config.js).')
  test.setTimeout(120_000)
  const { video } = await publishedVideo(playwright, `record-${testInfo.project.name}-${Date.now()}`)
  await signUpThroughUi(page, request, { email: uniqueEmail('record'), firstName: 'Rida' })

  await page.goto(`/watch?v=${video.id}`)
  await recordTake(page)

  // Trim the start to 0.5 s and confirm it, then mirror.
  const trimStart = page.getByLabel('Trim start')
  await trimStart.fill('0.5')
  await page.getByRole('button', { name: 'Confirm trim' }).click()
  await expect(page.getByRole('button', { name: 'Trim confirmed' })).toBeVisible()
  await page.getByLabel('Mirror video').check()
  await expect(page.getByLabel('Preview of your recording')).toHaveClass(/is-mirrored/)
  await submitFromEditor(page)

  // Once the upload is accepted, the cooldown counts down the seconds left.
  const countdown = page.getByRole('status', { name: /seconds until you can record again/ })
  await expect(countdown).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/you can record this video again in \d+s/)).toBeVisible()

  // When it runs out, the same video can be recorded and submitted again.
  await expect(countdown).toBeHidden({ timeout: SUBMISSION_COOLDOWN_MS + 10_000 })
  await expect(recordButton(page)).toBeVisible()
  await recordTake(page)
  await submitFromEditor(page)
  await expect(countdown).toBeVisible({ timeout: 30_000 })

  // Both takes were stored, and the first carries its trim and mirror values.
  const admin = await apiSession(playwright)
  const listed = await admin.get('/api/v1/admin/submissions', { params: { videoId: video.id } })
  expect(listed.status(), await listed.text()).toBe(200)
  const items = (await listed.json()).data.items.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  await admin.dispose()
  expect(items).toHaveLength(2)
  expect(items[0].trimStart).toBeCloseTo(0.5, 1)
  expect(items[0].trimEnd).toBeGreaterThan(items[0].trimStart)
  expect(items[0].mirrored).toBe(true)
})
