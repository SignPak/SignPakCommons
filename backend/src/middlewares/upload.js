import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { env } from '../config/env.js'
import { storageService } from '../services/storage/index.js'
import { validationError } from '../utils/AppError.js'

// Uploads land in a temp folder first. Services check the file's real type, then hand it to storage.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageService.tempDir),
  filename: (req, file, cb) => cb(null, randomUUID()),
})

const allow = (rules) => (req, file, cb) => {
  const prefix = rules[file.fieldname]
  if (!prefix) return cb(validationError({ [file.fieldname]: 'Unexpected file.' }))
  if (!file.mimetype.startsWith(prefix)) return cb(validationError({ [file.fieldname]: `Upload a ${prefix.replace('/', '')} file.` }))
  return cb(null, true)
}

const build = ({ maxMb, rules, files }) => multer({
  storage,
  fileFilter: allow(rules),
  limits: { fileSize: maxMb * 1024 * 1024, files, fields: 20, fieldSize: 10 * 1024 },
})

/** Base video (+ optional poster image) for the admin library. */
export const videoUpload = build({ maxMb: env.MAX_VIDEO_UPLOAD_MB, rules: { video: 'video/', poster: 'image/' }, files: 2 })
  .fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }])

/** A learner's recording. */
export const recordingUpload = build({ maxMb: env.MAX_RECORDING_UPLOAD_MB, rules: { recording: 'video/' }, files: 1 }).single('recording')
