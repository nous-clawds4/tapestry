# Review: Story 3 — The harness suites are portable — the hook ships, dates work everywhere, no wall-clock asserts

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-06
**Diff:** `git diff d3c0f9b5..HEAD` (test commit `d9750f89`, impl commit `d810025c`)

Reviewed on macOS (BSD `date`) — the platform under test. No ADR (Architecture skipped per the ratified book plan); design records audited instead: OPEN.md rows 19+20, ADR 0006 (harness-self-improvement — the ratified hook content), book frame bullet 2 (`audits/test-hermeticity-ci/book.md`).

## Quality gates (run by reviewer, not trusted)

- [x] Four suites, this checkout: **session-start 10/0 · harness-lint 29/0 · harness-stats 8/0 · login-failure-and-tag-collapse 18 passed / 0 failed, exit 0** — exactly the post-impl matrix the test plan predicts.
- [x] Real-repo `bash scripts/harness-lint.sh` — **exit 0, clean**, only the pre-existing shipped waivers print.
- [x] **L12 live proof** (no repo mutation): built a clean-shaped fixture in the session scratchpad with a ghost row `scripts/ghost-not-here.sh` in its def-paths → `VIOLATION L12 scripts/ghost-not-here.sh — listed in scripts/harness-def-paths.txt but does not exist on disk …`, exit 1. Standard `violation()` path, so waivable by construction.
- [x] **Dead-port full run** (`BRAINSTORM_BASE_URL=http://127.0.0.1:9 npm test`) — **EXIT 0, zero FAIL result lines, Overall: PASS, Total skipped: 242.** All three harness suites PASS inside the run. (AC-5, first half.)
- [x] **Bare-copy procedure** (`git archive HEAD` → scratchpad, outside any `node_modules`-bearing ancestor, not a worktree): `.claude/settings.json` **is in the archive** (233 bytes, hooks block only) and the session-start suite runs **10/0** there — the tracked-ness assertion's `.git` guard correctly skips in the git-less archive. (AC-1.)
- [x] **Plain `npm test`** — Overall FAIL as expected against the half-alive local stack; failing set is **11 suites, all in the known live/half-alive churn class** (profile-tags, `*-publish` tag/pin/TL/curation suites — the class the book frame explicitly leaves out of frame). **No harness suite in the failing set, no new suite.** Relative to the pre-story state the failing set shrinks by exactly the three harness suites. (AC-5, second half.)
- [x] **Red-first verification — reconstructed live, not taken on faith.** `git stash` is forbidden on this shared checkout, so I extracted the full tree at the test commit (`git archive d9750f89`) into the scratchpad and ran the three harness suites there: **session-start 7/3, harness-lint 27/2, harness-stats 7/1** — byte-for-byte the recorded matrix, and the failing tests are exactly the ones the impl fixes (settings.json existence + only-hooks/tracked + age-trigger; L9 fixture + L12 ghost; book-throughput). `settings.json` confirmed absent at that commit.
- [x] _Playwright not applicable — no browser/UI change._
- [x] _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] **AC-1 (hook ships):** verified three ways — `git ls-files .claude/settings.json` non-empty; `git check-ignore .claude/settings.json` exits 1 (not ignored); the bare-copy archive carries it and session-start passes there. File content is exactly the ratified shape: one top-level `hooks` key, one `SessionStart` entry, one command — `bash "${CLAUDE_PROJECT_DIR:-.}/scripts/session-start.sh"` — nothing personal, no permissions, no secrets. The `.gitignore` un-ignore (`!.claude/settings.json`, `.gitignore:114`) follows the `.claude/*`-not-`.claude/` pattern documented in the `:103–108` comment, which the diff also updates to name the new un-ignore.
- [x] **AC-2 (def-path blind spot):** L12 fires through the standard `violation()` path naming the ghost path (live-proven above); the real repo's def-path set lints clean (every one of the 25 rows in `scripts/harness-def-paths.txt` exists on disk). L10's `[ -e ]` walker filter is intentionally retained at `scripts/harness-lint.sh:243` — it legitimately needs existing paths for `git log` — with a comment at `:256–261` explaining exactly that division of labor.
- [x] **AC-3 (BSD date):** `scripts/lib/date-epoch.sh` verified by reading *and* direct execution on this box: BSD `date -d` hard-fails (`illegal option -- d`), so the GNU branch cannot false-succeed here; the BSD branch (`-j -f '%Y-%m-%d %H:%M:%S' "$1 00:00:00"`) is midnight-normalized so both platforms agree to the day; unparseable and empty inputs return 1 (verified), and all three consumers keep their skip/`?`/`n/a` degradation. GNU behavior is unchanged by construction — the `-d` branch is the identical invocation the old code used, tried first. All three consumers source it script-relative via `BASH_SOURCE` (`harness-lint.sh:42` before its `cd`; `collect-meta.sh:17` at top of the lib; `harness-stats.sh:25` — see non-blocking #1). The age trigger is proven alive on BSD by the new session-start test (2020-01-01 row, count=1, banner with a ≥3-digit age) passing on this machine.
- [x] **AC-4 (deterministic timing):** `grep Date.now` over the suite finds only the two comment lines describing the removal — zero calls. The three rewritten contracts still bind (see walk-through below); nothing was deleted without a deterministic replacement; the suite is 18/0.
- [x] **AC-5 (green everywhere):** dead-port run exit 0 / zero FAIL / 242 skips; plain-run failing set shrank by exactly the three harness suites. Both run by me, recorded above.
- [x] No criterion silently dropped; no behavior beyond the story (file set is exactly the story's surfaces + the two phase artifacts).

## ADR adherence (design records — no ADR for this story)

- [x] **ADR 0006 (hook content):** the shipped hook is "a SessionStart hook invoking the digest script, nothing more" — the ratified decision. The pre-existing shape test (invokes `scripts/session-start.sh`) and the new stricter test (top-level keys ⊆ {hooks, $schema}; hooks == {SessionStart}) both pin it. Provenance confirmed: `d22cd8a4` (the enforcement impl) shipped everything *except* settings.json — exactly row 20's finding.
- [x] **Row 19's sketched fallback** implemented as sketched, upgraded from "in collect-meta.sh" to a shared sibling lib once L9 and stats turned out to need the same converter — the single-source principle ADR 0006 established for `collect-meta.sh` itself, applied consistently.
- [x] **Row 20's fix direction** followed exactly: un-ignore + tracked file + a lint check for ghost def-path rows.
- [x] No new dependencies, no new tooling — pure bash + the existing test harness.

## Concept-graph integrity

- [x] Not touched — no concepts, kinds, routes, or wire formats (story declares this; diff confirms). Handles/firmware/`/summaries` checks n/a.

## Things tests can't catch

- [x] No secrets in the newly tracked `.claude/settings.json` (233 bytes, hooks block only — the exact hazard AC-1 guards).
- [x] No leftover debug logging, no commented-out code.
- [x] **AC-1c leak analysis:** on the pass path the guard's `reject` never fires (`guardTimer` cleared in `finally` before it can) — no unhandled rejection; `lateTimer` also cleared, so the late signer never lands on a shared `global.window`. On the regression path the race surfaces either a wrong-value assert (~4s) or the legible 5s guard error instead of a hang.
- [x] **Contract-binding check on the three rewrites** (a regressed implementation fails each): AC-1a zero-budget call binds "present-signer check precedes deadline check" more strictly than the old `<100ms` bound and cannot flake under load; AC-1b next-macrotask injection under a 4000ms *ceiling* (not a wait) fails any one-shot-check regression; AC-1c's far-too-late (4000ms) signer against a 150ms deadline fails any deadline-ignoring regression. No elapsed-ms math anywhere.
- [x] `date_to_epoch` output-capture semantics correct under `set -u` callers; race conditions n/a (all sequential shell/test code).

## House rules check

- [x] Concept Graph API authority — n/a, respected by omission.
- [x] No new lint/typecheck/build tooling — L12 is a new check inside the *existing* sanctioned harness lint, not new tooling.
- [x] TA-pubkey rule untouched (no identity surfaces in the diff).

## Product-guide adherence

- n/a — no PRD; acceptance-frame book.

## Findings

### Blocking

None.

### Non-blocking

1. **scripts/harness-stats.sh:25** — `date-epoch.sh` is sourced *after* the `cd` at `:22` (harness-lint sources before its cd). Resolution is `BASH_SOURCE`-relative so this only diverges in one degenerate case — invoking the script by a *relative* path from a directory other than the repo root — and that exact case already afflicts the pre-existing `VERDICT_LIB` line directly above (`:24`); the new line is pattern-consistent with its neighbor. Optional: hoist both above the `cd` on a future touch.
2. **ADR 0006 `Implementation notes`** sketches the hook command as `bash scripts/session-start.sh`; the shipped, test-pinned shape is the `${CLAUDE_PROJECT_DIR:-.}`-prefixed robust form. The ratified *decision* ("one command entry running the digest script") is honored; impl notes are non-normative. No ADR edit needed — recorded here for the audit trail.
3. **test/harness-lint.test.js:300** — the "missing CHANGELOG.md" L10 test's fixture now co-fires L12 (its def-paths still lists the deleted changelog). Its assertions (exit 1 + the L10 line) still bind, and the extra L12 line is factually correct for that fixture. Fine as-is.
4. **Test-plan edge-case claim** "L12 adds no fixture churn" missed one fixture (the no-git L10 test, whose def-paths listed its deliberately-deleted changelog). Handled in-flight — see the cross-role ruling below.

### Cross-role ruling — Implementer amendment of a Tester-owned fixture (test/harness-lint.test.js:322–330)

The impl commit amended the "L10 is skipped silently when the tree has no git history" fixture: its def-paths override no longer lists the deleted changelog, so L12 doesn't fire on a file the test deletes *on purpose*. **Ruled acceptable:** (a) data-only — not one assertion line touched (`exit 0`, `doesNotMatch VIOLATION L10` both intact); (b) the test's exact intent is preserved — def_paths remain non-empty (3 rows, all existing in the fixture) and the changelog remains absent, so L10's missing-changelog branch *would still fire if checked*; git-absent silent-skip is still what's proven; (c) the change is commented in place with the story reference and the reason; (d) it was forced by the new invariant interacting with the fixture, not by a red the Implementer wanted green. The line to hold elsewhere: Implementers may reconcile fixture *data* against a new invariant with a comment; weakening an assertion would have been CHANGES_REQUESTED.

### Drive-by ruling — the L11 header line (scripts/harness-lint.sh:25)

The header's check list gains the L11 line story 7 omitted (plus the new L12 line). **Acceptable drive-by:** one accurate line of self-documentation in a file already under edit, explicitly called out in the CHANGELOG row rather than smuggled. Not scope creep.

### L10/CHANGELOG verification (AC note from Planning)

`engineering-team/CHANGELOG.md:45` — row present and accurate (names the un-ignore, the tracked hook file, date-epoch's three consumers, L12, and the L11 header line). `git log -1` over the def-path set confirms `d810025c` is the latest def-path-touching commit and its stat includes the CHANGELOG — L10 satisfied for real, and the real-repo lint run above proves it quiet.

### Harness friction

1. **Pre-existing bash-3.2 crash in `check_L8` on degenerate trees** — `scripts/harness-lint.sh:198`-area: `files[@]: unbound variable` under macOS bash 3.2 + `set -u` when a tree has *no* wiring files at all (hit while building a minimal L12 fixture; the suite's own fixtures and the real repo always carry wiring files, so it never fires there). `W_IDS` got the bash-3.2 empty-array guard; `check_L8`'s `files` array didn't. Breaks the script's "exit 0/1 with VIOLATION lines" contract on degenerate trees. Not this diff's regression — recommend an OPEN.md `meta` row.
2. **The lint's own header list was stale** (L11 missing since story 7) — the harness's self-documentation drifted the same session the budgets check landed. Found and fixed in this diff, CHANGELOG-recorded; no OPEN row needed, noted for the retro's coverage-gap tally.

## Bookkeeping ruling — OPEN.md rows 19 and 20 (requested at dispatch)

**Flip both to `DONE` in this review commit** (Closed 2026-07-06, notes citing story #3 + this review), not at book close. Reasons: (1) OPEN.md's own write discipline is "flip to `DONE` when handled," and this review is the gate that certifies handled; (2) precedent — row 17 flipped at a review gate the day it was handled, with a Closed date; row 18's book-close flip was an artifact of its *fix* landing in the close commit, not a rule that flips wait for close; (3) instrument hygiene — this very story brought the meta-inbox age trigger to life on the operator's machine; leaving two retired rows OPEN has the newly-fixed digest counting them toward the ≥3-count/>30d escalation triggers — self-inflicted noise in the instrument just repaired. The branch carries the flip to staging at merge, same as the code.

## Verdict

**PASS**

## On PASS (same commit)

- [ ] Story `**Status:**` flipped to `Done` in place — **to be executed by the main loop in the review commit** (this review session is scoped to the review file only), together with the rows-19/20 flips ruled above.
- [x] Completion detection run: book `test-hermeticity-ci` checked — **not complete, no close offer.** Frame bullets 1 (feed hermeticity, story 1 Done) and 2 (stack-free `npm test` on Linux *and* macOS — completed by this story: hook ships, dates portable, timing asserts defused, dead-port run exit 0) are now satisfied. Bullets 3 (CI job — no `.github/workflows/test.yml` exists) and 4 (flake-surfacing posture — documented quarantine pattern, green run on the book's own PRs) remain open; they are story 4. The book stays `Open`.
