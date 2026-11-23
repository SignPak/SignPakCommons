import { randomUUID } from 'node:crypto'

// S10: what an incoming X-Request-Id may be. It is echoed in the response and written to every
// log line of the request, so only short, plain values are kept.
const VALID_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/

/** The request's id: the caller's X-Request-Id if it is valid, otherwise a new UUID. */
export function requestIdFrom(header) {
  return typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : randomUUID()
}
