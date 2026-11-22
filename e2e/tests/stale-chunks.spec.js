import { signUpThroughUi, uniqueEmail } from '../support/flows.js'
import { expect, test } from '../support/test.js'

/**
 * Stale chunks after a deploy. Every page but the landing page is a lazy chunk with a hashed
 * name. A tab opened before a Vercel deploy asks for the old names, which then answer 404. The
 * app reloads once so the new build is fetched (frontend/src/utils/chunkReload.js); if the chunk
 * is still missing within 10 s of that reload it shows an error instead of reloading forever.
 *
 * The test signs up (which lands on /home), then makes the chunk of a page it has not opened yet,
 * My space (ProfileDashboard), answer 404 and goes there through the header. Runs under the CSP
 * fixture like every other spec.
 */

const PROFILE_CHUNK = /\/assets\/ProfileDashboard-[\w-]+\.js$/

async function onHomeWithLoadCounter(page, request, label) {
  await signUpThroughUi(page, request, { email: uniqueEmail(label), firstName: 'Sara' })
  const loads = { count: 0 }
  page.on('load', () => { loads.count += 1 })
  return loads
}

const mySpaceLink = (page) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My space' })

test.describe('Stale chunks after a deploy', () => {
  test('Stale chunks: a page chunk that is gone after a deploy reloads the page once, and the page then opens', async ({ page, request }) => {
    const loads = await onHomeWithLoadCounter(page, request, 'stale-once')
    let missing = 0
    // The old build's chunk is gone once; after the reload the browser gets the (here: same) chunk.
    await page.route(PROFILE_CHUNK, async (route) => {
      if (missing === 0) {
        missing += 1
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' })
      } else {
        await route.continue()
      }
    })

    await mySpaceLink(page).click()

    await expect.poll(() => loads.count, 'one reload').toBe(1)
    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sara')
    expect(missing).toBe(1)
    expect(await page.evaluate(() => sessionStorage.getItem('signpak:chunk-reload-at'))).toMatch(/^\d+$/)
    await expect(page.getByRole('alert').filter({ hasText: 'This page could not be loaded.' })).toHaveCount(0)
  })

  test('Stale chunks: a chunk that stays missing shows the error after one reload instead of reloading forever', async ({ page, request }) => {
    const loads = await onHomeWithLoadCounter(page, request, 'stale-kept')
    let requests = 0
    await page.route(PROFILE_CHUNK, async (route) => {
      requests += 1
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' })
    })

    await mySpaceLink(page).click()

    const error = page.getByRole('alert').filter({ hasText: 'This page could not be loaded.' })
    await expect(error).toBeVisible()
    await expect(error).toContainText('Reload to try again.')
    await expect(error.getByRole('button', { name: 'Reload' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    expect(loads.count, 'exactly one reload before the error').toBe(1)

    // Asserting that nothing more happens: a loop would have reloaded again by now.
    await page.waitForTimeout(1_500)
    expect(loads.count, 'no second reload').toBe(1)
    await expect(error).toBeVisible()
    expect(requests).toBeGreaterThanOrEqual(2)
  })
})
