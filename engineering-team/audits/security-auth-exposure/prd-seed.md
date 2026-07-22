# PRD Seed: API Authorization Posture (default-deny for mutations)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/security-auth-exposure/audit.md`
**Anchor:** acceptance frame in `book.md` (human-gated, operator-confirmed 2026-07-19)
**Confidence:** high on the as-built (small surgical diff, verified live on all three instances); this is a **security/infrastructure** baseline, not a user-facing product — the "personas" and "design rules" sections are thin by nature.
**Date:** 2026-07-20

> Reverse-engineered baseline in PRD shape, built from what shipped. A strawman for the product/security team, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — input needed]`. Note: this book hardened *infrastructure* (the auth layer), so much of the value is invisible to end users — frame it as a security invariant, not a feature.

## 1. Product vision

`[FROM FRAME]` The Tapestry HTTP API must be **safe to expose to the internet**: no unauthenticated caller can mutate an instance's graph, mint events signed as its Tapestry Assistant, run administrative operations, or read credentials — while legitimate traffic (owner UI, in-container server self-calls, public read/browse) keeps working.
`[INFERRED]` The underlying invariant: **mutations are private by default; only an explicit, documented allowlist is public.** Security no longer depends on remembering to list each new write endpoint.
`[UNKNOWN]` Whether the instances are intended to serve *any* external programmatic clients beyond the web UI (which would change the public-allowlist policy).

## 2. Personas

`[INFERRED]`
- **Instance owner/operator** — authenticates via NIP-07; performs authoring, admin, and graph edits. Unaffected by the change.
- **Public browser** — anonymous visitor reading the knowledge graph and search results. Preserved (reads open; `neo4j/query` read + `concept-graph` public).
- **Logged-in non-owner nostr user** — tags/notes/pins via their own signed events (`strfry/publish signAs:'client'`, permissionless). Preserved.
- **Server-side self-caller** — the in-process firmware-install bridge and the loopback trusted-list cron. Trusted via the honest-local signal (loopback + no proxy header).
- **Attacker** — the persona the book is *about*: previously could hit 44 admin mutations + arbitrary Cypher + a credential-leaking RCE, unauthenticated. Now denied by default.

## 3. Scope (as-built)

`[FROM FRAME]` / `[INFERRED]` **In scope, shipped:**
- Honest-local bypass keyed on loopback peer **and** absence of proxy-forwarding headers (spoof-resistant; `trust proxy` off).
- Method-based default-deny for unauthenticated `POST/PUT/PATCH/DELETE`; exact-match public allowlist (`/api/neo4j/query`, `/api/strfry/publish`).
- Handler-level privilege gates: write-Cypher on `/api/neo4j/query` (owner/localTrusted); `signAs:'assistant'` on `/api/strfry/publish` (owner/localTrusted).
- Deletion of the `run-query` RCE/leak endpoint.
- Deployed to staging, production, feat/tags. Neo4j credential rotated on all three.

**Explicitly out (deferred):** unauthenticated read-Cypher restriction; authenticated-non-owner privilege tightening; rate-limiting/spam on `strfry/publish`; the network firewall for the exposed backend ports (OPEN.md #66); the `ProfileTagsSection` login-gate UX.

## 4. Domain model

`[INFERRED]` No concept-graph domain entities changed — this book operates at the **transport/authorization layer**, not the data model. The relevant "entities":
- **Request trust levels:** `unauthenticated` · `localTrusted` (in-container, loopback + no proxy header) · `authenticated non-owner` · `owner`.
- **Endpoint classes:** public-read · public-mutation (allowlisted: `neo4j/query`, `strfry/publish`) · owner/authenticated mutation (default-deny) · route-guarded (`requireOwner`).
- **Privileged operations gated in-handler:** write-Cypher; TA-signing.

## 5. Design rules (as-built)

`[INFERRED]`
- **Default-deny for mutations.** New mutating endpoints are private automatically; making one public is a conscious, single-line allowlist edit.
- **`trust proxy` stays OFF.** Client-supplied forwarding headers must never grant trust; presence of `X-Forwarded-For`/`X-Real-IP` = proxied = remote.
- **Handler-level privilege discrimination** for endpoints that are public-but-partly-privileged (reads vs writes; client-sign vs TA-sign) — mirror the `neo4j/query` / `strfry/publish` pattern.
- **Deploy invariant:** every proxy hop in front of the app sets `X-Forwarded-For`. `[UNKNOWN]` whether this is enforced anywhere or just conventional.

## 6. Carry-forward & open questions

(Promoted from build audit §6.)
- Firewall the internet-exposed backend ports (OPEN.md #66) — the last book companion.
- Restrict unauthenticated read-Cypher (migrate public reads to `/api/concept-graph/*`, then lock `/neo4j/query`).
- Default-deny for authenticated-non-owner mutations.
- Durable port hardening: localhost-bind the backend ports in `docker-compose.yml`.
- The parked **relationship-primitives** feature now lands on this secured surface — `docs/RELATIONSHIP_PRIMITIVES_HANDOFF.md`.

## 7. What product/security must validate

- [ ] `[UNKNOWN]` Is unauthenticated **read** Cypher acceptable as a permanent posture, or must it be closed? (Currently open by design.)
- [ ] `[UNKNOWN]` Should logged-out profile tagging (`ProfileTagsSection`) remain, or be gated behind login like its siblings?
- [ ] `[UNKNOWN]` Are there external programmatic clients that legitimately need any backend port open, before the firewall locks them?
- [ ] `[INFERRED→confirm]` Is authenticated-non-owner (logged-in guest) access to unlisted mutations acceptable, or should the authenticated branch also default-deny?
