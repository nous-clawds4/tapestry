# Story 2: Default-deny for unauthenticated mutating endpoints

**Status:** Approved
**Created:** 2026-07-20
**Type:** Bug (security / authorization)
**Epic:** `security-auth-exposure`

## Background

The auth middleware is default-**open**: an unauthenticated request that matches no entry on the write/owner allowlists falls through to `return next()` (`src/middleware/auth.js:496`). With **118 mutating routes** (`POST/PUT/PATCH/DELETE`) in `src/`, security depends on someone remembering to list each one — and misses are silent and public. The confirmed concrete gap: `POST /api/firmware/install` is on no list, so an anonymous caller can trigger a full firmware reinstall (a heavy Neo4j operation — a DoS / graph-disruption vector).

Story 1 closed the two named surfaces (`/api/normalize/*`, `/api/neo4j/query`) individually and deferred the general posture here. This story closes it at the root: make mutations **private by default**, so a newly-added or overlooked endpoint is never silently public. (Realizes book frame bullet 7 — "the disposition of the default must be a conscious, recorded decision.")

## User-facing description

As the instance owner, I want every state-changing endpoint to require authentication unless it is explicitly and deliberately marked public, so that no mutating endpoint — present or future — is exposed to the internet just because someone forgot to add it to an allowlist.

## Acceptance criteria

- [ ] Given a deployed instance, when an **unauthenticated** mutating request (`POST/PUT/PATCH/DELETE`, and any `?action=`-style state change) hits a route that is **not** on an explicit public-mutation allowlist, then it is rejected 401/403 and the handler does not execute — the default is **deny**.
- [ ] Specifically, unauthenticated `POST /api/firmware/install` → 401/403 (the confirmed gap, now closed by the default rather than a one-off entry).
- [ ] Every mutating endpoint that is **intentionally public** (the auth/login flow, and any other deliberately-anonymous mutation) is on an **explicit, documented** allowlist and continues to work unauthenticated. That allowlist is the "conscious, recorded decision."
- [ ] No regression to authenticated flows: owner-only and customer-or-owner mutating endpoints still require and accept the appropriate session.
- [ ] Story-1 behavior preserved: the honest-local bypass + `req.localTrusted` still authorize the firmware-install internal bridge and the direct-local operator; public **read** endpoints stay reachable unauthenticated (incl. the deploy-safety curl the cycle skills depend on).
- [ ] Broad regression: the app and its UI continue to function end-to-end (this changes the central auth middleware).
- [ ] Delivered to **staging, production, and `feat/tags`** (all three carry the posture).

## Concepts touched

None — auth-middleware infrastructure. No concept-graph concepts in scope.

## Out of scope

- The residual unauthenticated **read**-Cypher exposure (accepted in story 1 / ADR 0001).
- Operator companions — Neo4j password rotation, Bolt/HTTP port firewalling (book-tracked, not code).
- Rate-limiting or other hardening beyond the auth decision.
- Consolidating the two parallel allowlists (authenticated-branch vs unauthenticated-branch) into one — the Architect may do so if it's the cleanest way to implement default-deny, but it isn't required as its own goal.

## Open questions

- **Enumerating the legitimately-public mutations is the crux** — Architecture must inventory all 118 mutating routes and classify each (owner / customer / authenticated / intentionally-public), because a missed *public* one breaks a real flow and a missed *private* one stays exposed. Staging smoke is the safety net; the classification is the work.
- **"Mutating" is not purely method-based** — the current middleware already recognizes `?action=enable/disable` state changes on some GETs. Architecture must define what counts as a mutation (method + the `?action=` pattern) and confirm no mutating GET slips through as a "read."

## Linked artifacts
- ADR: `engineering-team/decisions/security-auth-exposure/0002-default-deny-for-mutations.md`
- Test plan: *(after Test Design)*
- Review: *(after Review)*
