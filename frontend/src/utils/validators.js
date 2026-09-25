const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i
const LINKEDIN_SLUG = /^[\w\-%]{3,100}$/
const ROUTE_ID = /^[A-Za-z0-9_-]{1,128}$/

export const isEmail = (value) => EMAIL.test(value.trim())
export const safeRouteId = (value) => typeof value === 'string' && ROUTE_ID.test(value) ? value : null

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address, like you@example.com.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

export function validateSignup({ firstName, surname, email, password, confirmPassword }) {
  const errors = {}
  if (!firstName.trim()) errors.firstName = 'Enter your first name.'
  if (!surname.trim()) errors.surname = 'Enter your surname.'
  if (!email.trim()) errors.email = 'Enter your email address.'
  else if (!isEmail(email)) errors.email = 'Enter a valid email address, like you@example.com.'
  if (!password) errors.password = 'Create a password.'
  else if (password.length < 8) errors.password = 'Use at least 8 characters.'
  if (!confirmPassword) errors.confirmPassword = 'Confirm your password.'
  else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

/** Accepts a username or a github.com URL. Returns { value, error }. Empty input means "not connected". */
export function normalizeGithub(input) {
  const raw = input.trim()
  if (!raw) return { value: null }
  const username = raw.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '').replace(/\/+$/, '')
  if (!GITHUB_USER.test(username)) return { error: 'Enter a GitHub username or a github.com profile link.' }
  return { value: username }
}

/** Accepts a profile slug or a linkedin.com/in/... URL. Returns { value, error }. */
export function normalizeLinkedin(input) {
  const raw = input.trim()
  if (!raw) return { value: null }
  const match = raw.match(/^(?:https?:\/\/)?(?:[\w]+\.)?linkedin\.com\/in\/([\w\-%]{3,100})\/?$/i)
  const slug = match ? match[1] : raw
  if (!LINKEDIN_SLUG.test(slug)) return { error: 'Enter a LinkedIn profile link, like linkedin.com/in/your-name.' }
  return { value: `https://www.linkedin.com/in/${slug}` }
}
