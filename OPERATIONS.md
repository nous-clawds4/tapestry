# Tapestry Operations — brainstorm.world

> **Audience:** the active team running this fork at `brainstorm.world`.
> **Prerequisite reading:** [BIBLE.md](./BIBLE.md) — what tapestry *is* and how it works. This file documents the specifics of *our* deployment that aren't useful to other operators forking the codebase.

**Last updated:** 2026-05-15

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

---

## 1. Deploy targets

Six long-lived branches, six Digital Ocean droplets, six CI/CD workflows:

| Branch | Workflow | Target | Purpose |
|--------|----------|--------|---------|
| `main` | `deploy-brainstorm.yml` | `brainstorm.world` | Production. PRs merge here only after staging verification. |
| `staging` | `deploy-staging.yml` | `staging.brainstorm.world` | Pre-production verification. PRs from feature branches land here first. |
| `feature-magic-carpet` | `deploy-magic-carpet.yml` | `magic-carpet.brainstorm.world` | Long-lived sandbox for Matthias's bounty-system work. |
| `feat/pubkey-tagging-target` | `deploy-tags.yml` | `tags.brainstorm.world` | Long-lived sandbox for the pubkey-tagging feature work (NIP-85 profile-tagging UX). |
| `feat/communities` | `deploy-communities.yml` | `communities.brainstorm.world` | Long-lived sandbox for the communities / decentralized-lists feature work (brainstorm-community concept, DList NIP-aware tag schema). |
| `feat/curate` | `deploy-curate.yml` | `curate.brainstorm.world` | Long-lived sandbox for Avi's feature work; scope TBD by Avi. |

Each workflow uses repo secrets named `DEPLOY_HOST_<NAME>`, `DEPLOY_USER_<NAME>`, `DEPLOY_SSH_KEY_<NAME>` where `<NAME>` is `BRAINSTORM`, `STAGING`, `MAGIC_CARPET`, `TAGS`, `COMMUNITIES`, or `CURATE`.

### Standard branch promotion flow

```
feat/foo (off staging)
    → PR → staging        → CI deploys to staging.brainstorm.world
    → verify on staging
    → PR → main            → CI deploys to brainstorm.world
    → source feature branch auto-deleted
```

