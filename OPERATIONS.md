# Tapestry Operations — tapestry.brainstorm.world

> **Audience:** the active team running this fork at `tapestry.brainstorm.world`.
> **Prerequisite reading:** [BIBLE.md](./BIBLE.md) — what tapestry *is* and how it works. This file documents the specifics of *our* deployment that aren't useful to other operators forking the codebase.

**Last updated:** 2026-09-29

---

## Table of Contents

1. [Deploy targets](#1-deploy-targets)
2. [Branches](#2-branches)
3. [CI/CD workflows](#3-cicd-workflows)
4. [Branch protection ruleset](#4-branch-protection-ruleset)
5. [Droplets and empirical measurements](#5-droplets-and-empirical-measurements)
6. [Spinning up a new sandbox droplet](#6-spinning-up-a-new-sandbox-droplet)
7. [Active team and branch ownership](#7-active-team-and-branch-ownership)
8. [Active tracking issues](#8-active-tracking-issues)
9. [Operational gotchas we've hit](#9-operational-gotchas-weve-hit)
10. [Task queue (BullMQ behind /api/run-task)](#10-task-queue-bullmq-behind-apirun-task)
11. [Conf templates are the source of truth for fresh containers](#11-conf-templates-are-the-source-of-truth-for-fresh-containers)
12. [Reconciliation — four independent tasks (story #23 / ADR 0020)](#12-reconciliation--four-independent-tasks-story-23--adr-0020)
13. [Task scheduling — generalized scheduler (story #22 / ADR 0019)](#13-task-scheduling--generalized-scheduler-story-22--adr-0019)
14. [Local dev loop (inside-container source edits)](#14-local-dev-loop-inside-container-source-edits)
15. [CI test gate (PRs to staging/main)](#15-ci-test-gate-prs-to-stagingmain)

---

## 1. Deploy targets

Four long-lived branches, four Digital Ocean droplets, four CI/CD workflows:

| Branch | Workflow | Target | Purpose |
|--------|----------|--------|---------|
| `main` | `deploy-tapestry.yml` | `tapestry.brainstorm.world` | Production. PRs merge here only after staging verification. (Was `brainstorm.world` until 2026-07-10, when that name moved to the **NosFabrica** codebase — Tapestry's reference deployment is now `tapestry.brainstorm.world`, served from the same droplet `159.203.150.156`.) |
| `staging` | `deploy-staging.yml` | `staging.brainstorm.world` | Pre-production verification. PRs from feature branches land here first. |
| `feature-magic-carpet` | `deploy-magic-carpet.yml` | `magic-carpet.brainstorm.world` | Long-lived sandbox for Matthias's bounty-system work. |
| `feat/tags` | `deploy-tags.yml` | `tags.brainstorm.world` | Long-lived sandbox for the tagging feature work (NIP-85 profile-tagging UX). Succeeds the retired `feat/pubkey-tagging-target` (re-forked from `staging` 2026-06-19). |

> **Decommissioned September 2026:** the `feat/communities` (`communities.brainstorm.world`) and `feat/curate` (`curate.brainstorm.world`) sandboxes were retired — their Digital Ocean droplets were deleted (expensive to maintain, unused). The **branches are retained as archives** (Avi's communities work; the Curate app) — see [§2 Retired branches](#2-branches). `deploy-communities.yml` is removed (`deploy-curate.yml` was never merged past its own branch), and the `DEPLOY_*_COMMUNITIES` / `DEPLOY_*_CURATE` repo secrets are removed.

Each workflow uses repo secrets named `DEPLOY_HOST_<NAME>`, `DEPLOY_USER_<NAME>`, `DEPLOY_SSH_KEY_<NAME>` where `<NAME>` is `TAPESTRY`, `STAGING`, `MAGIC_CARPET`, or `TAGS`. (The `TAPESTRY` secrets superseded `BRAINSTORM` in the 2026-07-10 cutover; they carry the same `159.203.150.156` host/user/key.)

### Standard branch promotion flow

```
feat/foo (off staging)
    → PR → staging        → CI deploys to staging.brainstorm.world
    → verify on staging
    → PR → main            → CI deploys to tapestry.brainstorm.world
    → source feature branch auto-deleted
```

**Long-lived sandbox branches** (currently `feature-magic-carpet` and `feat/tags`, plus any future additions) follow the same convention: fork from `staging`, deploy to their own droplet via a dedicated `deploy-<name>.yml` workflow, and eventually merge back via the standard `<branch> → staging → main` path. New sandboxes get a row added to the deploy-target table above when they're stood up, plus a row in [§5 "Droplets and empirical measurements"](#5-droplets-and-empirical-measurements).

For Matthias's sandbox: he PRs from his fork's `magic-carpet` branch into our `feature-magic-carpet`. Merging deploys to `magic-carpet.brainstorm.world`. Code on `feature-magic-carpet` is **not** intended for production until promoted via the standard `feature-magic-carpet → staging → main` path.

---

## 2. Branches

In addition to the four deploy-target branches:

| Branch | Status | Owner | Purpose |
|--------|--------|-------|---------|
| `feature-relay-discovery` | parked | Vinney | Holds the Relay Discovery feature for continued development. Briefly merged via PR #35 (2026-04-19), pulled back via PR #46/#47 (2026-04-24). Awaiting Vinney's rework. |
| `feature-tapestry-discovery` | WIP | Vinney | Stacked on `feature-relay-discovery`. Open as PR #32, parked. |

### Retired branches

- `refactor-paths` — was the dev/prod branch before the 2026-04-20 reorg. Deleted; its content lives in `main`.
- `brainstorm-search` — was the dev/prod branch for the retired `nous-clawds4.tapestry.ninja` instance. Deleted.
- `feat/pubkey-tagging-target` — original sandbox branch for the tagging feature, deployed to `tags.brainstorm.world`. Retired 2026-06-19 in favor of `feat/tags` (re-forked clean from `staging`); fully merged into `staging` at retirement (0 unique commits), so nothing was lost. `deploy-tags.yml` was repointed to `feat/tags`.
- `develop` — Vinney's pre-reorg integration branch. Deleted 2026-04-26 after confirming with Vinney; its only unique content vs `main` was a redundant `.pi/` gitignore entry that `main` already had. The role it once served (integration branch) is now filled by `staging`.

**Decommissioned sandboxes (droplet deleted, branch retained as an archive — NOT deleted):**

- `feat/communities` — communities / decentralized-lists sandbox (Avi), was deployed to `communities.brainstorm.world`. **Decommissioned September 2026:** the Digital Ocean droplet was deleted (expensive to maintain, unused). The **branch is kept as an archive** (~156 unique commits of Avi's work, cited by the `protocols/` drafts), so it is *not* in the "candidate cleanup" list — see `scripts/long-lived-branches.txt`. `deploy-communities.yml` and the `DEPLOY_*_COMMUNITIES` secrets are removed.
- `feat/curate` — Avi's Curate-app sandbox, was deployed to `curate.brainstorm.world`. **Decommissioned September 2026:** droplet deleted. **Branch kept as an archive.** Its `deploy-curate.yml` never merged past the sandbox branch; the `DEPLOY_*_CURATE` secrets are removed.

---

## 3. CI/CD workflows

GitHub Actions workflows in `.github/workflows/`. All four follow the same SSH-action pattern:

1. Restore `docker-compose.yml` to repo version (`git checkout --`)
2. Pull latest code from the corresponding branch
3. Apply production port remap (`sed` to `127.0.0.1:8080:80`)
4. Rebuild and restart (`docker compose up -d --build`)
5. Prune old images

The first deploy to a new droplet takes 5–15 minutes (the strfry C++ Redis patch builds from scratch). Subsequent deploys take ~80 seconds on a warm Docker layer cache.

These are the **deploy** workflows (push-triggered). The one non-deploy workflow is the pull-request **test gate** — see [§15](#15-ci-test-gate-prs-to-stagingmain).

---

## 4. Branch protection ruleset

The `restrict-deletions` ruleset (Settings → Rules → Rulesets) targets `main`, `staging`, `feature-magic-carpet`, `feature-relay-discovery`, and `feature-tapestry-discovery` with two rules:

- **Restrict deletions** — prevents the auto-delete-head-branches setting from removing long-lived branches when they're the *head* of a promotion PR. (See gotcha #1 below.)
- **Block force pushes** — prevents history rewrites that would lose collaborator work and invalidate CI/CD's record of which SHA was deployed.

Short-lived feature branches (`feat/*`, `fix/*`, `chore/*`) are NOT protected; they're auto-deleted by GitHub on merge — desired behavior for keeping the branch list tidy.

---

## 5. Droplets and empirical measurements

### Production: `tapestry.brainstorm.world` (`159.203.150.156`)

- 32 GB RAM, AMD, 8 vCPU, 400 GB storage, Ubuntu 24.04
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`
- **This is the former `brainstorm.world` prod droplet.** On 2026-07-10 the `brainstorm.world` name was handed to the **NosFabrica** codebase (now served from a separate host, `74.208.86.220`); this droplet was repurposed as Tapestry's reference deployment under `tapestry.brainstorm.world` (same box, same Neo4j volume). Cutover = new host-nginx `server_name` + Certbot cert for `tapestry.brainstorm.world`, `.env` `DOMAIN_NAME=tapestry.brainstorm.world`, and the `DEPLOY_*_TAPESTRY` secrets (`deploy-tapestry.yml`).

### Pre-prod: `staging.brainstorm.world`

- (specs to be filled in — sized to match prod for accurate verification)

### Sandbox: `magic-carpet.brainstorm.world`

- (specs to be filled in — sized for a small WoT-user count)

### Sandbox: `tags.brainstorm.world`

- (specs to be filled in)
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`
- Stood up 2026-05-12; first CI/CD deploy via `deploy-tags.yml` ran successfully against PR #119.
- 2026-06-19: deploy source repointed from `feat/pubkey-tagging-target` to `feat/tags` (re-forked from `staging`). Same droplet/secrets; `deploy-tags.yml` gained a `git fetch origin` so the existing `/opt/tapestry` checkout could switch to the never-before-fetched branch under `set -e`.

### Sandbox: `communities.brainstorm.world` — DECOMMISSIONED (September 2026)

- **Droplet deleted** (expensive to maintain, unused). Branch `feat/communities` retained as an archive; `deploy-communities.yml` + `DEPLOY_*_COMMUNITIES` secrets removed (see §2). Was stood up 2026-05-14 — the reference walk-through for §6, and where the §9.9 SSH brute-force incident was first hit.

### Sandbox: `curate.brainstorm.world` — DECOMMISSIONED (September 2026)

- **Droplet deleted.** Branch `feat/curate` retained as an archive; `DEPLOY_*_CURATE` secrets removed (see §2). Was stood up 2026-05-15.

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

## 6. Spinning up a new sandbox droplet

End-to-end procedure for adding a new long-lived sandbox to the deploy fleet. The reference walk-through is `feat/communities` → `communities.brainstorm.world` on 2026-05-14; sub-sections call out gotchas hit during that run. (That sandbox has since been decommissioned — §2 — but the procedure below is unchanged and still current.)

### 6.1. Pre-flight (off-droplet)

1. **DNS** — add an `A` record for `<name>.brainstorm.world` → droplet IP **first**. Certbot won't issue until the name resolves, and propagation can take minutes.
2. **Branch** — the long-lived branch you'll deploy from should already exist on origin, forked from `staging` per §1.
3. **Droplet** — provision the DO instance. Size to purpose: sandboxes that load the full WoT graph need ~32 GB; lightweight feature work can run smaller. Ubuntu 24.04 LTS.

### 6.2. GitHub setup

1. **Workflow file** — add `.github/workflows/deploy-<name>.yml` on the target branch. Mirror `deploy-tags.yml` and substitute the branch name, secret suffix, and droplet-name comment. Do **not** push yet — pushing triggers the first deploy, which fails until secrets are set and the droplet is ready.
2. **Repo secrets** — prepare three placeholders in Settings → Secrets (values filled in from the droplet in §6.3 step 2):
   - `DEPLOY_HOST_<NAME>` — droplet IP or hostname
   - `DEPLOY_USER_<NAME>` — typically `root`
   - `DEPLOY_SSH_KEY_<NAME>` — the **private** key generated on the droplet

### 6.3. On the droplet

1. **System packages.** Use Docker's official `docker-ce` only — **do not** also install Ubuntu's `docker.io`. Mixing the two breaks Docker daemon DNS in unpredictable ways (symptoms: `EAI_AGAIN` on npm installs inside containers, `sudo: unable to resolve host <container-id>`).
   ```bash
   apt update && apt upgrade -y
   install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   chmod a+r /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
   apt update
   apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx certbot python3-certbot-nginx git
   ```

2. **SSH hardening.** Do this **before** generating the deploy key. Within minutes of a fresh droplet booting, brute-force bots find port 22 and start saturating sshd. Default `MaxStartups 10:30:100` then randomly drops new unauth'd connections — including legitimate ones from GitHub Actions deploys (see §9.9).
   ```bash
   # Disable password auth (deploys and humans both use keys)
   cat > /etc/ssh/sshd_config.d/99-disable-password.conf <<'EOF'
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   EOF
   sshd -t && systemctl reload ssh

   # Install fail2ban with a basic SSH jail
   apt install -y fail2ban
   cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
   [sshd]
   enabled = true
   port = 22
   maxretry = 5
   findtime = 10m
   bantime = 1h
   EOF
   systemctl enable --now fail2ban
   ```

3. **Deploy SSH key.**
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/tapestry_<name> -N ""
   cat ~/.ssh/tapestry_<name>.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/tapestry_<name>       # paste into DEPLOY_SSH_KEY_<NAME>
   ```
   Now fill in the three `DEPLOY_*_<NAME>` secrets in GitHub.

4. **Clone and check out the target branch.**
   ```bash
   git clone https://github.com/nous-clawds4/tapestry.git /opt/tapestry
   cd /opt/tapestry
   git checkout <branch>
   ```

5. **`.env` file** — all three vars from `.env.example` are required. Skipping any of them causes silent runtime failures rather than a hard stop:
   ```
   OWNER_PUBKEY=<your_hex_pubkey>
   NEO4J_PASSWORD=<strong_password>
   ADMIN_PUBKEYS=<your_hex_pubkey>     # same as OWNER_PUBKEY by convention
   DOMAIN_NAME=<name>.brainstorm.world
   ```
   `ADMIN_PUBKEYS` only emits a `WARN` from docker-compose when missing — don't take that as benign.

6. **Nginx + SSL.**
   ```bash
   cat > /etc/nginx/sites-available/<name>.brainstorm.world <<'EOF'
   server {
       listen 80;
       server_name <name>.brainstorm.world;
       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   EOF
   ln -sf /etc/nginx/sites-available/<name>.brainstorm.world /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   certbot --nginx -d <name>.brainstorm.world
   ```

7. **Port remap, then first start.** The `sed` is **required** before the first `docker compose up`. Nginx already owns `:80`, so without the remap Docker can't bind and containers stay in "Created" state — neo4j and brainstorm never start, nginx returns 502. The CI/CD workflow runs this `sed` on every deploy (idempotent), but the first manual bring-up is on you:
   ```bash
   sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml
   docker compose up -d --build
   ```
   First build takes 5–15 minutes (strfry's C++/Redis patch compiles from scratch). Subsequent CI/CD deploys warm-cache to ~80 seconds.

### 6.4. Verify and finalize

1. **Service health.** All four services should report `Up`:
   ```bash
   docker compose ps                            # tapestry, tapestry-redis, nostr-search-meili, nostr-search-api
   curl -sI https://<name>.brainstorm.world     # expect 200, briefly 502 if Express is still booting — see §9.5
   ```

2. **Push the workflow.** `deploy-<name>.yml` lives only on the target branch (Actions on non-default branches only run for pushes to that branch). Pushing the workflow file *is* a push to the branch, which triggers the first CI/CD deploy. That run is the validation: it should idempotently re-pull, re-`sed`, and reach the same healthy state in ~80 seconds.

3. **Update this document.** Add rows to §1 (deploy targets) and §5 (droplets and empirical measurements). Per §1's note this is a documented convention.

---

## 7. Active team and branch ownership

| Person | GitHub | Role | Active branches |
|--------|--------|------|-----------------|
| **wds4 (David Strayhorn)** | `PrettyGoodFreedomTech` | Owner | manages `main` and `staging` |
| **Vinney Cavallo** | `vcavallo` | Contributor | `feature-relay-discovery`, `feature-tapestry-discovery` (PR #32 parked) |
| **Matthias DeBernardini** | `matthiasdebernardini` | Contributor | works from his fork (`matthiasdebernardini/magic-carpet-v2`); PRs into `feature-magic-carpet` |

Universal credits and contributor list lives in [BIBLE.md §20 "People"](./BIBLE.md#20-people).

---

## 8. Active tracking issues

- **#63 — Meilisearch upgrade.** Currently pinned at `getmeili/meilisearch:v1.12` (v1.12.8). Panics on certain queries (`q=primal`, `q=prima`) due to a milli interner u16 overflow. Workaround in place at `nostr-search/src/search.js` (catches the panic and returns a friendly notice in place of a 500). Real fix is a Meilisearch upgrade — verify index compatibility, plan a reindex from strfry, and remove the workaround. Deferred until time for the Docker rebuild and reindex window.

---

## 9. Operational gotchas we've hit

### 9.0. Publish policy — external-publish guard (`BRAINSTORM_PUBLISH_LOCAL_ONLY`)

The app publishes signed events to public relays by default. A per-deployment opt-in guard (event-tagging ADR 0002) can force **local-relay-only** publishing:

- **Default (flag unset): publishes externally — unchanged.** Production, staging, and every sandbox keep working with no action. There is **no migration**; you do not need to set anything to preserve current behaviour.
- **`BRAINSTORM_PUBLISH_LOCAL_ONLY=true`** (in a deployment's `brainstorm.conf`, or the container env): every publish path stays on that deployment's local strfry — nothing reaches public relays. Use only for a deployment you deliberately want isolated.
- **Check a deployment's posture:** `curl -s <host>/api/publish-policy` → `allowExternalPublish:false` means the guard is on.
- The guard is **client-side and fail-open** (an unreadable policy publishes externally), so it is a convenience/safety switch, not a hard egress control. Local-dev usage and the full reference live in [docs/CONFIGURATION.md → Publish policy](./docs/CONFIGURATION.md#publish-policy-external-publish-guard).

### 9.1. `gh` CLI defaults to the upstream fork

This local checkout has two remotes:
- `origin` → `nous-clawds4/tapestry` (our fork — what we actually push to)
- `upstream` → `Pretty-Good-Freedom-Tech/brainstorm` (the original project)

`gh repo view --json nameWithOwner` returns the upstream, so `gh pr create`, `gh pr list`, `gh issue ...` all silently target the wrong repo and either fail or return empty.

**Fix:** always pass `--repo nous-clawds4/tapestry` to every `gh` command, or run `gh repo set-default nous-clawds4/tapestry` once to fix it permanently.

### 9.2. 2026-04-24: auto-delete-head-branches deleted `staging`

After merging a `staging → main` promotion PR, GitHub's "Automatically delete head branches" setting kicked in and deleted `staging` (the PR's head branch).

**Recovery:** `git push origin origin/main:refs/heads/staging` to recreate `staging` at `main`'s HEAD.

**Permanent fix:** the `restrict-deletions` ruleset added in the same session (see §4 above) prevents recurrence on long-lived branches. Even with auto-delete enabled at the repo level, GitHub honors the ruleset.

### 9.3. 2026-04-25: NIP-05 prod registration confused volume vs. host filesystem

When first registering `brainstorm@brainstorm.world` via the NIP-05 endpoint added in PR #50/#51, David edited `/var/lib/brainstorm/settings.json` *on the droplet host* — but the brainstorm process inside the container reads from the `tapestry-data` Docker named volume mounted at `/var/lib/brainstorm/` *inside the container*. Different filesystems entirely.

**Recovery:** find the volume's host mountpoint with `docker volume inspect tapestry_tapestry-data --format '{{.Mountpoint}}'` (typically `/var/lib/docker/volumes/tapestry_tapestry-data/_data/`) and `mv` the file into it.

**Documented for future maintainers:** [BIBLE.md §15 "Editing settings.json on a deployed droplet"](./BIBLE.md#editing-settingsjson-on-a-deployed-droplet) was added in response to this incident — the gotcha pattern is universal even though we hit it specifically while registering `brainstorm@brainstorm.world`.

### 9.4. GitHub PR head-ref stuck state after retargeting base

After retargeting a PR's base branch via `gh pr edit --base <new>`, subsequent pushes to the head branch can fail to sync with the PR — GitHub's `refs/pull/<N>/head` stays at the pre-retarget SHA. Symptoms: branch ref on origin updates correctly, but `gh api pulls/<N>` shows stale `head.sha`, `mergeable=false`, `mergeable_state=dirty`. No `synchronize` events fire in the PR timeline. `gh pr update-branch`, close/reopen, retargeting again — none of these recover it.

**Workaround:** close the stuck PR and open a fresh one from the same branch → same base. The new PR picks up the actual branch state immediately. Preserve the original body and add a note referencing the stuck PR number.

Hit this on PR #29 → replaced with PR #35 on 2026-04-19.

### 9.5. Post-deploy 502 flicker until brainstorm Express binds

Both `deploy-staging.yml` and `deploy-tapestry.yml` run `docker compose up -d --build` and exit as soon as the compose command returns. That means CI reports "deploy succeeded" the moment the **container** starts — not when the brainstorm Node process inside it has finished booting (Neo4j driver init, Redis connection, Express middleware, etc., add a few seconds).

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

**Post-stability 502s were the row 325 crash (diagnosed and fixed 2026-09-19).** For a long time this section read that "the brainstorm process can briefly cycle once more after first appearing stable" — first noted on #88, then seen again on later deploys where a 502 burst opened *after* the 3×200 poll, mid-smoke. That reading is **withdrawn**: it was not a spontaneous restart. `handleGetUserData` (`src/api/export/users/queries/userdata.js`) crashed the Express process whenever its first Cypher call hit a Neo4j that had not finished binding — an undefined identifier on its error branch turned a `ServiceUnavailable` into an unhandled `ReferenceError`, Node exited, supervisor restarted it, and nginx served 502s until it rebound. Fixed in PRs #681/#682 (OPEN.md row 325). **The durable guard is a Neo4j-readiness gate, not a retry:** after the 3×200 HTTP poll, do not fire any Cypher-backed call until Neo4j is answering — poll `get-user-counts` until `verifiedFollowerCount` is non-null on 3 consecutive polls (it returns `null` while Neo4j is down, a number once it is up; ~40 s after container start on the production deploy where it was timed). `docs/SMOKE_TEST.md` Tier 1 carries the gate and the exact recipe.

**Long-term fix candidate:** the deploy script could `curl --retry` an API endpoint as a final step before exiting, so CI doesn't report success until brainstorm is actually serving. Not yet done — left as a separate operational improvement.

### 9.6. 2026-05-03: SESSION_SECRET rotated on every container start, invalidating all cookies

While verifying the Redis-backed session store landed in #90, we noticed users were still being logged out on every deploy — even though Redis correctly persisted session data across container rebuilds. The actual root cause: `docker/entrypoint.sh` regenerated `SESSION_SECRET="$(openssl rand -hex 32)"` unconditionally on every container start. Each `docker compose up -d --build` recreates the brainstorm container; `entrypoint.sh` re-ran; secret rotated; every existing user cookie failed signed-validation; express-session treated cookies as absent → users logged out, despite Redis still holding the session data.

**Fix (PR #92):** persist `SESSION_SECRET` to `/var/lib/brainstorm/session.secret` on the `tapestry-data` volume. Generate-once-and-store, read on subsequent starts. To force-rotate after a security incident: delete the file; every active session ends on the next container start.

**Lesson:** when fixing a "session persistence" UX, both the *store* (where data lives) and the *secret* (which validates cookies referencing that data) need to survive container rebuilds. Either alone is insufficient.

### 9.7. 2026-05-13: engineering-team scaffolding on main but not on staging

While preparing a new 5-phase engineering-team flow off `staging`, we discovered `engineering-team/` (templates, roles, workflows, README), `AGENTS.md`, and the engineering-team section of `CLAUDE.md` existed on `main` but not on `staging` — about 850 lines of agent-workflow scaffolding silently absent from the pre-production branch. Tracing it back: [PR #111](https://github.com/nous-clawds4/tapestry/pull/111) (commit `4acbe321` — "Add claude 'engineering team' concept") was merged directly to `main`, bypassing staging. All subsequent `staging → main` promotions carried staging's diff *into* main but never the reverse direction — git merges are one-way — so the two branches drifted by exactly that scaffolding.

**Recovery:** one-shot sync PR — branch off `main`, PR back into `staging`, merge. The diff was purely additive on the staging side (main had files staging didn't), so no conflicts. ([PR #122](https://github.com/nous-clawds4/tapestry/pull/122) recorded this for the first occurrence; `deploy-staging.yml` runs but the redeploy is a no-op for running services since only docs/scaffolding moved.)

**Mechanism for prevention:** all changes — *even docs and scaffolding* — should go through the standard `staging → main` flow. The cycle-staging and cycle-prod skills assume parity between the two long-lived branches; landing directly on main breaks that assumption silently. If parity drift is suspected, `git diff --stat origin/main origin/staging` from a fresh checkout reveals it immediately.

### 9.8. 2026-05-14: sandbox instance had list headers but no items

On `tags.brainstorm.world` we noticed the DLists/Concepts for `tag` and `nostr-user-tag` (kind 39998 headers) were present, but no elements (kind 39999) — the UI showed empty lists. The droplet had run firmware install (so headers were correct), but element events published from users on *other* instances (`brainstorm.world`, local dev, etc.) never reached this droplet's strfry.

**Why:** each Tapestry instance's strfry is self-contained. `publishEverywhere` writes to the publishing instance's local strfry plus configured external relays — it does **not** broadcast into every other instance's strfry. A sandbox instance only sees UGC originating on itself unless it opts in to cross-instance mirroring.

**Fix options:**
- One-shot: `docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world --filter '{"kinds":[9998,9999,39998,39999]}' --dir down`
- Continuous: enable the `dcosl` router preset in `/tapestry/settings/relays` (both-direction, kinds 9998/9999/39998/39999).

**Mental model:** see [BIBLE.md §14 "Router Presets"](./BIBLE.md#router-presets). `dcosl.brainstorm.world` is *not* a canonical pool — it's just another instance's public-facing relay that's a convenient pull target if you want shared list state across our deployments.

### 9.9. 2026-05-15: SSH brute-force bots starved CI/CD on the new communities droplet

Avi's first push to `feat/communities` triggered the deploy workflow, but `appleboy/ssh-action` failed at the SSH handshake with `read: connection reset by peer`. Not an auth failure — the connection was being **reset by sshd before authentication ran**.

The droplet was being swarmed by SSH brute-force bots from minutes after boot. With sshd's default `MaxStartups 10:30:100`, once 10 unauthenticated connections are in-flight, sshd starts dropping new ones randomly. The auth log was full of `Invalid user dbus-helper`, `Invalid user pakchoi`, `Connection reset by authenticating user root`, plus repeated `error: beginning MaxStartups throttling` / `drop connection #N from [...] past MaxStartups`. Fail2ban was not installed (`systemctl is-active fail2ban` returned `inactive`). The GitHub Actions deploy connection had the bad luck of arriving during a throttle window and was dropped.

**Recovery for this droplet:** install fail2ban, disable password auth — the same steps now baked into [§6.3 step 2](#63-on-the-droplet). Within minutes fail2ban's banlist grew, MaxStartups throttling stopped firing, and the next deploy ran cleanly.

**Lesson:** any droplet on the public internet on port 22 will be swarmed within minutes of boot. Manual `ssh` retries hide the problem (a person retries until they get lucky); CI/CD has no retry, so it surfaces it. Hardening must happen **before** the deploy SSH key is generated, not after — otherwise the first CI/CD run after key setup is the lottery ticket. The other deploy droplets (prod, staging, magic-carpet, tags) escaped this so far either because they were stood up before the current bot pressure, or because they had hardening applied ad-hoc; the audit checklist below confirms which.

**Audit checklist for existing droplets.** Run this once across all four existing deploy droplets (`brainstorm.world`, `staging.brainstorm.world`, `magic-carpet.brainstorm.world`, `tags.brainstorm.world`) to catch any that are missing the hardening now baked into §6.3 step 2.

On each droplet:

```bash
# 1. Status check — three signals, all should pass
echo "=== $(hostname) ==="
echo "fail2ban: $(systemctl is-active fail2ban 2>/dev/null)"
sshd -T | grep -E "^(passwordauthentication|kbdinteractiveauthentication)"
echo "Recent SSH abuse signals (last 1 hour):"
journalctl -u ssh --since "1 hour ago" --no-pager 2>/dev/null \
  | grep -cE "MaxStartups|Invalid user" || true
```

A droplet passes if:
- `fail2ban: active`
- `passwordauthentication no` and `kbdinteractiveauthentication no`
- The MaxStartups/Invalid-user count is low (single digits/hour is background noise; hundreds/hour means the droplet is currently saturated)

If a droplet **fails** one of the first two checks, apply the hardening from §6.3 step 2 — the exact same commands work on a running droplet (they take effect on `systemctl reload ssh` and `systemctl enable --now fail2ban`). No reboot or downtime needed. Verify with the same script afterward.

If a droplet shows high abuse counts in the third check but the first two pass, fail2ban is doing its job — the abuse traffic is being banned faster than it can saturate sshd. No action needed.

**Tracking:** add a row to §8 "Active tracking issues" when starting the audit; remove it once all four droplets pass. The audit doesn't need to be scheduled — it's a one-time backfill; new droplets are protected by §6.3 step 2 going forward.

### 9.10. 2026-07-19: unauthenticated write-surface exposure + Neo4j credential leak (closed)

Two related exposures, confirmed **live** on staging *and* production by read-only probes 2026-07-19:

- `GET /api/neo4j/run-query?cypher=` ran server-side **unauthenticated**, shelled out to `cypher-shell` with the Neo4j password interpolated into the command string, and returned the password in the error body — an internet-reachable **credential leak + shell-injection RCE**.
- The auth middleware's "localhost bypass" treated *all* nginx-proxied traffic as local (on a droplet every request arrives proxied from `127.0.0.1`), so the entire `/api/normalize/*` + `/api/neo4j/query` **write** surface — which mints TA-signed events and can `DETACH DELETE` the graph — was reachable unauthenticated.

**Fix (shipped to staging + prod + `feat/tags`):** `run-query` deleted; the bypass now requires loopback peer **and** no `X-Forwarded-For`/`X-Real-IP` (so proxied = remote, and a spoofed `XFF: 127.0.0.1` is still remote); the middleware is **default-deny for mutations** (`POST/PUT/PATCH/DELETE` → 401 unless the exact path is on a two-entry public allowlist). Full as-built record: `engineering-team/audits/security-auth-exposure/audit.md`.

**Operator companion — rotate the leaked Neo4j password.** ✅ done on all three instances 2026-07-20. **The method that worked, and the trap that didn't:**

```bash
# Rotate on the Neo4j the APP uses — the in-container one — then point config at it:
docker exec tapestry cypher-shell -u neo4j -p '<OLD>' \
  "ALTER CURRENT USER SET PASSWORD FROM '<OLD>' TO '<NEW>';"
# set /opt/tapestry/.env  NEO4J_PASSWORD=<NEW>  (entrypoint re-renders /etc/brainstorm.conf on start)
docker exec tapestry supervisorctl restart brainstorm    # or: docker compose up -d
```

**Do NOT rotate via the web Neo4j Browser at `:7474`.** It can reach a *different* instance/droplet than the app's in-container Neo4j — during this rotation that caused a cross-instance mix-up where the app got "unauthorized due to authentication failure" because config held the new password but the Neo4j the app actually talks to still had the old one. Always rotate through `docker exec tapestry cypher-shell` so you're changing the same database the app uses.

**Lesson:** the deploy `sed` only remaps `80:80` → `127.0.0.1:8080`; every other Docker-published port (`7474`/`7687`/`8687` Neo4j, `7778` control-panel API, `7700` Meili, `3069` nostr-search-api) stays on `0.0.0.0` and is internet-reachable. Nothing external needs them. **Firewalling them is deferred → OPEN.md #66** (full runbook in `engineering-team/audits/security-auth-exposure/book.md` § Companion). Use a **DO Cloud Firewall, not `ufw`** — Docker rewrites iptables ahead of ufw, so `ufw deny 7687` is silently bypassed; a network-layer firewall filters before the packet reaches the droplet.

---

## 10. Task queue (BullMQ behind /api/run-task)

**Story #13 / ADR 0010.** Phase 1 of a multi-phase migration that routes `/api/run-task` through a real durable queue. Feature-flagged off by default in this phase — flip on per deployment after smoke confirms.

### 10.1 Feature flag

`TASK_QUEUE_ENABLED` in `/etc/brainstorm.conf` controls whether `/api/run-task` enqueues jobs through BullMQ or runs the legacy direct-spawn path.

- `TASK_QUEUE_ENABLED=true` (default since story #17 / ADR 0015) — `/api/run-task` enqueues per-task BullMQ jobs; in-process Workers consume them; `launchChildTask.sh` still spawns the work (its pgrep guard remains as belt-and-suspenders). BullBoard UI mounts at `/admin/queues` (owner-only).
- `TASK_QUEUE_ENABLED=false` — legacy direct-spawn. Zero queue dependency. **This is the rollback path** — flip the flag in the template (or, for an in-container hotfix, in `/etc/brainstorm.conf`), `supervisorctl restart brainstorm`, and the queue is out of the picture.

When the flag is on and Redis is unreachable, `/api/run-task` returns `503` with body `{success: false, error: "task queue (Redis) unreachable", code: "QUEUE_UNAVAILABLE"}` so monitoring can distinguish this failure from 4xx client errors or 5xx unhandled exceptions.

### 10.2 BullBoard UI (operator queue inspector)

When the flag is on, BullBoard is mounted at `https://<host>/admin/queues` behind **owner-or-admin auth** (story #18 / ADR 0016, widened from owner-only in story #13). The owner and any pubkey listed in `BRAINSTORM_ADMIN_PUBKEYS` get full access — view queues, retry / remove / **pause** jobs. The board shows per-task queues with active / waiting / completed / failed counts.

The admin-management endpoints (`/api/admin/list|add|remove`) deliberately use a stricter owner-only gate; admins cannot promote or remove other admins. Only the owner can change the admin list.

> **Be careful.** Retry / remove / pause directly affect running calculations. The board title says "Owner + Admin" as a reminder; the auth gate prevents access by non-owner / non-admin sessions but does NOT prevent admins from making destructive choices.

**Dashboard shortcut** (story #19 / ADR 0017). The Tapestry dashboard at `/tapestry` displays an "🛠️ Admin tools" panel for owner + admin sessions, with one-click links to BullBoard (`/admin/queues/`) and the Neo4j Browser (env-aware URL from `/api/status:neo4jBrowserUrl`). The panel is hidden entirely for non-owner / non-admin / unauthenticated visitors. BullBoard's own header also carries a `← Tapestry Dashboard` back-link, closing the navigation loop. Operators don't need to type `/admin/queues/` directly anymore.

### 10.3 Per-task concurrency config

Server-side file at `/etc/brainstorm-task-queue.json`:

```json
{
  "defaultConcurrency": 1,
  "concurrencyByTask": {
    "calculateCustomerGrapeRank": 1
  }
}
```

Unset = `defaultConcurrency`. Phase 1 ships with everything at `1` to match today's effective serial behavior; the operator tunes upward task-by-task after observing real load.

A future sibling story will introduce a shared "Neo4j-heavy class" concurrency cap across multiple task types (cross-task serialization) — that's tracked separately and out of scope for phase 1.

### 10.4 Drain / pause for maintenance

To pause all incoming jobs during planned maintenance (e.g., a Neo4j restart):

1. Open BullBoard at `/admin/queues`.
2. Click each queue's **Pause** button. Jobs in `active` complete; new submissions land in `waiting` and don't dispatch.
3. Perform maintenance.
4. Click each queue's **Resume** button. Queued jobs dispatch in order.

To drain a queue (kill all waiting jobs for one task without affecting active ones), use the queue's "Clear waiting" button in BullBoard.

A faster alternative for full deployments: flip `TASK_QUEUE_ENABLED=false`, `supervisorctl restart brainstorm`. The legacy direct-spawn path absorbs new submissions; the queued jobs remain in Redis (AOF-persisted) and resume when the flag flips back on.

### 10.5 Redis persistence

`docker-compose.yml` runs Redis with `--appendonly yes --appendfsync everysec`. Queued jobs survive `docker restart tapestry-redis` and container updates. No adverse interaction with the strfry-stream-consumer (which uses `blpop` on `strfry:events`) — AOF only adds an on-disk append per list operation.

### 10.6 Cross-task resource-class concurrency caps

**Story #15 / ADR 0013.** Story #13 introduced per-task queues with per-task concurrency caps — sufficient to serialize against same-task contention but not across different task names. Triggering `calculateOwnerGrapeRank` and `calculateOwnerPageRank` back-to-back will still run them concurrently because they live in different per-task queues. This subsection covers the additional cross-task layer.

Requires `TASK_QUEUE_ENABLED=true` (§10.1). When the flag is off, the legacy direct-spawn path runs and resource-class tags have no effect.

#### The `resourceClass` registry tag

Tasks in `src/manage/taskQueue/taskRegistry.json` opt into cross-task serialization by adding a top-level `resourceClass` string, e.g.:

```json
{
  "name": "Calculate Owner GrapeRank",
  "resourceClass": "neo4j-heavy",
  "categories": ["algorithms", "owner"],
  ...
}
```

Tasks without the tag are unaffected — they continue to use story #13's per-task concurrency only.

The **initial tag set** shipped with this story is the owner trio:
- `calculateOwnerHops`
- `calculateOwnerPageRank`
- `calculateOwnerGrapeRank`

These are the three Neo4j-heavy tasks the operator demonstrated the cross-task pain with on `brainstorm.world`. Extend the set operationally by editing the registry and restarting the control panel.

#### The `resourceClassCaps` config key

Per-class concurrency caps live in `/etc/brainstorm-task-queue.json` as a sibling key to story #13's `concurrencyByTask`:

```json
{
  "defaultConcurrency": 1,
  "concurrencyByTask": {},
  "resourceClassCaps": {
    "neo4j-heavy": 1
  }
}
```

Cap default for `neo4j-heavy` is **1** — one Neo4j-heavy task at a time, the strictest interpretation matching the demonstrated pain. Raise to `2` (or higher) per environment if Neo4j proves it can handle concurrent heavy ops; lower to `0` (after a future enhancement) is not currently supported — a missing cap entry treats the class as cap=1 with a warning.

#### Tagging a new task

1. Edit `src/manage/taskQueue/taskRegistry.json`. Add `"resourceClass": "<class-name>"` to the entry.
2. If `<class-name>` is new, edit `/etc/brainstorm-task-queue.json` and add an entry to `resourceClassCaps` with a numeric cap. (Untagged class = warning + cap=1 fallback.)
3. `supervisorctl restart brainstorm`.
4. Trigger the task. Inspect `/var/log/brainstorm/taskQueue/events.jsonl` for `phase=resource_class_*` events to confirm the wrap is active.

#### Observability — `events.jsonl` phase tokens

Resource-class lifecycle events are written to the same `events.jsonl` that bash `emit_task_event` uses (Node-side equivalent at `src/utils/structuredEvents.js`). Three phase tokens to grep for:

- `resource_class_wait_begin` — task waiting for a slot. Metadata: `resourceClass`, `cap`, `jobId`.
- `resource_class_wait_end` — wait resolved. Metadata: `resourceClass`, `wait_seconds`, `outcome` (`"acquired"` or `"timeout"`), `jobId`.
- `resource_class_released` — task done, slot returned. Metadata: `resourceClass`, `held_seconds`, `jobId`.

Quick operator check: "why hasn't my task started?" →
```bash
tail -f /var/log/brainstorm/taskQueue/events.jsonl | grep resource_class
```

#### The `RESOURCE_CLASS_WAIT_TIMEOUT` failure mode

If a task waits longer than the configured `acquireTimeoutMs` (default **4 hours** — longer than any single heavy-task expected duration), the wait rejects with an Error whose `.code === 'RESOURCE_CLASS_WAIT_TIMEOUT'`. BullMQ marks the job failed; the job appears in BullBoard's `failed` tab with the error message containing `RESOURCE_CLASS_WAIT_TIMEOUT`. The corresponding `events.jsonl` entry is a `TASK_ERROR` event with `metadata.outcome: "timeout"`.

This should be rare. If it fires, something upstream is stuck (e.g., a single heavy task running for >4 hours). Operator action: investigate the holder, manually clear the Redis hash if needed: `docker exec tapestry-redis redis-cli DEL taskQueue:resource-class:neo4j-heavy:holders`.

#### Composes additively with story #13

- Per-`(taskName, pubkey)` jobId dedup → unchanged.
- Per-task concurrency from `concurrencyByTask` → unchanged.
- Resource-class semaphore wraps the Worker callback BEFORE `processor.processJob` runs.

For a tagged task with `concurrencyByTask: 2` and `resourceClassCaps.neo4j-heavy: 1`: the **effective** concurrency is the more restrictive of the two (here, 1 — one per class regardless of per-task budget).

## 11. Conf templates are the source of truth for fresh containers

Story #16 / ADR 0014. Until 2026-05-21 the Docker entrypoint regenerated `/etc/brainstorm.conf` from an 80-line heredoc embedded in `docker/entrypoint.sh`. `config/brainstorm.conf.template` was consulted only by the bare-metal install path and had silently drifted to be missing ~25 of the variables the heredoc carried — including story #13's `TASK_QUEUE_ENABLED=false`, which never reached any fresh Docker container until an operator manually added the line.

After story #16, the contract for fresh containers is:

> **`config/brainstorm.conf.template` is the single source of truth for `/etc/brainstorm.conf`.** The entrypoint renders the template via `tools/render-conf-template.js` at every container start; the heredoc is gone.

### What this means for the operator

- **Adding a new feature flag or env var.** Edit `config/brainstorm.conf.template`, commit, rebuild the image. The next container that starts gets the new line in `/etc/brainstorm.conf` automatically — no entrypoint.sh edit needed.
- **The renderer fails the boot loudly on a missing env var.** If the template references `${SOME_NEW_VAR}` and the entrypoint never exports it, the container's boot fails with `RenderError: missing env vars in brainstorm.conf.template: SOME_NEW_VAR`. This is by design — better than silently emitting `SOME_NEW_VAR=""` and discovering it at runtime. When adding a template variable, also add the corresponding `export` to `docker/entrypoint.sh` (currently exports `OWNER_PUBKEY`, `ADMIN_PUBKEYS`, `NEO4J_PASSWORD`, `DOMAIN_NAME`, `RELAY_URL`, `BRAINSTORM_MODULE_BASE_DIR`, `BRAINSTORM_NODE_BIN`, `SESSION_SECRET`, `OWNER_NPUB`).
- **`brainstorm-task-queue.json` follows the conditional-copy pattern.** Its template at `config/brainstorm-task-queue.json.template` is copied to `/etc/brainstorm-task-queue.json` only if the destination does not already exist. Operator edits to the live JSON survive container restarts (unlike `/etc/brainstorm.conf`, which is regenerated unconditionally on every boot).

### The trap — edits inside a running container are lost on restart

The entrypoint **unconditionally overwrites** `/etc/brainstorm.conf` on every container start. This matches the prior heredoc behavior; story #16 did not change it.

If you `docker exec tapestry sed -i ... /etc/brainstorm.conf` to flip a flag (the pattern used during story #15's `TASK_QUEUE_ENABLED` rollout — see §10.1), your edit lasts **until the next container restart**. To make an edit persist:

1. **Repo-level (recommended).** Edit `config/brainstorm.conf.template`, commit, rebuild the image. Fresh containers and restarts both pick it up.
2. **Operator-level (long-running containers).** Use the `if grep -q ...; else docker exec ... >> ...` recipe below for an in-container append, then **also** update the template so the next deploy doesn't reintroduce the old value.

```bash
# Append-if-absent recipe (use inside a running container):
docker exec tapestry bash -c '
  if grep -q "^export FOO=" /etc/brainstorm.conf; then
    echo "FOO already set"
  else
    echo "export FOO=value" >> /etc/brainstorm.conf
    echo "appended FOO"
  fi
'
# This wins only until the next restart, when the template re-renders.
```

### Drift sentinels

`test/entrypoint-template-rendering.test.js` carries two drift sentinels that fail npm test if:
- A `<<CONFEOF` heredoc reappears in `docker/entrypoint.sh` (T7 — re-introducing a second source of truth).
- The `render-conf-template.js` invocation count moves off exactly one (T8 — second write-path, or lost integration).

A future reviewer who sees these tests fail should stop and ask whether the change is reintroducing the very drift class story #16 closed.

## 12. Reconciliation — four independent tasks (story #23 / ADR 0020)

Reconciliation repairs drift between strfry (canonical nostr event store) and the Neo4j social graph (FOLLOWS / MUTES / REPORTS from kind 3 / 10000 / 1984). Story #23 **superseded** the single `reconciliation.sh --mode` engine — whose eager full-graph `DISTINCT u.pubkey ... ORDER BY u.pubkey SKIP/LIMIT` rater-pagination hit Neo4j's `transaction.total.max` and crashed `reconcileAll` at 32M edges — with **four independent task scripts**, each tuned to its own guarantee. The legacy `reconciliation` registry key was **removed**. §12.8 documents a separate reconcile for `TAGS` (`reconcileTaggingEdges`, ADR `tagging-edges/0002`), which follows the relay per tagging address and shares none of this diff/apply machinery.

| Task | Script | Scope | Mechanism | `neo4j-heavy`? |
|---|---|---|---|---|
| `reconcileRecent` | `reconcileRecent.sh` | authors with an event in a bounded, overridable recency window (default 6h) | streamed parameterized `WHERE u.pubkey IN $list` over the recent set | yes |
| `reconcileNetwork` | `reconcileNetwork.sh` | a parameterized trusted network (`influence ≥ cutoff` and/or `hops ≤ N`) | full strfry dump → converter `--filterAuthorsFile` (network set from Neo4j) → streamed extractor | yes |
| `reconcileAll` | `reconcileAll.sh` | **truly all** (~32M FOLLOWS edges) | reactive-streamed Neo4j → TSV + Node strfry→TSV + `LC_ALL=C sort -u` + `comm` **merge-join** + APOC apply | yes |
| `reconcileAuthor` | `reconcileAuthor.sh` | one author (`--pubkey <hex>`) | streamed one-element `IN` query | **no** (stays responsive for interactive triggers) |

All four reuse the existing diff (`calculate{Mutes,Reports,Follows}Updates.js`) and APOC apply commands. Each emits structured events under its **own** `taskName` (fixes #22 OBS-2 — `/api/scheduled-tasks/history?taskId=reconcileX` resolves per task) with a `trap`-based terminal-on-failure (fixes #22 OBS-1 — a crash never reads as perpetually "running"). The three bulk sweeps serialize via the `neo4j-heavy` semaphore (ADR 0013).

### 12.1 `reconcileRecent` — bounded recency window

```bash
RECONCILE_RECENT_MAX_RECENCY_SECONDS=21600   # default 6h (env / brainstorm.conf)
reconcileRecent.sh --recency 3600            # per-run override (1h)
```

Lookback = `min(now − watermark + RECONCILIATION_OVERLAP_SECONDS, max_recency)`. **No watermark ⇒ just the max-recency window; NEVER a bootstrap full pass** (the previous engine's runaway). Drift older than the window is `reconcileNetwork`'s / `reconcileAll`'s job.

Watermark at `/var/lib/brainstorm/pipeline/reconciliation/state.json`; advanced on success only.

### 12.2 `reconcileNetwork` — parameterized trusted network

Reconciles a configurable **trusted network**, defined by a Neo4j property predicate. Two parameters; both ANDed when both given:

```bash
reconcileNetwork.sh                             # default: influence ≥ 0.05 (verified)
reconcileNetwork.sh --influence 0.05            # verified
reconcileNetwork.sh --hops 3                    # within 3 follow-hops of the owner
reconcileNetwork.sh --influence 0.1 --hops 2    # both, ANDed
```

The default cutoff reads `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` from `/etc/graperank.conf` (default `0.05`) — the same threshold the rest of the system uses for "verified."

**SAFETY GUARDS** (enforced in the script regardless of caller): refuses `influence ≤ 0` (selects every user), `hops ≥ 999` (the disconnected sentinel — also selects every user), or no substantive constraint. Without those, the predicate would degenerate into an unconstrained full scan — the exact workload that crashed `reconcileAll`.

### 12.3 `reconcileAll` — truly all, sorted merge-join

The complete oracle / incident-recovery sweep. **Mutes/reports** use the per-pubkey path (bounded by their small scale, ~190k/170k). **Follows** uses a **sorted merge-join** at 32M-edge scale:

1. `extractFollowsToTSV.js` streams the full Neo4j FOLLOWS to a TSV via reactive `subscribe` (no eager operator, bounded transaction memory).
2. `strfryToKind3Events.sh` dumps all kind-3; `kind3EventsToFollowsTSV.js` streams events to a parallel TSV (`rater\tratee` per p-tag, lowercased, 64-hex-filtered).
3. `LC_ALL=C sort -u -T ${BASE_DIR}` external-sorts both files.
4. `comm -23` emits adds (strfry-only); `comm -13` emits deletes (Neo4j-only).
5. `awk` converts to APOC apply JSON; existing apply commands run.

**Bounded memory regardless of graph size.** Target: **< 1h** at 32M edges; staging-measured runtime after the jq → Node converter optimization: **~14 minutes**. Schedule weekly in a low-traffic window (registry timeout is 8h safety margin).

For incident recovery (drift the incremental sweep wouldn't catch — partial write, botched migration, direct Neo4j surgery), trigger `reconcileAll` manually.

### 12.4 `reconcileAuthor` — single author

```bash
reconcileAuthor.sh --pubkey <64-hex>
```

Scope is exactly one author. **No watermark, no GDS reprojection** (single-author change doesn't warrant either). Intentionally **NOT `neo4j-heavy`** — a tiny point repair that stays responsive for interactive triggers and never queues behind a sweep. (The profile-page / API trigger surfaces are a separate follow-up story; the engine is delivered here.)

### 12.5 Config (`/etc/brainstorm.conf`)

- `RECONCILIATION_OVERLAP_SECONDS` (default `3600`) — safety window re-scanned on top of `reconcileRecent`'s watermark. Re-scanning is idempotent.
- `RECONCILE_RECENT_MAX_RECENCY_SECONDS` (default `21600` = 6h) — the bounded cap.

### 12.6 Observability

Per-task structured events in `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl`:
- `TASK_START` / `TASK_END` / `TASK_ERROR` under each task's **own** `taskName` (OBS-2 fix).
- `TASK_ERROR` on **every** non-zero exit path via a script-level `trap` (OBS-1 fix).
- Per-phase `PROGRESS` with `added`, `deleted`, `edge_counts_before`/`after`, `duration`.

Human log: `${BRAINSTORM_LOG_DIR}/reconciliation.log` (per-phase + extractor/converter step traces).

### 12.7 Deprecated / removed (story #23)

- The legacy `reconciliation` registry task key was **removed**. Use the four explicit task keys.
- The `reconciliation.sh --mode` engine is **superseded** by the four scripts; the file remains on disk as dead code (clean-removal is a tracked follow-up).
- The `getCurrentFollowsFromNeo4j_working.js` / `_working2.js` cruft variants are **removed**.
- The eager-pagination `getRaterCount()` / `getRaters()` functions are **removed** from all three Neo4j extractors; `--authorsFromDir` is now required.
- The host `systemd/reconcile.timer` remains **deprecated** (bypasses queue + semaphore); confirm `systemctl is-enabled reconcile.timer` is disabled. Unit-file removal is a tracked follow-up.

### 12.8 `reconcileTaggingEdges` — the tagging gap-filling pass (tagging-edges #2 / ADR tagging-edges/0002)

Brings the graph's `TAGS` relationships (BIBLE §6) into agreement with this instance's relay. The first run is the backfill; later runs repair drift. `neo4j-heavy` (it waits behind scoring runs, and they wait for it); 30-minute time-out. Script: `src/pipeline/tagging-edges/reconcileTaggingEdges.sh`, which takes a kernel `flock` on `/var/lib/brainstorm/tagging-edges/pass.lock` and `exec`s the Node runner, so two passes never run at once.

**Running it.** Task Explorer, or `POST /api/run-task?taskName=reconcileTaggingEdges` (signed in). It takes no arguments. Locally, restart `brainstorm` first (`docker exec tapestry supervisorctl restart brainstorm`) so the registry entry, the routes and the boot hook load, and build the UI for the Dashboard's constraints list. Do not run the wrapper by hand: it passes the lock check but skips the `neo4j-heavy` wait (a hand-run of the Node file without the pass's lock is refused: the check wants an exclusive flock on `pass.lock` itself on fd 9, and compares inodes, ADR `tagging-edges/0002` C20). The check reads the inode from the kernel's `/proc/<pid>/fdinfo` `ino:` line, which Linux prints from 5.14: on an older host kernel every start is refused.

**Scheduling it.** Fresh installs seed a **disabled** daily entry (`seed:reconcileTaggingEdges`); turn it on in Scheduled Tasks. Staging and production keep their existing schedule files: add a daily `reconcileTaggingEdges` entry there by hand (Scheduled Tasks → add), with no arguments. Adding an interval entry enabled, or enabling one, starts its first run at once (§13.2), so on a host with no backfill yet that run is the backfill; production's was (2026-09-30). Once the real-time path is on (§12.9), a scheduled pass is its backstop for taggings that leave the relay with no event.

**The panel.** Settings › Relays › **Tagging pipeline**, the sub-tab directly after ⚡ Streaming ETL, seen by the owner and admins as the rest of Settings is (tagging-edges #4, ADR `tagging-edges/0004`). It shows the pass: whether one is running, judged by its process as `running` is below and never by the stored outcome; the latest pass and up to nine before it, with what each did; the held list, 50 at a time, with each entry's reason and whether a confirmation is pending (and until when), expired, of unknown expiry, or unreadable; and the backstop, the enabled Scheduled Tasks entries that run `reconcileTaggingEdges` (listed as "Reconcile tagging relationships"), with a warning when none is enabled, more than one is, the one has no next run, or it runs less often than daily. It also shows the real-time path (§12.9) and the drift between the relay and the graph (below). Every outcome, reason, state and error code is shown with a sentence explaining it; a code the panel does not know is shown as it is, with "not recognised". It re-reads the pass and path status, and the switch's record, every 5 s, and the schedule list every minute. It carries the real-time path's switch, for the owner or an admin: **Turn off**, after a prompt, or **Turn on**, with the record of who last turned the path on or off, and when, and the last 10 changes (tagging-edges #5, ADR `tagging-edges/0005`; §12.9 "Turning it on and off"). Apart from that switch it changes nothing: until story 6, the Task Explorer runs a pass, and the console snippet below confirms held removals. The JSON routes in this section and §12.9 stay the reference. The panel reads them, the owner-or-admin `GET /api/tagging-edges/realtime/switch` included, and sends one POST, the switch's.

**Drift.** `GET /api/tagging-edges/drift-counts` counts, in parallel, this relay's taggings (the kind-39999 events carrying either `nostr-user-tag` stamp, each counted once, in one `strfry scan --count` over both stamps: the number of tagging addresses, a pass's `taggingsRead`) and the graph's `TAGS` relationships, each within 10 s. Only a signed-in owner or admin: no session → 401 (loopback included), any other session → 403 `Owner or admin access required`, a cross-origin read → 403 `cross-site request refused`. A no-cors request from another site carries no `Origin` and passes, but never reads the answer. Such a request joins an answer still pending, so a new pair of counts starts only after the previous answer settles, and repeated requests can start one pair after another, as fast as answers settle. A count that lost its race with the 10 s limit is abandoned, not stopped: the relay count's `strfry` child is killed at its own 10 s limit, but a graph count keeps its Neo4j session until Neo4j ends it. So abandoned graph counts can run beside newer ones, bounded by the database driver's pool of 20 connections. They only read, and nobody can read their answer. It answers `{ success, limitMs, relay, graph, stamps }`: each count is `{ known: true, count, takenAt, ms }`, or `{ known: false, code, takenAt, ms }` when it failed or ran past 10 s (`timeout`), never 0; `identity` means a stamp identity did not resolve, and nothing was counted on the relay. `stamps` holds each identity's 8-character prefix, or null for one that did not resolve; an `identity` answer also names which one (`identity`: `canonical` or `local`). A request made while a count runs shares that count. It only reads: it writes nothing and never starts a pass. The panel counts when it opens and on **Recount**, never on a timer, and shows the difference (relay minus graph), the part the newest finished pass explains (its `refused.total` − `held.total` − `relationships.leftInPlace`, labelled with its run id and when it ended), and the rest as "unexplained", beside what that pass left to the next one (lost races, conflicting addresses) and, while the path is on, the path's refused taggings and parked addresses. When either count was taken before that pass ended (the earlier `takenAt` is before its `endedAt`), the pass cannot explain the counts: the panel says they predate it and asks for a **Recount** instead of presenting the rest as unexplained.

**Reading the report.** `GET /api/tagging-edges/status` (public; open it in a browser on the instance). `latest.outcome`:

| Outcome | Meaning |
|---|---|
| `done` | Every planned change applied. Lost races (`relationships.lostRace`) and conflicting addresses (`anomalies`) are counted and left to the next pass; `reason` names them when there are any. `relationships.added` / `changed` / `removed` / `unchanged`, `peopleAdded`, `refused.byReason` say what happened. On a first run, `added = taggingsRead − refused.total`. |
| `done-removals-held` | Every create, update and move applied; removals over the limit (more than 50 **and** more than a tenth of the tagging relationships at start — on a confirmed run, of those left after the confirmed removals) were held. `held.total` / `held.byReason`; the list is at `GET /api/tagging-edges/held?runId=<latest runId>`. |
| `refused` | A start check failed and no relationship or person changed (a `schema` refusal can follow the pass's own `CREATE CONSTRAINT tags_address` when the rule did not come ONLINE within 60 s; the rule then stays): `reasonCode` `identity` (which stamp identity, the problem and its source), `config` (`NEO4J_URI` / `NEO4J_USER` not set, or `failure.code: 'driver'` when the database driver could not be built from them), or `schema`, where `failure.code` says which: a Neo4j or driver error code, or `no-status` for an error without one, when the schema could not be read or the rule created. The schema step is the pass's first contact with Neo4j, so this is most often Neo4j not answering (`ServiceUnavailable`) or refusing the password (`Neo.ClientError.Security.*`): fix that first, then run the pass again; raise any other code with the owner. The rest are `tags_address-not-online` (the rule exists but was still being built after 60 s: wait, then run the pass again), `tags_address-missing` (the rule is still absent: a rule with another definition holds the name, so the pass did not create it, or the pass's own `CREATE` changed nothing; the Dashboard fix runs the same statement, so raise it with the owner, as below), or `nostrUser_pubkey-missing` (run the Dashboard constraints fix). |
| `failed` | A read failed (`failure.read`: `graph` or `relay`; no relationship or person changed; on a confirmed run the confirmation is spent, since it is claimed before the reads, and the next pass holds the over-limit removals again), planning failed (`failure.stage: 'plan'`; the same), a write failed (`failure.stage: 'write'`, with `failure.read: 'graph-verify'` when a batch's re-read failed; committed batches stand, each tagging at one version), the held list could not be written (`reasonCode: 'report'`, `failure.stage: 'report'`: the creates, updates and moves have applied, and on a confirmed run so have the confirmed removals and the confirmation is spent; there is no held list), an unexpected error ended it (`reasonCode: 'error'`, `failure.stage: 'unexpected'`), or it was stopped (`stopped: true` — a time-out, or a container restart or re-creation such as a deploy; `reasonCode: 'signal'` for SIGTERM/SIGINT). A backend-only restart (`supervisorctl restart brainstorm`) does not stop a running pass: it finishes. The dead worker's `neo4j-heavy` lease is not released, so the queue's one stalled re-run, and every scoring run, waits up to 4 h (see Lease), after which the re-run performs an ordinary pass (unless another heavy task, such as a scoring run, takes the freed slot first and outlasts the re-run's own 4 h wait, which began after the dead pass took its lease; the re-run then fails `RESOURCE_CLASS_WAIT_TIMEOUT`, §10.6, and the next scheduled or on-demand pass does the work). The next pass finishes the job. |

Two report-write failures leave the report behind the pass. If the first record cannot be written, the pass stops before any graph contact and the previous report stays `latest`; only the events say so (`TASK_ERROR` with `stage: 'report'`, and `TASK_END` with `outcome: 'failed'`, `reasonCode: 'report'`). If only the final write fails, the stored record still reads `failed`, `stopped: true`, although the pass ran to the end; its `TASK_ERROR` carries `reportWriteFailed: true`.

`latest.running` is true only while that pass's process is alive. Pre-images of relationships that carried keys outside the nine are kept in `/var/lib/brainstorm/tagging-edges/preimages/<runId>.jsonl` (served by no route; prune only by hand).

**Confirming held removals.** Only the owner, signed in, from the instance's own page (a browser console on it):

```js
const s = await (await fetch('/api/tagging-edges/status')).json();
await (await fetch('/api/tagging-edges/confirm-held-removals', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runId: s.latest.runId }),
})).json();
```

The confirmation is single-use, bound to that report's held list, and valid 24 h; the next pass to pass its start checks claims it and removes only the confirmed entries still due (other removals are judged against the limit over the relationships left after the confirmed ones, `limit.baseAfterConfirmed`; if they exceed it they are held again for a second confirmation). The answer says whether it enqueued a pass (`enqueued`); if the queue is down, start one from the Task Explorer. A confirmation never rides a task argument or a schedule entry.

**Lease.** A deploy, or a backend-only restart, while a heavy job runs can leave a stale `neo4j-heavy` lease that holds this pass and scoring for up to 4 h — see "The `RESOURCE_CLASS_WAIT_TIMEOUT` failure mode" in §10.6.

**Measured durations.** Estimated under a minute for the census-scale backfill (about 7,030 creates). If a measured `durationMs` exceeds a fifth of the 30-minute time-out, raise the time-out in the same change; check the read time-outs the same way against `reads.*.ms` (a 10× margin or more).

- **Local end-to-end run** (2026-09-28, the local instance, its relay holding 7,030 taggings; on the working tree about a minute before commit `64885ce7` was made (03:26:03Z) — nothing records that tree, and `64885ce7`'s message reports this run's figures; the later implementation commits are `da787035` (a comment) and the review-round-2 fixes `8784f2ed`, after which the run was not repeated). An earlier pass, `20260928T032350Z-fa59e6da` (0 events, 0 rows), ran before the backfill; the status route showed it at story 2's review, and nothing below counts it. Backfill `20260928T032430Z-08965d1d`: `done` in 2,595 ms. Phases (ms): identities 30, schema 98, graph-read 7, relay-read 72 (10,405 events, 8,227,479 bytes), plan 47, write-creates 2,330 over 29 batches. Added 7,030 = `taggingsRead` 7,030 − `refused.total` 0; `peopleAdded` 6,196; `unresolved` 6. Second pass `20260928T032501Z-472c2596`: `done` in 524 ms, 7,030 unchanged, nothing added, changed or removed. 2.6 s is far below a fifth of the time-out (6 min), so the 30-minute time-out stands; the reads are far inside their time-outs: the backfill's relay scan 67 ms against 60 s, and the second pass's graph read 204 ms for 7,030 rows against 120 s (the backfill's graph read, 5 ms, read an empty graph).
- **Staging backfill** (2026-09-28; read from staging's public `GET /api/tagging-edges/status` at 13:29Z). Pass `20260928T130902Z-13cedd2f`: `done` in 11,149 ms. Phases (ms): identities 128, schema 402, graph-read 127, relay-read 3,031 (10,404 events, 8,226,629 bytes), plan 127, write-creates 7,285 over 29 batches. Added 7,023 = `taggingsRead` 7,023 − `refused.total` 0; `peopleAdded` 5,837; `unresolved` 6; nothing held. At 13:29Z staging's relay held 7,023 taggings carrying either `nostr-user-tag` stamp (`GET /api/strfry/scan/count`) and its graph 7,023 `TAGS` at 7,023 distinct addresses (read-only Cypher). 11.1 s is far below a fifth of the time-out (6 min), so the 30-minute time-out stands; the relay scan, 3,024 ms against 60 s, keeps a 19× margin (the graph read, 102 ms, read an empty graph). Staging's next pass was the first run of its daily entry, added on 2026-09-30: `20260930T142619Z-4db0d448`, `done` in 5,104 ms, 3 added, 7,023 unchanged (relay read 3,400 ms, a 17× margin).
- **Production backfill** (2026-09-30; read from production's public status route at 14:32Z). Pass `20260930T142438Z-7e3f2a03`, the first run of the new daily entry: `done` in 14,503 ms. Phases (ms): identities 146, schema 513, graph-read 162, relay-read 5,885 (10,408 events, 8,230,705 bytes), plan 155, write-creates 7,600. Added 7,033 = `taggingsRead` 7,033 − `refused.total` 0; `peopleAdded` 5,846; `unresolved` 6; nothing held. 14.5 s is far below a fifth of the time-out (6 min). The relay scan, 5,879 ms against 60 s, keeps a 10.2× margin, just over the 10× this section asks for; the pass straight after read the relay in 296 ms. If a first read on another host, or any later read, takes over 6 s, raise the relay read's time-out in the same change. At about 14:33Z the relay held 7,033 taggings carrying either stamp, and the graph 7,033 `TAGS` at 7,033 distinct addresses.

#### The one-per-tagging rule reaches an existing instance with no owner step

`tags_address` (`CREATE CONSTRAINT tags_address IF NOT EXISTS FOR ()-[r:TAGS]-() REQUIRE r.address IS UNIQUE`) is the first schema addition since the constraints check began comparing by name. The control panel creates it at every start (every deploy re-creates the container), retrying for up to 30 minutes while Neo4j starts or its password is being set, and logs one line if it cannot (`[tagging-edges] uniqueness rule tags_address not created: <code>`). Confirm it on each host **before that host's backfill**, with either:

- (a) the boot that made it: `docker exec tapestry grep 'tagging-edges' /var/log/supervisor/brainstorm.log` shows `[tagging-edges] uniqueness rule tags_address created`; or
- (b) `SHOW CONSTRAINTS YIELD name, entityType WHERE name = 'tags_address'` returns one row reading `RELATIONSHIP`.

The Dashboard banner and `GET /api/status/neo4j-constraints` (`"status": "set up"`) check the name only (the banner only on a UI built with this change). If creation fails, the line reads `… not created: <code>`: `no-status` is an error without a Neo4j status, such as a kernel version too old for relationship uniqueness (ADR `tagging-edges/0002` Risk 1); `name-taken` is a rule with another definition holding the name; `no-change` is a `CREATE` after which the rule is still not listed. Do not run that host's backfill (the pass refuses `schema` anyway) and raise it with the owner.

Install Firmware (Settings › Firmware) also waits for the rule while firmware is not fully installed: the server's check compares by name, so a rule present only under another name reads missing there, and the Dashboard fix cannot clear it (`IF NOT EXISTS` sees the equivalent rule and does nothing). Neo4j cannot rename a constraint: with no pass running, `DROP CONSTRAINT <that name>`, then run the Dashboard fix (or the `CREATE CONSTRAINT tags_address …` statement above).

Fallbacks: the Dashboard's fix button, or `setup/neo4jConstraintsAndIndexes.sh` (its last statement). The pass itself creates the rule if it is missing, and refuses (`schema`) without it.

### 12.9 `tagging-edges-realtime` — the tagging real-time path (tagging-edges #3 / ADR tagging-edges/0003)

Once the owner or an admin turns it on, a tagging change that reaches this instance's relay, by any way in (a client's websocket publish, the instance's own publish, a router stream, a sync or an import, back-dated history included), shows up in the graph's `TAGS` (BIBLE §6) within a minute, and after downtime the path catches up by itself. The pass (§12.8) stays the backstop for what the path cannot see. **It ships off on every instance**, fresh installs included.

It is its own supervisord program, `tagging-edges-realtime`: a bash wrapper, `src/pipeline/tagging-edges/realtime/run.sh`, that idles while the switch is off (about 3 MB, no Node process) and, while it is on, runs one Node process (heap capped at 384 MB, about 60 MB in use) holding one subscription to the relay inside the container (`ws://127.0.0.1:7777`, not `/relay`). The wrapper exits by itself only as a second instance, or when it cannot open `realtime/daemon.lock` (after 30 s each time, and supervisord restarts it), so supervisord never gives up on it. After any exit within 60 s of starting, a clean one and an off included, the wrapper waits before it can start the path again, 1 s doubling to 30 s; only a run of 60 s or more resets that wait to 1 s, and after such a run only a failed exit waits (`run.sh`). The path writes only through the pass's port, takes no pass lock and no `neo4j-heavy` lease, enqueues nothing, and never reads the follows queue: a pass is never refused because of it, and follows / mutes / reports streaming is independent of it both ways. Its state is in `/var/lib/brainstorm/tagging-edges/realtime/` on the `tapestry-data` volume (`switch.json` and its history `switch-history.json`, `status.json`, `started.json`, the marker its first start leaves, and `record.json` + `journal.jsonl`, its record of where it left off); the pass's pruning never touches it. Pre-images of edges it changes that carried keys outside the nine go to the pass's `preimages/` folder, one file per Node start, marked `writer: 'realtime'` (the status's `preimageFile`). Do not run `index.js` by hand: it refuses unless the wrapper's lock (`realtime/daemon.lock`) is held on fd 8 (the pass's inode check, §12.8, with the same Linux 5.14 floor). The wrapper opens that file once, when it starts: if `realtime/` or `daemon.lock` is deleted while the program runs, every later Node start is refused until the program is restarted (`docker exec tapestry supervisorctl restart tagging-edges-realtime`).

**Turning it on and off.** The owner or an admin, signed in, from the Tagging pipeline panel (§12.8): **Turn off** or **Turn on** in its real-time path section (tagging-edges #5, ADR `tagging-edges/0005`). The server enforces who may, and the last change wins, whoever made it: an admin may turn back on what the owner turned off, and the other way round. **Turn off** first opens a prompt. It says that the path stops reflecting changes within seconds, that what it holds is kept and what the relay stores meanwhile is caught up at the next **Turn on** (apart from the cases below that wait for a pass), and what keeps the graph in step meanwhile, as the panel's backstop section describes the schedule. Before the path has completed its first start (the status has no `firstStartedAt`), it says instead that what the path has gathered so far is dropped, that the next **Turn on** is a first start again, and that a pass should run once the path shows live (step 4 below). Cancel sends nothing. **Turn on** asks nothing; while the pass's report holds no finished pass, a warning beside it says that taggings already on the relay wait for a pass. While a change is under way the control is disabled; with no answer within 15 s it is enabled again, says the outcome is unknown, and shows the state from the next read. The console snippet still works, for the owner or an admin, from the instance's own page (a browser console on it), and is recorded the same way:

```js
await (await fetch('/api/tagging-edges/realtime/switch', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: true }),
})).json();
```

`{ on: false }` turns it off. The answer is `{ success, on, changedAt, recorded: true, takesEffectWithinSeconds: 5 }`. The choice is `switch.json` on the data volume, so it survives restarts and deploys; a missing or unreadable file reads as off, and an unreadable one also shows `switchUnreadable: true` in the status. **Off** takes effect within 5 s: the path stops scheduling, kills its own `strfry scan`, gives an in-flight write up to 2 s (a commit already sent may finish), flushes its journal and status and exits, and the wrapper idles. While the data volume is full, that flush or that status write may fail, and the path exits anyway (the journal bullet in "Things to know"). **On** starts the path within a few seconds, and within about 30 s when its last run ended within a minute of starting (the wrapper's wait above). Meanwhile the status's `inStartWindow` (below) holds the panel at "starting" for up to 60 s from the switch-on, rather than showing the path as on but not running. The very first start takes a baseline and creates nothing for what the relay already holds; every later one catches up on what the relay stored while the path was off. Before it subscribes, the first start reads the graph's `TAGS` keys once, for at most 10 s (normally tens of milliseconds), and so does a start that has lost its record (`not-established` below); if Neo4j does not answer in time, the start goes on without them. The first start then runs one catch-up at once: it finds a revoke stored while the path was starting, when the version it names is one the graph records or the path has seen (any other waits for the extra pass below), and brings a relationship the backfill left behind the relay up to the relay's version within the minute. It still creates nothing for a version the relay held at the first start. No session → 401 (loopback included), a session that is neither the owner's nor an admin's → 403, cross-site → 403, a body that is not JSON → 415, `on` not a boolean → 400; a refusal changes and records nothing. A 403 says which: `Owner or admin access required` means the session is neither the owner's nor an admin's (another key, or a sign-in that did not complete), or `BRAINSTORM_OWNER_PUBKEY` in `brainstorm.conf` is not the owner's lowercase 64-hex key, or an admin's key is not in the admin list the server checks (`getAdminPubkeys`): `adminPubkeys` in `/var/lib/brainstorm/settings.json` on the data volume when that list is not empty (the list `POST /api/admin/add` and `/api/admin/remove` write), and only otherwise `BRAINSTORM_ADMIN_PUBKEYS` in `brainstorm.conf`. The owner's key and the admin list are re-read on every request, so a removed admin is refused on their next request, unless the removal emptied `adminPubkeys` and `BRAINSTORM_ADMIN_PUBKEYS` names them. A 403 `cross-site request refused` means the request's `Origin` names a hostname other than its `Host`'s, so use the panel, or run the snippet from a tab on the instance's own address. A failed on (the switch could not be read or written) answers 500 with a `code` and changes nothing: check that the data volume has free space and is readable and writable. The switch's success path first runs live at step 3 below; a 403 there changes nothing, and the path stays off.

**Who changed it.** Every accepted request is a change, and records who made it, `owner` or `admin` with the first 8 characters of the caller's key, and when, from the panel and the snippet alike. `switch.json` holds the latest change, written with the on/off state itself, and `switch-history.json` beside it keeps the last 10, newest first; a failed history write never fails a change. The one exception is an off whose `switch.json` write fails (a full data volume): the file is removed, so the off still takes effect (a missing file reads as off), and the answer is `{ success, on: false, recorded: false, takesEffectWithinSeconds: 5 }`. The panel then shows the path off with no who or when for that change, never an earlier change as the latest. While the data volume is full, or the history file gives a read error, the history can also lose earlier changes (ADR `tagging-edges/0005` § Consequences, residuals (a) and (b)). A `switch.json` written before story 5 reads as the owner's change, with its stored time and key. Only a signed-in owner or admin may read who: `GET /api/tagging-edges/realtime/switch` refuses as the POST does, cross-site included, writes nothing, and answers `{ success, on, switchUnreadable, historyUnreadable, state, latest, history }`. `state` is `recorded`, `switch-unreadable`, `unrecorded-off` (the last change, an off, was not recorded) or `never-switched` (no change recorded: the path ships off). Branch on `state` first: `latest` is null for `never-switched` and `switch-unreadable`, and otherwise `{ on, at, role, key }`, as each `history` entry is, with `at`, `role` and `key` null for a change not recorded, as the `unrecorded-off` latest is. `history` is empty for `never-switched`; for `switch-unreadable` it still lists the history file's changes. The panel shows the latest change, for example "Turned off by an admin (ab12cd34…) at 14:02", and the history. The public status carries no who. A hand edit of `switch.json` is the only way to switch that is not recorded.

**Reading its status.** `GET /api/tagging-edges/realtime/status` (public; open it in a browser on the instance). It sits beside the pass's report and does not change it. While the path runs it rewrites its status within 10 s of a change and at least every 30 s; `stale` says when it has not for over a minute. The Tagging pipeline panel (§12.8) shows it, explained; this route stays the reference.

| Field | Meaning |
|---|---|
| `on`, `onSince` | The switch (read from `switch.json`, so an off shows at once). `onSince` is when the switch last went from off to on, whoever made the change and however; an on while already on does not move it. `null` while off. |
| `running`, `runningSince` | Whether the Node process is alive (process liveness, never the stored value). While it is false, `state`, `subscription` and the rest are what the last process wrote: one killed without writing (a SIGKILL, an out-of-memory abort) can leave `live` there, and after the switch goes back on they show the last run until the new one writes. Read `running` first. |
| `inStartWindow` | True while the path is on, less than 60 s has passed since `onSince` on the server's clock, and no process that started at or after `onSince` is running: the path is starting, which can take up to about 30 s (the wrapper's wait above). A process that started before `onSince`, left from a quick off then on, does not count, although `running` reads true for it. The panel shows "starting" then, never that the process is not running. False while off, and from 60 s on. |
| `state` | `off`; `starting` (every start until it has subscribed, and the first start's baseline); `waiting-setup` (a bad setup: it writes nothing and waits, see `setupProblem`); `waiting-graph` or `waiting-relay` (it waits and retries; nothing is lost); `catching-up` (a catch-up is under way, and live changes are still applied meanwhile; or a lost record's re-baseline, whose relay scan they wait for); `live`; `stopped`. |
| `firstStartedAt` | Its first start. Counts run from here, and it never creates a relationship for a version the relay held before it (that is the backfill's). |
| `relay.lastReadOkAt`, `subscription`, `lastReflectedAt`, `lastRound` | The last successful relay read; the subscription's state and last event; the last change it reflected; the last round's time (`ms`) and size. The last two are kept across restarts until a newer one replaces them. |
| `catchUp` | `underway`, the `current` one, and the `last` one: `outcome` `done` (with its duration and what it reflected), `stopped`, `failed` (`stage` `graph-keys` or `stamp-scan` for a failed read, `unexpected` for an error in the path's own code, which `lastError` then names; retried with 5→60 s backoff), or `not-established` (`reason` `record-missing`, `record-unreadable`, `journal-unreadable` or `identity-changed`): what the relay stored during that gap waits for the next pass. A lost record shows `not-established` as soon as the path has re-read the relay; a `failed` or `stopped` catch-up after it keeps that `reason` until one completes and reports it, across restarts too. |
| `counts` | Since `firstStartedAt`: `added`, `changed` (`changedBy`, moves included), `removed`, `unchanged`, `peopleAdded`; `refused` and `leftInPlace` by reason (the path's `leftInPlace` stays 0: it reads the graph only at tagging addresses, so it never finds a relationship to leave in place; the pass's report carries the real figure); `deletionsMatchedNothing`, `deletionsForeign` (targets another author named); `failedReads`, `lostRaces`, `dbRefused` by reason; `heldPreExisting` (creates left to the backfill), `removalsNotPrompted` (removals left to the pass), `relooks`, `conflicts`, `droppedOverBacklog`. `countsReset` when `status.json` was lost. |
| `pending`, `parked`, `seen`, `heard`, `journal` | Queue and record sizes: addresses waiting for or in a round, and addresses parked (after repeated database refusals or read time-outs, below); `seen`, the versions it has completed or took as its baseline; `heard`, the addresses whose latest version it has learned (delivered, read or scanned) but not yet completed. |
| `setupProblem` | `null`, a stamp identity (which one, the problem, its source) or a database rule (`tags_address` not present and ONLINE, or `nostrUser_pubkey` missing). A rule is picked up within 15 s of appearing (the control panel's boot hook, a pass's pre-flight or the Dashboard fix; the path never creates one); a corrected identity at the next Node start (restart the program, or turn the switch off and on). With a bad identity the path does not subscribe at all, since its filter needs both identities: what the relay stores meanwhile is found by the catch-up at the next start with a usable identity, or, before a first start, counts as held since before it (the backfill's). A missing rule keeps the subscription. |
| `lastError` | `{ at, stage, code, text }`, kept across restarts (a crash's `unexpected` included) until a newer error replaces it. |
| `stale` | True when the status is more than 60 s old while the process is alive. |
| `statusUnreadable` | Present, `true`, when `status.json` cannot be read. The switch fields still answer; `running` reads false, since the process is named in `status.json`, so check for the Node process itself: `docker exec tapestry pgrep -f realtime/index.js`. |

All text is fixed, chosen by stage or code, and error codes pass an allow-list, so the status never shows a credential, a URI, a host name, an IP address, a port or strfry's stderr.

**What a deploy does.** The program's configuration is baked into the image, so it reaches a host only with a deploy; the first deploy of story 3 adds it there turned off. A deploy re-creates the container: the path is stopped (it flushes its journal first; while journal appends keep failing, that flush fails too, and the lines not yet written are lost: the journal bullet in "Things to know"), and the relay, the router and every process restart. The switch and the record are on the data volume, so the path starts again with the container and catches up on what the relay stored meanwhile: within 5 minutes for up to 10,000 changes (a larger backlog is still reflected in full, more slowly), shown in `catchUp.last`. New changes are not held back meanwhile: rounds take turns with the catch-up's reads, one at a time, so a round waits for one of them normally under a second (about a stamp scan's duration at the scale ceiling). It cannot catch what never reached the relay: a router stream brings nothing published upstream while it was down, which includes every deploy. The supervisor logs are not on a volume and start empty after a deploy.

**The order on staging and production.**

1. Run and check the backfill (§12.8; story 2 § Evidence).
2. Add the daily `reconcileTaggingEdges` entry in Scheduled Tasks and enable it (§12.8 "Scheduling it": the fresh-install seed ships disabled, and a host installed before the seed has none until one is added). Adding it enabled, or enabling it, starts a pass at once; let that pass finish before step 3.
3. Turn the path on with **Turn on** on the Tagging pipeline panel (§12.8), or with the snippet above, and wait until the status shows `firstStartedAt` and `state` `live`.
4. Run one more pass (§12.8 "Running it"). The path creates nothing for what the relay held at its first start, so this pass settles whatever changed between the backfill and the switch, including taggings stored in the seconds before the path's first subscription (up to 10 s more when its first key read waits on Neo4j), and a revoke stored while the path was starting that names a version the path never saw.

**What waits for a pass.** The path removes a relationship only in answer to an event about that tagging, and only when its own later read of the relay there finds no accepted version. The event is a new version stored at its address, or its author's deletion naming the address, or naming by id either the version the relationship records or the latest version the path has seen at that address, when the relationship records a version the path saw there before it. A deletion by anyone else prompts nothing, and so does one naming a version the path has since seen replaced at that address. These wait for the next pass, which is why the scheduled entry (step 2) is the backstop once it is added and enabled:

- a tagging that leaves the relay with no event: a relay wipe, an operator's delete, a NIP-40 expiry;
- a version stored and revoked by id before the path's subscription delivered it: while the path was not running (a deploy included), while its subscription was reconnecting (backoff 1→15 s, longer while the relay refuses connections) or connected but not delivering, or within one import or sync batch or the relay's ~100 ms change notice;
- a version stored or heard in the last flush interval (≤ 250 ms) before a crash and revoked by id before the restart, or a revoke received in that interval whose kind-5 then leaves the relay before the restart. While journal appends keep failing (a full data volume), that interval runs from the last append or compaction that succeeded, and a switch-off or a SIGTERM (a restart or a deploy) ends it as a crash does;
- a relationship recording a version the path never saw at that address (written by the pass or another writer from a relay read the path did not share), when its author revokes by id a newer version the path did see. The exceptions, which the path removes: a read or a scan showed it the newer version while the graph recorded the older one, or a first start's or a lost record's key read found the older one in the graph;
- a relationship whose stored `eventId` is missing or not an event id (only an out-of-band write makes one), revoked by id;
- what the relay stored during a gap the path could not establish (`catchUp.last.outcome` `not-established`). There, if the start's key read failed or was late, or what the surviving record knew at an address predates the graph's version there, a relationship recording a version not on the relay at the re-baseline is also not removed on a by-id revoke of a later version until the pass;
- a republish at a tagging's address that carries neither stamp: the path does not hear it, and the pass removes the relationship.

Two more cases wait for the pass without being removals: an id-only tagging whose tag element arrives later (the pass resolves it), and relationships removed from the graph by other means, such as a restored backup (the pass re-creates them).

ADR `tagging-edges/0003` owner decisions 2 and 5, as reworded by its Amendment A1, list every such case, the rarer ones included.

**Installing it locally.** The program exists only after an image rebuild: `docker compose up -d --build` from the repo root (`COMPOSE_FILE` comes from `.env`; the named volumes and the dev `TAGS` stay). To add it without a rebuild:

```
docker cp docker/supervisord.conf tapestry:/etc/supervisor/conf.d/tapestry.conf \
  && docker exec tapestry supervisorctl reread \
  && docker exec tapestry supervisorctl update
```

That adds the new program, restarts no unchanged one, and is lost at the next container re-creation. `/cycle-local` alone does not install it.

**Things to know.**

- Enabling strfry's `filterValidation.requireAuthorOrTag` refuses both of the path's subscription filters, so the path hears nothing live while that option is on.
- Every `strfry` command, the path's scans included, first connects to the follows Redis, and strfry's stderr names `redis:6379`; that is normal. A Redis that refuses the connection is harmless, but one that accepts no connection stalls every relay read (the pass's too) until its time-out, and the path reflects nothing until Redis answers or is gone. Once it answers, the path reads addresses in their usual groups again, and taggings stored during the stall are reflected within 60 s plus a round of the relay answering.
- An address whose relay reads never answer (each read times out after 20 s) delays the addresses read with it: by two time-outs plus a round when another read in its round answered first (about 41 s locally, 61 s at 100 ms per strfry process, 100 s at 300 ms), or by three when its group was its round's only read (about 61 s, 80 s, 120 s, and 320 s at 1.3 s). It is then read alone. A round spends at most one such single time-out, and after three in a row while other relay reads answer the address is parked: retried after 5 min, 30 min, then every 6 h, at a start, or at once on a live delivery there (a new version, or its author's revoke that resolves there; the lift costs at most one more read alone). A single time-out counts toward the park only when the address is marked to be read alone, or some relay read answered since it was queued or last timed out alone; otherwise the relay was not answering, and the address backs off 5→60 s instead. So a lone change in a Redis stall is never parked, and while no relay read answers at all, a never-answering address is never parked either: it backs off 5→60 s, then is retried once a minute, each retry a 20 s time-out. Each single time-out counts in `counts.failedReads.relay` (one of a tag element read alone, in `failedReads.element`; it still counts toward the park) and the park in `parked`, never in `dbRefused`. A catch-up or a pass's re-look does not lift such a park: what it brings for that address waits with it.
- A change the database keeps refusing (the same non-transient code in two rounds) is parked, counted once in `counts.dbRefused` by its code, and retried after 5 min, 30 min, then every 6 h, at a start, at once on a new event at its address, or after the next successful write. A catch-up, the 10-minute safety diff included, lifts it only when it finds there a version or a revoke the park does not already hold (a new event whose live notice was lost), judged by effect: a deletion by the same author naming the same address or version as one the park already keeps, and dated no later, is held, so such a kind-5 found by a catch-up waits for what else lifts the park, though delivered live it lifts it at once. What the catch-up brings otherwise waits with the park. A parked version is found again at every catch-up. When the park already holds that version, that lifts nothing. When it does not (the park came from a revoke, a look or another version), the first catch-up that finds it lifts the park; refused again with the same code, the address is parked again at once, one level higher and not counted again, now holding the version, so later catch-ups lift nothing: one write attempt per park. Two exceptions: a refusal with another code is retried after 5 s and parks, counted, on the second; and when two or more addresses in a round are refused with one code and none lands, they back off 5→60 s instead, until a round in which that no longer holds. A pass's re-look does lift it.
- A subscription that stays connected but stops delivering is caught by the path's safety diff, every 10 minutes, except a version both stored and revoked by id while nothing was delivered, which waits for the pass. The known trigger is strfry's own (ledger `2026-09-29-strfry-delete-hides-next-write`): after `strfry delete` removes the relay's newest events, or a wipe, the next writes re-use their ids (at least one per newest event deleted, more where earlier deletions left gaps), and a live subscription never receives a write re-using an id it had already passed. strfry keeps those marks per filter and index value, not per subscription alone: a subscription skips a write at or below the last event sent to it, the relay's newest event when it subscribed, or the last event its monitor visited that carries the write's own index value, sent or not. The path's filters are indexed by the stamps' `z` values and by kind 5, so a stamped tagging is also hidden by the last event of any kind carrying its stamp (for a tagging carrying both stamps, once each has been passed), and a kind-5 only by the other two. After a wipe, a subscription misses writes until the ids pass the point its monitor had reached. strfry runs three monitor threads. A write that re-uses an id and is stored after the delete but before its thread next wakes (a database change wakes all three about 100 ms after the first change, which may come before the delete) is missed by every live subscription on that thread. A REQ (at its EOSE), a CLOSE or a closed connection wakes only the thread serving it, and helps only when it falls between the delete and the write. A kind-5, a replaced version and an expiry never trigger it: none of them lowers the largest id. **After a relay wipe or a bulk operator delete, restart the path** (`docker exec tapestry supervisorctl restart tagging-edges-realtime`): until it reconnects, only its 10-minute safety diff reflects changes, and its start's catch-up finds what the relay stored meanwhile. The safety diff also finds a deletion that arrived while the read that first showed the path its target was still running (the target was stored while the path was not hearing it).
- A lost-notice removal (owner decision 11, accepted). The relay's newest store at an address never reached the path (across a reconnect or downtime, within the ~100 ms change notice, through the delete defect above, or with a journal line lost in a crash or damaged, or, while journal appends keep failing (below), any line not yet written when a crash, a switch-off or a SIGTERM ends the path; that spell adds occasions, not a new kind of removal). Before the path read that address again, that store either left the relay with no event or was one the path cannot see (a republish without a stamp). The author's by-id deletion of the version the path last saw there then removes the relationship, although it records an older version. The relay then holds nothing at that address that the path or the pass can read, so the next pass would make the same removal. It is one address at a time, and only on the author's own deletion.
- While journal appends keep failing (a full disk on the data volume), the path keeps the lines it could not write in memory, with no cap, and its rounds keep writing to the graph. The log repeats `journal failed:` with the file-system code. `lastError` says `journal` (`record` after a failed compaction, which is retried at every round end and idle tick while the journal is past the compaction cadence; `status` after a failed status write) only while `status.json` can still be written; on a full disk it cannot, so the status goes `stale` once its last write is over a minute old, and `running` reads false once the process that last wrote it has ended, even while a restarted path runs. Free space on the volume: the next append that succeeds writes the kept lines, or the next compaction that succeeds folds them into the record, and either ends the spell; the status resumes. A crash, a switch-off or a SIGTERM (a restart or a deploy) during the spell loses every line not yet written, not only the last flush interval's; an off still takes effect within 5 s. The next start restores the path as it was at the last append or compaction that succeeded, and its catch-up finds again what the relay still holds. What it cannot find waits for the pass: a version stored and revoked by id meanwhile, and a version held at the first start that came back with the same id and was heard during the spell, at an address the graph does not hold, which counts as held again. The lost lines also add occasions for the lost-notice removal above: not a new kind of removal, and the next pass would make the same one.
- A first start keeps in memory every stamped version delivered between its subscription and the end of its baseline scan, bounded only by that scan's duration (about a second normally). The 20,000-target cap covers revokes only, and a version cannot be dropped, since it would then count as held since before the first start. While the baseline scan keeps failing (`state` `starting`, `lastError` stage `baseline`, retried 5→60 s), the buffer grows with the relay's traffic. Fix the relay read (strfry or Redis, as for any failed read); if that cannot be done soon, turn the path off: the buffer goes with the process, and the next start is a first start again.
- Past its measured heap ceiling, 200,000–240,000 stamped taggings on the relay (200,000 when every address is an arrival; story 3 § Evidence), the path runs out of heap at its next catch-up (a start's, or the 10-minute safety diff) and crash-loops: the error log shows the heap abort and `start exited … backing off …` lines, `runningSince` keeps changing, and the graph stops following the relay. Anyone can publish stamped taggings, so watch `seen` against the ceilings below. If it crash-loops, turn the switch off (the scheduled pass keeps the graph in step) and raise it with the owner.
- Ceilings: revisit the design when the status's `seen` passes 100,000, a staging round (`lastRound.ms`) exceeds 12 s, or a stamp scan takes over 20 s (owner decision 9, as reworded by the ADR's Amendment A1). The status shows no stamp-scan time of its own; a catch-up's `catchUp.last.durationMs` includes one, so it is an upper bound.

**Debugging.** `docker exec tapestry supervisorctl status tagging-edges-realtime` (RUNNING while the wrapper runs, on or off); `docker exec tapestry tail -n 100 /var/log/supervisor/tagging-edges-realtime.log`, and the same for `/var/log/supervisor/tagging-edges-realtime-error.log`. The log carries error codes and redacted error text, and names each close of the subscription with its fixed reason and close code (`filter refused (CLOSED)` or `filter refused (NOTICE)` means the relay refuses the path's filters: see `requireAuthorOrTag` above); the status carries fixed text only.

## 13. Task scheduling — generalized scheduler (story #22 / ADR 0019)

Recurring task scheduling is served by **BullMQ Job Schedulers** attached to each task's queue — not an in-process `setInterval` (which was retired). **Any** task in the registry can be scheduled; schedules are durable (persisted in Redis, survive a control-panel restart) and every fire routes through the queue, so the `neo4j-heavy` semaphore, per-task concurrency, and BullBoard all apply.

### 13.1 Configuring a schedule

Manage schedules from the **Scheduled Tasks** panel (Relay Settings → Scheduled Tasks) or via the API:
- `GET /api/scheduled-tasks/list` — every schedulable (registered) task + its current schedule + next/last run.
- `GET /api/scheduled-tasks/status?taskId=…`, `POST /api/scheduled-tasks/update`, `GET /api/scheduled-tasks/history?taskId=…`.

Schedule shape in `/var/lib/brainstorm/scheduled-tasks.json` — the **source of truth** (Job Schedulers in Redis are the execution layer, reconciled from this file on boot and on every update):

```json
{ "reconcileRecent":    { "enabled": true, "intervalMinutes": 10 },
  "reconcileAll":       { "enabled": true, "cron": "0 4 * * 0" },
  "refreshSearchIndex": { "enabled": true, "intervalHours": 24 } }
```

- **Interval**: `intervalDays` + `intervalHours` + `intervalMinutes` (summed). **Sub-hour is allowed** — the old 1-hour floor is gone, so `intervalMinutes: 10` is valid.
- **Cron**: a `cron` expression takes precedence over the interval fields — pin a heavy run to a low-traffic window.

### 13.2 Durability & missed-fire policy

Schedules live in Redis as BullMQ Job Schedulers, so they survive a control-panel restart (unlike the retired `setInterval`). **Missed-fire policy: skip-and-resume, no backfill** — a fire missed while the process was down is not replayed; the next future occurrence runs normally. For `reconcileRecent` this is harmless — the next run's watermark window simply spans the gap.

**An interval schedule runs as soon as its Job Scheduler is created**: when an enabled entry is added, or a disabled one (the fresh-install seed included) is enabled. It then runs every interval from that moment. (BullMQ starts an `every` Job Scheduler's first job at once; its source does the same when the interval is changed.) Measured 2026-09-30: staging's daily `reconcileTaggingEdges` entry, added at 14:26:18.654Z (its next run is due 2026-10-01T14:26:18.654Z, exactly one day later), started its first run at 14:26:19Z; production's, added at 14:24:37.814Z, started at 14:24:38Z.

### 13.3 Kill-switch

Set `"scheduler": false` in `/etc/brainstorm-task-queue.json` and restart the control-panel to halt ALL scheduling (the boot reconcile upserts nothing and removes managed Job Schedulers). Default is on. Per-task `enabled: false` is the finer-grained control.

### 13.4 Scheduling reconciliation

Suggested cadence:

- `reconcileRecent` — every ~10 minutes (`intervalMinutes: 10`). Bounded by the recency window; cost is proportional to recent activity, not graph size.
- `reconcileNetwork` — every few hours (`intervalHours: 6`) or daily. Cost bounded by the network predicate; staging-measured runtime on the verified set: ~9 min.
- `reconcileAll` — weekly via cron at a low-traffic hour (e.g. `cron: "0 4 * * 0"`). Holds `neo4j-heavy` for ~15 min on the staging-scale 32M-edge graph; blocks GrapeRank/PageRank meanwhile.
- `reconcileAuthor` — on-demand, not scheduled.
- `reconcileTaggingEdges` — daily (`intervalDays: 1`); a disabled seed on fresh installs, added by hand elsewhere (§12.8).

**No seed-first runbook needed** (story #23): the bounded `reconcileRecent` cannot bootstrap into a full pass on a missing watermark, so the previous "run `reconcileAll` first" caveat is obsolete.
## 14. Local dev loop (inside-container source edits)

When you're iterating on UI or server code and want to see changes on `http://localhost:7778` *without* a full image rebuild (which is what `/cycle-local` does), you have to do it by hand. The local-loop friction is real and counter-intuitive — write it down once so the next person doesn't waste an hour.

### Why the obvious thing doesn't work

The `tapestry` container's source tree at `/usr/local/lib/node_modules/brainstorm/` is **a snapshot baked into the Docker image at image-build time**. It is *not* a bind-mount of your host's repo. So if you only run:

```sh
docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npm run build'
```

…that succeeds, but it rebuilds whatever source was in the image when it was last built — i.e., your edits aren't there. The emitted bundle looks identical to the prior one.

### UI changes (React / CSS / anything under `ui/src/`)

```sh
# 1. Sync the edited source from host → container.
#    Whole tree (safer when you don't track exactly what changed):
docker exec tapestry sh -c 'rm -rf /usr/local/lib/node_modules/brainstorm/ui/src && \
  mkdir -p /usr/local/lib/node_modules/brainstorm/ui/src'
docker cp /home/<user>/src/tapestry/ui/src/. \
  tapestry:/usr/local/lib/node_modules/brainstorm/ui/src/

# …or just the file(s) you touched (faster, no churn):
docker cp /home/<user>/src/tapestry/ui/src/styles.css \
  tapestry:/usr/local/lib/node_modules/brainstorm/ui/src/styles.css

# 2. Build inside the container. Vite writes to ui/dist/ on disk.
docker exec tapestry sh -c \
  'cd /usr/local/lib/node_modules/brainstorm/ui && npm run build'

# 3. Verify the served HTML references a NEW bundle hash.
curl -s http://localhost:7778/ | grep -oE 'src="[^"]*index[^"]*"' | head -1
```

**No control-panel restart is needed for UI changes** — the Express server serves static files from `ui/dist/` directly. A hard-refresh in the browser picks up the new bundle as soon as `npm run build` finishes.

### Server changes (anything under `src/api/`, `bin/control-panel.js`, etc.)

The control-panel process keeps loaded modules in memory, so file edits alone don't take effect:

```sh
# 1. Copy the edited file into the container.
docker cp /home/<user>/src/tapestry/src/api/profile-tags/index.js \
  tapestry:/usr/local/lib/node_modules/brainstorm/src/api/profile-tags/index.js

# 2. HUP the control-panel process so it re-`require`s on next request.
docker exec tapestry sh -c 'pkill -HUP -f control-panel.js'
sleep 2  # give it a moment to relisten on :7778

# 3. Probe a known endpoint to confirm.
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7778/api/profile-tags/...
```

The HUP-and-relisten approach is faster than `docker compose restart tapestry`, which would tear down strfry, neo4j proxies, and supervisor's child processes too.

### Caveats

- **Nothing in this loop survives a container rebuild.** The next `docker compose up --build` or `/cycle-local` invocation reverts every in-container edit to whatever's in the freshly-built image. The proper way to land changes durably is to **commit + push** (so CI builds a new image) or **run `/cycle-local`** (which builds a new image locally and restarts the stack).
- **Source files baked into the image come from `npm install` at image-build time**, not from a `COPY` of `ui/src/`. So if you add a *new* source file to your host tree, even `/cycle-local` won't pick it up unless the `package.json` / `npm publish` flow includes it. (This is the same bear-trap that bit us when Story 5's new component files weren't in the container at first — the existing container was built before Stories 2/3/4 added their files.)
- **CSS-only changes still require a `npm run build`** — there is no separate `npm run build:css`. Vite handles CSS as part of the JS bundle/asset graph. Plan a ~15–20s build cycle per CSS tweak.

### Known friction — candidates for improvement

The current loop turns a one-line CSS tweak into a six-step shell ritual. Two tracked candidates for fixing it:

1. **Add a dev-mode bind-mount.** A `docker-compose.dev.yml` overlay that mounts `./src` and `./ui/src` from the host into the container at the same paths would eliminate step 1 of both loops above. Vite has a `--watch` mode that would then rebuild the UI on file change. Not yet implemented; would need careful thought about HMR vs. Express's static-file serving.
2. **A `make sync-css` (or equivalent) one-liner.** Stop-gap until #1 lands: a script that wraps the `docker cp` + `npm run build` + bundle-hash check above. Bash version is ~10 lines; could live in `bin/dev-sync-ui.sh`.

Both tracked as candidates; bandwidth-permitting.

---

## 15. CI test gate (PRs to staging/main)

`.github/workflows/test.yml` (story `test-hermeticity-ci` #4, ADR 0001). The first CI job in this repo that runs *tests* rather than deploying — the enforcement surface for "`npm test` must be clean," which was prose-only until now.

**What runs.** On every `pull_request` targeting `staging` or `main`, a single job on a clean `ubuntu-latest` runner: `npm ci` (from the lockfile) then `npm test`. Node 22, matching the production Dockerfile. No Docker stack is provisioned — the suite is stack-free by construction (stories #1–#3): the ~24 live-API suites detect the absent control panel and **self-skip**, visibly and counted, so the run's `Total skipped:` line reports exactly how much of the gate stood down. Full git history (`fetch-depth: 0`) so the harness-lint L9/L10 checks stay live in CI. A newer push to the same PR cancels the older in-flight run; a 15-minute timeout guards against hangs.

**What is deliberately excluded.** e2e/Playwright and anything relay-touching. That path has a heavy dependency setup and pollutes shared relay state (hundreds of test tags accumulate on a dev relay), and the "where does CI get a throwaway relay?" question is unanswered. Both are a **deferred later phase**, not part of this gate. The job never invokes `npm run test:playwright`.

**No-retry policy.** There is no retry, rerun-on-failure, or retry-until-green anywhere in the job — the first run's exit code is the verdict. This is deliberate: the stack-free suite has a **zero recorded-flake history** (all documented nondeterminism lives in the excluded live `*-publish` class), so a red run is signal by construction. Auto-retry would launder a real regression into a "probably a flake," which is exactly the habit this gate exists to break. (`playwright.config.js` sets `retries: 2` in CI — another reason that path stays out of this job.)

**First-flake waiver pattern.** If a stack-free suite ever *does* flake, the response is not a retry but a **cited quarantine entry**, mirroring `scripts/harness-lint-waivers.txt`: a tab-separated `<suite>  <citation>` file where every row cites an OPEN.md row explaining the known flake. That file **does not exist today** — deliberately. Its very creation is the surfaced-flake signal: the first entry means a real flake was found, tracked, and is visible on every run, rather than silently retried away. Do not pre-seed it (the excluded live suites are excluded by class, not waived).

**Required-check status — an operator decision, not taken here.** This check is **advisory** on both branches as shipped: `main` requires PRs but enforces no required status checks, and `staging` permits direct pushes. Making `test / stack-free` a **required** check in the GitHub branch rulesets (§4) is a deliberate, separate operator decision that this story does **not** take — flip it once the gate has proven stable across real PRs. Note that a required check on `staging` would also require closing the direct-push path there.
