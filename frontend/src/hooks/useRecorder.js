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

/** Camera + MediaRecorder for one lesson. The finished take is stored in RecordingContext. */
export function useRecorder(videoId) {
  const { recordings, saveRecording, removeRecording } = useRecordings()
  const [status, setStatus] = useState('idle') // idle | requesting | recording
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [stream, setStream] = useState(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const startedAt = useRef(0)
  const cancelled = useRef(false)

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Recording is not supported in this browser. Try a recent version of Chrome, Edge, Firefox or Safari.')
      return false
    }
    setError('')
    setStatus('requesting')
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
      const mimeType = pickMimeType()
      const instance = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      chunks.current = []
      cancelled.current = false
      instance.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      instance.onstop = () => {
        clearInterval(timer.current)
        media.getTracks().forEach((track) => track.stop())
        setStream(null)
        if (!cancelled.current && chunks.current.length) {
          const type = instance.mimeType || mimeType || 'video/webm'
          saveRecording(videoId, { blob: new Blob(chunks.current, { type }), duration: Math.max((Date.now() - startedAt.current) / 1000, 0.5), mimeType: type })
        }
        setStatus('idle')
      }
      recorder.current = instance
      startedAt.current = Date.now()
      setElapsed(0)
      timer.current = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
      instance.start(250)
      setStream(media)
      setStatus('recording')
      return true
    } catch (caught) {
      setError(describeError(caught))
      setStatus('idle')
      return false
    }
  }, [saveRecording, videoId])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const discard = useCallback(() => {
    setError('')
    removeRecording(videoId)
  }, [removeRecording, videoId])

  // Leaving the page mid-take throws the take away and releases the camera.
  useEffect(() => () => {
    cancelled.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    clearInterval(timer.current)
  }, [])

  return { recording: recordings[videoId] || null, status, error, elapsed, stream, start, stop, discard }
}
