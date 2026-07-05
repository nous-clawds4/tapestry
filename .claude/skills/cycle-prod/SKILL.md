---
name: cycle-prod
description: Open a `staging → main` promotion PR, merge it, watch the production deploy CI/CD, smoke-test `https://brainstorm.world`, report. Use this whenever the user wants to promote a verified staging change to production — they say things like "promote to main," "ship to prod," "let's release this," "promote to production." Modifies a shared production system; requires user confirmation before merging.
---

# Cycle: prod

Promote everything that's currently on `staging` but not on `main` to production. Open the `staging → main` PR, merge after explicit user approval, watch `deploy-brainstorm.yml`, smoke-test `brainstorm.world`, report.

## When to use

- A change is on staging, has been smoke-tested clean there, and the user wants it in production.
- User says "promote to main," "ship to prod," "release."
- Previous in the session: a `/cycle-staging` ran clean.

## When NOT to use

- Nothing has been verified on staging yet → run `/cycle-staging` first.
- The user wants the full chain → use `/cycle-full`.

## Critical: explicit confirmation before merging

Production deploy is a shared-system action. The user must explicitly authorize the merge — phrases like "yes," "go ahead," "promote it," "ship it." A request to "promote" the PR is *not* automatic authorization for any future PR; each promotion is its own confirmation.

If you're unsure whether the user has authorized, ASK before merging. The cost of a confirming question is low. The cost of merging a broken or unauthorized change to production is high.

## Procedure

### 1. Confirm what's being promoted

```bash
git fetch origin
git log --oneline origin/main..origin/staging
```

This is the bundle. Read it. State the bundle to the user in the PR description so it's clear what's shipping.

If the diff is empty, surface "main is already at staging — nothing to promote" and stop.

### 2. Open the promotion PR

```bash
gh pr create --repo nous-clawds4/tapestry \
  --base main \
  --head staging \
  --title "Promote staging → main: <short summary>" \
  --body "$(cat <<'EOF'
## Summary

Promotes staging to main after verification on `staging.brainstorm.world`.

## Bundled

- **#XX** — <one-line summary>
- **#YY** — <one-line summary>

## Net production impact

<2-4 sentences on what users will notice, including any one-time disruption like a forced sign-out>

## Verification trail

- Each bundled PR's staging deploy run linked, with duration
- Notable smoke-test findings (e.g., "session persistence verified across two staging deploys")

## Test plan

- [ ] After merge: deploy-brainstorm.yml runs to completion.
- [ ] Smoke test on brainstorm.world.
- [ ] <prod-specific verifications, e.g., specific URL paths, search regression>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Always include `--repo nous-clawds4/tapestry`. Always.

### 3. Wait for explicit user approval

Show the user the PR URL and the bundle. Ask: "Ready to merge to main?" or similar. **Don't merge until the user says yes.** Auto mode does NOT bypass this check — modifying production is explicitly called out as needing confirmation.

### 4. Merge

```bash
gh pr merge <PR#> --repo nous-clawds4/tapestry --merge
sleep 2
gh pr view <PR#> --repo nous-clawds4/tapestry --json state,mergedAt,mergeCommit
```

Verify state is `"MERGED"`.

### 5. Watch the production deploy

```bash
sleep 3
gh run list --repo nous-clawds4/tapestry --workflow=deploy-brainstorm.yml --limit 1 --json databaseId,status,headSha
gh run watch <run-id> --repo nous-clawds4/tapestry --exit-status
```

Typical prod deploy is ~80s warm cache, ~2m+ on first build with new deps. If it fails, surface the failure and consider opening a revert. Do NOT auto-merge a revert; recommend it to the user and let them decide.

### 6. Stability poll + smoke test

Same as the staging cycle, with `H=https://brainstorm.world`. Run all five tiers from [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md):

- Tier 1 stability poll (3 consecutive 200s, 4–5s settle)
- Tier 2 sanity reachability
- Tier 3 PR-specific (verify the bundled changes are live — new endpoint shapes, new bundle strings absent or present, etc.)
- Tier 4 Chrome visual (if any UI changed)
- Tier 5 regression sweep

For Chrome on production, the user's main browsing tab and the MCP-tool tab share cookies when they share a Chrome profile. If the user is signed in via NIP-07 to brainstorm.world, the MCP tab typically inherits the session — but don't assume; read what's actually rendered.

### 7. Report

Use the standard report template. Include:

- Promotion PR URL and merge timestamp
- Deploy run ID, link, and duration
- Stability poll attempts/streak
- Tier results
- Any caveats (e.g., one-time forced sign-out from a session-store change, slow first build because of dep changes, etc.)

End with a status snapshot: what's now live on prod, what's still on staging awaiting promotion, what's open against staging unmerged.

## Error handling

- **Merge state is BLOCKED:** branch protections or required checks — investigate, surface, don't override.
- **Deploy fails:** show the failed step's log, recommend either a revert PR (don't auto-merge) or a forward-fix branch off staging. Wait for user direction.
- **Smoke test reveals a regression:** open a revert PR (`git revert -m 1 <merge-commit>`, branch off main, push, PR back to main). Surface to the user immediately and let them decide whether to merge the revert or forward-fix.
- **Production showing 502 long after the stability poll succeeded:** retry once (post-stability flicker), then if still failing, escalate. Don't silently accept "production is broken."

## Reference

- [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) — canonical smoke test
- [OPERATIONS.md §1 "Deploy targets"](../../../OPERATIONS.md) — main → brainstorm.world flow
- [OPERATIONS.md §8.2 "auto-delete-head-branches deleted staging"](../../../OPERATIONS.md) — historical incident; the protection is now in place but worth knowing
