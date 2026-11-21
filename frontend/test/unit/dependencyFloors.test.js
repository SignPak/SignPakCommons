import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * S1: vite is in the production dependency graph (through @tailwindcss/vite), so its advisories
 * count for the production audit, as do source-map-js's. `npm audit` in CI is the real gate;
 * this pins the floors so a regenerated lockfile cannot quietly bring them back.
 */

const require = createRequire(import.meta.url)

const FLOORS = [
  { name: 'vite', fixed: '8.3.3', advisories: 'GHSA-587h-7wmj-h5pm and 5 more' },
  { name: 'source-map-js', fixed: '1.2.2', advisories: 'GHSA-68fv-2mgg-jv7q' },
]

const compareVersions = (a, b) => {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if ((pa[index] ?? 0) !== (pb[index] ?? 0)) return (pa[index] ?? 0) < (pb[index] ?? 0) ? -1 : 1
  }
  return 0
}

describe('dependency floors', () => {
  it('S1: vite and source-map-js are at or above their patched versions', () => {
    const problems = FLOORS
      .map(({ name, fixed, advisories }) => ({ name, fixed, advisories, version: require(`${name}/package.json`).version }))
      .filter(({ version, fixed }) => compareVersions(version, fixed) < 0)
      .map(({ name, version, fixed, advisories }) => `${name} ${version} is below ${fixed} (${advisories})`)
    expect(problems).toEqual([])
  })
})
