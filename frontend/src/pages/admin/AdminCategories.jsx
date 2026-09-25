import { useState } from 'react'
import Field from '../../components/Field'
import { Alert, Badge, Button, Eyebrow } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { TONES, TONE_LABELS } from '../../mock/data'
import { formatTime } from '../../utils/format'

const NEW_CATEGORY = { label: '', copy: '', tone: TONES[0] }

export default function AdminCategories() {
  const { categories, videos, submissions, addCategory } = useLibrary()
  const [selectedId, setSelectedId] = useState(categories[0]?.id || null)
  const [form, setForm] = useState({ ...NEW_CATEGORY, archived: false })
  const [error, setError] = useState('')

  const orderedCategories = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0))
  const activeCategories = orderedCategories.filter((item) => !item.archived)
  const archivedCategories = orderedCategories.filter((item) => item.archived)
  const selected = orderedCategories.find((item) => item.id === selectedId) || null
  const change = (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [event.target.name]: value }))
  }

  const create = async (event) => {
    event.preventDefault()
    if (!form.label.trim()) { setError('Give the category a name.'); return }
    if (categories.some((item) => item.label.toLowerCase() === form.label.trim().toLowerCase())) { setError('A category with that name already exists.'); return }
    const created = await addCategory({ ...form, archived: !!form.archived })
    setForm({ ...NEW_CATEGORY, archived: false })
    setError('')
    setSelectedId(created.id)
  }

  return <section className="admin-split admin-split-categories">
    <div className="panel">
      <Eyebrow>Create category</Eyebrow>
      <h2 className="display display-md">New path.</h2>
      <form onSubmit={create} noValidate>
        <Field label="Name" name="label" value={form.label} onChange={change} placeholder="e.g. Everyday life" error={error} />
        <Field as="textarea" label="Description" name="copy" value={form.copy} onChange={change} rows={3} placeholder="One sentence contributors will see." />
        <Field as="select" label="Colour" name="tone" value={form.tone} onChange={change}>{TONES.map((tone) => <option key={tone} value={tone}>{TONE_LABELS[tone]}</option>)}</Field>
        <Field label="Archive category" name="archived" type="checkbox" checked={form.archived} onChange={change} />
        <Button type="submit" block className="panel-action">Add category</Button>
      </form>

      <ul className="category-list" aria-label="Categories">
        {activeCategories.length ? activeCategories.map((category) => <li key={category.id}><button type="button" className={`category-list-item ${category.id === selectedId ? 'is-active' : ''}`} onClick={() => setSelectedId(category.id)}>
          <span className={`swatch tone-${category.tone}`} aria-hidden="true" /><span>{category.label}</span>
          <small>{videos.filter((video) => video.categoryId === category.id).length}</small>
        </button></li>) : <li className="empty-note">No active categories yet.</li>}
      </ul>

      {archivedCategories.length > 0 && <div className="category-archive-block">
        <h3 className="display display-sm assign-title">Archived</h3>
        <ul className="category-list category-list-archive" aria-label="Archived categories">
          {archivedCategories.map((category) => <li key={category.id}><button type="button" className={`category-list-item ${category.id === selectedId ? 'is-active' : ''}`} onClick={() => setSelectedId(category.id)}>
            <span className={`swatch tone-${category.tone}`} aria-hidden="true" /><span>{category.label}</span><small>{videos.filter((video) => video.categoryId === category.id).length}</small>
          </button></li>)}
        </ul>
      </div>}
    </div>

    {selected ? <CategoryDetail key={selected.id} category={selected} onDeleted={() => setSelectedId(null)} /> : <div className="panel"><p className="empty-note">Select or create a category to manage its videos.</p></div>}
  </section>
}

function CategoryDetail({ category, onDeleted }) {
  const { categories, videos, submissions, editCategory, deleteCategory, editVideo } = useLibrary()
  const [draft, setDraft] = useState({ label: category.label, copy: category.copy, tone: category.tone, archived: !!category.archived })
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const assigned = videos.filter((video) => video.categoryId === category.id).sort((a, b) => (a.order || 0) - (b.order || 0))
  const others = videos.filter((video) => video.categoryId !== category.id)
  const change = (event) => { const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value; setSaved(false); setDraft((current) => ({ ...current, [event.target.name]: value })) }

  const categorySubmissionCount = submissions.filter((item) => assigned.some((video) => video.id === item.videoId)).length
  const publishedCount = assigned.filter((video) => video.status === 'published').length

  const assign = async (video) => {
    const nextOrder = Math.max(0, ...assigned.map((item) => item.order || 0)) + 1
    await editVideo(video.id, { categoryId: category.id, order: nextOrder })
  }
  const unassign = (video) => editVideo(video.id, { categoryId: null })

  const moveCategoryOrder = async (direction) => {
    const ordered = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0))
    const index = ordered.findIndex((item) => item.id === category.id)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return
    const target = ordered[targetIndex]
    const currentOrder = category.order || 0
    const nextOrder = target.order || 0
    await Promise.all([
      editCategory(category.id, { order: nextOrder }),
      editCategory(target.id, { order: currentOrder }),
    ])
  }

  return <div className="panel">
    <Eyebrow>Edit category</Eyebrow>
    <h2 className="display display-md">{category.label}</h2>
    <div className="category-stats">
      <span><b>{assigned.length}</b> videos</span>
      <span><b>{publishedCount}</b> published</span>
      <span><b>{categorySubmissionCount}</b> recordings</span>
    </div>
    <div className="category-edit">
      <Field label="Name" name="label" value={draft.label} onChange={change} />
      <Field as="select" label="Colour" name="tone" value={draft.tone} onChange={change}>{TONES.map((tone) => <option key={tone} value={tone}>{TONE_LABELS[tone]}</option>)}</Field>
      <Field as="textarea" label="Description" name="copy" value={draft.copy} onChange={change} rows={2} className="field-wide" />
      <Field label="Archive category" name="archived" type="checkbox" checked={draft.archived} onChange={change} className="field-wide" />
    </div>
    <div className="category-order-actions">
      <Button variant="outline" onClick={() => moveCategoryOrder(-1)} disabled={category.order === 0 || !categories.length}>Move up</Button>
      <Button variant="outline" onClick={() => moveCategoryOrder(1)}>Move down</Button>
    </div>
    <div className="row-form-actions">
      <Button onClick={async () => { if (draft.label.trim()) { await editCategory(category.id, { ...draft, label: draft.label.trim(), archived: !!draft.archived }); setSaved(true) } }}>Save changes</Button>
      {confirming
        ? <><Button variant="danger" onClick={async () => { await deleteCategory(category.id); onDeleted() }}>Yes, delete</Button><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button></>
        : <Button variant="outline" onClick={() => setConfirming(true)}>Delete category</Button>}
    </div>
    {saved && <Alert tone="success">Category saved.</Alert>}
    {confirming && <Alert tone="info">{assigned.length ? `Its ${assigned.length} video${assigned.length === 1 ? '' : 's'} will become unassigned and hidden from contributors.` : 'This category has no videos.'}</Alert>}

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
