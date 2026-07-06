# Review: Story 4 — The first CI test gate

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-06
**Diff:** `git diff 7c448c63..HEAD` (impl commits `f8dd4baa` tests, `8c3698a4` impl)

## Quality gates (run by reviewer, not trusted)

- [x] **ci-test-job suite (standalone)** — **PASS** `{"pass":13,"fail":0}`. All W1–W9 + D1–D4 green.
- [x] **Dead-port full `npm test`** (`BRAINSTORM_BASE_URL=http://127.0.0.1:9`) — **EXIT 0**, `Overall: PASS`, `ci-test-job suite: PASS (13 passed, 0 failed)` in the aggregate, `Total skipped: 242`, zero `✗` markers, zero real FAIL verdicts (the one `grep FAIL` hit is the descriptive name of a *passing* test, `L7 ... offering FAIL as a verdict`).
- [x] **`bash scripts/harness-lint.sh` (real repo)** — **exit 0**, `harness-lint: clean (0 violations)`. Only expected pre-existing waivers/INFO lines.
  - **L8:** ToC anchor `#15-ci-test-gate-prs-to-stagingmain` and the §3 cross-ref both resolve — heading `## 15. CI test gate (PRs to staging/main)` slugifies (GitHub rules) to exactly `15-ci-test-gate-prs-to-stagingmain`. (Note: L8 strips anchors and only validates the *file* portion of a link; the slug match here was verified by hand, not by L8.)
  - **L9:** OPERATIONS.md `**Last updated:** 2026-07-06` == git last-change date `2026-07-06` (0d lag). Does not lag the content change.
  - **L10:** latest def-path-touching commit is `d810025c` (story #3, which carries its own CHANGELOG row), NOT `8c3698a4`. `8c3698a4` touches zero def-paths → no L10 fire, no CHANGELOG row required. Correct.
- [x] **Red-first confidence** — `git diff f8dd4baa..HEAD -- test/ci-test-job.test.js` is **EMPTY** (byte-identical to the red-baseline version). The recorded `{0,13}` RED baseline is trustworthy; the Implementer did **not** weaken the gate. The only change between red and green is the two source artifacts (`test.yml`, `OPERATIONS.md`) plus the workflow header comment.
- [x] _Lint not configured — skipped (harness-lint above is the harness self-check, not code lint)._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence
- [x] Every automatable acceptance criterion has a passing test. AC-1→W1–W6; AC-2→W8 (+inherited SKIP visibility from the story-2 runner); AC-3→W7; AC-4→D1–D4; supply-chain→W9.
- [x] No criterion silently dropped. **AC-5 (live green PR run) is procedural**, correctly deferred to book close in the test plan's Verification section — marked OPEN, *not* claimed passed.
- [x] No behavior added beyond the story.

## ADR adherence — Decision table cross-check (line by line, against the js-yaml-parsed workflow)
- [x] Trigger `on: pull_request: branches: [staging, main]`; **no `push` key** (Option C rejected) — parsed `on.pull_request.branches = [staging, main]`.
- [x] `runs-on: ubuntu-latest`.
- [x] `actions/checkout@v4` with `fetch-depth: 0`.
- [x] `actions/setup-node@v4` with `node-version: '22'` (parses as string `"22"`) + `cache: npm`.
- [x] `npm ci` **then** `npm test` (steps in order; the SAME command contributors run — no `test:ci` fork).
- [x] `env: SCARF_ANALYTICS: "false"`; **no `--ignore-scripts`** anywhere (prebuilds keep their install scripts).
- [x] `timeout-minutes: 15`.
- [x] `concurrency.group: test-${{ github.head_ref || github.ref }}`, `cancel-in-progress: true`.
- [x] **No retry / rerun / Playwright** anywhere (W8 confirmed on raw source).
- [x] Only the two official actions (`actions/checkout`, `actions/setup-node`) — no third-party actions (W9).
- [x] YAML well-formed: parses cleanly via `js-yaml` (present in node_modules); no tabs; top keys `name/on/concurrency/jobs`.
- [x] Files changed match the ADR Implementation notes exactly: `.github/workflows/test.yml` (new), `OPERATIONS.md` (§15 + ToC + §3 xref + Last-updated). No unauthorized deps.

## Concept-graph integrity
- [x] N/A — story touches no concepts, handles, event kinds, API routes, or wire formats. ADR confirms **no firmware reinstall** required. No new code re-derives from BIBLE.md.

## Things tests can't catch
- [x] **No secrets** in `test.yml` (grep confirmed: no `secrets.`, token, ssh, appleboy). Correct contrast: the five deploy workflows do use `secrets.`; this pre-merge gate must not, and doesn't.
- [x] No debug logging, no commented-out code, no leftover TODOs in the diff.
- [x] Error paths: N/A (declarative YAML + doc prose).
- [x] Concurrency: `cancel-in-progress: true` is the intended race guard (no zombie minutes on rapid pushes).
- [x] Security: workflow is `pull_request`-triggered (not `pull_request_target`) and consumes no secrets, so no fork-PR secret-exfiltration surface.

## House rules check
- [x] Concept Graph API authority: N/A (no concepts).
- [x] No new lint/typecheck/build tooling. `npm ci`/`npm test`/`actions/setup-node` are the existing gate; nothing new introduced.
- [x] JS-without-build honored: the test suite is a source-contract regex/structural reader; no `js-yaml` dependency added to the *test* path.

## Findings

### Blocking
_None._

### Non-blocking
1. **`test/ci-test-job.test.js:99–102` (W5) — comment-sensitivity.** W5 asserts ordering via `flat(src).indexOf('npm ci') < indexOf('npm test')` over the *entire* flattened workflow, comments included. The Implementer therefore reworded the workflow header comment so the literals `npm ci`/`npm test` don't appear before the run steps (confirmed: lines 1–9 of `test.yml` contain neither literal; the byte-identical test diff proves only the comment moved, not the assertion). This is a legitimate adapt-artifact-to-test move — the ci-before-test *contract* is honored — but a future comment reintroducing "npm test" ahead of the steps would false-fail W5. Recorded as an OPEN.md `meta` row candidate, not a blocker; the assertion could be scoped to the `steps:` block in a later hygiene pass.
2. **`OPERATIONS.md` §3 four/six drift (OPEN.md row 14) — not worsened.** The pre-existing "All four follow the same SSH-action pattern" is stale (there are five deploy workflows + now this test workflow = six files). The Implementer correctly left "All four" untouched (out of scope) and added a *clarifier* — "These are the **deploy** workflows … The one non-deploy workflow is the pull-request **test gate**" (line 90) — which cleanly carves the test gate out of the deploy count. Accurate, in-scope, net-positive. Judged: does not worsen row 14; row 14 remains the owner of the "four"→correct-count reconciliation.

### Harness friction
1. **W5 reads workflow comment prose** (see Non-blocking #1) — the Tester's ordering assertion is comment-sensitive, and the Implementer had to reword the header comment to satisfy it. Worth an OPEN.md `meta` row so a future editor knows the workflow comment cannot mention "npm test" before the `steps:` block until W5 is scoped to `steps:`.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/test-hermeticity-ci/4-ci-test-job.md`).
- [x] Completion detection run: this is the **last story of the `test-hermeticity-ci` book**. Frame bullets 1–2 delivered by Done stories #1–#3; bullets 3–4 delivered by this story. **All four acceptance-frame bullets are now satisfied MODULO AC-5's live green PR run** — the single procedural item deferred to book close (the gate's first live proof on the book's own PR to staging). The main loop should note AC-5's live-PR proof must land before `/close-book` records confidence; offer to close only after (or while capturing) that run URL.
