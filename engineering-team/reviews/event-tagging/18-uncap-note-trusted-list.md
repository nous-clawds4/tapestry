# Review: Uncap the durable note Trusted List (event-tagging #18)

**Date:** 2026-07-07
**Reviewer phase.** Story `…/event-tagging/18-uncap-note-trusted-list.md`; ADR `…/event-tagging/0017-uncap-note-trusted-list.md`;
test plan `…/18-…test-plan.md`; spec `protocols/drafts/trusted-lists.md`. Diff: `25d4878f` (impl) + `1294ab42` (spec).

## Verdict: **PASS**

Implements ADR 0017 exactly, all ACs met, 131/131 across 9 suites, and the two headline ACs are
**live-proven**. Three minor, non-blocking notes.

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| Published note TL is complete (>50) | ✅ | `runOneNotePin` reads `fullMembers`; test **C1** (publishes 60, not capped `members`); **live: 55-tagged-note tag → TL carries all 55** |
| Honest at scale — never a silent small cap; explicit partial signal | ✅ | `["truncated","<total>"]` + `content.partial` when `scanTruncated \|\| curated.length > NOTE_TL_MEMBER_CAP`; tests **C2** (scan-truncated), **C3** (over-cap), **C4** (complete→no marker) |
| Membership scan bounded safely, not silently | ✅ | `TAGGING_SCAN_LIMIT` on each `filterTaggingsUsingTag` scan; `scanTruncated` when hit; test **S4** |
| Durable-list contract holds elsewhere | ✅ | diff touches only `event-tags`/`refreshPinnedTags` — `runOnePin`/`aggregateProfilesTagged`/`refreshApplicabilityLists` untouched (pubkey TL was already uncapped) |
| UI reads keep their contract | ✅ | `members`/`noteIds`/`handleForTag` byte-identical; `event-tagging-for-tag` green; **live: for-tag = total 55, members 50, truncated true** |

## ADR adherence

Faithful to Option A: `aggregateNotesTagged` adds `fullMembers` (all `rankedIds`) + `scanTruncated` +
explicit scan `limit`, leaving `members`/`noteIds` (capped) untouched; `runOneNotePin` publishes the full
curated set up to `NOTE_TL_MEMBER_CAP` (exported = 1000) with the partial signal. Spec documents the
`truncated`/`content.partial` contract. No deviations.

## Risk areas audited

1. **`handleForTag` byte-identical (the flagged risk).** The return gained `fullMembers`/`scanTruncated`,
   but `handleForTag` destructures a **fixed field set** (`members, mine, candidates, countByTarget,
   mineByTarget, latestByNote, noteIds, total, truncated, povSuffix, minRank`) — the two new keys are
   ignored. `members`/`noteIds` are computed exactly as before (`NOTES_CAP` slice unchanged, lines
   288–300). **Live-confirmed** for-tag identical. No regression.
2. **Scan bound & `scanTruncated`.** The `limit` only affects tags with >`TAGGING_SCAN_LIMIT` taggings on
   a single header; normal tags are unchanged (previously would overflow→error for huge tags → now
   returns the bound + flags partial — strictly better). The limit is **per-header scan** (the correct
   buffer-protection granularity); a multi-header union under the per-scan limit is complete and correctly
   *not* flagged.
3. **Partial trigger.** `!!scanTruncated || curated.length > NOTE_TL_MEMBER_CAP` — covers both the scan
   bound and the event-size ceiling. Empty set (N4) → `partial=false`, empty-membership retraction intact.
4. **Scope.** Only the two files + test changed; the pubkey pin TL and applicability lists are untouched.

## Test coverage

`test/note-trusted-list.test.js` +5 (C1–C4 executed via injected deps returning distinct `members`
vs `fullMembers`; S4 source sentinel). Reviewer independent run: **131 pass / 0 fail** across
note-trusted-list, event-tagging (for-tag/read-api/core), tag-applicability(+picker), unified-tag-index,
generalized-tag-pinning, profile-tags.

## Minor findings (non-blocking)

1. **`truncated` value uses `total` (all trusted-tagged) while the list is the *curated* subset.** When
   curation filters (e.g. `net-endorsed` drops disputed), the marker's total can overstate the curated
   universe a consumer would get on a full fetch (e.g. 2000 tagged / 1500 net-endorsed / 1000 published →
   marker "2000"). This **matches the ADR's stated "totalTrustedNotes"**, so it's contract-consistent —
   but consider reporting the *curated* count for consumer intuition. Cosmetic/semantic, not a defect.
2. **`scanTruncated` over-signals at exactly the limit** — `scanned.length >= LIMIT` flags partial even for
   an exactly-`LIMIT`-sized complete set. Conservative (errs toward "partial", which is safe). Fine.
3. **`partial` is returned but not surfaced in `refreshAllPinnedTags`'s per-pin `noteTL` summary** (only
   `status`/`dTag`/`memberCount`). Minor observability gap; the wire signal (the `truncated` tag) is the
   source of truth regardless.

## Deploy note
Live-smoked locally. The partial-signal paths (scan-truncated, >`NOTE_TL_MEMBER_CAP`) are unit-proven
(C2/C3) — triggering them live needs >20k or >1000 taggings, disproportionate for a smoke. On tags.b.w
the change takes effect on the next `refreshPinnedTagTLs` run; `NOTE_TL_MEMBER_CAP` is tunable if the
relay's max event size differs.
