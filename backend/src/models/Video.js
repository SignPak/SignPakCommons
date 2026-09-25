import mongoose from 'mongoose'
import { API_PREFIX, VIDEO_STATUS, VIDEO_STATUS_LIST } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'
import { storedFileSchema } from './storedFile.js'

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: VIDEO_STATUS_LIST, default: VIDEO_STATUS.PUBLISHED },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  order: { type: Number, default: 1, min: 0 },
  durationSec: { type: Number, default: 0, min: 0 },
  videoFile: { type: storedFileSchema, required: true },
  posterFile: { type: storedFileSchema, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  // The API exposes playable URLs, never storage keys.
  toJSON: jsonOptions((doc, ret) => {
    const base = `${API_PREFIX}/videos/${ret.id}`
    ret.categoryId = ret.category ? String(ret.category) : null
    ret.videoUrl = `${base}/file`
    ret.poster = ret.posterFile ? `${base}/poster` : null
    ret.size = ret.videoFile?.size ?? 0
    for (const key of ['category', 'videoFile', 'posterFile', 'createdBy', 'updatedAt']) delete ret[key]
    return ret
  }),
})

videoSchema.index({ status: 1, category: 1, order: 1 })

export const Video = mongoose.model('Video', videoSchema)
