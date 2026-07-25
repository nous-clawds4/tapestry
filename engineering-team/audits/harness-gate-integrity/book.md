# Book of Work: Harness Gate-Integrity & Lint Robustness

**Slug:** harness-gate-integrity
**Status:** Open
**Opened:** 2026-07-25

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Operator ask (2026-07-25, at the `/whats-open` meta-escalation triage): *address "harness story A" — the gate-integrity + lint-robustness cluster — all six items as one story.* The cluster is OPEN.md rows #43, #58, #46, #22, #21 (with #55 noted N/A on staging).

The load-bearing defect: **the harness's own aggregate gate does not gate.** The exit expression in the test runner is severed by a stray semicolon, so nine registered suites' failures are silently ignored by the exit code (#43) — `npm test`/CI can report PASS while a real regression fails. The batch fixes that and four robustness/honesty gaps in the same self-checking machinery, and — critically — adds the regression tests that would have caught each, so the class becomes self-detecting rather than fixed one-instance-at-a-time.

**Design constraint (carried from the parent `harness-self-improvement` epic):** no new lesson surfaces / no new tooling. Every fix *extends* existing harness machinery (the aggregate runner, the per-suite summary, the `harness-lint` invariant set). Anything that would add a parallel ledger or a new gate technology is out of frame.

All six items were verified LIVE on staging before the book opened (investigation workflow, 2026-07-25) — exact line numbers, fixes, risks, and cross-item ordering captured in the story.

### Acceptance frame
- [ ] **The aggregate gate actually gates every registered suite.** A failure planted in any one of the nine currently-non-gating suites flips Overall to FAIL and the exit code to non-zero (today: exit 0). Proven for at least one re-attached suite and one of the two never-wired suites.
- [ ] **The gate is self-defending.** A registered suite left un-wired into the aggregate gate is flagged mechanically by a harness self-check — so the class of #43 cannot silently recur.
- [ ] **The per-suite summary is honest.** A suite result with a real failure plus a skip prints FAIL (skips noted), never SKIP; a purely-skipped suite still prints SKIP.
- [ ] **The ADR `## Consequences` section is enforced.** A `decisions/**` ADR missing the template-required section is flagged by the harness invariant check; the tree checks clean on landing (both existing offenders resolved).
- [ ] **The CI-ordering invariant is robust to prose.** A comment naming a build command before the workflow's steps does not false-fail the install-before-gate check, which still catches a genuine mis-ordering.
- [ ] **The invariant checker survives an empty tree.** A repo tree with zero wiring/link-doc files does not crash the checker under macOS system bash (3.2).
- [ ] **The harness stays green; ships on harness-infra cadence.** Full harness runs Overall PASS / exit 0 on staging with no suite newly failing; the change is NOT part of the prod-held feature bundle.
- [ ] **Each defect carries a regression test that would have caught it.** The five fixes each land with a test that fails on the pre-fix behavior.

## Epics in this book
- `harness-gate-integrity` — story #1 (`gate-integrity-and-lint-robustness`).

## Provenance
- **Mode:** Acceptance-frame
- **Investigation:** workflow `wf_0c836c19-53d` (2026-07-25) — six read-only agents verified all items live on staging.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/harness-gate-integrity/audit.md`
- Product feedback: `engineering-team/audits/harness-gate-integrity/prd-seed.md`
