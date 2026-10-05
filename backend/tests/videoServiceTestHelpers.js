import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.STORAGE_DRIVER = 'local'
process.env.ARCHIVE_STORAGE_DRIVER = 'local'
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `signpak-storage-test-${process.pid}`)
process.env.MONGODB_URI = 'mongodb://127.0.0.1/signpak-test'
process.env.JWT_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters'
process.env.ADMIN_EMAIL = 'admin@example.com'
process.env.ADMIN_PASSWORD = 'test-password-123'

export const [{ videoService }, { categoryRepo }, { videoRepo }, { storageService }] =
  await Promise.all([
    import('../src/services/videoService.js'),
    import('../src/repositories/categoryRepo.js'),
    import('../src/repositories/videoRepo.js'),
    import('../src/services/storage/index.js'),
  ])

export async function temporaryDirectory(t) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'signpak-test-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  return directory
}

export function replace(t, object, property, value) {
  const original = object[property]
  object[property] = value
  t.after(() => { object[property] = original })
}

export async function writeVideo(directory, name = 'upload.mp4', type = 'mp4') {
  const filePath = path.join(directory, name)
  const brand = type === 'mov' ? 'qt  ' : 'isom'
  const header = type === 'webm'
    ? Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
    : Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('ftyp'), Buffer.from(brand)])
  await fs.promises.writeFile(filePath, header)
  return { path: filePath, originalname: name, size: header.length }
}

export async function writeImage(directory, name, type = 'jpeg') {
  const filePath = path.join(directory, name)
  const image = {
    jpeg: Buffer.from([0xff, 0xd8, 0xff, 0]),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
    webp: Buffer.from('RIFF0000WEBP'),
  }[type]
  await fs.promises.writeFile(filePath, image)
  return { path: filePath, originalname: name, size: image.length }
}
