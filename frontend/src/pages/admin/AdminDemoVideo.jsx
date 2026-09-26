import { useEffect, useState } from 'react'
import Field from '../../components/Field'
import { Alert, Button } from '../../components/ui'
import { api } from '../../services/api'
import { formatBytes, formatTime } from '../../utils/format'
import { inspectVideoFile } from '../../utils/media'

const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

export default function AdminDemoVideo() {
  const [current, setCurrent] = useState(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [title, setTitle] = useState('')
  const [durationSec, setDurationSec] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let active = true
    api.demoVideo.get()
      .then((video) => { if (active) setCurrent(video) })
      .catch((error) => { if (active) setMessage({ tone: 'error', text: error.message || 'Could not load the demo video.' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const pick = async (event) => {
    const selected = event.target.files?.[0]
    setMessage(null)
    if (!selected) {
      setFile(null)
      setPreviewUrl('')
      return
    }
    if (!selected.type.startsWith('video/')) {
      setFile(null)
      setPreviewUrl('')
      setMessage({ tone: 'error', text: 'Choose a video file (MP4, WebM or MOV).' })
      return
    }
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setTitle(titleFromFile(selected.name))
    setDurationSec((await inspectVideoFile(selected)).durationSec)
  }

  const upload = async (event) => {
    event.preventDefault()
    if (!file || !title.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const saved = await api.demoVideo.upload({ file, title: title.trim(), durationSec })
      setCurrent(saved)
      setFile(null)
      setPreviewUrl('')
      setMessage({ tone: 'success', text: 'Demo video uploaded and live on the public demo page.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error.message || 'The demo video could not be uploaded.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await api.demoVideo.remove()
      setCurrent(null)
      setConfirmDelete(false)
      setMessage({ tone: 'success', text: 'Demo video deleted from the public demo page.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error.message || 'The demo video could not be deleted.' })
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel">
    <div className="section-heading">
      <div><p className="eyebrow">Public walkthrough</p><h2 className="display display-md">Demo page video.</h2></div>
      {current && !confirmDelete && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete demo video</Button>}
    </div>

    {loading
      ? <p className="empty-note" role="status">Loading demo video…</p>
      : current
        ? <div className="demo-admin-current">
          <video src={current.videoUrl} controls playsInline preload="metadata" className="upload-preview" aria-label="Current public demo video" />
          <p className="upload-file"><b>{current.title}</b> · {formatTime(current.durationSec)} · {formatBytes(current.size)}</p>
        </div>
        : <p className="empty-note">No demo video is set. Upload one to show it on the public demo page.</p>}

    <form className="upload" onSubmit={upload} noValidate>
      <div className="upload-drop">
        {previewUrl
          ? <video src={previewUrl} controls playsInline className="upload-preview" aria-label="Preview of the selected demo video" />
          : <label className="upload-pick"><span className="display display-sm">Choose a video</span><span>MP4, WebM or MOV from this device.</span><input type="file" accept="video/*" className="sr-only" onChange={pick} /></label>}
        {file && <p className="upload-file"><b>{file.name}</b> · {formatBytes(file.size)} · {formatTime(durationSec)} <label className="link-accent">Change<input type="file" accept="video/*" className="sr-only" onChange={pick} /></label></p>}
      </div>
      <div className="upload-fields">
        <Field label="Demo title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="How to contribute" />
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {confirmDelete && <div className="confirm">
          <p>Delete the current demo video? The public demo page will show an empty state until another is uploaded.</p>
          <div className="confirm-actions"><Button variant="danger" onClick={remove} disabled={busy}>Yes, delete</Button><Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep video</Button></div>
        </div>}
        <Button type="submit" block disabled={busy || !file || !title.trim()}>{busy ? 'Uploading…' : current ? 'Replace demo video' : 'Upload demo video'}</Button>
      </div>
    </form>
  </section>
}
