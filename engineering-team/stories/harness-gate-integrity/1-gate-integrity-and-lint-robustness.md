# Story 1: Gate-integrity & lint robustness

**Status:** Approved
**Created:** 2026-07-25
**Type:** Bug + Refactor (batch)

## Background
The harness's own self-checking machinery has five verified defects (OPEN.md rows #43, #58, #46, #22, #21), all confirmed live on staging at the 2026-07-25 meta-escalation triage.

The most serious is a correctness bug: the aggregate exit expression in the test runner is **severed by a stray semicolon**, so **nine registered suites' pass/fail never affects the exit code**. The gate that is supposed to protect every other story's tests currently cannot fail on their behalf — a green `npm test`/CI run can hide a real regression in any of those nine suites.

The other four are honesty/robustness gaps in the same machinery: (a) the per-suite summary can print SKIP over a suite that actually failed; (b) the ADR template's required `## Consequences` section is unenforced even though the build-audit debt roll-up harvests it; (c) the CI-ordering check reads the whole workflow including comment prose; (d) the invariant checker crashes on a zero-wiring-file tree under macOS system bash.

**Who is affected:** every engineer and every Direction/CI run that trusts a green harness.

**The frame's teeth:** each defect ships with the regression test that would have caught it — most importantly a self-assertion that makes the #43 *class* self-detecting, so this is fixed at the class level, not just this instance.

## User-facing description
As a maintainer who relies on the harness to catch regressions, I want the aggregate gate to actually fail whenever any registered suite fails — and the surrounding self-checks to be honest and robust — so that a green harness genuinely means green, and this class of gate-integrity bug becomes self-detecting instead of recurring.

## Acceptance criteria
Testable from the outside — "outside" here is the harness's own observable behavior (exit code, printed verdict, invariant-check output).

- [ ] **AC1 — gate re-attach (#43).** Given a deliberately-failing assertion planted in any one of the nine currently-non-gating suites, when the aggregate runner runs, then Overall reads FAIL and the process exits non-zero. Proven for at least one of the seven re-attached suites **and** one of the two suites that were never wired into the gate. *(Pre-fix: exit 0.)*
- [ ] **AC2 — anti-recurrence self-assertion (#43).** Given a registered suite whose result is not wired into the aggregate gate, when the harness self-check runs, then it reports a violation naming the un-gated suite. *(This is the mechanism that would have caught #43 at authoring time; it makes the class self-detecting.)*
- [ ] **AC3 — summary honesty (#58).** Given a suite result with at least one real failure and at least one skip, the printed per-suite summary reads FAIL (with the skipped count noted), never SKIP; given a purely-skipped suite, the summary still reads SKIP.
- [ ] **AC4 — ADR-section invariant (#46).** Given an ADR under `decisions/` missing the template-required `## Consequences` section, the harness invariant check flags it (citing the missing section); given every ADR carries the section (or a cited waiver), the check passes clean — including resolving the two current offenders so the tree is clean on landing.
- [ ] **AC5 — CI-ordering robustness (#22).** Given the CI workflow contains a comment naming a build command before its steps, the ordering invariant still verifies install-before-gate without a false failure; and it still fails if the actual steps run the gate before install.
- [ ] **AC6 — empty-tree robustness (#21).** Given a repository tree with zero wiring/link-doc files, the invariant checker completes under macOS system bash (3.2) without an "unbound variable" crash.
- [ ] **AC7 — no regression, correct cadence.** Given the whole change on staging, the full harness runs Overall PASS / exit 0 with no suite newly failing; the change ships on harness-infra cadence and is **not** part of the prod-held feature bundle.

## Concepts touched
None — harness/test infrastructure only; no concept-graph handles involved.

## Out of scope
- **#55 (contextScopedPins)** — feat/tags-only; grep is zero-hit on staging, so it contributes zero diff here. Noted and deliberately excluded (the note travels with feat/tags).
- **The `totalSkipped` skip-accounting drift** — the aggregate skip tally omits ~27 suites (including the two from #43); informational only (the gate never consults `.skipped`), a separate concern.
- **Other meta-sweep clusters** (#16, #28, #29, #40, #41, …) — separate proposed harness stories from the same triage.
- **Flipping any CI check to "required"** — that is `test-hermeticity-ci`'s deferred scope.
- Any product/runtime code, firmware, or concept change.

## Open questions
Both resolved at the planning gate (operator delegated the calls):
1. **#46 stub disposition — RESOLVED: backfill.** One offender is a deliberate stub ADR (superseded). Backfill a one-line `## Consequences` (e.g. "None — superseded by #23 / ADR 0020; see History") rather than carry a standing waiver; backfill genuine Consequences into the other offender. Exact wording is an Architecture/Implementation detail.
2. **AC2 in scope — RESOLVED: yes.** The anti-recurrence self-assertion is included as core scope; without it we fix the instance but not the class.

## Linked artifacts
- Book: `engineering-team/audits/harness-gate-integrity/book.md`
- Investigation: workflow `wf_0c836c19-53d` (2026-07-25) — per-item live verification, exact locations, fixes, cross-item ordering.
- ADR: `engineering-team/decisions/harness-gate-integrity/0001-gate-integrity-and-lint-robustness.md` (two invariant-placement decisions — #46 → new `harness-lint` L13 [active-only, heading-presence, one offender backfilled]; AC2 → strengthen G5, no unification; the other four items mechanical)
- Test plan: `engineering-team/stories/harness-gate-integrity/1-gate-integrity-and-lint-robustness.test-plan.md` (7 ACs → G5/G6/G7 in stack-free-npm-test, L13 ×2 + L8/#21 in harness-lint, W5b in ci-test-job; RED-confirmed + post-fix satisfiability simulated)
- Review: (filled in after Review phase)
