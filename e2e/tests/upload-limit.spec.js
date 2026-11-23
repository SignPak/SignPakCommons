import { expect, test } from '../support/test.js'
import { webOrigin } from '../playwright.config.js'
import { publishedVideo, signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * FR13.8 (the §10.6 production checklist): the recording upload limit is 100 MB
 * (MAX_RECORDING_UPLOAD_MB). A recording of about 90 MB is accepted; one over the limit is
 * refused with a reason. Both go through the site's /api proxy with a signed-in contributor's
 * session, as the upload queue sends them.
 *
 * API-level, so the browser engine doesn't matter: it runs once, in the Chromium project, to keep
 * ~190 MB of uploads out of the other two. The site's own check (it names the limit before
 * uploading) is unit-tested in frontend/test/unit/limits.test.js.
 */

const MiB = 1024 * 1024
const webmOf = (bytes) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(bytes - 4, 7)])

test('FR13.8: a recording of about 90 MB is accepted and one over 100 MB is refused with a reason', async ({ page, request, playwright, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium', 'API-level upload test; one engine is enough (see the comment above).')
  test.setTimeout(180_000)
  const { video } = await publishedVideo(playwright, `upload-limit-${Date.now()}`)
  await signUpThroughUi(page, request, { email: uniqueEmail(`upload-limit-${testInfo.project.name}`), firstName: 'Uzma' })
  const send = (bytes) => page.request.post(`${webOrigin}/api/v1/submissions`, {
    multipart: { videoId: video.id, duration: '60', trimStart: '0', trimEnd: '60', mirrored: 'false', recording: { name: 'take.webm', mimeType: 'video/webm', buffer: webmOf(bytes) } },
    timeout: 120_000,
  })

  // Over the limit first: a refused upload stores nothing and starts no cooldown.
  const tooLarge = await send(101 * MiB)
  expect(tooLarge.status()).toBe(413)
  expect((await tooLarge.json()).error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', message: 'That file is too large.' })

  const accepted = await send(90 * MiB)
  expect(accepted.status(), await accepted.text()).toBe(201)
  expect((await accepted.json()).data.videoId).toBe(video.id)
})
