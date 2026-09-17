# Review (docs-mode variant, bug lane): the tag page accepts an `author:slug` coordinate param — OPEN 302

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-17
**Profile:** Light (`engineering-team/workflows/light-profile.md`) — bug lane, Implementer + Reviewer, Gate B only.
**Diff:** commit `ec8c41e2` (`ui/src/pages/Tag.jsx`, `test/dlist-item-tagging.test.js`, `OPEN.md` row 302).
**Anchor:** OPEN.md row 302 (no story file; the row is the spec). No ADR — no irreversibility trigger fires: no wire format, no schema, no dependency, no cross-repo contract; one client-side param parse over the existing `/api/strfry/scan` client.
**Verdict: PASS.**

## Quality gates (run by the reviewer)

| Suite | Command | Result |
|---|---|---|
| `test/dlist-item-tagging.test.js` | `direnv exec . node` → `require(suite).run()` (the file is a module consumed by `test/test.js`, not a standalone script) | **21 passed, 0 failed** — as expected, including new S8. |
| `test/tag-detail.test.js` | same, `BRAINSTORM_BASE_URL=http://localhost:8778` | **19 passed, 9 failed** — as expected. |

All 9 failures carry the suite's own `PRECONDITION UNMET: no tag in the first 60 of available-tags has any tagged profile` message — the dev box's corpus has no tagged profile, a condition the suite raises deliberately rather than passing vacuously. That message is emitted only from the corpus-precondition helper, and the 9 are exactly the `profiles-tagged` corpus tests; none of them reads `ui/src/pages/Tag.jsx` (`grep -n "Tag.jsx\|ui/src" test/tag-detail.test.js` → no match: the suite is HTTP-only against the control panel). The diff therefore cannot have moved the count, and the remaining 19 — the 400/404/envelope contracts — pass.

**Gate friction (already tracked, OPEN row 257):** at the documented default `http://localhost:7778` the suite reports 0/28, because on this host `:7778` is squatted by an unrelated `gleaner-strfry` serving HTML (every endpoint 200 text/html) while the panel maps to `:8778` (`docker port tapestry`). No new row needed; row 257 names this exact failure and fix shape.

