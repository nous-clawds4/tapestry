# Test Plan: Story 9 — Unified tag index (notes + profiles)

**Story:** `engineering-team/stories/event-tagging/9-unified-tag-index-notes-and-profiles.md`
**ADR:** `engineering-team/decisions/event-tagging/0009-unified-taggings-normalization.md`
**Design:** `engineering-team/designs/unified-taggings.md`
**Date:** 2026-06-30

## Approach

One CJS suite — `test/unified-tag-index.test.js` — wired into `test/test.js`, same three-layer shape as the other event-tagging read suites.

ADR 0009 deliberately isolates the risky, extensible logic in a **pure, dependency-free normalization core** so all the acceptance criteria are provable **without a stack** — which is also what makes the `Tags.jsx` UI safe to verify manually. The suite therefore concentrates on:

1. **Core unit tests (the meat).** Drive `normalizeTaggings` + `indexByTag` + the `taggingMembers` registry with synthetic fixtures for **both** family members — `nostr-user-tag` (profile wire: `p` target + direct `a` tag ref) and `nostr-event-tag` (note wire: `e`/`a` target + descriptor→header tag ref). Proves normalization to one tuple, the **coordinate merge key**, the unified index behaviors, POV filtering, `mine`, and — critically — **extensibility** (a third registry member drops in with no new stack).
2. **Source-contract.** The core exports `normalizeTaggings` / `indexByTag` / a `taggingMembers` registry seeded with the two built-in members; a unified `GET /api/tags/index` route is wired and its handler consumes the core (doesn't re-count per type).
3. **HTTP smoke (skip-gated).** `/api/tags/index` returns `200` + a `rows` array — gated on the existing `for-event` route as the "is the stack up?" probe, so a `404` while up is a real red (not wired).

**Not automated (operator pattern + ADR):** the `Tags.jsx` UI (rendering the merged rows, profile/note presentation). Verified manually on the live stack.

**Constraint guardrails (ADR 0009):** the normalization is **read-only** — no fixture publishes anything, and the core stays pure (the existing core-purity test covers the new modules). No test touches the live `/api/profile-tags/*` or `/api/event-tags/*` contracts (Phase-1 additive).

## Coverage map

| Criterion (AC) | Test | Layer |
|---|---|---|
| Normalizes profile-taggings | `normalize: a nostr-user-tag assertion → {target.type=profile, …}` | core |
| Normalizes event-taggings | `normalize: a nostr-event-tag assertion → {target.type=event, … via header}` | core |
| Shared identity (merge key) | `normalize: a profile-tag and a note-tag of the SAME tag → SAME coordinate` | core |
| **A note-only tag appears** | `index AC-1: a NOTE-only tag appears in the index` | core |
| **A shared tag reflects both** | `index AC-2: a SHARED tag merges into ONE row reflecting BOTH profile and note usage` | core |
| Counts POV-filtered for notes too | `index AC-3: POV trust filter — untrusted asserter does not inflate totals` | core |
| Own note-taggings show (`mine`) | `index (mine): the viewer's own tagging surfaces even when the POV counts no one` | core |
| Profile-only tags unchanged | `index AC-5: a PROFILE-only tag still appears (backward compatible)` | core |
| Sorting accounts for note usage | `index AC-4: combined usage drives ranking — note-heavy out-counts profile-light` | core |
| **Extensibility (future types)** | `extensibility: a THIRD registry member normalizes + counts` | core |
| Legitimacy gate / empty | `normalize: un-honored event-tag header excluded; empty → empty` | core |
| Core seam exported | `src: exports normalizeTaggings, indexByTag, taggingMembers registry` | source-contract |
| Endpoint wired, consumes core | `src: /api/tags/index registered + handler consumes normalizer` | source-contract |
| Endpoint returns rows | `http: /api/tags/index returns 200 with a rows array` | http (skip-gated) |

## Row contract (asserted)

```
row = { tag:{authorPubkey,slug},
        applications, disputes,                 // POV-counted totals ACROSS target types
        byType: { profile:{applications,disputes}, event:{…}, <futureType>:{…} },
        mine: 'apply'|'dispute'|null }
```
Keyed by the tag **coordinate** (`authorPubkey:slug`) — the edit-stable identity that merges profile + note usage.

## Manual verification (Tags.jsx — not automated)

On the live stack: open `/tags` and confirm (a) a note-only tag (e.g. `drivechain`) now appears; (b) a tag used on both shows note usage alongside profile usage; (c) a tag you tagged a note with appears even on a non-POV test pubkey (`mine`); (d) sort reflects combined usage. Presentation (combined total vs breakdown) is a design detail.

## Test infrastructure

- Runner: `node test/test.js`. No new framework, no stack for the core/source-contract layers; HTTP smoke skip-gated on `:7778`.
- To be created by the Implementer: `normalizeTaggings`, `indexByTag`, and the `taggingMembers` registry (two members) in `src/lib/event-tagging`; a `handleTagIndex`/unified handler + `GET /api/tags/index` route consuming the core; the `Tags.jsx` unified consumption (untested). The live per-type endpoints stay untouched (ADR 0009 Phase 1).

## How to run

```
npm test
```

## Verification

The new tests fail with the current code. Confirmed on 2026-06-30 at commit `4a5d091e`:

```
--- unified tag index tests (epic event-tagging, Story 9) ---
  FAIL  normalize: a nostr-user-tag assertion → {target.type=profile, tag coordinate, stance}
        normalizeTaggings not implemented/exported in src/lib/event-tagging
  FAIL  normalize: a nostr-event-tag assertion → {target.type=event, tag coordinate via header, stance}
  FAIL  normalize: a profile-tag and a note-tag of the SAME tag normalize to the SAME coordinate (merge key)
  FAIL  index AC-1: a NOTE-only tag appears in the index (keyed by coordinate)
  FAIL  index AC-2: a SHARED tag merges into ONE row reflecting BOTH profile and note usage
  FAIL  index AC-3: POV trust filter — an untrusted asserter does not inflate the counted totals
  FAIL  index (mine): the viewer's own tagging surfaces on the tag even when the POV does not count them
  FAIL  index AC-5: a PROFILE-only tag still appears (backward compatible)
  FAIL  index AC-4: combined usage drives ranking — a note-heavy tag out-counts a profile-light one
  FAIL  extensibility: a THIRD registry member (new concept/target type) normalizes + counts
  FAIL  normalize: un-honored event-tag header excluded; empty input → empty
  FAIL  src: the core exports normalizeTaggings, indexByTag, and the taggingMembers registry
  FAIL  src: a unified index route is registered and its handler consumes the normalizer + scans multiple concept-z members
  FAIL  http: /api/tags/index returns 200 with a rows array (skip if stack down; 404 while up = not wired)
        unified index must return 200 (got 404) — 404 means the route isn't wired

unified-tag-index: 0 passed, 14 failed, 0 skipped
```

All 14 red for the right reason: the normalization core, the registry, and the `/api/tags/index` route don't exist. The HTTP test **fails rather than skips** — its `for-event` probe confirms the stack is up, so the `404` on `/api/tags/index` is correctly a red (route not wired), not an environmental skip.
