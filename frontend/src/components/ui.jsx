export function Brand({ onClick, light = false }) {
  return <button onClick={onClick} className={`flex items-center gap-2 text-xl font-black tracking-tight ${light ? 'text-[#fffaf0]' : 'text-[#282824]'}`}><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e3533d] font-serif text-lg italic text-white">S</span><span>sign<span className="text-[#e3533d]">pak</span></span></button>
}

export function Eyebrow({ children, light = false }) {
  return <p className={`mb-4 text-[10px] font-bold uppercase tracking-[.2em] ${light ? 'text-[#f0b59f]' : 'text-[#e3533d]'}`}>{children}</p>
}

export function Button({ children, onClick, variant = 'dark', className = '', type = 'button', disabled = false }) {
  const variants = { dark: 'bg-[#282824] text-[#fffaf0] hover:bg-[#e3533d]', light: 'bg-[#f6f2e9] text-[#282824]', outline: 'border border-[#d6d0c2] text-[#282824] hover:border-[#e3533d]', ghost: 'text-[#282824] hover:text-[#e3533d]' }
  return <button type={type} onClick={onClick} disabled={disabled} className={`border border-transparent px-5 py-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}>{children}</button>
}

export function SectionHeading({ eyebrow, title, action }) {
  return <div className="mb-7 flex items-end justify-between gap-5"><div><Eyebrow>{eyebrow}</Eyebrow><h2 className="font-serif text-4xl leading-none tracking-[-.04em] text-[#282824] sm:text-5xl">{title}</h2></div>{action}</div>
}

export function VideoArtwork({ lesson, className = '', children }) {
  return <div className={`relative bg-cover bg-center saturate-75 ${className}`} style={{ backgroundImage: `url(${lesson.image})` }}>{children}</div>
}
