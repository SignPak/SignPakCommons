import { join } from './join'

export function Eyebrow({ children, light = false }) {
  return (
    <p className={join('eyebrow', light && 'eyebrow-light')}>
      {children}
    </p>
  )
}
