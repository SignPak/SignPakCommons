import { Eyebrow } from './Eyebrow'

export function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="section-heading">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="display display-md">{title}</h2>
      </div>
      {action}
    </div>
  )
}
