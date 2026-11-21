import { test as base, expect } from '@playwright/test'

/**
 * The suite's `test`: Playwright's, plus one automatic fixture that keeps every spec off the
 * internet. The site loads Google Fonts and Unsplash images, and `page.goto` waits for the page's
 * `load` event, which waits for those too. A slow or stalled third-party request then stalls the
 * navigation until the test times out: a failure that has nothing to do with the code under
 * test (seen locally while checking the Phase 6 CI fix). These hosts are answered locally, with
 * the same content types a browser expects, so nothing fails to load and nothing is logged.
 */

// 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

const THIRD_PARTY = [
  { pattern: /^https:\/\/fonts\.googleapis\.com\//, reply: { status: 200, contentType: 'text/css', body: '' } },
  { pattern: /^https:\/\/fonts\.gstatic\.com\//, reply: { status: 404, contentType: 'text/plain', body: '' } },
  { pattern: /^https:\/\/images\.unsplash\.com\//, reply: { status: 200, contentType: 'image/gif', body: PIXEL } },
]

/** Answers the third-party hosts locally in `context`. Call it on any extra context a test opens. */
export async function routeThirdParty(context) {
  for (const { pattern, reply } of THIRD_PARTY) {
    await context.route(pattern, (route) => route.fulfill(reply))
  }
}

export const test = base.extend({
  hermeticThirdParty: [async ({ context }, use) => {
    await routeThirdParty(context)
    await use()
  }, { auto: true }],
})

export { expect }
