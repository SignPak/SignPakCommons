// src/utils/parseCredentials.js

export function parseServiceAccountCredentials(rawEnvVar) {
  if (!rawEnvVar) {
    throw new Error('Service account credentials environment variable is missing.');
  }

  let creds = rawEnvVar.trim();

  // 1. Strip surrounding quotes if the env variable was saved with extra wrapping quotes
  if (
    (creds.startsWith('"') && creds.endsWith('"')) ||
    (creds.startsWith("'") && creds.endsWith("'"))
  ) {
    creds = creds.slice(1, -1);
  }

  // 2. Parse JSON (with a fallback double-parse if it was double-encoded)
  let parsed;
  try {
    parsed = typeof creds === 'string' ? JSON.parse(creds) : creds;
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed); // Handles double-stringified JSON
    }
  } catch (err) {
    throw new Error(`Failed to parse Service Account JSON: ${err.message}`);
  }

  // 3. Normalize private key newlines (essential for OpenSSL / Google Auth)
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}
