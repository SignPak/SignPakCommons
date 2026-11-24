/**
 * Configuration that is valid but almost certainly wrong for a real deployment. These are
 * warnings, not errors: the server still starts, and server.js logs each one at boot.
 * Pure so it can be unit-tested without starting anything.
 */
export function startupWarnings(env, { inContainer = false } = {}) {
  const warnings = []
  if (env.isProduction && inContainer && ['127.0.0.1', '::1', 'localhost'].includes(env.HOST)) {
    // Phase 11 (Coolify): inside a container, loopback is the container's own. Traefik cannot
    // reach the API, although the image's own health check (run inside it) still passes.
    warnings.push(
      `HOST is ${env.HOST} inside a container, so the proxy (Coolify's Traefik) cannot reach the API. ` +
      'Set HOST=0.0.0.0 in Coolify, and publish no host port (deploy/README.md).',
    )
  }
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
