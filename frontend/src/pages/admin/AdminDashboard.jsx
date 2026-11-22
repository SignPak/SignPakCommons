import { useEffect, useState } from 'react'
import ContributorSearch from '../../components/ContributorSearch'
import Field from '../../components/Field'
import { Badge, SectionHeading } from '../../components/ui'
import { useLibrary } from '../../context/LibraryContext'
import { api } from '../../services/api'
import { formatDate } from '../../utils/format'

const DAY_OPTIONS = [7, 14, 30, 60, 90]

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

// "2026-11-22" (a UTC day from the API) -> "Nov 22".
const dayLabel = (date) => new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * Admin → Dashboard. B7: everything on it comes from GET /admin/stats, worked out on the server
 * for the chosen days, contributor and category; the page no longer loads every submission or
 * every account. Days are UTC days.
 */
export default function AdminDashboard() {
  const { categories } = useLibrary()
  const [days, setDays] = useState(14)
  const [contributor, setContributor] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.admin.stats({ days, userId: contributor?.id, categoryId: selectedCategory === 'all' ? undefined : selectedCategory })
      .then((data) => { if (active) { setStats(data); setError('') } })
      .catch((cause) => { if (active) setError(cause.message || 'Unable to load the dashboard right now. Try refreshing the page.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days, contributor, selectedCategory])

  const reload = (change) => { setLoading(true); change() }
  const counts = stats?.activity.map((day) => day.count) ?? []
  const labels = stats?.activity.map((day) => dayLabel(day.date)) ?? []
  const byCategory = stats?.byCategory ?? []
  const topCount = Math.max(1, ...byCategory.map((item) => item.count))
  const summary = stats?.summary
  const cards = [
    ['Active contributors', summary?.activeContributors ?? '—'],
    ['Videos recorded', summary?.videosRecorded ?? '—'],
    ['Recordings submitted', summary?.recordings ?? '—'],
    ['Top category', summary ? (summary.topCategory?.label ?? '—') : '—'],
  ]
  const topVideos = stats?.topVideos ?? []
  const topContributors = stats?.topContributors ?? []
  const recent = stats?.recent ?? []

  return <>
    {error && <div className="admin-alert"><p className="alert alert-error">{error} <button type="button" className="inline-link" onClick={() => window.location.reload()}>Refresh</button></p></div>}

    <div className="admin-filters">
      <ContributorSearch value={contributor} onChange={(value) => reload(() => setContributor(value))} />
      <Field as="select" label="Days" value={days} onChange={(event) => { const value = Number(event.target.value); reload(() => setDays(value)) }}>
        {DAY_OPTIONS.map((value) => <option key={value} value={value}>Last {value} days</option>)}
      </Field>
      <Field as="select" label="Category" value={selectedCategory} onChange={(event) => { const { value } = event.target; reload(() => setSelectedCategory(value)) }}>
        <option value="all">All categories</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
      </Field>
    </div>

    <section className="stat-grid" aria-label="Key numbers">
      {cards.map(([label, value]) => <div key={label} className="stat-card"><span>{label}</span><b className="display">{value}</b></div>)}
    </section>

    <section className="admin-split">
      <div className="panel">
        <SectionHeading eyebrow="Activity" title="Contributions in motion." action={<span className="panel-note">Last {days} days (UTC)</span>} />
        {loading || !stats ? <div className="skeleton-chart" aria-label="Loading contributions data" /> : <ActivityChart counts={counts} labels={labels} />}
      </div>
      <div className="panel">
        <SectionHeading eyebrow="By category" title="Which categories are active?" />
        <ul className="bar-list">
          {byCategory.length ? byCategory.map((item) => <li key={item.categoryId}><span>{item.label}</span><div className="bar-track"><span className={`bar-fill tone-${item.tone}`} style={{ width: `${(item.count / topCount) * 100}%` }} /></div><b>{item.count}</b></li>) : <li className="empty-note">No categories yet.</li>}
        </ul>
        <p className="panel-copy micro-copy">{selectedCategory === 'all' ? 'This shows the category mix across the selected range.' : `Category focus: ${categories.find((entry) => entry.id === selectedCategory)?.label || 'Selected category'}.`}</p>
      </div>
    </section>

    <section className="admin-split admin-split-categories">
      <div className="panel">
        <SectionHeading eyebrow="Engagement" title="Top videos." />
        {topVideos.length
          ? <ul className="bar-list smooth-list">
              {topVideos.map((item) => <li key={item.videoId}><span>{item.title}</span><div className="bar-track"><span className={`bar-fill tone-${item.tone || 'blue'}`} style={{ width: `${Math.max(12, (item.count / Math.max(1, topVideos[0].count)) * 100)}%` }} /></div><b>{item.count}</b></li>)}
            </ul>
          : <p className="empty-note">No recorded videos in this range yet.</p>}
      </div>
      <div className="panel">
        <SectionHeading eyebrow="Contributors" title="Who is recording the most?" />
        {topContributors.length
          ? <ul className="bar-list smooth-list">
              {topContributors.map((item) => <li key={item.userId}><span>{item.name}</span><div className="bar-track"><span className="bar-fill tone-cyan" style={{ width: `${Math.max(12, (item.count / Math.max(1, topContributors[0].count)) * 100)}%` }} /></div><b>{item.count}</b></li>)}
            </ul>
          : <p className="empty-note">No contributor activity in this view.</p>}
      </div>
    </section>

    <section className="panel">
      <SectionHeading eyebrow="Latest" title="Recent submissions." />
      {recent.length
        ? <div className="table-wrap"><table className="table">
          <thead><tr><th>Contributor</th><th>Video</th><th>Category</th><th>Submitted</th><th><span className="sr-only">Status</span></th></tr></thead>
          <tbody>{recent.map((item) => <tr key={item.id}>
            <td>{item.contributor?.name || 'Unknown contributor'}</td>
            <td>{item.video?.title || 'Removed video'}</td><td>{item.category?.label || '—'}</td><td>{formatDate(item.submittedAt)}</td><td><Badge tone="success">Done</Badge></td>
          </tr>)}</tbody>
        </table></div>
        : <p className="empty-note">No submissions match this filter. Try a broader date range or a different contributor.</p>}
    </section>
  </>
}
