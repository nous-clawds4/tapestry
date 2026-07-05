# Review: Story 1 — harness-lint

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-02
**Diff:** `git diff 9bf8152f..HEAD` (story-scoped commits: impl `91389c71`, bash-3.2 guard, disposition side-commit `c5690a66`; plus phase artifacts) — 10 files, +561/−5

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — reviewer-run, fresh: **harness-lint suite 19/19 PASS**. Overall FAIL solely from the 12 pre-existing stack-dependent live-API suites (`fetch failed`, no Docker stack in this environment); failing set diffed against the pre-change baseline: **byte-identical — zero regression** (evidence: `npm-test-full.log` vs `npm-test-review.log` diff, empty). Tracked as OPEN.md row 13.
- [x] `bash scripts/harness-lint.sh` on the real repo — **clean (0 violations), exit 0**, 10 visible WAIVED lines each carrying its citation, 2 INFO lines, no STALE-WAIVER.
- [x] `bash scripts/whats-open.sh` — the new "Harness invariants" section renders the lint output (AC-4, the deliberately reviewer-run check from the test plan).
- [ ] `npm run test:playwright` — n/a: no UI surface in this diff; no local stack in this environment.
- [ ] _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test — coverage map in the test plan holds: L1–L9 each fixture-tested (AC-1), exit codes (AC-2), waiver + stale-waiver semantics (AC-3), `/whats-open` wiring verified by reviewer run (AC-4), `test/test.js` registration proven by the suite banner + summary + overall conjunction (AC-5), stripped-env no-network/no-stack test (AC-6), real-repo lint-clean (closing criterion).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story — the two extra L5 fixes (direct-feature, director.md) and the header refreshes are the ADR-sanctioned "trivial ones fixed" disposition, logged as story Deviations 3–4.

## ADR adherence

- [x] Option A implemented as specified: bash sibling of whats-open.sh, `set -uo pipefail`, function per invariant, awk for the verdict parse, `VIOLATION/WAIVED/STALE-WAIVER/INFO` output shapes, waiver file format as designed.
- [x] The ratified rules are in: last-token verdict parsing (both orderings fixture-tested); L9 at 14 days with GNU-date + no-git skip guards.
- [x] The disposition obligation was honored to the letter: the three unretired epics were **surfaced at this gate, not decided silently** — operator ratified retire-now; executed as side-commit `c5690a66` (epics Done, folders under `done/`, waivers pruned, OPEN.md row 17 → DONE).
- [x] No new dependencies (bash + git + coreutils only; AC-6's stripped-env test enforces it).
- [x] One ADR deviation, sound and logged (story Deviation 2): the suggested AGENTS.md L5 waiver was not shipped — AGENTS.md isn't in the L5 scan set, so the waiver would have been born STALE.

## Concept-graph integrity

- [x] n/a by design — no handles, no firmware, no product source touched (story "Concepts touched: none"); verified: diff touches only `scripts/`, `test/`, wiring docs, and tracking surfaces.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] Read-only over the tree; no concurrency concerns; no network.
- [x] bash-3.2 portability: the empty-array-under-`set -u` hazard (macOS default bash) was caught and length-guarded in both waiver loops before this review; fixtures (which run with no waiver file → empty arrays) cover the code path on CI-class bash, though not on a literal 3.2 interpreter — acceptable residual risk, noted.
- [x] Waiver globs come from a repo-tracked file (trusted input); `[[ $p == $glob ]]` pattern matching is deliberate and comment-documented.

## Findings

### Blocking
_None._

### Non-blocking
1. **`scripts/harness-lint-waivers.txt:6`** — the tq-#22 L1 waiver cites a *reason*, not an OPEN.md row. The story's waiver format allows "row **or** reason", but the book's acceptance frame says "each waiver citing an OPEN.md row" — a small spec tension to reconcile at book close (either open a row for the verdict-rule edge case or relax the frame's wording to match the story).
2. **`scripts/harness-lint.sh` (L5)** — the check scans for `localhost:<digits>` only; a hardcoded port in another shape (e.g., `127.0.0.1:7778`) would pass. Fine for the drift class actually observed; extend if that shape ever appears.
3. **Review #22's verdict phrasing defeated the ratified parsing rule** (story Deviation 1, waived with citation) — strengthens the case for a machine-readable final `**Verdict:**` line as a future harness amendment; belongs in the story-3 retro's input.

### Harness friction *(→ OPEN.md `meta` rows)*
1. None new this story — the friction found (verdict-rule edge) is already captured as story Deviation 1 + the cited waiver, and feeds the story-3 retro. *(Filing a dedicated `meta` row is folded into non-blocking #1's book-close reconciliation rather than duplicated now.)*

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: the book (`audits/harness-self-improvement/book.md`) is **not** complete — 1 of 7 epic stories Done; acceptance-frame bullets 2–9 unrealized. No `/close-book` offer; next up per the epic's dependency order: **story 2, harness-changelog**.
