# Review: Story 2 — harness-changelog

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-02
**Diff:** story-2 commits `78f427d9` (tests) + `4ecfd174` (impl) — CHANGELOG.md, harness-def-paths.txt, harness-lint.sh (L10), whats-open.sh (divergence section), README § Tuning the team, test extensions

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — reviewer-run, fresh: **harness-lint suite 25/25 PASS** (19 story-1 + 6 story-2 tests); full-run failing set diffed against the pre-book baseline: **identical** (the 12 stack-dependent live-API suites, OPEN.md row 13) — zero regression.
- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**, exit 0, waivers visible with citations, no stale waivers. L10's first live evaluation behaved exactly as designed: pre-impl it flagged `commit:c5690a66` (pre-convention) as its sole violation; the impl commit (def paths + CHANGELOG together) satisfies it.
- [x] `bash scripts/whats-open.sh` — the two new/updated sections render: divergence section prints "(none — your branch has current harness definitions)" (correct: this branch is ahead of the shared line, not behind); **populated path demonstrated** by evaluating the same log-over-def-paths from the stale-ref perspective — it lists exactly the 8 def commits a stale session would see (output on record in the session).
- [x] Seeded-row provenance spot-check: `4acbe321`, `dacbcf03`, `f314bbba`, `0143835a` resolve with matching dates/subjects; the full 17-row seed was mined from `git log` in-session (all SHAs session-verified).
- [ ] `npm run test:playwright` — n/a (no UI surface; no stack).
- [ ] _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] **AC-1** CHANGELOG exists; header documents the row format, one-row-per-logical-change rule, the touch-rule, and the reconstruction note.
- [x] **AC-2** every minimum seed item present with commit pointer(s) + origin: harness creation, cycle skills, invariants, command wiring + first port fix, Docker rule, epic-folder migration (incl. the mined detail that the **Done-flip rule landed inside `dacbcf03`**) + its three collision origins, product-team flow, return edge, docs-mode, lane-picking, Direction mode, repoint, OPEN.md//whats-open, Gate-5 clarification (+ its journal origin, flagged as the loop's first worked example), the 2026-07-02 review/sweep, story 1, story 2.
- [x] **AC-3** README § "Tuning the team" documents the convention and names the path set by reference to its single definition.
- [x] **AC-4** L10 fires/quiet/waiverable/missing-CHANGELOG/missing-def-file/no-git — all fixture-tested; 19 story-1 tests green against the new fixture base with zero assertion changes.
- [x] **AC-5** divergence section: both the none-case (live) and populated-case (demonstrated) verified; noise-free wording confirmed.
- [x] **AC-6** real repo passes lint **including L10** at close — the story's own rows are the first live entries (the designed self-referential closure).
- [x] No behavior beyond the story.

## ADR adherence

- [x] Option A implemented exactly: shared data file (self-listing, records-vs-definition boundary honored — stories/reviews/decisions/audits deliberately excluded); CHANGELOG as chronological append-at-bottom table; L10 in lint with `--no-merges`, `commit:<short-sha>` waiver shape, missing-CHANGELOG-is-a-violation, INFO-and-skip on missing def file, no-git skip.
- [x] Gate-ratified decisions honored: row-per-logical-change (17 rows ≪ ~40 constituent commits); staging-merge-base-with-main-fallback; latest-only L10.
- [x] Shipped def-path list matches the ADR's enumeration exactly (20 entries).
- [x] No new dependencies.

## Concept-graph integrity

- [x] n/a — harness tooling and docs only; no handles, firmware, or product source (verified in the diff).

## Things tests can't catch

- [x] No secrets, no debug residue.
- [x] Read-only checks; no concurrency exposure.
- [x] Markdown-table integrity: the cycle-skills row's literal pipes are escaped (`\|`) — table renders.
- [x] Origin cells stay terse with pointers, per the format rule the header itself states.

## Findings

### Blocking
_None._

### Non-blocking
1. **`scripts/whats-open.sh` (divergence section)** — builds its `def_paths` array without the empty-array length guard `harness-lint.sh` gained for bash 3.2 (story 1). Only trips on a comment-only def file under macOS bash 3.2 — contrived, since the file ships non-empty and lint's own copy is guarded — but the two readers of the same file should share the same guard. One-line parity fix; natural to fold into story 6 (which touches whats-open invocation via the SessionStart hook).
2. **`scripts/harness-lint.sh` `check_L10`** — the violation message appends a hardcoded `…` to the commit subject even when it's under 60 chars. Cosmetic.

### Harness friction *(→ OPEN.md `meta` rows)*
1. None new — story 1's verdict-rule edge remains the book's only open friction datum (already queued for the story-3 retro).

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: the book (`audits/harness-self-improvement/book.md`) is **not** complete — **2 of 7** stories Done; frame bullets 3–9 open. No `/close-book` offer. Next per dependency order: **story 3, close-book-retro** — the route stage: the post-mortem step, the build-audit "Process findings" section, the product Phase-7 mirror, and the origin-drift preflight port.
