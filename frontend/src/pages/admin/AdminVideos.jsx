import { useState } from 'react'
import AdminDemoVideo from './AdminDemoVideo'
import Field from '../../components/Field'
import ResponsiveVideo from '../../components/ResponsiveVideo'
import VideoPrep from '../../components/VideoPrep'
import { Alert, Badge, Button, SectionHeading, VideoArtwork } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { formatBytes, formatTime } from '../../utils/format'
import { aspectOf } from '../../utils/media'

const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
const POSTER_MAX_BYTES = 2 * 1024 * 1024

export default function AdminVideos() {
  const { videos, categories, editVideo } = useLibrary()
  const [filter, setFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkCategoryId, setBulkCategoryId] = useState('')
  const [bulkError, setBulkError] = useState('')

  const shown = videos
    .filter((video) => video.title.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt)

  const toggleSelected = (videoId) => {
    setSelectedIds((current) => current.includes(videoId) ? current.filter((item) => item !== videoId) : [...current, videoId])
    setBulkError('')
  }

  const bulkMove = async () => {
    if (!selectedIds.length) {
      setBulkError('Select at least one video before moving it.')
      return
    }

    const targetCategoryId = bulkCategoryId || null
    await Promise.all(selectedIds.map((videoId) => {
      const video = videos.find((item) => item.id === videoId)
      if (!video) return Promise.resolve()
      const targetVideos = videos.filter((item) => item.categoryId === targetCategoryId && item.id !== videoId)
      const order = targetCategoryId ? Math.max(0, ...targetVideos.map((item) => item.order || 0)) + 1 : video.order || 0
      return editVideo(videoId, { categoryId: targetCategoryId, order })
    }))

    setSelectedIds([])
    setBulkCategoryId('')
    setBulkError('')
  }

  return <>
    <AdminDemoVideo />
    <UploadPanel />
    <section className="panel">
      <SectionHeading
        eyebrow="Content library"
        title="Base videos."
        action={<div className="admin-toolbar"><input className="inline-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search videos" aria-label="Search videos" /><span className="panel-note">{selectedIds.length} selected</span></div>}
      />

      {selectedIds.length > 0 && <div className="bulk-actions">
        <Field as="select" label="Move to" value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
          <option value="">Unassigned</option>
          {categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Field>
        <Button onClick={bulkMove}>Apply</Button>
        <Button variant="outline" onClick={() => { setSelectedIds([]); setBulkCategoryId(''); setBulkError('') }}>Clear</Button>
      </div>}

      {bulkError && <Alert tone="error">{bulkError}</Alert>}

      {shown.length
        ? <ul className="video-list">{shown.map((video) => <VideoRow key={video.id} video={video} videos={videos} categories={categories} selected={selectedIds.includes(video.id)} onToggleSelect={toggleSelected} />)}</ul>
        : <p className="empty-note">{videos.length ? 'No videos match that search.' : 'No videos yet. Upload the first one above.'}</p>}
    </section>
  </>
}

function UploadPanel() {
  const { categories, addVideo } = useLibrary()
  const [file, setFile] = useState(null)
  const [prepared, setPrepared] = useState(null) // { file, durationSec, width, height, poster } once muted/trimmed
  const [posterFile, setPosterFile] = useState(null)
  const [useAutoFrame, setUseAutoFrame] = useState(false)
  const [sourceType, setSourceType] = useState('upload')
  const [form, setForm] = useState({ title: '', categoryId: '', status: 'published' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const clear = () => { setFile(null); setPrepared(null); setPosterFile(null); setUseAutoFrame(false) }

  const pick = (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    setMessage(null)
    setPrepared(null)
    setPosterFile(null)
    setUseAutoFrame(false)
    if (!chosen) { setFile(null); return }
    if (!chosen.type.startsWith('video/')) {
      setFile(null)
      setMessage({ tone: 'error', text: 'Choose a video file (MP4, WebM or MOV).' })
      return
    }
    setFile(chosen)
    setForm((current) => ({ ...current, title: current.title || titleFromFile(chosen.name) }))
  }

  const pickPoster = (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    setMessage(null)
    if (!chosen) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)) {
      setPosterFile(null)
      setMessage({ tone: 'error', text: 'Choose a JPEG, PNG or WebP poster image.' })
      return
    }
    if (chosen.size > POSTER_MAX_BYTES) {
      setPosterFile(null)
      setMessage({ tone: 'error', text: 'Poster images must be no larger than 2 MB.' })
      return
    }
    setPosterFile(chosen)
    setUseAutoFrame(false)
  }

  const toggleAutoFrame = (event) => {
    const checked = event.target.checked
    setUseAutoFrame(checked)
    if (checked) setPosterFile(null)
    setMessage(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    const usingUrl = sourceType === 'url'
    if (usingUrl && !(form.videoUrl || '').trim()) { setMessage({ tone: 'error', text: 'Enter a direct HTTPS video URL.' }); return }
    if (!usingUrl && !file) { setMessage({ tone: 'error', text: 'Choose a video to upload first.' }); return }
    if (!usingUrl && !prepared) { setMessage({ tone: 'error', text: 'Review the video and choose “Apply changes” first.' }); return }
    if (!posterFile && (usingUrl || !useAutoFrame)) { setMessage({ tone: 'error', text: 'Choose a poster image before adding this video.' }); return }
    if (!usingUrl && useAutoFrame && !prepared.poster) { setMessage({ tone: 'error', text: 'A frame could not be generated. Choose a poster image instead.' }); return }
    if (!form.title.trim()) { setMessage({ tone: 'error', text: 'Give the video a title.' }); return }
    setBusy(true)
    try {
      await addVideo({
        ...form,
        videoUrl: usingUrl ? form.videoUrl.trim() : '',
        file: usingUrl ? null : prepared.file,
        durationSec: prepared?.durationSec || 0,
        width: prepared?.width || 0,
        height: prepared?.height || 0,
        poster: posterFile || (!usingUrl ? prepared?.poster : null),
      })
      setMessage({ tone: 'success', text: `“${form.title.trim()}” added${form.status === 'published' && form.categoryId ? ' and live for contributors.' : '. Assign a category and publish it to make it visible.'}` })
      clear()
      setForm({ title: '', categoryId: '', status: 'published' })
    } catch (error) {
      setMessage({ tone: 'error', text: error?.message || 'The upload failed. Check that your browser has storage space and try again.' })
    } finally { setBusy(false) }
  }

  return <section className="panel">
    <SectionHeading eyebrow="Add a base video" title="Upload or link a video." />
    <form className="upload" onSubmit={submit} noValidate>
      <div className="upload-drop">
        {sourceType === 'url'
          ? <div className="upload-fields">
            <Field
              label="Direct HTTPS video URL"
              name="videoUrl"
              type="url"
              value={form.videoUrl || ''}
              onChange={change}
              placeholder="https://example.com/video.mp4"
              hint="Use a direct MP4 or WebM file URL, not a YouTube/watch-page link. Browser-side caching requires the source to allow CORS; native video playback may still work without it."
            />
          </div>
          : file
          ? <>
            <VideoPrep key={`${file.name}-${file.size}-${file.lastModified}`} file={file} label="the selected video" onReady={setPrepared} onReset={() => setPrepared(null)} />
            <p className="upload-file"><b>{file.name}</b> · {formatBytes(file.size)} <label className="link-accent">Change<input type="file" accept="video/*" className="sr-only" onChange={pick} /></label></p>
          </>
          : <label className="upload-pick"><span className="display display-sm">Choose a video</span><span>MP4, WebM or MOV, in any shape: phone portrait or landscape.</span><input type="file" accept="video/*" className="sr-only" onChange={pick} /></label>}
      </div>
      <div className="upload-fields">
        <Field as="select" label="Video source" value={sourceType} onChange={(event) => {
          const nextSource = event.target.value
          setSourceType(nextSource)
          setMessage(null)
          if (nextSource === 'url') setUseAutoFrame(false)
        }}>
          <option value="upload">Upload a video file</option>
          <option value="url">Use an external video URL</option>
        </Field>
        <Field label="Title" name="title" value={form.title} onChange={change} placeholder="e.g. Nice to meet you" />
        <Field as="select" label="Category" name="categoryId" value={form.categoryId} onChange={change}><option value="">Unassigned</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Field>
        <Field as="select" label="Visibility" name="status" value={form.status} onChange={change}><option value="published">Published: contributors can see it</option><option value="draft">Draft: only admins can see it</option></Field>
        <Field
          className="field-wide"
          label="Poster image (JPEG, PNG or WebP; up to 2 MB)"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={pickPoster}
          disabled={busy || (sourceType === 'upload' && useAutoFrame)}
        />
        {posterFile && <p className="field-hint field-wide">Selected poster: {posterFile.name}</p>}
        {sourceType === 'upload' && <>
          <label className="toggle field-wide">
            <span>Use an auto-generated frame from this video as its poster</span>
            <input type="checkbox" checked={useAutoFrame} onChange={toggleAutoFrame} disabled={busy || !prepared?.poster} />
          </label>
          {prepared && !prepared.poster && <p className="field-hint field-wide">A frame could not be generated from this video; choose a poster image instead.</p>}
        </>}
        <p className="field-hint field-wide">{sourceType === 'url' ? 'Poster images are uploaded to the configured storage provider (Google Drive when STORAGE_DRIVER=gdrive).' : 'Choose a poster image above or use a frame from the uploaded video.'}</p>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <Button type="submit" block disabled={busy || (sourceType === 'upload' && !prepared) || (sourceType === 'url' && !form.videoUrl?.trim()) || (!posterFile && !(sourceType === 'upload' && useAutoFrame))}>{busy ? 'Saving…' : sourceType === 'url' ? 'Add video URL' : 'Upload video'}</Button>
        {sourceType === 'upload' && !prepared && <p className="field-hint">{file ? 'Remove sound, trim if needed, then choose “Apply changes” to enable the upload.' : 'Select a file to enable the upload action.'}</p>}
      </div>
    </form>
  </section>
}

function VideoRow({ video, videos, categories, selected, onToggleSelect }) {
  const { editVideo, deleteVideo } = useLibrary()
  const [mode, setMode] = useState('view') // view | edit | preview | delete
  const [draft, setDraft] = useState({ title: video.title, categoryId: video.categoryId || '', status: video.status })
  const category = categories.find((item) => item.id === video.categoryId)
  const change = (event) => setDraft((current) => ({ ...current, [event.target.name]: event.target.value }))

  const moveToCategory = async (nextCategoryId) => {
    const targetVideos = videos.filter((item) => item.categoryId === nextCategoryId && item.id !== video.id)
    const order = nextCategoryId ? Math.max(0, ...targetVideos.map((item) => item.order || 0)) + 1 : video.order || 0
    await editVideo(video.id, { categoryId: nextCategoryId || null, order })
  }

  const save = async () => {
    if (!draft.title.trim()) return
    await editVideo(video.id, {
      ...draft,
      title: draft.title.trim(),
      categoryId: draft.categoryId || null,
      order: draft.categoryId ? Math.max(0, ...videos.filter((item) => item.categoryId === draft.categoryId && item.id !== video.id).map((item) => item.order || 0)) + 1 : video.order || 0,
    })
    setMode('view')
  }

  return <li className="video-row">
    <div className="video-row-main">
      <label className="row-select"><input type="checkbox" checked={selected} onChange={() => onToggleSelect(video.id)} aria-label={`Select ${video.title}`} /></label>
      <VideoArtwork video={video} className="video-row-thumb" />
      <div className="video-row-info"><b className="display display-sm">{video.title}</b><small>{category?.label || 'Unassigned'} · {formatTime(video.durationSec)}{video.width && video.height ? ` · ${video.width}×${video.height}` : ''}</small></div>
      <Badge tone={video.status === 'published' ? 'success' : 'neutral'}>{video.status === 'published' ? 'Published' : 'Draft'}</Badge>
      <div className="row-actions">
        <button type="button" onClick={() => setMode(mode === 'preview' ? 'view' : 'preview')}>{mode === 'preview' ? 'Close preview' : 'Preview'}</button>
        <button type="button" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>Edit</button>
        <button type="button" onClick={() => editVideo(video.id, { status: video.status === 'published' ? 'draft' : 'published' })}>{video.status === 'published' ? 'Unpublish' : 'Publish'}</button>
        <button type="button" className="is-danger" onClick={() => setMode('delete')}>Delete</button>
      </div>
    </div>
    {mode === 'preview' && (video.videoUrl ? <ResponsiveVideo src={video.videoUrl} aspect={aspectOf(video)} frameClassName="video-row-preview" crossOrigin={video.videoSource === 'external' ? undefined : 'use-credentials'} controls muted playsInline aria-label={`Preview of ${video.title}`} /> : <Alert tone="error">This video's file is missing from this browser.</Alert>)}
    {mode === 'edit' && <div className="video-row-edit">
      <Field label="Title" name="title" value={draft.title} onChange={change} />
      <Field as="select" label="Category" name="categoryId" value={draft.categoryId} onChange={change}><option value="">Unassigned</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Field>
      <Field as="select" label="Visibility" name="status" value={draft.status} onChange={change}><option value="published">Published</option><option value="draft">Draft</option></Field>
      <div className="row-form-actions"><Button onClick={save}>Save changes</Button><Button variant="outline" onClick={() => setMode('view')}>Cancel</Button></div>
      <div className="field-wide admin-inline-move"><label className="field-label">Quick move</label><div className="inline-action-row"><select value={video.categoryId || ''} onChange={(event) => { moveToCategory(event.target.value); setMode('view') }} className="field-control"><option value="">Unassigned</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div></div>
    </div>}
    {mode === 'delete' && <div className="confirm">
      <p>Delete “{video.title}”? Contributors will no longer see it. Their past submissions stay on record.</p>
      <div className="confirm-actions"><Button variant="danger" onClick={() => deleteVideo(video.id)}>Delete video</Button><Button variant="outline" onClick={() => setMode('view')}>Keep it</Button></div>
    </div>}
  </li>
}
