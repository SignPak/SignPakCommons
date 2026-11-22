import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, describe, mock, test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'
import { submissionRepo } from '../../src/repositories/submissionRepo.js'
import { logger } from '../../src/utils/logger.js'

/**
 * B5 (fixes after verification): the export is streamed with stream.pipeline, so a client that
 * goes away part-way closes the MongoDB cursor instead of leaving the handler waiting on a
 * 'drain' that never comes. The output itself is byte-for-byte what it was before.
 */

const getContext = useApiContext({ after })
let admin, base, createVerifiedUser, mongoose
let category, video, exact, bulk

const COLUMNS = ['submissionId', 'userId', 'videoId', 'videoTitle', 'categoryId', 'categoryLabel', 'driveFileId', 'archivePath', 'mimeType', 'size', 'duration', 'trimStart', 'trimEnd', 'mirrored', 'submittedAt', 'storageDriver']
const TITLE = 'سلام, "دوست"'
const BULK_ROWS = 40_000

const openCursors = async () => (await mongoose.connection.db.admin().command({ serverStatus: 1 })).metrics.cursor.open.total

const submission = (user, _id, fields = {}) => ({
  _id,
  user: new mongoose.Types.ObjectId(user),
  video: new mongoose.Types.ObjectId(video.id),
  trimStart: 0.5,
  trimEnd: 2.25,
  mirrored: false,
  duration: 3,
  recording: { driver: 'local', key: `recordings/${_id}.webm`, mimeType: 'video/webm', size: 2048, originalName: 'take.webm', archivePath: null },
  createdAt: new Date('2026-11-20T08:30:00.000Z'),
  updatedAt: new Date('2026-11-20T08:30:00.000Z'),
  ...fields,
})

before(async () => {
  ;({ admin, base, createVerifiedUser, mongoose } = await getContext())
  category = (await admin.post('/categories', { label: 'Greetings', tone: 'blue' })).body.data
  const made = await admin.upload('/videos', videoForm({ title: TITLE, categoryId: category.id, durationSec: '3' }))
  assert.equal(made.status, 201, JSON.stringify(made.body))
  video = made.body.data
  const id = async (email) => (await (await createVerifiedUser({ firstName: 'Stream', surname: 'Tester', email })).get('/auth/session')).body.data.id
  exact = { id: await id('exact.stream@example.com') }
  bulk = { id: await id('bulk.stream@example.com') }

  // Two rows with known ids and values, for the byte-for-byte checks.
  exact.first = new mongoose.Types.ObjectId('6740000000000000000000a1')
  exact.second = new mongoose.Types.ObjectId('6740000000000000000000a2')
  await mongoose.models.Submission.collection.insertMany([
    submission(exact.id, exact.first, { mirrored: true }),
    submission(exact.id, exact.second, { trimStart: 0, trimEnd: 3, recording: { driver: 'gdrive-archive', key: 'drive-file-2', mimeType: 'video/mp4', size: 4096, originalName: 'take.mp4', archivePath: 'SignPak/Greetings' }, createdAt: new Date('2026-11-21T09:00:00.000Z') }),
  ])
  // Enough rows that the export can't finish inside the socket buffers: the abort test needs
  // the server to be mid-stream when the client leaves.
  for (let start = 0; start < BULK_ROWS; start += 5000) {
    await mongoose.models.Submission.collection.insertMany(Array.from({ length: 5000 }, () => submission(bulk.id, new mongoose.Types.ObjectId())))
  }
})

const csvLine = (fields) => `${fields.join(',')}\r\n`
const expectedRows = () => [
  {
    submissionId: String(exact.first), userId: exact.id, videoId: video.id, videoTitle: TITLE, categoryId: category.id, categoryLabel: 'Greetings',
    driveFileId: `recordings/${exact.first}.webm`, archivePath: null, mimeType: 'video/webm', size: 2048, duration: 3,
    trimStart: 0.5, trimEnd: 2.25, mirrored: true, submittedAt: '2026-11-20T08:30:00.000Z', storageDriver: 'local',
  },
  {
    submissionId: String(exact.second), userId: exact.id, videoId: video.id, videoTitle: TITLE, categoryId: category.id, categoryLabel: 'Greetings',
    driveFileId: 'drive-file-2', archivePath: 'SignPak/Greetings', mimeType: 'video/mp4', size: 4096, duration: 3,
    trimStart: 0, trimEnd: 3, mirrored: false, submittedAt: '2026-11-21T09:00:00.000Z', storageDriver: 'gdrive-archive',
  },
]

