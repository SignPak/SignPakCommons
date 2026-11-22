import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { useApiContext } from '../support/apiContext.js'

/** S10: the X-Request-Id the API sends back, through the real middleware stack. */

const getContext = useApiContext({ after })
let base

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const requestId = async (headers = {}) => (await fetch(`${base}/categories`, { headers })).headers.get('x-request-id')

before(async () => {
  ;({ base } = await getContext())
})

describe('S10: X-Request-Id', () => {
  test('S10: a valid incoming X-Request-Id is echoed back unchanged', async () => {
    assert.equal(await requestId({ 'X-Request-Id': 'support-ticket-42' }), 'support-ticket-42')
  })

  test('S10: an invalid one is never echoed: the response carries a fresh UUID', async () => {
    for (const bad of ['x'.repeat(65), 'has space', 'a_b', '<b>hi</b>', 'a;b=c']) {
      const id = await requestId({ 'X-Request-Id': bad })
      assert.match(id, UUID, bad)
      assert.notEqual(id, bad)
    }
  })

  test('S10: without the header, every response gets its own UUID', async () => {
    const [first, second] = [await requestId(), await requestId()]
    assert.match(first, UUID)
    assert.match(second, UUID)
    assert.notEqual(first, second)
  })
})
