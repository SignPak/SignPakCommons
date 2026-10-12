export function Alert({ tone = 'info', children }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`alert alert-${tone}`}>
      {children}
    </p>
  )
}
