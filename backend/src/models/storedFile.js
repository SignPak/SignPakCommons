import mongoose from 'mongoose'

/**
 * Pointer to a file held by a storage driver. Only this is stored in MongoDB, never the bytes.
 * `driver` + `key` are enough to find the file again, even after the default driver changes.
 */
export const storedFileSchema = new mongoose.Schema({
  driver: { type: String, required: true },
  key: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true, min: 0 },
  originalName: { type: String, default: '' },
  archivePath: { type: String, default: null },
}, { _id: false })
