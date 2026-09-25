import { useEffect, useState } from 'react'
import { Badge, SectionHeading } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { api } from '../../services/api'
import { formatDate } from '../../utils/format'

const DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

function ActivityChart({ counts, labels }) {
  const width = 600
  const height = 180
  const max = Math.max(1, ...counts)
  const step = width / (counts.length - 1)
  const points = counts.map((count, index) => [index * step, height - 10 - (count / max) * (height - 30)])
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return <figure className="chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Submissions per day over the last ${DAYS} days. Peak: ${max}.`} preserveAspectRatio="none">
      <polygon className="chart-area" points={`0,${height} ${line} ${width},${height}`} />
      <polyline className="chart-line" points={line} />
      {points.map(([x, y], index) => <circle key={index} className="chart-dot" cx={x} cy={y} r="3.5"><title>{`${labels[index]}: ${counts[index]}`}</title></circle>)}
    </svg>
    <figcaption className="chart-axis"><span>{labels[0]}</span><span>{labels[Math.floor(labels.length / 2)]}</span><span>{labels[labels.length - 1]}</span></figcaption>
  </figure>
}

export default function AdminDashboard() {
  const { categories, videos, submissions } = useLibrary()
  const [users, setUsers] = useState([])
  useEffect(() => { api.users.list().then(setUsers) }, [])

  const contributors = users.filter((user) => user.role === 'user')
  const published = videos.filter((video) => video.status === 'published').length
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const counts = Array.from({ length: DAYS }, (_, index) => {
    const from = startOfToday - (DAYS - 1 - index) * DAY_MS
    return submissions.filter((item) => item.submittedAt >= from && item.submittedAt < from + DAY_MS).length
  })
  const labels = counts.map((_, index) => new Date(startOfToday - (DAYS - 1 - index) * DAY_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

  const perCategory = categories.map((category) => {
    const ids = new Set(videos.filter((video) => video.categoryId === category.id).map((video) => video.id))
    return { category, count: submissions.filter((item) => ids.has(item.videoId)).length }
  })
  const topCount = Math.max(1, ...perCategory.map((item) => item.count))
  const recent = [...submissions].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6)
  const stats = [
    ['Contributors', contributors.length, 'signed up'],
    ['Base videos', videos.length, `${published} published`],
    ['Recordings submitted', submissions.length, 'across all videos'],
    ['Categories', categories.length, 'topic groups'],
  ]

  return <>
    <section className="stat-grid" aria-label="Key numbers">
      {stats.map(([label, value, note]) => <div key={label} className="stat-card"><span>{label}</span><b className="display">{value}</b><small>{note}</small></div>)}
    </section>

    <section className="admin-split">
      <div className="panel">
        <SectionHeading eyebrow="Activity" title="Learning in motion." action={<span className="panel-note">Last {DAYS} days</span>} />
        <ActivityChart counts={counts} labels={labels} />
      </div>
      <div className="panel">
        <SectionHeading eyebrow="By category" title="Where it happens." />
        <ul className="bar-list">
          {perCategory.length ? perCategory.map(({ category, count }) => <li key={category.id}><span>{category.label}</span><div className="bar-track"><span className={`bar-fill tone-${category.tone}`} style={{ width: `${(count / topCount) * 100}%` }} /></div><b>{count}</b></li>) : <li className="empty-note">No categories yet.</li>}
        </ul>
      </div>
    </section>

    <section className="panel">
      <SectionHeading eyebrow="Latest" title="Recent submissions." />
      {recent.length
        ? <div className="table-wrap"><table className="table">
          <thead><tr><th>Contributor</th><th>Video</th><th>Category</th><th>Submitted</th><th><span className="sr-only">Status</span></th></tr></thead>
          <tbody>{recent.map((item) => {
            const contributor = users.find((user) => user.id === item.userId)
            const video = videos.find((entry) => entry.id === item.videoId)
            const category = categories.find((entry) => entry.id === video?.categoryId)
            return <tr key={item.id}>
              <td>{contributor ? `${contributor.firstName} ${contributor.surname}` : 'Unknown contributor'}</td>
              <td>{video?.title || 'Removed video'}</td><td>{category?.label || '—'}</td><td>{formatDate(item.submittedAt)}</td><td><Badge tone="success">Done</Badge></td>
            </tr>
          })}</tbody>
        </table></div>
        : <p className="empty-note">No submissions yet.</p>}
    </section>
  </>
}
