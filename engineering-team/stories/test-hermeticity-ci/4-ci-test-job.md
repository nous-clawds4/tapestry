# Story 4: The first CI test gate — every PR to staging/main proves the stack-free suite green

**Status:** Approved
**Created:** 2026-07-06
**Type:** Feature

## Background

OPEN.md row 13(c) / harness-review finding R-E3, anchored by the `test-hermeticity-ci` book (frame bullets 3 + 4). This is the book's payoff story: stories 1–3 made `npm test` an honest, portable, stack-free gate; nothing yet *runs* it. Every `.github/workflows/` job today is an SSH deploy triggered by a push — "npm test must be clean" (workflow 4, the reviewer's Gate) is enforced only by whoever remembers to run it. The harness review called this the single biggest gap between "self-checking" and "self-checking without a human running anything."

**Binding reviewer constraints (vcavallo, PR #337, carried in the book's design constraints):**
1. **Stack-free suites only.** e2e/Playwright has a heavy dependency setup and pollutes relay state (hundreds of test tags on a dev relay); it and the hosted-throwaway-relay question belong to a later phase. The gate this story adds runs exactly what stories 1–3 made runnable on a bare runner.
2. **Surface flakes, never normalize them.** No auto-retry, no rerun-on-red, no "compare against a known-failing baseline" (the failing set churns against half-alive stacks — measured). The stack-free class has a zero-recorded-flake history, so any red is signal by construction; the gate must keep that property, and what didn't run (skips) must be visible, not silent.

Who is affected: every PR author to staging/main (a red check instead of a post-merge surprise); reviewers (the Gate becomes a platform fact they can see on the PR, not a claim they re-verify by hand); the harness itself (its "npm test must be clean" prose finally has an enforcement surface); future books (a trustworthy green baseline to build on).

## User-facing description

As a contributor opening a PR to staging or main, I want an automatic check that installs from lockfile and runs the full stack-free test gate on a machine with nothing pre-provisioned, so that "did the tests pass?" is answered on the PR itself before anything merges or deploys.

As the operator, I want that check strict and honest — one run, exit code is the verdict, skips counted in the open — so that a green check means exactly what it says and a red one is never waved off as "probably a flake."

## Acceptance criteria

- [ ] Given any pull request targeting `staging` or `main`, when it is opened or updated, then a test check runs on a clean hosted runner (no Docker stack, nothing pre-installed beyond the platform image), installs dependencies from the lockfile, runs the full test gate, and reports pass/fail on the PR — matching production's Node major version.
- [ ] Given the gate's flake-surfacing posture, then no retry or rerun-on-failure mechanism exists anywhere in the job or the runner it invokes — a failure fails the check on the first run — and the job's log shows the per-suite SKIP lines and the aggregate `Total skipped:` count from the runner's summary.
- [ ] Given a runaway or hung run, then the job is bounded by a hard timeout, and a newer push to the same PR cancels the older in-flight run (no queue pileup, no zombie minutes).
- [ ] Given OPERATIONS.md (the deploy/CI reference), then it documents the test gate: what runs and what is deliberately excluded (e2e/live suites — deferred phase), the no-retry policy and why, the cited-waiver quarantine pattern (file created only when a real stack-free flake is first observed — its very existence is the surfaced-flake signal), and that making the check *required* in the GitHub rulesets is a deliberate, separate operator decision not taken by this story.
- [ ] Given this book's own branch, when its PR to staging opens, then the new check runs and completes green on it before the book closes — the gate's first live proof is the book that built it.

## Concepts touched

None — no concept-graph entities, event kinds, API routes, or wire formats. This story adds a CI surface and its documentation. (Stack not required; the gate's whole point is running without one.)

## Out of scope

- e2e/Playwright in CI and the hosted-throwaway-relay question (reviewer-deferred phase; the book's out-of-frame list).
- Making the check **required** in branch rulesets (post-book operator decision, documented not taken) and any staging direct-push policy change.
- A ui-build job, Docker-build checks, or any second CI job (future candidates; this story ships exactly one gate).
- Creating the flake-waiver file (deliberately does not exist at close — first real flake creates it).
- Stabilizing the live `*-publish` class (book out-of-frame).

## Open questions

None for Planning — the trigger shape, version pinning, caching, install-script posture (one dependency phones home; native prebuilds need scripts), and the git-history depth the harness lint wants are Architecture's decisions, informed by the book recon's CI dossier.

## Linked artifacts

- ADR: `engineering-team/decisions/test-hermeticity-ci/0001-ci-test-job.md` (Accepted, 2026-07-06)
- Test plan: `engineering-team/stories/test-hermeticity-ci/4-ci-test-job.test-plan.md`
- Review: (filled in after Review phase)
