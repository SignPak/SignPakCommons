import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Must run before anything imports src/config/env.js.
export const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signpak-test-'))
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: process.env.MONGODB_URI_TEST || 'mongodb://placeholder/unused',
  JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  ADMIN_EMAIL: 'admin@signpak.test',
  ADMIN_PASSWORD: 'Admin@12345',
  BCRYPT_ROUNDS: '4',
  RATE_LIMIT_ENABLED: 'false',
  CLIENT_ORIGIN: 'http://localhost:5173',
  UPLOAD_DIR: uploadDir,
  MAX_VIDEO_UPLOAD_MB: '5',
  MAX_RECORDING_UPLOAD_MB: '5',
})

export const webm = (size = 2000) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(size, 7)])
export const mp4 = (size = 2000) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(size, 9)])
export const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)])

/** Tiny fetch wrapper with a cookie jar, so each Client behaves like one browser. */
export class Client {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookies = new Map() }

  async request(method, url, { json, form, headers = {}, raw = false } = {}) {
    const init = { method, headers: { ...headers } }
    if (this.cookies.size) init.headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    if (json !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(json) }
    if (form) init.body = form
    const res = await fetch(this.baseUrl + url, init)
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';')
      const [name, value] = pair.split('=')
      const expired = attrs.some((a) => /^\s*(max-age=0|expires=thu, 01 jan 1970)/i.test(a))
      if (expired || !value) this.cookies.delete(name.trim()); else this.cookies.set(name.trim(), value)
    }
    const type = res.headers.get('content-type') || ''
    const body = raw ? Buffer.from(await res.arrayBuffer()) : type.includes('json') ? await res.json() : await res.text()
    return { status: res.status, body, headers: res.headers, setCookie: res.headers.getSetCookie() }
  }

  get = (url, options) => this.request('GET', url, options)
  post = (url, json, options) => this.request('POST', url, { json, ...options })
  patch = (url, json, options) => this.request('PATCH', url, { json, ...options })
  delete = (url, options) => this.request('DELETE', url, options)
  upload = (url, form, options) => this.request('POST', url, { form, ...options })
}

export const videoForm = (fields, { video = webm(), poster } = {}) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  if (video) form.append('video', new Blob([video], { type: 'video/webm' }), 'lesson.webm')
  if (poster) form.append('poster', new Blob([poster], { type: 'image/jpeg' }), 'poster.jpg')
  return form
}

export const recordingForm = (fields, { file = webm(3000), type = 'video/webm' } = {}) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  if (file) form.append('recording', new Blob([file], { type }), 'take.webm')
  return form
}

export const filesIn = (folder) => {
  const dir = path.join(uploadDir, folder)
  return fs.existsSync(dir) ? fs.readdirSync(dir) : []
}
