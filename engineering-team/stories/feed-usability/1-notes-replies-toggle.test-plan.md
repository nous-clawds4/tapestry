# Test Plan: Story 1 — "Notes" | "Notes + Replies" toggle on the feed surfaces

**Story:** `engineering-team/stories/feed-usability/1-notes-replies-toggle.md`
**ADR:** `engineering-team/decisions/feed-usability/0001-notes-replies-toggle.md`
**Date:** 2026-07-03

## Test level decision

Mirrors the `live-feed-feed-page` / `note-surfaces-ui` precedent exactly:

- **Server — behavioral, executes the real module.** `src/api/_shared/noteEnrichment.js`
  is plain CommonJS; the suite `require`s it and drives `isReplyNote(tags)` (the NIP-10
  truth table) and `enrichNotes` (the item carries `isReply`) with an in-memory
  `scanStrfry` fake. No live strfry/relays/Neo4j.
- **UI — source-regex sentinels.** The Node harness (`node test/test.js`) has no JSX
  transpile (JS-without-build house rule), so the pure render helpers cannot be *called*
  here; the ADR's "unit-call the render helpers" intent is realized as source sentinels
  pinning the helper signature (`mode` arg), the `isReply` filter, the mode branch, the
  no-re-sort constraint, and the REPLY_ONLY branch — the established convention.
- **Runtime confirmation** (actually clicking the toggle, replies hiding/showing) is the
  **cycle-local browser smoke** before review (house feedback: always cycle-local before
  review), not this suite.

## Coverage map

| Criterion | Test(s) | Test file | Level |
|---|---|---|---|
| AC-1 toggle on both surfaces, default "Notes" | U1, U2 (`/feed`), U5, U6 (`/user/:pubkey/notes`) | `test/notes-replies-toggle.test.js` | UI sentinel |
| AC-2 "Notes" mode filters replies | B1–B7 (the rule + the flag on items), U3, U7 (the filter wiring), U9 (no re-sort) | same | server behavioral + UI sentinel |
| AC-3 "Notes + Replies" shows everything, no navigation | U3, U7 (`mode==='all'` keeps items), U1/U5 (`value={mode}`/`onChange={setMode}` client state), R3 (hooks unchanged — no refetch param) | same | UI sentinel + regression |
| AC-4 switching back re-filters | U3, U7 (filter derives from `mode` at render time over the same delivered array), U9 | same | UI sentinel |
| AC-5 reply-only empty state | U4 (`/feed`), U8 (notes page) — REPLY_ONLY copy meaning-tokens (top-level + replies) + the branch in the pure helper | same | UI sentinel |
| AC-6 existing empty states unaffected | R1 (`/feed`'s three states), R2 (notes page EMPTY) | same | regression (pass before & after) |

## Edge cases

- [x] Legacy **unmarked** `e` tag (NIP-10 positional) → reply (B2).
- [x] `root`-only marker (direct reply to thread root) → reply (B3).
- [x] `mention`-marked `e` tag → **not** a reply (B4).
- [x] `q`-tag-only quote (NIP-18) → **not** a reply; `p`/`t` tags alone → not a reply (B5).
- [x] Mixed mention-`e` + reply-`e` → reply (B5).
- [x] No tags / `undefined` / `null` / non-array / junk entries → top-level, never a crash (B6).
- [x] `['e']` with **no event id** → not a reply (references nothing; pins a `tag[1]` guard the ADR snippet lacks — flagged for the Implementer) (B6).
- [x] Enriched item keeps every existing field; `isReply` is strictly boolean (B7).
- [x] Read paths must NOT grow their own reply logic (R4 pins `isReply` absent from both read-path modules — one rule, one home).
- [x] `SortToggle`'s shared contract untouched (R5 — other consumers: `/tag`, `/tags`, tagging activity).

## Test infrastructure

- Framework: existing Node runner — suite registered in `test/test.js` (require + run +
  `overallOk` term), exports `{ run }` like every sibling.
- No Concept Graph API / firmware / live services needed: enrichment is executed with an
  in-memory `scanStrfry` fake; everything else is source sentinels.
- Fixtures: deterministic 64-hex pubkeys/ids; NIP-10 tag shapes inline; fake kind-0
  profile ("Alice") for the enrichment assertion.

## How to run

```
npm test                                    # full harness
# or just this suite:
node -e "require('./test/notes-replies-toggle.test.js').run()"
```

## Verification

The new tests fail with the current code, each with a legible "absent pre-implementation"
reason (not an import/typo crash). Confirmed 2026-07-03 at commit `e6ae08f4`
(15 fail / 6 regression-or-constraint sentinels pass, as designed):

```
✗ B1: noteEnrichment.js exports the pure isReplyNote(tags) helper (ADR §Server)
✗ B2: a legacy UNMARKED e tag counts as a reply (NIP-10 positional form)
✗ B3: 'reply'- and 'root'-marked e tags count as replies
✗ B4: a 'mention'-marked e tag is NOT a reply (quote/mention, NIP-10)
✗ B5: q-tag-only (NIP-18 quote) and p/t-only notes are top-level; a mixed reply+mention is a reply
✗ B6: no tags / empty / malformed input never counts as a reply (guards)
✗ B7: enrichNotes items carry isReply matching the rule, alongside the unchanged shape (AC-2/AC-3 data)
✗ U1: /feed renders the shared SortToggle with "Notes" and "Notes + Replies" options (AC-1)
✗ U2: /feed mode state defaults to 'notes' (AC-1 default)
✗ U5: /user/:pubkey/notes renders the shared SortToggle with the same two options (AC-1)
✗ U6: /user/:pubkey/notes mode state defaults to 'notes' (AC-1 default)
✗ U3: renderFeedState takes mode and filters items by isReply (AC-2/AC-3/AC-4)
✗ U7: renderUserNotesState takes mode and filters items by isReply the same way (AC-2/AC-3/AC-4)
✓ U9: neither page re-sorts — filtered items render in delivered array order
✗ U4: /feed shows an explicit reply-only message when Notes mode filters everything (AC-5)
✗ U8: /user/:pubkey/notes shows the same explicit reply-only message (AC-5)
✓ R1: /feed keeps its pre-existing empty states (AC-6)
✓ R2: /user/:pubkey/notes keeps its pre-existing EMPTY state + copy (AC-6)
✓ R3: filtering is CLIENT-side — hooks fetch the same URLs with no mode param (AC-3)
✓ R4: both read paths still funnel through the SHARED enrichNotes
✓ R5: SortToggle itself is unchanged — shared contract intact
=> pass: 6 fail: 15
```

### Note for the Implementer (one deliberate divergence from the ADR snippet)

B6 pins `isReplyNote([['e']]) === false`: an `e` tag with **no event id** references
nothing and must not classify as a reply. The ADR's illustrative one-liner
(`t[0]==='e' && t[3]!=='mention'`) would return `true` there — add a `tag[1]` truthiness
guard. This is spec-tightening within the story's definition ("a response to **another
note**"), not a rule change.
