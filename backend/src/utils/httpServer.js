import http from 'node:http'

/**
 * Starts the API's HTTP server (server.js).
 *
 * requestTimeout is how long a whole request, body included, may take to arrive. Node's default
 * of 300 s cuts off a 100 MB recording on a connection slower than about 2.7 Mbps, so it comes
 * from REQUEST_TIMEOUT_MS (15 minutes by default). headersTimeout and keepAliveTimeout keep
 * Node's defaults. The proxy in front must allow at least as long: Traefik's entry point
 * readTimeout under Coolify, Nginx's timeouts on a bare server (deploy/README.md).
 *
 * connectionsCheckingInterval (how often Node looks for expired requests, default 30 s) is
 * only passed by tests, so they can see a short timeout take effect quickly.
 */
export function startHttpServer(app, { port, host, requestTimeoutMs, connectionsCheckingInterval }, onListening) {
  const options = { requestTimeout: requestTimeoutMs }
  if (connectionsCheckingInterval !== undefined) options.connectionsCheckingInterval = connectionsCheckingInterval
  const server = http.createServer(options, app)
  server.listen(port, host, () => onListening?.(server.address()))
  return server
}
