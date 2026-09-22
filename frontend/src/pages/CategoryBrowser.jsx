import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, ButtonLink, Eyebrow, PageState, VideoArtwork } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'
import { formatTime } from '../utils/format'

const SORTS = {
  All: { label: 'All signs' },
  Done: { label: 'Recorded first' },
  Not_Done: { label: 'Unrecorded first' },
}

export default function CategoryBrowser() {
  const { categoryId } = useParams()
  const { categories, videosIn, isDone } = useLibrary()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('All')

  const category = categories.find((item) => item.id === categoryId)
  const all = useMemo(() => (category ? videosIn(category.id) : []), [category, videosIn])

  const videos = useMemo(() => {
    return all
      .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => {
        const aDone = isDone(a.id)
        const bDone = isDone(b.id)
        if (sort === 'Done') return aDone && !bDone ? -1 : !aDone && bDone ? 1 : 0
        if (sort === 'Not_Done') return !aDone && bDone ? -1 : aDone && !bDone ? 1 : 0
        return 0
      })
  }, [all, query, sort, isDone])

  if (!category) {
    return (
      <PageState
        eyebrow="Not found"
        title="We couldn't find that category."
        action={<ButtonLink to="/home">Back to library</ButtonLink>}
      >
        It may have been renamed or removed.
      </PageState>
    )
  }

  return (
    <main className="page">
      <nav className="shell breadcrumb" aria-label="Breadcrumb">
        <Link to="/home">Library</Link>
        <span>/</span>
        <b>{category.label}</b>
      </nav>

      <section className="shell category-head">
        <div>
          <Eyebrow>Category · {all.length} {all.length === 1 ? 'sign' : 'signs'}</Eyebrow>
          <h1 className="display display-xl">
            {category.label}<br />
            <em>starts here.</em>
          </h1>
        </div>
        <p className="category-copy">{category.copy}</p>
      </section>

      <section className="shell category-body">
        <div className="filter-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <label className="search" style={{ flex: '1', minWidth: '240px' }}>
            <span>Search signs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “hello” or “thank you”"
            />
          </label>

          <label className="sort-select">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {videos.length ? (
          <div className="category-grid">
            {videos.map((video) => {
              const done = isDone(video.id)
              return (
                <Link key={video.id} to={`/video/${video.id}`} className="category-card">
                  <VideoArtwork video={video} className={`category-card-art tone-${video.tone}`}>
                    <span className="category-card-index">
                      {String(all.indexOf(video) + 1).padStart(2, '0')}
                    </span>
                    {done && (
                      <span className="category-card-done">
                        <Badge tone="success">Recorded ✓</Badge>
                      </span>
                    )}
                    <i className="category-card-play" aria-hidden="true">▶</i>
                  </VideoArtwork>
                  <p className="category-card-meta">
                    {video.level} · {formatTime(video.durationSec)}
                  </p>
                  <h3 className="display display-sm">{video.title}</h3>
                  <span className="category-card-cta">
                    {done ? 'View submission' : 'Record sign'} ↗
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="empty-note">No signs match your search. Try a different keyword.</p>
        )}
      </section>
    </main>
  )
}
