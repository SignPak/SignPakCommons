import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CSV_BOM, csvField, csvRow } from '../../src/utils/csv.js'

/** B5: the ML export's CSV follows RFC 4180, so any spreadsheet or CSV reader gets the same values back. */

describe('B5: CSV escaping', () => {
  test('B5: plain values are written as they are', () => {
    assert.equal(csvField('hello'), 'hello')
    assert.equal(csvField('64b000000000000000000001'), '64b000000000000000000001')
  })

  test('B5: a comma, a quote or a line break is quoted, and quotes are doubled', () => {
    assert.equal(csvField('Food, drink'), '"Food, drink"')
    assert.equal(csvField('Say "hello"'), '"Say ""hello"""')
    assert.equal(csvField('one\ntwo'), '"one\ntwo"')
    assert.equal(csvField('one\r\ntwo'), '"one\r\ntwo"')
  })

  test('B5: Urdu text is kept exactly, and quoted only when it holds a comma', () => {
    assert.equal(csvField('سلام'), 'سلام')
    assert.equal(csvField('کھانا، پینا'), 'کھانا، پینا', 'the Arabic comma is not a CSV separator')
    assert.equal(csvField('خوراک, پانی'), '"خوراک, پانی"')
  })

  test('B5: null and undefined are empty; numbers and booleans are written plainly', () => {
    assert.equal(csvField(null), '')
    assert.equal(csvField(undefined), '')
    assert.equal(csvField(0), '0')
    assert.equal(csvField(1.25), '1.25')
    assert.equal(csvField(true), 'true')
    assert.equal(csvField(false), 'false')
    assert.equal(csvField(new Date('2026-11-22T10:00:00.000Z')), '2026-11-22T10:00:00.000Z')
  })

  test('B5: a row ends with CRLF, and the file starts with a UTF-8 BOM so Excel reads Urdu correctly', () => {
    assert.equal(csvRow(['a', 'b, c', null, 3]), 'a,"b, c",,3\r\n')
    assert.equal(CSV_BOM, '﻿')
  })
})
