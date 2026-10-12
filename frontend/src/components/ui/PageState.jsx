import { Eyebrow } from './Eyebrow'

/** Full-page message for empty, missing or blocked states. */
export function PageState({ eyebrow, title, children, action }) {
  return (
    <main className="page-state shell">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="display display-lg">{title}</h1>
      <p className="page-state-copy">{children}</p>
      {action}
    </main>
  )
}
