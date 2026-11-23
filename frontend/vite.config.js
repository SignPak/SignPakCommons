import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { PRODUCTION_API_ORIGIN, securityHeaders } from './config/securityHeaders.js'

// The API the E2E run talks to (backend/scripts/e2e-server.js).
const E2E_API_PORT = process.env.E2E_API_PORT || '5099'

// S8: `vite preview` sends the production headers (vercel.json), so the E2E suite runs under the
// real CSP. A build for another API origin (the cross-host E2E build) gets that origin instead.
const previewHeaders = Object.fromEntries(
  securityHeaders(process.env.VITE_API_ORIGIN || PRODUCTION_API_ORIGIN).map(({ key, value }) => [key, value]),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // The site's public origin for canonical links, baked in at build time. Same SITE_URL
  // variable the SEO script reads (src/seo/seoCatalog.mjs); empty means the production default,
  // https://commons.signpak.tech.
  define: {
    __SITE_URL__: JSON.stringify(process.env.SITE_URL ?? ''),
  },
  // ffmpeg.wasm starts its own module worker; pre-bundling would break the worker URL.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
  // `vite preview` serves the production build for the Playwright suite. Proxying /api keeps
  // the site and the API on one origin, so the session cookie behaves the same in every
  // browser engine (the cross-hostname cookie case gets its own test in Phase 1).
  preview: {
    // The cross-host E2E serves the site as commons.localtest.me (e2e/playwright.config.js).
    allowedHosts: ['.localtest.me'],
    headers: previewHeaders,
    proxy: {
      '/api': `http://127.0.0.1:${E2E_API_PORT}`,
    },
  },
  // Vitest reads this config, so the React plugin above applies to JSX in tests too.
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{js,jsx}'],
      // Generated SEO assets and the app entry point have no behaviour worth asserting.
      exclude: ['src/main.jsx', 'src/seo/**'],
      // FIX-PLAN section 4.6. Floors may only go up. Phase 10 raised them to the figures it
      // reached, rounded down: src/utils and src/services are past the 80% target; the 70%
      // overall target is not met yet (pages, contexts and hooks), see PHASE-10.md.
      thresholds: {
        lines: 55,
        statements: 52,
        functions: 51,
        branches: 48,
        'src/utils/**': {
          lines: 98,
          statements: 94,
          functions: 93,
          branches: 80,
        },
        'src/services/**': {
          lines: 98,
          statements: 97,
          functions: 98,
          branches: 91,
        },
      },
    },
  },
})
