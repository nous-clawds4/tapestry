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
// The identification-tags library (src/lib/identification-tags): the four required taggings and their canonical
// author, one definition for the server's check and the Identification Tags page (ADR
// assistant-identification-tags/0001 sub-decision 1). Same cross-boundary CJS treatment as the two above.
const identificationTagsCore = fileURLToPath(new URL('../src/lib/identification-tags', import.meta.url))
// Editing a Dictionary concept's header (src/lib/conceptHeaderEdit.js): the server's edit endpoint and the edit
// page's preview compose with the same code. Same cross-boundary CJS treatment as the three above.
const conceptHeaderEditCore = fileURLToPath(new URL('../src/lib/conceptHeaderEdit.js', import.meta.url))
// Create New Concept from the finder copies the shared header's tags (src/lib/conceptHeaderCopy.js): the server
// and the page's preview compose with the same code, as above.
const conceptHeaderCopyCore = fileURLToPath(new URL('../src/lib/conceptHeaderCopy.js', import.meta.url))
// The NIP-65 relay-list library (src/lib/relay-list): the server's outbox check and relay-list publish, and the Outbox
// Relays page's draft rules, compare relays by the same one spelling (ADR assistant-outbox-relays/0001 sub-decision 1).
// Same cross-boundary CJS treatment as the ones above.
const relayListCore = fileURLToPath(new URL('../src/lib/relay-list', import.meta.url))
// The profile checklist's items (src/lib/assistant-profile-items): one list for the server's check and the
// /assistant/profile page (ADR assistant-profile-checklist/0001 sub-decision 1). Same cross-boundary CJS treatment.
const assistantProfileItemsCore = fileURLToPath(new URL('../src/lib/assistant-profile-items', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@tapestry/event-tagging': eventTaggingCore,
      '@tapestry/broadcast-outcome': broadcastOutcomeCore,
      '@tapestry/identification-tags': identificationTagsCore,
      '@tapestry/concept-header-edit': conceptHeaderEditCore,
      '@tapestry/concept-header-copy': conceptHeaderCopyCore,
      '@tapestry/relay-list': relayListCore,
      '@tapestry/assistant-profile-items': assistantProfileItemsCore,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/src\/lib\/event-tagging/, /src\/lib\/broadcastOutcome/, /src\/lib\/identification-tags/, /src\/lib\/conceptHeaderEdit/, /src\/lib\/conceptHeaderCopy/, /src\/lib\/relay-list/, /src\/lib\/assistant-profile-items/, /node_modules/],
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
