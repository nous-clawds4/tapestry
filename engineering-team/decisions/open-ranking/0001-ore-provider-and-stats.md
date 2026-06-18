# ADR 0001: ORE provider surface + ORE-02 `/stats/pubkey`

**Status:** Accepted
**Date:** 2026-06-18
**Story:** `engineering-team/stories/open-ranking/1-ore-provider-and-stats.md`

## Context

Story 1 stands up a public, read-only [Open-Ranking](https://github.com/Open-Ranking/protocol) (ORE) provider: the **ORE-01 capability document** at `GET /.well-known/open-ranking.json` plus its first backed endpoint, **ORE-02 `POST /stats/pubkey`**, with a global default algorithm (`grapevine`, `pov:false`) and a personalized one (`grapevine-personalized`, `pov:true`, provisioned POVs only → `422` otherwise). Acceptance criteria, restated: capability doc advertises only `/stats/pubkey`; `OPTIONS` preflight succeeds; global stats returns `{pubkey, rank, …}` with `rank = round(influence×100)`; personalized works for a provisioned `pov` and `422`s an unprovisioned one; ORE-00 conventions (hex validation, `application/json`, `ACAO:*`, status+`X-Reason` errors, `pov`-to-global ignored); additive/isolated.

**No concepts touched.** ORE is infrastructure over already-computed scores; it introduces no concept-graph concept and changes no schema. (Per the Concept Graph orientation rule: there is nothing to orient on here — no firmware reinstall.)

Grounding facts from the codebase (verified):

- **Stats data already exists.** `src/api/export/users/queries/get-profile-scores.js` returns, for a target `pubkey` under an `observerPubkey`: `influence`, `followingCount`, `followerCount`, `mutingCount`, `muterCount`, `reporterCount`, `reportingCount`, verified counts, `hops`, `latestContentEventCreatedAt`, etc. `observerPubkey='owner'` (default) reads the **`NostrUser` node** (the instance owner's baseline GrapeRank); any other `observerPubkey` reads a **`NostrUserWotMetricsCard {observee_pubkey, observer_pubkey}`**. When no row exists it returns a zeroed `profileFound:false` object.
- **Card POV identity = the customer's own pubkey.** Across the customer pipeline (`src/algos/customers/personalizedGrapeRank/updateNeo4j.js:161`, `calculateHops.sh`, `nip85/publish_kind30382.js:57`) `NostrUserWotMetricsCard.observer_pubkey` is set to `CUSTOMER_PUBKEY`. So an ORE `pov` (a nostr pubkey) maps **directly** to `observer_pubkey` for stats — no delegation indirection on this path. (`resolvePov` in `src/api/_shared/pov.js` keys the *Meili* path by the *delegated* suffix instead; that mismatch is a Story-2/search concern, not Story 1.)
- **`.well-known` precedent.** `src/api/nip05.js:169` registers `app.get('/.well-known/nostr.json', …)` via `registerNip05Routes(app)`, called from `src/api/index.js:101`. Its handler sets `Access-Control-Allow-Origin: *`, `Cache-Control`, `Content-Type` then `res.json(...)` (`nip05.js:93–96`). This is the template.
- **Auth is auto-exempt off `/api/`.** `src/middleware/auth.js:313` returns `next()` for any `!req.path.startsWith('/api/')`. Bare `/.well-known/open-ranking.json` and `/stats/pubkey` are therefore public with no allowlist edit.
- **Routing.** `register(app)` (`src/api/index.js:97`) runs at `bin/control-panel.js:277`, *before* the SPA catch-all `app.get('*')` at `:297`. Routes registered in `register()` win over the catch-all (proven by `nostr.json`). `express.json()` (`:120`) parses bodies; a malformed body raises `entity.parse.failed` (→ 400) before the handler.
- **CORS.** Global `cors({ origin:true, credentials:true, methods:[…OPTIONS], allowedHeaders:['Content-Type','Authorization','X-Requested-With'] })` (`bin/control-panel.js:113`). The `cors` package **terminates `OPTIONS` preflight itself with 204** (its default `optionsSuccessStatus`) and reflects the request origin. So a route-level `OPTIONS` handler registered inside `register()` never runs, and the preflight `ACAO` is the reflected origin, not `*`. Actual (GET/POST) responses can still be overridden in-handler to `ACAO:*` (last-writer-wins), exactly as `nip05.js` does.

## Options considered

### Option A — Thin adapter over existing query functions, driven by a capability registry *(chosen)*
A new `src/api/open-ranking/` module. A single `CAPABILITIES` object is the source of truth for both the served ORE-01 document and per-request validation (supported algorithms, defaults, `pov` flags). The `/stats/pubkey` handler validates per ORE-00/01, then calls a **reusable** `fetchProfileScores({pubkey, observerPubkey})` extracted from the existing `get-profile-scores.js`, and maps the result into ORE's wire shape. Provisioned-POV detection is a cheap Neo4j existence check.

- **Pros:** Reuses the exact data path the control panel already trusts (one source of truth for scores). Registry keeps the advertised doc and the request validator from drifting. Confined to a new module + one registration line + a small refactor-for-reuse of the existing query. Additive, no entrypoint change, no signing, no schema/firmware change.
- **Cons:** Requires extracting the core query out of the Express handler (small refactor of a shared file). Two Neo4j round-trips per personalized request (provisioned-check + fetch).

### Option B — Standalone ORE service that queries Neo4j/Meili directly
The ORE module opens its own Neo4j driver and writes its own Cypher, duplicating `get-profile-scores`.

- **Pros:** No refactor of the existing handler; fully self-contained.
- **Cons:** Duplicates score-fetch logic and the owner-vs-card branching — two code paths to keep in sync; the field semantics would inevitably diverge. Rejected.

### Option C — Derive ORE responses from the existing NIP-85 kind-30382 events
Read the already-published trusted-assertion events and reshape them into ORE JSON.

- **Pros:** Reuses the existing *export*; conceptually "one source."
- **Cons:** kind-30382 is a *publication* format for a chosen target set, not a query interface — it can't answer "stats for arbitrary pubkey X under POV Y" without first having published an assertion for (X,Y). Adds staleness and indirection. Rejected. (ORE and NIP-85 stay sibling surfaces over the *same Neo4j data*, per the book's positioning — not layered on each other.)

## Decision

**Option A.** Build a self-contained `src/api/open-ranking/` module that adapts the existing `get-profile-scores` data into ORE wire shapes, driven by a capability registry, registered next to NIP-05.

### POV semantics (the load-bearing sub-decisions)

- **Global `grapevine` = the instance-owner baseline POV.** Served by `fetchProfileScores({pubkey, observerPubkey:'owner'})` → the `NostrUser` node's `influence`. This is the always-present, firmware-seeded default — the instance's "house"/global grapevine opinion on the Neo4j path. It needs no `grapevine`-house configuration to exist. (The configurable house *delegate* that the search page uses for logged-out users lives only in the Meili columns; on the Neo4j/stats path the owner node **is** the global baseline. Unifying "house delegate" across both stores is deferred to Story 2 / a later ADR.)
- **Personalized `grapevine-personalized` = the request `pov` used directly as `observer_pubkey`.** Served by `fetchProfileScores({pubkey, observerPubkey: pov})` → the card path (or the owner node if `pov === ownerPubkey`).
- **Provisioned check (the `422` trigger):** `isPovProvisioned(pov)` = `pov === ownerPubkey` **OR** a `NostrUserWotMetricsCard {observer_pubkey: pov}` exists (`MATCH (c:NostrUserWotMetricsCard {observer_pubkey:$pov}) RETURN count(c) > 0 LIMIT 1`). Unprovisioned → `422` + `X-Reason: pov not provisioned`. This is distinct from "target has no card under a valid POV" (which legitimately returns a floor `rank`, per ORE — no `404` for unknown pubkeys). *(Alternative considered: owner OR active customer via `CustomerManager`; rejected as primary because card-existence is the truer "scores actually present" signal, but it's a fine cross-check.)*

### ORE-02 field mapping (v1)

| ORE-02 field | Req | Source (`get-profile-scores`) | v1 mapping |
|---|---|---|---|
| `pubkey` | MUST | request | echo |
| `rank` | MUST | `influence` ∈ [0,1] | `round(influence × 100)` |
| `follows` | MAY | `followingCount` | as-is |
| `followers` | MAY | `followerCount` | as-is |
| `mutes` | MAY | `mutingCount` | as-is |
| `muters` | MAY | `muterCount` | as-is |
| `reporters` | MAY | `reporterCount` | as-is |
| `reports` | MAY | *(no raw report-event count on this path)* | **omit v1** |
| `first_seen_at` | MAY | only `latestContentEventCreatedAt` (LATEST, not earliest) | **omit v1** (semantic mismatch) |
| `ttl` | MAY | — | fixed hint `3600` |

### CORS / preflight

In-handler `setOreCors(res)` sets `Access-Control-Allow-Origin: *` and clears `Access-Control-Allow-Credentials` on every ORE response (success and error) — matching `nip05.js`, overriding the global reflected-origin value. **Preflight is left to the existing global `cors()`** (returns a 2xx — 204 — reflecting the origin and allowing `POST`+`Content-Type`), which is sufficient for real non-credentialed cross-origin clients. This means the literal story criterion "`OPTIONS` → **200**" is met as a **2xx** (204), not exactly 200, and the preflight `ACAO` is the reflected origin rather than `*` — a cosmetic deviation from ORE-00 that does not break browser clients. **Gate item:** relax AC #2 to "preflight returns a 2xx with `Allow-Methods`/`Allow-Headers` permitting `POST`+`Content-Type`." *(Alternative for strict ORE-00 preflight conformance — an ORE-scoped CORS shim mounted before the global `cors()` in `bin/control-panel.js`, bypassing global cors for ORE paths so preflight is a clean 200 with `ACAO:*` — is deferred unless a client needs it; it's the only part that would touch the entrypoint, so v1 avoids it.)*

## Consequences

- **Enables** a conformant, public, read-only ORE provider with one real endpoint, reusing trusted data with no new computation, no signing, and no firmware/schema change. ORE sits beside NIP-85 over the same Neo4j data.
- **Constrains:** the global algorithm reflects the **owner** baseline (not a separately-configured house delegate) on the stats path; if Story 2's search ranks by a different (house-delegate) POV, "global" must be reconciled to mean the same thing across both — tracked for Story 2.
- **Debt/follow-ups:** strict ORE-00 preflight (200 + `ACAO:*`) deferred; `reports`/`first_seen_at` omitted pending a real earliest-activity / report-event-count source; the Neo4j `observer_pubkey` existence check may warrant an index if personalized traffic grows (note for the Implementer/ops). The two POV-identity schemes (card main-pubkey vs Meili delegated-suffix) remain unreconciled until Story 2.
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

New module `src/api/open-ranking/` (the Implementer may collapse files):

- `capabilities.js` — the `CAPABILITIES` registry and `buildCapabilityDocument()`:
  ```js
  const CAPABILITIES = {
    '/stats/pubkey': [
      { id: 'grapevine', name: 'Grapevine', pov: false,
        description: "Global web-of-trust rank from this instance's grapevine (GrapeRank influence ×100)." },
      { id: 'grapevine-personalized', name: 'Personalized Grapevine', pov: true,
        description: 'Web-of-trust rank from the supplied point-of-view pubkey. Requires a provisioned POV.' },
    ],
  };
  ```
  (`learn_more`/`icon` omitted — optional — until a docs page exists.) `resolveAlgorithm(endpointPath, requestedId)` returns the array element by `id`, or element `[0]` when `requestedId` is absent (the default), or `null` when an `id` is given but unsupported (→ `422`).
- `shared.js` — `setOreCors(res)`; `oreError(res, status, reason)` (sets status + `X-Reason` + `setOreCors` + `res.json({error:reason})`); `isValidHexPubkey(s)` (`/^[0-9a-f]{64}$/`); `isPovProvisioned(pov)` (owner short-circuit + the Neo4j existence query); `ORE_STATS_TTL = 3600`.
- `stats.js` — `handleStatsPubkey(req, res)`: `setOreCors`; if body not parsed/invalid → `400`; validate `pubkey` (`422` if missing/non-hex/`npub`); `resolveAlgorithm` (`422` if unsupported); if `algo.pov`: require+validate `pov` (`422` if missing/non-hex), `isPovProvisioned` (`422` + `X-Reason` if not); if `!algo.pov`: ignore any `pov`; pick `observerPubkey` (`'owner'` for global / `pov === owner`, else `pov`); call `fetchProfileScores`; map per the table; `res.json({ pubkey, rank, follows, followers, mutes, muters, reporters, ttl })`.
- `index.js` — `registerOpenRankingRoutes(app)`:
  ```js
  app.get('/.well-known/open-ranking.json', handleCapabilityDoc); // ACAO:*, Cache-Control: public, max-age=300
  app.post('/stats/pubkey', handleStatsPubkey);
  ```
- Wire-in: in `src/api/index.js` immediately after line 101 (next to `registerNip05Routes(app);`):
  ```js
  const { registerOpenRankingRoutes } = require('./open-ranking');
  registerOpenRankingRoutes(app);
  ```
- Refactor for reuse: in `src/api/export/users/queries/get-profile-scores.js`, extract the core query into `async function fetchProfileScores({ pubkey, observerPubkey })` returning the `profileData` object (or the zeroed object), and have the existing `handleGetProfileScores` call it. The ORE stats handler calls the same function. (Owner-vs-card branching stays inside it.)
- Malformed-JSON 400: add a 4-arg error middleware (after routes) that, for ORE paths with `err.type === 'entity.parse.failed'`, responds `oreError(res, 400, 'malformed JSON')`; otherwise `next(err)`.

## Out of scope
- ORE-05 `/search/pubkeys` and growing the capability document (Story 2).
- Strict ORE-00 preflight conformance (200 + `ACAO:*` on `OPTIONS`) — deferred CORS shim.
- ORE-A/NWT auth; the `202`/`Retry-After` async pattern; `reports`/`first_seen_at` population; on-demand POV computation; reconciling the two POV-identity schemes; the BIBLE write-up (Story 2 / close).
