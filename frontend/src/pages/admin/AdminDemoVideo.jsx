import { useEffect, useState } from 'react'
import Field from '../../components/Field'
import ResponsiveVideo from '../../components/ResponsiveVideo'
import VideoPrep from '../../components/VideoPrep'
import { Alert, Button } from '../../components/ui'
import { api } from '../../services/api'
import { formatBytes, formatTime } from '../../utils/format'
import { aspectOf } from '../../utils/media'

const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

export default function AdminDemoVideo() {
  const [current, setCurrent] = useState(null)
  const [file, setFile] = useState(null)
  const [prepared, setPrepared] = useState(null) // { file, durationSec, width, height } once muted/trimmed
  const [title, setTitle] = useState('')
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

  const pick = (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    setMessage(null)
    setPrepared(null)
    if (!selected) {
      setFile(null)
      return
    }
    if (!selected.type.startsWith('video/')) {
      setFile(null)
      setMessage({ tone: 'error', text: 'Choose a video file (MP4, WebM or MOV).' })
      return
    }
    setFile(selected)
    setTitle(titleFromFile(selected.name))
  }

  const upload = async (event) => {
    event.preventDefault()
    if (!prepared || !title.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const saved = await api.demoVideo.upload({ file: prepared.file, title: title.trim(), durationSec: prepared.durationSec, width: prepared.width, height: prepared.height })
      setCurrent(saved)
      setFile(null)
      setPrepared(null)
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
          <ResponsiveVideo src={current.videoUrl} aspect={aspectOf(current)} frameClassName="upload-preview" controls muted playsInline preload="metadata" aria-label="Current public demo video" />
          <p className="upload-file"><b>{current.title}</b> · {formatTime(current.durationSec)} · {formatBytes(current.size)}</p>
        </div>
        : <p className="empty-note">No demo video is set. Upload one to show it on the public demo page.</p>}

    <form className="upload" onSubmit={upload} noValidate>
      <div className="upload-drop">
        {file
          ? <>
            <VideoPrep key={`${file.name}-${file.size}-${file.lastModified}`} file={file} label="the selected demo video" onReady={setPrepared} onReset={() => setPrepared(null)} />
            <p className="upload-file"><b>{file.name}</b> · {formatBytes(file.size)} <label className="link-accent">Change<input type="file" accept="video/*" className="sr-only" onChange={pick} /></label></p>
          </>
          : <label className="upload-pick"><span className="display display-sm">Choose a video</span><span>MP4, WebM or MOV, in any shape: phone portrait or landscape.</span><input type="file" accept="video/*" className="sr-only" onChange={pick} /></label>}
      </div>
      <div className="upload-fields">
        <Field label="Demo title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="How to contribute" />
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        {confirmDelete && <div className="confirm">
          <p>Delete the current demo video? The public demo page will show an empty state until another is uploaded.</p>
          <div className="confirm-actions"><Button variant="danger" onClick={remove} disabled={busy}>Yes, delete</Button><Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep video</Button></div>
        </div>}
        <Button type="submit" block disabled={busy || !prepared || !title.trim()}>{busy ? 'Uploading…' : current ? 'Replace demo video' : 'Upload demo video'}</Button>
      </div>
    </form>
  </section>
}
