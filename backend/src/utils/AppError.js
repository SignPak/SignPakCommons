/**
 * Every failure the API expects to happen is an AppError. Services throw them,
 * middlewares/errorHandler turns them into `{ error: { code, message, fields } }`.
 * `fields` maps input names to messages so a form can show them next to the right input.
 */
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const badRequest = (message = 'The request could not be understood.') => new AppError(400, 'BAD_REQUEST', message)
export const validationError = (fields, message = 'Some fields need attention.') => new AppError(422, 'VALIDATION_ERROR', message, fields)
export const unauthorized = (message = 'Log in to continue.') => new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'You do not have access to this.') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (message = 'We could not find that.') => new AppError(404, 'NOT_FOUND', message)
export const conflict = (message, fields) => new AppError(409, 'CONFLICT', message, fields)
export const payloadTooLarge = (message = 'That file is too large.') => new AppError(413, 'PAYLOAD_TOO_LARGE', message)
export const tooManyRequests = (message = 'Too many attempts. Wait a moment and try again.') => new AppError(429, 'TOO_MANY_REQUESTS', message)
