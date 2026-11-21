import { useEffect, useState } from 'react'
import Field from '../../components/Field'
import { Alert, Button, SectionHeading } from '../../components/ui'
import { api } from '../../services/api'
import { AUDIT_ACTION_LABELS, auditDetails } from '../../utils/auditLog'

const PAGE_SIZE = 25
const TARGET_LABELS = { video: 'Video', category: 'Category', demo: 'Demo video', user: 'Account', restriction: 'Restriction', message: 'Message' }

const when = (value) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const target = (entry) => [TARGET_LABELS[entry.targetType] || entry.targetType, entry.targetId ? `…${entry.targetId.slice(-6)}` : ''].filter(Boolean).join(' ')

/** Admin → Activity (S7): who did what, and when. Newest first, filtered by admin and action. */
export default function AdminActivity() {
  const [filters, setFilters] = useState({ actor: '', action: '' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ entries: [], total: 0 })
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.users.list()
      .then((users) => { if (active) setAdmins(users.filter((user) => user.role === 'admin')) })
      .catch(() => {}) // the filter still offers "All admins" and "System"
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    api.admin.audit({ page, limit: PAGE_SIZE, actor: filters.actor || undefined, action: filters.action || undefined })
      .then((data) => { if (active) setResult({ entries: data.entries, total: data.total }) })
      .catch((cause) => { if (active) setError(cause.message || 'Unable to load the activity log.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page])

  const reload = (change) => {
    setLoading(true)
    setError('')
    change()
  }
  const changeFilter = (name) => (event) => {
    const { value } = event.target
    reload(() => {
      setPage(1)
      setFilters((current) => ({ ...current, [name]: value }))
    })
  }
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  return <>
    {error && <Alert tone="error">{error}</Alert>}
    <section className="panel">
      <SectionHeading eyebrow="Activity" title="Who did what." action={<span className="panel-note">{loading ? 'Loading…' : `${result.total} ${result.total === 1 ? 'entry' : 'entries'}`}</span>} />
      <div className="admin-filters">
        <Field as="select" label="Admin" value={filters.actor} onChange={changeFilter('actor')}>
          <option value="">All admins</option>
          <option value="system">System</option>
          {admins.map((admin) => <option key={admin.id} value={admin.id}>{`${admin.firstName} ${admin.surname}`}</option>)}
        </Field>
        <Field as="select" label="Action" value={filters.action} onChange={changeFilter('action')}>
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
      </div>

      {loading ? <p className="empty-note">Loading activity…</p> : result.entries.length ? <div className="table-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>On</th><th>Details</th></tr></thead>
          <tbody>{result.entries.map((entry) => <tr key={entry.id} data-testid={`activity-${entry.id}`}>
            <td>{when(entry.at)}</td>
            <td><b>{entry.actor.name}</b></td>
            <td>{AUDIT_ACTION_LABELS[entry.action] || entry.action}</td>
            <td>{target(entry)}</td>
            <td>{auditDetails(entry.meta) || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="empty-note">No activity matches these filters.</p>}

      <div className="admin-row-actions" aria-label="Pages">
        <Button variant="outline" disabled={loading || page <= 1} onClick={() => reload(() => setPage((current) => current - 1))}>Previous</Button>
        <span className="panel-note">Page {page} of {pages}</span>
        <Button variant="outline" disabled={loading || page >= pages} onClick={() => reload(() => setPage((current) => current + 1))}>Next</Button>
      </div>
    </section>
  </>
}
