# Build Audit: Event page (single kind-1 view)

**Book:** `engineering-team/audits/event-page/book.md`
**Date:** 2026-06-19
**Branch / commit range:** `da269ba8`..`feat/event-page` (feature merged to `staging` at `a4ae90bc`, PR [#320](https://github.com/nous-clawds4/tapestry/pull/320))
**Provenance:** Acceptance-frame (no PRD; operator's confirmed frame at kickoff)
**Confidence:** high — 9/9 acceptance-frame bullets verified on staging; built via the full per-story harness (Planning → Architecture → Test → Implementation → Review), one CHANGES_REQUESTED → fixed (`f227fa22`) → PASS.

> As-built record. What the product *is* now, source-linked. It proposes no changes — that's `prd-seed.md`.

## 1. What shipped

- **Public `/event` page** — the placeholder is now a working single-event view: it decodes the six URL params client-side by precedence, renders a resolved kind-1 via the shared `NoteCard` (like `/feed`), or shows the precise outcome message; `naddr` reports its kind with no fetch; an invalid-params notice flags malformed supported params; with no valid param it shows a search field that resolves a pasted identifier — `stories/event-page/2-event-page-param-render.md`, `stories/event-page/3-event-page-search.md`.
- **`GET /api/event` read path** — given a resolved event id (with optional hints + optional carried author) or an author pubkey, it assembles the relay union (hints + author outbox + well-known/fallback), fetches, `verifyEvent`-gates, kind-gates, and enriches into the shared note item shape; returns a discriminated outcome — `stories/event-page/1-event-read-path.md`.
- **New shared `_shared/relaySource.js`** — the relay-sourcing primitives (relay-set resolution, external fetch, local scan, fallback), extracted as the 3rd consumer's shared home (Option A); the two shipped read paths are left byte-unchanged, re-point deferred to a logged follow-up.

The view is kind-1 only by design; rendering other kinds (long-form, reposts, reactions), threads/replies, and any write are out of scope here.

## 2. Epics & stories rolled up

### Epic: `event-page`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 event-read-path | `GET /api/event` (`buildEvent`/`handleGetEvent`); relay union (hints + outbox + well-known/fallback), `verifyEvent`, kind-gate, `enrichNotes` reuse; six-outcome `status` union; new `_shared/relaySource.js` (Option A) | Done | `reviews/event-page/1-event-page-implementation.md` (PASS) |
| #2 event-page-param-render | URL-param path: precedence decode, invalid-vs-unsupported, `naddr`→unsupported-kind (no fetch), render kind-1 via `NoteCard` or the precise outcome | Done | `reviews/event-page/1-event-page-implementation.md` (PASS) |
| #3 event-page-search | No-parameter search field: classify a pasted identifier → navigate to the canonical `/event?<type>=<value>`, or a "not recognized" notice | Done | `reviews/event-page/1-event-page-implementation.md` (PASS) |

ADRs: `decisions/event-page/0001-event-read-path.md` (the read path, Option A) and `decisions/event-page/0002-event-page-ui.md` (the page: client decode + search + outcome rendering). All three stories were reviewed together in one PASS report.

## 3. As-built inventory
Derived from the diff (`da269ba8..a4ae90bc`, source/style: **7 files, +601 / −20** — additive; the −20 is the placeholder page body replaced):

- **User-facing:**
  - Reworked **`GET /event`** (route pre-existed in `App.jsx` — **no routing change**) — `ui/src/pages/BrainstormEvent.jsx` (+143/−20: pure `renderResolvedEvent` + `EventSearch` + module-level `EVENT_COPY`), `ui/src/utils/eventParam.js` (new, 91 lines — pure `resolveEventParams`/`classifyEventInput`/`decodeOne`, `nip19`), `ui/src/hooks/useEventResolve.js` (new, 50), `ui/src/styles.css` (+64, `bsp-event-*`).
  - New endpoint **`GET /api/event`** (public, no auth gate) — `src/api/event/eventReadPath.js` (new, 170), registered in `src/api/index.js` (+4).
  - New shared module **`src/api/_shared/relaySource.js`** (new, 99) — the extracted sourcing primitives.
- **Domain:** No concept definitions added or changed → **no firmware reinstall**. Concepts *read* (by handle, not redefined): `39999:<TA>:the-set-of-general-purpose-relays` (well-known set, slug resolved from `getOwnerAssistantPubkey()` at runtime), `nostr-kind` (0/1/10002), `nostr-user`, `nostr-relay`.
- **Data & contracts:**
  - Reads: kind-1 (external relay union, by-id / by-author), kind-10002 (external — author outbox bootstrap), kind-0 (local strfry / Meilisearch, via `enrichNotes`). **No writes/publishes.**
  - `GET /api/event?id=&author=&relays=` → `{ success, status ∈ {OK, UNSUPPORTED_KIND, INVALID_EVENT, NOT_FOUND, NO_AUTHOR_NOTE, INVALID}, relaySource?:'set'|'fallback', item?, kind? }`; handler maps `INVALID`→400, all else→200. This shape is the contract the page consumes (ADR 0002 Context → "the contract this page consumes"); `relaySource` is returned but the page does not display it.

## 4. Deviations from intent

Harvested from ADR `Consequences`, story `Out of scope`, and the review (initial CHANGES_REQUESTED → re-review PASS), reconciled against the diff. The two real correctness findings were **fixed before merge** (`f227fa22`); no shipped deviation changes what the frame promises a user.

| # | Specified (frame / ADR) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: the relay union includes the author's outbox; the common `nevent` case carries an author | The page initially **dropped the `nevent`-carried author**, so the by-id outbox leg was unreachable from the UI | bug-fixed-pre-merge | Review finding #1 → Implementer forwarded `author: target.author` regardless of mode (`BrainstormEvent.jsx:42-49`); covered by new tests B13 + U11 | None — fixed before merge; outbox now reached for `nevent` links | — |
| 2 | Frame: deliver a **distinct "does not validate"** outcome (operator's gate decision) | Initially the real verifying `SimplePool` dropped bad-sig events upstream → folded into `NOT_FOUND`, making `INVALID_EVENT` unreachable in prod | bug-fixed-pre-merge | Review finding #2; operator chose "deliver the distinct outcome" → the event path got its own **no-verify** `SimplePool` so `buildEvent.verify()` is the sole gate; by-id now picks the verifying match among id-collisions (new test B14) | None — fixed before merge; "does not validate" now reachable | **Yes (caveat)** — the no-verify `querySync` here and `_shared`'s verifying `querySync` are **intentionally distinct**; must NOT be unified by the consolidation follow-up |
| 3 | (refactor hygiene — not a frame item) | Relay-sourcing extracted into a NEW `_shared/relaySource.js` (Option A); `feedReadPath.js` / `userNotesReadPath.js` left **byte-unchanged** with their private copies | scoped-deferral | ADR 0001 Option A — keeps the event epic additive (touches no shipped read path), avoids entangling feed prod-promotion; temporary triplication is a tracked, shrinking debt | None — internal | **Yes** — re-point the two shipped paths to `_shared/relaySource.js` (logged in `follow-ups.md`) |

**Undocumented work:** none. Every changed source/style file traces to story #1 (`eventReadPath.js`, `_shared/relaySource.js`, `index.js`), stories #2/#3 (`BrainstormEvent.jsx`, `eventParam.js`, `useEventResolve.js`, `styles.css`), or their ADRs/tests. The diff is `+601/−20` (the −20 = the placeholder page body) with no unprovenanced changes.

## 5. Quality state at close
- **Test gate at close:** `event-page-read-path` **23/23** + `event-page-ui` **13/13** (the +3 post-fix tests pass); full `npm test` — only the **12 pre-existing environmental** tag/pin publish-flow suites fail (`fetch failed`, need the live stack); `live-feed` (×2) + `note-surfaces` (×2) all PASS → **no regression**. Isolated `vite build` clean.
- **Staging:** five-tier smoke passed on `staging.brainstorm.world` (PR #320, deploy `27801707588` success). Tier-4 rendered captures: reference `nevent` → kind-1 NoteCard; bare `/event` → search field; `naddr` → "Kind 30023 not yet supported"; `npub` → author's most-recent note; zero console errors. `/api/event` no-params → 400, bad-hex → 400.
- **Known open issues / accepted edges:**
  - 1280px-no-overflow and the search resolve→re-render loop are verified at the **staging capstone** by design (not unit-tested — `bsp-content` is width-capped + `bsp-note-card-text` wraps; classify is executed, the navigate→resolve loop is e2e) — review nits #6/#7, accepted.
  - The event path's **no-verify** `querySync` (so the `INVALID_EVENT` outcome is reachable) is deliberately distinct from `_shared/relaySource.realQuerySync` (verifying — the feed's only gate). Documented in code (`eventReadPath.js:58-65`) and the follow-up.
- **Debt logged by ADRs:** ADR 0001 — `_shared/relaySource.js` duplicates logic still inlined in `feedReadPath.js` / `userNotesReadPath.js` until the re-point follow-up lands (temporary, shrinking triplication; tracked in `follow-ups.md`).

## 6. Carry-forward register
- [ ] **Relay-sourcing consolidation** — re-point `feedReadPath.js` + `userNotesReadPath.js` to import from `_shared/relaySource.js` and delete their private copies; behavior-preserving, guarded by the `live-feed-read-path` + `note-surfaces-read-path` suites. **Caveat:** do **not** unify the two `querySync` variants — the feed relies on the verifying pool as its only gate; the event path needs its no-verify pool for the `INVALID_EVENT` outcome (`follow-ups.md`).
- [ ] **Rendering non-kind-1 events** — long-form (kind 30023, the `naddr` case), reposts (kind 6), reactions (kind 7) currently resolve to "kind ‹N› not yet supported"; a future kind-aware render is a separate book (epic Out of scope).
- [ ] **Threads / replies / reactions on the shown event**, "load more", navigating between events — out of scope; future event-centric features extend this read path (ADR 0001 Consequences → "Enables").
- [ ] **Possible future feature** — surface the `set`/`fallback` relay-source (the endpoint returns `relaySource`; the page deliberately ignores it — ADR 0002 Constraints — a new story, not a silent add).