Not run: `npm run test:playwright` (no spec covers the tag route's param parse), full `npm test` (not a Light judge gate; book-close/promotion gate).

## Claims-adherence table

| # | Claim (OPEN 302 fix shape / commit message) | Evidence | Verdict |
|---|---|---|---|
| 1 | The page accepts an `<authorPubkey>:<slug>` param and resolves it to the tag element. | `Tag.jsx:44` `TAG_COORD_RE = /^([0-9a-f]{64}):(.+)$/`; `:68-71` memo; `:79` `queryRelay({ kinds: [39999], authors: [tagCoord.authorPubkey], '#d': [tagCoord.slug] })`. Matches the row's prescribed filter exactly. | Met |
| 2 | Newest wins (replaceable). | `:82-84` reduce on `created_at`. Ties resolve to the first event seen, not NIP-01's lowest-id tiebreak — immaterial for a replaceable definition, noted below. | Met |
| 3 | Unresolvable → the not-found state, not the error line. | `:105` `headerError = coordUnresolved ? 'not-found' : headerErrorRaw`; the not-found branch at `:281` pre-dates the fix and takes precedence over the `:316` error line. Empty result → `setCoordUnresolved(true)` (`:85`); a thrown `queryRelay` (the client throws on `success:false`, `api/relay.js:18`) → `.catch` at `:87`, same state. No crash path. | Met |
| 4 | `"tagEventId is required (64-char lowercase hex)"` is unreachable from a coordinate route. | `effectiveTagId` is `null` while resolving (`:96`); `useTagDetail` early-returns on a falsy id in both effects (`useTagDetail.js:43,74`), so neither `by-id` nor `profiles-tagged` is ever called with the coordinate. Verified by reading both effects, not by assertion alone. | Met |
| 5 | The hex path is byte-identical. | A bare 64-hex param has no colon → `TAG_COORD_RE` does not match → `tagCoord` null → `effectiveTagId === tagId` → the same `useTagDetail(tagId)` call with the same value. The new effect's `!tagCoord` branch sets both states to the values they already hold, so React's bail-out means no extra render and no extra fetch. | Met |
| 6 | Route change is race-safe. | `let cancelled` closed over, checked in `.then` and `.catch`, set by the cleanup (`:76, 81, 87, 89`). Deps `[tagCoord]`, itself memoised on `tagId` — one stable identity per param, so no re-fire loop. | Met |
| 7 | Nothing else changed. | `git show ec8c41e2 --stat`: three files. `useEventTags.js:85` and `TagChip.jsx:123` untouched — correct, the coordinate link is legitimate and the row's second option (withhold the link) would have hidden a real chip. `ui/src/utils/eventParam.js` untouched (R3 still passes). | Met |
| 8 | S8 pins the behavior and would have failed before. | `git show ec8c41e2^:ui/src/pages/Tag.jsx | grep queryRelay\|39999\|created_at` → no match for the discriminating strings; the first S8 assertion (the `[0-9a-f]{64}):` branch) fails on the pre-image. Confirmed, not assumed. | Met |
| 9 | OPEN row 302 flipped to DONE with an accurate resolution note. | `git show ec8c41e2 -- OPEN.md`: one row, status `OPEN → DONE`, date filled, note matches the code. | Met |

## Adversarial probes

- **Uppercase-hex coordinate.** `TAG_COORD_RE` is anchored and lowercase-only, so `/tag/x/ABCD…:slug` falls through to the hex path and hits the old server error. Not blocking: the only minter is `useEventTags.js:85`, which interpolates a pubkey read off a signed event — lowercase hex by NIP-01. Suggested one-liner below.
- **Injection / boundary.** The slug reaches `strfry` through `JSON.stringify` into `spawn` argv (`src/api/strfry/queries/scan.js:85`) — no shell, nothing to inject. A colon inside the d-tag survives, since the regex captures `(.+)` greedily after the 64-hex author.
- **Scope creep, secrets, debug code.** None. No `console.log`, no commented-out code, no hardcoded TA pubkey (S7 passes over the changed file).
- **Concept-graph / house rules.** No concept definitions touched — no firmware reinstall needed. No new tooling. Kind 39999 and the `author:slug` identity are ADR 0022's stable half, which is what the row cites.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/Tag.jsx:44`** — lowercase-only coordinate regex. If a hand-typed or externally-produced uppercase coordinate ever reaches the route, it silently degrades to the old error. Optional: lowercase the author capture (`m[1].toLowerCase()`) or add the `i` flag and normalise.
2. **`ui/src/pages/Tag.jsx:79`** — the scan carries no `limit`, so it is bounded by `SCAN_MAX_EVENTS` (20000). Harmless for a `(kind, author, #d)` triple, but an explicit small `limit` would make the intent (one event) legible and skip the bounded-count path entirely.
3. **`ui/src/pages/Tag.jsx:96`** — navigating between two *coordinate* routes resets `coordEventId` to null, and `useTagDetail` early-returns without clearing `tag`/`headerLoading`, so the previous tag's header can render for the length of one relay round-trip. The hex path has no equivalent because its id changes atomically. Cosmetic; worth a follow-up only if the chip-to-chip path becomes common.
4. **`ui/src/pages/Tag.jsx:82-84`** — `created_at` ties keep the first-seen event; NIP-01 prefers the lowest id. Immaterial here.
5. **`test/dlist-item-tagging.test.js`** — the `!/tagEventId is required/` assertion is vacuous (the string was absent pre-fix too). The four preceding assertions carry the sentinel's teeth; this one documents intent only.
6. **`ui/src/pages/Tag.jsx:251-256`** — the canonicalize effect rewrites `/tag/<coord>` to `/tag/<slug>/<coord>`, keeping the coordinate rather than upgrading the URL to the now-known hex id. Correct either way; upgrading would make the shared URL stable.

### Harness friction
1. The `:7778` squat / default-port problem cost this review one full false-red run of `test/tag-detail.test.js` (0/28). Already OPEN row 257 — this is a second recurrence; worth raising its priority rather than opening a new row.
