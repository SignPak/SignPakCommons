import { Link } from 'react-router-dom'
import { Avatar, Eyebrow, ProgressBar, SectionHeading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../context/LibraryContext'
import { greeting } from '../utils/format'

export default function Home() {
  const { user } = useAuth()
  const { categories, videosIn, isDone, nextUp, orderedPublished, doneCount } = useLibrary()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const percent = orderedPublished.length ? (doneCount / orderedPublished.length) * 100 : 0
  const nextCategory = nextUp && categories.find((item) => item.id === nextUp.categoryId)
  const visibleCategories = categories.filter((item) => videosIn(item.id).length)

  return <main className="page">
    <section className="shell home-head">
      <div>
        <Eyebrow>{today}</Eyebrow>
        <h1 className="display display-xl">{greeting()}, <em>{user.firstName}.</em></h1>
        <p className="lede">What would you like to explore today?</p>
      </div>
      <Link to="/profile" className="chip-link"><Avatar user={user} size="sm" />{user.firstName} {user.surname}</Link>
    </section>

    <section className="shell continue">
      {nextUp ? <>
        <div>
          <Eyebrow>Continue learning ✦</Eyebrow>
          <h2 className="display display-md">{nextUp.title}</h2>
          <p className="continue-meta">{nextCategory?.label} · {nextUp.level}</p>
          <div className="continue-progress"><ProgressBar value={percent} label="Overall progress" /><span>{doneCount} of {orderedPublished.length} lessons done</span></div>
        </div>
        <Link to={`/lesson/${nextUp.id}`} className="continue-play" aria-label={`Open lesson: ${nextUp.title}`}>▶</Link>
      </> : <div><Eyebrow>{orderedPublished.length ? 'All caught up ✦' : 'Nothing here yet'}</Eyebrow><h2 className="display display-md">{orderedPublished.length ? 'You have submitted every lesson.' : 'Lessons are on their way.'}</h2><p className="continue-meta">{orderedPublished.length ? 'New lessons will appear here when they are published.' : 'Check back soon.'}</p></div>}
    </section>

    <section className="shell home-library">
      <SectionHeading eyebrow="Browse the library" title="Choose your path." />
      {visibleCategories.length
        ? <div className="category-grid">
          {visibleCategories.map((category, index) => {
            const lessons = videosIn(category.id)
            const done = lessons.filter((lesson) => isDone(lesson.id)).length
            return <Link key={category.id} to={`/library/${category.id}`} className={`category-tile tone-${category.tone}`}>
              <span className="category-tile-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="category-tile-arrow" aria-hidden="true">↗</span>
              <div><h3 className="display display-sm">{category.label}</h3><p>{category.copy}</p></div>
              <small>{lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} · {done} done</small>
            </Link>
          })}
        </div>
        : <p className="empty-note">No categories have published videos yet. Check back soon.</p>}
    </section>
  </main>
}
