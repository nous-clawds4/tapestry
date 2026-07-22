# ADR 0001: Strfry-free relationship add/delete primitives — dedicated module, two POST routes, in-handler owner gate

**Status:** Proposed
**Date:** 2026-07-21
**Story:** `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md`

## Context

The operator needs two strfry-free primitives — **add** and **delete** a single, typed, directed relationship between two nodes that already exist in the Neo4j reference graph — reachable by plain `curl` from the local/Docker host, with existence checks, a relationship-type whitelist, an idempotency contract, and structured results. Today the only arbitrary-pair primitive is raw Cypher (`POST /api/neo4j/query`), every `/api/normalize/*` route is composite with strfry emission baked in, and no single-edge delete exists anywhere (intake 2026-07-18, verified).

**Concept Graph orientation was performed first**, per AGENTS.md §1–§3, against the local stack (`CONTROL_PANEL_PORT` resolved to `7778`; TA pubkey resolved at runtime via `/api/assistant/pubkey`): `/api/concept-graph/summaries`, then `/node/:handle/neighbors` for `39998:<TA>:relationship-type` and `39998:<TA>:class-thread`, then the full `/node` for `39998:<TA>:relationship-type`. The story's concepts (`relationship`, `relationship-type`, `class-thread`, `set`, `superset`) all exist in the graph. **No concept definition changes in this story** — the whitelist is a code-level construct over the *firmware alias layer*, not a graph schema change.

Constraints, verified in this checkout (0 behind `origin/staging`):

- **Mount is fixed** at `/api/normalize/*` (book pre-arming refresh, 2026-07-21). Only the route *names* are delegated.
- **Auth landscape after `security-auth-exposure`:** unauthenticated mutations are default-deny (ADR `security-auth-exposure/0002`); a genuinely-direct-local caller (loopback peer + no proxy header) gets `req.localTrusted` (ADR `security-auth-exposure/0001`); an **authenticated non-owner** still reaches any ungated `/api/normalize/*` handler, so each operation needs its own explicit owner gate. The templated pattern is `src/api/strfry/wipe.js:14` — `if (!isOwner(req) && !req.localTrusted) return 403` — with `isOwner` at `src/middleware/auth.js:265`.
- **Route-level `requireOwner` is the wrong gate here:** the only `requireOwner` middleware in the tree (`src/api/settings/settingsApi.js:47`) 401s *any sessionless caller* — it does not honor `req.localTrusted`, so it would break the local `docker exec … curl` operator path this feature exists to serve. The in-handler wipe.js pattern is therefore not merely stylistic; it is the only existing pattern that admits owner **or** trusted-local.
- **Host `curl localhost:7778` is remote** (verified consequence in ADR `security-auth-exposure/0001`): the peer is the Docker bridge gateway, not loopback. The genuine local-operator path is container loopback — `docker exec tapestry curl http://127.0.0.1:7778/…`. Tests and docs must use that path for the success cases; the host-side path is itself the "unauthenticated remote caller is denied" case.
- **Relationship types are firmware-aliased**, never literals: `firmware.relAlias(canonicalSlug)` (`src/api/normalize/firmware.js:71-80`) maps `CLASS_THREAD_TERMINATION` → `HAS_ELEMENT` etc., throws on unknown input, and transparently accepts an alias passed directly (the `:76` fallback). The full firmware set is 11 types (3 class-thread + 6 core-node wiring + `PROPERTY_MEMBERSHIP` + `PROPERTY_ENUMERATION`).
- **Cypher cannot parameterize a relationship type** — the type is string-interpolated into the query text. The whitelist is therefore also the injection boundary: only the whitelist's own resolved alias may ever be interpolated, never the caller's raw string.
- **`npm test` is a hermetic stack-free gate** (ADR `test-hermeticity-ci/0001`): suites that need the live stack must per-test `SKIP` when it is absent (H-class precedent: `test/deploy-safety-status.test.js`); handler-level gating logic is testable stack-free with mock req/res and pre-require stubs (precedent: `test/strfry-wipe-owner-gate.test.js`); shelling out to `docker exec` from a live test has precedent (`test/customize-pin-curation-publish.test.js`).
- **Neo4j `uuid` indexes are label-scoped** (`NostrEvent`, `NostrEventTag` — verified via `SHOW INDEXES`); a label-free `MATCH (n {uuid: …})` cannot use them.
- Existing surface conventions: flat kebab-case verb-noun POST routes registered in `registerNormalizeRoutes` (`src/api/normalize/index.js:3299-3328`); responses shaped `{ success, … }` / `{ success:false, error }`; Neo4j access via `runCypher`/`writeCypher` from `src/lib/neo4j-driver` (`:146`).

