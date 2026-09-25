import { useEffect, useMemo, useState } from 'react'
import Field from '../../components/Field'
import { Badge, SectionHeading } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { api } from '../../services/api'
import { formatDate } from '../../utils/format'

const DAY_OPTIONS = [7, 14, 30, 60, 90]
const DAY_MS = 24 * 60 * 60 * 1000

function ActivityChart({ counts, labels }) {
  const width = 600
  const height = 180
  const max = Math.max(1, ...counts)
  const step = counts.length > 1 ? width / (counts.length - 1) : width
  const points = counts.map((count, index) => [index * step, height - 10 - (count / max) * (height - 30)])
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return <figure className="chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Submissions per day over the selected range. Peak: ${max}.`} preserveAspectRatio="none">
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
  const [usersError, setUsersError] = useState('')
  const [usersLoading, setUsersLoading] = useState(true)
  const [days, setDays] = useState(14)
  const [selectedContributor, setSelectedContributor] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    let active = true
    api.users.list()
      .then((list) => { if (active) { setUsers(list); setUsersError('') } })
      .catch(() => { if (active) setUsersError('Unable to load contributor data right now. Try refreshing the page.') })
      .finally(() => { if (active) setUsersLoading(false) })
    return () => { active = false }
  }, [])

  const contributors = users.filter((user) => user.role === 'user')
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const rangeStart = startOfToday - (days - 1) * DAY_MS

  const filteredSubmissions = useMemo(() => submissions.filter((item) => {
    if (item.submittedAt < rangeStart) return false
    if (selectedContributor !== 'all' && item.userId !== selectedContributor) return false
    if (selectedCategory !== 'all') {
      const video = videos.find((entry) => entry.id === item.videoId)
      return video?.categoryId === selectedCategory
    }
    return true
  }), [rangeStart, selectedCategory, selectedContributor, submissions, videos])

  const counts = Array.from({ length: days }, (_, index) => {
    const from = startOfToday - (days - 1 - index) * DAY_MS
    return filteredSubmissions.filter((item) => item.submittedAt >= from && item.submittedAt < from + DAY_MS).length
  })

  const labels = counts.map((_, index) => new Date(startOfToday - (days - 1 - index) * DAY_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))

  const perCategory = categories.map((category) => {
    const ids = new Set(videos.filter((video) => video.status === 'published' && video.categoryId === category.id).map((video) => video.id))
    const count = filteredSubmissions.filter((item) => ids.has(item.videoId)).length
    return { category, count, totalVideos: ids.size }
  })

  const topCount = Math.max(1, ...perCategory.map((item) => item.count))
  const recent = [...filteredSubmissions].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6)

  const topVideos = videos
    .filter((video) => video.status === 'published' && (selectedCategory === 'all' || video.categoryId === selectedCategory))
    .map((video) => ({
      video,
      count: filteredSubmissions.filter((item) => item.videoId === video.id).length,
      category: categories.find((entry) => entry.id === video.categoryId),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.video.title.localeCompare(b.video.title))
    .slice(0, 6)

  const contributorStats = contributors
    .map((user) => ({
      user,
      count: filteredSubmissions.filter((item) => item.userId === user.id).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const stats = [
    ['Active contributors', new Set(filteredSubmissions.map((item) => item.userId)).size],
    ['Videos recorded', new Set(filteredSubmissions.map((item) => item.videoId)).size],
    ['Recordings submitted', filteredSubmissions.length],
    ['Top category', perCategory.reduce((winner, item) => (item.count > winner.count ? item : winner), { category: { label: '—' }, count: 0 }).category.label],
  ]

  return <>
    {usersError && <div className="admin-alert"><p className="alert alert-error">{usersError} <button type="button" className="inline-link" onClick={() => window.location.reload()}>Refresh</button></p></div>}

    <div className="admin-filters">
      <Field as="select" label="Contributor" value={selectedContributor} onChange={(event) => setSelectedContributor(event.target.value)}>
        <option value="all">All contributors</option>
        {contributors.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.surname}</option>)}
      </Field>
      <Field as="select" label="Days" value={days} onChange={(event) => setDays(Number(event.target.value))}>
        {DAY_OPTIONS.map((value) => <option key={value} value={value}>Last {value} days</option>)}
      </Field>
      <Field as="select" label="Category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </Field>
    </div>

    <section className="stat-grid" aria-label="Key numbers">
      {stats.map(([label, value, note]) => <div key={label} className="stat-card"><span>{label}</span><b className="display">{value}</b><small>{note}</small></div>)}
    </section>

    <section className="admin-split">
      <div className="panel">
        <SectionHeading eyebrow="Activity" title="Contributions in motion." action={<span className="panel-note">Last {days} days</span>} />
        {usersLoading ? <div className="skeleton-chart" aria-label="Loading contributions data" /> : <ActivityChart counts={counts} labels={labels} />}
      </div>
      <div className="panel">
        <SectionHeading eyebrow="By category" title="Which categories are active?" />
        <ul className="bar-list">
          {perCategory.length ? perCategory.map(({ category, count }) => <li key={category.id}><span>{category.label}</span><div className="bar-track"><span className={`bar-fill tone-${category.tone}`} style={{ width: `${(count / topCount) * 100}%` }} /></div><b>{count}</b></li>) : <li className="empty-note">No categories yet.</li>}
        </ul>
        <p className="panel-copy micro-copy">{selectedCategory === 'all' ? 'This shows the category mix across the selected range.' : `Category focus: ${categories.find((entry) => entry.id === selectedCategory)?.label || 'Selected category'}.`}</p>
      </div>
    </section>

    <section className="admin-split admin-split-categories">
      <div className="panel">
        <SectionHeading eyebrow="Engagement" title="Top videos." />
        {topVideos.length
          ? <ul className="bar-list smooth-list">
              {topVideos.map(({ video, count, category }) => <li key={video.id}><span>{video.title}</span><div className="bar-track"><span className={`bar-fill tone-${category?.tone || 'blue'}`} style={{ width: `${Math.max(12, (count / Math.max(1, topVideos[0].count)) * 100)}%` }} /></div><b>{count}</b></li>)}
            </ul>
          : <p className="empty-note">No recorded videos in this range yet.</p>}
      </div>
      <div className="panel">
        <SectionHeading eyebrow="Contributors" title="Who is recording the most?" />
        {contributorStats.length
          ? <ul className="bar-list smooth-list">
              {contributorStats.map(({ user, count }) => <li key={user.id}><span>{user.firstName} {user.surname}</span><div className="bar-track"><span className="bar-fill tone-cyan" style={{ width: `${Math.max(12, (count / Math.max(1, contributorStats[0].count)) * 100)}%` }} /></div><b>{count}</b></li>)}
            </ul>
          : <p className="empty-note">No contributor activity in this view.</p>}
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
        : <p className="empty-note">No submissions match this filter. Try a broader date range or a different contributor.</p>}
    </section>
  </>
}
