import assert from 'node:assert/strict'
import test from 'node:test'
import { createShutdown } from '../../src/utils/gracefulShutdown.js'

const silentLogger = () => {
  const lines = []
  const log = (level) => (...args) => lines.push({ level, args })
  return { lines, info: log('info'), warn: log('warn'), error: log('error') }
}

function fakeServer({ closeError, hang = false } = {}) {
  const calls = []
  return {
    calls,
    close(callback) {
      calls.push('close')
      if (!hang) setImmediate(() => callback(closeError))
    },
    closeIdleConnections() { calls.push('closeIdleConnections') },
  }
}

test('C1: shutdown stops accepting requests, closes MongoDB and exits 0', async () => {
  const order = []
  const server = fakeServer()
  const exits = []
  const shutdown = createShutdown({
    server,
    disconnectDb: async () => { order.push('disconnectDb') },
    logger: silentLogger(),
    exit: (code) => { exits.push(code) },
  })

  await shutdown('SIGTERM')

  assert.deepEqual(server.calls, ['close', 'closeIdleConnections'])
  assert.deepEqual(order, ['disconnectDb'])
  assert.deepEqual(exits, [0])
})

test('C1: a second signal during shutdown is ignored', async () => {
  let disconnects = 0
  const exits = []
  const logger = silentLogger()
  const shutdown = createShutdown({
    server: fakeServer(),
    disconnectDb: async () => { disconnects += 1 },
    logger,
    exit: (code) => { exits.push(code) },
  })

  await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')])

  assert.equal(disconnects, 1)
  assert.deepEqual(exits, [0])
  assert.ok(logger.lines.some((line) => line.level === 'warn'))
})

test('C1: shutdown forces exit 1 when draining takes too long', async () => {
  const exits = []
  const shutdown = createShutdown({
    server: fakeServer({ hang: true }), // an in-flight request that never finishes
    disconnectDb: async () => {},
    logger: silentLogger(),
    timeoutMs: 20,
    exit: (code) => { exits.push(code) },
  })

  shutdown('SIGTERM') // never resolves on its own: the server never finishes closing
  await new Promise((resolve) => setTimeout(resolve, 60))

  assert.deepEqual(exits, [1])
})

test('C1: a failure while closing exits 1 instead of hanging', async () => {
  const exits = []
  const shutdown = createShutdown({
    server: fakeServer(),
    disconnectDb: async () => { throw new Error('mongo went away') },
    logger: silentLogger(),
    exit: (code) => { exits.push(code) },
  })

  await shutdown('SIGTERM')
  assert.deepEqual(exits, [1])
})
