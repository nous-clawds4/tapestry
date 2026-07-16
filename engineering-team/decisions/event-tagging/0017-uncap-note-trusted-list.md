# ADR 0017: Uncap the durable note TL — full membership + explicit scan bound + partial signal

**Status:** Accepted
**Date:** 2026-07-07
**Story:** `engineering-team/stories/event-tagging/18-uncap-note-trusted-list.md`
**Relates to:** ADR event-tagging/0016 (`aggregateNotesTagged` + `runOneNotePin`), `protocols/drafts/trusted-lists.md`

## Context

`aggregateNotesTagged` (event-tags/index.js) computes `rankedIds` — the **complete** set of
trusted-tagged note ids for a tag, from the taggings scan — then slices it to `NOTES_CAP = 50` for two
things: `noteIds` (the kind-1 **body** fetch) and `members` (the deterministic id+count set returned to
the UI). `runOneNotePin` (the note TL) uses `members` — so **the durable, integrator-facing note TL is
silently capped at 50**.

Two facts make the fix clean:
1. The cap exists to protect **UI concerns** — the unbounded `ids` body-fetch (relays reject huge `ids`
   filters) and the per-note client fan-out. The **note TL needs neither** — its members are `e`-tag ids
   + counts, already computed in-memory *before* any body resolution. So the durable membership can be
   full without touching the body-fetch path.
2. The full set is bounded only by the **taggings scan**, which today uses a 20MB process-buffer ceiling
   (`strfryScan`, ~30–40k events) that **rejects on overflow** → `runOneNotePin` returns `status:'error'`
   → the TL **silently stays stale** to consumers. Uncapping must not just relocate that failure.

