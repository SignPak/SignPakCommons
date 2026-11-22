import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_ENTRY_BYTES, checkBundle, entryScriptPath } from '../../scripts/checkBundleSize.js'

/** FIX-PLAN Phase 9 item 4: CI fails when the main (entry) chunk is over 300 kB. */

let dist

afterEach(() => { if (dist) fs.rmSync(dist, { recursive: true, force: true }) })

function fakeDist(entryBytes) {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-check-'))
  fs.mkdirSync(path.join(dist, 'assets'))
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><head><script src="/theme-init.js"></script>\n<script type="module" crossorigin src="/assets/index-AbC123.js"></script><link rel="modulepreload" href="/assets/vendor-x.js"></head>')
  fs.writeFileSync(path.join(dist, 'assets', 'index-AbC123.js'), Buffer.alloc(entryBytes, 97))
  return dist
}

describe('bundle size check', () => {
  it('the limit is 300 kB, as Vite prints sizes (300,000 bytes)', () => {
    expect(MAX_ENTRY_BYTES).toBe(300_000)
  })

  it('finds the entry chunk: the module script in index.html, not the theme script or a preload', () => {
    const html = '<script src="/theme-init.js"></script><script type="module" crossorigin src="/assets/index-Xy9.js"></script>'
    expect(entryScriptPath(html)).toBe('assets/index-Xy9.js')
    expect(() => entryScriptPath('<html></html>')).toThrow(/entry/)
  })

  it('passes at the limit and fails one byte over it', () => {
    expect(checkBundle({ distDir: fakeDist(300_000) })).toMatchObject({ ok: true, bytes: 300_000, file: 'assets/index-AbC123.js' })
    expect(checkBundle({ distDir: fakeDist(300_001) })).toMatchObject({ ok: false, bytes: 300_001 })
  })
})