**ADR conflict check:** consistent with `security-auth-exposure/0001` (honest-local; we rely on `req.localTrusted` exactly as defined) and `0002` (default-deny handles the unauthenticated case *before* our handler; our in-handler gate covers the authenticated-non-owner remainder — the layering that ADR explicitly left open as residual (c)). Consistent with `tag-stack-merge-hardening/0001 B3` (same local-trust signal) and `test-hermeticity-ci/0001` (test classing below). ADR 0015's `LEGACY_*` TA-pubkey exception is untouched — this module never references the TA pubkey at all. Nothing is superseded.

## Options considered

### Option A — Dedicated module `src/api/normalize/relationships.js`, two POST routes, in-handler owner gate *(chosen)*

A new, deliberately small file exporting `handleAddRelationship` / `handleDeleteRelationship`, registered as two lines in `registerNormalizeRoutes`. Its entire import surface is `../../lib/neo4j-driver`, `./firmware`, `../../middleware/auth` — no `child_process`, no `nostr-tools`, no `assistantKeys`, no normalize helpers.

**Pros:** the strfry-free contract becomes *structurally auditable* — a test can assert the module's import list and grep its source, which is a far stronger no-strfry guarantee than behavioral spying alone; keeps the primitives out of the 3,300-line composite file; the whitelist, validation, and both handlers live in one reviewable screenful; two-line registration keeps the fixed mount.
**Cons:** one more file on a surface that is otherwise monolithic; the shared `REL`-style alias resolution is duplicated in miniature (module builds its own two-entry whitelist rather than importing `normalize/index.js`'s `REL` object, which is not exported).

### Option B — Extend `src/api/normalize/index.js` in place

Add the two handlers beside their 20 siblings, reusing the module-level `REL` object (`:19-31`).

**Pros:** literally where every sibling lives; zero new files; reuses the existing `REL` constant.
**Cons:** the module already imports `child_process.exec`, `nostr-tools`, and the TA signing keys at the top — an automated "this code path cannot touch strfry" assertion degrades to trusting control flow inside a strfry-heavy module rather than verifying an import boundary; grows a file that is already the largest on the surface; the wipe-test stub pattern (stub `exec` pre-require) becomes useless noise because the module legitimately uses `exec` elsewhere. Rejected: it trades away the cheapest strong form of the story's central negative guarantee.

### Option C — "Safe templates" layer over `POST /api/neo4j/query`

Generalize the existing arbitrary-pair primitive: named, parameterized operation templates (`add-rel`, `delete-rel`) validated inside the already-write-gated `queryPost.js`.

**Pros:** reuses the one endpoint that already does arbitrary node pairs; no new mount decisions; the write gate from ADR `security-auth-exposure/0001` is already there.
**Cons:** the book fixes the mount at `/api/normalize/*`, and `queryPost`'s write gate is `isOwner || localTrusted` for *raw Cypher* — layering a template engine onto it is a bigger abstraction than two endpoints, blurs the "scalpel with no handle" boundary the intake diagnosed (the raw-Cypher escape hatch remains one field away), and produces a response contract shaped by the template layer rather than the surface's `{ success, … }` convention. Rejected: more machinery, weaker fit to the frame.

## Decision

We chose **Option A**. It is the simplest shape that satisfies every acceptance criterion, and it converts the story's hardest guarantee — a *negative* (nothing touches strfry) — into an import-boundary fact that a test can check mechanically.

### The six delegated decisions (book → "Open design decisions delegated to the Director"), resolved

**1. Route naming (mount fixed at `/api/normalize/*`):** `POST /api/normalize/add-relationship` and `POST /api/normalize/delete-relationship`.
*Rationale:* every one of the 20 siblings is a flat kebab-case verb-noun POST (`create-element`, `add-to-set`, `prune-superset-edges`); matching it is the simplest option and keeps logs/self-description consistent. An HTTP-`DELETE`-method variant was considered and rejected: it would be the only non-POST on the surface, and bodies on `DELETE` are awkward in common clients — with no auth benefit, since default-deny is method-based across `POST/PUT/PATCH/DELETE`.

**2. Initial whitelist membership:** the two class-thread membership types only — `HAS_ELEMENT` (`CLASS_THREAD_TERMINATION`) and `IS_A_SUPERSET_OF` (`CLASS_THREAD_PROPAGATION`), constructed via `firmware.relAlias(…)`, never literals.
*Rationale:* simplest-that-satisfies-the-frame — the operator's named need is `HAS_ELEMENT`, and the handoff recommends exactly this starting pair. The other nine firmware types are structural wiring (`IS_THE_CONCEPT_FOR`, `IS_THE_JSON_SCHEMA_FOR`, …) whose 1:1 cardinality invariants firmware install maintains; admitting them through a primitive that deliberately has no cardinality validation invites corrupting a class thread (e.g. a second `IS_THE_CONCEPT_FOR` into one header) with no guard. Extension is a one-line append to `WHITELISTED_CANONICALS` — the designed-for post-book path (net-new custom types like `HAS_SUBGOAL` remain out of scope per the frame).

**3. One route vs two:** two routes, one shared validation helper.
*Rationale:* an `action` discriminator on a single route saves nothing (the handlers share validation via the helper regardless) while adding one more 400 branch and making access logs opaque about which mutation ran. Two routes match the surface convention (decision 1) at identical implementation cost.

**4. Parent-label validation strictness:** **any existing node pair is permitted** — no `Set`/`Superset` label enforcement. Both nodes' labels are echoed in the response for operator visibility, and the node lookup is label-free (`MATCH (n) WHERE n.uuid = $uuid`-style, no label anchor).
*Rationale:* the frame requires existence + whitelist checks, nothing more; the governing premise is that these are scalpel-grade edits to the operator's own reference. Encoding legal label combinations would hardcode structural policy that actually lives in firmware/install — precisely the composite-endpoint disease the intake diagnosed — and `HAS_ELEMENT` legitimately originates from both `Superset` and `Set` nodes today. Echoed labels give the visibility benefit of validation without the policy cost. The label-free match honors "any existing node pair" literally; the perf cost is bounded and accepted (see Consequences).

**5. Response shape + status codes:** all four idempotent outcomes are **HTTP 200** with a `result` discriminator; precondition failures are loud and typed.

| Case | Status | Body (sketch) |
|---|---|---|
| add, edge created | 200 | `{ success:true, operation:'add', result:'created', relType:'HAS_ELEMENT', from:{uuid,labels}, to:{uuid,labels}, note:<hazard> }` |
| add, edge already present | 200 | same, `result:'already-existed'` (no `note`) |
| delete, edge removed | 200 | `{ success:true, operation:'delete', result:'deleted', deletedCount, relType, from, to, note:<hazard> }` |
| delete, edge absent | 200 | same, `result:'not-found'`, `deletedCount:0` (no `note`) |
| `fromUuid`/`toUuid` not in Neo4j | 404 | `{ success:false, error:'Node not found: <uuid>', missing:[…] }` |
| `relType` unknown or not whitelisted | 400 | `{ success:false, error:'relType … is not allowed', allowed:['HAS_ELEMENT','IS_A_SUPERSET_OF'] }` |
| missing/malformed body field | 400 | `{ success:false, error:'Missing required field: …' }` |
| authenticated non-owner | 403 | `{ success:false, error:'Editing relationships requires owner authentication' }` |
| unauthenticated remote | 401 | emitted by default-deny middleware *before* the handler (ADR `security-auth-exposure/0002`) |
| driver failure | 500 | `{ success:false, error }` |

*Rationale:* `already-existed` and `not-found` are *achieved end states*, not failures — a 404 on repeat-delete would make idempotent retry scripts read success as failure, and reserving 404 for "node does not exist" keeps every status unambiguous (404 = precondition, 400 = bad input, 403 = identity, 401 = middleware, 200 = converged). This also keeps the staging deployment probe crisp: an unauthenticated remote POST answering 401 proves the route is deployed, where a missing route would not. Shape follows the surface's `{ success, … }` convention.

**6. Test strategy for a Neo4j-side-effect contract (incl. the no-strfry-write assertion):** one suite, `test/relationship-primitives.test.js`, using the established three-class split (runner registration is the Tester's lane, Phase 3):

- **U-class (stack-free, always gates CI):** inject a stub for `src/lib/neo4j-driver` into `require.cache` *before* requiring `relationships.js` (the pre-require stub pattern from `test/strfry-wipe-owner-gate.test.js`), then drive the exported handlers with mock req/res. Covers: 403 for `{session:{}, localTrusted:false}` **before any Cypher runs** (stub call count 0, both handlers); `localTrusted:true` passes the gate; 400 for unknown and for known-but-unwhitelisted `relType`; 404 discrimination naming the missing uuid; `created`/`already-existed`/`deleted`/`not-found` discrimination from scripted stub results. Also stub `child_process.exec`/`spawn` suite-wide and assert zero calls across every handler invocation.
- **S-class (source assertions, stack-free):** the structural no-strfry guarantee — assert `relationships.js`'s require list contains only `neo4j-driver`, `./firmware`, `middleware/auth`, and contains none of `child_process`, `nostr-tools`, `assistantKeys`, `publishToStrfry`, `signAndFinalize`; assert the whitelist is built from `firmware.relAlias(…)` calls and no whitelisted Neo4j alias appears as a raw string literal; assert both routes are registered in `registerNormalizeRoutes`.
- **H-class (live local stack, per-test `SKIP` when unreachable — the `test/deploy-safety-status.test.js` pattern):** the full functional floor against the local Docker stack. Success-path calls go through **container loopback** — `docker exec tapestry curl -s http://127.0.0.1:7778/…` (docker-exec-from-test precedent: `test/customize-pin-curation-publish.test.js`) — because host→`:7778` is treated remote by design. Fixtures: create two throwaway `:NostrEvent` nodes with test-prefixed uuids via `POST /api/neo4j/query` over the same docker-exec path; tear them down (`DETACH DELETE` filtered to those exact uuids) in a `finally`, leaving the graph as found; firmware and `39998:<TA>:shared-concept` structure are never touched. Matrix: add-new → add-idempotent (count the edge in Neo4j = 1) → delete-existing → delete-missing → nonexistent-node 404 → rejected-relType 400. **Live no-strfry-write assertion:** `GET /api/strfry/scan/count` (public read, `src/api/index.js:263`) before and after the entire sequence — counts must be equal. **Unauthenticated-remote denial:** a plain host-side `fetch('http://localhost:7778/api/normalize/add-relationship', …)` must return 401 (the host path *is* the remote path). The **authenticated-non-owner 403** stays U-class via mock session — the exact precedent set by the wipe gate's own test, since minting a real non-owner session against the live stack buys nothing extra.

*Rationale:* this is the only split consistent with ADR `test-hermeticity-ci/0001` (CI is stack-free; live suites SKIP countedly), and it makes the negative assertion twice over — structurally (import boundary, S-class) and behaviorally (event-count equality, H-class).

## Consequences

- **Enables:** raw-Cypher-free routine curation of membership edges; a template for the planned family of second-brain primitives (the module is the pattern: whitelist over firmware aliases + wipe-style gate + discriminated idempotent results).
- **Owner-gate layering is belt-and-braces by construction:** middleware default-deny (401, unauthenticated) → in-handler `isOwner || localTrusted` (403, authenticated non-owner) → handler logic. The rest of the admin-mutation surface's authenticated-non-owner gap remains a separately-scoped follow-up (intake 2026-07-21) — this story gates only its own two operations.
- **Label-free uuid lookup cannot use the label-scoped uuid indexes** — each call may pay a node scan. Accepted deliberately at operator-tool traffic (single-digit manual invocations) per the house "measure, don't presume" rule; the escape hatch (a global uuid constraint, or a label anchor once decision 4 is revisited) is a follow-up if it ever measures slow.
- **Concurrency caveat (accepted):** under concurrent identical adds, `MERGE` keeps the graph correct (exactly one edge) but the `created` vs `already-existed` report could misattribute. Single-operator tool; not worth a lock.
- **Degenerate parallel edges:** if the graph already holds N>1 same-type edges between the pair (not producible via add), delete removes all N and reports `deletedCount:N` — still "the named type between the named pair, in the named direction," never a sweep.
- **Injection boundary:** only the whitelist's own resolved alias is ever interpolated into Cypher text; caller input never reaches query text. The whitelist doubles as the safety gate.
- **Firmware-install overwrite hazard is DOCUMENTATION-only** (operator decision 2026-07-18; frame-fixed): install pass 1d can re-add a deleted `HAS_ELEMENT` and the manifest-scoped prune can delete an added one (`src/firmware/install.js:594-634`, `:758`, `:764`). This ADR **does not touch install behavior in any way.** The hazard is surfaced where the operator will meet it: a one-line `note` on every graph-*changing* success response (`created`/`deleted`) plus the full explanation in the module's header comment (Implementation notes). Docs-surface placement beyond that is the Implementer's call within this story's AC.
- **New debt / follow-ups:** post-book whitelist extension for core-node wiring types (with cardinality thought) and net-new types (`HAS_SUBGOAL`); the possible uuid-index follow-up above.
- **Firmware reinstall required?** **No.** No concept definitions change — this is API code plus a code-level whitelist over the *existing* firmware alias layer. (`POST /api/firmware/install` is neither needed nor touched.)

## Implementation notes

Test-file changes (the new suite, its `test/test.js` registration) belong to Phase 3 — the Tester's lane — never to implementation.

- **New file: `src/api/normalize/relationships.js`** — the whole feature lives here.
  - Header comment carries the firmware-install hazard explanation (the documentation AC), citing `src/firmware/install.js:594-634`/`:758`/`:764` and the operator decision of 2026-07-18.
  - Imports — exactly: `const { runCypher, writeCypher } = require('../../lib/neo4j-driver');`, `const firmware = require('./firmware');`, `const { isOwner } = require('../../middleware/auth');`. Nothing else (this list is under S-class test).
  - Whitelist:
    ```js
    const WHITELISTED_CANONICALS = ['CLASS_THREAD_TERMINATION', 'CLASS_THREAD_PROPAGATION'];
    // alias (e.g. 'HAS_ELEMENT') -> canonical slug; built once at module load
    const ALLOWED = new Map(WHITELISTED_CANONICALS.map(c => [firmware.relAlias(c), c]));
    ```
  - `function resolveRelType(input)` — `firmware.relAlias(input)` in try/catch (accepts canonical slug *or* alias via the `:76` fallback; throw ⇒ `{ error: 'unknown', … }`); then `ALLOWED.has(alias)` (miss ⇒ `{ error: 'not-whitelisted', allowed: [...ALLOWED.keys()] }`). Only the returned `alias` — a value from `ALLOWED`, never the caller string — may be interpolated into Cypher.
  - `function gateAndValidate(req)` — order matters: (1) wipe.js gate `if (!isOwner(req) && !req.localTrusted)` ⇒ 403; (2) required body fields `fromUuid`, `toUuid`, `relType` (non-empty strings) ⇒ 400; (3) `resolveRelType` ⇒ 400. Returns `{ status, body }` on failure or `{ alias, fromUuid, toUuid }` on success. Shared by both handlers.
  - `async function handleAddRelationship(req, res)` — one `writeCypher`:
    ```cypher
    MATCH (a {uuid: $fromUuid})
    MATCH (b {uuid: $toUuid})
    OPTIONAL MATCH (a)-[e:`<ALIAS>`]->(b)
    WITH a, b, count(e) AS existing
    MERGE (a)-[r:`<ALIAS>`]->(b)
    RETURN existing > 0 AS alreadyExisted, labels(a) AS fromLabels, labels(b) AS toLabels
    ```
    Zero rows ⇒ at least one node missing ⇒ diagnostic `runCypher` (`MATCH (n) WHERE n.uuid IN [$fromUuid, $toUuid] RETURN n.uuid`) to name the missing uuid(s) ⇒ 404. Else 200 with `result` from `alreadyExisted`, per the decision-5 table.
  - `async function handleDeleteRelationship(req, res)` — one `writeCypher`:
    ```cypher
    MATCH (a {uuid: $fromUuid})
    MATCH (b {uuid: $toUuid})
    OPTIONAL MATCH (a)-[r:`<ALIAS>`]->(b)
    DELETE r
    RETURN count(r) AS deletedCount, labels(a) AS fromLabels, labels(b) AS toLabels
    ```
    (`DELETE` of an unmatched/null `r` is a Cypher no-op.) Zero rows ⇒ same diagnostic ⇒ 404. Else 200, `result: deletedCount > 0 ? 'deleted' : 'not-found'`.
  - Direction is `(fromUuid)-[relType]->(toUuid)`, stated in the module doc; `fromUuid === toUuid` (self-loop) is not specially rejected — primitives carry no policy.
  - `module.exports = { handleAddRelationship, handleDeleteRelationship };`
- **`src/api/normalize/index.js`** — in `registerNormalizeRoutes` (`:3299-3328`), add:
  ```js
  const { handleAddRelationship, handleDeleteRelationship } = require('./relationships');
  app.post('/api/normalize/add-relationship', handleAddRelationship);
  app.post('/api/normalize/delete-relationship', handleDeleteRelationship);
  ```
  (Require inline inside the register function, mirroring the firmware-install require at `:3325`, so the module's import surface stays clean for the S-class assertion and `index.js`'s top-of-file imports are untouched.)
- **No changes** to `src/middleware/auth.js`, `src/firmware/install.js`, `src/api/neo4j/*`, or any firmware JSON.
- **Concepts:** none added, none modified; no firmware reinstall.
- Operator usage (belongs in the module header + wherever the Implementer surfaces docs within the story's AC):
  `docker exec tapestry curl -s -X POST http://127.0.0.1:7778/api/normalize/add-relationship -H 'Content-Type: application/json' -d '{"fromUuid":"…","toUuid":"…","relType":"HAS_ELEMENT"}'`

## Out of scope

- Whitelist extension beyond the two membership types (core-node wiring types need a cardinality-safety think; net-new types like `HAS_SUBGOAL` are frame-excluded).
- Any change to firmware install's edge derivation/pruning (documentation-only, operator-fixed).
- Strfry emission, reconciler, publication-intent modeling, UI affordances, the `/elements/add-node` crash, the `publishToStrfry` silent-drop bug (all frame-excluded).
- The authenticated-non-owner gap on the *rest* of the admin-mutation surface (separately scoped, intake 2026-07-21).
- uuid-index/perf optimization for the label-free lookup (follow-up only if measured slow).
