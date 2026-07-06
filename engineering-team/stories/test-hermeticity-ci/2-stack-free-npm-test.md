# Story 2: `npm test` is honest without the stack — guarded live suites, counted skips

**Status:** Approved
**Created:** 2026-07-05
**Type:** Bug

## Background

OPEN.md row 13(b), anchored by the `test-hermeticity-ci` book (frame bullet 2, first half; `engineering-team/audits/test-hermeticity-ci/book.md`).

With dependencies installed but no local stack running, twelve live-API contract suites fail with `fetch failed` — a deterministic consequence of the environment that *reads* like breakage — and `npm test` exits 1. That makes the harness's own "npm test must be clean" gate (workflow 4, reviewer gate) unevaluable in exactly the environments that need it most: fresh checkouts, remote sessions, and the CI runner story 4 will add. The absurdity is that twelve sibling `*-publish` suites already solved this: they probe the control panel's reachability with a bounded timeout and report a whole-suite SKIP with a visible count when it's absent. The twelve contract suites simply never got the guard. Book recon (2026-07-05) confirmed the split: the "~12 live-API failures" in row 13 match the unguarded twelve exactly, and the guarded twelve skip cleanly.

The affected suites: `profile-tags`, `tag-detail`, `tag-detail-write`, `tag-index`, `authored-tagging`, `profile-tag-polish`, `pin-a-tag`, `tl-publication-from-pins`, `most-pinned-tag-index`, `tag-detail-curated-view-and-pin-polish`, `restore-historical-data-and-fix-tl-author-filter`, `nip51-list-export-from-pins`.

**Binding reviewer constraint (vcavallo, PR #337, carried in the book's design constraints):** skips must be *visible and counted*, never silent — the gate surfaces what didn't run; it must not quietly shrink. Silent skip-creep would be worse than the current honest redness.

Who is affected: contributors and CI sessions running `npm test` stack-free (today: unavoidable exit 1); reviewers evaluating the test gate (today: can't distinguish "broken" from "no stack"); story 4's CI job (blocked on this story).

## User-facing description

As a contributor (or CI job) running `npm test` on a machine without the local Docker stack, I want the run to exit 0 with the stack-dependent suites visibly and countably skipped, so that a red run always means something is actually broken.

As a developer with the stack running, I want those same suites to execute exactly as they do today, so that guarding them costs no live coverage.

## Acceptance criteria

- [ ] Given dependencies installed and no local stack reachable, when `npm test` runs, then it exits 0, and each of the twelve suites reports a whole-suite SKIP naming its reason and the number of tests skipped — no `fetch failed` failures, no silent absence.
- [ ] Given the local stack is reachable, when `npm test` runs, then the twelve suites execute their live tests exactly as today — no test removed, no assertion weakened, and the skip path engages only when the stack is genuinely unreachable.
- [ ] Given any suite skipped, when the run's final summary prints, then the per-suite summary line shows SKIP (not PASS) for that suite, and the summary carries an aggregate skipped-tests total across all suites — a reader can see at a glance how much of the gate did not run.
- [ ] Given a stack-free run, when the twelve guards probe for the stack, then each probe is time-bounded (seconds, matching the already-guarded suites' pattern) and the full stack-free `npm test` completes without network stalls or hangs.
- [ ] Given skips are in play, when any test anywhere in the run genuinely fails, then `npm test` still exits 1 — skips must never mask a real failure.

## Concepts touched

None — no concept-graph entities, event kinds, API routes, or wire formats change. This story only changes when test suites *decline to run* and how the runner reports it. (Stack not required to build or verify; the stack-present criterion needs the local stack up once, per AGENTS.md §1 discovery.)

## Out of scope

- **Half-alive environments.** If the control panel answers but deeper services are broken or the graph is empty, the suites run and may fail — that is an honest signal about a real environment (the documented churn class from the book's flake dossier), not something this story hides. The guard distinguishes *absent* from *present*, nothing finer.
- The twelve `*-publish` suites (already guarded) and the two mixed suites with per-test live skips (already honest).
- The three harness-suite failures (BSD-date ×2, hook file) — story 3.
- The CI workflow itself — story 4.
- Stabilizing live-suite nondeterminism (`PROPAGATION_MS`, relay-state isolation, the publish-suite TA hardcode) — on the book's out-of-frame list.

## Open questions

None — the guard pattern, its timeout discipline, and its reporting shape all exist in the repo; this story extends them to the twelve suites that lack them and surfaces the aggregate count.

## Linked artifacts

- ADR: — (Architecture skipped per the ratified book plan; the pattern being extended is the in-repo precedent)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
