import { Component } from 'react'
import { isReloadingForNewBuild } from '../utils/chunkReload'
import { PageLoading } from './PageLoading'
import { Button, Eyebrow } from './ui'

/**
 * Catches an error while a page loads or renders, so the header stays and the visitor gets a way
 * out instead of a blank screen. The usual cause is a lazy page chunk that could not be fetched
 * (utils/chunkReload.js reloads once for a deploy; this is what shows when that did not help).
 * `resetKey` (the path) clears the error when the visitor goes to another page.
 */
export default class PageErrorBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { error }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  render() {
    if (!this.state.error) return this.props.children
    // The page is about to reload for a new build: keep the loading line rather than flash the error.
    if (isReloadingForNewBuild()) return <PageLoading />
    // A section, not PageState's <main>: in the admin workspace it sits inside the layout's <main>.
    return (
      <section className="page-state shell" role="alert">
        <Eyebrow>Something went wrong</Eyebrow>
        <h2 className="display display-lg">This page could not be loaded.</h2>
        <p className="page-state-copy">Reload to try again.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </section>
    )
  }
}
