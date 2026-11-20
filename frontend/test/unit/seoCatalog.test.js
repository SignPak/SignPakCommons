import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL, SITE_URL, resolveSiteUrl } from '../../src/seo/seoCatalog.mjs'

describe('SITE_URL (sitemap, robots.txt and canonical links)', () => {
  it('C1: SITE_URL defaults to https://commons.<DOMAIN>', () => {
    expect(DEFAULT_SITE_URL).toBe('https://commons.<DOMAIN>')
    expect(resolveSiteUrl(undefined)).toBe('https://commons.<DOMAIN>')
    expect(resolveSiteUrl('')).toBe('https://commons.<DOMAIN>')
    expect(resolveSiteUrl('   ')).toBe('https://commons.<DOMAIN>')
  })

  it('C1: an explicit SITE_URL is used, with a trailing slash trimmed', () => {
    expect(resolveSiteUrl('https://commons.example.org')).toBe('https://commons.example.org')
    expect(resolveSiteUrl('https://commons.example.org/')).toBe('https://commons.example.org')
    expect(resolveSiteUrl(' https://commons.example.org// ')).toBe('https://commons.example.org')
  })

  it('C1: no longer points at the old signpakcommons.example placeholder', () => {
    expect(SITE_URL).not.toContain('signpakcommons.example')
    expect(SITE_URL).toMatch(/^https:\/\//)
  })
})
