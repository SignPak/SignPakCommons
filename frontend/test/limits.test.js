import { describe, expect, it } from 'vitest'
import { MAX_RECORDING_BYTES, MAX_RECORDING_SECONDS, recordingLimitProblem } from '../src/utils/limits'

describe('recordingLimitProblem', () => {
  it('accepts a recording exactly at both limits', () => {
    expect(recordingLimitProblem({ duration: MAX_RECORDING_SECONDS, blob: { size: MAX_RECORDING_BYTES } })).toBe('')
  })

  it('rejects a recording longer than ten minutes', () => {
    expect(recordingLimitProblem({ duration: MAX_RECORDING_SECONDS + 1, blob: { size: 1 } })).toMatch(/10 minutes/)
  })

  it('rejects a recording larger than the configured upload limit', () => {
    expect(recordingLimitProblem({ duration: 5, blob: { size: MAX_RECORDING_BYTES + 1 } })).toMatch(/upload limit/)
  })
})
