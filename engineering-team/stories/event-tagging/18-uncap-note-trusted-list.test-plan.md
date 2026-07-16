# Test Plan: Uncap the durable note Trusted List (event-tagging #18)

**Story:** `engineering-team/stories/event-tagging/18-uncap-note-trusted-list.md`
**ADR:** `engineering-team/decisions/event-tagging/0017-uncap-note-trusted-list.md`
**Suite:** `test/note-trusted-list.test.js` (extends the #17 suite; registered in `test/test.js`)

## Strategy

The cap lives in `aggregateNotesTagged`, which the `runOneNotePin` tests **fake** — so the discriminating
signal is *which field* `runOneNotePin` consumes. The fake now returns **both** `members` (capped) and
`fullMembers` (complete) with *different* values; a test that asserts the published set equals
`fullMembers` (not `members`) proves the uncapping. Partial-signal behavior (scan-truncated, over-ceiling)
is driven by `scanTruncated`/`total`/oversized `fullMembers` from the fake. `aggregateNotesTagged` itself
(no dep seam — hits strfry) is covered by a **source sentinel** for the new return fields + the explicit
scan `limit`. `handleForTag`/`for-tag` is untouched → the `event-tagging-for-tag` suite guards it.

## Coverage — AC → test

| Acceptance criterion | Test(s) |
|---|---|
| Published note TL is complete (>50) | **C1** (publishes `fullMembers`=60, not capped `members`) |
| Honest at scale — never a silent small cap; explicit partial signal | **C2** (scan-truncated → marker), **C3** (over-ceiling → cap + marker), **C4** (complete → no marker) |
| Membership scan bounded safely, not silently | **S4** (explicit `limit` on the taggings scan; `scanTruncated` returned) |
| Durable-list contract holds elsewhere | not-regressed — no other TL touched; pubkey TL already uncapped (ADR §Sub-decisions) |
| UI reads keep their contract | `event-tagging-for-tag` suite stays green (`handleForTag` unchanged) |

## Test list

**C — completeness (executes `runOneNotePin` with injected deps):**
- **C1** — `members`=1 (capped) vs `fullMembers`=60 → the TL publishes **60** (uses `fullMembers`), no `truncated` marker.
- **C2** — `scanTruncated:true`, `total:999` → the TL carries `["truncated","999"]`.
- **C3** — `fullMembers` = `NOTE_TL_MEMBER_CAP`+50 → publishes exactly `NOTE_TL_MEMBER_CAP` members **and** `["truncated","<total>"]`.
- **C4** — modest complete set (7, not truncated) → publishes all 7, **no** marker.

**S4 — source sentinel (`aggregateNotesTagged`, not dep-injectable):**
- `aggregateNotesTagged` returns `fullMembers` + `scanTruncated`; the `filterTaggingsUsingTag` scan passes
  an explicit `limit` (`TAGGING_SCAN_LIMIT`) — not the silent 20MB buffer ceiling.

**Contract:** `runOneNotePin` reads `deps.aggregateNotesTagged().fullMembers` (the complete set), curates it
with `noteMethod`, publishes up to `NOTE_TL_MEMBER_CAP` `e`-tags, and adds `["truncated", String(total)]`
+ `partial:true`/`total` in content when `scanTruncated || curated.length > NOTE_TL_MEMBER_CAP`.
`refreshPinnedTags` must **export `NOTE_TL_MEMBER_CAP`** (C3 reads it).

## Out of scope (not tested here)
- `aggregateNotesTagged`'s live scan/limit behavior end-to-end (no dep seam; cycle-local smoke).
- UI pagination / per-note fan-out (`_intake.md` 2026-06-30); the pubkey-TL scan bound (follow-up).
- The exact numeric constants (asserted via the exported `NOTE_TL_MEMBER_CAP`, not hardcoded).

## Status
N1–N6, N2b stay **green** (the fake defaults `fullMembers`→`notes`, so existing behavior is preserved).
C1–C4 + S4 **fail** pre-implementation (old `runOneNotePin` reads capped `members`; `NOTE_TL_MEMBER_CAP`
unexported; `fullMembers`/`scanTruncated`/scan-`limit` absent). Green once ADR 0017 ships.
