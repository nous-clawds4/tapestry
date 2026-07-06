# Review: Story 2 — `npm test` is honest without the stack — guarded live suites, counted skips

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-06
**Diff:** `git diff b916d35e..HEAD` (commits `e2220e17` failing tests, `ecdf9e36` implementation)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite alone (stack up):** `node -e "require('./test/stack-free-npm-test.test.js').run()…"` → `{"pass":5,"fail":0}` — **G2 ran live** (control panel reachable), matching the plan's stack-present expectation. G1's 12 dead-port children all decided within budget.
- [x] **Dead-port full run (AC-1 procedural check, test plan §How to run):** `BRAINSTORM_BASE_URL=http://127.0.0.1:9 npm test` → exit 1 with **exactly three** FAIL suite lines — `harness-lint (27/1, L9 GNU-date)`, `harness-stats (7/1, book-throughput date math)`, `session-start (7/1, .claude/settings.json hook file)` — precisely OPEN.md rows 19/20, story 3's scope, as the plan's macOS clause predicts. **Zero occurrences of `fetch failed` in the entire 1378-line log.** All **24** live suites (the 12 newly guarded + the 12 `*-publish`) render `SKIP (N tests; …)` with reasons. `Total skipped: 242` — reconciled mechanically: 238 (sum of the 24 whole-suite SKIP lines) + 2 (`search-api-result-type-settings` per-test) + 1 (`trusted-list-pin-publish-blockers` per-test) + 1 (G2 self-skip, correctly dead-port in that run) = 242. `stack-free-npm-test suite: PASS (4 passed, 0 failed, 1 skipped)` — the suite is stack-free-safe. Log: scratchpad `deadport-npm-test.log`.
- [x] **Plain `npm test` (local stack up, near-empty graph):** exit 1 — **all 12 contract suites RAN (none skipped)**: tag-detail, tag-detail-write, tag-index, authored-tagging, pin-a-tag, most-pinned-tag-index, tag-detail-curated-view-and-pin-polish (33/0), restore-historical-data-and-fix-tl-author-filter (22/0), nip51-list-export-from-pins all PASS live; profile-tags (10/3), profile-tag-polish (7/4), tl-publication-from-pins (9/1) FAIL live. Failing set = 14 suites: those 3 + 8 `*-publish` suites + the 3 harness suites — **entirely within the story-1-review baseline's documented half-alive churn class + story-3 trio; no new failing suite.** `Total skipped: 25` (16 authored-tagging-publish + 8 profile-tag-polish-publish + 1 G2) — reconciles. Log: scratchpad `live-npm-test.log`. (G2 self-skipped inside this aggregate — see non-blocking #1.)
- [x] **Red-first (re-verified, not trusted):** rebuilt the base tree (`git archive b916d35e` into scratchpad + the new suite file + node_modules symlink) → `{"pass":2,"fail":3}`: G1/G3/G4 fail with itemized per-suite offender lists (all 12 named in G3/G4; no import errors), G2/G5 green as the standing regression guards — exactly what the test plan §Verification recorded.
- [x] `bash scripts/harness-lint.sh` → exit 0, `clean (0 violations)` (known waivers only).
- [x] _Playwright not applicable — no browser/UI change._
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test. AC-1/AC-4 → G1 (behavioral, 12 dead-port children: `fail===0`, `skipped>=1`, visible SKIP line, ≤20 s decision) + the dead-port full-run procedural check; AC-2 → G2 (live sample on tag-detail; verified live in the standalone run) + this review's guard-only diff audit for the other 11; AC-3 → G3 (all 12 summary lines consult `.skipped`; `Total skipped:` aggregate) + observed in both full runs; AC-4 → G4 (bounded `AbortSignal.timeout(2000)` probe + reachability helper in all 12 sources); AC-5 → G5 (all 12 `.fail === 0` terms in `overallOk`; chain never consults `.skipped`; strict exit intact) + the live run's exit 1 with real failures present demonstrates skips don't mask failures.
- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story. Non-test code untouched; the only files in range are the 12 suites, the new suite, `test/test.js`, and the two phase artifacts (story link line, test plan).

## ADR adherence
- [x] No ADR (Architecture skipped per the ratified book plan). Precedent conformance checked instead: the guard is a byte-for-byte match of `test/most-pinned-tag-index-publish.test.js:48–53` (same probe endpoint `/api/auth/user-classification`, same 2000 ms `AbortSignal.timeout`, same `r.ok` predicate), applied at top-of-`run()` with a `{ pass: 0, fail: 0, skipped: tests.length }` return.
- [x] Layering respected — all changes are test-side; no `src/` or `ui/` file touched.
- [x] No new dependencies (only node built-ins: `child_process`, `fs`, `path`).

