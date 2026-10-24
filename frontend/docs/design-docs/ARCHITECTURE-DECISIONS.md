# Frontend architecture decisions

This is a record of current choices and their trade-offs, not a dated changelog.

## The API owns persistent domain data

**Decision:** Accounts, categories, reference videos, and submitted recordings
are loaded and changed through the backend API. React context coordinates
session-level UI state; it is not a second persistent database.

**Reason and trade-off:** One server authority keeps permissions, visibility,
consent, and submission rules consistent across devices. The UI must handle
network errors and may need to refresh after mutations.

**Implementation:** `src/services/api.js`, `src/context/LibraryProvider.jsx`,
and `src/context/AuthProvider.jsx`.

## Keep unfinished capture work in memory

**Decision:** An unsubmitted recording and its edits remain in memory while the
user moves between the player and editor. The upload queue is also in memory,
with one active and one waiting upload.

**Reason and trade-off:** Camera media and recordings are sensitive and can be
large. Avoiding persistent browser storage reduces data retention but means a
tab close can lose unfinished work; the UI warns when uploads are pending.

**Implementation:** `src/context/RecordingProvider.jsx` and
`src/context/UploadQueueProvider.jsx`.

## Use one native video element and browser-managed playback

**Decision:** The player updates the media source on a persistent native
`<video>` element. It resets playback controls and current time when the
selected video changes. It does not embed third-party watch pages in iframes.

**Reason and trade-off:** Native video supports the recorder workflow,
responsive layout, playback controls, and direct file URLs without coupling
the player to a particular video platform. Direct external sources must be
compatible with browser media playback.

**Implementation:** `src/pages/Player.jsx`, `src/components/BasePlayer.jsx`,
and `src/components/ResponsiveVideo.jsx`.

## Cache recently played videos, but retain a network fallback

**Decision:** Download cacheable reference videos as Blobs and hold them in a
bounded in-memory cache for five minutes after download. Prefetch the next
video. If caching fails, exceeds its limits, or the remote host disallows CORS,
play from the original media URL.

**Reason and trade-off:** The Blob cache makes repeat playback predictable
across browser HTTP-cache implementations, but downloading whole files uses
memory and requires CORS for cross-origin sources. Large videos and
non-CORS sources therefore bypass the cache.

**Implementation:** `src/utils/videoCache.js`, `src/hooks/useCachedVideo.js`,
and `src/services/api.js`.

## Keep upload preparation client-side

**Decision:** The browser prepares admin-uploaded reference/demo videos,
including optional trim/audio removal and poster-frame capture. The backend
stores submitted dimensions and duration as metadata rather than probing or
transcoding media.

**Reason and trade-off:** This avoids a separate media-processing service.
ffmpeg.wasm is a sizeable, network-loaded dependency, so the UI must retain an
unchanged-upload path when processing is not available.

**Implementation:** `src/components/VideoPrep.jsx`,
`src/utils/processVideo.js`, and `src/utils/media.js`.
