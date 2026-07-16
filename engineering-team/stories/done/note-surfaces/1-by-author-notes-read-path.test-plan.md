# Test Plan: Story note-surfaces #1 — By-author notes read path

**Story:** `engineering-team/stories/note-surfaces/1-by-author-notes-read-path.md`
**ADR:** `engineering-team/decisions/note-surfaces/0001-by-author-notes-read-path.md`
**Date:** 2026-06-18
**Test file:** `test/note-surfaces-read-path.test.js` (wired into `test/test.js`)

## Scope

Covers **Story #1 only — the backend read path** (`buildUserNotes` / `handleGetUserNotes` / `clampLimit` at `src/api/notes/userNotesReadPath.js`). The two UI surfaces (the Content section, the `/user/:pubkey/notes` page) are Stories #2/#3, tested by `test/note-surfaces-ui.test.js`. The OK/EMPTY/INVALID outcomes, newest-first ordering, the count cap, kind-6/7 + foreign-author exclusion, the item shape, and the set-vs-fallback discriminator are exercised as **data**.

## Test level & seam (read this first)

The ACs are driven as **observable behavior** against `buildUserNotes`, not as source-regex. `buildUserNotes` crosses three I/O boundaries the suite must not touch live (mirroring the live-feed read-path seam, minus the House-PoV boundary — there is no PoV here):

| Boundary | Real mechanism (ADR) | Fake injected by the tests |
|---|---|---|
| general-purpose relay set (Concept Graph) | `runCypher(cypher, params)` | `runCypher() → rows[]` (each `{ json }`) |
| kind-1 notes (external relays) | `SimplePool.querySync(relays, filter)` | `querySync(relays, filter) → events[]` |
| kind-0 profiles (local strfry, via `enrichNotes`) | `exec`/`execSync` `strfry scan` | `scanStrfry(filter) → events[]` |

The tests pass these fakes via `buildUserNotes`'s **options object** (`{ pubkey, limit, deps, ...deps }` — both the `deps:` and spread shapes, matching the ADR's injectable-deps seam). Production callers pass no deps and get the real helpers. If the Implementer hard-wires the boundaries and ignores injected deps, the behavioral tests fail loudly (real I/O / throw) — correct pressure toward the seam, not a false pass.

The relays-vs-local sourcing decision (relays) is **already settled in the ADR** by the empirical 0-local-kind-1 evidence; these tests assert the *contract* over mocked boundaries, not the live wiring.

## Coverage map

| Criterion | Test name | Level |
|---|---|---|
| (module exists / exports) | `S1: module … exports buildUserNotes + handleGetUserNotes + clampLimit` | structural |
| (endpoint registered) | `S2: GET /api/user/:pubkey/notes is registered to handleGetUserNotes` | structural |
| (reuse, not re-implement) | `S3: the read path REUSES the shared enrichNotes` | structural |
| **AC-2** count pass-through | `C1: clampLimit passes 1 → 1, 50 → 50 (number and string forms)` | unit |
| **AC-2** default + hard cap | `C2: clampLimit applies max 50 + floor 1; absent/non-numeric → default 50` | unit |
| **AC-1** selection | `B1: a valid author with kind-1 notes yields OK carrying that author's notes` | behavioral |
| **AC-1** item shape | `B2: each item is the feed item shape { id, pubkey, createdAt, content, author:{…}, mentions }` | behavioral |
| **AC-1** local profiles | `B3: author displayName + avatar come from LOCAL kind-0, never external relays` | behavioral |
| **AC-1** missing profile | `B4: an author with no local kind-0 yields null displayName + null avatar` | behavioral |
| **AC-1** ordering | `B5: items are ordered newest-first by the note timestamp` | behavioral |
| **AC-1** kind-1-only | `B6: kind-6 (reposts) and kind-7 (reactions) are excluded` | behavioral |
| **AC-1** author-only | `B7: notes authored by anyone else are excluded even if a relay leaks them` | behavioral |
| **AC-2** limit=1 | `B8: limit=1 returns exactly the single most-recent note` | behavioral |
| **AC-2** cap to N | `B9: the result is capped at the requested count (limit=3 → 3 most recent)` | behavioral |
| **AC-2** hard max | `B10: an over-maximum limit is clamped to the hard cap of 50 (60 → 50 newest)` | behavioral |
| **AC-2** relaySource set | `B11: a resolvable relay set yields relaySource "set"` | behavioral |
| **AC-2** fallback (empty) | `B12: an empty/unresolvable set falls back, still returning notes` | behavioral |
| **AC-2** fallback (error) | `B13: a runCypher error degrades to the fallback relays, not a crash` | behavioral |
| **AC-3** EMPTY | `B14: a valid author with no notes yields EMPTY with items: []` | behavioral |
| **AC-4** INVALID | `B15: a malformed pubkey yields the explicit INVALID outcome — not EMPTY, not a crash` | behavioral |
| **AC-4** no I/O on invalid | `B16: INVALID short-circuits before any relay/Neo4j is queried` | behavioral |
| **AC-3/4** distinctness | `B17: OK, EMPTY, INVALID are three mutually distinct status values` | behavioral |
| **AC-5** mentions | `M1: a nostr:npub mention resolves to the mentioned profile's LOCAL name` | behavioral |
| **AC-5** mention-free | `M2: a note with no mentions carries an empty mentions map` | behavioral |
| **AC-4** handler → 400 | `H1: handleGetUserNotes responds 400 {success:false,status:"INVALID"} for a bad :pubkey` | behavioral |
| **AC-4** handler mapping | `H2: the handler source maps INVALID → 400 and valid outcomes → 200` | source |
| (additive — feed untouched) | `R1: the shipped feed read path is untouched (FEED_CAP=50, exports intact)` | regression |
| (additive — seam unchanged) | `R2: the shared enrichNotes seam still exports enrichNotes + PROFILE_LOOKUP_CAP` | regression |

