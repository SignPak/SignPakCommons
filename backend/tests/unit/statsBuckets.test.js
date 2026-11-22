import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import '../support/helpers.js' // test environment before env.js loads
import { bucketByDay } from '../../src/services/statsService.js'

/** B7: the dashboard's submissions-per-day, worked out on the server. Days are UTC days. */

const start = new Date('2026-11-20T00:00:00.000Z')

describe('B7: stats bucketed by day', () => {
  test('B7: one entry per day, and a day with no submissions is 0', () => {
    assert.deepEqual(bucketByDay([], start, 3), [
      { date: '2026-11-20', count: 0 },
      { date: '2026-11-21', count: 0 },
      { date: '2026-11-22', count: 0 },
    ])
  })

  test('B7: submissions are counted on their UTC day, across the midnight boundary', () => {
    const dates = ['2026-11-20T00:00:00.000Z', '2026-11-20T23:59:59.999Z', '2026-11-21T00:00:00.000Z', '2026-11-22T12:00:00.000Z', '2026-11-22T13:00:00.000Z']
    assert.deepEqual(bucketByDay(dates.map((d) => new Date(d)), start, 3).map((day) => day.count), [2, 1, 2])
  })

  test('B7: dates before the first day or after the last are left out', () => {
    const dates = [new Date('2026-11-19T23:59:59.999Z'), new Date('2026-11-21T08:00:00.000Z'), new Date('2026-11-23T00:00:00.000Z')]
    assert.deepEqual(bucketByDay(dates, start, 3).map((day) => day.count), [0, 1, 0])
  })

  test('B7: the number of entries is the number of days asked for', () => {
    assert.equal(bucketByDay([], start, 90).length, 90)
    assert.equal(bucketByDay([], start, 90).at(-1).date, '2027-02-17')
  })
})
