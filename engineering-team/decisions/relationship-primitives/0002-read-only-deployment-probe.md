# ADR 0002: Read-only deployment probe — zero-require module, `GET /api/normalize/relationship-primitives`, Express-404 sibling contrast

**Status:** Proposed
**Date:** 2026-07-21
**Story:** `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md`

## Context

The book's acceptance frame, bullet 8(a), requires journaled proof that the relationship-primitives routes are **deployed** on `staging.brainstorm.world` — a response distinguishable from a missing route. The frame's anticipated mechanism (an auth-class 401/403 proving deployment) was falsified in story #1's Test Design: default-deny answers unauthenticated mutations *before* route matching, so a present POST route and a missing one answer identically (401), and global CORS answers OPTIONS preflight on every path. Story #2 (fix-forward, operator-ruled 2026-07-21) adds a minimal read-only probe whose answer IS distinguishable from a missing route — no credentials, no graph access, no mutation, explicitly **not** a health/monitoring endpoint.

**Concept Graph orientation was performed first**, per AGENTS.md §1–§3 (`CONTROL_PANEL_PORT` resolved to `7778` from the code default in `bin/control-panel.js`; stack up; TA pubkey resolved via `/api/assistant/pubkey`): `/api/concept-graph/summaries` was scanned and **confirms the story touches no concepts** — nothing in the graph relates to this probe, so no `/neighbors` or `/node` calls were warranted. The probe's contract forbids graph access entirely (story "Concepts touched": none).

**Empirical verification against the live local stack (2026-07-21, host-side `curl` = the unauthenticated remote-class caller, per ADR `security-auth-exposure/0001`'s verified consequence that host→`:7778` peers as the Docker bridge gateway):**

| Request | Observed |
|---|---|
| `GET /api/normalize/no-such-path` (no credentials) | **404**, `Content-Type: text/html`, body `<pre>Cannot GET /api/normalize/no-such-path</pre>` — Express's finalhandler. The auth middleware passed the GET through to the router; only route-matching failure produced the 404. |
| `GET /api/normalize/add-relationship` (registered POST-only) | **404** `Cannot GET …` — route matching is method-scoped, so a **GET route answering is genuine registration evidence**, not middleware leniency. |
| `POST /api/normalize/no-such-path` (no credentials) | **401** `{"error":"Authentication required for this action"}` — default-deny answers before routing, reconfirming the falsified mechanism *and* that the host path is the unauthenticated-remote class. |

**Middleware trace for a GET under `/api/normalize/*`** (`src/middleware/auth.js`): unauthenticated branch — GET is not in `MUTATING` (`:448`), and the probe path matches none of `protectedGetEndpoints` (`:460-465`), so it reaches the deliberate `return next()` at `:474` ("Public read-only API access"). Authenticated branch — `'/api/normalize'` in `ownerOnlyEndpoints` binds **POST only** (`:417-419`), and `ownerOnlyGetEndpoints` doesn't match, so `next()` at `:440`. Trusted-local — `next()` at `:337`. The probe therefore answers identically for every caller class, and a POST to the same path stays 401-gated (no capability added).

**Binding constraint from story #1:** its ratified S-class suite (`test/relationship-primitives.test.js`) asserts `relationships.js`'s require list **exactly** (`['../../lib/neo4j-driver', '../../middleware/auth', './firmware']`, S1 at `:507-526`) and that no whitelisted Neo4j alias appears as a raw string literal in that file (S2 at `:528-539`). The probe must not perturb that file or its audited surface. Also relevant: no GET route is currently registered anywhere in `registerNormalizeRoutes` (`src/api/normalize/index.js:3299-3335`) — the probe would be the first, with no collision.

**ADR conflict check:** consistent with `security-auth-exposure/0002` — default-deny is mutation-scoped *by that ADR's own decision* ("the final `return next()` now serves only reads and allowlisted mutations"); a credential-free static GET joins the sanctioned public-read class, discloses no data (two route names, already public in this open repo — strictly less than the public `/api/concept-graph/*` reads expose), and adds nothing to `PUBLIC_MUTATIONS` or any middleware list. Consistent with `security-auth-exposure/0001` (untouched; the probe doesn't use `localTrusted`). Additive to `relationship-primitives/0001` (the primitives and their auth behavior are byte-untouched). ADR 0015's `LEGACY_*` exception is irrelevant (no pubkey appears anywhere in the probe). Nothing is superseded.

## Options considered

### Option A — Dedicated zero-require module `src/api/normalize/probe.js`, `GET /api/normalize/relationship-primitives` registered beside the primitives *(chosen)*

A ~15-line module with **zero `require` calls**, exporting one handler that returns a module-level static JSON literal. Registered in `registerNormalizeRoutes` immediately after the relationships registration block — same register function, same delivery unit.

