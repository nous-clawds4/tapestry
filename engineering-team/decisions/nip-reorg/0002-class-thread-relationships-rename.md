# ADR 0002: Class Thread Relationships rename — mechanical edit list and link policy

**Status:** Accepted
**Date:** 2026-07-12
**Story:** `engineering-team/stories/nip-reorg/2-class-thread-relationships-rename.md`

## Context

Story nip-reorg #2 renames the `n`/`s` NIP per handoff D4 ([`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md)). Grep of the 8 living documents (story AC4) finds 13 link occurrences of the old filename and 3 prose mentions; no `class-thread-tags.md#anchor` links exist anywhere in the corpus. The design questions are purely editorial: what changes inside the file, which inbound text changes, and how "zero references remain" is checked without falsifying record-prose.

## Options considered

### Option A — `git mv` + single-commit living-doc sweep, target-vs-display rule (chosen)
One commit: the move, the title/intro edit, and all inbound fixes. Links distinguish **target** (always updated) from **display text** (updated only where it names the *document*, kept where it names the *tags* — "class-thread tags" remains correct English for `n`/`s` themselves). Pros: no window with dangling links; review is one diff. Cons: none material at this size.

### Option B — copy + redirect stub at old path
Rejected: story Out-of-scope explicitly declines a stub; pre-publication drafts don't need redirects; git history is the record.

### Option C — rename now, links in S4
Rejected: every corpus link would dangle for the S2→S4 window, failing the review gate this epic itself enforces ("cross-references resolve").

## Decision

**Option A**, with one AC4 refinement the Implementer applies and the Reviewer checks: "zero references remain" means zero **link targets** (`(…class-thread-tags.md)`) in the 8 living docs; the 3 prose mentions that name the old filename *as the rename's subject* (`docs/NIP_REORG_DESIGN_HANDOFF.md:62`, `engineering-team/epics/nip-reorg.md:15`, `engineering-team/audits/nip-reorg/book.md:15`) are records of the decision and **stay** — same convention as historical ADRs.

## Consequences

- All corpus navigation stays intact through the rename; S4's sweep is left only the semantic re-pointers, as planned.
- Historical ADRs/reviews/done-stories retain now-stale path mentions by design (planning-gate ratification).
- **Firmware reinstall required?** No.

## Implementation notes

**1. `git mv protocols/drafts/class-thread-tags.md protocols/drafts/class-thread-relationships.md`**, then inside the renamed file only:
- Title (lines 8–9): `Class-Thread Membership Tags (`n`, `s`)` → `Class Thread Relationships` (adjust `=====` underline).
- Metadata header, Sources line (line 4): append `; renamed from class-thread-tags.md per nip-reorg ADR 0002 (2026-07-12)`.
- Intro (line 11): keep the existing sentence; append the guard: "The relationships consumers derive from them (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`) are **derived** — computed from single-char tags on the child's own signed events, never from explicit relationship events ([Tapestry Concepts](./tapestry-concepts.md) § 'Derived vs. explicit relationships')."
- Nothing else — AC3 requires the body otherwise byte-identical.

**2. Inbound link fixes (target always; display only where noted):**

| File:line | Edit |
|---|---|
| `protocols/README.md:53` | Row → `Class Thread Relationships (`n`, `s`)` + new path (both occurrences) |
| `protocols/drafts/inherit-from.md:16,34,47` | Target only — display "class-thread tags" names the tags; keep |
| `protocols/drafts/inherit-from.md:105` | Target + display → "class-thread relationships spec" |
| `protocols/drafts/shared-concepts.md:28` | Target only — display names the tags; keep |
| `protocols/worksheet.md:27,29,55,71` | Target + display → "class-thread-relationships spec" (all four name the spec) |
| `BIBLE.md:1547` | Target + display (path is the display) → new path |
| `docs/NIP_REORG_DESIGN_HANDOFF.md:6` | Target + display (path is the display) → new path; line 62 prose untouched |
| `engineering-team/epics/nip-reorg.md` | Lines 8/15 prose untouched; flip S2's `_(planned)_` marker to link the story file (housekeeping the epic already does per story) |
| `engineering-team/audits/nip-reorg/book.md:15` | Prose untouched |

**3. Reviewer verification plan:** `grep -rn 'class-thread-tags\.md)'` over the 8 living docs → 0 hits; `git log --follow protocols/drafts/class-thread-relationships.md` shows pre-rename history; `git diff -M` shows rename detection with hunks confined to header/title/intro; all links in changed files resolve on disk; the 3 subject-prose mentions still present; historical artifacts untouched (no ADR/review/done-story modification in `git status`); `npm test` (stack-free green; 11 stale-stack failures = known caveat) + `harness-lint` clean.

## Out of scope

Semantic re-pointers (S4); any `n`/`s` semantic change; uppercase-letter policy; W2's future registry table.
