# Story 3: The harness suites are portable — the hook ships, dates work everywhere, no wall-clock asserts

**Status:** Approved
**Created:** 2026-07-06
**Type:** Bug

## Background

OPEN.md rows 19 and 20, anchored by the `test-hermeticity-ci` book (frame bullet 2, second half). After stories 1–2, exactly three suites still fail in a stack-free run, and all three are the harness's own:

1. **The SessionStart hook never shipped (row 20).** The previous book's enforcement story configured the session-start digest hook in `.claude/settings.json` and registered that path in the harness def-path set — but `.gitignore:109` ignores `.claude/*` with un-ignores only for `skills/`, `commands/`, and `agents/`. The file has zero git history and exists on no checkout; it lived only in the (gone) cloud session where it was verified firing. Consequence: the digest runs nowhere, CLAUDE.md's "auto-runs" claim is prose, and the session-start suite fails its existence assertion in every checkout. The platform convention is that `settings.json` is project-shared (tracked) while `settings.local.json` stays personal (ignored) — the gitignore just predates the hook. The hook's ratified content is recorded in the previous book (ADR 0006; impl commit `d22cd8a4`): a SessionStart hook invoking the digest script, nothing more — permissions and personal state stay in `settings.local.json`.
2. **The lint blind spot that hid it (also row 20).** `harness-lint.sh:242` silently drops def-path rows whose file doesn't exist, so "the harness definition lists a file that isn't there" — precisely row 20's failure — is invisible to the guard whose job is noticing harness drift.
3. **GNU-`date`-only math (row 19).** `harness-lint.sh` L9 (freshness headers), `harness-stats.sh` (book durations), and `scripts/lib/collect-meta.sh` (meta-row ages) all use `date -d`, which BSD/macOS `date` lacks. Effect: one fixture test in each of harness-lint and harness-stats fails on macOS (the team's local machines), and the >30d meta-escalation trigger is dead locally — only the ≥3-count trigger fires.

Plus one latent hazard in the CI subset flagged by the book's flake dossier: `login-failure-and-tag-collapse` asserts wall-clock durations (`<100ms`, `≥120ms`, a 60ms late-injection race) — the stack-free class's only timing-dependent assertions, and exactly the kind that flake on loaded CI runners. The book's constraint is that any CI red must be signal; a load-sensitive assert undermines that before the CI job even exists.

Who is affected: every fresh checkout and remote session (no digest, a red session-start suite); macOS contributors (permanently red harness suites, so "npm test must be clean" is unevaluable locally); the meta-escalation loop (age trigger dead on the machines where the operator actually works); story 4's CI gate (a latent flake would poison its zero-flake record).

**Note for later phases:** `.claude/settings.json`, `harness-lint.sh`, `harness-stats.sh`, and `scripts/lib` are harness def paths — the implementation commit must carry an `engineering-team/CHANGELOG.md` row (lint L10). Test posture is unusual: three of the failing tests already exist (the current harness-suite reds are the red baseline); new failing tests are needed only for the def-path-existence check and the timing-assert defusal.

## User-facing description

As a contributor opening a fresh checkout on any machine, I want the session-start digest to actually run and the harness suites to pass, so that the harness's enforcement claims are true everywhere, not just on the machine that wrote them.

As the operator, I want the meta-row age trigger alive on my own laptop, so that lessons older than the threshold resurface without me remembering to check.

## Acceptance criteria

- [ ] Given a fresh copy of the repo (clone or archive — not this working tree), then `.claude/settings.json` exists as a tracked file carrying the SessionStart digest hook (and nothing personal), and the session-start suite passes completely there. (Retires OPEN.md row 20.)
- [ ] Given a def-path row naming a file that doesn't exist on disk, when `harness-lint.sh` runs, then it reports that row with the missing path named — never silently skips it — and the real repo's def-path set lints clean (every listed path exists).
- [ ] Given a machine with BSD `date` (macOS, no GNU coreutils), when harness-lint L9, harness-stats durations, and collect-meta ages compute, then they produce real values — L9 can fire on a stale header, durations render instead of `?`, and a meta row older than the threshold raises the age trigger — and the harness-lint and harness-stats suites pass completely on that machine. (Retires OPEN.md row 19; Linux behavior unchanged.)
- [ ] Given the `login-failure-and-tag-collapse` suite, then it contains no wall-clock-duration assertions — its behavior contracts are asserted deterministically — and the suite still passes with its coverage intact (no assertion simply deleted without a deterministic replacement).
- [ ] Given this macOS machine after implementation, when `npm test` runs with the control panel unreachable (the story-2 dead-port procedure), then it exits 0 with zero FAIL lines (skips remain visible and counted); and a plain `npm test`'s failing set shrinks by exactly the three harness suites.

## Concepts touched

None — no concept-graph entities, event kinds, API routes, or wire formats. This story changes harness tooling, one gitignore rule, one tracked config file, and test determinism. (Stack not required.)

## Out of scope

- The CI workflow itself — story 4 (this story is what makes its gate green on both platforms).
- Any hook beyond the ratified SessionStart digest (no new hooks, no permission rules in the tracked file; `settings.local.json` stays personal and ignored).
- The stray provenance comment in `restore-historical…` noted by review #2 (cosmetic; rides any future touch).
- OPERATIONS/ROADMAP content refreshes (rows 14–15) and everything on the book's out-of-frame list.

## Open questions

None — the hook content is ratified (previous book, ADR 0006), the date-fallback direction is sketched in row 19, and the timing-defusal approach is the Tester's call at Test Design.

## Linked artifacts

- ADR: — (Architecture skipped per the ratified book plan; design records: row 19's sketched fallback, row 20's fix direction, ADR 0006 for the hook content)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
