import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import url from 'node:url'

/**
 * Keeps docs/TEST-CASES.md honest. The traceability table goes straight into Section 9 of the
 * SRS/final report, so it must only cite requirement IDs the SRS defines, and every row must
 * point at a test that actually exists.
 */

const backendRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..')
const repoRoot = path.resolve(backendRoot, '..')
const table = fs.readFileSync(path.join(backendRoot, 'docs', 'TEST-CASES.md'), 'utf8')

// SRS security requirements this project traces (see the legend in TEST-CASES.md).
const DEFINED_SE = new Set(['SE-1', 'SE-2', 'SE-3', 'SE-4', 'SE-6', 'SE-9', 'SE-10'])
const REQUIREMENT_TOKEN = /^(FR13\.(?:[1-9]|1[0-3])|OR-19|UI 3\.1\.1\.3|QA-3|SE-\d+)$/
const NO_REQUIREMENT = /^— \((test infrastructure|deployment safety|API metadata), no SRS requirement\)$/

// Where each ID prefix's test files live.
const LOCATIONS = {
  U: 'backend/tests/unit',
  I: 'backend/tests/integration',
  S: 'backend/tests/security',
  FU: 'frontend/test/unit',
  FI: 'frontend/test/integration',
  E: 'e2e/tests',
}

const rows = table.split('\n')
  .map((line) => /^\| ((U|I|S|FU|FI|E)-\d+) \| `([^`]+)` \| (.+?) \| (.+?) \| (.+?) \| (\S+) \|$/.exec(line))
  .filter(Boolean)
  .map(([, id, prefix, file, name, requirement, checklist, level]) => ({ id, prefix, file, name, requirement, checklist, level }))

test('TEST-CASES.md has one well-formed row per test ID', () => {
  assert.ok(rows.length >= 100, `expected the full table, parsed only ${rows.length} rows`)
  const ids = rows.map((row) => row.id)
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), [], 'duplicate test IDs')
})

test('TEST-CASES.md cites only requirement IDs the SRS defines', () => {
  const problems = []
  for (const row of rows) {
    if (NO_REQUIREMENT.test(row.requirement)) continue
    for (const token of row.requirement.split(',').map((part) => part.trim())) {
      if (!REQUIREMENT_TOKEN.test(token)) problems.push(`${row.id}: unknown requirement "${token}"`)
      else if (token.startsWith('SE-') && !DEFINED_SE.has(token)) problems.push(`${row.id}: ${token} is not a defined SRS security requirement`)
    }
  }
  assert.deepEqual(problems, [])
})

test('every row in TEST-CASES.md points at a test that exists', () => {
  const problems = []
  for (const row of rows) {
    const filePath = path.join(repoRoot, LOCATIONS[row.prefix], row.file)
    if (!fs.existsSync(filePath)) {
      problems.push(`${row.id}: ${LOCATIONS[row.prefix]}/${row.file} does not exist`)
      continue
    }
    // S-01 is a template: the access matrix generates one test per route.
    if (row.name.startsWith('`')) continue
    const source = fs.readFileSync(filePath, 'utf8').replace(/\\/g, '')
    if (source.includes(row.name)) continue
    // Parameterised tests (it.each / test.each) are listed under the name the runner reports,
    // so also accept a match against any '%s' / '%d' name template in the file.
    const templates = [...source.matchAll(/(['"`])([^'"`\n]*%[sdi][^'"`\n]*)\1/g)].map(([, , template]) => template)
    const escape = (value) => value.replace(/[.*+?^${}()|[\]]/g, '\\$&')
    const expanded = templates.some((template) => new RegExp(`^${escape(template).replace(/%[sdi]/g, '.+')}$`).test(row.name))
    if (!expanded) problems.push(`${row.id}: no test named "${row.name}" in ${row.file}`)
  }
  assert.deepEqual(problems, [])
})
