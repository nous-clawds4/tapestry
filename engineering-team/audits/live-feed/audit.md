# Build Audit: Live feed (kind-1 notes from follows)

**Book:** `engineering-team/audits/live-feed/book.md`
**Date:** 2026-06-15
**Branch / commit range:** `42245387`..`feat/live-feed` (feature merged to `staging` at `80a39afd`, PR [#296](https://github.com/nous-clawds4/tapestry/pull/296))
**Provenance:** Acceptance-frame (no PRD; operator's confirmed frame at kickoff)
**Confidence:** high — 8/8 acceptance-frame bullets verified on staging; built via the full per-story harness (Planning → Architecture → Test → Implementation → Review) under Direction mode with a blinded gate-judge at every gate.

> As-built record. What the product *is* now, source-linked. It proposes no changes — that's `prd-seed.md`.

## 1. What shipped

- **Public `/feed` page** — a login-free, bookmarkable page showing recent kind-1 notes from the source identity's follows, newest-first, with a heading + recent-window indicator + three empty-state messages — `stories/live-feed/2-feed-page.md`.
- **`GET /api/feed` read path** — resolves a single source identity (logged-in user, else House PoV) → reads its kind-3 follow list from local strfry → fetches followed authors' kind-1 notes from the Concept-Graph general-purpose relay set (with a hardcoded fallback) → enriches authors from local kind-0 profiles; returns a discriminated outcome with a 50-note cap, newest-first, kind-1 only — `stories/live-feed/1-feed-read-path.md`.

The feed is deliberately plain by design: it is the **host surface** for a later, separate tagging book (out of scope here).

## 2. Epics & stories rolled up

### Epic: `live-feed`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 feed-read-path | Backend read path → `GET /api/feed`, four-outcome `status` union + `relaySource`, cap 50, newest-first, local profile enrichment | Done | `reviews/live-feed/1-feed-read-path.md` (PASS) |
| #2 feed-page | Public `/feed` React page rendering #1's output: heading, indicator, per-note author/avatar/timestamp/text, three empty states, defensive case | Done | `reviews/live-feed/2-feed-page.md` (PASS) |

ADRs: `decisions/live-feed/0001-feed-read-path-endpoint.md` (+ a post-Gate-2 testability-seam amendment) and `decisions/live-feed/0002-feed-page.md`.

## 3. As-built inventory
Derived from the diff (`42245387..HEAD`, 6 files, **+516 / -0** — strictly additive):

- **User-facing:**
  - New route **`GET /feed`** (public SPA route; served by the existing SPA fallback in `bin/control-panel.js`, auth-passthrough for non-`/api/` paths) — `ui/src/App.jsx` (+5), `ui/src/pages/BrainstormFeed.jsx` (new, 127 lines), `ui/src/hooks/useFeed.js` (new, 52), `ui/src/styles.css` (+64, `bsp-feed-*`).
  - New endpoint **`GET /api/feed`** (public, no auth gate) — `src/api/feed/feedReadPath.js` (new, 264), registered in `src/api/index.js` (+4).
- **Domain:** No concept definitions added or changed → **no firmware reinstall**. Concepts *read* (by handle, not redefined): `39999:<TA>:the-set-of-general-purpose-relays` (relay set, resolved by slug from `getOwnerAssistantPubkey()`), `nostr-kind` (0/1/3), `nostr-user`. House identity reuses `grapevine.searchPreferences.povPubkey` per ADR 0033 / BIBLE §27.
- **Data & contracts:**
  - Reads: kind-3 (local strfry), kind-1 (external general-purpose relays), kind-0 (local strfry / Meilisearch). **No writes/publishes.**
  - `GET /api/feed` response: `{ success, status ∈ {OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE}, source?:{pubkey,origin}, relaySource?:'set'|'fallback', items?:[{id,pubkey,createdAt,content,author:{displayName,avatar}}] }`. This shape is the contract Story #2's page consumes (ADR 0002 Consequences → "Constrains").

## 4. Deviations from intent

Harvested from ADR `Consequences`, story `Out of scope`, and review notes, reconciled against the diff. No deviation changes what the frame promises a user; all are additive refinements or explicitly-scoped edges.

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "the page makes clear it shows a recent window (a fixed cap)" | Cap fixed at **50**; copy "Showing the most recent 50 notes." | interpretation | Director delegated decision (book §"Open design decisions"), journaled — simplest value satisfying the frame | None — within frame | — |
| 2 | Frame bullet 6 empty-state copy | Exact wording chosen by the Director; impl reworded 6b to "The follow list for this identity is not available locally yet." | interpretation | Story #2 "punctuation/wording non-binding"; review `2-feed-page.md` finding (sanctioned, meaning preserved) | None — meaning preserved | — |
| 3 | Frame bullet 6: empty states "not … an error" | A *live relay-fetch timeout* currently surfaces HTTP 500 rather than degrading to `EMPTY`/`OK` (ADR 0001 impl-note intent was degrade) | constraint-discovered | Review `1-feed-read-path.md` finding #2; the reused `fetchEvents.js` timeout throws → caught → 500. **No frame bullet pins timeout→EMPTY**; at staging evidence time relays answered in ~9.4s and returned `OK`/50, so the path did not fire | Low — only on total relay timeout, which staging real-relays did not hit | **Yes** — harden to degrade gracefully (carry-forward) |
| 4 | (testability — not a frame item) | ADR 0001 amended post-Gate-2 to ratify an injectable-deps seam on `buildFeed` | added-beyond-scope (test-enabling) | Tester surfaced the seam; Architect ratified (amendment #1); purely a wiring seam, no behavior change | None | — |

**Undocumented work:** none. Every changed file traces to story #1 (`feedReadPath.js`, `index.js`), story #2 (`BrainstormFeed.jsx`, `useFeed.js`, `App.jsx`, `styles.css`), or their ADRs/tests. The diff is `+516/-0` with no unprovenanced changes.

## 5. Quality state at close
- **Test gate at close:** `npm test` (= `node test/test.js`) → **Overall PASS** — `live-feed-read-path` 23/23, `live-feed-feed-page` 18/18, all pre-existing suites green.
- **Staging:** five-tier smoke passed on `staging.brainstorm.world` (PR #296, deploy `27518919488` success); Tier-4 rendered ≥3 (50) anonymous House-PoV notes captured (`tier4-dom-extract.txt` + screenshot).
- **Known open issues / accepted edges:**
  - Live relay-timeout → 500 instead of graceful `EMPTY`/`OK` (§4 #3) — accepted; no frame bullet pins it.
  - `feedReadPath.js:53` reuses the imperfect single-quote escape from `fetchProfiles.js` (source pubkey HEX64-validated upstream → narrow surface) — review finding #1.
  - `BrainstormFeed.jsx` avatar `<img>` omits the `onError` broken-image-hide handler other pages use — cosmetic.
- **Debt logged by ADRs:** ADR 0001 Consequences — a second, local-only kind-0 read path lives alongside `fetchProfiles.js`; revisit a shared "social read" service (rejected Option C) if a third consumer appears.

## 6. Carry-forward register
- [ ] **Tagging the feed** — the *reason* the feed exists; a separate, later book depending on the `nostr-event-tag` wire spec (book intent anchor; story/epic Out of scope).
- [ ] **Graceful relay-timeout handling** — degrade a live relay-fetch timeout to `EMPTY`/`OK` rather than 500 (§4 #3 / review #2).
- [ ] **strfry single-quote escape** — harden `feedReadPath.js:53` (and ideally the shared `fetchProfiles.js:94` convention) to the canonical `'\''` form (review #1).
- [ ] **Avatar `onError`** — add the broken-image-hide handler to feed avatars for parity with other pages (review #2, cosmetic).
- [ ] **Source-relay consolidation** — if a third consumer of the local-only kind-0 read appears, revisit ADR 0001's rejected Option C (shared social-read service).
- [ ] **Possible future feature** — a "showing fallback relays" / source indicator on the page (ADR 0002 explicitly left `relaySource`/`source` unshown; a new story, not a silent add).
