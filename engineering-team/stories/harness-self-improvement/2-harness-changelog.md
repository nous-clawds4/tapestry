# Story 2: harness-changelog — every harness change has a recorded origin

**Status:** Approved
**Created:** 2026-07-02
**Approved:** 2026-07-02 (operator, in-session gate — all three recommendations ratified)
**Type:** Feature

## Background

The harness has been structurally modified ~17 times since April via ad-hoc `chore:`/`docs:` commits — epic-scoped folders, the Done-flip rule, the whole Direction-mode apparatus, the book-close return edge, OPEN.md + `/whats-open` themselves, the Gate-5 clarification, and now the review sweep and story 1 — each silently binding on every human and future session. There is no record of *what changed, when, and what incident prompted it* (`engineering-team/README.md` still said "Generated 2026-04-30" until the sweep), no announcement channel (a session on a week-old branch discovers new obligations by tripping over them), and no way to measure which feedback channels actually produce harness changes.

This is the **ratify** stage of the self-improvement loop (review §5.4): one ratified-change record whose **origin column** makes the loop auditable — in a month, the CHANGELOG tells us whether meta rows, retros, journals, or ad-hoc pain are driving improvements.

## User-facing description

As a contributor, I want every harness-definition change recorded with its origin and surfaced when my branch predates it, so that process changes are announced, auditable events instead of silent obligations.

## Acceptance criteria

- [ ] Given the repo, `engineering-team/CHANGELOG.md` exists with a documented row format: **date · change (one line, files/scope) · why · origin** (the incident, OPEN.md row, journal entry, review finding, or ask that prompted it — with a pointer).
- [ ] Given the repo's history, the log is **seeded retroactively**: every known structural harness change (at minimum: harness generated 2026-04-30; epic-scoped folders + its three numbering-collision incidents; the Done-flip rule; the product-team flow; Direction mode; the command repoint; the Gate-5 status-flip clarification + its journal origin; OPEN.md + `/whats-open` creation; the book-close return edge; the 2026-07-02 review, Appendix A sweep, and story 1) has a row with date, origin, and commit pointer(s); a header note marks pre-existing rows as reconstructed after the fact.
- [ ] Given `engineering-team/README.md` § "Tuning the team", it documents the convention: **a diff touching harness-definition paths also touches CHANGELOG.md** (one row per logical change), and names the path set by reference to its single definition.
- [ ] Given a commit that touches harness-definition paths without touching CHANGELOG.md, when `harness-lint.sh` runs, a new **L10** check flags it (waiverable like every invariant); given the converse, L10 is quiet. Covered by fixtures like L1–L9; the existing 19 tests stay green.
- [ ] Given a session on a branch whose merge-base with the shared line predates harness-definition changes, when `whats-open.sh` runs, a section lists those commits ("harness definition changed since your branch diverged") — and prints nothing noisy when there are none.
- [ ] Given this story's own commits (they touch README, lint, whats-open — all harness-definition paths), the real repo passes lint **including L10** at story close: the story's own CHANGELOG rows are the first live entries.

## Concepts touched

None — harness tooling and docs only. No concept-graph handles, no firmware, no product source. (Stack not required.)

## Out of scope

- Git hooks / CI enforcement of the touch-rule (L10 is session-start detection; commit-time blocking is a possible future amendment, and CI is OPEN.md row 13's dependency).
- Backfilling per-commit detail for every one of the ~17 historical commits — rows are per **logical change**, not per commit.
- The escalation rule and CLAUDE.md capture sentence (story 4) and the retro that will *consume* the origin column (story 3).
- Governance beyond recording + surfacing (e.g., a second-contributor ack rule for obligation-changing edits — a candidate retro proposal, not this story).

## Open questions

*All resolved at the Planning gate (2026-07-02, operator):*

1. **Row granularity — RESOLVED:** one row per logical change, listing its commit(s).
2. **Divergence base — RESOLVED:** merge-base with `origin/staging`, falling back to `origin/main`.
3. **L10 scope — RESOLVED:** latest harness-touching commit only (v1); stricter variant is a future tightening.

## Linked artifacts

- ADR: `engineering-team/decisions/harness-self-improvement/0002-harness-changelog.md` (Accepted 2026-07-02)
- Test plan: `engineering-team/stories/harness-self-improvement/2-harness-changelog.test-plan.md`
- Review: (filled in after Review phase)
