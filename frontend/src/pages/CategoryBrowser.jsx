import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, ButtonLink, Eyebrow, PageState, SectionHeading, VideoArtwork } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'
import { paths, watchUrl } from '../routes/appRoutes'
import { formatTime } from '../utils/format'
import { safeRouteId } from '../utils/validators'

const SORTS = {
  path: { label: 'Category order', compare: (a, b) => (a.order || 0) - (b.order || 0) },
  newest: { label: 'Newest first', compare: (a, b) => b.createdAt - a.createdAt },
  shortest: { label: 'Shortest first', compare: (a, b) => a.durationSec - b.durationSec },
}

export default function CategoryBrowser() {
  const { categoryId: rawCategoryId } = useParams()
  const categoryId = safeRouteId(rawCategoryId)
  const { categories, videosIn, hasSubmission, submissionCount } = useLibrary()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('path')

  const category = categories.find((item) => item.id === categoryId)
  const all = useMemo(() => (category ? videosIn(category.id) : []), [category, videosIn])
  const videos = all
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(SORTS[sort].compare)

  if (!category) {
    return <PageState eyebrow="Not found" title="We couldn't find that category." action={<ButtonLink to={paths.library}>Back to library</ButtonLink>}>It may have been renamed or removed.</PageState>
  }

  return <main className="page">
    <nav className="shell breadcrumb" aria-label="Breadcrumb"><Link to={paths.library}>Library</Link><span>/</span><b>{category.label}</b></nav>
    <section className="shell category-head">
      <div><Eyebrow>Category · {all.length} {all.length === 1 ? 'video' : 'videos'}</Eyebrow><h1 className="display display-xl">{category.label}<br /><em>starts here.</em></h1></div>
      <p className="category-copy">{category.copy}</p>
    </section>

    <section className="shell category-body">
      <SectionHeading eyebrow={`${videos.length} showing`} title="Pick a video." action={
        <div className="filters">
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort videos">{Object.entries(SORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
        </div>
      } />
      <label className="search"><span>Search videos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “introduction”" /></label>

      {videos.length
        ? <div className="video-grid">
          {videos.map((video) => {
            const count = submissionCount(video.id)
            return <Link key={video.id} to={watchUrl(video.id)} className="video-card">
              <VideoArtwork video={video} className={`video-card-art tone-${category.tone}`}>
                <span className="video-card-index">{String(all.indexOf(video) + 1).padStart(2, '0')}</span>
                {hasSubmission(video.id) && <span className="video-card-done"><Badge tone="success">✓ {count} submitted</Badge></span>}
                <i className="video-card-play" aria-hidden="true">▶</i>
              </VideoArtwork>
              <p className="video-card-meta">{formatTime(video.durationSec)}</p>
              <h3 className="display display-sm">{video.title}</h3>
              <span className="video-card-cta">{hasSubmission(video.id) ? 'Record another' : 'Open video'} ↗</span>
            </Link>
          })}
        </div>
        : <p className="empty-note">{all.length ? 'No videos match that search. ' : 'No videos in this category yet. '}{all.length > 0 && <button type="button" className="link-accent" onClick={() => setQuery('')}>Clear search</button>}</p>}
    </section>
  </main>
}
