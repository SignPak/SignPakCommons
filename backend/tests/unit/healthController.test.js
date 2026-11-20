import assert from 'node:assert/strict'
import test from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { buildHealth } from '../../src/controllers/healthController.js'

test('C1: health is ok only when the database and storage are both up', () => {
  assert.deepEqual(buildHealth({ database: true, storage: true, uptimeSeconds: 12.4 }), {
    status: 200,
    body: { status: 'ok', database: 'connected', storage: true, uptime: 12 },
  })

  for (const [database, storage] of [[false, true], [true, false], [false, false]]) {
    const { status, body } = buildHealth({ database, storage, uptimeSeconds: 1 })
    assert.equal(status, 503, `database=${database} storage=${storage}`)
    assert.equal(body.status, 'degraded')
    assert.equal(body.database, database ? 'connected' : 'disconnected')
    assert.equal(body.storage, storage)
  }
})

test('C1: health exposes booleans and counters only', () => {
  const { body } = buildHealth({ database: true, storage: false, uptimeSeconds: 3 })
  assert.deepEqual(Object.keys(body).sort(), ['database', 'status', 'storage', 'uptime'])
  assert.equal(typeof body.storage, 'boolean')
})
