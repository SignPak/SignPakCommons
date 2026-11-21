import assert from 'node:assert/strict'
import test from 'node:test'
import { idParams } from '../../src/middlewares/validators/common.js'
import { contactCodeSchema, contactSchema } from '../../src/middlewares/validators/miscSchemas.js'

test('C2: the contact body accepts the three topics and defaults to general', () => {
  const base = { name: ' Sara ', email: 'Sara@Example.com', message: ' Hello ' }
  assert.deepEqual(contactSchema.parse(base), { topic: 'general', name: 'Sara', email: 'sara@example.com', message: 'Hello' })
  for (const topic of ['general', 'partnership', 'recording-deletion']) {
    assert.equal(contactSchema.parse({ ...base, topic }).topic, topic)
  }
})

test('C2: the contact body refuses an unknown topic, a bad email, and empty or oversized fields', () => {
  const base = { name: 'Sara', email: 'sara@example.com', message: 'Hello' }
  for (const bad of [
    { ...base, topic: 'admin' },
    { ...base, email: 'nope' },
    { ...base, name: '   ' },
    { ...base, message: '' },
    { ...base, name: 'x'.repeat(101) },
    { ...base, message: 'x'.repeat(2001) },
  ]) assert.equal(contactSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 60))
})

test('D4: the code body takes exactly six digits', () => {
  assert.deepEqual(contactCodeSchema.parse({ code: ' 123456 ' }), { code: '123456' })
  for (const code of ['12345', '1234567', 'abcdef', '12 456', '', 123456, null]) {
    assert.equal(contactCodeSchema.safeParse({ code }).success, false, String(code))
  }
  assert.equal(contactCodeSchema.safeParse({}).success, false)
})

test('D4: a NoSQL operator object is not a code', () => {
  assert.equal(contactCodeSchema.safeParse({ code: { $gt: '' } }).success, false)
  assert.equal(contactCodeSchema.safeParse({ code: ['123456'] }).success, false)
})

test('D4: the message id must be a 24-character object id', () => {
  assert.equal(idParams.safeParse({ id: '0123456789abcdef01234567' }).success, true)
  for (const id of ['not-an-id', '0123456789abcdef0123456', '{"$ne":null}']) {
    assert.equal(idParams.safeParse({ id }).success, false, id)
  }
})
