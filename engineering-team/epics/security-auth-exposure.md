# Epic: security-auth-exposure

**Created:** 2026-07-19
**Status:** Active

## Goal

**Close the unauthenticated exposure of the graph-mutating API surface on deployed instances.** A "trusted local operator" bypass in the auth layer treats all proxied traffic as local — and on a deployed instance every request arrives proxied from `127.0.0.1`, so the bypass fires for everyone. The result: an anonymous internet caller can reach the `/api/normalize/*` write endpoints (which mint TA-signed kind-39998/39999 events and mutate the concept graph) and `POST /api/neo4j/query` (arbitrary Cypher, read and write). Confirmed live on staging, production, and `feat/tags` (2026-07-19).

This epic realizes the acceptance frame of book `engineering-team/audits/security-auth-exposure/book.md` (**human-gated** — not a Direction-mode run).

## Why it matters

The write surface signs events **as the instance's Tapestry Assistant** and can rewrite the concept graph (including `DETACH DELETE` via arbitrary Cypher). Unauthenticated internet reach means anyone could mint TA-signed events on, or wipe the graph of, an instance they do not own. The sibling `run-query` leak on this same surface — an unauthenticated credential leak + shell-injection RCE — was already found and closed this session (#388/#389/#390); this epic closes the root cause (the bypass) and the rest of the surface it exposed.

## Stories

1. `stories/security-auth-exposure/1-close-unauthenticated-write-surface.md` — reject unauthenticated callers on the `/api/normalize/*` writes and `POST /api/neo4j/query`, resistant to the `X-Forwarded-For: 127.0.0.1` spoof, without breaking the owner UI, the public read endpoints (including the deploy-safety curl the cycle skills depend on), or firmware install. Ships to staging → prod → feat/tags. **Approved**.

*(Further stories drawn at Planning as the work proceeds — see the book's indicative list: the middleware default-open posture audit is the expected follow-up.)*

## Key facts / guardrails

- **The `X-Forwarded-For: 127.0.0.1` spoof is the central correctness hazard.** A naive fix that adds `trust proxy` + an IP allowlist re-earns "local" for any caller who spoofs a loopback forwarding header. Spoof-resistance is a first-class, externally-testable acceptance criterion, not a footnote.
- **Public reads must stay public.** The deploy-safety status endpoint is curled with no auth by the cycle skills — breaking it breaks the promotion procedure. Concept-graph reads, strfry scan, `assistant/pubkey`, and `auth/status` must also remain reachable unauthenticated.
- **Firmware install calls the normalize surface internally over HTTP** — whatever fix lands must not break it (the reason the `req.connection` guard exists in the auth middleware).
- **Scope discipline.** This epic closes the two named surfaces and their shared root cause. Flipping the global default-open middleware posture, the client-side `isOwner` pattern, and the element-editor UX asymmetry are out of scope (the first is a planned follow-up story).
- **Operator-side companions** — rotating the disclosed Neo4j password and firewalling the internet-reachable Bolt/HTTP Neo4j ports (`7687`/`7474`) — are tracked in the book and are **not** closed by any code story here; the app-layer fix does not accomplish them.
