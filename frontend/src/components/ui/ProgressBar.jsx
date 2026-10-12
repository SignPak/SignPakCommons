export function ProgressBar({ value, label }) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div 
      className="progress" 
      role="progressbar" 
      aria-label={label} 
      aria-valuemin={0} 
      aria-valuemax={100} 
      aria-valuenow={Math.round(percent)}
    >
      <span className="progress-bar" style={{ width: `${percent}%` }} />
    </div>
  )
}
