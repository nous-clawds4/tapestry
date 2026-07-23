# ADR 0002: Default-deny for unauthenticated mutations

**Status:** Proposed
**Date:** 2026-07-20
**Story:** `engineering-team/stories/security-auth-exposure/2-default-deny-mutating-endpoints.md`
**Extends:** ADR `security-auth-exposure/0001` (the honest-local bypass) — this broadens it; it does not supersede it.

## Context

`authMiddleware` (`src/middleware/auth.js`) is default-**open**: its unauthenticated branch 401s only paths matching a hand-maintained `writeEndpoints` list, then falls through to `return next()` (`:496`). A full inventory (this story's Architecture sweep):

- **117 distinct mutating routes** (`POST/PUT/PATCH/DELETE`) in `src/`.
- **55 reachable unauthenticated today** — **44 truly unguarded** (no middleware, no internal check) + 11 that self-guard.
- The 44 unguarded are **all admin/owner operations** — `POST /api/firmware/install` (reinstall the seed), 6× `/api/tapestry-key/*` (key-store writes), `POST /api/run-task` (arbitrary task), `POST /api/strfry/wipe`, `DELETE /api/search/profiles/meili/wipe`, NIP-85 publishing, negentropy sync, io import/export, scheduled-tasks, algos-config, `POST /api/trusted-list/publish` (unauth **TA-signing**). None should be anonymously callable.

Two structural facts, both verified:

- **The `?action=` mutation check is dead code** (`auth.js:477`): Express's `req.path` excludes the query string, so `req.path.includes('?action=…')` is always false — and **no GET route mutates** (the two `req.query.action` handlers are POST-reached). So the old list also can't catch `PUT/PATCH/DELETE` (it gated `POST` only — e.g. `DELETE meili/wipe` slips through). Mutation detection must be **method-based**.
- **The authenticated branch already handles logged-in users.** Default-deny lives only in the *unauthenticated* branch, so it affects only sessionless callers — logged-in non-owner users (follows, mutes, reports, tagging, pins, exports) are unaffected.

Constraints the flip must honor (from the story + the inventory):

1. **`/api/neo4j/query` must stay reachable sessionless** — story 1 keeps unauth *reads* working (the browsing UI depends on them); the handler already gates *writes*. It is a `POST`, so a naive method-based deny would re-break browsing.
2. **`/api/strfry/publish` must stay reachable sessionless** — it is the server dependency of *all* client-signed publishing; one surface (`ProfileTagsSection`, `ui/src/components/ProfileTagsSection.jsx`, rendered on the public profile page) lets a logged-out nostr user tag a profile. It is dual-mode: `signAs:'client'` (caller-signed) vs `signAs:'assistant'` (server signs as the TA — privileged, currently unauth-callable = a hole).
3. **Server-side loopback self-calls must not be 401'd.** The trusted-list cron (`refresh-all-pinned-tags`, `refresh-applicability-lists`) curls `http://127.0.0.1:$PORT` directly with no session and self-checks "loopback + no reverse-proxy header" (`src/api/trustedList/index.js:201-213`, per ADR `tag-stack-merge-hardening/0001 B3` — the same signal ADR 0001 uses). The firmware-install in-process bridge is the other such caller.
4. **Route-level `requireOwner` guards** (6 routes) and **public reads** (deploy-safety status, concept-graph, strfry scan) must keep working.

No concept-graph concepts in scope. Operator-selected sub-decision (2026-07-20): keep `/api/strfry/publish` public and gate its TA-signing path, rather than requiring login + a UI change.

## Options considered

### Option A — Default-deny in the unauth branch + tiny public allowlist + broaden the honest-local bypass *(chosen)*
Method-based default-deny for sessionless mutations; a minimal, exact-match public-mutation allowlist; broaden ADR 0001's bypass so any genuinely-direct-local call (loopback + no proxy header) is trusted for all paths (covers cron + bridge); gate `signAs:'assistant'` in the publish handler.

### Option B — Audit-and-protect: add each exposed route to the existing lists
Enumerate the 44 and append them to `writeEndpoints`. **Rejected** — the operator chose the systemic flip at Planning; this leaves the default open (the next new endpoint is public again) and inherits the POST-only / dead-`?action` bugs.

### Sub-decision for `/api/strfry/publish` — keep-public-and-gate-TA *(chosen)* vs require-login-and-gate-UI
Chosen: allowlist it (anyone may publish their **own** signed event — aligned with decentralized-first/permissionless publishing) and gate `signAs:'assistant'` to owner/localTrusted in the handler. Preserves the logged-out flow, closes the TA-signing hole, no UI change. The alternative (require any session + gate `ProfileTagsSection` behind login) was rejected as it changes UX and widens the diff into the UI.

## Decision

**Option A.** Four coordinated changes.

1. **`src/middleware/auth.js` — default-deny for mutations (unauth branch).** Replace the `writeEndpoints`/`isWriteEndpoint` machinery with:
   - `const MUTATING = ['POST','PUT','PATCH','DELETE'];`
   - `const PUBLIC_MUTATIONS = ['/api/neo4j/query', '/api/strfry/publish'];` — **exact-path** match (`PUBLIC_MUTATIONS.includes(req.path)`), not substring (an allowlist must not over-match).
   - `if (MUTATING.includes(req.method) && !PUBLIC_MUTATIONS.includes(req.path)) return res.status(401).json({ error: 'Authentication required for this action' });`
   - Keep `protectedGetEndpoints` (sensitive GET reads) exactly as-is. The final `return next()` now serves only reads and allowlisted mutations. `writeEndpoints` is deleted (subsumed).

2. **`src/middleware/auth.js` — broaden the honest-local bypass.** Change the ADR-0001 bypass condition from `isDirectLocal && (path.startsWith('/api/normalize') || path.startsWith('/api/neo4j'))` to `isDirectLocal && req.path.startsWith('/api/')` (still stamping `req.localTrusted = true; return next()`). Justification: `isDirectLocal` (loopback peer + no `X-Forwarded-For`/`X-Real-IP`) is **externally unspoofable** — nginx always adds the header, and a direct-to-`:7778` external caller has a non-loopback peer — so this only ever trusts genuinely-in-container callers (the operator, the firmware bridge, the trusted-list cron), which are already trusted. This is what prevents the cron from being 401'd by change 1.

3. **`src/api/strfry/commands/publishEvent.js` — gate TA-signing.** At the top of the `signAs === 'assistant'` branch: `if (!isOwner(req) && !req.localTrusted) return res.status(403).json({ success:false, error:'Signing as the assistant requires owner authentication' });` — import `isOwner` from `../../../middleware/auth`. The `signAs:'client'` path is unchanged (caller-signed events remain public).

4. No change to the authenticated branch or the route-level `requireOwner` guards — they already do the right thing.

**How the cases resolve (deployed instance):**

| Caller | Path / method | Result |
|---|---|---|
| Anon, proxied | `POST /api/firmware/install` (or any of the 44) | **401** (default-deny) |
| Anon, proxied | `POST /api/neo4j/query` read | 200 (allowlisted → handler; reads open) |
| Anon, proxied | `POST /api/neo4j/query` write | 403 (allowlisted → handler; story-1 gate) |
| Logged-out nostr user | `POST /api/strfry/publish` `signAs:'client'` | publishes (allowlisted; permissionless) |
| Anyone | `POST /api/strfry/publish` `signAs:'assistant'` | 403 unless owner/localTrusted (hole closed) |
| Logged-in non-owner | any tagging/notes/pins/export | unaffected (authenticated branch) |
| Trusted-list cron / firmware bridge | loopback + no XFF, any `/api/*` | trusted (broadened bypass) |
| Public read | `GET /api/deploy-safety/status`, concept-graph | 200 (mutation-only deny) |

## Consequences

- **Closes 44+ unauthenticated mutations by construction**, including `firmware/install`, `tapestry-key/*`, `run-task`, `strfry/wipe`, `meili/wipe` (DELETE), and the unauth-TA-signing `trusted-list/publish` — plus every *future* mutating endpoint is private by default (the point of the story).
- **Preserves** public browsing (`neo4j/query` reads), logged-out client-signed tagging (`strfry/publish`), the trusted-list cron, the firmware bridge, owner flows, and public reads.
- **Broadens the local-trust surface** to all in-container callers (from ADR 0001's two path prefixes). Safe because the signal is externally unspoofable; documented as a deploy invariant (every proxy hop sets `X-Forwarded-For` — already relied on by ADR 0001 and `tag-stack-merge-hardening/0001`).
- **Residual / out of scope:** (a) an anonymous caller can still POST an *own-signed* event to local strfry — this is a relay accepting signed events (permissionless publish; spam is a relay write-policy/rate-limit concern, not auth). (b) Authenticated-**non-owner** privilege granularity — a logged-in guest can still reach non-owner-listed mutations via the authenticated branch (unchanged from today); tightening that is a separate story. (c) `ProfileTagsSection` being ungated where its siblings require login is a UX inconsistency the operator may address separately.
- **Firmware reinstall required?** No — auth/publish code only; no concept definitions change.

## Implementation notes

- `src/middleware/auth.js:435-497` — replace the `else` (unauth) branch's `writeEndpoints`/`isWriteEndpoint` block with the method-based default-deny + `PUBLIC_MUTATIONS` exact-match above; retain `protectedGetEndpoints` and the trailing `return next()`.
- `src/middleware/auth.js:~325` — broaden the bypass path condition to `req.path.startsWith('/api/')`.
- `src/api/strfry/commands/publishEvent.js:~29` — add the owner/localTrusted gate at the start of the `signAs === 'assistant'` branch; `const { isOwner } = require('../../../middleware/auth')`.
- **Test-file changes are Phase 3 (Tester's lane).** What must be covered: (1) unauth `POST/PUT/PATCH/DELETE` to a non-allowlisted path (esp. `firmware/install`, and a `DELETE`) → 401; (2) unauth `POST /api/neo4j/query` read → not 401 (allowlisted), write → 403 (story-1 gate still reached); (3) unauth `POST /api/strfry/publish` `signAs:'client'` → not 401, `signAs:'assistant'` → 403; (4) `req.localTrusted` (loopback+no-XFF) mutation to an arbitrary `/api/*` path → allowed (cron/bridge); (5) public GET reads (deploy-safety) → 200; (6) an owner-session mutation → allowed (authenticated branch unaffected).

## Out of scope

- Authenticated-non-owner privilege tightening (a logged-in guest reaching non-owner mutations).
- Gating `ProfileTagsSection` behind login (the rejected sub-option).
- Rate-limiting / spam control on `/api/strfry/publish` (relay write-policy layer).
- The operator ops companions (Neo4j password rotation, Bolt/HTTP port firewalling) — book-tracked.
