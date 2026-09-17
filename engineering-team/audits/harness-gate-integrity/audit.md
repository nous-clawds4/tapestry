# Build Audit: Harness Gate-Integrity & Lint Robustness

**Book:** `engineering-team/audits/harness-gate-integrity/book.md`
**Date:** 2026-07-25
**Branch / commit range:** `origin/staging..feat/harness-gate-integrity` (70d38ddd story · 8576fb74 adr · cadad8d3 test · 0f598192 impl · 97b22247 review)
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high — all 8 frame bullets satisfied; independent Phase-5 audit (OPEN.md #80b) re-ran every gate; the sole full-gate failure was a pre-existing environmental flake (OPEN.md #75), not this change.

> As-built record for a bounded harness-infrastructure book. The "product" here is the harness's own self-checking machinery; "users" are engineers and Direction/CI runs that trust a green harness.

## 1. What shipped

- **The aggregate test gate now gates every registered suite.** The `overallOk` exit expression in `test/test.js` was severed by a stray `;`, orphaning 9 registered suites from the exit code; it now ANDs all 142 `await <suite>.run()` results. — `stories/harness-gate-integrity/1-gate-integrity-and-lint-robustness.md` (#43)
- **The gate is self-defending.** `test/stack-free-npm-test.test.js` G5 (strengthened) + G6 (new) assert every suite result gates *inside* the captured `overallOk` expression — so a future un-wired suite fails the harness. — (#43 AC2)
- **The per-suite summary no longer masks failures.** 24 summary lines that branched on `.skipped` alone (printing SKIP over a real FAIL) now use the guarded ternary + note the skipped count. — (#58)
- **ADRs are checked for `## Consequences`.** New `harness-lint` invariant `check_L13` (active ADRs only) flags an ADR missing the section the close-book §5 debt roll-up harvests. — (#46)
- **The CI-ordering invariant is robust to comment prose.** `test/ci-test-job.test.js` W5 scopes its `npm ci`-before-`npm test` check to the `steps:` region. — (#22)
- **The invariant checker survives an empty tree.** `check_L8`'s file-list loop is length-guarded against the bash-3.2 `set -u` empty-array crash. — (#21)

## 2. Epics & stories rolled up

### Epic: `harness-gate-integrity`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 gate-integrity-and-lint-robustness | All five defects (#43/#58/#46/#22/#21) fixed with regression tests; #55 excluded (N/A on staging) | Done | `reviews/harness-gate-integrity/1-gate-integrity-and-lint-robustness.md` (PASS) |

## 3. As-built inventory (from the diff)

- **User-facing:** none (no product UI/endpoint/CLI). Harness/test-infra only.
- **Domain:** no concepts, no schema, no firmware. **Firmware reinstall: no.**
- **Contracts / surfaces changed:**
  - `test/test.js` — `overallOk` chain re-attached (`;`→` &&`) + 2 never-wired terms added (`noteTrustedListResult`, `applicabilityRepublishResult`); 15 stale "severed terminator" comments removed; 24 summary lines rewritten to good-form. Net: all 142 suites gate; summaries honest.
  - `scripts/harness-lint.sh` — new `check_L13` (adr-consequences, active-only, fail-tier, in run block + catalog comment); `check_L8` length-guarded. (L-count now L1–L13.)
  - `test/stack-free-npm-test.test.js` — G5 strengthened (enumerate `.run()` results, membership vs comment-stripped `chain[1]`); G6 (behavioral eval of the real expression) + G7 (summary honesty) added; `overallOkExpr()` helper.
  - `test/harness-lint.test.js` — L13 fixtures (fires / active-only scope) + L8 empty-tree fixture (bash-3.2).
  - `test/ci-test-job.test.js` — `ciBeforeTest()` helper + W5 scoped + W5b proof.
  - `engineering-team/decisions/task-queue-scheduler/0023-*.md` — `## Consequences` backfilled (the one active offender L13 flagged).
  - `engineering-team/CHANGELOG.md` — one row (L10, since `harness-lint.sh` is a def-path).

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "resolving the two current offenders" (AC4, planning gate) | Only the **one active** offender backfilled; the retired `tag-event-inspector/0001` (under `done/`) left as frozen history | interpretation | ADR 0001 Decision 1A: `check_L13` skips `done/` per the `check_reviews`/`check_L2` precedent, so only the active offender is in scope; operator ratified scope A at the ADR gate | none (invariant enforces go-forward; frozen history untouched) | — |
| 2 | Story Open-Q #1 example: backfill stub as "None — superseded by #23 / ADR 0020" | Stub `0023` backfilled with an **accurate** Consequences (it is a fast-tracked audit stub, **not** superseded) | interpretation / corrected error | Impl read the file: the "superseded by ADR 0020" phrasing actually belongs to task-queue *story-22*'s review waiver, not ADR 0023; independent review confirmed the corrected wording is truthful and link targets resolve | none | see §7 (process note) |
| 3 | AC7: full harness Overall PASS / exit 0 | PASS achieved **quiesced**; the un-quiesced run failed only on `relationship-primitives H8` | constraint-discovered (environmental) | OPEN.md #75 drift flake, occurrence 6 — suite untouched by this change, already gated pre-change, passes 23/0 with `strfry-router` quiesced; disposition accepted per #75 occurrence-5 precedent | none | §7 → OPEN.md #75 |

**Undocumented work:** none — every hunk maps to the story/ADR/test-plan. The 15 comment removals are within #43's scope (the comments asserted a "severed" state the fix eliminates).

## 5. Quality state at close

- **Test gate:** `node test/test.js` → **Overall PASS / exit 0** (2026-07-25, `strfry-router` quiesced per OPEN.md #75; router restarted after). The un-quiesced run was Overall FAIL solely on `relationship-primitives H8` (env flake, §4 #3). Fast gates independently re-run by the Reviewer: `stack-free-npm-test` 7/0 · `harness-lint.test.js` 32/0 · `ci-test-job` 14/0 · `bash scripts/harness-lint.sh` clean (0 violations) · `node --check test/test.js` OK.
- **Known open issues:** none introduced. The gate is now *stricter* — any future regression in the 9 newly-gated suites will fail the build (the intended consequence).
- **Debt logged (ADR `Consequences → new debt`):** ADR 0001 records one accepted historical gap — `tag-event-inspector/0001` (retired) has no `## Consequences` by design (out of L13's `done/`-skip scope). The `totalSkipped` skip-accounting drift (~27 suites) stays out of scope (informational; the gate never reads `.skipped`).

## 6. Carry-forward register

- [ ] **G7 single-line hardening** — the `.skipped`-alone detector only catches the end-of-line bad form; a hypothetical single-line `xResult.skipped ? …` would evade it (shipped code has zero such). Optional. (review non-blocking #1 → OPEN.md #100)
- [ ] **`totalSkipped` skip-accounting drift** (~27 suites omitted) — out of scope this book; informational only. (story Out of scope)
- [ ] **Retire this book + epic to `done/`** once the product team ingests this audit + seed (deferred per workflow 6; OPEN.md row).
- [ ] **Ship to staging** — `/cycle-staging` (harness-infra cadence, not prod-held); the code + this close ride one PR.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| `relationship-primitives H8` drift flake recurred (occurrence 6): impl-phase full gate, scan 6010257→6010259; passed 23/0 quiesced | impl-phase gate run; §4 #3 | **OPEN.md #75** (occurrence-6 appended) |
| Test-design robustness: a source-contract regex over `test/test.js` (`overallOk =([\s\S]*?);`) is truncated by a `;` **inside a chain comment** — the Tester caught it (G5 inflated to 27 false-orphans, G6 threw) and fixed it by stripping `//` comments before capture (`overallOkExpr()`) | Test Design (this book) | **declined** — one-off, fixed in-flight; the helper is the durable guard; no systemic harness change warranted |
| Planning-gate resolved Open-Q #1 carried an inaccurate example ("superseded by ADR 0020") that, if followed literally, would have produced a wrong stub Consequences | review (this book) §4 #2 | **declined** — the Implementer read the file and wrote the truthful version; the harness worked as designed (a resolved Open-Q is guidance, not a spec); no fix warranted |

**Ports to the other flow (Direction ↔ human-gated)?** The #75 flake and the quiesce remedy port to Direction mode (same gate tooling) — already tracked on #75. The two declined items are book-local.

**`harness-stats.sh` at retro:** `harness-gate-integrity` = 5 phase commits (story/adr/test/impl/review — full cycle coverage). Totals: story 149 / adr 131 / test 131 / impl 137 / review 170.
