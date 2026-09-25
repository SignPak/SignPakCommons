import { validationError } from '../utils/AppError.js'

/** Turns Zod issues into { fieldName: "message" }, keeping the first message per field. */
export function issuesToFields(issues) {
  const fields = {}
  for (const issue of issues) {
    const name = issue.path.join('.') || '_'
    if (!fields[name]) fields[name] = issue.message
  }
  return fields
}

/**
 * validate({ body, params, query }) parses each part with its Zod schema.
 * On success the parsed (trimmed, coerced, unknown-keys-stripped) values replace the originals,
 * so downstream code only ever sees clean input.
 */
export const validate = (schemas) => (req, res, next) => {
  const fields = {}
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue
    const result = schemas[part].safeParse(req[part] ?? {})
    if (result.success) req[part] = result.data
    else Object.assign(fields, issuesToFields(result.error.issues))
  }
  if (Object.keys(fields).length) return next(validationError(fields))
  return next()
}
