import assert from 'node:assert/strict'
import test from 'node:test'
import { safeName } from '../src/utils/files.js'
test('safeName uses its fallback for nullish and blank values', () => {
  assert.equal(safeName(null), 'Untitled')
  assert.equal(safeName(undefined), 'Untitled')
  assert.equal(safeName(' \t\n '), 'Untitled')
  assert.equal(safeName('\\/:*?"<>|'), 'Untitled')
  assert.equal(safeName('', 'Unnamed category'), 'Unnamed category')
})

test('safeName replaces reserved path characters and collapses whitespace', () => {
  assert.equal(safeName('  Summer\\Travel: Sea / Sky*? "<>|  '), 'Summer Travel Sea Sky')
  assert.equal(safeName(0), '0')
  assert.equal(safeName(false), 'false')
})

test('safeName caps its output at 100 characters', () => {
  assert.equal(safeName('x'.repeat(120)), 'x'.repeat(100))
})
