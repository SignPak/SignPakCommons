// Express 4 does not catch rejected promises from async handlers, so wrap them.
export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
