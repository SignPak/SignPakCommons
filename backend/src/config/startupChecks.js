/**
 * Configuration that is valid but almost certainly wrong for a real deployment. These are
 * warnings, not errors: the server still starts, and server.js logs each one at boot.
 * Pure so it can be unit-tested without starting anything.
 */
export function startupWarnings(env) {
  const warnings = []
  if (env.isProduction && !env.TRUST_PROXY) {
    // S3: behind Nginx every request arrives from 127.0.0.1 unless Express trusts the proxy's
    // X-Forwarded-For, so all visitors would share one rate-limit bucket and IP restriction.
    warnings.push(
      'TRUST_PROXY is off in production. Behind Nginx every visitor will appear as the proxy\'s IP, ' +
      'so rate limits and IP restrictions apply to everyone at once. Set TRUST_PROXY=true.',
    )
  }
  return warnings
}
