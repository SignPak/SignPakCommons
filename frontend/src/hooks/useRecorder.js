import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecordings } from '../context/RecordingContext'

const MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
const pickMimeType = () => MIME_CANDIDATES.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''

function describeError(error) {
  if (error?.name === 'NotAllowedError') return 'Camera access was blocked. Allow the camera in your browser settings, then try again.'
  if (error?.name === 'NotFoundError') return 'No camera was found. Connect one and try again.'
  if (error?.name === 'NotReadableError') return 'Your camera is being used by another app. Close it and try again.'
  return 'We could not start the camera. Check your browser permissions and try again.'
}

/** Camera + MediaRecorder for one video. The finished take is stored in RecordingContext. */
export function useRecorder(videoId) {
  const { recordings, saveRecording, removeRecording, cameraStream, requestCamera } = useRecordings()
  const [status, setStatus] = useState('idle') // idle | requesting | recording
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const preparedStream = useRef(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const startedAt = useRef(0)
  const cancelled = useRef(false)

  const prepare = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Recording is not supported in this browser. Try a recent version of Chrome, Edge, Firefox or Safari.')
      return false
    }
    setError('')
    setStatus('requesting')
    try {
      preparedStream.current = await requestCamera()
      setStatus('idle')
      return true
    } catch (caught) {
      setError(describeError(caught))
      setStatus('idle')
      return false
    }
  }, [requestCamera])

  const start = useCallback(async () => {
    const media = preparedStream.current || cameraStream
    if (!media?.getVideoTracks().some((track) => track.readyState === 'live')) {
      setError('Camera access is no longer available. Allow camera access and try again.')
      return false
    }
    setError('')
    try {
      const mimeType = pickMimeType()
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      chunks.current = []
      cancelled.current = false
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      instance.onstop = () => {
        clearInterval(timer.current)
        if (!cancelled.current && chunks.current.length) {
          const type = instance.mimeType || mimeType || 'video/webm'
          saveRecording(videoId, { blob: new Blob(chunks.current, { type }), duration: Math.max((Date.now() - startedAt.current) / 1000, 0.5), mimeType: type })
        }
        recorder.current = null
        setStatus('idle')
      }
      recorder.current = instance
      startedAt.current = Date.now()
      setElapsed(0)
      timer.current = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
      instance.start(250)
      setStatus('recording')
      return true
    } catch (caught) {
      setError(describeError(caught))
      setStatus('idle')
      return false
    }
  }, [cameraStream, saveRecording, videoId])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const discard = useCallback(() => {
    setError('')
    removeRecording(videoId)
  }, [removeRecording, videoId])

  // Leaving the page mid-take discards that take; the shared camera stream stays available.
  useEffect(() => () => {
    cancelled.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    clearInterval(timer.current)
  }, [])

  return { recording: recordings[videoId] || null, status, error, elapsed, stream: cameraStream, prepare, start, stop, discard }
}
