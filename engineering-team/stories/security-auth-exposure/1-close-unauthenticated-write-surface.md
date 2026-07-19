# Story 1: Close the unauthenticated write-surface exposure

**Status:** Approved
**Created:** 2026-07-19
**Type:** Bug (security / authorization)
**Epic:** `security-auth-exposure`

## Background

On a deployed instance, an anonymous internet caller can reach graph-mutating endpoints with no authentication. The "trusted local operator" bypass in the auth layer treats **all** proxied traffic as local (the app sits behind nginx that proxies from `127.0.0.1`), so the bypass fires for every request.

Confirmed live this session (safe, non-mutating probes): unauthenticated `POST /api/normalize/add-to-set` to `staging.brainstorm.world` returned `400 "Missing setName"` — the handler executed past auth into validation; a blocked request would be 401/403. The sibling `run-query` leak on this same surface has already been closed (#388/#389/#390); this story closes the **root cause** and the rest of the surface.

The exposed surface: the 20 `/api/normalize/*` write endpoints (each mints TA-signed kind-39998/39999 events and mutates the concept graph) and `POST /api/neo4j/query` (arbitrary Cypher, read **and** write, including `DETACH DELETE`). Live on staging, production, and `feat/tags`.

## User-facing description

As the instance owner, I want every graph-mutating endpoint to reject unauthenticated callers, so that no anonymous internet user can alter my instance's concept graph or mint events signed as my Tapestry Assistant — while my own signed-in tools and the instance's legitimate internal and public traffic keep working.

## Acceptance criteria

- [ ] Given a deployed instance, when an **unauthenticated** request hits any `/api/normalize/*` write endpoint, then it is rejected with a 401/403-class response and the handler does not execute. *(Testable with a benign non-mutating body.)*
- [ ] Given a deployed instance, when an **unauthenticated** `POST /api/neo4j/query` carrying **write** Cypher (`CREATE`/`MERGE`/`DELETE`/`SET`/`REMOVE`/`DETACH`/`DROP`/`CALL{}`) is made, then it is rejected 403 and no write runs. *(Refined during Architecture, operator-approved 2026-07-19: **read** Cypher stays open — it is the read backbone of 20+ UI pages incl. public browsing; the danger is unauthenticated writes. Residual risk of unauthenticated reads is tracked in ADR 0001.)*
- [ ] Given a request whose network peer is **not** loopback but that carries `X-Forwarded-For: 127.0.0.1` (or any spoofed loopback forwarding header), when it hits those endpoints, then it is treated as **remote** and rejected — spoofing the header does not earn "local."
- [ ] Given a valid **owner session**, when the owner uses those endpoints (as the concepts UI does), then the requests still succeed — no owner-facing regression.
- [ ] Given an **unauthenticated** request to a legitimately-public read endpoint — the deploy-safety status endpoint, concept-graph reads, strfry scan, `assistant/pubkey`, `auth/status` — then it still succeeds. *(The deploy-safety endpoint especially: the cycle skills curl it with no auth.)*
- [ ] Given the **firmware install** flow, when it runs, then its internal calls to the normalize surface still succeed — the fix does not break firmware install.
- [ ] The fix is delivered to **staging, production, and `feat/tags`** (the exposure is live on all three).

## Concepts touched

No single concept-graph concept is central. The affected surface is the **concept-authoring write API** — the endpoints that create/modify kind-39998 (`ConceptHeader`) and kind-39999 (core-node/element) events signed as the TA. Architect can orient via `/api/concept-graph/summaries` if needed.

## Out of scope

- `GET /api/neo4j/run-query` — already removed + deployed this session (#388/#389/#390).
- **Flipping the global default-open middleware posture** to default-deny for all unlisted endpoints — deferred to a follow-up story in this epic. This story closes only the two named surfaces.
- Any change to the **client-side** `isOwner` pattern or its duplication across the concepts pages.
- The `openapi.yaml` `save-element-json` field mismatch — note only; not this story.
- Operator-side companions (rotate the Neo4j password; firewall Bolt `7687`/`7474`) — tracked in the book; not code.

## Open questions

- **Is the host-operator CLI path preserved or dropped?** The bypass exists so the host can call these endpoints without a login. Whether that path is kept (some local-operator path stays working) or removed (auth required uniformly) is **for Architecture to determine from actual usage** — but whichever way it goes, the exposure-closing criteria above and the firmware-install criterion must both hold.
- Rollout: same `staging → main`/`feat/tags` chain as the run-query fix, or a coordinated hotfix? (Intake Q6 — resolve with the operator before/at deploy.)

## Linked artifacts
- ADR: `engineering-team/decisions/security-auth-exposure/0001-honest-local-bypass-and-neo4j-write-gate.md`
- Test plan: `engineering-team/stories/security-auth-exposure/1-close-unauthenticated-write-surface.test-plan.md` (tests: `test/close-unauth-write-surface.test.js`)
- Review: *(after Review)*
