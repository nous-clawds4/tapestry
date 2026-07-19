# ADR 0001: Honest-local bypass + handler-level write gate

**Status:** Accepted
**Date:** 2026-07-19
**Story:** `engineering-team/stories/security-auth-exposure/1-close-unauthenticated-write-surface.md`

## Context

The auth middleware's "trusted local operator" bypass (`src/middleware/auth.js:317-324`) fires for any request whose socket peer is loopback. On a deployed instance **every** request is proxied from `127.0.0.1` by nginx, so the bypass fires for the whole internet — exposing `/api/normalize/*` (20 TA-signing writes) and `POST /api/neo4j/query` (arbitrary Cypher read/write). Confirmed live on staging + prod 2026-07-19.

Constraints discovered during design:

- **`trust proxy` is off** (never set anywhere) and must stay off — enabling it makes `req.ip` reflect the attacker-controllable `X-Forwarded-For`.
- **Firmware install** calls these endpoints via an in-process bridge that runs the **full middleware stack** (`app.handle`, `src/firmware/install.js:1376`) with a mock req: `session:{}` (unauthenticated), `ip:'127.0.0.1'`, and a hardcoded `x-forwarded-for:'127.0.0.1'` (`:1349,:1353`). It currently passes only because of the permissive bypass. AC #6 requires it keep working.
- **`/api/neo4j/query` is the UI's read backbone** — 20+ pages (Dashboard, node/user browsing, grapevine, concepts, lists) read through it, currently unauthenticated via the bypass, including public browsing on the search engine. Story AC #2 was refined with operator approval: reject unauthenticated **write** Cypher; allow reads. The handler already classifies queries via `WRITE_KEYWORDS` (`src/api/neo4j/queryPost.js:16`).
- **Read-vs-write is in the request body** (the Cypher string), which path/method middleware cannot see — the write decision must live in the handler.
- Public reads that must stay open — the deploy-safety status endpoint (unauthenticated by design per ADR `deploy-safety-gate/0001`, and curled by the cycle skills), concept-graph reads, strfry scan, `assistant/pubkey`, `auth/status` — are none of them `/api/normalize` or `/api/neo4j/query`, so they are unaffected.

No concept-graph concepts are in scope (this is auth infrastructure). No conflicting ADR: `deploy-safety-gate/0001` documents its endpoint as unauthenticated-by-fall-through; this change preserves that (it touches neither the read fall-through nor `/api/deploy-safety`).

## Options considered

