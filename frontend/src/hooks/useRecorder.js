import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecordings } from '../context/RecordingContext'
import { MAX_RECORDING_BYTES, MAX_RECORDING_MB, MAX_RECORDING_SECONDS } from '../utils/limits'

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
  const { recordings, saveRecording, removeRecording, cameraStream, requestCamera, releaseCamera } = useRecordings()
  const [status, setStatus] = useState('idle') // idle | requesting | recording
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [notice, setNotice] = useState('')
  const preparedStream = useRef(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const startedAt = useRef(0)
  const recordedBytes = useRef(0)
  const cancelled = useRef(false)

  const prepare = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Recording is not supported in this browser. Try a recent version of Chrome, Edge, Firefox or Safari.')
      return false
    }
    cancelled.current = false
    setError('')
    setStatus('requesting')
    try {
      const media = await requestCamera()
      if (cancelled.current) {
        releaseCamera(media)
        return false
      }
      preparedStream.current = media
      setStatus('idle')
      return true
    } catch (caught) {
      if (cancelled.current) return false
      setError(describeError(caught))
      setStatus('idle')
      return false
    }
  }, [releaseCamera, requestCamera])

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
      recordedBytes.current = 0
      cancelled.current = false
      setNotice('')
      instance.ondataavailable = (event) => {
        if (!event.data.size) return
        chunks.current.push(event.data)
        recordedBytes.current += event.data.size
      }
      instance.onstop = () => {
        clearInterval(timer.current)
        if (!cancelled.current && chunks.current.length) {
          const type = instance.mimeType || mimeType || 'video/webm'
          saveRecording(videoId, {
            blob: new Blob(chunks.current, { type }),
            duration: Math.min(Math.max((Date.now() - startedAt.current) / 1000, 0.5), MAX_RECORDING_SECONDS),
            mimeType: type,
          })
        }
        releaseCamera(media)
        preparedStream.current = null
        recorder.current = null
        setStatus('idle')
      }
      recorder.current = instance
      startedAt.current = Date.now()
      setElapsed(0)
      timer.current = setInterval(() => {
        const seconds = (Date.now() - startedAt.current) / 1000
        setElapsed(Math.min(seconds, MAX_RECORDING_SECONDS))
        const tooLong = seconds >= MAX_RECORDING_SECONDS
        // Leave room for the final MediaRecorder data chunk before reaching the server limit.
        const tooBig = recordedBytes.current >= MAX_RECORDING_BYTES * 0.97
        if ((tooLong || tooBig) && instance.state === 'recording') {
          setNotice(tooLong
            ? `Recording stopped at the ${MAX_RECORDING_SECONDS / 60}-minute limit.`
            : `Recording stopped at the ${MAX_RECORDING_MB} MB upload limit.`)
          instance.stop()
        }
      }, 250)
      instance.start(250)
      setStatus('recording')
      return true
    } catch (caught) {
      releaseCamera(media)
      preparedStream.current = null
      setError(describeError(caught))
      setStatus('idle')
      return false
    }
  }, [cameraStream, releaseCamera, saveRecording, videoId])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const discard = useCallback(() => {
    setError('')
    setNotice('')
    removeRecording(videoId)
  }, [removeRecording, videoId])

  // Leave no active recording or camera stream behind when navigating away.
  useEffect(() => () => {
    cancelled.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    clearInterval(timer.current)
    releaseCamera(preparedStream.current)
    preparedStream.current = null
  }, [releaseCamera])

  return { recording: recordings[videoId] || null, status, error, notice, elapsed, stream: cameraStream, prepare, start, stop, discard }
}
