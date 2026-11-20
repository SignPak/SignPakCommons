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
