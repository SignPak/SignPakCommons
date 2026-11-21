import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

/**
 * S1: the production dependencies that had published advisories must stay at or above the
 * release that fixed them. `npm audit` in CI is the real gate; this pins the specific floors, so
 * a lockfile regenerated without them fails here with the advisory named.
 */

const require = createRequire(import.meta.url)

const FLOORS = [
  { name: 'mongoose', fixed: '7.8.13', advisories: 'GHSA-gg4r-jv3p-qx3c, GHSA-8332-j7wj-wjw4, GHSA-wr5m-5jph-8m96, GHSA-6972-9mcm-vhwj' },
  { name: 'multer', fixed: '2.5.0', advisories: 'GHSA-q7qp-rjg7-q26m' },
  { name: 'zod', fixed: '4.6.6', advisories: 'GHSA-mrhx-c7xc-m3w5' },
  { name: 'body-parser', fixed: '1.20.9', advisories: 'GHSA-27r3-jxmh-p828' },
  { name: 'qs', fixed: '6.16.1', advisories: 'GHSA-6pq8-jhm2-2vcw' },
  { name: 'ip-address', fixed: '10.7.4', advisories: 'GHSA-rxp7-6hxx-x8q5' },
]

/** -1, 0 or 1 for plain x.y.z versions (pre-release tags are not expected here). */
function compareVersions(a, b) {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if ((pa[index] ?? 0) !== (pb[index] ?? 0)) return (pa[index] ?? 0) < (pb[index] ?? 0) ? -1 : 1
  }
  return 0
}

test('S1: the version comparison orders releases numerically', () => {
  assert.equal(compareVersions('7.8.13', '7.8.12'), 1)
  assert.equal(compareVersions('7.8.9', '7.8.13'), -1)
  assert.equal(compareVersions('10.7.4', '9.99.99'), 1)
  assert.equal(compareVersions('2.5.0', '2.5.0'), 0)
})

test('S1: production dependencies are at or above their patched versions', () => {
  const problems = []
  for (const { name, fixed, advisories } of FLOORS) {
    const { version } = require(`${name}/package.json`)
    if (compareVersions(version, fixed) < 0) problems.push(`${name} ${version} is below ${fixed} (${advisories})`)
  }
  assert.deepEqual(problems, [])
})
