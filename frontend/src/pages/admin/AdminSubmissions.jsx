import { useEffect, useMemo, useState } from 'react'
import ContributorSearch from '../../components/ContributorSearch'
import Field from '../../components/Field'
import { Alert, Badge, Button, SectionHeading } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { adminExportUrl } from '../../services/adminExport'
import { api } from '../../services/api'
import { formatBytes, formatDate } from '../../utils/format'

const PAGE_SIZE = 25
const EMPTY = { categoryId: '', videoId: '', from: '', to: '' }
const seconds = (value) => `${Number(value).toFixed(2)} s`

/**
 * Admin → Submissions (B5): every recording, filtered by category, video, contributor and date,
 * a page at a time, and the export the ML team uses. The download buttons are plain links to the
 * export URL, so the browser streams the file to disk; it is never held in this page's memory.
 */
export default function AdminSubmissions() {
  const { categories, videos } = useLibrary()
  const [filters, setFilters] = useState(EMPTY)
  const [contributor, setContributor] = useState(null)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  // Only the filters that are set, in the shape the API takes.
  const query = useMemo(() => {
    const result = { userId: contributor?.id }
    for (const [key, value] of Object.entries(filters)) if (value) result[key] = value
    return result
  }, [filters, contributor])
  const invalidRange = Boolean(query.from && query.to && query.from > query.to)

  useEffect(() => {
    if (invalidRange) return undefined
    let active = true
    api.admin.submissions({ ...query, limit: PAGE_SIZE })
      .then((page) => { if (active) { setRows(page.items); setTotal(page.total); setNextCursor(page.nextCursor); setError('') } })
      .catch((cause) => { if (active) setError(cause.message || 'Unable to load submissions.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, invalidRange])

  const change = (name) => (event) => {
    const { value } = event.target
    setLoading(true)
    // A different category can't keep a video from another one.
    setFilters((current) => ({ ...current, [name]: value, ...(name === 'categoryId' ? { videoId: '' } : {}) }))
  }
  const chooseContributor = (value) => { setLoading(true); setContributor(value) }

  async function loadMore() {
    setLoadingMore(true)
    try {
      const page = await api.admin.submissions({ ...query, limit: PAGE_SIZE, cursor: nextCursor })
      setRows((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
      setTotal(page.total)
    } catch (cause) {
      setError(cause.message || 'Unable to load more submissions.')
    } finally { setLoadingMore(false) }
  }

  const videoChoices = videos.filter((video) => !filters.categoryId || video.categoryId === filters.categoryId)
  const exportLink = (format) => (invalidRange ? undefined : adminExportUrl({ ...query, format }))

  return <>
    {error && <Alert tone="error">{error}</Alert>}
    <section className="panel">
      <SectionHeading
        eyebrow="Submissions"
        title="Every recording, ready for the ML team."
        action={<div className="admin-downloads">
          <a className="btn btn-outline" href={exportLink('csv')} download aria-disabled={invalidRange || undefined}>Download CSV</a>
          <a className="btn btn-outline" href={exportLink('json')} download aria-disabled={invalidRange || undefined}>Download JSON</a>
        </div>}
      />
      <p className="panel-copy micro-copy">The download has every submission matching these filters: ids, the stored file, trim, mirror and time. Never names or emails.</p>
      <div className="admin-filters">
        <Field as="select" label="Category" value={filters.categoryId} onChange={change('categoryId')}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </Field>
        <Field as="select" label="Video" value={filters.videoId} onChange={change('videoId')}>
          <option value="">All videos</option>
          {videoChoices.map((video) => <option key={video.id} value={video.id}>{video.title}</option>)}
        </Field>
        <ContributorSearch value={contributor} onChange={chooseContributor} />
        <Field type="date" label="From" value={filters.from} onChange={change('from')} />
        <Field type="date" label="To" value={filters.to} onChange={change('to')} error={invalidRange ? 'The end date must be on or after the start date.' : undefined} />
      </div>

      <p className="panel-note">{loading ? 'Loading…' : `${total} ${total === 1 ? 'submission' : 'submissions'}`}</p>
      {loading ? <p className="empty-note">Loading submissions…</p> : rows.length ? <div className="table-wrap">
        <table className="table admin-submission-table">
          <thead><tr><th>Submitted</th><th>Contributor</th><th>Video</th><th>Category</th><th>Trim</th><th>Mirrored</th><th>Size</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.submissionId} data-testid={`submission-${row.submissionId}`}>
            <td>{formatDate(row.submittedAt)}</td>
            <td>{row.contributorName}</td>
            <td>{row.videoTitle || 'Removed video'}</td>
            <td>{row.categoryLabel || '—'}</td>
            <td>{seconds(row.trimStart)} – {seconds(row.trimEnd)}</td>
            <td>{row.mirrored ? <Badge>Mirrored</Badge> : 'No'}</td>
            <td>{formatBytes(row.size || 0)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="empty-note">No submissions match these filters.</p>}

      {nextCursor && !loading && <div className="admin-load-more">
        <span className="panel-note">Showing {rows.length} of {total}</span>
        <Button variant="outline" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
      </div>}
    </section>
  </>
}
