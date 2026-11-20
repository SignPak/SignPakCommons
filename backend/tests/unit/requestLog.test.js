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
