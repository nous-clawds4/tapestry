---
name: cycle-staging
description: Push a committed feature branch, open a PR to `staging`, merge it, watch the staging deploy CI/CD, smoke-test `https://staging.brainstorm.world`, report. Use this whenever the user wants to ship a committed change to staging — they say things like "ship it to staging," "push the PR," "deploy this," "let's get this on staging." Stops after staging verification, awaits approval before promoting to prod.
---

# Cycle: staging

Push the current feature branch to origin, open a PR against `staging`, merge it, watch `deploy-staging.yml`, smoke-test on `staging.brainstorm.world`, report. Stops there — promotion to main is `/cycle-prod`.

## When to use

- User has committed a change locally on a feature branch and wants to ship it to staging.
- User says "deploy to staging," "open the PR," "ship it."
- Previous in the session: a `git commit` happened on a feature branch (typically named `feat/*`, `fix/*`, or `chore/*`).

## When NOT to use

- Nothing committed yet → run `/cycle-local` first or commit manually.
- The change is already merged to staging and the user wants to promote to prod → use `/cycle-prod`.
- The user wants the full chain → use `/cycle-full`.

## Critical gotcha: gh CLI defaults to upstream

This local checkout has two remotes:
- `origin` → `nous-clawds4/tapestry` (the actual deploy target)
- `upstream` → `Pretty-Good-Freedom-Tech/brainstorm` (the original project)

`gh` resolves the repo to the upstream by default, so commands silently target the wrong repo. **Every `gh` command in this skill must include `--repo nous-clawds4/tapestry`.** No exceptions.

## Procedure

### 1. Verify preconditions

```bash
git status                                    # working tree clean
git branch --show-current                     # on a feature branch, not staging/main
git log @{upstream}.. --oneline 2>/dev/null   # commits to push (if branch tracks origin)
```

If the working tree isn't clean, surface and stop. If the branch is already on `staging` or `main`, stop — that's not the flow.

### 2. Push branch

```bash
git push -u origin <branch-name>
```

If push fails (auth, conflicts, etc.), surface and stop.

### 3. Open PR

```bash
gh pr create --repo nous-clawds4/tapestry \
  --base staging \
  --head <branch-name> \
  --title "<title>" \
  --body "$(cat <<'EOF'
## Summary

<one-paragraph what + why>

## Changes

<bullet list of touched files or sections>

## Test plan

- [ ] After merge: deploy-staging.yml runs.
- [ ] Smoke test on staging.brainstorm.world.
- [ ] <PR-specific verifications>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

PR title: short, imperative-ish, under 70 chars. Body: structured per the template above. The PR description should accurately reflect what changed and what to verify, not just restate the title.

### 4. Merge

```bash
gh pr merge <PR#> --repo nous-clawds4/tapestry --merge
```

Project convention is plain merge commits (not squash) — the staging history shows individual commits-in-merge-commits as a clear ladder. `gh pr merge` may exit with code 1 even on success when there are warnings; verify the merge happened with:

```bash
gh pr view <PR#> --repo nous-clawds4/tapestry --json state,mergedAt,mergeCommit
```

`state` should be `"MERGED"` and `mergedAt` should be present.

### 5. Locate and watch the deploy

```bash
sleep 3
gh run list --repo nous-clawds4/tapestry --workflow=deploy-staging.yml --limit 1 --json databaseId,status,headSha
# Pick the run with the matching mergeCommit SHA. Then:
gh run watch <run-id> --repo nous-clawds4/tapestry --exit-status
```

Typical staging deploy is ~80s on warm Docker layer cache, ~2m+ when `package.json` or other invalidating files change. If the run fails, surface the failure and stop.

### 6. Smoke test

Run the smoke test as defined in [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) with `H=https://staging.brainstorm.world`.

All five tiers apply for staging:
- Tier 1 stability poll (3 consecutive 200s, then 4–5s settle)
- Tier 2 sanity reachability
- Tier 3 PR-specific (depends on the change)
- Tier 4 Chrome visual (when UI changed)
- Tier 5 regression sweep

For Tier 4, navigate the MCP tab to `https://staging.brainstorm.world/<page>` and confirm the rendered state. The user's signed-in cookies for `brainstorm.world` and `staging.brainstorm.world` are typically shared with the MCP tab via the same Chrome profile — so authenticated routes may render either fully or with the auth gate depending on session state. Don't assume; read what's there.

### 7. Report

Use the standard report template (see [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) "Reporting" section). Include:

- The PR URL and merge timestamp
- The deploy run ID, link, and duration
- The stability poll attempts/streak
- Tier results
- Any caveats or noted gaps

### 8. Pause

After reporting, stop. **Do not promote to main without explicit user approval.** The standard prompt: "Promote #<PR#> to main?"

## Error handling

- **PR creation fails with "no commits between branches":** the feature branch is already merged or has no diff. Stop.
- **`mergeStateStatus` is `BLOCKED` or `BEHIND`:** rebase the branch onto current `origin/staging` and retry. If conflicts, surface them — don't auto-resolve.
- **Deploy run shows failure:** read the workflow log (`gh run view <id> --repo nous-clawds4/tapestry --log-failed`), surface the relevant error, and stop. Don't merge a revert without the user's say-so.
- **Stability poll never reaches streak 3 within 90×2s = 3min:** something is genuinely broken. Surface the last few HTTP codes and stop.
- **Post-stability 502s in Tier 2:** retry once before treating as failure (per OPERATIONS §8.5 post-stability flicker note). Then if still failing, surface.

## Reference

- [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) — canonical smoke test
- [OPERATIONS.md §1 "Deploy targets"](../../../OPERATIONS.md) — staging branch and workflow
- [OPERATIONS.md §8 "Operational gotchas"](../../../OPERATIONS.md) — gh CLI gotcha, post-deploy 502, etc.
