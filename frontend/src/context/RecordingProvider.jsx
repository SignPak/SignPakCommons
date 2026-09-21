import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { RecordingContext } from './RecordingContext'

const revoke = (recording) => { if (recording?.url) URL.revokeObjectURL(recording.url) }

/**
 * Holds unsubmitted recordings in memory, keyed by video id, so a learner can move
 * between the player and the editor without losing their take. Nothing is persisted:
 * a recording exists only until it is submitted, deleted, or the tab is closed.
 */
export default function RecordingProvider({ children }) {
  const { user } = useAuth()
  const [recordings, setRecordings] = useState({})
  const latest = useRef(recordings)
  useEffect(() => { latest.current = recordings }, [recordings])

  const saveRecording = useCallback((videoId, { blob, duration, mimeType }) => {
    revoke(latest.current[videoId])
    const rounded = Math.round(duration * 10) / 10
    setRecordings((current) => ({
      ...current,
      [videoId]: { blob, duration: rounded, mimeType, url: URL.createObjectURL(blob), edit: { start: 0, end: rounded, mirrored: false } },
    }))
  }, [])

  const removeRecording = useCallback((videoId) => {
    revoke(latest.current[videoId])
    setRecordings((current) => {
      const next = { ...current }
      delete next[videoId]
      return next
    })
  }, [])

  const updateEdit = useCallback((videoId, patch) => {
    setRecordings((current) => (current[videoId]
      ? { ...current, [videoId]: { ...current[videoId], edit: { ...current[videoId].edit, ...patch } } }
      : current))
  }, [])

  // Different person logged in on this tab: drop whatever the previous one recorded.
  const userId = user?.id
  useEffect(() => () => {
    Object.values(latest.current).forEach(revoke)
    setRecordings({})
  }, [userId])

  const value = useMemo(() => ({ recordings, saveRecording, removeRecording, updateEdit }), [recordings, saveRecording, removeRecording, updateEdit])
  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}