describe('B5: the export output is unchanged by the streaming fix', () => {
  test('B5: the CSV is the BOM, the header and one CRLF line per row, quoted where needed, oldest first', async () => {
    const res = await admin.get(`/admin/submissions/export?format=csv&userId=${exact.id}`, { raw: true })
    assert.equal(res.status, 200)
    const quotedTitle = '"سلام, ""دوست"""'
    assert.equal(res.body.toString('utf8'), '﻿'
      + csvLine(COLUMNS)
      + csvLine([String(exact.first), exact.id, video.id, quotedTitle, category.id, 'Greetings', `recordings/${exact.first}.webm`, '', 'video/webm', '2048', '3', '0.5', '2.25', 'true', '2026-11-20T08:30:00.000Z', 'local'])
      + csvLine([String(exact.second), exact.id, video.id, quotedTitle, category.id, 'Greetings', 'drive-file-2', 'SignPak/Greetings', 'video/mp4', '4096', '3', '0', '3', 'false', '2026-11-21T09:00:00.000Z', 'gdrive-archive']))
    assert.equal(res.body.subarray(0, 3).toString('hex'), 'efbbbf', 'the BOM is UTF-8 encoded')
  })

  test('B5: the JSON is "[", one row per line separated by commas, then "]"', async () => {
    const res = await admin.get(`/admin/submissions/export?format=json&userId=${exact.id}`, { raw: true })
    assert.equal(res.status, 200)
    const [first, second] = expectedRows()
    assert.equal(res.body.toString('utf8'), `[\n${JSON.stringify(first)},\n${JSON.stringify(second)}\n]`)
  })

  test('B5: an empty result is the BOM and header alone, or exactly "[]"', async () => {
    const csv = await admin.get('/admin/submissions/export?format=csv&to=2025-01-01', { raw: true })
    assert.equal(csv.body.toString('utf8'), `﻿${csvLine(COLUMNS)}`)
    const json = await admin.get('/admin/submissions/export?format=json&to=2025-01-01', { raw: true })
    assert.equal(json.body.toString('utf8'), '[]')
  })
})

/** Starts an export, reads its first chunk, stops reading, and then drops the connection. */
function abortAfterFirstChunk(path) {
  return new Promise((resolve, reject) => {
    const cookie = [...admin.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    const req = http.get(`${base}${path}`, { headers: { cookie } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`status ${res.statusCode}`)); return }
      res.once('data', (chunk) => {
        res.pause()
        // Give the server time to fill the socket buffers and block, as a slow client would.
        setTimeout(() => { req.destroy(); resolve(chunk) }, 300)
      })
    })
    req.on('error', (error) => { if (!req.destroyed) reject(error) })
  })
}

describe('B5: a cancelled export releases its cursor', () => {
  test('B5: the client leaving part-way closes the MongoDB cursor within 2 s, and the next export still works', { timeout: 60_000 }, async (t) => {
    const info = mock.method(logger, 'info', () => {})
    const error = mock.method(logger, 'error', () => {})
    t.after(() => { info.mock.restore(); error.mock.restore() })
    const before = await openCursors()
    const chunk = await abortAfterFirstChunk('/admin/submissions/export?format=csv')
    assert.equal(chunk.subarray(0, 3).toString('hex'), 'efbbbf', 'the download had started')

    const deadline = Date.now() + 2000
    let open = await openCursors()
    while (open > before && Date.now() < deadline) {
      await delay(50)
      open = await openCursors()
    }
    assert.equal(open, before, `open cursors: ${open} after the abort, ${before} before the request`)
    assert.ok(info.mock.calls.some((call) => call.arguments[1] === 'Submissions export cancelled by the client'), 'the cancel is logged at info')
    assert.equal(error.mock.callCount(), 0, 'a cancelled download is not logged as an error')

    const next = await admin.get(`/admin/submissions/export?format=json&userId=${exact.id}`, { raw: true })
    assert.equal(next.status, 200)
    assert.deepEqual(JSON.parse(next.body.toString('utf8')), expectedRows())
  })

  test('B5: a full export of every row still completes', { timeout: 60_000 }, async () => {
    const before = await openCursors()
    const res = await admin.get('/admin/submissions/export?format=json', { raw: true })
    assert.equal(res.status, 200)
    assert.equal(JSON.parse(res.body.toString('utf8')).length, BULK_ROWS + 2)
    assert.equal(await openCursors(), before, 'a finished export leaves no cursor open')
  })
})

describe('B5: an export that fails after the headers are sent', () => {
  test('B5: a database error part-way cuts the download, is logged as an error, and closes the cursor', async (t) => {
    let closed = 0
    const failing = {
      async* [Symbol.asyncIterator]() {
        yield (await mongoose.models.Submission.collection.findOne({ _id: exact.first }))
        throw new Error('cursor lost')
      },
      close: async () => { closed += 1 },
    }
    const cursor = mock.method(submissionRepo, 'exportCursor', () => failing)
    const error = mock.method(logger, 'error', () => {})
    t.after(() => { cursor.mock.restore(); error.mock.restore() })

    await assert.rejects(admin.get('/admin/submissions/export?format=csv', { raw: true }), 'the download is cut, not ended as if complete')
    assert.equal(closed, 1, 'the cursor is closed')
    // The client can see the reset a moment before the handler's catch runs.
    for (let waited = 0; error.mock.callCount() === 0 && waited < 1000; waited += 20) await delay(20)
    assert.equal(error.mock.callCount(), 1)
    assert.equal(error.mock.calls[0].arguments[1], 'Submissions export failed part-way')
    assert.equal(error.mock.calls[0].arguments[0].err.message, 'cursor lost')
  })
})
