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

/**
 * Site data blocked: reading window.sessionStorage throws a SecurityError, as in a browser set to
 * block site data. Set after sign-up (which needs storage), then the page is reloaded with it.
 */
async function blockSessionStorage(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new DOMException('The operation is insecure.', 'SecurityError') },
    })
  })
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sara')
  expect(await page.evaluate(() => { try { window.sessionStorage; return 'readable' } catch (error) { return error.name } })).toBe('SecurityError')
}

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

  test.describe('with sessionStorage blocked', () => {
    test('Stale chunks: with sessionStorage blocked, a chunk that stays missing reloads once, then shows the error', async ({ page, request }) => {
      await signUpThroughUi(page, request, { email: uniqueEmail('stale-blocked-kept'), firstName: 'Sara' })
      await blockSessionStorage(page)
      const loads = { count: 0 }
      page.on('load', () => { loads.count += 1 })
      await page.route(PROFILE_CHUNK, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }))

      await mySpaceLink(page).click()

      const error = page.getByRole('alert').filter({ hasText: 'This page could not be loaded.' })
      await expect(error).toBeVisible()
      await expect(error.getByRole('button', { name: 'Reload' })).toBeVisible()
      expect(loads.count, 'exactly one reload before the error').toBe(1)
      // The reload was remembered in history.state, the one place left without storage.
      expect(await page.evaluate(() => history.state?.['signpak:chunk-reload-at'])).toEqual(expect.any(Number))

      // Asserting that nothing more happens: a loop reloads many times a second.
      await page.waitForTimeout(3_000)
      expect(loads.count, 'no second reload').toBe(1)
      await expect(error).toBeVisible()
    })

    test('Stale chunks: with sessionStorage blocked, a chunk missing once reloads once, then the page opens', async ({ page, request }) => {
      await signUpThroughUi(page, request, { email: uniqueEmail('stale-blocked-once'), firstName: 'Sara' })
      await blockSessionStorage(page)
      const loads = { count: 0 }
      page.on('load', () => { loads.count += 1 })
      let missing = 0
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
      await expect(page.getByRole('alert').filter({ hasText: 'This page could not be loaded.' })).toHaveCount(0)
      expect(missing).toBe(1)
      expect(loads.count).toBe(1)
    })
  })
})
