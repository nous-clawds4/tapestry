# Review: Story 1 — Gate-integrity & lint robustness

**Reviewer:** Claude (acting as Reviewer — independent auditor; the main session implemented this, per OPEN.md #80b)
**Date:** 2026-07-25
**Diff:** `git diff origin/staging...HEAD` (feat/harness-gate-integrity; commits 8576fb74 adr, cadad8d3 test, 0f598192 impl)

## Quality gates (run by reviewer, not trusted)

- [x] `node --check test/test.js` — **PASS** (chain repair is syntactically valid; the removed 15 "LIVE chain … severed" comments left a valid single `const overallOk = … ;` expression).
- [x] `node -e "require('./test/stack-free-npm-test.test.js').run()…"` — **PASS 7/0** (G1–G7, incl. strengthened G5 + new G6/G7).
- [x] `node -e "require('./test/harness-lint.test.js').run()…"` — **PASS 32/0** (incl. new L13, L13-scope-A, L8/#21).
- [x] `node -e "require('./test/ci-test-job.test.js').run()…"` — **PASS 14/0** (incl. new W5b + rescoped W5).
- [x] `bash scripts/harness-lint.sh` — **clean, exit 0** (0 violations; L13 offender backfilled, retired ADR does not fire).
- [x] Full `node test/test.js` — not re-run by reviewer (24-min, per task). Main session confirmed Overall PASS / exit 0 quiesced. The single unquiesced failure is relationship-primitives H8 (OPEN.md #75 drift flake, occurrence 6, untouched suite, passes 23/0 quiesced) — **accepted** (see AC7).
- [x] `/bin/bash` on the review machine is **3.2.57** — the L8/#21 fixture ran the real crash-repro path here (non-vacuous), so AC6 is genuinely proven, not skipped.
- [ ] _Lint/typecheck/build not configured — skipped._

## Spec adherence (AC-by-AC)

- [x] **AC1 — gate re-attach (#43).** Chain repaired: the stray `;` after `theBrainSurvivesResult.fail === 0` is now ` &&`, re-joining the 7 orphaned dead-block terms (harnessLint…routerStreamTagFilters), and the 2 never-wired terms (`noteTrustedListResult`, `applicabilityRepublishResult`) were added before the terminating `;`. Independent count: **142 `.fail === 0` terms inside the single overallOk expression == 142 declared `await <suite>.run()` results; declared-but-not-gated = []; no duplicates; no stray terminator; `process.exit(overallOk ? 0 : 1)` intact.** G6 proves both a re-attached suite (harnessLintResult) and a never-wired suite (noteTrustedListResult, applicabilityRepublishResult) flip overallOk → false. **SATISFIED.**
- [x] **AC2 — anti-recurrence self-assertion (#43).** G5 strengthened: enumerates every `await <suite>.run()` result and checks each `<var>.fail === 0` against `chain[1]` (the captured, **comment-stripped** overallOk expression via `overallOkExpr()`), not whole-file `src.includes`. Comment-stripping defuses the `;`-inside-a-chain-comment truncation. A future un-gated suite would fail G5. **SATISFIED.**
- [x] **AC3 — summary honesty (#58).** 24 summary lines rewritten to the good-form ternary `(<r>.pass + <r>.fail) === 0 && <r>.skipped ? SKIP : PASS/FAIL(…, N skipped)`. A `{fail≥1, skipped≥1}` result now reads FAIL (skips noted); a purely-skipped suite still reads SKIP. G7 confirms 0 `.skipped`-alone heads. **SATISFIED.**
- [x] **AC4 — ADR-Consequences invariant L13 (#46).** `check_L13()` added: iterates `decisions/*/*.md`, skips `decisions/done/*` (case guard, mirroring check_reviews/check_L2), requires `^##[[:space:]]+Consequences`, fail-tier via `violation()`. Wired into the run block AND the catalog comment. The one active offender (`task-queue-scheduler/0023`) is backfilled; the retired `done/tag-event-inspector/0001` correctly does not fire (both the `done/`-case guard and the 2-level glob depth exclude it). Real repo lints clean. CHANGELOG.md row present (L10 def-path satisfied). **SATISFIED.**
- [x] **AC5 — CI-ordering robustness (#22).** `ciBeforeTest()` slices the flattened haystack to the `steps:` region before the ordering `indexOf`. W5b proves a comment naming a command above `steps:` no longer false-fails, and a genuine gate-before-install within steps still fails. Co-authored in Phase 3 per the ADR exception; the Implementer's Phase-4 diff correctly contains no #22 change. **SATISFIED.**
- [x] **AC6 — empty-tree bash-3.2 guard (#21).** `check_L8` guarded with `[ "${#files[@]}" -eq 0 ] && return 0` — the repo's length-guard precedent (violation():67 / whats-open.sh:166), **not** the `${arr[@]+…}` form. The loop is the function's only work, so the early return skips nothing. Verified non-vacuously on bash 3.2.57 (no "unbound variable"). **SATISFIED.**
- [x] **AC7 — no regression, correct cadence.** Four affected suites pass on my own runs; harness-lint clean; full-gate Overall PASS/exit 0 quiesced. Ships on harness-infra cadence (harness/test infra only, no product/runtime/firmware/concept code) — book.md frame confirms it is NOT part of the prod-held feature bundle. **SATISFIED.**
- [x] **#55 (N/A on staging).** Zero code diff; `contextScopedPins` has zero code hits — only doc-prose exclusion notes in the epic/story. Correctly excluded. **CONFIRMED.**

## ADR adherence
- [x] Files match ADR lane mapping. Decision 1 (L13, active-only heading-presence, one offender backfilled) implemented as specified. Decision 2 (strengthen G5, no unification onto harness-lint; AC2 needs no new L-number) implemented as specified.
- [x] No new tooling / no new lesson surface (honors the parent `harness-self-improvement` constraint + CLAUDE.md JS-without-build).
- [x] `LEGACY_*` constants / ADR 0015 untouched (not in scope; no removal to reject).

## Concept-graph integrity
- [x] N/A — harness/test infrastructure only; no concept handles, no schema, no firmware. ADR + book confirm "Firmware reinstall: No."

## Scope discipline
- [x] Implementer commit (0f598192) touched only `test/test.js` (the runner — its SUT per the ADR lane map), `scripts/harness-lint.sh`, `decisions/task-queue-scheduler/0023`, `CHANGELOG.md`. It touched **no** `*.test.js` suite (Tester's lane). Confirmed.
- [x] Tester commit (cadad8d3) touched only the three `*.test.js` suites + the test-plan + a 2-line story cross-reference (filling the "Test plan:" linked-artifact line — legitimate for that phase).
- [x] `totalSkipped` array NOT touched (explicitly out of scope). Confirmed.
- [x] No scope creep.

## Things tests can't catch
- [x] No secrets, no debug logging (the one `console.log` in the L8/#21 test is intentional diagnostic output), no commented-out code left behind (the 15 stale "severed" comments were removed as part of the fix), no TODO/FIXME in added lines.
- [x] Disclosed deviation reviewed — see Findings.

## Findings

### Blocking
None.

### Non-blocking
1. **test/stack-free-npm-test.test.js (G7, ~:245)** — G7's `.skipped`-alone detector matches only the end-of-line bad form (`^…const \w+Line = \w+Result.skipped$`). The actual codebase shape (the multi-line ternary head) is fully covered, but a hypothetical single-line `const xLine = xResult.skipped ? 'SKIP' : …` would evade it. Optional hardening: also flag `\b\w+Result\.skipped\s*\?` that lacks a preceding `(pass+fail)===0 &&` guard. Not a gap for this story — the shipped code has zero such lines.
2. **engineering-team/decisions/task-queue-scheduler/0023 (Consequences)** — disclosed deviation, and the **right call**. The story's resolved Open-question #1 suggested "None — superseded by #23 / ADR 0020". Reading ADR 0023, that is factually wrong: 0023 is a *fast-tracked stub* (History section), not superseded by ADR 0020 — the "superseded by #23 / ADR 0020" phrasing actually belongs to task-queue-scheduler **story-22's** review waiver (visible in the harness-lint output). The Implementer correctly declined to transcribe the inaccurate suggestion and wrote a truthful stub Consequences (verified against the ADR body: ADR 0013 amendment / BIBLE §24 / test sentinel — all link targets exist; the ADR 0013 anchor resolves). The story granted wording latitude ("exact wording is an Implementation detail").

### Harness friction *(→ OPEN.md meta row candidate)*
1. The story's resolved Open-question #1 example wording ("None — superseded by #23 / ADR 0020; see History") mis-attributed ADR 0023's disposition — it cross-wired task-queue-scheduler *story-22*'s review-waiver phrasing onto ADR 0023 (a fast-tracked stub, not a supersession). Harmless here because the Implementer caught it, but the planning-gate example was inaccurate. Minor.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/harness-gate-integrity/1-gate-integrity-and-lint-robustness.md`).
- [x] Completion detection: this is the sole story in the `harness-gate-integrity` book/epic; with story #1 Done, the book now appears complete against its acceptance frame. **Offering** to close the book (not auto-running `/close-book`) — the operator's "yes" is the trigger.
