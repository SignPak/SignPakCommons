import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { RecordingContext } from './RecordingContext'

const revoke = (recording) => { if (recording?.url) URL.revokeObjectURL(recording.url) }

/**
 * Holds unsubmitted recordings in memory, keyed by video id, so a contributor can move
 * between the player and the editor without losing their take. Nothing is persisted:
 * a recording exists only until it is submitted, deleted, or the tab is closed.
 */
export default function RecordingProvider({ children }) {
  const { user } = useAuth()
  const [recordings, setRecordings] = useState({})
  const latest = useRef(recordings)
  const cameraStreamRef = useRef(null)
  const cameraRequest = useRef(null)
  const cameraEpoch = useRef(0)
  const [cameraStream, setCameraStream] = useState(null)
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

  const requestCamera = useCallback(() => {
    const existing = cameraStreamRef.current
    if (existing?.getVideoTracks().some((track) => track.readyState === 'live')) {
      return Promise.resolve(existing)
    }
    if (cameraRequest.current) return cameraRequest.current

    const epoch = cameraEpoch.current
    const request = navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    }).then((stream) => {
      if (epoch !== cameraEpoch.current) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error('Camera request was cancelled.')
      }
      cameraStreamRef.current = stream
      setCameraStream(stream)
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (cameraStreamRef.current !== stream) return
          cameraStreamRef.current = null
          setCameraStream(null)
        }, { once: true })
      })
      return stream
    }).finally(() => {
      if (cameraRequest.current === request) cameraRequest.current = null
    })
    cameraRequest.current = request
    return request
  }, [])

  // Different person logged in on this tab: drop whatever the previous one recorded.
  const userId = user?.id
  useEffect(() => () => {
    cameraEpoch.current += 1
    cameraRequest.current = null
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
    cameraStreamRef.current = null
    setCameraStream(null)
    Object.values(latest.current).forEach(revoke)
    setRecordings({})
  }, [userId])

  const value = useMemo(() => ({ recordings, saveRecording, removeRecording, updateEdit, cameraStream, requestCamera }), [recordings, saveRecording, removeRecording, updateEdit, cameraStream, requestCamera])
  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}
