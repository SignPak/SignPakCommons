import { useEffect } from 'react'
import { SEO_ROUTES, SITE_URL } from './seoCatalog.mjs'

const DEFAULT_TITLE = 'Signpak Commons'
const routeByPath = new Map(SEO_ROUTES.map((route) => [route.path, route]))

/** Looks up a route's SEO metadata by its path, as declared in seoCatalog.mjs. */
export const getRouteMeta = (path) => routeByPath.get(path) || null

/** Absolute, canonical URL for a path, using the site's real domain. */
export const buildCanonicalUrl = (path) => `${SITE_URL}${path}`

function setMetaTag(name, content) {
  if (!content) return
  let tag = document.querySelector(`meta[name="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setCanonicalLink(href) {
  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

/**
 * Sets the document title, meta description and canonical link for a static route from
 * seoCatalog.mjs. Call once per page component, e.g. `useSeo('/faq')`. Routes not in the
 * catalog (dynamic, per-user pages) fall back to just the default title, on purpose:
 * those pages are not meant to be indexed.
 */
export function useSeo(path) {
  useEffect(() => {
    const route = getRouteMeta(path)
    document.title = route ? route.title : DEFAULT_TITLE
    if (route) {
      setMetaTag('description', route.description)
      setCanonicalLink(buildCanonicalUrl(route.path))
    }
    return () => { document.title = DEFAULT_TITLE }
  }, [path])
}
