import { createReadStream } from 'node:fs'
import { google } from 'googleapis'
import { randomUUID } from 'node:crypto'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const escapeQueryValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export function createGoogleDriveDriver({ serviceAccountJson, rootFolderId }) {
  const credentials = JSON.parse(serviceAccountJson)
  const auth = new google.auth.GoogleAuth({ credentials, scopes: [DRIVE_SCOPE] })
  const drive = google.drive({ version: 'v3', auth })
  const folderIds = new Map()

  async function folderIdFor(folderPath) {
    let parentId = rootFolderId
    let cacheKey = ''
    for (const name of folderPath.split('/').filter(Boolean)) {
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
      })
      let id = listed.data.files?.[0]?.id
      if (!id) {
        const created = await drive.files.create({
          requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
          fields: 'id',
        })
        id = created.data.id
      }
      folderIds.set(cacheKey, id)
      parentId = id
    }
    return parentId
  }

  return {
    name: 'gdrive',
    tempDir: null,

    async init() {
      await drive.files.get({ fileId: rootFolderId, fields: 'id, trashed' })
    },

    async save({ tempPath, ext = '', folder, fileName, mimeType }) {
      const parentId = await folderIdFor(folder)
      const suffix = ext ? (ext.startsWith('.') ? ext : `.${ext}`) : ''
      const uploaded = await drive.files.create({
        requestBody: { name: fileName || `${randomUUID()}${suffix}`, parents: [parentId], mimeType },
        media: { mimeType, body: createReadStream(tempPath) },
        fields: 'id',
      })
      return { key: uploaded.data.id }
    },

    async stat(key) {
      const response = await drive.files.get({ fileId: key, fields: 'size' })
      return { size: Number(response.data.size || 0) }
    },

    async createReadStream(key, range) {
      const headers = range ? { Range: `bytes=${range.start}-${range.end}` } : undefined
      const response = await drive.files.get({ fileId: key, alt: 'media' }, { responseType: 'stream', headers })
      return response.data
    },

    async remove(key) {
      try {
        await drive.files.delete({ fileId: key })
      } catch (error) {
        if (error.code !== 404) throw error
      }
    },
  }
}
