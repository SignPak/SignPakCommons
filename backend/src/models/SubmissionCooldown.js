import mongoose from 'mongoose'

/**
 * One document per (user, video) pair, tracking when that pair is next allowed to submit.
 * This is what actually enforces the cooldown, atomically: see
 * repositories/submissionRepo.js#claimCooldown for how the unique index below is used as a
 * compare-and-swap so two simultaneous submissions for the same video cannot both win, the
 * same trick the old one-submission-ever rule used, just against a time window instead of
 * forever.
 */
const submissionCooldownSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  lockedUntil: { type: Date, required: true },
}, { versionKey: false })

submissionCooldownSchema.index({ user: 1, video: 1 }, { unique: true })

export const SubmissionCooldown = mongoose.model('SubmissionCooldown', submissionCooldownSchema)
