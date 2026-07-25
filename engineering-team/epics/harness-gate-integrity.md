# Epic: Harness Gate-Integrity & Lint Robustness

**Status:** Done
**Book:** `engineering-team/audits/harness-gate-integrity/book.md` (acceptance-frame)
**Parent lineage:** `harness-self-improvement` (Done) — this epic fixes defects in that epic's own deliverables (the aggregate test runner and `scripts/harness-lint.sh`), rather than adding any new surface.

## What this is

A bounded maintenance batch closing five verified defects in the harness's own self-checking machinery, surfaced at the 2026-07-25 meta-escalation triage as "harness story A" (OPEN.md rows #43, #58, #46, #22, #21).

The load-bearing one is a correctness bug: the aggregate exit expression in the test runner is **severed by a stray semicolon**, so nine registered suites' pass/fail never reaches the exit code — `npm test`/CI can report PASS while a real regression fails. The other four are honesty/robustness gaps in the same machinery: a per-suite summary that can print SKIP over a real failure; an ADR template section that nothing enforces even though the build-audit debt roll-up harvests it; a CI-ordering check that reads comment prose; and an invariant checker that crashes on an empty tree under old bash.

The frame's teeth: each defect ships with the regression test that would have caught it — most importantly a self-assertion that a future un-gated suite is flagged mechanically, so the #43 *class* becomes self-detecting.

**Design constraint (carried from the parent epic):** no new lesson surfaces / no new tooling. Every fix *extends* existing harness machinery — the aggregate runner, the per-suite summary, and the existing `harness-lint` invariant set (ADR `harness-self-improvement/0001`). Nothing adds a parallel ledger or a new gate technology.

## Stories

`stories/harness-gate-integrity/`:

1. **gate-integrity-and-lint-robustness** — the whole batch as one story (#43 gate re-attach + anti-recurrence self-assertion, #58 summary honesty, #46 ADR-`Consequences` invariant, #22 CI-ordering robustness, #21 empty-tree guard). #55 is N/A on staging (contextScopedPins is feat/tags-only), noted and excluded.

## Out of scope (whole epic)

- **The `totalSkipped` skip-accounting drift** — the aggregate skip tally omits ~27 suites; informational only (the gate never consults `.skipped`), a separate concern.
- **Other meta-sweep clusters** (#16, #28, #29, #40, #41, …) — separate proposed harness stories from the same triage.
- **Flipping any CI check to "required"** — belongs to `test-hermeticity-ci`'s deferred scope.
- Any product/runtime code, firmware, or concept change.

## Related

- `harness-self-improvement` (Done) — the epic whose deliverables this batch repairs.
- OPEN.md rows #43, #58, #46, #22, #21 (and #55, noted N/A) — the ledger items this epic closes.
- `engineering-team/decisions/harness-self-improvement/0001-harness-lint.md` — the invariant mechanism #46 extends.
