---
name: cycle-local
description: Build, deploy, and smoke-test code changes against the local Docker stack (`http://localhost:7778`) for the tapestry/brainstorm repo. Use this whenever the user wants to test a change locally before committing or pushing — they say things like "test it locally," "run it on 8080," "smoke-test this," or "see if it works before I push." Stops at local verification. Does NOT commit, push, open a PR, or touch staging or production.
---

# Cycle: local

Build a code change, deploy it into the running local Docker container, smoke-test on `http://localhost:7778`, and report. Stops there — no commit, no PR, no remote anything.

## When to use

- User wants to verify a change works before committing it.
- User says "test locally," "smoke-test on :8080" (a legacy synonym from the old port setup — the stack serves :7778 now), "before I push, let's see…"
- The previous step in the session was an edit to `ui/src/**`, `src/**`, or `docker/**`.

## When NOT to use

- The change is committed and the user wants to push it → use `/cycle-staging`.
- The user wants the full local→staging→prod chain → use `/cycle-full`.
- Plain documentation changes that don't need a runtime check (docs/*.md, BIBLE.md, OPERATIONS.md, etc.) — verify by reading; no rebuild needed.

## Procedure

The exact deploy mechanics depend on what changed. Determine the diff first (`git diff --name-only HEAD` or against the last commit), then pick the steps that apply.

### 1. UI changes (`ui/src/**`)

```bash
WT=$(git rev-parse --show-toplevel)   # works in any checkout or worktree, on any machine
npm --prefix $WT/ui run build 2>&1 | tail -3
docker cp $WT/dist/. tapestry:/usr/local/lib/node_modules/brainstorm/dist/
```

Vite outputs to `<repo-root>/dist/` (the parent of `ui/`), per the `outDir: '../dist'` setting in `ui/vite.config.js`. The container serves UI from `/usr/local/lib/node_modules/brainstorm/dist/`. Express serves static files from disk on each request, so no restart needed for UI-only changes.

### 2. Server changes (`src/**`, `bin/**`, `docker/entrypoint.sh`)

```bash
docker cp $WT/<changed-file> tapestry:/usr/local/lib/node_modules/brainstorm/<same-relative-path>
docker exec tapestry supervisorctl restart brainstorm
```

For multiple changed files, copy each. Watch the supervisor log briefly after restart: `docker exec tapestry tail -20 /var/log/supervisor/brainstorm.log` — confirm the process started cleanly. If it didn't, surface the error to the user and stop.

### 3. New npm dependency

```bash
docker exec tapestry bash -c 'cd /usr/local/lib/node_modules/brainstorm && npm install <package> --no-audit --no-fund'
docker exec tapestry supervisorctl restart brainstorm
```

The full `docker compose up -d --build` rebuild path is heavier — skip it for local iteration.

### 4. Smoke test

Run the smoke test as defined in [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md), but with two adjustments for local:

- **Skip Tier 1** (stability poll). Local doesn't have the same post-deploy 502 flicker — the supervisorctl restart is fast and predictable.
- **Use `http://localhost:7778` as the base URL.**

Tier 2 sanity, Tier 3 PR-specific, Tier 4 Chrome (if UI changed), Tier 5 regression all apply.

The known-active pubkey for parameter-bearing tests is `04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9`. The local Neo4j may be empty or sparsely populated, so endpoints like `/api/get-user-data` may return `{success:false, message:"No profile data found"}` for many pubkeys — that's a data state, not a code regression. The strfry-backed `/api/get-user-counts` is more likely to return real data because local strfry is typically populated.

For Chrome visual: if the worktree's MCP-tool tab isn't on `localhost:7778`, navigate it there explicitly before reading page text or console.

## Report

Report tight. State what was built, what was deployed, what the smoke test found, and any caveats. Format:

```
## Local cycle report

**Built:** <UI build summary or "server-only">
**Deployed:** <files copied / restart status>
**Smoke test:** <Tier 2: pass/fail, Tier 3: specific assertions, Tier 4: console clean / not run>
**Caveats:** <anything that couldn't be verified locally — empty Neo4j, sparse data, etc.>
```

## Pause point

After reporting, stop. Don't proceed to commit/push/staging unless the user says so.

## Reference

- [docs/SMOKE_TEST.md](../../../docs/SMOKE_TEST.md) — canonical smoke test definition
- [BIBLE.md §15 "Development Workflow"](../../../BIBLE.md) — the underlying setup
- [OPERATIONS.md](../../../OPERATIONS.md) — deploy targets and gotchas (less relevant for local)
