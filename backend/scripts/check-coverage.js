#!/usr/bin/env node
/**
 * Enforces the per-directory coverage floors in coverage-thresholds.json.
 *
 * c8 can only check one global threshold, but FIX-PLAN section 4.6 asks for separate floors
 * for src/services, src/middlewares and src/utils as well as the overall number, so this
 * reads the istanbul summary c8 just wrote and aggregates it per group.
 *
 * Run after `c8 ... npm test` (the test:coverage script does both).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import url from 'node:url'

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
const summaryPath = path.join(root, 'coverage', 'coverage-summary.json')
const thresholdsPath = path.join(root, 'coverage-thresholds.json')

if (!fs.existsSync(summaryPath)) {
  console.error(`No coverage summary at ${summaryPath}. Run the coverage script, not this file on its own.`)
  process.exit(1)
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
const { groups } = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'))

// Istanbul keys are absolute paths; compare on repo-relative, forward-slash paths.
const relative = (key) => path.relative(root, key).split(path.sep).join('/')

const files = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([key, value]) => ({ file: relative(key), metrics: value }))

const percent = (covered, total) => (total === 0 ? 100 : (covered / total) * 100)
const round = (value) => Math.round(value * 100) / 100

function aggregate(match) {
  const matched = files.filter(({ file }) => file.startsWith(match))
  const sum = (metric) => matched.reduce(
    (totals, { metrics }) => ({
      covered: totals.covered + metrics[metric].covered,
      total: totals.total + metrics[metric].total,
    }),
    { covered: 0, total: 0 },
  )
  const lines = sum('lines')
  const branches = sum('branches')
  return {
    fileCount: matched.length,
    lines: percent(lines.covered, lines.total),
    branches: percent(branches.covered, branches.total),
  }
}

const failures = []
const rows = []

for (const group of groups) {
  const actual = aggregate(group.match)
  if (actual.fileCount === 0) {
    failures.push(`${group.name}: no files matched "${group.match}" — the threshold config is stale.`)
    continue
  }
  rows.push({
    group: group.name,
    files: actual.fileCount,
    lines: `${round(actual.lines)}% (floor ${group.lines}%)`,
    branches: `${round(actual.branches)}% (floor ${group.branches}%)`,
  })
  for (const metric of ['lines', 'branches']) {
    if (actual[metric] + 1e-9 < group[metric]) {
      failures.push(`${group.name}: ${metric} ${round(actual[metric])}% is below the ${group[metric]}% floor.`)
    }
  }
}

console.log('\nCoverage floors (backend/coverage-thresholds.json):')
console.table(rows)

if (failures.length) {
  console.error('Coverage gate failed:')
  for (const line of failures) console.error(`  - ${line}`)
  process.exit(1)
}

console.log('Coverage gate passed.\n')
