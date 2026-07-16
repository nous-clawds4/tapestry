---
name: cycle-full
description: Run the full local → staging → main deploy chain for the tapestry/brainstorm repo. Build locally, smoke-test locally (per cycle-local), push and merge to staging, smoke-test `staging.brainstorm.world`, then on explicit user approval promote to main and smoke-test `tapestry.brainstorm.world`. Use this whenever the user wants the entire deploy chain in one command — they say things like "ship the full thing," "all the way to prod," "local through to production." Halts on failure at any stage. Pauses between staging and prod for explicit confirmation; production is a shared system.
---

# Cycle: full

The complete chain — local verification, push to staging, staging deploy and smoke test, then (with explicit user approval) promotion to main and production smoke test. Halt-on-failure at every stage. Don't proceed past staging without user confirmation.

## When to use

- User wants to ship a change end-to-end in one command.
- User says "ship the full thing," "all the way to prod," "everything," "the whole chain."
- The change has been written but not yet committed (or just committed and ready to ship).

## When NOT to use

- The user wants to stop at a specific stage (use the individual `/cycle-*` skills instead).
- The change is already on staging and only needs prod promotion → use `/cycle-prod`.
- Anything where the user is uncertain about prod readiness — the individual cycles give finer-grained pause points.

## Critical: production gate

There is a hard pause between staging-clean and prod-merge. The user must explicitly authorize the prod merge with phrases like "yes promote it," "ship to prod," "go ahead." Auto mode does NOT skip this gate. The cost of a confirming question is low; the cost of an unauthorized prod deploy is high.

## Procedure

This skill orchestrates `/cycle-local` → `/cycle-staging` → (pause for approval) → `/cycle-prod`. Each individual skill defines the work for its stage; this skill manages the chain and the gates.

### Stage 1: Local

Follow [`.claude/skills/cycle-local/SKILL.md`](../cycle-local/SKILL.md):

1. Determine what changed (`git diff --name-only HEAD` or against the last commit).
2. Build / docker cp / restart as appropriate for the change type.
3. Smoke test on the local base URL per cycle-local (it owns that constant) and [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) (skip Tier 1).
4. Brief report.

If anything fails at this stage, **stop**. Surface the failure and let the user decide whether to fix or abandon.

If the working tree has uncommitted changes after the local verification, commit them. Use a clear commit message (don't blindly use the slash command's name). The standard project format is described in `git log --oneline -5` — match the prevailing tone.

### Stage 2: Staging

Follow [`.claude/skills/cycle-staging/SKILL.md`](../cycle-staging/SKILL.md):

1. Verify preconditions (clean tree, on a feature branch).
2. Push the branch with `-u origin <branch>`.
3. Open the PR (`gh pr create --repo nous-clawds4/tapestry --base staging`).
4. Merge it (`gh pr merge … --merge`).
5. Watch `deploy-staging.yml` to completion.
6. Stability poll on `staging.brainstorm.world`.
7. Smoke test (all five tiers).
8. Report.

If staging fails (deploy red, smoke test reveals regression, console errors in Chrome), **halt**. Surface to the user — they may want to fix and retry, or revert. Don't proceed to prod.

### Stage 3 — gate: explicit prod approval

After the staging report, **stop and ask the user**:

> Staging looks clean. Promote to main?

Wait for an unambiguous yes. Phrases like "yes," "go ahead," "ship it," "promote it" are clear. Phrases like "looks good" or "interesting" are not — confirm.

Auto mode does not bypass this gate. The system-prompt rule about "modifies shared or production systems still needs explicit user confirmation" applies here.

### Stage 4: Prod

Follow [`.claude/skills/cycle-prod/SKILL.md`](../cycle-prod/SKILL.md):

1. Confirm `git log origin/main..origin/staging` shows the expected bundle.
2. Open the `staging → main` promotion PR.
3. Merge it (after the gate above).
4. Watch `deploy-tapestry.yml`.
5. Stability poll on `tapestry.brainstorm.world`.
6. Smoke test.
7. Report.

### Stage 5: Final report

A consolidated report covering all three stages. Format:

```
## Full cycle report

**Local:** ✅ <built / deployed / smoke-tested>
**Staging:** ✅ PR #N merged at <time>, deploy <link> in <duration>, smoke-test clean
**Prod:**    ✅ PR #M merged at <time>, deploy <link> in <duration>, smoke-test clean

**What's now live on production:** <one-line summary>
**Caveats:** <noted limits, e.g., one-time forced sign-out for users due to session-store change>
```

Be honest about gaps (e.g., "Chrome extension wasn't connected during prod check; I only have curl-level verification of the prod tier"). Tight: the user is reading this after watching the chain unfold.

## Halt-on-failure semantics

Any of these stops the chain:

- Build failure (npm run build fails, docker cp fails)
- Brainstorm process won't start cleanly after a server-side change
- Local smoke test reveals a regression
- `git push` fails (auth, conflicts)
- `gh pr create` fails or the PR is in a non-mergeable state
- `gh pr merge` returns a state that isn't `"MERGED"`
- `gh run watch` reports a failed deploy
- Stability poll exceeds 90 attempts (3 minutes) without reaching streak 3
- Smoke test on staging or prod returns persistent 5xx (after the post-stability retry)
- Console errors in Chrome on a touched page
- Critical regression spotted (e.g., a smoke-test endpoint that previously worked is now broken)

When halted, surface the specific failure. Don't continue silently. Don't auto-revert or auto-fix without user direction.

## Why a single `/cycle-full` instead of three separate calls

Three individual calls work too — and they're often the better choice when the user wants to inspect each stage. `/cycle-full` is for when:

- The change is well-understood and confidence is high.
- The user wants the chain run as a unit.
- You're not expecting any of the stages to surface surprises.

When in doubt, use the individual cycles instead — the explicit pause points let the user catch and correct issues earlier.

## Reference

- [.claude/skills/cycle-local/SKILL.md](../cycle-local/SKILL.md)
- [.claude/skills/cycle-staging/SKILL.md](../cycle-staging/SKILL.md)
- [.claude/skills/cycle-prod/SKILL.md](../cycle-prod/SKILL.md)
- [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md)
- [OPERATIONS.md](../../../OPERATIONS.md) — deploy mechanics and gotchas
