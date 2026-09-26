import mongoose from 'mongoose'
import { API_PREFIX } from '../config/constants.js'
import { jsonOptions } from '../utils/mongoose.js'
import { storedFileSchema } from './storedFile.js'

const demoVideoSchema = new mongoose.Schema({
  _id: { type: String, default: 'current' },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  durationSec: { type: Number, default: 0, min: 0 },
  videoFile: { type: storedFileSchema, required: true },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => {
    ret.videoUrl = `${API_PREFIX}/demo-video/file`
    ret.size = ret.videoFile?.size ?? 0
    delete ret.videoFile
    delete ret.updatedAt
    return ret
  }),
})

export const DemoVideo = mongoose.model('DemoVideo', demoVideoSchema)
