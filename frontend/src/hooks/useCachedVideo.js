import { useEffect, useState } from 'react'
import { holdVideo, loadVideo, releaseVideo, removeVideoProgressListener } from '../utils/videoCache'

/**
 * Gives a player the cached copy of a video, downloading it first if needed.
 * status: 'loading' (progress is 0-1 or null) | 'ready' (src is a local blob URL)
 *       | 'network' (caching was not possible, so src is the plain server URL).
 */
export function useCachedVideo(video) {
  const url = video?.videoUrl
  const [state, setState] = useState({ url, status: 'loading', progress: 0, src: undefined })

  useEffect(() => {
    if (!url) return undefined
    let active = true
    let held = null
    const onProgress = (progress) => { if (active) setState((current) => (current.status === 'loading' ? { ...current, progress } : current)) }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart from "loading" whenever the video changes
    setState({ url, status: 'loading', progress: 0, src: undefined })
    loadVideo({ videoUrl: url }, onProgress)
      .then((entry) => {
        if (!active || entry.expired || !entry.url) { if (active) setState({ url, status: 'network', progress: 1, src: url }); return }
        holdVideo(entry)
        held = entry
        setState({ url, status: 'ready', progress: 1, src: entry.url })
      })
      .catch(() => { if (active) setState({ url, status: 'network', progress: 1, src: url }) })
    return () => {
      active = false
      removeVideoProgressListener(url, onProgress)
      if (held) releaseVideo(held)
    }
  }, [url])

  // A state object for a previous video must never be applied to the current one.
  return state.url === url ? state : { url, status: 'loading', progress: 0, src: undefined }
}
