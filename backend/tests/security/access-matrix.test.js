import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { listRoutes, routeKey } from '../support/routeInventory.js'

/**
 * SECURITY: one table for who may reach every route the app registers.
 *
 * Expectations are about the access decision, not the result: a denied caller must get the
 * exact status (401 for "not signed in", 403 for "signed in but not allowed"), while an
 * allowed caller only has to get past the guards, so any non-401/403 status counts (404 for a
 * made-up id and 422 for an empty body are both fine). That keeps this table focused on
 * access control instead of duplicating every route's request-body rules.
 *
 * The last test compares the table against the real router stack, so adding a route without
 * an entry here fails the security suite.
 */

const OPEN = 'allowed'
const UNVERIFIED_ID = '0123456789abcdef01234567' // syntactically valid, never exists

// anonymous | contributor | suspended contributor | admin
const matrix = {
  // Service pages outside the API prefix
  'GET /': [OPEN, OPEN, OPEN, OPEN],
  'GET /favicon.ico': [OPEN, OPEN, OPEN, OPEN],
  'GET /docs.json': [OPEN, OPEN, OPEN, OPEN],
  'GET /api-docs.json': [OPEN, OPEN, OPEN, OPEN],

  // Public API surface
  'GET /api/v1/health': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/docs.json': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/public/stats': [OPEN, OPEN, OPEN, OPEN],

  // Authentication: open by design; the account rules live in authService.
  'POST /api/v1/auth/signup': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/login': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/verify-email': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/consent': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/decline-consent': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/resend-verification': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/forgot-password': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/reset-password': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/auth/logout': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/auth/session': [OPEN, OPEN, OPEN, OPEN],

  // Own account: a session is required, and a suspended session is not a session.
  'GET /api/v1/users/me': [401, OPEN, 401, OPEN],
  'PATCH /api/v1/users/me': [401, OPEN, 401, OPEN],
  'DELETE /api/v1/users/me': [401, OPEN, 401, OPEN],
  'POST /api/v1/users/me/consent': [401, OPEN, 401, OPEN],
  // Password change while logged in: any active session (the body is then validated: 422 here).
  'POST /api/v1/users/me/password': [401, OPEN, 401, OPEN],

  // Library metadata: readable by visitors, writable by admins.
  'GET /api/v1/categories': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/categories': [401, 403, 401, OPEN],
  'PATCH /api/v1/categories/:id': [401, 403, 401, OPEN],
  'DELETE /api/v1/categories/:id': [401, 403, 401, OPEN],
  'GET /api/v1/videos': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/videos/:id': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/videos/:id/file': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/videos/:id/poster': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/videos': [401, 403, 401, OPEN],
  'PATCH /api/v1/videos/:id': [401, 403, 401, OPEN],
  'DELETE /api/v1/videos/:id': [401, 403, 401, OPEN],
  'GET /api/v1/demo-video': [OPEN, OPEN, OPEN, OPEN],
  'GET /api/v1/demo-video/file': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/demo-video': [401, 403, 401, OPEN],
  'DELETE /api/v1/demo-video': [401, 403, 401, OPEN],

  // Contributions
  'GET /api/v1/submissions': [401, OPEN, 401, OPEN],
  'POST /api/v1/submissions': [401, OPEN, 401, OPEN],

  // Contact: signed-out visitors may send a recording-deletion request, so the route itself
  // is open and contactService decides on the topic.
  'POST /api/v1/contact': [OPEN, OPEN, OPEN, OPEN],
  // D4: confirming a signed-out deletion request needs no session (the sender may no longer
  // have an account); the message id plus the emailed code are the proof.
  'POST /api/v1/contact/:id/verify': [OPEN, OPEN, OPEN, OPEN],
  'POST /api/v1/contact/:id/resend': [OPEN, OPEN, OPEN, OPEN],

  // Admin workspace
  'GET /api/v1/admin/users': [401, 403, 401, OPEN],
  'PATCH /api/v1/admin/users/:id': [401, 403, 401, OPEN],
  'DELETE /api/v1/admin/users/:id': [401, 403, 401, OPEN],
  // C3: a contributor's recordings and deleting them, and finding whose they are.
  'GET /api/v1/admin/users/:id/submissions': [401, 403, 401, OPEN],
  'DELETE /api/v1/admin/users/:id/submissions': [401, 403, 401, OPEN],
  'GET /api/v1/admin/deletion-lookup': [401, 403, 401, OPEN],
  'GET /api/v1/admin/restrictions': [401, 403, 401, OPEN],
  'POST /api/v1/admin/restrictions': [401, 403, 401, OPEN],
  'DELETE /api/v1/admin/restrictions/:id': [401, 403, 401, OPEN],
  'GET /api/v1/admin/stats': [401, 403, 401, OPEN],
  // S7: the activity log is for admins only.
  'GET /api/v1/admin/audit': [401, 403, 401, OPEN],
  // B5: the submissions list and the ML export are for admins only.
  'GET /api/v1/admin/submissions': [401, 403, 401, OPEN],
  'GET /api/v1/admin/submissions/export': [401, 403, 401, OPEN],
  'GET /api/v1/admin/messages': [401, 403, 401, OPEN],
  'PATCH /api/v1/admin/messages/:id': [401, 403, 401, OPEN],
}