**Pros:** the story's hardest guarantee — zero side effects — becomes an *import-boundary fact* (an empty require list structurally cannot reach Neo4j, strfry, `child_process`, or signing keys), the exact auditing pattern story #1 established; `relationships.js` stays byte-identical, so S1/S2 are untouched; the handler is unit-testable standalone with no stubs; registration beside the primitives means a probe answer is attributable — it proves the registration block that carries the primitives deployed and ran.
**Cons:** one more file for very little code; a sync burden if the primitives' route names ever change (mitigated by an S-class cross-check, decision 5 below).

### Option B — Inline arrow handler in `registerNormalizeRoutes`

`app.get('/api/normalize/relationship-primitives', (req, res) => res.json({...}))` directly in `index.js`.

**Pros:** no new file; literally adjacent to the registrations it evidences.
**Cons:** not unit-testable without requiring the 3,929-line `index.js`, which pulls in `nostr-tools`, `child_process`, and TA signing keys at require time — forcing the pre-require stub dance for zero benefit; the zero-side-effect guarantee degrades from a checkable import boundary to "trust this closure inside a strfry-heavy module"; the response literal is buried in the largest file on the surface. Rejected: trades away exactly the auditability this fix-forward story exists to provide, to save one tiny file.

### Option C — Extend `src/api/normalize/relationships.js` with the probe handler

One module holds the whole story-1+2 surface ("ships alongside" taken maximally).

**Pros:** single file to read for the whole primitives surface; no new registration require.
**Cons:** enlarges the module whose source is under ratified byte-level audit — S1 pins its require list exactly and S2 greps it for forbidden literals — so every future probe edit re-opens story #1's structural contract, coupling the two stories' guarantees; the probe (all-caller public) and the primitives (owner/local-gated mutations) have opposite trust postures, and housing them together invites gate-confusion in review. Rejected: the guarantees stay independently auditable only if the files are separate.

## Decision

We chose **Option A**. It is the smallest shape that satisfies every acceptance criterion, keeps story #1's ratified structural tests untouched, and re-uses the book's established pattern of turning a negative guarantee (touches nothing) into a mechanically checkable import boundary.

### Design decisions resolved (delegated by the story to the Architect)

**1. Route + placement: `GET /api/normalize/relationship-primitives`, under the fixed mount.** The book's mount-fixing bound the *primitives*; the probe's placement was delegated — and the same mount is right anyway: (a) "ships alongside" is strongest when the probe is registered in the same `registerNormalizeRoutes` block, so it answers if-and-only-if the delivery unit carrying the primitives deployed; (b) on deployed instances the probe and its unregistered sibling then ride the same nginx proxy location, so a 200-vs-404 contrast cannot be explained by front-proxy routing differences; (c) the middleware pass-through was empirically verified on this exact prefix (Context table). A fresh prefix (`/api/deployment/*`, `/api/status/*`) was rejected: it weakens attributability (a separate registration site could deploy independently) and creates a landing pad for exactly the health-endpoint scope creep the story bans. The flat kebab-case name matches the surface convention and *names the surface* (AC2's attributability) — a generic `/probe` would not. Substring-checked against every list in `auth.js`: no collision (`'/api/normalize'` in `ownerOnlyEndpoints` is POST-scoped; `protectedGetEndpoints` doesn't match).

**2. Method: GET.** The only method that both passes default-deny credential-free *and* carries an attributable body. OPTIONS is falsified (global CORS answers preflight on every path); HEAD has no body to journal; any mutating method 401s unauthenticated — the very mechanism that failed. Express's method-scoped matching (verified: GET to the POST-only `add-relationship` 404s) makes a GET answer genuine registration evidence.

**3. Response shape: a static module-level literal, nothing computed.**
```json
{ "success": true, "surface": "relationship-primitives", "operations": ["add-relationship", "delete-relationship"] }
```
`success` follows the surface convention; `surface` + `operations` are precisely AC2 — the response affirmatively names which relationship-primitives operations are available, so it is attributable, not generic. **Deliberately excluded:** version/build/uptime/counts (story out-of-scope: health/monitoring metadata); the relType whitelist (including it would require importing from `relationships.js` — coupling — or duplicating alias literals, violating the spirit of S2); timestamps (repeated probes must be byte-identical — the cheapest proof of "probing repeatedly leaves the system unchanged"). Status 200 via `res.json`.

