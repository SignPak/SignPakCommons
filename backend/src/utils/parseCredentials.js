// src/utils/parseCredentials.js

export function parseServiceAccountCredentials(rawEnvVar) {
  if (!rawEnvVar) {
    throw new Error('Service account credentials environment variable is missing.');
  }

  const creds = String(rawEnvVar).trim();

  // 1. Parse as stored. A double-encoded value (JSON.stringify of the JSON) parses to a string,
  //    which is parsed once more. Only if the raw value is not JSON at all are wrapping quotes
  //    stripped (e.g. '{"type":...}' saved with single quotes). Stripping first, as this used to,
  //    broke the double-encoded case: '"{\"a\":1}"' minus its quotes is not JSON.
  let parsed;
  try {
    parsed = parseJson(creds);
  } catch (firstError) {
    const quoted = (creds.startsWith('"') && creds.endsWith('"')) || (creds.startsWith("'") && creds.endsWith("'"));
    if (!quoted) throw new Error(`Failed to parse Service Account JSON: ${firstError.message}`);
    try {
      parsed = parseJson(creds.slice(1, -1));
    } catch (err) {
      throw new Error(`Failed to parse Service Account JSON: ${err.message}`);
    }
  }

  // 2. Normalize private key newlines (essential for OpenSSL / Google Auth)
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

function parseJson(text) {
  const value = JSON.parse(text);
  return typeof value === 'string' ? JSON.parse(value) : value;
}
