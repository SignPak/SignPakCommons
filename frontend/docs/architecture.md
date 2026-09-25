# Frontend Architecture

## Purpose

This frontend is a React application for SignPakCommons, a video data collection and contributor workflow. The app supports public browsing, authenticated contributor flows, recording and submission, admin management, and SEO-friendly static pages.

The project uses:

- React 19
- Vite
- Tailwind CSS v4
- React Router
- Context-based state management

## Runtime Architecture

### 1. App bootstrap

The application starts in `src/main.jsx`.

- Wraps the app in `ThemeProvider`
- Mounts the app inside `BrowserRouter`
- Installs the authentication, notification, library, and recording providers in nested order
- Renders the root app component

This pattern keeps global app state centralized and predictable while preserving a simple top-level composition model.

### 2. Route composition

The route tree lives in `src/App.jsx`.

The app uses nested route groups:

- Public routes: landing, demo, FAQ, login, signup
- Authenticated contributor routes: home, library, watch, profile, editor
- Admin-only routes: dashboard, video management, category management

Access control is enforced by route guards:

- `RequireAuth` redirects unauthenticated users to login
- `RequireAdmin` restricts admin-only screens
- `GuestOnly` prevents signed-in users from visiting login/signup flows again

This keeps screen-level permissions declarative and consistent across the UI.

## State Management

The app relies primarily on React context providers instead of a full external state library.

### Auth

- `src/context/AuthContext.js`
- `src/context/AuthProvider.jsx`

Owns user session state, auth checks, loading state, and admin status. UI route guards read directly from this context.

### Library

- `src/context/LibraryContext.js`
- `src/context/LibraryProvider.jsx`

Tracks the category/video browsing workflow and related UI state.

### Recording

- `src/context/RecordingContext.js`
- `src/context/RecordingProvider.jsx`

Controls recording-session state, playback/editing flow, and submission-related UI state.

### Notifications

- `src/context/NotificationContext.js`
- `src/context/NotificationProvider.jsx`

Handles per-user notifications and read state, mirroring the local persistence pattern used elsewhere in the app.

### Theme

- `src/context/ThemeContext.js`
- `src/context/ThemeProvider.jsx`

Manages light/dark mode and persists user preference with local storage while honoring the OS preference on first load.

## UI and Layout Structure

### Shared shell

The app uses a shared layout system from `src/components/Layouts.jsx` and a set of reusable pieces such as:

- `Header`
- `Footer`
- `AuthShell`
- `NotificationBell`
- `ThemeToggle`
- `RouteGuards`
- UI primitives like `Field`, `PageState`, and `ButtonLink`

This keeps navigation, auth framing, and page-level chrome consistent across route groups.

### Page organization

Pages are organized by feature:

- `src/pages/` for public and user-facing views
- `src/pages/admin/` for admin screens and nested admin layout

Examples:

- `Landing`, `Demo`, `Faq`
- `Login`, `Signup`, `Home`
- `CategoryBrowser`, `Player`, `RecordingEditor`, `ProfileDashboard`
- `AdminDashboard`, `AdminVideos`, `AdminCategories`

Each page is mostly self-contained and uses shared providers and reusable UI primitives instead of a large global component tree.

## Data Flow

The frontend is designed around a service boundary rather than direct fetch calls scattered across components.

### Service layer

The project expects data access to happen through service modules under `src/services/`.

That boundary is important because the app currently contains mock/local behavior while the backend is still being integrated. In practice, the app intentionally centralizes access patterns so that the UI layer does not care whether the source is mock storage, local storage, or a live API.

### Mock-first strategy

This frontend is currently built with a mock data model and browser persistence patterns, including:

- localStorage for session and preferences
- IndexedDB for generated or uploaded local media assets
- in-browser mock API behavior for likes, submissions, and demo data

This keeps the UX functional without a backend, which is useful for product iteration and UI validation.

## Styling Architecture

The app uses Tailwind CSS with semantic component classes and theme tokens rather than scattered raw color literals.

### Design approach

- Utility classes are not the primary pattern for this app
- CSS is organized around semantic selectors such as `.btn`, `.lesson-card`, `.recorder`, and theme-related tokens
- The app uses CSS custom properties to support light/dark mode
- Theme values are centralized and switchable from a single theme definition

This makes style updates easier and reduces the risk of inconsistent colors or mismatched ui states.

## SEO and static generation

The frontend includes dedicated SEO support under `src/seo/` and scripts in the project root of the frontend.

### SEO flow

- `src/seo/seoCatalog.mjs` defines public routes and metadata
- `scripts/generateSeoAssets.js` generates assets like `sitemap.xml` and `robots.txt`
- `npm run seo:generate` runs before build
- `npm run snap` can prerender pages for static HTML output

This architecture supports discoverability and strong initial metadata for public pages while keeping route metadata data-driven.

## Routing and URL conventions

The app uses path-based navigation and query-string IDs for media items.

Examples:

- `/` landing page
- `/demo` walkthrough page
- `/home` contributor dashboard
- `/library/:categoryId` category browsing
- `/watch?v=<videoId>` media playback
- `/watch/edit?v=<videoId>` editing flow
- `/admin` admin dashboard

This design separates content identity from route structure, making links less brittle as categories or catalog ordering change.

## Folder Map

```text
frontend/
  src/
    App.jsx                    # route layout and screen composition
    main.jsx                   # app bootstrap and provider nesting
    components/                # reusable UI and layout pieces
    context/                   # global state providers
    hooks/                     # custom React hooks
    pages/                     # route-level screens
    pages/admin/               # admin screens
    routes/                    # route helpers and path definitions
    services/                  # API/service boundary
    seo/                       # metadata and SEO catalog
    styles/                    # theme and shared CSS
    utils/                     # helpers and shared utilities
    mock/                      # demo data and local-generated state
  docs/
    architecture.md           # this document
  scripts/
    generateSeoAssets.js
    runReactSnap.js
```

## Architectural Principles

1. Keep route-level access logic declarative with guards.
2. Keep global app state in context providers instead of prop drilling.
3. Centralize backend communication behind service boundaries.
4. Keep shared UI and theme tokens reusable across screens.
5. Separate navigation, content state, and provider orchestration so the app is easy to evolve.

## Summary

The frontend is a modular React application organized around a clear provider-based state model, route-driven screens, reusable UI shells, and a mock-first data layer. Its architecture is intentionally structured so it can evolve from a browser-only prototype into a real backend-backed app without major changes to the screen composition or route design.
