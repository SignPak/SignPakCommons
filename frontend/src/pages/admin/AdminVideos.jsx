import { useState } from 'react'
import Field from '../../components/Field'
import { Alert, Badge, Button, SectionHeading, VideoArtwork } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { LEVELS } from '../../mock/data'
import { formatBytes, formatTime } from '../../utils/format'
import { inspectVideoFile } from '../../utils/media'

const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()

export default function AdminVideos() {
  const { videos, categories } = useLibrary()
  const [filter, setFilter] = useState('')
  const shown = videos
    .filter((video) => video.title.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt)

  return <>
    <UploadPanel />
    <section className="panel">
      <SectionHeading eyebrow="Content library" title="Base videos." action={<input className="inline-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search videos" aria-label="Search videos" />} />
      {shown.length
        ? <ul className="video-list">{shown.map((video) => <VideoRow key={video.id} video={video} categories={categories} />)}</ul>
        : <p className="empty-note">{videos.length ? 'No videos match that search.' : 'No videos yet. Upload the first one above.'}</p>}
    </section>
  </>
}

function UploadPanel() {
  const { categories, addVideo } = useLibrary()
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [meta, setMeta] = useState({ durationSec: 0, poster: '' })
  const [form, setForm] = useState({ title: '', categoryId: '', level: LEVELS[0], status: 'published' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const pick = async (event) => {
    const chosen = event.target.files?.[0]
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setMessage(null)
    if (!chosen) { setFile(null); setPreviewUrl(''); return }
    if (!chosen.type.startsWith('video/')) {
      setFile(null); setPreviewUrl('')
      setMessage({ tone: 'error', text: 'Choose a video file (MP4, WebM or MOV).' })
      return
    }
    setFile(chosen)
    setPreviewUrl(URL.createObjectURL(chosen))
    setForm((current) => ({ ...current, title: current.title || titleFromFile(chosen.name) }))
    setMeta(await inspectVideoFile(chosen))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!file) { setMessage({ tone: 'error', text: 'Choose a video to upload first.' }); return }
    if (!form.title.trim()) { setMessage({ tone: 'error', text: 'Give the video a title.' }); return }
    setBusy(true)
    try {
      await addVideo({ file, ...form, ...meta })
      setMessage({ tone: 'success', text: `“${form.title.trim()}” uploaded${form.status === 'published' && form.categoryId ? ' and live for contributors.' : '. Assign a category and publish it to make it visible.'}` })
      URL.revokeObjectURL(previewUrl)
      setFile(null); setPreviewUrl(''); setForm({ title: '', categoryId: '', level: LEVELS[0], status: 'published' })
    } catch {
      setMessage({ tone: 'error', text: 'The upload failed. Check that your browser has storage space and try again.' })
    } finally { setBusy(false) }
  }

  return <section className="panel">
    <SectionHeading eyebrow="Add a base video" title="Upload and review." />
    <form className="upload" onSubmit={submit} noValidate>
      <div className="upload-drop">
        {previewUrl
          ? <video src={previewUrl} controls playsInline className="upload-preview" aria-label="Preview of the selected video" />
          : <label className="upload-pick"><span className="display display-sm">Choose a video</span><span>MP4, WebM or MOV from this device.</span><input type="file" accept="video/*" className="sr-only" onChange={pick} /></label>}
        {file && <p className="upload-file"><b>{file.name}</b> · {formatBytes(file.size)} · {formatTime(meta.durationSec)} <label className="link-accent">Change<input type="file" accept="video/*" className="sr-only" onChange={pick} /></label></p>}
      </div>
      <div className="upload-fields">
        <Field label="Title" name="title" value={form.title} onChange={change} placeholder="e.g. Nice to meet you" />
        <div className="field-row">
          <Field as="select" label="Category" name="categoryId" value={form.categoryId} onChange={change}><option value="">Unassigned</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Field>
          <Field as="select" label="Level" name="level" value={form.level} onChange={change}>{LEVELS.map((item) => <option key={item}>{item}</option>)}</Field>
        </div>
        <Field as="select" label="Visibility" name="status" value={form.status} onChange={change}><option value="published">Published: contributors can see it</option><option value="draft">Draft: only admins can see it</option></Field>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" block disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload video'}</Button>
      </div>
    </form>
  </section>
}

function VideoRow({ video, categories }) {
  const { editVideo, deleteVideo } = useLibrary()
  const [mode, setMode] = useState('view') // view | edit | preview | delete
  const [draft, setDraft] = useState({ title: video.title, level: video.level, categoryId: video.categoryId || '', status: video.status })
  const category = categories.find((item) => item.id === video.categoryId)
  const change = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))
  const save = async () => {
    if (!draft.title.trim()) return
    await editVideo(video.id, { ...draft, title: draft.title.trim(), categoryId: draft.categoryId || null })
    setMode('view')
  }

  return <li className="video-row">
    <div className="video-row-main">
      <VideoArtwork video={video} className="video-row-thumb" />
      <div className="video-row-info"><b className="display display-sm">{video.title}</b><small>{category?.label || 'Unassigned'} · {video.level} · {formatTime(video.durationSec)}</small></div>
      <Badge tone={video.status === 'published' ? 'success' : 'neutral'}>{video.status === 'published' ? 'Published' : 'Draft'}</Badge>
      <div className="row-actions">
        <button type="button" onClick={() => setMode(mode === 'preview' ? 'view' : 'preview')}>{mode === 'preview' ? 'Close preview' : 'Preview'}</button>
        <button type="button" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>Edit</button>
        <button type="button" onClick={() => editVideo(video.id, { status: video.status === 'published' ? 'draft' : 'published' })}>{video.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        <button type="button" className="is-danger" onClick={() => setMode('delete')}>Delete</button>
      </div>
    </div>
    {mode === 'preview' && (video.videoUrl ? <video src={video.videoUrl} controls playsInline className="video-row-preview" aria-label={`Preview of ${video.title}`} /> : <Alert tone="error">This video's file is missing from this browser.</Alert>)}
    {mode === 'edit' && <div className="video-row-edit">
      <Field label="Title" name="title" value={draft.title} onChange={change} />
      <Field as="select" label="Category" name="categoryId" value={draft.categoryId} onChange={change}><option value="">Unassigned</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Field>
      <Field as="select" label="Level" name="level" value={draft.level} onChange={change}>{LEVELS.map((item) => <option key={item}>{item}</option>)}</Field>
      <Field as="select" label="Visibility" name="status" value={draft.status} onChange={change}><option value="published">Published</option><option value="draft">Draft</option></Field>
      <div className="row-form-actions"><Button onClick={save}>Save changes</Button><Button variant="outline" onClick={() => setMode('view')}>Cancel</Button></div>
    </div>}
    {mode === 'delete' && <div className="confirm">
      <p>Delete “{video.title}”? Contributors will no longer see it. Their past submissions stay on record.</p>
      <div className="confirm-actions"><Button variant="danger" onClick={() => deleteVideo(video.id)}>Delete video</Button><Button variant="outline" onClick={() => setMode('view')}>Keep it</Button></div>
    </div>}
  </li>
}
