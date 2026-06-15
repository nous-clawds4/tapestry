# Test Plan: Story live-feed #1 — Live-feed read path

**Story:** `engineering-team/stories/live-feed/1-feed-read-path.md`
**ADR:** `engineering-team/decisions/live-feed/0001-feed-read-path-endpoint.md`
**Frame:** `engineering-team/audits/live-feed/book.md` → "### Acceptance frame"
**Date:** 2026-06-15
**Test file:** `test/live-feed-read-path.test.js` (wired into `test/test.js`)

## Scope

This plan covers **Story #1 only — the backend read path** (`buildFeed` /
`handleGetFeed` at `src/api/feed/feedReadPath.js`). The `/feed` *page* (Story 2 —
rendering, headings, the "most recent 50" indicator, empty-state copy, public
reachability, 1280px no-overflow) is **out of scope**; no Playwright here. The
four outcomes, ordering, the 50-cap, kind-1-only filtering, and the
set-vs-fallback discriminator are exercised as **data**, the level the ADR fixes
the contract at.

## Test level & seam (read this first)

The four ACs are driven as **observable behavior** against `buildFeed`, not as
source-regex. `buildFeed` crosses four real I/O boundaries the suite must not
touch live:

| Boundary | Real mechanism (ADR) | Fake injected by the tests |
|---|---|---|
| House PoV pubkey | `getSettings().grapevine.searchPreferences.povPubkey` | `getSettings()` returning a canned settings object |
| kind-3 follows + kind-0 profiles (local strfry) | `exec`/`execSync` `strfry scan '<filter>'` | `scanStrfry(filter) → events[]` |
| general-purpose relay set (Concept Graph) | `runCypher(cypher, params)` | `runCypher() → rows[]` (each row `{ json }`) |
| kind-1 notes (external relays) | `SimplePool.querySync(relays, filter)` | `querySync(relays, filter) → events[]` |

The tests pass these fakes to `buildFeed` via its **options object** — the same
object the ADR already passes `{ sessionPubkey }` on. Story 2 calls
`buildFeed({ sessionPubkey })` with **no deps** and gets the real helpers; the
tests pass deps to stay hermetic. This is a pure test seam — no product behavior
the frame fixes is changed by it.

