import mongoose from 'mongoose'
import { jsonOptions } from '../utils/mongoose.js'
import { storedFileSchema } from './storedFile.js'

const submissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  trimStart: { type: Number, required: true, min: 0 },
  trimEnd: { type: Number, required: true, min: 0 },
  mirrored: { type: Boolean, default: false },
  duration: { type: Number, required: true, min: 0 },
  recording: { type: storedFileSchema, required: true },
}, {
  timestamps: true,
  toJSON: jsonOptions((doc, ret) => {
    ret.userId = String(ret.user)
    ret.videoId = String(ret.video)
    ret.submittedAt = ret.createdAt
    ret.size = ret.recording?.size ?? 0
    ret.mimeType = ret.recording?.mimeType
    for (const key of ['user', 'video', 'recording', 'createdAt', 'updatedAt']) delete ret[key]
    return ret
  }),
})

// Not unique: a contributor may submit the same video more than once over time (see
// SubmissionCooldown for what actually stops two submissions from landing back to back).
// Compound, not just on (user, video), because the cooldown check's only query is
// "this user's most recent submission for this video", sorted by time.
submissionSchema.index({ user: 1, video: 1, createdAt: -1 })
submissionSchema.index({ createdAt: -1 })

export const Submission = mongoose.model('Submission', submissionSchema)
