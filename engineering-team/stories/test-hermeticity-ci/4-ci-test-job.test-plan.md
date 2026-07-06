# Test Plan: Story 4 — The first CI test gate

**Story:** `engineering-team/stories/test-hermeticity-ci/4-ci-test-job.md`
**ADR:** `engineering-team/decisions/test-hermeticity-ci/0001-ci-test-job.md`
**Date:** 2026-07-06

## Level choice

The deliverable is **CI wiring** — a `.github/workflows/test.yml` YAML file and an `OPERATIONS.md` section — not runtime code. There is nothing to execute in-process, so the tests are **source contracts** over the raw YAML and markdown, exactly the shape the repo's existing sentinel suites use (e.g. `test/admin-tools-dashboard-panel.test.js`, `test/live-feed-feed-page.test.js`). No YAML parser dependency is added (JS-without-build, no `js-yaml`); checks are tolerant whitespace-normalized regex reads of the raw text. New suite: `test/ci-test-job.test.js`, registered at the four `test/test.js` anchors.

**AC-5 is procedural, not automated.** A test suite cannot assert the result of a GitHub Actions run. AC-5 (the gate runs green on this book's own PR) is a manual at-close gate, pinned in Verification below.

## Coverage map

| Criterion | Test(s) | Pins |
|---|---|---|
| AC-1 (clean-runner install + gate, on PRs to staging/main, prod Node) | `W1` job/ubuntu, `W2` pull_request→[staging,main] & not push, `W3` checkout@v4 fetch-depth 0, `W4` setup-node@v4 node 22 + npm cache, `W5` `npm ci` then `npm test` ordered, `W6` SCARF_ANALYTICS false & no global `--ignore-scripts` | ADR Decision table + Impl notes |
| AC-2 (no retry; skips visible) | `W8` no playwright / `--retries` / retry|rerun action; the visible-SKIP half is inherited — the gate runs the story-2 runner whose `Total skipped:` line already prints (asserted by the `stack-free-npm-test` suite), so re-asserting here would duplicate; noted, not re-tested | ADR: retries none, structurally |
| AC-3 (bounded, cancel) | `W7` timeout-minutes 15 + concurrency cancel-in-progress true | ADR Decision table |
| AC-4 (OPERATIONS.md doc) | `D1` runs/excludes-e2e, `D2` no-retry policy + waiver pattern, `D3` required-not-taken (scoped to the CI section, not the pre-existing §4 branch-protection prose), `D4` Last-updated header present with the section | ADR Impl notes |
| supply chain | `W9` only `actions/checkout` + `actions/setup-node` used (no unpinned third-party actions) | ADR Impl notes |
| AC-5 (live green proof) | **procedural** — see Verification | story AC-5 |

## Edge cases

- [x] **Vacuous-green guard (D3):** "required"/"ruleset" already appear in OPERATIONS.md §4 (branch protection). D3 slices the CI-gate section (heading → next `## `) and asserts *within it*, so it cannot pass on pre-existing prose. Verified: D3 is RED now even though those words exist elsewhere in the file.
- [x] **File absence is legible:** `safeRead` + a `workflow()` guard makes every W* fail "`.github/workflows/test.yml` does not exist yet…", never a require/parse crash (story-1 sentinel pattern).
- [x] **No-push assertion (W2):** guards against the ADR's rejected Option C — a `push:` trigger would duplicate minutes and race deploys.
- [x] **Install-script posture (W6):** asserts *both* directions — scarf suppressed AND scripts not globally disabled (a naive `--ignore-scripts` would break lmdb/msgpackr prebuilds).
- [x] **Retry breadth (W8):** bans the Playwright path, `--retries`, the words retry/rerun, and named third-party retry actions — the flake-surfacing posture is structural.

## Test infrastructure

- New suite `test/ci-test-job.test.js`; registered in `test/test.js` at all four anchors (require, run(), summary line, `overallOk` term) and added to the `totalSkipped` aggregate array (the story-2 completeness invariant — every result var must be present, else silent undercount). No stack, no network, no new deps.

## How to run

```
node -e "require('./test/ci-test-job.test.js').run().then(r=>console.log(JSON.stringify(r)))"
npm test
```

## Verification

Confirmed RED 2026-07-06 at commit `5cf3d1eb` (workflow + OPERATIONS section absent), all failures on legible absent-contract messages, no parse/require errors:

```
ci-test-job:  {"pass":0,"fail":13}   — W1–W9 (workflow absent), D1–D4 (OPERATIONS section absent)
```

Touching `test/test.js` did not disturb the neighbours: `harness-lint 29/0`, `harness-stats 8/0`, `session-start 10/0`; `node -c test/test.js` clean.

**Post-implementation (automated):** `ci-test-job` suite `{pass:13,fail:0}`; the dead-port full `npm test` stays exit 0 on macOS with the new suite green.

**AC-5 (procedural, at book close — NOT automatable here):** when this book's branch opens its PR to `staging`, the new `test / stack-free` check must appear on the PR and complete **green** before the book is closed. The Reviewer/operator records the run URL in the close audit. This is the gate's first live proof — the book that built it. Until that PR exists, AC-5 is legitimately unverifiable in-tree; the plan marks it OPEN, not passed.
