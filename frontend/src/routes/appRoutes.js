/**
 * Centralised path builders for the app's own client-side routes.
 *
 * A single video's address uses a query parameter (?v=id) rather than a path segment
 * (/watch?v=id, not /video/id), the same convention YouTube uses. That keeps a video's
 * URL independent of anything else (which category it sits in, its position in a list),
 * so links stay valid even if the underlying data is reorganised, and new query
 * parameters (timestamps, playlists, referrers...) can be added later without
 * changing the route shape. See src/App.jsx for the <Route> declarations that serve these.
 */
export const paths = {
  home: '/',
  demo: '/demo',
  faq: '/faq',
  about: '/#about',
  contact: '/#contact',
  policy: '/#policy',
  login: '/login',
  signup: '/signup',
  library: '/home',
  profile: '/profile',
  watch: '/watch',
  watchEdit: '/watch/edit',
  admin: '/admin',
  adminVideos: '/admin/videos',
  adminCategories: '/admin/categories',
}

export const categoryUrl = (categoryId) => `/library/${encodeURIComponent(categoryId)}`
export const watchUrl = (videoId) => `/watch?v=${encodeURIComponent(videoId)}`
export const watchEditUrl = (videoId) => `/watch/edit?v=${encodeURIComponent(videoId)}`
