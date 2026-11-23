/**
 * The canonical list of routes that are worth a search engine's time: static, public,
 * and the same for every visitor. Per-user pages (home, library, watch, profile, admin)
 * and auth pages are deliberately left out — see scripts/generateSeoAssets.js, which reads
 * this file to write public/sitemap.xml and public/robots.txt.
 *
 * `.mjs` so this one file can be imported unambiguously by both the Vite-bundled app
 * (src/seo/seoUtils.js) and a plain Node script, regardless of package.json's "type".
 */

/**
 * The public site's origin: https://commons.signpak.tech (decision D2), overridable with the
 * SITE_URL environment variable, e.g. for a staging deployment. Two readers, one variable:
 *   - Node (scripts/generateSeoAssets.js) reads process.env.SITE_URL directly;
 *   - the browser bundle gets the same value baked in at build time as __SITE_URL__
 *     (see `define` in vite.config.js), because process.env does not exist in a browser.
 */
export const DEFAULT_SITE_URL = 'https://commons.signpak.tech'

export const resolveSiteUrl = (value) => {
  const trimmed = String(value ?? '').trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_SITE_URL
}

/* global __SITE_URL__ */
const configuredSiteUrl = typeof __SITE_URL__ !== 'undefined'
  ? __SITE_URL__
  : globalThis.process?.env?.SITE_URL

export const SITE_URL = resolveSiteUrl(configuredSiteUrl)

export const SEO_ROUTES = [
  {
    path: '/',
    title: 'Signpak Commons — Contribute Pakistan Sign Language videos',
    description: 'Signpak Commons is an open-source video collection tool for Pakistan Sign Language (PSL). Watch a reference clip, record yourself signing it, and help train an open PSL recognition model.',
  },
  {
    path: '/demo',
    title: 'How it works — Signpak Commons',
    description: 'A short walkthrough of recording, trimming and submitting a Pakistan Sign Language video on Signpak Commons.',
  },
  {
    path: '/faq',
    title: 'FAQ — Signpak Commons',
    description: 'Answers to common questions about contributing PSL videos: recording, cooldowns, privacy, and who is behind the project.',
  },
  {
    path: '/login',
    title: 'Log in — Signpak Commons',
    description: 'Log in to your Signpak Commons account.',
    noindex: true,
  },
  {
    path: '/signup',
    title: 'Create an account — Signpak Commons',
    description: 'Create a free account to start contributing Pakistan Sign Language videos.',
    noindex: true,
  },
  {
    path: '/profile',
    title: 'My space — Signpak Commons',
    description: 'Your contribution history on Signpak Commons.',
    noindex: true,
  },
]
