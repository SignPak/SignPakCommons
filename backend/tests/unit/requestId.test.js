import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { requestIdFrom } from '../../src/utils/requestId.js'

/**
 * S10: an incoming X-Request-Id is echoed back and written to every log line of the request, so
 * only a short, plain value is kept: letters, digits and hyphens, 1 to 64 characters. Anything
 * else gets a fresh UUID instead.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('S10: requestIdFrom', () => {
  test('S10: a valid id (letters, digits, hyphens, up to 64 characters) is kept as sent', () => {
    for (const id of ['a', 'abc-123', 'A1B2-c3d4', '4f9c2a1e-8b7d-4c3a-9e1f-0a2b3c4d5e6f', 'x'.repeat(64)]) {
      assert.equal(requestIdFrom(id), id)
    }
  })

  test('S10: an id that is too long, empty or has any other character is replaced with a new UUID', () => {
    for (const bad of ['x'.repeat(65), '', 'has space', 'under_score', 'a/b', '<script>', 'a.b', 'ünïcode', 'id\tab', 'line\nbreak', 'quote"']) {
      const id = requestIdFrom(bad)
      assert.match(id, UUID, JSON.stringify(bad))
      assert.notEqual(id, bad)
    }
  })

  test('S10: no header, or a repeated header (an array), gets a new UUID', () => {
    assert.match(requestIdFrom(undefined), UUID)
    assert.match(requestIdFrom(['abc', 'def']), UUID)
    assert.notEqual(requestIdFrom(undefined), requestIdFrom(undefined), 'each one is new')
  })
})