> **ADR-refinement flag (non-blocking — for the Architect, not a hard kick-back).**
> The ADR's `buildFeed({ sessionPubkey })` signature does not *explicitly* name
> an injectable-dependency seam, though it is fully compatible with one (helpers
> are "kept in this file unless a clean shared home already exists", and the
> operator's brief authorizes "the Implementer can be required to expose an
> injectable seam, but that's an Architecture decision"). The tests are written
> against `buildFeed({ sessionPubkey, deps, ...deps })` so the Implementer may
> read deps either spread onto the options object **or** under a `deps:` key.
> The Architect should ratify (a one-line ADR amendment) that `buildFeed` accepts
> optional injected dependencies for the four boundaries above, defaulting to the
> real helpers, so the Implementer is obligated to honor them. This is the
> *only* way to drive the four outcomes + cap + filtering + relay discriminator
> without live strfry / prod-scale Neo4j / external relays, per the operator's
> Gate-3 obligations. **This is a seam/wiring contract, not new product
> behavior** — the feature is testable as designed once the seam is named.
> If the Implementer hard-wires the boundaries and ignores injected deps, the
> behavioral tests fail loudly (they would hit real I/O or throw), which is the
> correct pressure toward the seam, not a false pass.

## Coverage map

Every acceptance criterion maps to ≥ 1 test; the structural sentinels (S*) make
the pre-implementation "feature absent" failure legible.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| (module exists / endpoint registered) | `S1: module … exports buildFeed + handleGetFeed` | `test/live-feed-read-path.test.js` | structural |
| (endpoint registered) | `S2: GET /api/feed is registered to handleGetFeed in src/api/index.js` | `test/live-feed-read-path.test.js` | structural |
| **AC-1** Resolution & content | `B1: … status is OK and items carry the followed authors' notes` | `test/live-feed-read-path.test.js` | behavioral |
| **AC-1** item shape | `B2: each item carries the note id, author pubkey, timestamp, text, and a nested author { displayName, avatar }` | … | behavioral |
| **AC-1** local profiles | `B3: author displayName + avatar are drawn from LOCAL kind-0 profile data, not the external relays` | … | behavioral |
| **AC-1** missing profile | `B4: a followed author with no local kind-0 profile yields null displayName + null avatar` | … | behavioral |
| **AC-1** ordering | `B5: items are ordered newest-first by the note timestamp` | … | behavioral |
| **AC-1** 50-cap | `B6: the feed is capped at the 50 most recent qualifying notes` | … | behavioral |
| **AC-1** kind-1-only | `B7: kind-6 (reposts) and kind-7 (reactions) are excluded even if a relay returns them` | … | behavioral |
| **AC-1** non-followed excluded | `B8: notes from accounts the source does NOT follow are excluded` | … | behavioral |
| **AC-2** set resolves | `B9: when the general-purpose relay set resolves to members, relaySource is "set"` | … | behavioral |
| **AC-2** fallback (empty) | `B10: when the relay set cannot be resolved / is empty, relaySource is "fallback" and notes are still returned` | … | behavioral |
| **AC-2** fallback (error) | `B11: a runCypher error during set resolution degrades to the fallback relays, not a crash` | … | behavioral |
| **AC-3** NO_SOURCE | `B12: no logged-in user AND no House PoV configured yields status NO_SOURCE` | … | behavioral |
| **AC-3** no relays queried | `B13: the NO_SOURCE outcome queries no relays` | … | behavioral |
| **AC-3** distinct from EMPTY | `B14: NO_SOURCE is distinct from an empty list` | … | behavioral |
| **AC-4** FOLLOW_LIST_UNAVAILABLE | `B15: kind-3 absent from local strfry yields status FOLLOW_LIST_UNAVAILABLE` | … | behavioral |
| **AC-4** distinct outcome | `B16: FOLLOW_LIST_UNAVAILABLE is distinct from both NO_SOURCE and an empty-but-present feed` | … | behavioral |
| **AC-5** EMPTY | `B17: a present follow list that yields no qualifying notes gives status EMPTY with items: []` | … | behavioral |
| **AC-5** zero-follows nuance | `B18: a kind-3 present with ZERO p-tags is a present-but-empty feed, not FOLLOW_LIST_UNAVAILABLE` | … | behavioral |
| **AC-3/4/5** mutual distinctness | `B19: the three edge outcomes + OK are four mutually distinct status values` | … | behavioral |
| (resolution order — supports AC-1/3/4) | `B20: the logged-in user wins over the House PoV as the source identity` | … | behavioral |
| (resolution order) | `B21: with no login but a House PoV configured, the House identity is the source` | … | behavioral |

## Edge cases (explicitly covered, not just the happy path)

- [x] **No source identity** (NO_SOURCE) — B12, and it queries no relays (B13),
  and is distinct from EMPTY (B14).
- [x] **Follow list not in local strfry** (FOLLOW_LIST_UNAVAILABLE) — B15,
  distinct from NO_SOURCE and EMPTY (B16).
- [x] **Present-but-empty feed** (EMPTY) — B17.
- [x] **Present kind-3 with zero p-tags** — distinguishes "follows nobody"
  (EMPTY) from "no kind-3 at all" (FOLLOW_LIST_UNAVAILABLE) — B18.
- [x] **Newest-first ordering** with out-of-order relay arrival — B5.
- [x] **50-cap** with 60 inbound notes; keeps the most-recent window (createdAt
  11..60), drops the oldest — B6.
- [x] **kind-6 / kind-7 excluded** even when a noisy relay ignores the kind
  filter — B7.
- [x] **Non-followed author excluded** even when a relay returns a stranger's
  note — B8.
- [x] **Relay set empty** → fallback, still returns notes — B10.
- [x] **Relay set resolution error (runCypher throws)** → degrade to fallback,
  no crash — B11.
- [x] **Author with no local kind-0 profile** → null displayName/avatar, never
  an external profile fetch — B4; and B3 asserts the external fetch is never
  used as a profile source.
- [x] **Four outcomes mutually distinct** — B19.

### Deliberately NOT covered here (out of scope / different level)

- The `/feed` **page** (rendering, headings, indicators, empty-state copy,
  public reachability, 1280px no-overflow) → **Story 2**, Playwright.
- **Live behavioral round-trip** against real strfry / Neo4j / external relays
  (the actual `strfry scan`, `runCypher`, and `SimplePool` wiring, plus the TA
  pubkey resolution that builds the set handle) — that is the cycle-local Docker
  smoke + the book's mandatory **Tier-4 staging evidence** (`book.md` frame
  bullet: anonymous `GET /feed` 200 + ≥ 3 rendered notes for the House PoV's
  follows). The Reviewer must treat that smoke as required, not optional; these
  unit tests prove the *logic* over mocked boundaries, not the live I/O wiring.
- The exact internal Cypher string / the exact `strfry scan` argv / chunking of
  large `authors` lists — implementation details the spec does not pin; asserting
  them would be brittle and constrain the Implementer.

## Test infrastructure

- **Framework:** Node built-in runner via `npm test` (= `node test/test.js`).
  New suite `test/live-feed-read-path.test.js` exports `run()` and is aggregated
  by `test/test.js` exactly like the other suites (require at top, `await
  …​.run()` in `main`, a result line, and inclusion in `overallOk`). **No new
  test framework.**
