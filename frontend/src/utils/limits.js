/** Client-side recording limits; the backend enforces the upload size independently. */
export const MAX_RECORDING_SECONDS = 600
const configuredMaxRecordingMb = Number(import.meta.env.VITE_MAX_RECORDING_UPLOAD_MB)
export const MAX_RECORDING_MB = Number.isFinite(configuredMaxRecordingMb) && configuredMaxRecordingMb > 0
  ? configuredMaxRecordingMb
  : 100
export const MAX_RECORDING_BYTES = MAX_RECORDING_MB * 1024 * 1024

/** Returns a reason when a recording exceeds a submission limit. */
export function recordingLimitProblem(recording) {
  if (recording?.duration > MAX_RECORDING_SECONDS) {
    return `Recordings can be at most ${MAX_RECORDING_SECONDS / 60} minutes. Record this video again with a shorter take.`
  }
  if (recording?.blob?.size > MAX_RECORDING_BYTES) {
    return `This recording is larger than the ${MAX_RECORDING_MB} MB upload limit. Record this video again with a shorter take.`
  }
  return ''
}
