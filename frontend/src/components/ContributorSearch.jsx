import { useEffect, useId, useState } from 'react'
import { api } from '../services/api'
import { Button } from './ui'

const DEBOUNCE_MS = 250

/**
 * B7: pick one contributor by typing part of their name or email, instead of a dropdown of every
 * account. Asks GET /admin/users?role=user&q=…&limit=8 as you type. `value` is the chosen
 * `{ id, name }` or null; `onChange` gets the new choice (null when cleared).
 */
export default function ContributorSearch({ label = 'Contributor', value, onChange }) {
  const inputId = useId()
  const listId = useId()
  const [text, setText] = useState('')
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const q = text.trim()
    if (value || !q) return undefined
    let active = true
    const timer = setTimeout(() => {
      api.users.page({ role: 'user', q, limit: 8 })
        .then((page) => { if (active) { setMatches(page.items); setError('') } })
        .catch((cause) => { if (active) setError(cause.message || 'Unable to search contributors.') })
    }, DEBOUNCE_MS)
    return () => { active = false; clearTimeout(timer) }
  }, [text, value])

  const choose = (user) => {
    setText('')
    setMatches([])
    onChange({ id: user.id, name: `${user.firstName} ${user.surname}` })
  }

  if (value) {
    return <div className="field contributor-search">
      <span className="field-label">{label}</span>
      <div className="contributor-chosen">
        <b>{value.name}</b>
        <Button variant="outline" onClick={() => onChange(null)} aria-label={`Clear ${label.toLowerCase()} filter`}>Clear</Button>
      </div>
    </div>
  }

  const typed = text.trim()
  return <div className="field contributor-search">
    <label className="field-label" htmlFor={inputId}>{label}</label>
    <input
      id={inputId}
      className="field-control field-input"
      type="search"
      value={text}
      placeholder="All contributors (type a name or email)"
      autoComplete="off"
      aria-controls={typed ? listId : undefined} // only while the list exists (QA-20, axe)
      onChange={(event) => { setText(event.target.value); if (!event.target.value.trim()) setMatches([]) }}
    />
    {error && <small className="field-error">{error}</small>}
    {typed && <ul id={listId} className="contributor-matches" aria-label={`${label} matches`}>
      {matches.map((user) => <li key={user.id}>
        <button type="button" className="inline-link" onClick={() => choose(user)}>{user.firstName} {user.surname} <small>{user.email}</small></button>
      </li>)}
    </ul>}
  </div>
}
