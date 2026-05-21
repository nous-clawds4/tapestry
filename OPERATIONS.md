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

- `TASK_QUEUE_ENABLED=false` (default) — legacy direct-spawn. Zero queue dependency. **This is the rollback path** — flip the flag, `supervisorctl restart brainstorm`, and the queue is out of the picture.
- `TASK_QUEUE_ENABLED=true` — `/api/run-task` enqueues per-task BullMQ jobs; in-process Workers consume them; `launchChildTask.sh` still spawns the work (its pgrep guard remains as belt-and-suspenders).

When the flag is on and Redis is unreachable, `/api/run-task` returns `503` with body `{success: false, error: "task queue (Redis) unreachable", code: "QUEUE_UNAVAILABLE"}` so monitoring can distinguish this failure from 4xx client errors or 5xx unhandled exceptions.

### 10.2 BullBoard UI (operator queue inspector)

When the flag is on, BullBoard is mounted at `https://<host>/admin/queues` behind owner-only auth (same gate as `/api/admin/*`). It shows per-task queues with active / waiting / completed / failed counts, and exposes retry / remove / **pause** controls.

> **Be careful.** Retry / remove / pause directly affect running calculations. The board title says "Owner Only" as a reminder; the auth gate prevents accidental access by non-owner sessions.

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
