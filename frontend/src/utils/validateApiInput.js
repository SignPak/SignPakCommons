export function validateApiInput(schema, input) {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  const fields = {}
  for (const issue of result.error.issues) {
    const field = issue.path.join('.')
    if (field && !fields[field]) fields[field] = issue.message
  }

  const error = new Error(result.error.issues[0]?.message || 'The request is invalid.')
  error.fields = fields
  error.status = 422
  throw error
}
