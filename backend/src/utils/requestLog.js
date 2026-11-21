/**
 * Extra fields on every request log line.
 *
 * pino-http's built-in `req.remoteAddress` is the TCP peer, which behind Nginx is always
 * 127.0.0.1. `req.ip` is what Express resolved: the visitor's address from X-Forwarded-For when
 * TRUST_PROXY is on (S3), the same value rate limits and IP restrictions use. Logging it is what
 * makes "the server logs show real visitor IPs" checkable on the server.
 */
export const requestLogProps = (req) => ({
  clientIp: req.ip ?? req.socket?.remoteAddress ?? null,
})

/**
 * C3: the request-log serializer. pino-http applies its standard serializer first, so `url`
 * is already the path with its query string. An `email=` value is replaced, so a direct
 * `GET /admin/deletion-lookup?email=` call never writes the address to the logs. (The admin
 * page looks up by message ID instead.)
 */
export function requestLogSerializer(req) {
  if (typeof req.url === 'string') req.url = req.url.replace(/([?&]email=)[^&#]*/gi, '$1[redacted]')
  return req
}
