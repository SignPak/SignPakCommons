import { Fragment, useEffect, useState } from 'react'
import Field from '../../components/Field'
import { Alert, Badge, Button, SectionHeading } from '../../components/ui'
import { api } from '../../services/api'
import { formatDate } from '../../utils/format'

const DELETION = 'recording-deletion'
const TOPIC_LABELS = { general: 'General inquiry', partnership: 'Partnership', [DELETION]: 'Deletion request' }
const STATUS_LABELS = { open: 'Open', done: 'Done', rejected: 'Rejected' }

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * The verification badge of a deletion request (D4). "Manual check" means the request was not
 * confirmed with a code and the lookup found no current account: the team has to verify it by
 * other means before deleting anything.
 */
function Verification({ message, lookup }) {
  if (message.topic !== DELETION) return <span className="panel-note">—</span>
  if (message.verified) return <Badge tone="success">Verified</Badge>
  if (lookup?.matches && !lookup.matches.some((match) => match.kind === 'user')) return <Badge tone="warning">Manual check</Badge>
  return <Badge>Unverified</Badge>
}

const matchLabel = (match) => match.kind === 'user'
  ? `${match.name} (current account)`
  : `Deleted account (deleted ${formatDate(match.deletedAt)}${match.deletedBy === 'self' ? ' by its owner' : ' by an admin'})`

/** Admin → Messages: the contact inbox, and acting on recording/data deletion requests (C3). */
export default function AdminMessages() {
  const [filters, setFilters] = useState({ topic: '', status: 'open', verified: '' })
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [lookups, setLookups] = useState({}) // message id -> { loading, matches, error }
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    api.admin.messages({
      limit: 100,
      topic: filters.topic || undefined,
      status: filters.status || undefined,
      verified: filters.verified || undefined,
    })
      .then((items) => { if (active) setMessages(items) })
      .catch((cause) => { if (active) setError(cause.message || 'Unable to load messages.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters])

  const changeFilter = (name) => (event) => {
    const { value } = event.target
    setLoading(true)
    setError('')
    setFilters((current) => ({ ...current, [name]: value }))
  }
  const setLookup = (id, value) => setLookups((current) => ({ ...current, [id]: value }))
  const start = (key) => { setBusy(key); setError(''); setNotice('') }

  async function findContributor(message) {
    setLookup(message.id, { loading: true })
    try {
      const { matches } = await api.admin.deletionLookup({ messageId: message.id })
      setLookup(message.id, { matches })
    } catch (cause) {
      setLookup(message.id, { error: cause.message || 'Unable to look up this email.' })
    }
  }

  async function deleteRecordings(message, match) {
    const label = matchLabel(match)
    if (!window.confirm(`Delete ${plural(match.submissionCount, 'recording')} for ${label}? The files are removed from storage and this can't be undone.`)) return
    start(`delete-${match.userId}`)
    try {
      const { deleted, failed } = await api.admin.removeUserSubmissions(match.userId, { requestMessageId: message.id })
      setLookups((current) => ({
        ...current,
        [message.id]: {
          ...current[message.id],
          matches: current[message.id].matches.map((item) => item.userId === match.userId ? { ...item, submissionCount: failed.length } : item),
        },
      }))
      if (failed.length) setError(`Deleted ${deleted}, but ${failed.length} could not be deleted from storage. Try again.`)
      else setNotice(`Deleted ${plural(deleted, 'recording')}. Mark the request done when you have replied.`)
    } catch (cause) {
      setError(cause.message || 'Unable to delete these recordings.')
    } finally { setBusy('') }
  }

  async function setStatus(message, status) {
    start(`status-${message.id}`)
    try {
      const updated = await api.admin.setMessageStatus(message.id, status)
      setMessages((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Marked ${STATUS_LABELS[status].toLowerCase()}.`)
    } catch (cause) {
      setError(cause.message || 'Unable to update this message.')
    } finally { setBusy('') }
  }

  return <>
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="success">{notice}</Alert>}

    <section className="panel">
      <SectionHeading eyebrow="Inbox" title="Contact messages." action={<span className="panel-note">{loading ? 'Loading…' : plural(messages.length, 'message')}</span>} />
      <div className="admin-filters">
        <Field as="select" label="Topic" value={filters.topic} onChange={changeFilter('topic')}>
          <option value="">All topics</option>
          {Object.entries(TOPIC_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <Field as="select" label="Status" value={filters.status} onChange={changeFilter('status')}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Field>
        <Field as="select" label="Verified" value={filters.verified} onChange={changeFilter('verified')}>
          <option value="">Verified or not</option>
          <option value="true">Verified</option>
          <option value="false">Not verified</option>
        </Field>
      </div>

      {loading ? <p className="empty-note">Loading messages…</p> : messages.length ? <div className="table-wrap">
        <table className="table admin-message-table">
          <thead><tr><th>Topic</th><th>From</th><th>Received</th><th>Verification</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{messages.map((message) => {
            const lookup = lookups[message.id]
            const isDeletion = message.topic === DELETION
            return <Fragment key={message.id}>
              <tr data-testid={`message-${message.id}`}>
                <td>{TOPIC_LABELS[message.topic] || message.topic}</td>
                <td><b>{message.name}</b> · {message.email}<span className="admin-message-text">{message.message}</span></td>
                <td>{formatDate(message.createdAt)}</td>
                <td><Verification message={message} lookup={lookup} /></td>
                <td><Badge tone={message.status === 'done' ? 'success' : message.status === 'rejected' ? 'danger' : 'neutral'}>{STATUS_LABELS[message.status] || message.status}</Badge></td>
                <td><div className="admin-row-actions">
                  {isDeletion && <Button variant="outline" disabled={lookup?.loading} onClick={() => findContributor(message)}>Find contributor</Button>}
                  {message.status === 'open'
                    ? <>
                      <Button variant="outline" disabled={busy === `status-${message.id}`} onClick={() => setStatus(message, 'done')}>Mark done</Button>
                      <Button variant="outline" className="is-danger" disabled={busy === `status-${message.id}`} onClick={() => setStatus(message, 'rejected')}>Reject</Button>
                    </>
                    : <Button variant="outline" disabled={busy === `status-${message.id}`} onClick={() => setStatus(message, 'open')}>Reopen</Button>}
                </div></td>
              </tr>
              {lookup && !lookup.loading && <tr><td colSpan={6}><div className="admin-lookup" data-testid={`lookup-${message.id}`}>
                {lookup.error ? <Alert tone="error">{lookup.error}</Alert>
                  : lookup.matches.length ? <>
                    <b>Accounts that used {message.email}</b>
                    <ul>{lookup.matches.map((match) => <li key={`${match.kind}-${match.userId}`}>
                      <span>{matchLabel(match)}: {plural(match.submissionCount, 'recording')}</span>
                      <Button variant="outline" className="is-danger" disabled={!match.submissionCount || busy === `delete-${match.userId}`} onClick={() => deleteRecordings(message, match)}>
                        Delete recordings
                      </Button>
                    </li>)}</ul>
                  </>
                  : <p>No current or deleted account used {message.email}. Check the request by hand before deleting anything.</p>}
              </div></td></tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div> : <p className="empty-note">No messages match these filters.</p>}
    </section>
  </>
}
