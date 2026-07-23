# Book of Work: Auth Exposure Hardening (localhost-bypass + unauthenticated write surface)

**Slug:** security-auth-exposure
**Status:** Closed
**Opened:** 2026-07-19
**Closed:** 2026-07-20 — both stories Done + deployed to staging/prod/feat/tags; Neo4j password rotated + verified on all three; firewall companion deferred and carried forward as OPEN.md #66. Operator-ratified close. Audit + prd-seed under this dir.
**Gating:** **Human-gated.** Every phase gate is answered by the operator. This book is deliberately **not** run in Direction mode — a live security fix touching the auth middleware is where a human belongs at each gate, not an autonomy experiment. There is no `## Direction mode` section by design; do not add one without the operator's explicit decision.

## Intent anchor

**Acceptance frame (no PRD)** — restated and confirmed in the conversation of 2026-07-19. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-07-19 — Defect: `/api/normalize/*` has no server-side auth, and the localhost bypass may expose it (plus arbitrary Cypher) to the public internet"** in `engineering-team/stories/_intake.md`. That entry's findings, open Planning questions, and out-of-scope list are part of this anchor.

### Confirmed live this session (was "verified by code reading only" at intake)
The exposure is **real**, verified by safe read-only probes 2026-07-19:
- `GET /api/neo4j/run-query` returned **HTTP 200** unauthenticated on **staging and production**, executing server-side and leaking the Neo4j credential in the error body (`neo4jneo4j` on staging, the real password on prod) — plus the credential in the process args, plus a shell-injection RCE (the handler shelled out to `cypher-shell` with the query interpolated into the command string).
- `POST /api/neo4j/query` answered unauthenticated (Bolt-backed; arbitrary Cypher read **and** write, incl. `DETACH DELETE`).
- The `run-query` **GET endpoint has already been removed and deployed** to staging (#388), production (#389), and `feat/tags` (#390) — its leak + RCE are closed. **This book does not re-address run-query;** it addresses the *root cause* (the localhost bypass) and the *rest* of the exposed surface.

### Acceptance frame
- [ ] On a **deployed** instance, an unauthenticated internet request to any `/api/normalize/*` write endpoint returns a 401/403-class response — **not** 200/executed. Verified live on `staging.brainstorm.world` with a safe, non-mutating probe.
- [ ] On a **deployed** instance, an unauthenticated internet request to `POST /api/neo4j/query` returns 401/403 — arbitrary Cypher is no longer reachable anonymously.
- [ ] **The `X-Forwarded-For: 127.0.0.1` spoof does not grant local/bypass access.** This is the single most likely way the fix ships looking correct and isn't (if it sets `trust proxy` + an IP allowlist naively, a spoofed XFF re-earns "local"). An explicit automated test asserts a request carrying a loopback `X-Forwarded-For` from a non-loopback peer is treated as remote.
- [ ] The **legitimate local-operator paths still work**: the documented host→`/api/normalize`/`/api/neo4j` CLI workflow, and the **firmware-install internal HTTP calls** (the reason for the `req.connection` guard at `auth.js:320`). The fix must not break firmware install.
- [ ] **Legitimately-public read endpoints stay unauthenticated and reachable** — regression-guarded. At minimum: the deploy-safety status endpoint (the cycle skills curl it with no auth — breaking it breaks the promotion procedure), the concept-graph read endpoints, strfry scan, `assistant/pubkey`, `auth/status`.
- [ ] **Owner UI flows continue to work.** The concepts pages POST to `/api/neo4j/query` and `/api/normalize/*` as the signed-in owner; after the fix those still succeed with a valid owner session.
- [ ] The **default-open middleware posture** is addressed. Today unlisted endpoints fall through to `return next()` (`auth.js:~488`), so any endpoint not on an allow/deny list is public. The fix either explicitly protects every mutating surface or flips the default to deny for unlisted mutating routes; acceptance is the observable outcome in the first two bullets, but the disposition of the default must be a conscious, recorded decision, not left implicit.
- [ ] Live on `staging.brainstorm.world` with the staging smoke test passing, then promoted to **production and `feat/tags`** — the exposure is live on all three instances, so the fix must reach all three (as the run-query fix did).

## Companion operator-side tasks (NOT code — tracked here so they aren't lost)

These are **infrastructure/secrets** actions the operator performs (droplet SSH / credential handling); they are out of the code harness but are part of closing the exposure. The code fix does **not** accomplish them.

### 1. Rotate the Neo4j password — ✅ DONE (2026-07-20)

All three instances (staging, production, `feat/tags`) rotated off the leaked credentials (`satoshi21xyz420` on prod, `neo4jneo4j` on staging) and verified healthy: app↔Neo4j Bolt auth works and real graph data is returned (staging 46 concepts / 462 nodes, prod 45 / 436, tags 47 / 454), with the story-1/2 default-deny posture intact.

**Method that worked** (record for future rotations): change the password on the Neo4j the *app* uses — the in-container one — then point config at it:
```bash
docker exec tapestry cypher-shell -u neo4j -p '<OLD>' "ALTER CURRENT USER SET PASSWORD FROM '<OLD>' TO '<NEW>';"
# ensure /opt/tapestry/.env NEO4J_PASSWORD = <NEW> (entrypoint re-renders /etc/brainstorm.conf from it on start)
docker exec tapestry supervisorctl restart brainstorm     # or: docker compose up -d
```
**Do NOT rotate via the web Neo4j Browser at `:7474`** — it can reach a different instance/droplet than the app, which caused a cross-instance mix-up during this rotation.

### 2. Firewall the internet-exposed backend ports — ⏳ DEFERRED (operator, 2026-07-20)

Deferred for a future session; full runbook kept here so it isn't lost. Tracked in **OPEN.md #66**.

**The exposure (broader than Neo4j).** The deploy workflows' `sed` remaps only `"80:80"` → `127.0.0.1:8080` (`.github/workflows/deploy-*.yml`); every other Docker-published port stays on `0.0.0.0`. Confirmed internet-reachable on prod (`159.203.150.156`), 2026-07-20:

| Port | Service |
|---|---|
| 7474 | Neo4j Browser |
| 7687 | Neo4j Bolt |
| 8687 | Neo4j Bolt (nginx TCP stream) |
| 7778 | Control-panel API — **direct, bypassing host nginx** |
| 7700 | Meilisearch |
| 3069 | nostr-search-api |

Nothing external legitimately needs these — the app reaches them internally (`bolt://localhost:7687`, etc.); the site is served via host nginx on 80/443.

**Fix — DigitalOcean Cloud Firewall (default-deny, allow only 22/80/443).**
- **Why a DO firewall, NOT `ufw`:** Docker's port publishing rewrites the droplet's iptables *ahead of* ufw, so `ufw deny 7687` is silently bypassed. A DO Cloud Firewall filters at the network layer *before* the packet reaches the droplet — Docker can't bypass it.
- DO console → Networking → Firewalls → Create:
  - **Inbound:** TCP `22` (All — keep; deploy CI SSHes in, key-only + fail2ban), TCP `80` (All — nginx/Certbot), TCP `443` (All — the app). Nothing else → 7474/7687/8687/7778/7700/3069 implicitly denied.
  - **Outbound:** leave default (allow all — droplet needs relays, repos).
  - Apply to all three droplets (staging, tapestry/prod, tags).
- `doctl` equivalent: `doctl compute firewall create --name tapestry-web --inbound-rules "protocol:tcp,ports:22,address:0.0.0.0/0,address:::/0 protocol:tcp,ports:80,address:0.0.0.0/0,address:::/0 protocol:tcp,ports:443,address:0.0.0.0/0,address:::/0" --outbound-rules "protocol:tcp,ports:all,address:0.0.0.0/0 protocol:udp,ports:all,address:0.0.0.0/0" --droplet-ids <id1> <id2> <id3>`

**Durable code alternative (defense-in-depth, optional follow-up story).** Bind these ports to `127.0.0.1` in `docker-compose.yml` (as the deploy already does for `:80`), so they are never on `0.0.0.0` even if a firewall is misconfigured. A small, harness-sized change.

**Verification (read-only — an assistant can run it):** from outside, `nc -z <droplet-ip> 7687` should become closed while `443` stays open and the site loads; from the app, the Neo4j-data smoke (`POST /api/neo4j/query {"cypher":"RETURN 1"}` → `success:true`; `/api/concept-graph/summaries` returns concepts) confirms nothing over-blocked.

**No stray host Neo4j.** Checked on prod 2026-07-20: `systemctl status neo4j` → not found; the `neo4j` processes in `ps aux` are the **container's** (low in-namespace PID, no systemd unit) — **do not kill them.** Re-check per droplet when firewalling.

## Epics in this book
- `security-auth-exposure` — the localhost-bypass root-cause fix, server-side authorization for the normalize + neo4j-query write surface, and the middleware default-posture disposition. (Epic file to be created at Planning.)

## Indicative stories (to be drawn at Planning — not binding)
1. **Fix the localhost bypass root cause** (`auth.js:317-324`): make "local" reflect the true client, not a proxied hop — via `app.set('trust proxy', …)` so `req.ip` is honest, or an explicit local-operator credential (loopback-bound admin port / shared secret / unix socket). The IP heuristic is load-bearing for the CLI workflow, so it can't just be deleted. **Includes the XFF-spoof regression test.**
2. **Server-side authorization for `/api/normalize/*` writes** — `requireOwner` (or the finer read/write split, if Architecture decides one) on the 20 routes, without breaking firmware install.
3. **Lock down `POST /api/neo4j/query`** — owner-only (arbitrary Cypher write is owner-grade), keeping the concepts UI's owner-session calls working.
4. *(possible)* **Middleware default-posture audit** — inventory unlisted mutating endpoints; decide flip-to-deny vs explicit-protect.

## Out of scope
- `GET /api/neo4j/run-query` — already fixed + deployed this session (#388/#389/#390).
- The element-editor UX asymmetry (separate project element).
- Any change to the **client-side** `isOwner` pattern or its 8-way duplication across the concepts pages.
- The `openapi.yaml` `save-element-json` field-mismatch (`:439`) — opportunistic only; note it, don't let it grow scope.
- The password rotation + Bolt firewalling are **operator ops companions** above, not engineering stories.

## Classification
- **Type:** Defect (security / authorization).
- **Strictness:** Standard.
- **Priority:** **High** — confirmed live and unauthenticated on production. (Not marked Critical operationally only because the instances are low-traffic and used almost entirely by the operator + dev team; treat the password rotation + Bolt firewalling as the most time-sensitive parts.)
- **Disclosure / deploy path:** open Planning question 6 from the intake entry — does this ride the normal `staging → main`/`feat/tags` chain, or warrant a coordinated hotfix ahead of it? Resolve at Planning with the operator.

**Decision record:** phase commits + gate approvals land on `feat/security-auth-exposure`; per house rules, commit at each phase boundary.
