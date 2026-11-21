import { createReadStream } from 'node:fs'
import { google } from 'googleapis'
import { randomUUID } from 'node:crypto'
import { logger } from '../../utils/logger.js'
import { parseServiceAccountCredentials } from '../../utils/parseCredentials.js'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const escapeQueryValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export function createGoogleDriveDriver({ serviceAccountJson, oauth, rootFolderId, driverName = 'gdrive' }) {
  if (!rootFolderId) throw new Error(`[${driverName}] Missing rootFolderId.`)

  let auth
  if (oauth?.clientId && oauth?.clientSecret && oauth?.refreshToken) {
    auth = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret)
    auth.setCredentials({ refresh_token: oauth.refreshToken })
  } else {
    if (!serviceAccountJson) throw new Error(`[${driverName}] Missing Google credentials.`)
    const credentials = parseServiceAccountCredentials(serviceAccountJson)
    auth = new google.auth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] })
  }
  const drive = google.drive({ version: 'v3', auth })
  // B8: path -> Promise<folder id>. The promise is stored before the lookup finishes, so two
  // uploads to the same new folder at the same moment share one list-or-create instead of
  // each creating their own copy. A failed lookup is evicted so the next upload retries it.
  const folderIds = new Map()

  async function findOrCreateFolder(parentId, name) {
    const listed = await drive.files.list({
      q: `'${escapeQueryValue(parentId)}' in parents and name = '${escapeQueryValue(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    const existing = listed.data.files?.[0]?.id
    if (existing) return existing
    const created = await drive.files.create({
      requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
      fields: 'id',
      supportsAllDrives: true,
    })
    return created.data.id
  }

  async function folderIdFor(folderPath) {
    if (!folderPath) return rootFolderId

    let parentId = rootFolderId
    let cacheKey = ''
    for (const name of String(folderPath).split('/').filter(Boolean)) {
      cacheKey = `${cacheKey}/${name}`
      let pending = folderIds.get(cacheKey)
      if (!pending) {
        const key = cacheKey
        pending = findOrCreateFolder(parentId, name)
        folderIds.set(key, pending)
        pending.catch(() => { if (folderIds.get(key) === pending) folderIds.delete(key) })
      }
      parentId = await pending
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
        `Google Drive upload session creation failed (${err?.code ?? err?.response?.status ?? 'unknown'}): ${responseText}`,
        { cause: err },
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
