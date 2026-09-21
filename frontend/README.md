# SignPakCommons: frontend

React 19 + Vite + Tailwind CSS v4 + React Router. Backend (Express + MongoDB) comes next; until then the app runs on a mock API that stores data in the browser.

## Run it

```bash
cd frontend
npm install
npm run dev
npm run lint
npm run build
```

## Demo accounts

| Role    | Email               | Password      |
| ------- | ------------------- | ------------- |
| Admin   | admin@signpak.dev   | Admin@123     |
| Learner | maya@example.com    | Learner@123   |

Anyone can also create a learner account on `/signup`. The **Open admin workspace** button on the profile page only appears for admins.

## Routes

| Path                        | Who        | What                                             |
| --------------------------- | ---------- | ------------------------------------------------ |
| `/`                         | public     | Landing: hero, about, policy, contact            |
| `/demo`                     | public     | "How it works" walkthrough video                 |
| `/signup`, `/login`         | logged out | Account forms                                    |
| `/home`                     | learner    | Categories                                       |
| `/library/:categoryId`      | learner    | Videos in a category (search, filter, sort)      |
| `/lesson/:videoId`          | learner    | Player and recorder                              |
| `/lesson/:videoId/edit`     | learner    | Review, trim, submit                             |
| `/profile`                  | learner    | Progress, submissions, GitHub / LinkedIn         |
| `/admin`                    | admin      | Dashboard                                        |
| `/admin/videos`             | admin      | Upload, preview, edit, publish, delete           |
| `/admin/categories`         | admin      | Create categories, assign videos                 |

## Folder layout

src/
  components/   shared UI (Header, Footer, Field, players, route guards)
  context/      Auth, Library and Recording state
  hooks/        useRecorder (camera + MediaRecorder)
  mock/         seed data and placeholder (lorem) copy
  pages/        one file per screen, admin/ for the workspace
  services/     api.js: the only file that talks to "the server"
  styles/       all styling; index.css just imports these
  utils/        formatting, validation, IndexedDB and video helpers

## Styling

No inline utility classes in JSX. Components use semantic class names (`.btn`, `.lesson-card`, `.recorder`...) defined in `src/styles/*.css` with Tailwind's `@apply`. Colours and fonts are tokens in `styles/theme.css`, so a palette change is one file.

## Connecting the backend

Every call goes through `src/services/api.js`, and every method is async and returns plain JSON. Replace the method bodies with `fetch()` calls and nothing else changes.

- **Passwords** are stored in plain text in the mock only. The real API must hash them (bcrypt or argon2) and use a proper session or JWT.
- **Recordings** are held in memory until submitted. On submit, `submissions.create` currently sends metadata only; the real call should upload the recorded `Blob` plus `trimStart` / `trimEnd` / `mirrored`, and the server does the cut (for example with ffmpeg). The browser does not re-encode.
- **Base videos** uploaded by admins are kept in IndexedDB on that device. The real call should be a multipart upload.
- **Seed videos** all use one public sample clip. Swap real URLs in `mock/data.js`, or just start uploading in the admin.
- **Demo page video**: set `DEMO_VIDEO` in `mock/data.js`, for example `/demo/how-it-works.mp4` placed in `public/demo/`.

To reset all mock data, clear this site's localStorage and IndexedDB in browser dev tools.
