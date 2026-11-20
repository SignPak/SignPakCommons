import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

/**
 * Shared Mock Service Worker setup for the page-level integration tests.
 *
 * Only the integration tests import this: unit tests mock `src/services/api` directly and
 * must not pay for (or be constrained by) a request interceptor.
 *
 * Handler paths are written with a leading `*` (`*\/api/v1/auth/login`) because the API
 * client builds relative URLs when VITE_API_ORIGIN is unset, and jsdom resolves those
 * against its own origin.
 */
export const server = setupServer()

/** Call once per integration test file. Fails the test on any request nobody mocked. */
export function setupMockApi(handlers = []) {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    if (handlers.length) server.use(...handlers)
  })
  afterEach(() => server.resetHandlers(...handlers))
  afterAll(() => server.close())
}

/** The API's success envelope. */
export const dataResponse = (data, status = 200) => ({ status, body: { data } })

/** The API's failure envelope, including optional per-field messages. */
export const errorResponse = (status, code, message, fields) => ({
  status,
  body: { error: fields ? { code, message, fields } : { code, message } },
})
