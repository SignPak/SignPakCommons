import { createReadStream } from 'node:fs'
import { google } from 'googleapis'
import { randomUUID } from 'node:crypto'
import { logger } from '../../utils/logger.js'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const escapeQueryValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/**
 * Safely parses service account credentials from raw strings or env vars.
 * Handles double-escaped strings, trailing quotes, and formatted newlines.
 */
function parseCredentials(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw

  let cleaned = String(raw).trim()

  // Strip wrapping outer quotes if passed from stringified env configs
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1)
  }

  let credentials
  try {
    credentials = JSON.parse(cleaned)
    // Handle double-encoded JSON strings
    if (typeof credentials === 'string') {
      credentials = JSON.parse(credentials)
    }
  } catch (err) {
    throw new Error(`Failed to parse Service Account JSON: ${err.message}`)
  }

  // Fix escaped line breaks in private_key for OpenSSL compatibility
  if (credentials?.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }

  return credentials
}

export function createGoogleDriveDriver({ serviceAccountJson, rootFolderId, driverName = 'gdrive' }) {
  const credentials = parseCredentials(serviceAccountJson)
  
  if (!credentials) {
    throw new Error(`[${driverName}] Missing valid service account credentials.`)
  }
  if (!rootFolderId) {
    throw new Error(`[${driverName}] Missing rootFolderId.`)
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] })
  const drive = google.drive({ version: 'v3', auth })
  const folderIds = new Map()

  async function folderIdFor(folderPath) {
    if (!folderPath) return rootFolderId

    let parentId = rootFolderId
    let cacheKey = ''
    const segments = String(folderPath).split('/').filter(Boolean)

    for (const name of segments) {
      cacheKey = `${cacheKey}/${name}`
      if (folderIds.has(cacheKey)) {
        parentId = folderIds.get(cacheKey)
        continue
      }
      const listed = await drive.files.list({
        q: `'${escapeQueryValue(parentId)}' in parents and name = '${escapeQueryValue(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: 'files(id)',
        pageSize: 1,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      let id = listed.data.files?.[0]?.id
      if (!id) {
        const created = await drive.files.create({
          requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
          fields: 'id',
          supportsAllDrives: true,
        })
        id = created.data.id
      }
      folderIds.set(cacheKey, id)
      parentId = id
    }
    return parentId
  }

  async function uploadWithResumableSession({ tempPath, parentId, fileName, mimeType, ext }) {
    const safeMime = mimeType || 'video/mp4'
    const suffix = ext ? (ext.startsWith('.') ? ext : `.${ext}`) : ''
    const uploadName = fileName || `${randomUUID()}${suffix}`

    let res
    try {
      res = await drive.files.create({
        requestBody: { name: uploadName, parents: [parentId], mimeType: safeMime },
        media: { mimeType: safeMime, body: createReadStream(tempPath) },
        fields: 'id',
        supportsAllDrives: true,
      })
    } catch (err) {
      const responseText =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : JSON.stringify(err?.response?.data ?? err?.errors ?? err?.message ?? {})
      logger.error(
        {
          err,
          googleStatus: err?.code ?? err?.response?.status,
          googleBody: err?.response?.data ?? err?.errors,
          responseText,
        },
        'Google Drive upload session creation failed'
      )
      throw new Error(
        `Google Drive upload session creation failed (${err?.code ?? err?.response?.status ?? 'unknown'}): ${responseText}`
      )
    }

    const key = res.data.id
    if (!key) {
      const responseText = 'Google Drive upload succeeded but no file id was returned.'
      logger.error({ responseText }, 'Google Drive single-request upload failed')
      throw new Error(`Google Drive single-request upload failed: ${responseText}`)
    }
    return { key }
  }

  return {
    name: driverName,
    tempDir: null,

    async init() {
      await drive.files.get({ fileId: rootFolderId, fields: 'id, trashed', supportsAllDrives: true })
    },

    async save({ tempPath, ext = '', folder, fileName, mimeType }) {
      const parentId = await folderIdFor(folder)
      return uploadWithResumableSession({ tempPath, parentId, fileName, mimeType, ext })
    },

    async stat(key) {
      const response = await drive.files.get({ fileId: key, fields: 'size', supportsAllDrives: true })
      return { size: Number(response.data.size || 0) }
    },

    async createReadStream(key, range) {
      const headers = range ? { Range: `bytes=${range.start}-${range.end}` } : undefined
      const response = await drive.files.get({ fileId: key, alt: 'media', supportsAllDrives: true }, { responseType: 'stream', headers })
      return response.data
    },

    async remove(key) {
      try {
        await drive.files.delete({ fileId: key, supportsAllDrives: true })
      } catch (error) {
        if (error.code !== 404) throw error
      }
    },
  }
}
