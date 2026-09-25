import { Link } from 'react-router-dom'
import { Avatar, Eyebrow, ProgressBar, SectionHeading } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useLibrary } from '../context/LibraryContext'
import { categoryUrl, paths, watchUrl } from '../routes/appRoutes'
import { greeting } from '../utils/format'

export default function Home() {
  const { user } = useAuth()
  const { categories, videosIn, hasSubmission, nextUp, orderedPublished, contributedCount } = useLibrary()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const percent = orderedPublished.length ? (contributedCount / orderedPublished.length) * 100 : 0
  const nextCategory = nextUp && categories.find((item) => item.id === nextUp.categoryId)
  const visibleCategories = categories.filter((item) => videosIn(item.id).length)

  return <main className="page">
    <section className="shell home-head">
      <div>
        <Eyebrow>{today}</Eyebrow>
        <h1 className="display display-xl">{greeting()}, <em>{user.firstName}.</em></h1>
        <p className="lede">Which video would you like to contribute to today?</p>
      </div>
      <Link to={paths.profile} className="chip-link"><Avatar user={user} size="sm" />{user.firstName} {user.surname}</Link>
    </section>

    <section className="shell continue">
      {nextUp ? <>
        <div>
          <Eyebrow>Keep contributing ✦</Eyebrow>
          <h2 className="display display-md">{nextUp.title}</h2>
          <p className="continue-meta">{nextCategory?.label} · {nextUp.level}</p>
          <div className="continue-progress"><ProgressBar value={percent} label="Coverage across the library" /><span>{contributedCount} of {orderedPublished.length} videos have a recording from you</span></div>
        </div>
        <Link to={watchUrl(nextUp.id)} className="continue-play" aria-label={`Open video: ${nextUp.title}`}>▶</Link>
      </> : <div><Eyebrow>{orderedPublished.length ? 'Every video covered ✦' : 'Nothing here yet'}</Eyebrow><h2 className="display display-md">{orderedPublished.length ? 'You have recorded every video at least once.' : 'Videos are on their way.'}</h2><p className="continue-meta">{orderedPublished.length ? 'You can still record any of them again — new categories will also appear here when they are published.' : 'Check back soon.'}</p></div>}
    </section>

    <section className="shell home-library">
      <SectionHeading eyebrow="Browse the library" title="Choose a category." />
      {visibleCategories.length
        ? <div className="category-grid">
          {visibleCategories.map((category, index) => {
            const videos = videosIn(category.id)
            const contributed = videos.filter((video) => hasSubmission(video.id)).length
            return <Link key={category.id} to={categoryUrl(category.id)} className={`category-tile tone-${category.tone}`}>
              <span className="category-tile-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="category-tile-arrow" aria-hidden="true">↗</span>
              <div><h3 className="display display-sm">{category.label}</h3><p>{category.copy}</p></div>
              <small>{videos.length} {videos.length === 1 ? 'video' : 'videos'} · {contributed} covered</small>
            </Link>
          })}
        </div>
        : <p className="empty-note">No categories have published videos yet. Check back soon.</p>}
    </section>
  </main>
}
