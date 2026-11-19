import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { listRoutes, routeKey } from '../support/routeInventory.js'

/**
 * SECURITY: the Playwright email hook must not exist unless it was asked for.
 *
 * app.js mounts /__test only when NODE_ENV=test AND E2E_TEST_HOOKS=true. The integration and
 * security suites never set E2E_TEST_HOOKS, so the route must be absent here; env.js refuses
 * to start at all when either flag is set in production (see tests/unit/env-guards.test.js).
 */

const getContext = useApiContext({ after })
let app, origin

before(async () => {
  const context = await getContext()
  app = context.app
  origin = new URL(context.base).origin
})

describe('security: test-only hooks', () => {
  test('E2E_TEST_HOOKS is off in this environment', () => {
    assert.notEqual(process.env.E2E_TEST_HOOKS, 'true')
  })

  test('GET /__test/emails does not exist without E2E_TEST_HOOKS', async () => {
    const response = await new Client(origin).get('/__test/emails?to=someone@example.com')
    assert.equal(response.status, 404)
    assert.equal(response.body?.error?.code, 'NOT_FOUND')
  })

  test('the router stack contains no /__test route', () => {
    const hooks = listRoutes(app).map(routeKey).filter((key) => key.includes('/__test'))
    assert.deepEqual(hooks, [])
  })
})
