import '../support/trustProxyEnv.js' // must stay first: TRUST_PROXY=true before env.js loads
import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { Client } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * Behind Nginx every request reaches Node from 127.0.0.1, and the visitor's address is in
 * X-Forwarded-For. With TRUST_PROXY=true Express takes req.ip from that header, which is what
 * rate limits and IP restrictions key on (S3). Observed through an IP restriction, the same
 * way an administrator would see it.
 */

const getContext = useApiContext({ after })
let base, admin

before(async () => {
  ;({ base, admin } = await getContext())
})

describe('behind a trusted proxy', () => {
  test('S3: with TRUST_PROXY=true the client IP comes from X-Forwarded-For', async () => {
    const visitor = '203.0.113.7'
    const made = await admin.post('/admin/restrictions', { type: 'ip', value: visitor, reason: 'proxy test' })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    try {
      const fromVisitor = await new Client(base).get('/health', { headers: { 'x-forwarded-for': visitor } })
      assert.equal(fromVisitor.status, 403, 'the restricted visitor must be recognised through the proxy')

      const fromSomeoneElse = await new Client(base).get('/health', { headers: { 'x-forwarded-for': '198.51.100.20' } })
      assert.equal(fromSomeoneElse.status, 200, 'other visitors behind the same proxy are not affected')

      // Only one hop is trusted: a client cannot push a different address in front of the
      // one Nginx appends, because Express reads the right-most entry.
      const spoofed = await new Client(base).get('/health', { headers: { 'x-forwarded-for': `198.51.100.20, ${visitor}` } })
      assert.equal(spoofed.status, 403)
    } finally {
      assert.equal((await admin.delete(`/admin/restrictions/${made.body.data.id}`)).status, 204)
    }
  })
})
