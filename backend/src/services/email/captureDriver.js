// Test-only email driver: nothing leaves the process. The E2E suite reads the codes back
// through the /__test/emails route so a browser test can finish a sign-up without a mailbox.
// env.js refuses to start with EMAIL_DRIVER=capture in production.

const MAX_CAPTURED = 100

const captured = []

export const captureEmailDriver = {
  name: 'capture',

  async sendOtp(email, code, purpose) {
    captured.push({ to: String(email).toLowerCase(), purpose, code, at: new Date().toISOString() })
    if (captured.length > MAX_CAPTURED) captured.splice(0, captured.length - MAX_CAPTURED)
  },
}

/** Newest first. Pass `to` to filter by recipient, `purpose` to filter by code kind. */
export function listCapturedEmails({ to, purpose } = {}) {
  const wanted = to ? String(to).toLowerCase() : null
  return captured
    .filter((item) => (!wanted || item.to === wanted) && (!purpose || item.purpose === purpose))
    .slice()
    .reverse()
}

/** The most recent code for a recipient, or undefined. */
export function latestCapturedEmail(to, purpose) {
  return listCapturedEmails({ to, purpose })[0]
}

export function clearCapturedEmails() {
  captured.length = 0
}
