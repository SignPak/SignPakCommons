import { MulterError } from 'multer'
import mongoose from 'mongoose'
import { logger } from '../utils/logger.js'
import { AppError, notFound } from '../utils/AppError.js'
import { removeQuietly } from '../utils/files.js'

export const notFoundHandler = (req, res, next) => next(notFound('That route does not exist.'))

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, 'PAYLOAD_TOO_LARGE', 'That file is too large.'],
  LIMIT_FILE_COUNT: [400, 'BAD_REQUEST', 'Too many files in one request.'],
  LIMIT_UNEXPECTED_FILE: [422, 'VALIDATION_ERROR', 'Unexpected file field.'],
}

/** Maps anything thrown into { error: { code, message, fields? } }. */
function normalize(error) {
  if (error instanceof AppError) return error
  if (error instanceof MulterError) {
    const [status, code, message] = MULTER_MESSAGES[error.code] || [400, 'BAD_REQUEST', 'The upload could not be processed.']
    return new AppError(status, code, message, error.field ? { [error.field]: message } : undefined)
  }
  if (error?.type === 'entity.parse.failed') return new AppError(400, 'BAD_REQUEST', 'The request body is not valid JSON.')
  if (error?.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
  if (error instanceof mongoose.Error.CastError) return new AppError(404, 'NOT_FOUND', 'We could not find that.')
  if (error instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(error.errors).map(([name, issue]) => [name, issue.message]))
    return new AppError(422, 'VALIDATION_ERROR', 'Some fields need attention.', fields)
  }
  if (error?.code === 11000) {
    const fields = Object.fromEntries(Object.keys(error.keyPattern || {}).map((name) => [name, 'That value is already in use.']))
    return new AppError(409, 'CONFLICT', 'That already exists.', Object.keys(fields).length ? fields : undefined)
  }
  return null
}

// Four arguments are what tell Express this is the error handler.
// eslint-disable-next-line no-unused-vars
export async function errorHandler(error, req, res, next) {
  // Whatever failed, do not leave half-finished uploads in the temp folder.
  const uploaded = [req.file, ...Object.values(req.files || {}).flat()].filter(Boolean)
  await Promise.all(uploaded.map((file) => removeQuietly(file.path)))

  const known = normalize(error)
  if (!known) {
    // Unknown failure: log everything, tell the client nothing.
    ;(req.log || logger).error({ err: error }, 'Unhandled error')
    if (res.headersSent) return res.destroy()
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Try again in a moment.' } })
  }
  if (res.headersSent) return res.destroy()
  const body = { code: known.code, message: known.message }
  if (known.fields) body.fields = known.fields
  return res.status(known.status).json({ error: body })
}
