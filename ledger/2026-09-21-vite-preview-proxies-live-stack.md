# The `vite preview` origin the B-class specs run against forwards `/api` to the live local stack, so a hermetic spec is hermetic only through its own catch-all route

**Id:** 2026-09-21-vite-preview-proxies-live-stack
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #1 review, harness friction 2)
**Status:** OPEN
**Done:** —

The B-class Playwright specs run against the built UI served by
`npx vite preview --port 4173 --strictPort` in `ui/`. The precedent is
`tests/brainstorm/assistant-setup-prompt.spec.js`, and the setup-status spec follows it. Both
describe themselves as hermetic.

They are hermetic only because every spec registers an `/api/**` catch-all route first. Vite
applies `server.proxy` (`ui/vite.config.js:40–48`, `/api` → `http://localhost:7778`) to
`vite preview` too. During the story's review, `curl http://localhost:4173/api/setup/status`
answered from `:7778`.

So a mock a spec misses reaches the operator's live local stack, and so does a POST. The Tester's
own account made the same mistake: it said "the preview has no backend".

Neither the test plan template, the spec precedent nor the B-class run recipe says any of this.

**Fix shape**, cheapest first:
1. `preview: { proxy: {} }` in `ui/vite.config.js`, so the preview origin has no backend at all.
2. Or a stated rule, in the B-class precedent and the test-plan template, that every spec registers
   the catch-all before any specific route.

**A second leak: the global setup (setup-status-and-alert #2 review).** Playwright's global setup
is not mocked at all. `tests/global-setup.js` loads the base URL (`:27`) and then `/api/neo4j-health`
(`:37`) before any spec registers its routes. Through `:4173` both reach the live `:7778`. The health
check gets Express's "Cannot GET" 404, and the setup still prints "✅ Neo4j health endpoint is
accessible", because `page.goto` does not throw on a 404. The leaked requests are signed-out GETs,
so no harm is done. But a spec that calls itself hermetic is not hermetic as a run. Fix shape 1
(`preview: { proxy: {} }`) closes both leaks.

**Pointer:** `engineering-team/reviews/done/setup-status-and-alert/1-setup-shows-where-you-stand.md`
§ Harness friction 2; `engineering-team/reviews/done/setup-status-and-alert/2-the-setup-alert.md`
§ Harness friction 1.
