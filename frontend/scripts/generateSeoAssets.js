/**
 * Reads src/seo/seoCatalog.mjs and writes the three files that come from it:
 *   public/sitemap.xml        — one <url> per indexable route
 *   public/robots.txt         — allow/disallow rules, points crawlers at the sitemap
 *   react-snap-routes.json    — the same path list, for scripts/runReactSnap.js to prerender
 *
 * Run with `npm run seo:generate`. Safe to run as often as you like; it only reads the
 * catalog and overwrites these three generated files, nothing else.
 *
 * Note: the project's package.json sets "type": "module", so this script is plain ESM
 * (import/export, import.meta.url) rather than CommonJS (require/module.exports).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const publicDir = path.join(projectRoot, 'public')
const catalogPath = path.join(projectRoot, 'src', 'seo', 'seoCatalog.mjs')

const escapeXml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// Sections that are private, per-user, or auth-gated: never worth a crawl regardless of
// whether any individual page happens to be in the sitemap.
const DISALLOWED_SECTIONS = ['/login', '/signup', '/profile', '/home', '/library', '/watch', '/admin', '/api/']

async function main() {
  const catalog = await import(pathToFileURL(catalogPath).href)
  const routes = catalog.SEO_ROUTES.filter((route) => !route.noindex)
  const lastmod = new Date().toISOString()

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((route) => {
      const loc = `${catalog.SITE_URL}${route.path}`
      const priority = route.path === '/' ? '1.0' : '0.7'
      const changefreq = route.path === '/' ? 'weekly' : 'monthly'
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
      ].join('\n')
    }),
    '</urlset>',
    '',
  ].join('\n')

  const robots = [
    'User-agent: *',
    'Allow: /',
    '',
    ...DISALLOWED_SECTIONS.map((section) => `Disallow: ${section}`),
    '',
    `Sitemap: ${catalog.SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')

  const prerenderRoutes = JSON.stringify(
    routes.map((route) => route.path),
    null,
    2,
  )

  fs.mkdirSync(publicDir, { recursive: true })
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap, 'utf8')
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots, 'utf8')
  fs.writeFileSync(
    path.join(projectRoot, 'react-snap-routes.json'),
    prerenderRoutes,
    'utf8',
  )

  console.log(
    `Generated SEO assets for ${routes.length} canonical routes in ${publicDir}`,
  )
}

main().catch((error) => {
  console.error('Failed to generate SEO assets:', error)
  process.exit(1)
})