### Option A — Enable `trust proxy` + IP allowlist
Set `trust proxy` so `req.ip` reflects the "real" client, keep the IP check. **Rejected:** with `trust proxy` on, `req.ip` derives from the client-supplied `X-Forwarded-For` — the spoof (AC #3) walks straight in. This is the classic false fix that passes casual review and re-opens the hole.

### Option B — Remove the bypass entirely; require owner auth on both surfaces
Simplest to reason about. **Rejected:** breaks local-dev direct graph editing (the workflow this book exists to enable), and — fatally — breaks `/api/neo4j/query` reads for public browsing across 20+ pages. Wrong fit for a public search engine.

### Option C — Honest-local heuristic + handler write-gate *(chosen)*
Distinguish a **genuinely direct** local request from a **proxied** one by the presence of a forwarding header. Every nginx hop sets `X-Forwarded-For` (`$proxy_add_x_forwarded_for` at every `location`), so proxied/external requests always carry it; a direct request (dev curl, in-process bridge) never does. Gate writes to `/api/neo4j/query` in the handler, where the read/write distinction is visible.

## Decision

**Option C.** Three coordinated changes.

1. **`src/middleware/auth.js`** — replace the `isLocal` gate with an **honest-local** one and stamp a trust flag:
   - `const hasProxyHeader = !!(req.headers['x-forwarded-for'] || req.headers['x-real-ip']);`
   - `const isDirectLocal = LOOPBACK.includes(remoteAddr) && !hasProxyHeader;` where `LOOPBACK = ['127.0.0.1','::1','::ffff:127.0.0.1']`.
   - When `isDirectLocal && (req.path.startsWith('/api/normalize') || req.path.startsWith('/api/neo4j'))`: set `req.localTrusted = true` and `return next()` (as today).
   - Keep `trust proxy` **off**. Drop `172.18.0.1` / `::ffff:172.18.0.1` from the set — no known dependency, and the no-proxy-header gate is the real boundary; the Tester confirms no inter-container caller relies on it.

2. **`src/api/neo4j/queryPost.js`** — after computing `isWrite`, gate writes:
   - `const { isOwner } = require('../../middleware/auth');`
   - `if (isWrite && !isOwner(req) && !req.localTrusted) return res.status(403).json({ success:false, error:'Write queries require owner authentication' });`
   - Reads run for everyone (public browsing preserved).

3. **`src/firmware/install.js`** (internal bridge mock req, ~`:1349`,`:1353`) — remove the misleading `x-forwarded-for:'127.0.0.1'` header (and its `get()` case). The bridge is an in-process trusted call, not a proxied request; without the spurious header it is honestly `isDirectLocal`, so `req.localTrusted` is set and its `/normalize` + `/neo4j/query` writes pass. *(Belt-and-suspenders alternative, if the Implementer prefers explicitness: also set `req.internalTrusted = true` on the mock and OR it into `req.localTrusted`.)*

**How each case resolves:**

| Caller | peer / XFF | `/api/normalize/*` | `/api/neo4j/query` write | read |
|---|---|---|---|---|
| External (via nginx) | loopback / **XFF present** | 401 (unauth write-list) | 403 (handler) | ✅ runs |
| XFF spoof `127.0.0.1` | loopback / **XFF present** | 401 | 403 | ✅ |
| Owner (logged in) | — / session | ✅ (ownerOnly list) | ✅ (isOwner) | ✅ |
| Local-dev direct curl | loopback / **no XFF** | ✅ (localTrusted) | ✅ (localTrusted) | ✅ |
| Firmware-install bridge | loopback / no XFF (post-change-3) | ✅ | ✅ | ✅ |

## Consequences

- **Enables:** unauthenticated internet callers can no longer write to the graph or run write Cypher; the `X-Forwarded-For` spoof is closed by construction (a present header means proxied).
- **Preserves:** local-dev graph editing, firmware install, owner UI authoring, and all public reads (browsing + the deploy-safety curl).
- **Residual risk (stated plainly):** unauthenticated **read** Cypher via `/api/neo4j/query` remains possible — an attacker can read the raw Neo4j graph, not just curated search output. This is the accepted cost of keeping public browsing working under the refined AC #2. Future hardening path: migrate public UI reads to the curated `/api/concept-graph/*` API, then lock `/neo4j/query` fully. Added to the epic backlog.
- **Depends on a deployment invariant:** every proxy layer in front of the app sets `X-Forwarded-For`. True for both nginx hops today; a future proxy that omits it could let the bypass wrongly fire. Documented as a deploy requirement.
- **Follow-ups:** `/api/firmware/install` is itself unauthenticated-callable (default-open) — belongs to the default-posture follow-up story. The `172.18.0.1` drop wants a confirming test.
- **Firmware reinstall required?** No — auth/middleware code only; no concept definitions change.

## Implementation notes

- `src/middleware/auth.js:317-324` — replace the `isLocal` computation + bypass condition with the `isDirectLocal` version; stamp `req.localTrusted = true` on the bypass path. No other branch needs changing: `/api/normalize` is already in `writeEndpoints` (unauth → 401, `:464`/`:483`) and `ownerOnlyEndpoints` (owner → pass, `:383`/`:419`).
- `src/api/neo4j/queryPost.js` — add the write-gate immediately after `const isWrite = WRITE_KEYWORDS.test(cypherCommand)` (`:27`), before the `writeCypher`/`runCypher` branch. Import `isOwner` from `../../middleware/auth` (exported at `auth.js:604`).
- `src/firmware/install.js:1349,1353` — drop the `x-forwarded-for` entries from the mock req.
- *(Optional consistency cleanup, not required for security):* remove `/neo4j/query` from `customerOrOwnerEndpoints` (`auth.js:345`) so an authenticated non-owner "guest" gets the same public-read behavior as an anonymous caller rather than a 403. The handler now owns the write decision. Leave it if the Tester prefers a minimal surface.
- **Test-file changes belong to Phase 3 (Tester's lane), not implementation.** What must be covered: middleware unit tests for the four table rows (especially the XFF-spoof — non-loopback peer + `X-Forwarded-For:127.0.0.1` → treated remote; loopback peer + any XFF present → treated remote); a `queryPost` test that an unauthenticated write → 403 and an unauthenticated read → runs; an end-to-end firmware-install smoke confirming it still succeeds after change 3.

## Out of scope

- Flipping the global default-open middleware posture (unlisted endpoints are public) — planned follow-up story, including the unauthenticated-callable `/api/firmware/install`.
- Restricting the *scope* of allowed unauthenticated read Cypher (the residual risk above).
- Rotating the Neo4j password / firewalling the internet-reachable Bolt (`7687`) + HTTP (`7474`) ports — operator ops companions tracked in the book.
- The client-side `isOwner` pattern and its duplication across the concepts pages.
