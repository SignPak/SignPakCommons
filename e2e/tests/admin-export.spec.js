import fs from 'node:fs/promises'
import { expect, routeThirdParty, test } from '../support/test.js'
import { apiOrigin, webOrigin } from '../playwright.config.js'
import { signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * Phase 8 (B5): an admin downloads the ML export as CSV from Admin → Submissions, and its rows
 * are exactly the submissions this test made (ids, trim, mirror), with no name or email in it.
 */

const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345' }
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 7)])

/** A category of its own with two published videos, so the export can be filtered to this test. */
async function referenceVideos(playwright, label) {
  const admin = await playwright.request.newContext({ baseURL: apiOrigin })
  expect((await admin.post('/api/v1/auth/login', { data: ADMIN })).status()).toBe(200)
  const category = await admin.post('/api/v1/categories', { data: { label: `Export ${label}`, tone: 'green' } })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).data.id
  const videos = []
  for (const title of ['One', 'Two']) {
    const made = await admin.post('/api/v1/videos', {
      multipart: { title: `${title} ${label}`, categoryId, durationSec: '3', video: { name: 'video.webm', mimeType: 'video/webm', buffer: webm() } },
    })
    expect(made.status(), await made.text()).toBe(201)
    videos.push((await made.json()).data)
  }
  await admin.dispose()
  return { categoryLabel: `Export ${label}`, videos }
}

test('B5: an admin downloads the CSV export, and its rows match the submissions made', async ({ page, browser, request, playwright }, testInfo) => {
  const label = `${testInfo.project.name}-${Date.now()}`
  const { categoryLabel, videos } = await referenceVideos(playwright, label)
  const email = uniqueEmail(`export-${testInfo.project.name}`)

  // A contributor makes two recordings: one trimmed and mirrored, one plain.
  await signUpThroughUi(page, request, { email, firstName: 'Exporta', surname: 'Contributor' })
  const made = []
  for (const [video, trim] of [[videos[0], { trimStart: '0.5', trimEnd: '2.25', mirrored: 'true' }], [videos[1], { trimStart: '0', trimEnd: '2', mirrored: 'false' }]]) {
    const sent = await page.request.post(`${webOrigin}/api/v1/submissions`, {
      multipart: { videoId: video.id, duration: '3', ...trim, recording: { name: 'take.webm', mimeType: 'video/webm', buffer: webm() } },
    })
    expect(sent.status(), await sent.text()).toBe(201)
    made.push({ id: (await sent.json()).data.id, videoId: video.id, ...trim })
  }

  // The admin filters Admin → Submissions to this category and downloads the CSV.
  const adminContext = await browser.newContext({ acceptDownloads: true })
  await routeThirdParty(adminContext)
  const admin = await adminContext.newPage()
  await admin.goto('/login')
  await admin.getByLabel('Email address').fill(ADMIN.email)
  await admin.getByLabel('Password', { exact: true }).fill(ADMIN.password)
  await admin.getByRole('button', { name: /log in/i }).click()
  await expect(admin).not.toHaveURL(/\/login/)

  await admin.goto('/admin/submissions')
  await admin.getByLabel('Category').selectOption({ label: categoryLabel })
  await expect(admin.getByText('2 submissions')).toBeVisible()
  await expect(admin.locator('tr', { hasText: `One ${label}` }).getByText('Exporta Contributor')).toBeVisible()

  const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('link', { name: 'Download CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^signpak-submissions-\d{4}-\d{2}-\d{2}\.csv$/)
  const text = await fs.readFile(await download.path(), 'utf8')
  await adminContext.close()

  expect(text.charCodeAt(0)).toBe(0xfeff)
  const [header, ...lines] = text.slice(1).trimEnd().split('\r\n').map((line) => line.split(','))
  expect(header).toEqual(['submissionId', 'userId', 'videoId', 'videoTitle', 'categoryId', 'categoryLabel', 'driveFileId', 'archivePath', 'mimeType', 'size', 'duration', 'trimStart', 'trimEnd', 'mirrored', 'submittedAt', 'storageDriver'])
  const rows = lines.map((line) => Object.fromEntries(header.map((name, i) => [name, line[i]])))
  expect(rows.map((row) => row.submissionId).sort()).toEqual(made.map((item) => item.id).sort())
  for (const item of made) {
    const row = rows.find((candidate) => candidate.submissionId === item.id)
    expect(row).toMatchObject({ videoId: item.videoId, categoryLabel, trimStart: item.trimStart, trimEnd: item.trimEnd, mirrored: item.mirrored })
    expect(row.driveFileId).toBeTruthy()
  }
  expect(text).not.toContain('@')
  expect(text).not.toContain('Exporta')
})
