import { test } from '../support/test.js'
import { signUpThroughUi, uniqueEmail } from '../support/flows.js'

/**
 * Smoke test for the whole sign-up flow: form -> emailed six-digit code -> consent -> library.
 * The steps live in e2e/support/flows.js so other specs reuse exactly the same flow.
 */
test('sign-up: form, emailed code, consent, then the library', async ({ page, request }, testInfo) => {
  await signUpThroughUi(page, request, { email: uniqueEmail(testInfo.project.name) })
})