- **No live services required.** The four I/O boundaries (local strfry exec,
  Neo4j `runCypher`, external relays via `SimplePool`, local kind-0) are **all
  injected as in-memory fakes**. The suite does **not** require the Concept Graph
  API at `localhost:8877`, a running strfry, Neo4j, or any network relay, and
  must run hermetically in CI.
- **No firmware precondition.** Per ADR §Consequences, the feature defines no
  concepts and changes no schema — no `POST /api/firmware/install` is needed for
  these tests.
- **Fixtures (in-file):** synthetic 64-hex pubkeys (`SOURCE`, `HOUSE`,
  `FOLLOW_1`, `FOLLOW_2`, `STRANGER`); `kind3(author, followed)`,
  `kind1(id, author, createdAt, content)` event builders; `makeDeps(overrides)`
  assembling the four fakes with per-test overrides.

## How to run

```
npm test
```

Run just this suite during development:

```
node -e "require('./test/live-feed-read-path.test.js').run().then(r => console.log(JSON.stringify(r)))"
```

(Playwright is **not** used for this story.)

## Verification

The new suite fails with the current code — all 23 tests fail because the module
`src/api/feed/feedReadPath.js` does not exist (legible "feature absent", not a
require crash or import error). Every pre-existing suite still passes, confirming
the `test/test.js` wiring is correct.

Confirmed on 2026-06-15, branch `staging`, baseline `15f0924c` (working tree
otherwise clean):

```
live-feed-read-path suite:
  ✗ S1: module src/api/feed/feedReadPath.js exists and exports buildFeed + handleGetFeed (ADR §Decision / §Implementation notes)
      src/api/feed/feedReadPath.js does not exist / does not load yet — the Implementer must create the read-path module (ADR live-feed/0001 chose Option A: one self-contained module exporting buildFeed + handleGetFeed).
  ✗ S2: GET /api/feed is registered to handleGetFeed in src/api/index.js (ADR §Implementation notes)
      src/api/index.js must register the public route '/api/feed' (alongside /api/strfry/scan, /api/profiles, /api/relay/external).
  ✗ B1 (AC-1): with a present kind-3 follow list and follows who posted kind-1 notes, status is OK and items carry the followed authors' notes
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B2 (AC-1): each item carries the note id, author pubkey, timestamp, text, and a nested author { displayName, avatar }
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B3 (AC-1): author displayName + avatar are drawn from LOCAL kind-0 profile data, not the external relays
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B4 (AC-1): a followed author with no local kind-0 profile yields null displayName + null avatar (never an external fetch)
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B5 (AC-1): items are ordered newest-first by the note timestamp
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B6 (AC-1): the feed is capped at the 50 most recent qualifying notes
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B7 (AC-1): kind-6 (reposts) and kind-7 (reactions) are excluded even if a relay returns them
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B8 (AC-1): notes from accounts the source does NOT follow are excluded
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B9 (AC-2): when the general-purpose relay set resolves to members, relaySource is "set"
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B10 (AC-2): when the relay set cannot be resolved / is empty, relaySource is "fallback" and notes are still returned
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B11 (AC-2): a runCypher error during set resolution degrades to the fallback relays, not a crash
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B12 (AC-3): no logged-in user AND no House PoV configured yields status NO_SOURCE
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B13 (AC-3): the NO_SOURCE outcome queries no relays (the external fetch is never invoked)
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B14 (AC-3): NO_SOURCE is distinct from an empty list — it is not status EMPTY with items: []
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B15 (AC-4): a source exists but its kind-3 is absent from local strfry yields status FOLLOW_LIST_UNAVAILABLE
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B16 (AC-4): FOLLOW_LIST_UNAVAILABLE is distinct from both NO_SOURCE and an empty-but-present feed
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B17 (AC-5): a present kind-3 follow list that yields no qualifying notes gives status EMPTY with items: []
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B18 (AC-5): a kind-3 present with ZERO p-tags (follows nobody) is a present-but-empty feed, not FOLLOW_LIST_UNAVAILABLE
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B19 (AC-5): the three edge outcomes + OK are four mutually distinct status values
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B20 (resolution): the logged-in user wins over the House PoV as the source identity
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).
  ✗ B21 (resolution): with no login but a House PoV configured, the House identity is the source
      src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet (ADR live-feed/0001 §Implementation notes).

Test Results
-------------
...
reputation-info-popup suite:                     PASS (16 passed, 0 failed)
live-feed-read-path suite:                       FAIL (0 passed, 23 failed)
Overall:                                         FAIL
```

(All 34 pre-existing suites report PASS in the same run; only `live-feed-read-path`
fails — the wiring into `test/test.js` is correct and no other suite regressed.)
```
