import { expect, test } from '@playwright/test'
import { crossHost, webOrigin } from '../playwright.config.js'
import { expectInLibrary, signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * C4: the production layout, on two real hostnames.
 *
 * Production runs the site at commons.signpak.tech (Vercel) and the API at api.commons.signpak.tech (our
 * server): different hosts, same site (D2). The login cookie is set by the API host with
 * SameSite=Lax and no Domain attribute, and must still come back on every request the site
 * makes to the API — including in WebKit, Safari's engine, which drops cross-*site* cookies.
 *
 * commons.localtest.me / api.localtest.me reproduce that: both resolve to this machine, and
 * localtest.me is not on the Public Suffix List, so the two are same-site exactly like
 * commons.signpak.tech / api.commons.signpak.tech. The site here is a build with VITE_API_ORIGIN pointing at
 * the API host directly (no proxy), as on Vercel.
 */

test('C4: login cookie set by api.localtest.me works on commons.localtest.me', async ({ page, context, request, browserName }, testInfo) => {
  const email = uniqueEmail(`crosshost-${testInfo.project.name}`)
  const password = 'password1'

  // 1. Sign up on the site host; the API host sets the session cookie when consent is accepted.
  const consentResponse = page.waitForResponse((response) => response.url() === `${crossHost.api}/api/v1/auth/consent`)
  await signUpThroughUi(page, request, { email, password, site: crossHost.site })

  // The attributes as the API sent them. Checked on the header rather than the browser's cookie
  // store: WebKit's Windows port stores this cookie but reports its SameSite as "None", although
  // it received "SameSite=Lax" (verified while writing this test). The header is the same in
  // every engine, and step 2 proves each engine sends the cookie where it should.
  const setCookie = await (await consentResponse).headerValue('set-cookie')
  const attributes = setCookie.split(';').slice(1).map((part) => part.trim().toLowerCase())
  expect(attributes).toContain('samesite=lax')
  expect(attributes).toContain('httponly')
  expect(attributes.some((part) => part.startsWith('domain=')), 'host-only: no Domain attribute').toBe(false)

  const [session] = (await context.cookies(crossHost.api)).filter((cookie) => cookie.name === 'signpak_token')
  expect(session, 'the browser must have stored the session cookie for the API host').toBeTruthy()
  expect(session.domain).toBe(crossHost.apiHostname)
  expect(session.httpOnly).toBe(true)
  expect(await context.cookies(crossHost.site), 'the site host never holds the session').toEqual([])

  // 2. A full reload makes the site ask the API "who am I?" from scratch. Only a cookie that
  //    travels from commons. to api. keeps the visitor signed in.
  await page.reload()
  await expectInLibrary(page)

  // 3. Log out through the UI: the API clears the cookie and the library is closed again.
  await page.goto(`${crossHost.site}/profile`)
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.goto(`${crossHost.site}/home`)
  await expect(page).toHaveURL(/\/login/)
  expect((await context.cookies(crossHost.api)).filter((cookie) => cookie.name === 'signpak_token')).toEqual([])

  // 4. Log in again, then reload: the new cookie works across the two hosts too.
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()
  await expectInLibrary(page)
  await page.reload()
  await expectInLibrary(page)

  // 5. Negative control: it works because the two hosts are the same *site*. The identical
  //    credentialed request made from a different site (127.0.0.1 — also an allowed CORS
  //    origin, so the answer is readable) must not carry the SameSite=Lax cookie. This is the
  //    *.vercel.app -> *.railway.app situation C4 describes.
  const whoAmI = (from) => from.evaluate(async (api) => {
    const response = await fetch(`${api}/api/v1/auth/session`, { credentials: 'include' })
    return (await response.json()).data?.email ?? null
  }, crossHost.api)
  expect(await whoAmI(page), 'same site: the session travels').toBe(email)

  // Playwright's *Windows* WebKit build does not implement SameSite at all: it stores the cookie
  // as "None" and sends it cross-site too (found while writing this test). Real Safari and the
  // Linux WebKit build that CI runs do enforce it, so the control runs everywhere except there,
  // and the report says WebKit's SameSite proof comes from CI.
  if (browserName === 'webkit' && process.platform === 'win32') {
    testInfo.annotations.push({
      type: 'limitation',
      description: 'Windows WebKit ignores SameSite; the cross-site negative control runs on Linux (CI) and in Chromium/Firefox.',
    })
    return
  }
  const otherSite = await context.newPage()
  await otherSite.goto(webOrigin)
  expect(await whoAmI(otherSite), 'cross-site: the session must not travel').toBeNull()
  await otherSite.close()
})