**Long-lived sandbox branches** (currently `feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, and `feat/curate`, plus any future additions) follow the same convention: fork from `staging`, deploy to their own droplet via a dedicated `deploy-<name>.yml` workflow, and eventually merge back via the standard `<branch> → staging → main` path. New sandboxes get a row added to the deploy-target table above when they're stood up, plus a row in [§5 "Droplets and empirical measurements"](#5-droplets-and-empirical-measurements).

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
- `develop` — Vinney's pre-reorg integration branch. Deleted 2026-04-26 after confirming with Vinney; its only unique content vs `main` was a redundant `.pi/` gitignore entry that `main` already had. The role it once served (integration branch) is now filled by `staging`.

---

## 3. CI/CD workflows

GitHub Actions workflows in `.github/workflows/`. All four follow the same SSH-action pattern:

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

### Sandbox: `tags.brainstorm.world`

- (specs to be filled in)
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`
- Stood up 2026-05-12; first CI/CD deploy via `deploy-tags.yml` ran successfully against PR #119.

### Sandbox: `communities.brainstorm.world`

- (specs to be filled in — entrypoint dynamic-config reports 32 GB RAM, 8 vCPU)
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`
- Stood up 2026-05-14; first CI/CD attempt failed at the SSH handshake due to brute-force saturation of `MaxStartups` (see §9.9), succeeded on retry after fail2ban + `PasswordAuthentication no` were applied 2026-05-15.

### Sandbox: `curate.brainstorm.world`

- (specs to be filled in)
- Behind host nginx + Certbot SSL; Docker stack binds to `127.0.0.1:8080`
- Stood up 2026-05-15; first CI/CD deploy via `deploy-curate.yml` ran successfully on first push ([run 25901626052](https://github.com/nous-clawds4/tapestry/actions/runs/25901626052), 1m8s) — droplet was hardened per §6.3 step 2 before the deploy SSH key was generated, so §9.9's first-deploy failure didn't recur.

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

End-to-end procedure for adding a new long-lived sandbox to the deploy fleet. The reference walk-through is `feat/communities` → `communities.brainstorm.world` on 2026-05-14; sub-sections call out gotchas hit during that run.

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

**Post-stability flicker:** observed once on the #88 production deploy — the 3-consecutive-200s threshold was reached, but the next request burst a few seconds later still got 502s before settling for good. The brainstorm process can briefly cycle once more after first appearing stable. If a smoke test fails right after a streak-based stability check, retry once before treating it as a real failure.

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

## 12. Reconciliation — `recent` / `all` / `author` modes (story #21 / ADR 0018)

Reconciliation repairs drift between strfry (canonical nostr event store) and the Neo4j social graph (FOLLOWS / MUTES / REPORTS from kind 3 / 10000 / 1984). One engine — `src/pipeline/reconciliation/reconciliation.sh` — runs in three author-scoped modes, exposed as three task-registry keys (all invoke the same script with a different `--mode`):

| Task | Command | Authors covered | Triggered | `neo4j-heavy`? |
|---|---|---|---|---|
| `reconcileRecent` | `reconciliation.sh --mode recent` | only authors with an event since the watermark | manually (see §12.3) | yes |
| `reconcileAll` | `reconciliation.sh --mode all` | every author (today's full sweep) | manually + incident recovery (§12.3) | yes |
| `reconcileAuthor` | `reconciliation.sh --mode author --pubkey <hex>` | one author | on demand (§12.3) | no |

`recent` is the routine sweep and the default (running `reconciliation.sh` with no `--mode` is `recent`). `all` is the correctness oracle and the weekly drift-recovery fallback — it stays slow (hours) but catches drift that `recent` can't see (e.g. a bad edge with no corresponding recent event). `author` is a tiny point repair; it is deliberately **not** `neo4j-heavy` so an interactive "reconcile me" trigger never queues behind a multi-hour sweep.

### 12.1 The watermark

`recent` mode persists a watermark at `/var/lib/brainstorm/pipeline/reconciliation/state.json`:

```json
{ "lastRunStartedAt": 1716300000, "lastRunCompletedAt": 1716300420,
  "lastRunMode": "recent", "lastFullRunCompletedAt": 1715700000,
  "edgeCounts": { "follows": 11900000, "mutes": 240000, "reports": 38000 } }
```

- Each `recent` run scans strfry `since (lastRunStartedAt - RECONCILIATION_OVERLAP_SECONDS)` and restricts the Neo4j extraction to the same authors.
- **Seeding the watermark (recommended first step on a fresh instance):** run `reconcileAll` **once**. It establishes the baseline and writes the watermark, after which `reconcileRecent` runs genuinely incrementally. `reconcileAll`'s task timeout (8 h) accommodates the full sweep.
- **First run / lost watermark (self-healing fallback):** if `reconcileRecent` is triggered with no `state.json`, it **self-bootstraps with one full pass** (logged with `"bootstrap": true`), then writes the watermark. Caveat: a bootstrap takes hours, which exceeds `reconcileRecent`'s shorter task timeout, so it is *reported* as a timeout (exit 124) — but the task runs with `forceKill: false`, so it is **not killed**; it completes in the background and writes the watermark. Prefer seeding via `reconcileAll` to avoid that misleading status. Delete `state.json` to force a re-bootstrap.
- `author` mode does **not** read or advance the watermark.
- A failed run does **not** advance the watermark (next run re-covers the window).
- Inspect: `cat /var/lib/brainstorm/pipeline/reconciliation/state.json | jq`.

### 12.2 Config (`/etc/brainstorm.conf`)

- `RECONCILIATION_OVERLAP_SECONDS` (default `3600`) — safety window re-scanned on top of the watermark so events that landed during the prior run are re-covered. Re-scanning is idempotent (the diff finds no change).

### 12.3 Triggering & scheduling

**Today these three tasks are manual-trigger only** — via the Task Explorer or `POST /api/run-task` (which routes through the BullMQ queue, so the `neo4j-heavy` semaphore applies and the bulk sweeps serialize against `calculateOwner{Hops,PageRank,GrapeRank}` — the original reconciliation-vs-recalculation contention). No per-task cadence is wired into this story by design: the three tasks are deliberately **frequency-agnostic** — `reconcileRecent`'s watermark makes its scan window self-adjusting, so it is correct at any interval, and `reconcileAll`/`reconcileAuthor` don't depend on cadence at all.

Automated scheduling is deferred to a future **generalized Task Scheduler** — the documented phase 2 of the task queue (story #13), built on **BullMQ repeatable/cron jobs**. It will schedule any registered task, support sub-hour intervals, survive process restarts, and route through the queue (and thus the semaphore). The three reconcile tasks will slot into it as ordinary schedulable tasks with no bespoke per-task code.

**Deprecated / superseded scheduling mechanisms — do NOT use for reconciliation:**
- The host `systemd/reconcile.timer` (every 5 min → runs `reconciliation.sh` *directly*) is **deprecated**: it bypasses the queue and the `neo4j-heavy` semaphore. Confirm it is disabled (`systemctl is-enabled reconcile.timer`). Full removal (unit files + the control-panel references in `src/api/export/services/commands/control.js` & `queries/status.js` + the sudoers grant in `setup/configure-control-panel-sudo.sh`) is tracked as a follow-up.
- The in-process scheduler (`src/api/scheduled-tasks/index.js`) has a **1-hour minimum interval** and a hardcoded task set that excludes the reconcile tasks — not used here; itself slated for replacement by the BullMQ scheduler.
- The legacy `reconciliation` registry key is retained only for back-compat (still invoked by `processAllTasks.sh`; now defaults to `--mode recent`). It is **deprecated** in favor of the three explicit keys; its removal (and repointing/decoupling `processAllTasks`) is a tracked follow-up.

### 12.4 Force a full run (incident recovery)

Trigger `reconcileAll` (or `reconciliation.sh --mode all`). Use this whenever you suspect drift that the incremental sweep wouldn't catch — a partial write, a botched migration, or after any direct Neo4j surgery.

### 12.5 Observability

`reconciliation.log` + `events.jsonl` carry, per run: the `mode`, the `watermark` consumed and `watermark_advanced_to`, per-kind `drift` (`added` / `deleted`), per-kind `edge_counts_before`/`edge_counts_after`, and per-stage `duration`. A `recent` run with nothing to do emits `phase: "no_drift"` and exits in the sub-minute fast-path. The precise "how much drift did we catch" answer is the per-kind `added`/`deleted` totals.

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

### 13.3 Kill-switch

Set `"scheduler": false` in `/etc/brainstorm-task-queue.json` and restart the control-panel to halt ALL scheduling (the boot reconcile upserts nothing and removes managed Job Schedulers). Default is on. Per-task `enabled: false` is the finer-grained control.

### 13.4 Scheduling reconciliation — seed the watermark first

Before enabling a frequent `reconcileRecent` schedule on an instance with no reconciliation watermark, **run `reconcileAll` once** in a low-traffic window to seed the watermark (§12.1). Otherwise the first scheduled `reconcileRecent` self-bootstraps a full pass (6–8h on a large graph) — it completes and logs `"bootstrap": true`, but you don't want that as a surprise inside a 10-minute schedule. Recommended cadence once seeded: `reconcileRecent` every ~10 min, `reconcileAll` weekly via cron at a low-traffic hour.
