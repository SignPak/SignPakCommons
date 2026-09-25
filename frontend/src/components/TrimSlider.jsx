import { formatTime } from '../utils/format'

/** Two-handle range slider. Values are seconds; `total` is the full recording length. */
export default function TrimSlider({ total, start, end, onChange }) {
  const gap = Math.min(0.5, total / 2)
  const left = (start / total) * 100
  const right = 100 - (end / total) * 100
  return <div className="trim">
    <div className="trim-track"><span className="trim-fill" style={{ left: `${left}%`, right: `${right}%` }} /></div>
    <input type="range" min="0" max={total} step="0.1" value={start} aria-label="Trim start" aria-valuetext={formatTime(start)} onChange={(event) => onChange({ start: Math.min(Number(event.target.value), end - gap) })} />
    <input type="range" min="0" max={total} step="0.1" value={end} aria-label="Trim end" aria-valuetext={formatTime(end)} onChange={(event) => onChange({ end: Math.max(Number(event.target.value), start + gap) })} />
  </div>
}
