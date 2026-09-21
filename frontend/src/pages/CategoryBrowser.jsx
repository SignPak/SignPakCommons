import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, ButtonLink, Eyebrow, PageState, SectionHeading, VideoArtwork } from '../components/ui'
import { useLibrary } from '../context/LibraryContext'
import { formatTime } from '../utils/format'

const SORTS = {
  path: { label: 'Path order', compare: (a, b) => (a.order || 0) - (b.order || 0) },
  newest: { label: 'Newest first', compare: (a, b) => b.createdAt - a.createdAt },
  shortest: { label: 'Shortest first', compare: (a, b) => a.durationSec - b.durationSec },
}

export default function CategoryBrowser() {
  const { categoryId } = useParams()
  const { categories, videosIn, isDone } = useLibrary()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('All levels')
  const [sort, setSort] = useState('path')

  const category = categories.find((item) => item.id === categoryId)
  const all = useMemo(() => (category ? videosIn(category.id) : []), [category, videosIn])
  const levels = ['All levels', ...new Set(all.map((item) => item.level))]
  const lessons = all
    .filter((item) => level === 'All levels' || item.level === level)
    .filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(SORTS[sort].compare)

  if (!category) {
    return <PageState eyebrow="Not found" title="We couldn't find that path." action={<ButtonLink to="/home">Back to library</ButtonLink>}>It may have been renamed or removed.</PageState>
  }

  return <main className="page">
    <nav className="shell breadcrumb" aria-label="Breadcrumb"><Link to="/home">Library</Link><span>/</span><b>{category.label}</b></nav>
    <section className="shell category-head">
      <div><Eyebrow>Learning path · {all.length} {all.length === 1 ? 'lesson' : 'lessons'}</Eyebrow><h1 className="display display-xl">{category.label}<br /><em>starts here.</em></h1></div>
      <p className="category-copy">{category.copy}</p>
    </section>

    <section className="shell category-body">
      <SectionHeading eyebrow={`${lessons.length} showing`} title="Pick a lesson." action={
        <div className="filters">
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort lessons">{Object.entries(SORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select>
          <select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Filter by level">{levels.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
      } />
      <label className="search"><span>Search lessons</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “introduction”" /></label>

      {lessons.length
        ? <div className="lesson-grid">
          {lessons.map((lesson) => {
            const done = isDone(lesson.id)
            return <Link key={lesson.id} to={`/lesson/${lesson.id}`} className="lesson-card">
              <VideoArtwork video={lesson} className={`lesson-card-art tone-${category.tone}`}>
                <span className="lesson-card-index">{String(all.indexOf(lesson) + 1).padStart(2, '0')}</span>
                {done && <span className="lesson-card-done"><Badge tone="success">Done ✓</Badge></span>}
                <i className="lesson-card-play" aria-hidden="true">▶</i>
              </VideoArtwork>
              <p className="lesson-card-meta">{lesson.level} · {formatTime(lesson.durationSec)}</p>
              <h3 className="display display-sm">{lesson.title}</h3>
              <span className="lesson-card-cta">{done ? 'Submitted' : 'Open lesson'} ↗</span>
            </Link>
          })}
        </div>
        : <p className="empty-note">{all.length ? 'No lessons match those filters. ' : 'No lessons in this path yet. '}{all.length > 0 && <button type="button" className="link-accent" onClick={() => { setQuery(''); setLevel('All levels') }}>Clear filters</button>}</p>}
    </section>
  </main>
}
