import { useState } from 'react'
import Field from '../../components/Field'
import { Alert, Badge, Button, Eyebrow } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { TONES, TONE_LABELS } from '../../mock/data'
import { formatTime } from '../../utils/format'

const NEW_CATEGORY = { label: '', copy: '', tone: TONES[0] }

export default function AdminCategories() {
  const { categories, videos, addCategory } = useLibrary()
  const [selectedId, setSelectedId] = useState(categories[0]?.id || null)
  const [form, setForm] = useState(NEW_CATEGORY)
  const [error, setError] = useState('')
  const selected = categories.find((item) => item.id === selectedId) || null
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const create = async (event) => {
    event.preventDefault()
    if (!form.label.trim()) { setError('Give the category a name.'); return }
    if (categories.some((item) => item.label.toLowerCase() === form.label.trim().toLowerCase())) { setError('A category with that name already exists.'); return }
    const created = await addCategory(form)
    setForm(NEW_CATEGORY)
    setError('')
    setSelectedId(created.id)
  }

  return <section className="admin-split admin-split-categories">
    <div className="panel">
      <Eyebrow>Create category</Eyebrow>
      <h2 className="display display-md">New path.</h2>
      <form onSubmit={create} noValidate>
        <Field label="Name" name="label" value={form.label} onChange={change} placeholder="e.g. Everyday life" error={error} />
        <Field as="textarea" label="Description" name="copy" value={form.copy} onChange={change} rows={3} placeholder="One sentence learners will see." />
        <Field as="select" label="Colour" name="tone" value={form.tone} onChange={change}>{TONES.map((tone) => <option key={tone} value={tone}>{TONE_LABELS[tone]}</option>)}</Field>
        <Button type="submit" block className="panel-action">Add category</Button>
      </form>
      <ul className="category-list" aria-label="Categories">
        {categories.map((category) => <li key={category.id}><button type="button" className={`category-list-item ${category.id === selectedId ? 'is-active' : ''}`} onClick={() => setSelectedId(category.id)}>
          <span className={`swatch tone-${category.tone}`} aria-hidden="true" /><span>{category.label}</span><small>{videos.filter((video) => video.categoryId === category.id).length}</small>
        </button></li>)}
      </ul>
    </div>

    {selected ? <CategoryDetail key={selected.id} category={selected} onDeleted={() => setSelectedId(null)} /> : <div className="panel"><p className="empty-note">Select or create a category to manage its videos.</p></div>}
  </section>
}

function CategoryDetail({ category, onDeleted }) {
  const { categories, videos, editCategory, deleteCategory, editVideo } = useLibrary()
  const [draft, setDraft] = useState({ label: category.label, copy: category.copy, tone: category.tone })
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const assigned = videos.filter((video) => video.categoryId === category.id).sort((a, b) => (a.order || 0) - (b.order || 0))
  const others = videos.filter((video) => video.categoryId !== category.id)
  const change = (event) => { setSaved(false); setDraft((current) => ({ ...current, [event.target.name]: event.target.value })) }

  // Moving a video into a category puts it at the end of that path.
  const assign = (video) => editVideo(video.id, { categoryId: category.id, order: Math.max(0, ...assigned.map((item) => item.order || 0)) + 1 })
  const unassign = (video) => editVideo(video.id, { categoryId: null })

  return <div className="panel">
    <Eyebrow>Edit category</Eyebrow>
    <h2 className="display display-md">{category.label}</h2>
    <div className="category-edit">
      <Field label="Name" name="label" value={draft.label} onChange={change} />
      <Field as="select" label="Colour" name="tone" value={draft.tone} onChange={change}>{TONES.map((tone) => <option key={tone} value={tone}>{TONE_LABELS[tone]}</option>)}</Field>
      <Field as="textarea" label="Description" name="copy" value={draft.copy} onChange={change} rows={2} className="field-wide" />
    </div>
    <div className="row-form-actions">
      <Button onClick={async () => { if (draft.label.trim()) { await editCategory(category.id, { ...draft, label: draft.label.trim() }); setSaved(true) } }}>Save changes</Button>
      {confirming
        ? <><Button variant="danger" onClick={async () => { await deleteCategory(category.id); onDeleted() }}>Yes, delete</Button><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button></>
        : <Button variant="outline" onClick={() => setConfirming(true)}>Delete category</Button>}
    </div>
    {saved && <Alert tone="success">Category saved.</Alert>}
    {confirming && <Alert tone="info">{assigned.length ? `Its ${assigned.length} video${assigned.length === 1 ? '' : 's'} will become unassigned and hidden from learners.` : 'This category has no videos.'}</Alert>}

    <h3 className="display display-sm assign-title">Videos in this category <Badge>{assigned.length}</Badge></h3>
    {assigned.length
      ? <ul className="assign-list">{assigned.map((video) => <li key={video.id}><span><b>{video.title}</b><small>{video.level} · {formatTime(video.durationSec)} · {video.status}</small></span><button type="button" onClick={() => unassign(video)}>Remove</button></li>)}</ul>
      : <p className="empty-note">No videos yet. Add some from the list below.</p>}

    <h3 className="display display-sm assign-title">Add a video</h3>
    {others.length
      ? <ul className="assign-list">{others.map((video) => <li key={video.id}><span><b>{video.title}</b><small>Now in: {categories.find((item) => item.id === video.categoryId)?.label || 'Unassigned'}</small></span><button type="button" onClick={() => assign(video)}>Add here</button></li>)}</ul>
      : <p className="empty-note">Every video is already in this category.</p>}
  </div>
}
