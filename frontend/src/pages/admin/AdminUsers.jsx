import { useEffect, useState } from 'react'
import Field from '../../components/Field'
import { Alert, Badge, Button, SectionHeading } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import { formatDate } from '../../utils/format'

const emptyRestriction = { type: 'ip', value: '', reason: '' }

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [restrictions, setRestrictions] = useState([])
  const [form, setForm] = useState(emptyRestriction)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api.users.list(), api.admin.restrictions()])
      .then(([userList, restrictionList]) => {
        if (active) {
          setUsers(userList)
          setRestrictions(restrictionList)
        }
      })
      .catch((cause) => { if (active) setError(cause.message || 'Unable to load access controls.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function changeStatus(target) {
    const status = target.status === 'suspended' ? 'active' : 'suspended'
    setBusyId(target.id)
    setError('')
    setNotice('')
    try {
      const updated = await api.users.setStatus(target.id, { status })
      setUsers((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice(`${target.firstName} ${target.surname} is ${status}.`)
    } catch (cause) { setError(cause.message || 'Unable to update this account.') }
    finally { setBusyId('') }
  }

  /** How many recordings a contributor has, so every confirmation can name the number (C3). */
  const recordingCount = async (target) => (await api.admin.userSubmissions(target.id, { limit: 1 })).total
  const recordings = (count) => `${count} recording${count === 1 ? '' : 's'}`

  async function deleteUser(target, { withRecordings = false } = {}) {
    const name = `${target.firstName} ${target.surname}`
    setBusyId(target.id)
    setError('')
    setNotice('')
    try {
      const count = await recordingCount(target)
      const question = withRecordings
        ? `Delete ${name}'s account and their ${recordings(count)}? The recording files are removed from storage and this can't be undone. If any file can't be deleted, the account is kept so you can try again.`
        : `Delete ${name}'s account? This removes their sign-in access but keeps their ${recordings(count)} and contribution data. Use "Delete account and recordings", or answer their deletion request, to remove those.`
      if (!window.confirm(question)) return
      await api.users.remove(target.id, { withRecordings })
      setUsers((items) => items.filter((item) => item.id !== target.id))
      setNotice(withRecordings ? `${name} and their ${recordings(count)} were deleted.` : `${name} was deleted. Their recordings are kept.`)
    } catch (cause) { setError(cause.message || 'Unable to delete this account.') }
    finally { setBusyId('') }
  }

  async function deleteRecordings(target) {
    const name = `${target.firstName} ${target.surname}`
    setBusyId(target.id)
    setError('')
    setNotice('')
    try {
      const count = await recordingCount(target)
      if (!count) { setNotice(`${name} has no recordings.`); return }
      if (!window.confirm(`Delete ${name}'s ${recordings(count)}? The files are removed from storage and this can't be undone. The account stays.`)) return
      const { deleted, failed } = await api.admin.removeUserSubmissions(target.id)
      if (failed.length) setError(`Deleted ${deleted}, but ${failed.length} could not be deleted from storage. Try again.`)
      else setNotice(`Deleted ${recordings(deleted)} for ${name}.`)
    } catch (cause) { setError(cause.message || 'Unable to delete these recordings.') }
    finally { setBusyId('') }
  }

  async function addRestriction(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      const created = await api.admin.createRestriction(form)
      setRestrictions((items) => [created, ...items])
      setForm(emptyRestriction)
      setNotice(`${created.type === 'ip' ? 'IP address' : 'Device'} restricted.`)
    } catch (cause) { setError(cause.message || 'Unable to create this restriction.') }
  }

  async function removeRestriction(item) {
    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await api.admin.removeRestriction(item.id)
      setRestrictions((items) => items.filter((restriction) => restriction.id !== item.id))
      setNotice('Restriction removed.')
    } catch (cause) { setError(cause.message || 'Unable to remove this restriction.') }
    finally { setBusyId('') }
  }

  return <>
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="success">{notice}</Alert>}

    <section className="panel">
      <SectionHeading eyebrow="Accounts" title="Manage users." action={<span className="panel-note">{users.length} accounts</span>} />
      {loading ? <p className="empty-note">Loading accounts...</p> : users.length ? <div className="table-wrap">
        <table className="table admin-user-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last device</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>{users.map((item) => <tr key={item.id}>
            <td>{item.firstName} {item.surname}</td>
            <td>{item.email}</td>
            <td><Badge>{item.role}</Badge></td>
            <td><Badge tone={item.status === 'suspended' ? 'danger' : 'success'}>{item.status || 'active'}</Badge>{item.statusReason && <small className="admin-status-reason">{item.statusReason}</small>}</td>
            <td>{item.lastDeviceId ? <code>{item.lastDeviceId.slice(0, 8)}...{item.lastDeviceId.slice(-4)}</code> : 'Not seen'}</td>
            <td>{formatDate(item.createdAt)}</td>
            <td><div className="admin-row-actions">
              {item.lastDeviceId && <Button variant="outline" disabled={busyId === item.id} onClick={() => setForm({ type: 'device', value: item.lastDeviceId, reason: '' })}>Block device</Button>}
              <Button variant="outline" disabled={busyId === item.id || item.id === currentUser.id} onClick={() => changeStatus(item)}>{item.status === 'suspended' ? 'Reactivate' : 'Suspend'}</Button>
              <Button variant="outline" className="is-danger" disabled={busyId === item.id} onClick={() => deleteRecordings(item)}>Delete recordings</Button>
              <Button variant="outline" className="is-danger" disabled={busyId === item.id || item.id === currentUser.id} onClick={() => deleteUser(item)}>Delete</Button>
              <Button variant="outline" className="is-danger" disabled={busyId === item.id || item.id === currentUser.id} onClick={() => deleteUser(item, { withRecordings: true })}>Delete account and recordings</Button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="empty-note">No accounts found.</p>}
    </section>

    <section className="admin-split admin-access-grid">
      <div className="panel">
        <SectionHeading eyebrow="Network and device access" title="Add a restriction." />
        <form className="admin-restriction-form" onSubmit={addRestriction}>
          <Field as="select" label="Restriction type" value={form.type} onChange={(event) => setForm((values) => ({ ...values, type: event.target.value, value: '' }))}>
            <option value="ip">IP address</option><option value="device">Device ID</option>
          </Field>
          <Field label={form.type === 'ip' ? 'IP address' : 'Device ID'} value={form.value} onChange={(event) => setForm((values) => ({ ...values, value: event.target.value }))} required maxLength={128} autoComplete="off" />
          <Field label="Reason (optional)" value={form.reason} onChange={(event) => setForm((values) => ({ ...values, reason: event.target.value }))} maxLength={500} />
          <Button type="submit" disabled={!form.value.trim()}>Add restriction</Button>
        </form>
      </div>

      <div className="panel">
        <SectionHeading eyebrow="Restricted access" title="Current restrictions." action={<span className="panel-note">{restrictions.length} active</span>} />
        {restrictions.length ? <ul className="restriction-list">{restrictions.map((item) => <li key={item.id}>
          <div><Badge>{item.type}</Badge><b>{item.identifierHint}</b><small>{item.reason || 'No reason provided'} · {formatDate(item.createdAt)}</small></div>
          <Button variant="outline" disabled={busyId === item.id} onClick={() => removeRestriction(item)}>Remove</Button>
        </li>)}</ul> : <p className="empty-note">No active restrictions.</p>}
      </div>
    </section>
  </>
}