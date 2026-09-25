import { useRef, useState } from 'react'
import { formatTime } from '../utils/format'

const SPEEDS = [0.5, 0.75, 1]

/** Base video player: play/pause, replay, seek, speed and fullscreen. The parent owns the <video> ref. */
export default function BasePlayer({ video, videoRef }) {
  const frame = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [failed, setFailed] = useState(false)

  const toggle = () => {
    const element = videoRef.current
    if (!element) return
    if (element.paused || element.ended) element.play().catch(() => {})
    else element.pause()
  }
  const replay = () => {
    const element = videoRef.current
    if (!element) return
    element.currentTime = 0
    element.play().catch(() => {})
  }
  const seek = (event) => { videoRef.current.currentTime = Number(event.target.value) }
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    videoRef.current.playbackRate = next
    setSpeed(next)
  }
  const fullscreen = () => frame.current?.requestFullscreen?.()

  return <div className="base-player" ref={frame}>
    <div className="base-player-stage">
      <video
        ref={videoRef} src={video.videoUrl} poster={video.poster} className="base-player-video" playsInline autoPlay
        onClick={toggle} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onError={() => setFailed(true)}
      />
      {failed
        ? <p className="base-player-error" role="alert">This video could not be loaded. Try again later or pick another video.</p>
        : !playing && <button type="button" className="base-player-big" onClick={toggle} aria-label="Play video">▶</button>}
    </div>
    <div className="base-player-controls">
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? 'Ⅱ' : '▶'}</button>
      <button type="button" onClick={replay} aria-label="Replay from the start">↺</button>
      <input type="range" className="base-player-seek" min="0" max={duration || 0} step="0.01" value={Math.min(time, duration || 0)} onChange={seek} aria-label="Seek" />
      <span className="base-player-time">{formatTime(time)} / {formatTime(duration)}</span>
      <button type="button" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x. Change speed`}>{speed}×</button>
      <button type="button" onClick={fullscreen} aria-label="Fullscreen">⛶</button>
    </div>
  </div>
}