**4. Missing-route contrast (AC3):** the journaled pair is the probe (`200`, `application/json`, the literal above) vs `GET /api/normalize/relationship-primitives-missing-sibling` (`404`, `text/html`, `Cannot GET …` from Express's finalhandler) — different status *and* different content class. The sibling path is named here so the H-class test and the staging evidence capture exercise the same reproducible pair.

**5. Test strategy** (strategy only — the suite, its registration, and final shape are the Tester's lane, Phase 3), following story #1's three-class split under ADR `test-hermeticity-ci/0001`:

- **U-class (stack-free):** require `probe.js` standalone — no stubs needed precisely because it imports nothing; drive the handler with a bare mock `req`/`res`; assert 200 and the exact body; assert two consecutive calls produce identical bodies.
- **S-class (source assertions):** the structural zero-side-effect guarantee — assert `probe.js` contains **no `require` calls at all** (empty import surface: nothing can reach `neo4j-driver`, `child_process`, `nostr-tools`, `./firmware`, `fs`); assert `app.get('/api/normalize/relationship-primitives'` is registered in `registerNormalizeRoutes`; **cross-check** that every string in the probe's `operations` array is registered as `app.post('/api/normalize/<op>'` in `index.js` — keeping the evidence honest if the primitives are ever renamed.
- **H-class (live local stack, per-test `SKIP` when unreachable):** host-side credential-free `GET` probe → 200 + exact JSON (host is the remote class — AC1); `GET` the named sibling → 404 non-JSON (AC3); unauthenticated `POST` to the probe path → 401 (no capability added; story #1's auth untouched); `GET /api/strfry/scan/count` equality before/after repeated probes (AC4, reusing story #1's zero-strfry-write check — Neo4j non-access needs no live assertion, it is structurally guaranteed by the empty import list).
- **Staging capture (bullet 8a)** is the Director's journaled read-only exercise, not a test file: curl the probe and the named sibling on `staging.brainstorm.world`, record both statuses and bodies.

## Consequences

- **Enables:** bullet 8(a) is satisfiable exactly as written — a credential-free, side-effect-free remote observation that distinguishes "primitives deployed" from "route missing."
- **Adds a public credential-free endpoint.** Information disclosed: the existence of two route names, already public in this open-source repo — an accepted, empty disclosure. The path stays mutation-gated (verified: unauthenticated POST → 401); no middleware or allowlist changed.
- **The probe asserts registration, not behavior.** A 200 proves the delivery unit carrying the primitives deployed and its registration ran — not that Neo4j is reachable or the handlers succeed. That is deliberate: behavior evidence is the H-class suite's job against the local stack; making the probe verify behavior would turn it into the health check the story forbids.
- **Sync burden:** renaming or extending the primitives post-book requires updating the probe's `operations` literal; the S-class cross-check (decision 5) turns forgetting into a test failure rather than silent evidence rot.
- **Precedent:** first GET on the normalize mount, and a reusable evidence pattern (named-surface GET probe) — but this probe speaks only for the relationship-primitives surface; any future surface wanting one needs its own story (story out-of-scope).
- **Firmware reinstall required?** **No.** No concept definitions change; nothing touches the graph or firmware. (`POST /api/firmware/install` is neither needed nor referenced.)

## Implementation notes

Test-file changes (the new/extended suite and its runner registration) belong to Phase 3 — the Tester's lane — never to implementation.

- **New file: `src/api/normalize/probe.js`** — the whole story lives here. Zero `require` calls, by contract (S-class enforced). Sketch:
  ```js
  /**
   * Read-only deployment probe for the relationship-primitives surface.
   * Evidence-only: proves the surface's delivery unit is deployed
   * (acceptance frame bullet 8a). NOT a health/monitoring/status endpoint —
   * do not add version, uptime, counts, or any computed field (story #2
   * out-of-scope; ADR relationship-primitives/0002).
   * Zero requires BY CONTRACT: this module must never import anything —
   * the empty import surface IS the zero-side-effect guarantee.
   */
  const PROBE_RESPONSE = {
    success: true,
    surface: 'relationship-primitives',
    operations: ['add-relationship', 'delete-relationship'],
  };

  function handleRelationshipPrimitivesProbe(req, res) {
    return res.json(PROBE_RESPONSE);
  }

  module.exports = { handleRelationshipPrimitivesProbe, PROBE_RESPONSE };
  ```
  (`PROBE_RESPONSE` is exported so tests assert the exact body without duplicating it.)
- **`src/api/normalize/index.js`** — in `registerNormalizeRoutes`, immediately after the relationships registration block (`:3328-3330`), add:
  ```js
  // Read-only deployment probe for the relationship-primitives surface
  // (ADR relationship-primitives/0002; evidence-only — NOT a health endpoint)
  const { handleRelationshipPrimitivesProbe } = require('./probe');
  app.get('/api/normalize/relationship-primitives', handleRelationshipPrimitivesProbe);
  ```
  (Inline require inside the register function, mirroring the `./relationships` and firmware-install requires already there.)
- **No changes** to `src/api/normalize/relationships.js` (byte-identical — S1/S2 depend on it), `src/middleware/auth.js`, any firmware JSON, or anything else.
- **Concepts:** none touched; no firmware reinstall.
- Evidence-capture usage (for the Director's staging journal):
  `curl -si https://staging.brainstorm.world/api/normalize/relationship-primitives` → 200 + the literal;
  `curl -si https://staging.brainstorm.world/api/normalize/relationship-primitives-missing-sibling` → 404 `Cannot GET …`.

## Out of scope

- Health, monitoring, status, version/build metadata — any computed or operational field on the probe (story scope note; enforced by the static-literal design).
- Deployment probes for any other API surface.
- Any change to the primitives' auth behavior, the auth middleware, or `PUBLIC_MUTATIONS`.
- The intake out-of-scope list (2026-07-18): strfry emission, reconciler, publication-intent modeling, curator-assertion wire format, UI affordances, the `/elements/add-node` crash, the `publishToStrfry` silent-drop bug.
