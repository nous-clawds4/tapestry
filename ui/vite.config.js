import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// The event-tagging core (src/lib/event-tagging) is a dependency-free CJS tree —
// the single source of truth for the wire shape + publish sequence (ADR
// event-tagging/0001, 0005). The UI imports it through this alias so the hook
// never re-inlines the wire shape. `server.fs.allow: ['..']` lets the dev server
// read it outside ui/; `build.commonjsOptions.include` lets the prod build
// transform the CJS tree (it lives outside node_modules). First cross-ui-boundary
// CJS import — verify the build resolves it via cycle-local.
const eventTaggingCore = fileURLToPath(new URL('../src/lib/event-tagging', import.meta.url))
// The broadcast-outcome core (story shared-concepts-seeding/1) is the single
// owner of what a publishToRelays result MEANS. Same cross-boundary CJS treatment
// as the event-tagging tree above, for the same reason: it must be unit-testable
// by the node runner, which cannot execute anything under ui/src.
const broadcastOutcomeCore = fileURLToPath(new URL('../src/lib/broadcastOutcome.js', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@tapestry/event-tagging': eventTaggingCore,
      '@tapestry/broadcast-outcome': broadcastOutcomeCore,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/src\/lib\/event-tagging/, /src\/lib\/broadcastOutcome/, /node_modules/],
    },
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        // Local control panel: default `docker compose` maps host :7778 (and :80 via nginx).
        // :8080 is the PRODUCTION remap only (OPERATIONS.md sed "80:80"→"127.0.0.1:8080:80"),
        // absent on a default local stack.
        target: 'http://localhost:7778',
        changeOrigin: true,
      },
    },
  },
})
