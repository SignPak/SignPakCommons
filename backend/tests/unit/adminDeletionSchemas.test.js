import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deletionLookupQuerySchema,
  messageStatusSchema,
  messagesQuerySchema,
  removeSubmissionsQuerySchema,
  removeUserQuerySchema,
  userSubmissionsQuerySchema,
} from '../../src/middlewares/validators/adminSchemas.js'

const ID = '0123456789abcdef01234567'
const ok = (schema, value) => schema.safeParse(value).success

test('C3: the submissions page takes a limit of 1-100 (default 20) and an object-id cursor', () => {
  assert.deepEqual(userSubmissionsQuerySchema.parse({}), { limit: 20 })
  assert.deepEqual(userSubmissionsQuerySchema.parse({ limit: '5', cursor: ID }), { limit: 5, cursor: ID })
  for (const bad of [{ limit: '0' }, { limit: '101' }, { limit: 'x' }, { cursor: 'not-an-id' }, { cursor: { $gt: '' } }]) {
    assert.equal(ok(userSubmissionsQuerySchema, bad), false, JSON.stringify(bad))
  }
})

test('C3: withRecordings accepts only "true" or "false" and defaults to false', () => {
  assert.deepEqual(removeUserQuerySchema.parse({}), { withRecordings: false })
  assert.deepEqual(removeUserQuerySchema.parse({ withRecordings: 'true' }), { withRecordings: true })
  assert.deepEqual(removeUserQuerySchema.parse({ withRecordings: 'false' }), { withRecordings: false })
  assert.equal(ok(removeUserQuerySchema, { withRecordings: 'yes' }), false)
  assert.equal(ok(removeSubmissionsQuerySchema, { requestMessageId: 'abc' }), false)
  assert.equal(ok(removeSubmissionsQuerySchema, { requestMessageId: ID }), true)
})

test('C3: message filters accept only known topics, statuses and true/false', () => {
  assert.deepEqual(messagesQuerySchema.parse({ topic: 'recording-deletion', status: 'open', verified: 'false' }),
    { limit: 50, topic: 'recording-deletion', status: 'open', verified: false })
  for (const bad of [{ topic: 'admin' }, { status: 'closed' }, { verified: '1' }, { limit: '500' }]) {
    assert.equal(ok(messagesQuerySchema, bad), false, JSON.stringify(bad))
  }
  for (const status of ['open', 'done', 'rejected']) assert.equal(ok(messageStatusSchema, { status }), true)
  assert.equal(ok(messageStatusSchema, { status: 'archived' }), false)
  assert.equal(ok(messageStatusSchema, {}), false)
})

test('C3: the deletion lookup needs exactly one of email or message id', () => {
  assert.deepEqual(deletionLookupQuerySchema.parse({ email: ' Sara@Example.com ' }), { email: 'sara@example.com' })
  assert.deepEqual(deletionLookupQuerySchema.parse({ messageId: ID }), { messageId: ID })
  for (const bad of [{}, { email: 'a@b.co', messageId: ID }, { email: 'nope' }, { email: { $ne: null } }, { messageId: 'x' }]) {
    assert.equal(ok(deletionLookupQuerySchema, bad), false, JSON.stringify(bad))
  }
})
