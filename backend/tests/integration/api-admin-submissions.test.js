import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { recordingForm, videoForm } from '../support/helpers.js'
import { useApiContext } from '../support/apiContext.js'

/**
 * B5: the admin submissions list (filters, cursor paging) and the export the ML team uses
 * (CSV and JSON, streamed), through the real HTTP stack. The export holds ids, the stored-file
 * pointer, trim, mirror and timing: never a name or an email.
 */

const getContext = useApiContext({ after })
let admin, createVerifiedUser, mongoose
let food, greetings, videoA, videoB, videoC
const people = {}

const COLUMNS = ['submissionId', 'userId', 'videoId', 'videoTitle', 'categoryId', 'categoryLabel', 'driveFileId', 'archivePath', 'mimeType', 'size', 'duration', 'trimStart', 'trimEnd', 'mirrored', 'submittedAt', 'storageDriver']
const URDU_TITLE = 'سلام, "دوست"'

/** Minimal RFC 4180 reader for the checks below. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1 } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' } else if (char === '\r' && text[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 1 } else field += char
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

const submit = (client, video, { trimStart = '0', trimEnd = '2', mirrored = 'false' } = {}) =>
  client.upload('/submissions', recordingForm({ videoId: video.id, trimStart, trimEnd, duration: '3', mirrored }))

before(async () => {
  ;({ admin, createVerifiedUser, mongoose } = await getContext())
  food = (await admin.post('/categories', { label: 'کھانا, Food', tone: 'yellow' })).body.data
  greetings = (await admin.post('/categories', { label: 'Greetings', tone: 'blue' })).body.data
  const video = async (title, category) => {
    const made = await admin.upload('/videos', videoForm({ title, categoryId: category.id, durationSec: '3' }))
    assert.equal(made.status, 201, JSON.stringify(made.body))
    return made.body.data
  }
  videoA = await video(URDU_TITLE, greetings)
  videoB = await video('Bread', food)
  videoC = await video('Water', food)

  for (const [key, first] of [['ayesha', 'Ayesha'], ['bilal', 'Bilal']]) {
    const client = await createVerifiedUser({ firstName: first, surname: 'Exporter', email: `${key}.export@example.com` })
    people[key] = { client, id: (await client.get('/auth/session')).body.data.id, first }
  }
  // Ayesha: A (mirrored, trimmed), B. Bilal: A, C. Five rows across both categories.
  for (const [who, video, options] of [
    ['ayesha', videoA, { trimStart: '0.5', trimEnd: '2.25', mirrored: 'true' }],
    ['ayesha', videoB, {}],
    ['bilal', videoA, {}],
    ['bilal', videoC, { mirrored: 'true' }],
  ]) {
    const res = await submit(people[who].client, video, options)
    assert.equal(res.status, 201, JSON.stringify(res.body))
  }
  // One older submission, for the date filters: Bilal's B, dated 1 Jan 2026.
  const old = await submit(people.bilal.client, videoB)
  assert.equal(old.status, 201)
  await mongoose.models.Submission.collection.updateOne({ _id: new mongoose.Types.ObjectId(old.body.data.id) }, { $set: { createdAt: new Date('2026-01-01T12:00:00.000Z') } })
})

const list = async (query = '') => {
  const res = await admin.get(`/admin/submissions${query}`)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.data
}

describe('B5: GET /admin/submissions', () => {
  test('B5: lists every submission newest first, with the export fields and the contributor name for the table', async () => {
    const page = await list()
    assert.equal(page.total, 5)
    assert.equal(page.items.length, 5)
    assert.equal(page.nextCursor, null)
    const [newest] = page.items
    for (const column of COLUMNS) assert.ok(column in newest, column)
    assert.equal(typeof newest.contributorName, 'string')
    assert.equal('email' in newest, false)
  })

  test('B5: filters by category, video, contributor and date range', async () => {
    assert.equal((await list(`?categoryId=${food.id}`)).total, 3)
    assert.equal((await list(`?videoId=${videoA.id}`)).total, 2)
    assert.equal((await list(`?userId=${people.ayesha.id}`)).total, 2)
    assert.equal((await list(`?userId=${people.bilal.id}&categoryId=${food.id}`)).total, 2)
    assert.equal((await list('?to=2026-01-01')).total, 1, 'to is inclusive to the end of that UTC day')
    assert.equal((await list('?from=2026-01-02')).total, 4)
    assert.equal((await list('?from=2026-01-01&to=2026-01-01')).items[0].videoId, videoB.id)
  })

  test('B5: cursor paging returns every row exactly once, even when a row is deleted between pages', async () => {
    const seen = []
    let cursor = null
    let pages = 0
    do {
      const page = await list(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
      assert.equal(page.total, 5)
      seen.push(...page.items.map((item) => item.submissionId))
      cursor = page.nextCursor
      pages += 1
    } while (cursor)
    assert.equal(pages, 3)
    assert.equal(new Set(seen).size, 5)
    const sorted = [...seen].sort().reverse()
    assert.deepEqual(seen, sorted, 'newest (highest id) first')

    // A row deleted after page 1 does not shift page 2.
    const first = await list('?limit=2')
    const removed = first.items[0].submissionId
    const keep = { ...(await mongoose.models.Submission.findById(removed).lean()) }
    await mongoose.models.Submission.deleteOne({ _id: removed })
    const second = await list(`?limit=2&cursor=${first.nextCursor}`)
    assert.deepEqual(second.items.map((item) => item.submissionId), seen.slice(2, 4))
    await mongoose.models.Submission.collection.insertOne(keep)
  })

  test('B5: bad filters are refused with 422', async () => {
    for (const query of ['?categoryId=nope', '?userId=123', '?from=yesterday', '?limit=0', '?limit=101', '?cursor=abc', '?from=2026-02-01&to=2026-01-01']) {
      assert.equal((await admin.get(`/admin/submissions${query}`)).status, 422, query)
    }
  })
})

describe('B5: GET /admin/submissions/export', () => {
  test('B5: the CSV has exactly the export columns, one row per submission, and survives Urdu, commas and quotes', async () => {
    const res = await admin.get('/admin/submissions/export?format=csv', { raw: true })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /^text\/csv; charset=utf-8/)
    assert.match(res.headers.get('content-disposition'), /^attachment; filename="signpak-submissions-\d{4}-\d{2}-\d{2}\.csv"$/)
    assert.equal(res.headers.get('cache-control'), 'no-store')
    const text = res.body.toString('utf8')
    assert.equal(text.charCodeAt(0), 0xfeff, 'starts with a BOM')
    const [header, ...rows] = parseCsv(text.slice(1))
    assert.deepEqual(header, COLUMNS)
    assert.equal(rows.length, 5)
    const byId = Object.fromEntries(rows.map((row) => [row[0], Object.fromEntries(header.map((name, i) => [name, row[i]]))]))
    const mirroredA = Object.values(byId).find((row) => row.videoId === videoA.id && row.userId === people.ayesha.id)
    assert.equal(mirroredA.videoTitle, URDU_TITLE)
    assert.equal(mirroredA.categoryLabel, 'Greetings')
    assert.equal(mirroredA.trimStart, '0.5')
    assert.equal(mirroredA.trimEnd, '2.25')
    assert.equal(mirroredA.mirrored, 'true')
    assert.equal(mirroredA.mimeType, 'video/webm')
    assert.equal(mirroredA.storageDriver, 'local')
    assert.ok(mirroredA.driveFileId)
    assert.ok(Object.values(byId).some((row) => row.categoryLabel === 'کھانا, Food'))
  })

  test('B5: the JSON export is an array of objects with the same columns, and honours the filters', async () => {
    const res = await admin.get(`/admin/submissions/export?format=json&userId=${people.bilal.id}`, { raw: true })
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /^application\/json/)
    assert.match(res.headers.get('content-disposition'), /\.json"$/)
    const rows = JSON.parse(res.body.toString('utf8'))
    assert.equal(rows.length, 3)
    for (const row of rows) {
      assert.deepEqual(Object.keys(row), COLUMNS)
      assert.equal(row.userId, people.bilal.id)
      assert.equal(typeof row.mirrored, 'boolean')
      assert.equal(typeof row.trimStart, 'number')
    }
    const food2 = JSON.parse((await admin.get(`/admin/submissions/export?format=json&categoryId=${food.id}&from=2026-01-02`, { raw: true })).body.toString('utf8'))
    assert.equal(food2.length, 2)
  })

  test('B5: neither export holds a name or an email address', async () => {
    const csv = (await admin.get('/admin/submissions/export?format=csv', { raw: true })).body.toString('utf8')
    const json = (await admin.get('/admin/submissions/export?format=json', { raw: true })).body.toString('utf8')
    for (const text of [csv, json]) {
      assert.equal(text.includes('@'), false, 'no email')
      for (const name of ['Ayesha', 'Bilal', 'Exporter', 'Sara', 'Omar']) assert.equal(text.includes(name), false, name)
    }
  })

  test('B5: an export with no matching rows is just the header, or an empty array', async () => {
    const csv = (await admin.get('/admin/submissions/export?format=csv&to=2025-01-01', { raw: true })).body.toString('utf8')
    assert.equal(csv, `﻿${COLUMNS.join(',')}\r\n`)
    const json = (await admin.get('/admin/submissions/export?format=json&to=2025-01-01', { raw: true })).body.toString('utf8')
    assert.deepEqual(JSON.parse(json), [])
  })

  test('B5: each export writes one activity entry with the format and the filters', async () => {
    await mongoose.models.AuditLog.deleteMany({})
    assert.equal((await admin.get(`/admin/submissions/export?format=csv&categoryId=${food.id}`, { raw: true })).status, 200)
    const entries = await mongoose.models.AuditLog.find().lean()
    assert.equal(entries.length, 1)
    assert.equal(entries[0].action, 'submissions.export')
    assert.equal(entries[0].meta.format, 'csv')
    assert.equal(entries[0].meta.categoryId, food.id)
  })

  test('B5: an unknown format or a bad filter is refused with 422', async () => {
    assert.equal((await admin.get('/admin/submissions/export?format=xml')).status, 422)
    assert.equal((await admin.get('/admin/submissions/export')).status, 422, 'the format is required')
    assert.equal((await admin.get('/admin/submissions/export?format=csv&videoId=x')).status, 422)
  })
})
