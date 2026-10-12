import { join } from './join'

export function VideoArtwork({ video, className = '', children }) {
  return (
    <div 
      className={join('media', className)} 
      style={video.poster ? { backgroundImage: `url(${video.poster})` } : undefined}
    >
      {children}
    </div>
  )
}