const ROLE_NAMES = ['anonymous', 'contributor', 'suspended contributor', 'admin']

const getContext = useApiContext({ after })
let app, origin, clients

before(async () => {
  const context = await getContext()
  app = context.app
  origin = new URL(context.base).origin

  const suspended = await context.createVerifiedUser({
    firstName: 'Zara',
    surname: 'Iqbal',
    email: 'suspended-matrix@example.com',
  })
  const accounts = await context.admin.get('/admin/users')
  const suspendedId = accounts.body.data.find((user) => user.email === 'suspended-matrix@example.com').id
  const change = await context.admin.patch(`/admin/users/${suspendedId}`, { status: 'suspended', reason: 'access matrix' })
  assert.equal(change.status, 200, JSON.stringify(change.body))

  clients = [new Client(origin), context.contributor, suspended, context.admin]
})

/**
 * Calls a full path (the inventory reports paths including the API prefix) as the given
 * client. The cookie jar is copied, not shared: POST /auth/logout answers with a cleared
 * cookie, and that must not log the real client out for the rest of the table.
 */
async function call(client, method, path) {
  const bound = new Client(origin)
  bound.cookies = new Map(client.cookies)
  const target = path.replace(':id', UNVERIFIED_ID)
  return bound.request(method, target, method === 'GET' ? undefined : { json: {} })
}

/**
 * S6 (Phase 6): logout ends every session of the account, not just the cookie in the copied
 * jar. After the logout row, sign the shared contributor and admin in again so the rows that
 * follow still run with live sessions. (Logout leaves a suspended account's version alone.)
 */
const SESSION_ENDING = new Set(['POST /api/v1/auth/logout'])
async function signBackIn() {
  for (const [index, email, password] of [[1, 'sara@example.com', 'password1'], [3, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD]]) {
    // The shared clients' base already includes /api/v1.
    const res = await clients[index].post('/auth/login', { email, password })
    assert.equal(res.status, 200, `signing ${ROLE_NAMES[index]} back in`)
  }
}

describe('security: route access matrix', () => {
  for (const [key, expectations] of Object.entries(matrix)) {
    const [method, path] = key.split(' ')
    test(`${key} enforces its access rules`, async () => {
      try {
        for (const [index, expected] of expectations.entries()) {
          const response = await call(clients[index], method, path)
          const who = ROLE_NAMES[index]
          if (expected === OPEN) {
            assert.ok(
              response.status !== 401 && response.status !== 403,
              `${key} should let ${who} through, got ${response.status} ${JSON.stringify(response.body)}`,
            )
          } else {
            assert.equal(
              response.status,
              expected,
              `${key} should answer ${who} with ${expected}, got ${response.status} ${JSON.stringify(response.body)}`,
            )
          }
        }
      } finally {
        if (SESSION_ENDING.has(key)) await signBackIn()
      }
    })
  }

  test('every registered route has a matrix entry', () => {
    const registered = listRoutes(app).map(routeKey)
    const missing = registered.filter((key) => !(key in matrix))
    const stale = Object.keys(matrix).filter((key) => !registered.includes(key))
    assert.deepEqual(missing, [], `Add these routes to the access matrix: ${missing.join(', ')}`)
    assert.deepEqual(stale, [], `These matrix entries no longer exist: ${stale.join(', ')}`)
  })
})
