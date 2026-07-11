# Build Audit: Note surfaces (a user's own kind-1 notes on the profile + a /notes page)

**Book:** `engineering-team/audits/note-surfaces/book.md`
**Date:** 2026-06-19
**Branch / commit range:** `d6e41193`..`feat/note-surfaces` (feature merged to `staging` at `da269ba8`, PR [#319](https://github.com/nous-clawds4/tapestry/pull/319))
**Provenance:** Acceptance-frame (no PRD; operator's confirmed scope at kickoff)
**Confidence:** high — all acceptance-frame bullets verified on staging; built via the full per-story harness (Planning → Architecture → Test → Implementation → Review) with one adversarially-found edge bug fixed and re-verified before merge.

> As-built record. What the product *is* now, source-linked. It proposes no changes — that's `prd-seed.md`.

## 1. What shipped

- **Profile "Content" section** — appended as the **last** section of `/user/:pubkey`, showing the viewed user's **single most-recent** kind-1 note as the shared `NoteCard`, an explicit empty state, and an always-present "View all notes →" link to the notes page — `stories/note-surfaces/2-profile-content-section.md`.
- **Public `/user/:pubkey/notes` page** — a sibling of `/user/:pubkey/follows`, rendering the viewed user's **50 most-recent** kind-1 notes (newest-first), naming whose notes they are, with the same empty state and no 1280px overflow — `stories/note-surfaces/3-per-user-notes-page.md`.
- **`GET /api/user/:pubkey/notes?limit=` read path** — selects the N most-recent kind-1 notes **authored by the URL pubkey** from the general-purpose relays (with a hardcoded fallback), reuses the shared `enrichNotes` for local author/mention display, and returns a discriminated `OK`/`EMPTY`/`INVALID` outcome with a hard cap of 50 — `stories/note-surfaces/1-by-author-notes-read-path.md`.

Built atop the `live-feed` epic's shared note seam — the read path's *enrichment* and both surfaces' *rendering* are reused, not re-implemented; only the **selection** of raw notes differs ("by-author here vs by-follow-set in the feed").

## 2. Epics & stories rolled up

### Epic: `note-surfaces`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 by-author-notes-read-path | `GET /api/user/:pubkey/notes?limit=` (`buildUserNotes`/`handleGetUserNotes`/`clampLimit`, `NOTES_CAP=50`), `OK`/`EMPTY`/`INVALID` union + `relaySource`, newest-first, kind-1-by-author only, local `enrichNotes` reuse | Done | `reviews/note-surfaces/1-note-surfaces-implementation.md` (PASS) |
| #2 profile-content-section | `ProfileContentSection` (limit 1) appended as the last profile section: single latest `NoteCard` / empty state / always-present link to the notes page | Done | `reviews/note-surfaces/1-note-surfaces-implementation.md` (PASS) |
| #3 per-user-notes-page | `BrainstormUserNotes` page (limit 50) at `/user/:pubkey/notes`: 50-note `NoteCard` list, whose-notes header, empty state, 1280px-bounded | Done | `reviews/note-surfaces/1-note-surfaces-implementation.md` (PASS) |

ADRs: `decisions/note-surfaces/0001-by-author-notes-read-path.md` (read path — Option A, relays sourcing settled empirically) and `decisions/note-surfaces/0002-note-surfaces-ui.md` (the two surfaces + shared hook; `NoteCard` reused with no variant — Option C deferred). Stories #2 and #3 share one review (the impl batch).

## 3. As-built inventory
Derived from the diff (`d6e41193..feat/note-surfaces`, the note-surfaces files only — strictly additive, no deletions):

- **User-facing:**
  - New client route **`/user/:pubkey/notes`** (public top-level SPA route, before `/tapestry`; served by the existing SPA fallback) — `ui/src/App.jsx` (+5, route + import at `:72,131-132`), `ui/src/pages/BrainstormUserNotes.jsx` (new, 113 lines), `ui/src/hooks/useUserNotes.js` (new, 54).
  - New **profile "Content" section** — `ui/src/components/ProfileContentSection.jsx` (new, 53), inserted as the last content child of `ui/src/pages/BrainstormProfile.jsx` (+4, import + `<ProfileContentSection pubkey={pubkey} />` at `:410`).
  - CSS — `ui/src/styles.css` (+101, the `bsp-content-section`/`bsp-content-viewall`/`bsp-notes-list`/`bsp-notes-indicator`/`bsp-notes-subtitle` token-based classes; `bsp-note-card-*`/`bsp-page`/`bsp-section`/`bsp-empty` etc. reused from the feed). *(`styles.css` is a shared file co-edited by sibling books in the same staging batch; the note-surfaces classes are the additive subset.)*
  - New endpoint **`GET /api/user/:pubkey/notes`** (public, no auth gate) — `src/api/notes/userNotesReadPath.js` (new, 205), registered in `src/api/index.js` (import `:85`, route `app.get('/api/user/:pubkey/notes', handleGetUserNotes)` `:312`).
- **Domain:** No concept definitions added or changed → **no firmware reinstall**. Concepts *read* (by handle, not redefined): `39999:<TA>:the-set-of-general-purpose-relays` (relay set, resolved by slug from `getOwnerAssistantPubkey()` at `userNotesReadPath.js:118` — no hardcoded TA), `nostr-kind` (0/1; kind-6/7 excluded), `nostr-user` (the viewed author).
- **Data & contracts:**
  - Reads: kind-1 (external general-purpose relays), kind-0 (local strfry / Meilisearch, via `enrichNotes`). **No writes/publishes.** There is **no kind-3 / PoV read** (the deliberate simplification vs the feed).
  - `GET /api/user/:pubkey/notes` response: `{ success, status ∈ {OK, EMPTY, INVALID}, relaySource?:'set'|'fallback', items?:[{id,pubkey,createdAt,content,author:{displayName,avatar},mentions}] }`; `INVALID`→HTTP 400, `OK`/`EMPTY`→200. This shape is the contract both surfaces consume via the shared `useUserNotes(pubkey,limit)` hook (ADR 0002).

## 4. Deviations from intent

Harvested from ADR `Consequences`, story `Out of scope`, and review notes, reconciled against the diff. No deviation changes what the frame promises a user; all are additive refinements or explicitly-scoped edges.

| # | Specified (frame / ADR) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Story #1: "relays vs local strfry — deferred to Architecture" | Sourcing settled to **relays** (with set/fallback discriminator, mirroring the feed) | interpretation | ADR 0001 §"settled empirically": read-only `strfry scan` returned **0 kind-1** for any author — local-only would render every user empty | None — within frame | — |
| 2 | ADR 0002 §Impl line 89 wrote `<section className="bsp-section bsp-content-section">` | Impl uses `<div className="bsp-section …">` (`ProfileContentSection.jsx:31`) | interpretation | Review nit #4: `<div>` matches the existing `BrainstormProfile.jsx` section convention; ADR note was slightly off vs the codebase. Cosmetic; no test/behavior depends on it | None | — |
| 3 | Review #1 (required): "whose notes" on a param-only `/user/A/notes → /user/B/notes` nav | One **real edge bug found by the adversarial sub-review and FIXED** (`80443ba5`): the page showed the prior user's name when the target had no local kind-0; fix resets `subjectName` on pubkey change + sets it unconditionally from the response, and clears stale `data` in `useUserNotes` | bug-found-and-fixed | Review findings #1 (required) + #2 (recommended, same root cause), both resolved and re-verified before merge | None — fixed pre-merge; "whose notes" now holds in every case | — |
| 4 | Frame bullet 6: empty states "not … an error" | A handler `catch → 500` path exists (mirrors the feed); transport/`INVALID` failures collapse to the same operator-delegated empty message at the surface | constraint-discovered | Review nit #5: the 500 branch is untested (mirrors the feed's likewise-untested 500). A relay timeout yields `EMPTY`/`OK`, not 500; only a thrown dep hits it | Low — surface degrades to the empty message; the 500 path is narrow | accepted edge |
| 5 | (DRY — not a frame item) | The relay-sourcing helpers (`resolveGeneralPurposeRelays`/`realQuerySync`/`realScanStrfry`) are **duplicated** from `feedReadPath.js` into `userNotesReadPath.js` rather than extracted | deliberate-duplication | ADR 0001 Option A: keep the change additive and leave the staging-shipped feed byte-identical; Option B (extract to `_shared/relaySource.js`) deferred | None | **Yes** — tracked follow-up (see §6) |

**Undocumented work:** none. Every changed note-surfaces file traces to story #1 (`userNotesReadPath.js`, `index.js`), story #2 (`ProfileContentSection.jsx`, `BrainstormProfile.jsx`), story #3 (`BrainstormUserNotes.jsx`, `App.jsx`), the shared hook (`useUserNotes.js`, stories #2/#3), or CSS (the additive `bsp-*` subset). No unprovenanced changes; the diff is additive (no deletions).

## 5. Quality state at close
- **Test gate at close:** `npm test` (= `node test/test.js`) → new suites **`note-surfaces-read-path` 28/28** + **`note-surfaces-ui` 19/19** PASS. Full-suite delta: the **only** failures are the **same 12** pre-existing environmental tag/pin publish-flow suites (`fetch failed` — need the live local stack; read none of the edited files), byte-identical to the pre-change baseline → **zero new regressions**. Isolated `vite build` of the worktree → clean (exit 0; all new JSX compiles).
- **Targeted regression:** the 13 hermetic suites reading the edited files (`profile-*`, both `live-feed`, `reputation-info-popup`) → 0 failures; `feedReadPath.js` and `NoteCard.jsx` byte-unchanged (sentinels `R1`/`R2` green).
- **Staging:** smoke clean on `staging.brainstorm.world` (PR #319, deploy run `27796973223`); Tier-4 rendered the profile **Content** section + the 50-note `/user/:pubkey/notes` page with **zero console errors**.
- **Known open issues / accepted edges:**
  - Handler `catch → 500` path untested, mirroring the feed (§4 #4) — accepted; a relay timeout yields `EMPTY`/`OK`, not 500.
  - Redundant-but-ADR-prescribed explicit `EMPTY` branch in `renderUserNotesState` (`BrainstormUserNotes.jsx:99`) — review nit #3; ADR 0002 keeps it explicit to mirror the OK/EMPTY/defensive contract.
  - `<div>` vs ADR's `<section>` for the Content section (§4 #2) — review nit #4; matches the profile-section convention.
  - 1280px no-overflow + the search/profile resolve loop verified at **source/CSS level**; rendered proof was the staging capstone (review "Refuted" — not a defect; the Node harness can't render).
- **Debt logged by ADRs:** ADR 0001 Consequences — the duplicated relay-sourcing helpers (consolidation deferred to a tracked follow-up, see §6); ADR 0002 — a `NoteCard` layout-variant prop (Option C) and a `useFeed`/`useUserNotes` generalization, both deferred until a surface/consumer genuinely needs them.

## 6. Carry-forward register
- [ ] **Source-relay consolidation** — re-point `feedReadPath.js` + `userNotesReadPath.js` to import the sourcing primitives from `src/api/_shared/relaySource.js` (which the later `event-page` epic created as the 3rd consumer) and delete their private copies; behavior-preserving, guarded by the existing read-path suites + a staging re-smoke. Option A deferred it to keep this epic additive. **Logged in `engineering-team/follow-ups.md`** ("Consolidate relay-sourcing into `_shared/relaySource.js`"). *Caveat noted there: do not unify the feed/user-notes **verifying** `querySync` with the event path's NO-VERIFY variant.*
- [ ] **`NoteCard` compact/actionsless variant** (ADR 0002 Option C) — add the layout-variant prop to `NoteCard` per its own guidance when a surface first genuinely needs a stripped card (the Content section deliberately uses the full card today). Deferred, non-blocking (`follow-ups.md` / epic).
- [ ] **`useFeed`/`useUserNotes` generalization** — collapse the two near-duplicate hooks into one if a third notes consumer appears (ADR 0002 Consequences). Trivial later step, not worth coupling now.
- [ ] **Graceful handler 500 → empty** — optionally harden the `handleGetUserNotes` `catch` to degrade to `EMPTY`/`OK` rather than 500 (mirrors the feed's identical accepted edge; §4 #4).
- [ ] **Tagging notes** — out of scope for this epic (as for the feed); a separate, later book depending on the `nostr-event-tag` wire spec.