## Concept-graph integrity
- [x] N/A — no concept-graph entities, handles, kinds, or wire formats touched (matches the story's "Concepts touched: None").
- [x] No firmware reinstall needed.
- [x] N/A — no new domain-orienting code.

## Things tests can't catch
- [x] No secrets in committed files (probe endpoint is unauthenticated; no keys, no tokens).
- [x] No leftover debug logging — the per-suite `SKIP: control panel not reachable at …` console lines are the spec (visible skips, reviewer constraint), not debug.
- [x] No commented-out code.
- [x] Error paths: guard helpers catch and return `false` (unreachable ⇒ skip, never throw); `runSuiteChild` handles crashed/unparseable children (`status 3` path, null result → G1 offender); the child `RESULT_MARKER` parse is wrapped.
- [x] Concurrency: `spawnSync` children are sequential and time-capped (`CHILD_TIMEOUT_MS` 120 s); no shared-state races. G1 uses a dead port, so it never touches (or contends on) the real stack.
- [x] No recursion: children require suite modules directly; `test/test.js` is only `fs.readFileSync`-inspected (G3/G5), never executed.
- [x] Exit semantics audit (the skip-creep risk): the `overallOk` chain diff is exactly one added term (`stackFreeNpmTestResult.fail === 0`, from the test commit); the chain contains no `.skipped` reference; `process.exit(overallOk ? 0 : 1)` intact; the `totalSkipped` block is purely informational (computes + prints, feeds nothing).
- [x] **Aggregate completeness (mechanical):** every `const <x>Result = await <suite>.run()` in `test/test.js` extracted and diffed against the `totalSkipped` array — **88 result vars, 88 aggregate entries, zero missing in either direction.** No silent undercount is possible for any current suite.
- [x] **Guard-only diff audit, all 12 suites:** each diff is insertions-only — one `controlPanelReachable()` helper + one top-of-`run()` early return. No test body, assertion, fixture, export, or normal-path return shape changed anywhere. All 12 already read `CONTROL_PANEL_BASE` from `process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778'` (no new base-URL consts needed, none added). `tl-publication-from-pins`'s `docker exec` path sits below the guard, so a stack-free run never reaches it.

## House rules check
- [x] Concept Graph API authority respected (nothing domain-facing changed).
- [x] No new lint/typecheck/build tooling.
- [x] TA-pubkey rule: no pubkey literals anywhere in the diff.

## Product-guide adherence
- [x] N/A — no PRD; harness-infrastructure story.

## Findings

### Blocking
None.

### Non-blocking
1. **test/stack-free-npm-test.test.js:83 (G2 probe)** — in the plain full-`npm test` run, G2 self-skipped ("control panel not reachable at http://localhost:7778") even though the panel was up — all 12 contract suites ran live in the same aggregate, and a manual probe immediately after returned 200. The 2 s probe transiently missed under the loaded run. The skip was **visible and counted** (exactly the honesty rule this story ships), G2 passed live in the standalone run, and the 2000 ms bound is the ratified precedent's own value — so this is environment noise, not a defect. Worth knowing: the same transient-miss class applies to the 12 suite guards on a loaded stack-up box (a false skip would be visible/counted, never silent, and cannot occur in stack-free CI where the probe fails deterministically fast). If it recurs often enough to matter, that's the book's bullet-4 "first surfaced flake" mechanism, not a retry.
2. **test/restore-historical-data-and-fix-tl-author-filter.test.js:60** — this guard carries a one-line provenance comment the other 11 don't. Cosmetic inconsistency from the parallel application; harmless.
3. **test/stack-free-npm-test.test.js:146 (G4 regex)** — matches only the *first* `AbortSignal.timeout(...)` in a file; a hypothetical later unbounded fetch wouldn't be caught. Acceptable for a source contract whose real enforcement is G1's behavioral wall-clock budget.

### Harness friction
1. None. The 12-parallel-agent application produced near-uniform results — identical helper bodies, identical skip-reason wording, consistent placement; the only divergence is the stray comment in non-blocking #2. The precedent pointer in the story (`most-pinned-tag-index-publish.test.js:48–53`) was accurate. No OPEN.md meta row warranted.

## Verdict
**PASS**

## On PASS (same commit)
- [ ] Story `**Status:**` flip to `Done` — **deferred to the main loop** per this session's orchestration (reviewer instructed not to edit the story or commit; flip + commit happen with the review file at the main loop).
- [x] Completion detection run: book `test-hermeticity-ci` checked — **not complete.** Bullet 1 done (story 1); bullet 2 now satisfied in its first half (the 12 guards, visible counted skips, live parity) but its second half (session-start settings.json ship — row 20; GNU-date portability — row 19; deterministic timing asserts) is story 3, still open; bullets 3 (CI job, story 4) and 4 (flake-surfacing/waiver doc) unstarted. Book stays Open; no close offer.
