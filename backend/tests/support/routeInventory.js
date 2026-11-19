/**
 * Walks an Express app's router tree and returns every registered route as
 * { method: 'GET', path: '/api/v1/videos/:id' }.
 *
 * The access-matrix security test uses this so a newly added route cannot quietly skip
 * access control: if the inventory finds a route with no entry in the matrix, the test fails.
 */

// Express stores each mounted path as a regexp; turn it back into a string. An unparseable
// mount (a regexp or array path) throws rather than returning '', so a route can never be
// reported under the wrong path and quietly satisfy the wrong access-matrix entry.
function pathFromLayer(layer) {
  if (layer.path) return layer.path
  const source = layer.regexp?.source
  if (!source) return ''
  if (source === '^\\/?(?=\\/|$)') return '' // app.use(fn) with no path
  const match = /^\^\\\/(?<body>.*?)\\\/\?\(\?=\\\/\|\$\)\$?$/.exec(source)
  if (!match) throw new Error(`Could not read the mount path from ${source}; update routeInventory.js`)
  return `/${match.groups.body.replace(/\\\//g, '/').replace(/\\\./g, '.')}`
}

function walk(stack, prefix, routes) {
  for (const layer of stack) {
    if (layer.route) {
      const routePath = `${prefix}${layer.route.path === '/' ? '' : layer.route.path}` || '/'
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (!enabled || method === '_all') continue
        routes.push({ method: method.toUpperCase(), path: routePath })
      }
      continue
    }
    if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, `${prefix}${pathFromLayer(layer)}`, routes)
    }
  }
}

/** Every route the app has registered, de-duplicated and sorted. */
export function listRoutes(app) {
  // Express 4 keeps the stack on _router (and makes `app.router` a getter that throws);
  // Express 5 moved it to app.router, so try the 4.x name first.
  const stack = app._router?.stack ?? app.router?.stack
  if (!stack) throw new Error('Could not read the Express router stack; Express internals changed.')
  const routes = []
  walk(stack, '', routes)
  const seen = new Set()
  return routes
    .filter(({ method, path }) => {
      const key = `${method} ${path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)))
}

export const routeKey = ({ method, path }) => `${method} ${path}`
