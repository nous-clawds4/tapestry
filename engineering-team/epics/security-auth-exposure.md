# Epic: security-auth-exposure

**Created:** 2026-07-19
**Status:** Done (stories 1–2 retired 2026-07-20 at first book close. Story 3 added 2026-09-11 — a distinct auth-exposure root cause found live on staging + prod; reviewed PASS and shipping under the new open book `audits/auth-signature-verification/`, which carries the active-work signal. The original book `audits/security-auth-exposure/` stays Closed, so this epic stays Done — the new book, not a reopened epic, tracks story 3's deployment. Stories 4–6 added 2026-10-10 the same way, under book `audits/negentropy-sync-access/`.)

## Goal

**Close the unauthenticated exposure of the graph-mutating API surface on deployed instances.** A "trusted local operator" bypass in the auth layer treats all proxied traffic as local — and on a deployed instance every request arrives proxied from `127.0.0.1`, so the bypass fires for everyone. The result: an anonymous internet caller can reach the `/api/normalize/*` write endpoints (which mint TA-signed kind-39998/39999 events and mutate the concept graph) and `POST /api/neo4j/query` (arbitrary Cypher, read and write). Confirmed live on staging, production, and `feat/tags` (2026-07-19).

This epic realizes the acceptance frame of book `engineering-team/audits/security-auth-exposure/book.md` (**human-gated** — not a Direction-mode run).

## Why it matters

The write surface signs events **as the instance's Tapestry Assistant** and can rewrite the concept graph (including `DETACH DELETE` via arbitrary Cypher). Unauthenticated internet reach means anyone could mint TA-signed events on, or wipe the graph of, an instance they do not own. The sibling `run-query` leak on this same surface — an unauthenticated credential leak + shell-injection RCE — was already found and closed this session (#388/#389/#390); this epic closes the root cause (the bypass) and the rest of the surface it exposed.

## Stories

1. `stories/security-auth-exposure/1-close-unauthenticated-write-surface.md` — reject unauthenticated callers on the `/api/normalize/*` writes and `POST /api/neo4j/query`, resistant to the `X-Forwarded-For: 127.0.0.1` spoof, without breaking the owner UI, the public read endpoints (including the deploy-safety curl the cycle skills depend on), or firmware install. Ships to staging → prod → feat/tags. **Done** (review PASS 2026-07-19; code verified local — deploy to the three instances pending).

2. `stories/security-auth-exposure/2-default-deny-mutating-endpoints.md` — flip the central auth middleware from default-open to **default-deny for mutations**: `POST/PUT/PATCH/DELETE` (and `?action=`-style state changes) require auth unless a route is on an explicit, documented public-mutation allowlist. Closes the known unauthenticated-callable `POST /api/firmware/install` gap by construction. Ships to staging → prod → feat/tags. **Done** (review PASS 2026-07-20; code verified local — deploy pending).

3. `stories/security-auth-exposure/3-login-signature-verification.md` — the login endpoints (`POST /api/auth/login`, `POST /api/auth/login-user`) grant an authenticated (owner/admin) session on an event whose **signature is never verified** — only `pubkey` + a challenge tag are checked. Anyone who knows an owner/admin *public* key can obtain an owner session with an unsigned event. Require a valid `verifyEvent` signature, correct kind, fresh `created_at`, single-use challenge; regenerate the session on login; stop storing client-supplied `nsec`. Live and identical on staging + prod (2026-09-11). Book: `audits/auth-signature-verification/`. **Done** (review PASS 2026-09-11; shipped to staging, prod promotion in progress).

4. `stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.md` — every negentropy-sync route was open to any signed-in session, and its GET routes (stream, count, status) to visitors who were not signed in. One guard now admits the owner, admins and direct-local callers; other signed-in people keep only the POV sync (one author's kind 30382, downloaded). Shipped 2026-10-10 as an owner-approved hotfix (PR #837) and recorded after. Book: `audits/negentropy-sync-access/`. **Done** (review PASS 2026-10-10; shipped to production, deploy run 141).

5. `stories/security-auth-exposure/5-paths-judged-case-insensitively.md` — Express routes case-insensitively, but the auth middleware compared paths case-sensitively, so a capitalized path skipped the central check. Every path test now uses one lowercased copy. Found by story 4's review; hotfix PR #839. Same book. **Done** (review PASS 2026-10-10; shipped to production, deploy run 143).

6. `stories/security-auth-exposure/6-task-control-owner-and-admins.md` — any signed-in session could start or schedule any registered task; the six task-control POSTs now join the owner-only list, and the saved presets list is guarded like the sync status. Found by story 4's review; hotfix PR #840. Same book. **In Progress** (review pending).

7. `stories/security-auth-exposure/7-head-judged-as-get.md` — Express answers HEAD with the GET handler, but the middleware's GET-only checks ignored HEAD, so a HEAD request ran protected and owner-only GET handlers. Both checks now cover HEAD. Found by story 4's review round 2; hotfix PR #841. Same book. **In Progress** (review pending).

*(Further stories drawn at Planning as the work proceeds.)*

## Key facts / guardrails

- **The `X-Forwarded-For: 127.0.0.1` spoof is the central correctness hazard.** A naive fix that adds `trust proxy` + an IP allowlist re-earns "local" for any caller who spoofs a loopback forwarding header. Spoof-resistance is a first-class, externally-testable acceptance criterion, not a footnote.
- **Public reads must stay public.** The deploy-safety status endpoint is curled with no auth by the cycle skills — breaking it breaks the promotion procedure. Concept-graph reads, strfry scan, `assistant/pubkey`, and `auth/status` must also remain reachable unauthenticated.
- **Firmware install calls the normalize surface internally over HTTP** — whatever fix lands must not break it (the reason the `req.connection` guard exists in the auth middleware).
- **Scope discipline.** This epic closes the two named surfaces and their shared root cause. Flipping the global default-open middleware posture, the client-side `isOwner` pattern, and the element-editor UX asymmetry are out of scope (the first is a planned follow-up story).
- **Operator-side companions** — rotating the disclosed Neo4j password and firewalling the internet-reachable Bolt/HTTP Neo4j ports (`7687`/`7474`) — are tracked in the book and are **not** closed by any code story here; the app-layer fix does not accomplish them.