### Constraints
- **Durable list = complete, or explicitly partial — never silently small-capped** (the whole point).
- **Zero blast radius on `handleForTag`** (live-tested only; the #17 review flagged it) — its UI contract
  (`members`/`notes`/`total`/`truncated`, all bounded at 50) must be byte-identical.
- A single kind-30393 event can't hold unbounded members (relay event-size limits) — so "complete" has a
  practical ceiling that must be **signaled**, not silent.
- Additive to the wire shape; no new dependency.

## Options considered

### Option A — separate durable membership from UI resolution; bound the scan; signal partial *(chosen)*

1. **`aggregateNotesTagged`** — additive:
   - Add an **explicit `limit`** (`TAGGING_SCAN_LIMIT`) to each `filterTaggingsUsingTag` scan so it is
     deterministically bounded and **never overflows the buffer**. Track `scanTruncated` = any per-header
     scan returned `>= limit` (⇒ the taggings — hence the membership — may be incomplete).
   - Compute **`fullMembers`** = ALL of `rankedIds` mapped to `{ id, applications, disputes, createdAt, mine }`
     (the complete trusted-tagged set from the scanned taggings) — **no `NOTES_CAP` slice.**
   - **Leave `members` and `noteIds` (both capped) UNCHANGED** — `handleForTag` stays byte-identical.
   - Return `{ …existing…, fullMembers, scanTruncated }`.

2. **`runOneNotePin`** — publish the full set:
   - `curated = curateNotes(fullMembers, noteMethod)` (curate the complete set, not 50).
   - Publish up to **`NOTE_TL_MEMBER_CAP`** `e`-tag members (a high, event-size-principled ceiling —
     conservative default, operator-tunable, confirmed against the relay's max event size).
   - **Partial signal:** if `scanTruncated` **or** `curated.length > NOTE_TL_MEMBER_CAP`, add an explicit
     `["truncated", "<totalTrustedNotes>"]` tag (present ⇒ partial + the true total; absent ⇒ complete),
     and carry `partial: true` + `total` in the content JSON. Consumers read the presence of `truncated`
     to know the list is not exhaustive.

3. **`handleForTag`** — unchanged (keeps `members`/`noteIds` capped; its `truncated`/`total` already
   signal its UI-page bound).

- **Pros:** the durable list becomes complete (up to a principled, *signaled* ceiling); the scan is
  explicitly bounded (no silent overflow); `handleForTag`'s risky path is untouched; hermetically
  testable. **Cons:** two member arrays in the return (`members` capped + `fullMembers`) — mild
  redundancy accepted for zero `handleForTag` risk.

### Option B — make `members` full; `handleForTag` slices for its response
Return one full `members`; `handleForTag` slices to `NOTES_CAP`. Cleaner return, but **changes
`handleForTag`** (an unguarded, live-only path) and risks altering the for-tag `members` contract.
Rejected for blast radius.

### Option C — uncap `members` without bounding the scan
Silent buffer overflow → the TL errors/stales for hot tags. Rejected — moves the silent failure.

### Sub-decisions
- **AC-4 (other durable lists):** the pubkey pinned-tag TL (`runOnePin`) is already **complete** (no
  `NOTES_CAP`); its scan shares the buffer risk but **errors visibly** (no silent *small* cap), so AC-4
  holds as-is. Applying the same explicit scan bound to `aggregateProfilesTagged` is a **noted parallel
  follow-up**, not required here. Applicability lists (a-coords) are unaffected.
- **Constants:** `TAGGING_SCAN_LIMIT` well below the ~30–40k buffer ceiling; `NOTE_TL_MEMBER_CAP` well
  under the relay's max event size. Architect proposes conservative defaults (e.g. `TAGGING_SCAN_LIMIT`
  ≈ 20000, `NOTE_TL_MEMBER_CAP` ≈ 1000 — ~75KB of `e`-tags); tune against the deployment's strfry limits.

## Decision

**Option A.** Add `fullMembers` + `scanTruncated` to `aggregateNotesTagged` (explicit scan `limit`,
`members`/`noteIds`/`handleForTag` untouched); publish the full curated set from `runOneNotePin` up to a
signaled `NOTE_TL_MEMBER_CAP`, marking the TL partial (`["truncated","<total>"]` + content flag) when the
scan or the ceiling bounds it.

## Consequences
- **Enables:** integrators read the note TL as the *complete* trusted-tagged set (or know precisely when
  it's partial). No more silent 50-cap.
- **Constrains:** `["truncated","<total>"]` becomes the note-TL partial-signal contract (add to
  `trusted-lists.md`). A hot tag beyond the ceiling yields a *signaled* partial list, not pagination
  (pagination for durable lists is out of scope; the event-size ceiling is inherent).
- **Debt:** the pubkey TL's scan bound (parallel follow-up); the for-tag `members` under-count for the
  pinned-notes drift is untouched (separate concern).
- **Firmware reinstall?** No.

## Implementation notes
- **`src/api/event-tags/index.js`** — `TAGGING_SCAN_LIMIT` const; add `limit` to the `filterTaggingsUsingTag`
  scans in `aggregateNotesTagged`; compute `scanTruncated`; build `fullMembers` from all `rankedIds`;
  return them alongside the unchanged `members`/`noteIds`/`total`/`truncated`. Export nothing new.
- **`src/api/trustedList/refreshPinnedTags.js`** — `runOneNotePin`: curate `fullMembers`; slice to
  `NOTE_TL_MEMBER_CAP`; when `scanTruncated || curated.length > cap`, add `["truncated", String(total)]`
  to `extraTags` and `partial:true`+`total` to the content JSON. `memberCount` in the return reflects the
  published count.
- **`protocols/drafts/trusted-lists.md`** — document the `["truncated","<total>"]` partial-signal on the
  note TL (absent ⇒ complete).
- **Testability:** `aggregateNotesTagged` returns `fullMembers` = all (>50) + `scanTruncated` when a scan
  hits its limit; `runOneNotePin` publishes all members when small, ceiling+`truncated` marker when the
  scan is truncated or the set exceeds the cap, no marker when complete; `handleForTag`/`for-tag` suite
  stays green (unchanged).

## Out of scope
- UI pagination / per-note fan-out (`_intake.md` 2026-06-30); the pubkey-TL scan bound (follow-up); how
  membership is computed/curated; the kind-30003 export.
