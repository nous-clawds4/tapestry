# Tapestry Operations — brainstorm.world

> **Audience:** the active team running this fork at `brainstorm.world`.
> **Prerequisite reading:** [BIBLE.md](./BIBLE.md) — what tapestry *is* and how it works. This file documents the specifics of *our* deployment that aren't useful to other operators forking the codebase.

**Last updated:** 2026-04-26

---

## Table of Contents

1. [Deploy targets](#1-deploy-targets)
2. [Branches](#2-branches)
3. [CI/CD workflows](#3-cicd-workflows)
4. [Branch protection ruleset](#4-branch-protection-ruleset)
5. [Droplets and empirical measurements](#5-droplets-and-empirical-measurements)
6. [Active team and branch ownership](#6-active-team-and-branch-ownership)
7. [Active tracking issues](#7-active-tracking-issues)
8. [Operational gotchas we've hit](#8-operational-gotchas-weve-hit)

---

## 1. Deploy targets

Three long-lived branches, three Digital Ocean droplets, three CI/CD workflows:

| Branch | Workflow | Target | Purpose |
|--------|----------|--------|---------|
| `main` | `deploy-brainstorm.yml` | `brainstorm.world` | Production. PRs merge here only after staging verification. |
| `staging` | `deploy-staging.yml` | `staging.brainstorm.world` | Pre-production verification. PRs from feature branches land here first. |
| `feature-magic-carpet` | `deploy-magic-carpet.yml` | `magic-carpet.brainstorm.world` | Long-lived sandbox for Matthias's bounty-system work. |

Each workflow uses repo secrets named `DEPLOY_HOST_<NAME>`, `DEPLOY_USER_<NAME>`, `DEPLOY_SSH_KEY_<NAME>` where `<NAME>` is `BRAINSTORM`, `STAGING`, or `MAGIC_CARPET`.

### Standard branch promotion flow

```
feat/foo (off staging)
    → PR → staging        → CI deploys to staging.brainstorm.world
    → verify on staging
    → PR → main            → CI deploys to brainstorm.world
    → source feature branch auto-deleted
```

For Matthias's sandbox: he PRs from his fork's `magic-carpet` branch into our `feature-magic-carpet`. Merging deploys to `magic-carpet.brainstorm.world`. Code on `feature-magic-carpet` is **not** intended for production until promoted via the standard `feature-magic-carpet → staging → main` path.

---

## 2. Branches

In addition to the three deploy-target branches:

| Branch | Status | Owner | Purpose |
|--------|--------|-------|---------|
| `feature-relay-discovery` | parked | Vinney | Holds the Relay Discovery feature for continued development. Briefly merged via PR #35 (2026-04-19), pulled back via PR #46/#47 (2026-04-24). Awaiting Vinney's rework. |
| `feature-tapestry-discovery` | WIP | Vinney | Stacked on `feature-relay-discovery`. Open as PR #32, parked. |

### Retired branches

- `refactor-paths` — was the dev/prod branch before the 2026-04-20 reorg. Deleted; its content lives in `main`.
- `brainstorm-search` — was the dev/prod branch for the retired `nous-clawds4.tapestry.ninja` instance. Deleted.
- `develop` — Vinney's pre-reorg integration branch. Deleted 2026-04-26 after confirming with Vinney; its only unique content vs `main` was a redundant `.pi/` gitignore entry that `main` already had. The role it once served (integration branch) is now filled by `staging`.

---

## 3. CI/CD workflows

GitHub Actions workflows in `.github/workflows/`. All three follow the same SSH-action pattern:

1. Restore `docker-compose.yml` to repo version (`git checkout --`)
2. Pull latest code from the corresponding branch
3. Apply production port remap (`sed` to `127.0.0.1:8080:80`)
4. Rebuild and restart (`docker compose up -d --build`)
5. Prune old images

The first deploy to a new droplet takes 5–15 minutes (the strfry C++ Redis patch builds from scratch). Subsequent deploys take ~80 seconds on a warm Docker layer cache.

---

## 4. Branch protection ruleset

The `restrict-deletions` ruleset (Settings → Rules → Rulesets) targets `main`, `staging`, `feature-magic-carpet`, `feature-relay-discovery`, and `feature-tapestry-discovery` with two rules:

- **Restrict deletions** — prevents the auto-delete-head-branches setting from removing long-lived branches when they're the *head* of a promotion PR. (See gotcha #1 below.)
- **Block force pushes** — prevents history rewrites that would lose collaborator work and invalidate CI/CD's record of which SHA was deployed.

Short-lived feature branches (`feat/*`, `fix/*`, `chore/*`) are NOT protected; they're auto-deleted by GitHub on merge — desired behavior for keeping the branch list tidy.

---

## 5. Droplets and empirical measurements

### Production: `brainstorm.world`

- 32 GB RAM, AMD, 8 vCPU, 400 GB storage, Ubuntu 24.04
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`

### Pre-prod: `staging.brainstorm.world`

- (specs to be filled in — sized to match prod for accurate verification)

### Sandbox: `magic-carpet.brainstorm.world`

- (specs to be filled in — sized for a small WoT-user count)

### Empirical RAM/disk on production (April 2026)

2.6M profiles, 30M FOLLOWS relationships:

| Component | Measured RAM | Disk | Notes |
|---|---|---|---|
| Meilisearch | 5.6 GB | 10.7 GB | 2.6M profiles + WoT score fields for 3 POVs |
| Neo4j (inside tapestry) | 2-3 GB | 3.6 GB | 2.46M NostrUser nodes, 30.5M relationships |
| strfry (inside tapestry) | 0.5-1 GB | LMDB | Memory-mapped, benefits from OS page cache |
| Redis | 4 MB | — | Queue is nearly empty when consumer keeps up |
| nostr-search-api | 31 MB | — | Lightweight Node.js process |
| Node.js (Express, nip50-proxy, consumer) | ~0.5 GB | — | Inside tapestry container |
| OS | 1-2 GB | — | Kernel, buffers, page cache |
| **Total** | **~10 GB** | — | Of 31.3 GB available |

The dynamic allocation formula in `docker/entrypoint.sh` is universal — see [BIBLE.md §15 "Memory Architecture"](./BIBLE.md#memory-architecture) for the formula table.

---

## 6. Active team and branch ownership

| Person | GitHub | Role | Active branches |
|--------|--------|------|-----------------|
| **wds4 (David Strayhorn)** | `PrettyGoodFreedomTech` | Owner | manages `main` and `staging` |
| **Vinney Cavallo** | `vcavallo` | Contributor | `feature-relay-discovery`, `feature-tapestry-discovery` (PR #32 parked) |
| **Matthias DeBernardini** | `matthiasdebernardini` | Contributor | works from his fork (`matthiasdebernardini/magic-carpet-v2`); PRs into `feature-magic-carpet` |

Universal credits and contributor list lives in [BIBLE.md §20 "People"](./BIBLE.md#20-people).

---

## 7. Active tracking issues

- **#63 — Meilisearch upgrade.** Currently pinned at `getmeili/meilisearch:v1.12` (v1.12.8). Panics on certain queries (`q=primal`, `q=prima`) due to a milli interner u16 overflow. Workaround in place at `nostr-search/src/search.js` (catches the panic and returns a friendly notice in place of a 500). Real fix is a Meilisearch upgrade — verify index compatibility, plan a reindex from strfry, and remove the workaround. Deferred until time for the Docker rebuild and reindex window.

---

## 8. Operational gotchas we've hit

### 8.1. `gh` CLI defaults to the upstream fork

This local checkout has two remotes:
- `origin` → `nous-clawds4/tapestry` (our fork — what we actually push to)
- `upstream` → `Pretty-Good-Freedom-Tech/brainstorm` (the original project)

`gh repo view --json nameWithOwner` returns the upstream, so `gh pr create`, `gh pr list`, `gh issue ...` all silently target the wrong repo and either fail or return empty.

**Fix:** always pass `--repo nous-clawds4/tapestry` to every `gh` command, or run `gh repo set-default nous-clawds4/tapestry` once to fix it permanently.

### 8.2. 2026-04-24: auto-delete-head-branches deleted `staging`

After merging a `staging → main` promotion PR, GitHub's "Automatically delete head branches" setting kicked in and deleted `staging` (the PR's head branch).

**Recovery:** `git push origin origin/main:refs/heads/staging` to recreate `staging` at `main`'s HEAD.

**Permanent fix:** the `restrict-deletions` ruleset added in the same session (see §4 above) prevents recurrence on long-lived branches. Even with auto-delete enabled at the repo level, GitHub honors the ruleset.

### 8.3. 2026-04-25: NIP-05 prod registration confused volume vs. host filesystem

When first registering `brainstorm@brainstorm.world` via the NIP-05 endpoint added in PR #50/#51, David edited `/var/lib/brainstorm/settings.json` *on the droplet host* — but the brainstorm process inside the container reads from the `tapestry-data` Docker named volume mounted at `/var/lib/brainstorm/` *inside the container*. Different filesystems entirely.

**Recovery:** find the volume's host mountpoint with `docker volume inspect tapestry_tapestry-data --format '{{.Mountpoint}}'` (typically `/var/lib/docker/volumes/tapestry_tapestry-data/_data/`) and `mv` the file into it.

**Documented for future maintainers:** [BIBLE.md §15 "Editing settings.json on a deployed droplet"](./BIBLE.md#editing-settingsjson-on-a-deployed-droplet) was added in response to this incident — the gotcha pattern is universal even though we hit it specifically while registering `brainstorm@brainstorm.world`.

### 8.4. GitHub PR head-ref stuck state after retargeting base

After retargeting a PR's base branch via `gh pr edit --base <new>`, subsequent pushes to the head branch can fail to sync with the PR — GitHub's `refs/pull/<N>/head` stays at the pre-retarget SHA. Symptoms: branch ref on origin updates correctly, but `gh api pulls/<N>` shows stale `head.sha`, `mergeable=false`, `mergeable_state=dirty`. No `synchronize` events fire in the PR timeline. `gh pr update-branch`, close/reopen, retargeting again — none of these recover it.

**Workaround:** close the stuck PR and open a fresh one from the same branch → same base. The new PR picks up the actual branch state immediately. Preserve the original body and add a note referencing the stuck PR number.

Hit this on PR #29 → replaced with PR #35 on 2026-04-19.

### 8.5. Post-deploy 502 flicker until brainstorm Express binds

Both `deploy-staging.yml` and `deploy-brainstorm.yml` run `docker compose up -d --build` and exit as soon as the compose command returns. That means CI reports "deploy succeeded" the moment the **container** starts — not when the brainstorm Node process inside it has finished booting (Neo4j driver init, Redis connection, Express middleware, etc., add a few seconds).

In that window, nginx is up but its upstream isn't, so requests get **502 Bad Gateway**. The cycle is short — observed 5–30 s across the runs we've watched (#82, #81, #84, #85 across staging and main) — but it's long enough that a naive smoke test fired right after `gh run watch` returns will get false 502s.

**Recipe for autonomous post-deploy verification:** poll an actual API endpoint (not just `/`, which can flicker between cached static-shell 200s and upstream 502s) until you see **3 consecutive 200s**. Bash:

```bash
streak=0; attempts=0
until [ $streak -ge 3 ] || [ $attempts -ge 90 ]; do
  attempts=$((attempts+1))
  code=$(curl -s -o /dev/null -w '%{http_code}' "$H/api/get-user-counts?pubkey=<known-pk>")
  if [ "$code" = "200" ]; then streak=$((streak+1)); else streak=0; fi
  sleep 2
done
```

For human users hitting the site immediately after a deploy: refresh once or twice. The flicker resolves on its own.

**Long-term fix candidate:** the deploy script could `curl --retry` an API endpoint as a final step before exiting, so CI doesn't report success until brainstorm is actually serving. Not yet done — left as a separate operational improvement.
