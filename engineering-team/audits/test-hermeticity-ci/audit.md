# Build Audit: Test Hermeticity + CI

**Book:** `engineering-team/audits/test-hermeticity-ci/book.md`
**Date:** 2026-07-06
**Branch / commit range:** `35d6a16e^..96a4c9bd` on `feat/test-hermeticity-ci` (18 commits; shipped to `staging` via PR #338, merge commit `11004374`, deploy run 28821210899 green)
**Provenance:** Acceptance-frame
**Confidence:** high

> As-built record of OPEN.md row 13 / harness-review R-E3: `npm test` made hermetic, portable, and honest without the local stack, then placed in CI. Four stories through the full five-phase harness (story 4 with a live Architecture phase + ADR 0001); four PASS reviews, every gate operator-ratified in-session. The gate's first live run is the book's own PR — green.

## 1. What shipped

- **The live-feed read path is hermetic and its degrade path is legible** — the TA-pubkey read is a fifth injectable dependency of `src/api/feed/feedReadPath.js` (lazy, runtime-resolved default; house TA rule intact), and the relay-set degrade catch logs its cause. Bare-checkout B9 no longer fails misleadingly; B10/B11 stop passing vacuously — `stories/test-hermeticity-ci/1-feed-hermeticity.md`.
- **`npm test` exits 0 without the stack, visibly and countably** — the 12 unguarded live-API contract suites gained the `controlPanelReachable()` whole-suite skip guard; `test/test.js` prints an aggregate `Total skipped:` line — `2-stack-free-npm-test.md`.
- **The harness suites are portable** — the SessionStart hook actually ships (`.claude/settings.json` tracked), date math works on GNU + BSD (`scripts/lib/date-epoch.sh`), lint L12 flags def-path rows with no file on disk, and the last wall-clock test assertions are deterministic — `3-harness-suites-portable.md`.
- **The first CI test gate exists** — `.github/workflows/test.yml` runs `npm ci && npm test` on every PR to staging/main; OPERATIONS.md §15 documents it — `4-ci-test-job.md`.

## 2. Epics & stories rolled up

### Epic: `test-hermeticity-ci`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 feed-hermeticity | 5th injectable dep (`getTaPubkey`) + legible degrade; B9 hermetic, B10/B11 no longer vacuous | Done | `reviews/test-hermeticity-ci/1-feed-hermeticity.md` (PASS) |
| #2 stack-free-npm-test | skip guards on the 12 live suites + `Total skipped:` aggregate | Done | `…/2-stack-free-npm-test.md` (PASS) |
| #3 harness-suites-portable | hook ships (row 20), GNU/BSD date lib (row 19), lint L12, timing asserts defused | Done | `…/3-harness-suites-portable.md` (PASS) |
| #4 ci-test-job | `.github/workflows/test.yml` + OPERATIONS §15 + ADR 0001 | Done | `…/4-ci-test-job.md` (PASS) |

## 3. As-built inventory

- **User-facing / runtime:** exactly one runtime surface changed — `src/api/feed/feedReadPath.js` (story 1): `getTaPubkey` added to the injectable seam (four → five boundaries), `resolveGeneralPurposeRelays(runCypher, getTaPubkey)` guards the TA read and the set query separately with one legible `console.error` degrade line each, null-TA short-circuits to fallback. **Behavior-preserving on the production path** — verified live on staging: `/api/feed` → `200`, `relaySource:"set"` (the runtime seam resolved staging's own TA pubkey, distinct from local-dev's, and hit Neo4j for real set members). No other `src/`, `ui/`, or API-route change.
- **CI / wiring:** `.github/workflows/test.yml` (new — `pull_request`→[staging,main] job `stack-free`, Node 22, `fetch-depth: 0`, `npm ci` + `npm test`, `SCARF_ANALYTICS=false`, 15m timeout, concurrency-cancel, no retries, two official actions); `.claude/settings.json` (new — tracked SessionStart digest hook); `.gitignore` (`!.claude/settings.json` un-ignore).
- **Harness scripts:** `scripts/lib/date-epoch.sh` (new — GNU/BSD `date`→epoch), consumed by `scripts/lib/collect-meta.sh`, `scripts/harness-lint.sh` (L9 + new L12), `scripts/harness-stats.sh`.
- **Tests:** new `test/ci-test-job.test.js` (13) + `test/stack-free-npm-test.test.js` (5); guards added to 12 live suites; new H-block in `test/live-feed-read-path.test.js`; new checks in `test/harness-lint.test.js` (L12) + `test/session-start.test.js` (tracked-hook + age-trigger); `test/login-failure-and-tag-collapse.test.js` timing asserts rewritten; `test/test.js` runner (skip aggregate + 2 new suite registrations).
- **Docs / process:** `OPERATIONS.md` §15 + ToC + §3 cross-ref + Last-updated header; `engineering-team/CHANGELOG.md` row (story 3, def-path change); `engineering-team/decisions/test-hermeticity-ci/0001-ci-test-job.md` (ADR); `_intake.md` entry (cross-module clone follow-up).
- **Domain:** none — no concept-graph entities, event kinds, wire formats, or firmware reinstalls. The stack is probed, never required.

## 4. Deviations from intent

| # | Specified (frame bullet) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | b1: live-feed suite "passes 23/23" | Suite is **30 tests**; bare-copy = 32 pass / 0 fail / **5 skipped** (fixtures needing `nostr-tools`); B9 passes, does not skip | interpretation | book recon undercounted; AC-1 amended with a dated inline note at Test Design (review 1 friction) | none — hermeticity goal met and exceeded | — (number reconciled here; frame text left as the historical record) |
| 2 | b2: "npm test exits 0 stack-free" | Exits 0 on **both** macOS and Linux; on macOS it required also fixing the 3 harness suites (rows 19/20), which the frame folded into story 3 | intentional-change | the frame anticipated this (story 3 = "portable"); rows 19+20 retired at review 3 | none | — |
| 3 | b3: CI gate | One `pull_request` job running **plain `npm test`** (not a `test:ci` subset) | interpretation | ADR 0001: a subset reintroduces the drift/skip-creep split stories 1–2 removed | none — the gate is the same command everyone runs | — |
| 4 | b4: "the waiver file … does not exist at close" | Correct — no waiver file created; the pattern is documented in OPERATIONS §15 | as-specified | reviewer constraint honored | none | first real stack-free flake creates it (G2's one transient self-skip, review 2 NB1, is the candidate class) |
| 5 | b3: "green on this book's own PR before close" (AC-5) | Proven: CI run [28821124841](https://github.com/nous-clawds4/tapestry/actions/runs/28821124841) — Node 22, Overall PASS, Total skipped 242, **harness suites green on Linux too** | as-specified | procedural at-close gate (a suite can't assert a CI run); pinned in the test plan, executed at ship | none — this is the gate working | required-check flip is a **post-book operator decision** (OPERATIONS §15), deliberately not taken |

**Undocumented work:** none — every diff hunk in the book range rides a story commit with story/ADR provenance (46 files walked: 19 test, 17 engineering-team records, 4 scripts → story 3, 1 src → story 1, `.github`+OPERATIONS → story 4, `.claude`+`.gitignore` → story 3).

## 5. Quality state at close

- **Test gate at close:** dead-port `BRAINSTORM_BASE_URL=http://127.0.0.1:9 npm test` (macOS) → **Overall PASS**, `Total skipped: 242`, zero FAIL — the book's own payoff (stack-free green is now real on both platforms). The pre-book overall-FAIL baseline is gone for the stack-free case; a plain `npm test` (stack up) still shows the ~11 live/half-alive `*-publish` churn suites, which are out of this book's frame.
- **Live proof:** the CI gate ran green on PR #338; `/api/feed` on staging confirms the story-1 refactor is behavior-preserving in production shape.
- **Known open issues:** OPEN.md rows 21 (`check_L8` bash-3.2 empty-array crash on degenerate trees) + 22 (`ci-test-job` W5 comment-sensitivity) — both low-severity, opened this book. The live `*-publish` nondeterminism (fixed `PROPAGATION_MS`, relay-state contamination, dev-TA hardcode) remains out of frame.
- **Debt logged by ADRs:** ADR 0001 — the check is advisory until the operator flips the ruleset; e2e/throwaway-relay is a deferred phase; a ui-build job would be a separate ADR.

## 6. Carry-forward register

- [ ] **Required-check flip** — make `test / stack-free` a required check in the GitHub rulesets once it proves stable across real PRs (ADR 0001; OPERATIONS §15). A staging required-check also implies closing the direct-push path there.
- [ ] **e2e/Playwright in CI + hosted throwaway relay** — the reviewer-deferred later phase (heavy deps, relay-state pollution). The whole "how does CI get a clean relay?" question lives here.
- [ ] **Cross-module clones of the silent-catch + non-injected-TA read** — `src/api/_shared/relaySource.js:66–86` and `userNotesReadPath.js:116` carry story-1's pre-fix pattern (review 1 NB3; `_intake.md` 2026-07-05). Same hazard class; a mechanical port of story 1's seam.
- [ ] **Stabilize the live `*-publish` class** — poll-instead-of-sleep for `PROPAGATION_MS`, per-suite strfry isolation, de-hardcode the dev TA pubkey in `profile-tags-publish.test.js:24` — the prerequisite for ever admitting live suites to CI.
- [ ] **OPEN.md rows 21 + 22** — low-severity harness robustness; ride the next lint / ci-test-job touch.

## 7. Process findings (harness)

*Second live run of the workflow-6 step-7 retro (first was the harness-self-improvement book's own close). Stats at retro time (`scripts/harness-stats.sh`): **461 phase commits · 85 decided reviews · 2% kick-back-final, churn 2 · books 9 closed / 2 open (→ 1 open after this close) · cycle median 0d (same-day) · 81 of 99 stories slug-matched · this book: 17 phase commits, 4/4 stories PASS-first, 0 book kick-backs, opened→close 1d.** Each finding below has exactly one terminal state — no fourth state.*

| Finding | Source | Terminal state |
|---|---|---|
| Book recon's "23/23" test-count was empirically wrong (30 tests, 5 fixture-bound) | review 1 Harness friction | **declined** — self-corrected in-cycle via the dated AC-1 amendment + test plan; the number is reconciled in audit §4-1. No new convention warranted for a one-off recon miscount. |
| `ci-test-job` W5's ordering check reads workflow comment prose (a future comment naming `npm test` before `steps:` would false-fail) | review 4 Harness friction | **OPEN.md row 22** — scope W5 to the `steps:` region on the next touch of that suite. |
| `check_L8` crashes under bash-3.2 `set -u` on trees with zero wiring files (`files[@]` unbound) | review 3 Harness friction #1 | **OPEN.md row 21** — one-line `${files[@]+…}` guard, same class as the guards already on `violation()`/`def_paths`. |
| The lint's own header check-list was stale (L11 omitted since story 7) — the harness's self-documentation drifted | review 3 Harness friction #2 | **ratified commit `d810025c`** — L11 + L12 header lines added in story 3's impl, CHANGELOG-recorded. |
| Cross-role fixture amendment: the Implementer edited a Tester-owned L10 no-git fixture because L12 rightly flagged its ghost row | review 3 ruling | **declined (no change)** — ruled acceptable at review: data-only, assertions untouched, intent preserved, commented. Weakening an assertion would have been CHANGES_REQUESTED. |
| G2 transiently self-skipped once inside the live aggregate while the panel was up (the flake-surfacing posture's first live instance) | review 2 NB1 | **declined (no change)** — visible + counted, precedent's 2s bound, cannot affect stack-free CI. Recurrence → the book's bullet-4 first-surfaced-flake (create the cited waiver file per OPERATIONS §15), never a retry. |
| AC-5 (a live CI-run result) can't be asserted by a suite — deferred to an at-close procedural gate pinned in the test plan | review 4 / test plan | **declined (no change)** — correct reuse of the harness-self-improvement AC-7 deferred-verification pattern; the live run happened at ship and is cited (§4-5). Pattern validated, no amendment needed. |

**Ports to the other flow?** The CI gate, the skip-guard pattern, `date-epoch.sh`, and lint L12 all live in shared surfaces (`.github/`, `test/`, `scripts/`) that both the human-gated and Direction flows inherit; nothing here needs a Direction-only mirror. The retro machinery itself now has two clean live runs — the no-fourth-state rule held both times.
