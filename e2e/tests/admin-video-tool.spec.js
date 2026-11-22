import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '../support/test.js'
import { apiOrigin, webOrigin } from '../playwright.config.js'

/**
 * S8: the admin video tool runs ffmpeg.wasm with the core served by the site itself (/ffmpeg/,
 * copied from @ffmpeg/core at build time), under the CSP. Nothing is loaded from a CDN. The
 * clip is a real 2 s video with a sound track; "Remove sound" (on by default) makes ffmpeg drop
 * it, and the uploaded file must have no audio track left.
 *
 * The tool needs the browser to preview the clip. Playwright's Windows WebKit build plays no
 * video at all (MEDIA_ERR_SRC_NOT_SUPPORTED for WebM and MP4, with or without the CSP; found
 * while writing this test), so there the test checks the tool's fallback instead and says so in
 * an annotation. The Linux WebKit build that CI runs plays video through GStreamer.
 */

const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@signpak.test', password: process.env.ADMIN_PASSWORD || 'Admin@12345' }
const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
const POSTER = fixture('poster.jpg')
// Both containers name each track's codec in plain text (Matroska codec ids; MP4 sample
// entries), so the bytes show which tracks a file has.
const CLIPS = [
  { file: fixture('clip-with-sound.webm'), type: 'video/webm', video: 'V_VP8', audio: 'A_OPUS' },
  { file: fixture('clip-with-sound.mp4'), type: 'video/mp4', video: 'avc1', audio: 'mp4a' },
]
const tracks = (clip, buffer) => ({ video: buffer.includes(clip.video), audio: buffer.includes(clip.audio) })

/** The first clip this browser can actually decode (not just what canPlayType claims), or null. */
async function playableClip(page) {
  for (const clip of CLIPS) {
    const bytes = [...fs.readFileSync(clip.file)]
    const plays = await page.evaluate(({ bytes, type }) => new Promise((resolve) => {
      const video = document.createElement('video')
      video.muted = true
      video.onloadedmetadata = () => resolve(true)
      video.onerror = () => resolve(false)
      setTimeout(() => resolve(false), 8000)
      video.src = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }))
    }), { bytes, type: clip.type })
    if (plays) return clip
  }
  return null
}

test('S8: the admin video tool processes a clip with ffmpeg from /ffmpeg, under the CSP', async ({ page, playwright }, testInfo) => {
  test.setTimeout(120_000) // the first load compiles a 32 MB WebAssembly module
  for (const clip of CLIPS) expect(tracks(clip, fs.readFileSync(clip.file)), `${clip.type} fixture has sound to remove`).toEqual({ video: true, audio: true })

  const api = await playwright.request.newContext({ baseURL: apiOrigin })
  expect((await api.post('/api/v1/auth/login', { data: ADMIN })).status()).toBe(200)
  const category = await api.post('/api/v1/categories', { data: { label: `Tool ${testInfo.project.name} ${Date.now()}`, tone: 'blue' } })
  expect(category.status()).toBe(201)
  const categoryLabel = (await category.json()).data.label

  const requested = []
  page.on('request', (request) => requested.push(request.url()))

  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Good to see you.' })).toBeVisible()
  await page.getByLabel('Email address').fill(ADMIN.email)
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/admin/videos')
  // The add-a-video form (the page also has the demo video's upload).
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Upload video' }) })
  const clip = await playableClip(page)

  if (!clip) {
    testInfo.annotations.push({ type: 'limitation', description: `${testInfo.project.name} on ${process.platform} plays no video, so the tool offers an unchanged upload; ffmpeg is checked in the other engines (and in WebKit on CI).` })
    await form.locator('label.upload-pick input[type="file"]').setInputFiles(CLIPS[0].file)
    await expect(form.getByText('This browser could not preview the file.')).toBeVisible()
    expect(requested.filter((url) => /jsdelivr|unpkg/.test(url))).toEqual([])
    await api.dispose()
    return
  }

  await form.locator('label.upload-pick input[type="file"]').setInputFiles(clip.file)
  await expect(form.getByLabel('Remove sound')).toBeChecked()
  await form.getByRole('button', { name: 'Apply changes' }).click()
  await expect(form.getByText('Ready to upload.')).toBeVisible({ timeout: 90_000 })

  // ffmpeg's core came from this site, and nothing from a CDN.
  expect(requested).toContain(`${webOrigin}/ffmpeg/ffmpeg-core.js`)
  expect(requested).toContain(`${webOrigin}/ffmpeg/ffmpeg-core.wasm`)
  expect(requested.filter((url) => /jsdelivr|unpkg/.test(url))).toEqual([])

  await form.getByLabel('Title').fill(`Tool ${testInfo.project.name} ${Date.now()}`)
  await form.getByLabel('Category').selectOption({ label: categoryLabel })
  await form.getByLabel(/^Poster image/).setInputFiles(POSTER)
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/videos') && response.request().method() === 'POST')
  await form.getByRole('button', { name: 'Upload video' }).click()
  const response = await created
  expect(response.status(), await response.text()).toBe(201)

  // The stored file is ffmpeg's output: the video track is kept and the sound is gone.
  const video = (await response.json()).data
  const file = await api.get(`/api/v1/videos/${video.id}/file`)
  expect(file.status()).toBe(200)
  expect(tracks(clip, await file.body())).toEqual({ video: true, audio: false })
  await api.dispose()
})
