import assert from 'node:assert/strict'
import test from 'node:test'
import { requestLogProps } from '../../src/utils/requestLog.js'

test('S3: request logs record the client IP Express resolved, not the proxy socket', () => {
  // Behind Nginx the socket is always 127.0.0.1; req.ip is the visitor once TRUST_PROXY is on.
  const req = { ip: '203.0.113.7', socket: { remoteAddress: '127.0.0.1' } }
  assert.deepEqual(requestLogProps(req), { clientIp: '203.0.113.7' })
})

test('S3: request logs fall back to the socket address when req.ip is unavailable', () => {
  assert.deepEqual(requestLogProps({ socket: { remoteAddress: '198.51.100.4' } }), { clientIp: '198.51.100.4' })
  assert.deepEqual(requestLogProps({}), { clientIp: null })
})

test('C3: an email in the query string is redacted from the logged URL', async () => {
  const { requestLogSerializer } = await import('../../src/utils/requestLog.js')
  const logged = requestLogSerializer({ method: 'GET', url: '/api/v1/admin/deletion-lookup?email=Sara%40Example.com&x=1' })
  assert.equal(logged.url, '/api/v1/admin/deletion-lookup?email=[redacted]&x=1')
  assert.equal(requestLogSerializer({ url: '/a?x=1&email=b%40c.d' }).url, '/a?x=1&email=[redacted]')
  assert.equal(requestLogSerializer({ url: '/api/v1/videos?limit=5' }).url, '/api/v1/videos?limit=5', 'other URLs unchanged')
  assert.equal(requestLogSerializer({ url: '/a?myemail=keep' }).url, '/a?myemail=keep', 'only the email parameter')
})

test('D1: both health checks are left out of the request log, and nothing else is', async () => {
  const { isHealthCheck } = await import('../../src/utils/requestLog.js')
  for (const url of ['/api/v1/health', '/api/v1/health/live', '/api/v1/health?x=1', '/api/v1/health/live?probe=docker']) {
    assert.equal(isHealthCheck({ url }), true, url)
  }
  for (const url of ['/api/v1/healthz', '/api/v1/health/other', '/api/v1/videos', '/health', '/api/v1/users/health']) {
    assert.equal(isHealthCheck({ url }), false, url)
  }
})
