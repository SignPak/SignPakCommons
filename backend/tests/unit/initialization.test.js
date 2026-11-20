import assert from 'node:assert/strict'
import test from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { serviceUnavailableBody } from '../../src/services/initialization.js'

const failure = new Error('MongoParseError: Invalid scheme in mongodb://admin:hunter2@db.internal:27017')

test('S5: production 503 bodies carry no detail', () => {
  const body = serviceUnavailableBody(failure, { isProduction: true })
  assert.deepEqual(body, {
    error: { code: 'SERVICE_UNAVAILABLE', message: 'Service initializing or misconfigured.' },
  })
  assert.ok(!JSON.stringify(body).includes('hunter2'), 'no part of the error may reach the client')
})

test('S5: development 503 bodies keep the detail for debugging', () => {
  const body = serviceUnavailableBody(failure, { isProduction: false })
  assert.equal(body.error.code, 'SERVICE_UNAVAILABLE')
  assert.equal(body.error.detail, failure.message)
})

test('S5: a missing error still gives a well-formed body', () => {
  assert.deepEqual(serviceUnavailableBody(undefined, { isProduction: true }).error.code, 'SERVICE_UNAVAILABLE')
  assert.equal(serviceUnavailableBody(undefined, { isProduction: false }).error.detail, undefined)
})
