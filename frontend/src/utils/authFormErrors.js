export function applyAuthFieldErrors(error, setError) {
  const fields = Object.entries(error?.fields || {})
  for (const [name, message] of fields) {
    setError(name, { type: 'server', message })
  }
  return fields.length > 0
}