## Edge cases (explicitly covered)

- [x] **Invalid pubkey** → INVALID, distinct from EMPTY (B15), short-circuits before I/O (B16).
- [x] **Valid pubkey, zero notes** → EMPTY with `items: []` (B14).
- [x] **limit string forms** (query params are strings) — `'1'`/`'50'` parse (C1).
- [x] **Over-max / non-numeric / absent / ≤0 limit** → clamped/defaulted (C2), 60-note hard cap (B10).
- [x] **Newest-first** with out-of-order relay arrival (B5).
- [x] **kind-6 / kind-7** excluded even when a relay ignores the kind filter (B6).
- [x] **Foreign author** leaked by a relay is excluded (B7).
- [x] **Relay set empty / runCypher throws** → fallback, no crash (B12, B13).
- [x] **No local kind-0** → null name/avatar, never an external profile fetch (B3, B4).
- [x] **Mentions** resolved via the reused `enrichNotes`, local-only (M1); empty-map stable shape (M2).

### Deliberately NOT covered here

- The two **surfaces** (Content section, `/notes` page) → `test/note-surfaces-ui.test.js` (Stories #2/#3).
- **Live round-trip** against real strfry / Neo4j / external relays, and the rendered-UI proof — the **staging** smoke (anonymous `/user/<pubkey>/notes` 200 with a card), per the ADR. These unit tests prove the *logic* over mocked boundaries.
- The exact internal Cypher / `strfry scan` argv — implementation details the spec does not pin.
- `nsec`/junk mention rejection + the kind-0 lookup cap — owned and tested by the reused `enrichNotes` (its own suite, `test/live-feed-read-path.test.js` M4/M5/E2).

## Test infrastructure

- **Framework:** Node built-in runner via `npm test` (= `node test/test.js`). New suite exports `run()`, aggregated in `test/test.js` (require, `await …run()`, a result line, inclusion in `overallOk`). No new framework.
- **No live services.** The three I/O boundaries are injected as in-memory fakes; `nostr-tools` (`nip19`) is used only to mint mention fixtures (resolved via the worktree's `node_modules` symlink to the shared checkout). No Concept Graph API, strfry, Neo4j, or network relay required.
- **No firmware precondition** (the feature defines no concepts).
- **Fixtures (in-file):** `HEX(c)` 64-hex pubkeys (`AUTHOR`, `OTHER`, `MENTIONED`), `kind1`/`kind0` event builders, `makeDeps(overrides)` assembling the three fakes.

## How to run

```
npm test
```

Run just this suite:

```
node -e "require('./test/note-surfaces-read-path.test.js').run().then(r => console.log(JSON.stringify(r)))"
```

## Verification

The new suite fails with the current code — every S/C/B/M/H test fails because `src/api/notes/userNotesReadPath.js` does not exist (legible "feature absent", not a require crash); the R* regression sentinels PASS (the shipped feed + shared seam are present and unmodified). Confirmed on 2026-06-18 — see the captured output pasted into the gate summary (commit recorded at the phase boundary).
