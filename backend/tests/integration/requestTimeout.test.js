import assert from 'node:assert/strict'
import net from 'node:net'
import test from 'node:test'
import express from 'express'
import { startHttpServer } from '../../src/utils/httpServer.js'

/**
 * Phase 11 (D1): REQUEST_TIMEOUT_MS really limits how long a request may take to arrive, not
 * just a property on the server. A real server from startHttpServer with a 300 ms limit (and a
 * 50 ms check interval so the test is quick): an upload that is still sending its body after
 * the limit gets 408 and the connection is closed; one that finishes in time gets its answer.
 */

function startServer() {
  const app = express()
  app.post('/upload', (req, res) => {
    let bytes = 0
    req.on('data', (chunk) => { bytes += chunk.length })
    req.on('end', () => res.json({ bytes }))
  })
  const server = startHttpServer(app, { port: 0, host: '127.0.0.1', requestTimeoutMs: 300, connectionsCheckingInterval: 50 })
  return new Promise((resolve) => server.once('listening', () => resolve(server)))
}

/** Sends the headers for a `length`-byte body, then `pieces` (with a pause before each). */
function slowUpload(port, { length, pieces, pauseMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1')
    let response = ''
    socket.setEncoding('utf8')
    socket.on('data', (data) => { response += data })
    socket.on('error', (error) => (error.code === 'ECONNRESET' || error.code === 'EPIPE' ? null : reject(error)))
    socket.on('close', () => resolve(response))
    socket.write(`POST /upload HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/octet-stream\r\nContent-Length: ${length}\r\nConnection: close\r\n\r\n`)
    let sent = 0
    const sendNext = () => {
      if (sent >= pieces.length || socket.destroyed) return
      setTimeout(() => {
        if (socket.destroyed) return
        socket.write(pieces[sent])
        sent += 1
        sendNext()
      }, pauseMs)
    }
    sendNext()
  })
}

test('D1: an upload slower than REQUEST_TIMEOUT_MS is cut off with 408; one within it gets its response', async () => {
  const server = await startServer()
  const { port } = server.address()
  try {
    // The body stalls: its first byte would come only after 1.5 s, far past the 300 ms limit.
    // The client sends nothing while the server times out. A write that reaches the server
    // after it has closed is answered with a TCP reset, and on Windows a reset makes the client
    // drop the 408 it had received but not yet read.
    const slow = await slowUpload(port, { length: 10, pieces: ['x', 'y'], pauseMs: 1500 })
    assert.match(slow, /^HTTP\/1\.1 408 /, `expected 408, got: ${slow.split('\r\n')[0] || '(nothing)'}`)

    // Two pieces 20 ms apart: done well within the limit.
    const quick = await slowUpload(port, { length: 2, pieces: ['x', 'y'], pauseMs: 20 })
    assert.match(quick, /^HTTP\/1\.1 200 /)
    assert.match(quick, /\{"bytes":2\}$/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
