# ADR 0010: Pull community-curated class thread (z-tag recursive walk)

**Status:** Accepted (mechanism superseded by ADR 0011)
**Date:** 2026-05-19
**Story:** `engineering-team/stories/14-community-class-thread-pull.md`
**Builds on:** ADR 0005 Rev 2 (`buildImportCypher`/`executeCypher` materialization), ADR 0007 (`concept-graph` tag), ADR 0008 (`IS_A_SUPERSET_OF` cross-curator anchor)
**Superseded (in part) by:** ADR 0011 §"Decision". The owner-only endpoint surface (`POST /api/concept/:handle/pull-community-class-thread`), `requireOwner` gating, honest invariants (no editorial relationships, no election, local concept untouched), trust posture, termination guards (visited-set + max-fetch + max-depth), and consequence framing all REMAIN IN FORCE. Only the **walk mechanism** (z-tag recursive walk → replaced by `#n`/`#s` tag walk with back-compat z-walk for one cycle) and the **Set vs element classification rule** (was `#a` tags; corrected by ADR 0011 to z-tag `:set` membership) are superseded. ADR 0011 was added after Implementer-phase grounding found the original z-tag walk filter shape and classification rule incompatible with Tapestry's actual published encoding.

**ADR 0011 numbering note:** this ADR was originally numbered 0009 in commit `e0d568b2`; renumbered to 0010 to yield slot 0009 to the parallel graperank-shared-csv-coordination ADR (which was committed independently on `fix/graperank-shared-csv-race`). Story #14, the test plan, and the test sentinels all reference this ADR as 0010.

## Context
Story #11 / ADR 0008 wired the `(localSup:Superset)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` anchor as a structural placeholder, explicitly deferring bulk element/set import as "its own future stream with its own ADR." This is that ADR.

**Goal:** materialize the curator's full class-thread vocabulary (Sets + elements + the canonical edges between them) into the local Neo4j as a foreign sub-graph, reachable from the local concept *only* via the existing #11 `IS_A_SUPERSET_OF` anchor. **On-demand owner action**, not install-time auto-pull.

**Grounding finding** (Architect Discovery, this cycle): the kind-39999 `<dtag>-concept-graph` event (introduced in ADR 0007) is **sparse** — for `nostr-relay` it contains 2 nodes (header + superset) and 1 relationship (`IS_THE_CONCEPT_FOR`). It captures structural identity, not full enumeration of class-thread members. Therefore the "concept-graph as manifest" mechanism is unavailable as a single source of truth.

**Available primitive in the codebase:** `install.js` Pass-1d walks z-tags to wire the local owner's own `IS_A_SUPERSET_OF` / `HAS_ELEMENT` edges. The same primitive — pointed at relay-fetched curator events instead of locally-published owner events — gives us the class-thread closure with byte-identical wiring semantics.

## Options considered

### Option A — Z-tag recursive walk (chosen)
Implement a breadth-first walk over kind-39999 events `#z`-tagged at the current uuid, starting at the materialized community Superset from #11, against the concept's `communityReference.relayHints`. Per event: publish to local strfry (no re-sign), materialize via `executeCypher(buildImportCypher(ev))`, classify as Set vs leaf element, apply `:Set` label on Sets (via existing `MATCH (n) SET n:Set` precedent), MERGE canonical class-thread edges between foreign nodes, enqueue Sets for further walking. Visited-set + max-depth guard + total-fetch budget.

**Pros:** mirrors `install.js` Pass-1d wiring exactly → existing Neo4j queries / normalization passes that already understand class-thread shape work on the foreign sub-graph without modification (same reasoning as ADR 0008's "canonical class-thread propagation relationship"); robust against missing concept-graph manifests; per-member graceful posture mirrors #11.
**Cons:** more relay round-trips than a manifest-driven approach would need; depends on curators publishing well-formed z-tags on all class-thread members (acceptable — that's the protocol contract).

### Option B — Concept-Graph-as-manifest (rejected)
Read the curator's kind-39999 `<dtag>-concept-graph` event published per ADR 0007. Decode its `graph.{nodes, relationships}` payload. Enumerate every member a-tag. Fetch + materialize + wire.

**Why rejected:** the grounding pass empirically found that the local concept-graph node for `nostr-relay` contains only 2 nodes (header + superset) and 1 relationship (`IS_THE_CONCEPT_FOR`) — i.e. it captures structural identity, not class-thread enumeration. Treating it as a manifest would systematically under-fetch. A future ADR can upgrade concept-graph fidelity; once that lands, Option B becomes viable and the hybrid (Option C) becomes attractive.

### Option C — Hybrid (rejected for now, named as the upgrade path)
Use concept-graph as a fast index *when present and fidelity-complete*; fall back to z-tag walk for any nodes the index doesn't enumerate.

**Why rejected for now:** today the index is sparse, so the "fallback" is doing 100% of the work — the index path adds complexity without benefit. **Reactivation criterion:** when (a) the concept-graph node has a documented fidelity contract guaranteeing enumeration completeness, and (b) tooling exists to verify that contract per-curator, then Option C becomes valuable as a performance optimization. Tracked as a separate future stream.

### Sub-option — auto-pull at firmware install (rejected)
Run the walk automatically inside `pass_communityReferences` immediately after the #11 `IS_A_SUPERSET_OF` MERGE.

**Why rejected:** (a) increases install time + storage non-deterministically (depends on how big the curator's vocabulary is); (b) removes owner consent for materializing a foreign curator's content; (c) the #11 placeholder + on-demand pull is exactly the deliberate "structural bookmark first, content second" pattern the original theory called for. Owner-on-demand is the right semantic. (Auto-pull is its own future trade-off — separate ADR if ever pursued.)

## Decision
**Option A.** Owner-only endpoint `POST /api/concept/:handle/pull-community-class-thread`, gated by `requireOwner` (same NIP-07 middleware used by Story #9's export endpoint). Returns a summary `{ supersetUuid, fetched, materialized, edgesMerged, skipped, errors[], truncated, depth }`.

**Edge direction = byte-equivalent to `install.js` Pass-1d.** The Implementer MUST ground the exact pass-1d wiring (which direction Sets point in `IS_A_SUPERSET_OF`, which side of `HAS_ELEMENT` is parent vs child) and replicate it byte-for-byte. A foreign-node sub-graph queried with `MATCH p=(communitySup)-[:IS_A_SUPERSET_OF*0..]-(:Superset|:Set)-[:HAS_ELEMENT]->(:NostrEvent)` (in whichever direction pass-1d uses) returns the curator's full class-thread shape, isomorphic to how the local owner's would look.

**Label SET on Sets** uses the existing precedent at `src/api/normalize/index.js:2937` (`MATCH (n {uuid:$u}) SET n:Set`). Elements stay `:ListItem` (the kindToLabel-derived label is correct for leaves). The Superset itself was already labelled by #11; this story does not re-label it.

**Set vs element classification rule.** For each fetched kind-39999 event:
- If the event has `#a` tags referencing another kind-39999 (a parent Set/Superset) → it is a Set (structural).
- If the event has no `#a` tags referencing kind-39999 → it is a leaf element.

The Implementer MUST verify this rule against `install.js` Pass-1d's own classification logic during grounding and either confirm byte-identical semantics or kick back to Architect with the discrepancy.

**Canonical class-thread edges between foreign nodes** are MERGEd with **no `source` property** (mirrors ADR 0008's `IS_A_SUPERSET_OF` posture — these are canonical class-thread relationships, *not* Neo4j-only stubs):
- `(parentSet:Set|Superset)-[:HAS_ELEMENT]->(element:NostrEvent)` for element membership.
- `(child:Set)-[:IS_A_SUPERSET_OF]->(parent:Set|Superset)` (direction subject to pass-1d grounding — placeholder spec; Implementer locks it to byte-equivalence).

**Per-member graceful posture.** Mirrors #11: try/catch around relay fetch, publish, materialization, the `:Set` label SET, and each canonical edge MERGE — each independently. Errors logged + skipped + counted in the response `errors[]`; the walk continues. Never throws to the HTTP handler.

**Termination guarantees.**
1. **Visited-set on uuid** — once a uuid is enqueued/processed, skip it on re-encounter. Prevents cycles in pathological data.
2. **Max-depth guard** — default `16`, configurable via env `BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH`.
3. **Per-event timeout** — reuse the existing `/api/relay/external` call sites' timeout (already used by `install.js`).
4. **Total fetch budget** — soft cap on `fetched` count (default `2000`, configurable via `BRAINSTORM_COMMUNITY_PULL_MAX_FETCH`). Beyond the cap the endpoint returns `truncated:true`.

**Idempotency** is guaranteed by (a) deterministic curator a-tags (the curator publishes with stable d-tags), (b) Neo4j `MERGE` on nodes by `uuid` and edges by full pattern, (c) visited-set during the walk. Re-running the endpoint on a settled sub-graph produces zero new nodes/edges.

**Pass-1d Superset-edge pruning replication.** The Implementer MUST replicate `install.js` Pass-1d's "prune redundant Superset edges" step within the foreign sub-graph (for class-thread shape correctness — the foreign sub-graph should look exactly like the curator's local Neo4j would). Reviewer audits.

**Honest invariants (binding, Reviewer audits):**
- **No editorial relationships.** Zero `RECOMMENDED_BY` / `ENDORSES` / `DEPENDS_ON` / curator-marker edges. Reviewer audit MUST grep the diff for any non-`HAS_ELEMENT` / non-`IS_A_SUPERSET_OF` edge creation and reject if found.
- **No election.** Zero new `(:Set|:Superset {locally-owned})-[:HAS_ELEMENT]->(:NostrEvent {curator-pubkey})` edges. The Reviewer audit MUST verify all MERGEd edges have both endpoints in the foreign sub-graph (both pubkeys = curator).
- **Local concept untouched.** Local owner's own `HAS_ELEMENT` count + own `IS_A_SUPERSET_OF` edges count = pre-pull values. Cycle-local smoke S7 enforces.

**UI surface.** `ui/src/pages/concepts/ConceptDetail.jsx` gets one button next to the existing "Publish concept to community" (Story #9):
- **"Pull community class thread"** — disabled if no `communityReference` on the concept manifest, or if the #11 anchor is absent. Enabled otherwise.
- On click: `POST /api/concept/:handle/pull-community-class-thread`. Show inline progress / counts. On success, surface the summary `{ fetched, materialized, edgesMerged, skipped }`. On error, surface the error list.
- No new component file; inline into ConceptDetail.

## Consequences

### Positive
- Story #11's structural anchor finally has functional content behind it; class-thread queries can traverse the curator's full vocabulary.
- Mirrors `install.js` Pass-1d wiring exactly → existing Neo4j queries / traversals / normalization passes work on the foreign sub-graph without modification.
- Owner-on-demand semantics keep install fast + deterministic + consent-respecting.
- Per-member graceful + visited-set + max-depth + fetch budget = robust against partial relay availability, cyclic data, oversized vocabularies.

### Negative / risk
- **Foreign sub-graph storage cost.** Mitigation: total-fetch budget (default 2000) + owner-on-demand consent.
- **Foreign-Set label correctness depends on z-tag classification rule matching pass-1d.** Mitigation: ADR mandates Implementer ground pass-1d byte-for-byte; cycle-local smoke verifies via `labels(n)` Cypher.
- **Rule-5 audit interaction (per ADR 0008 §5 / BIBLE §10).** Foreign Supersets/Sets have z-tags referencing the *curator's* concept-header pubkey, not the local owner's. Server-side: no programmatic Rule-5 audit exists (#11 review found audit lives in `tapestry-cli`, separate repo). Server-side is therefore benign, same as #11. Cycle-local smoke surfaces.

### Neutral
- Endpoint is owner-only and on-demand — zero impact on instances that never call it.
- Install stays Phase A. No changes to `install.js`, `pass_communityReferences`, the #11 anchor, the `concept-graph` tag, the `REFERENCES` edge, or any existing endpoint.

## Blast radius
| File | Change | Lines |
|---|---|---|
| `src/api/concept/pullClassThread.js` | **new** — handler | ~120–180 |
| `src/api/index.js` | +1 line registering the endpoint | +1 |
| `ui/src/pages/concepts/ConceptDetail.jsx` | +1 button + inline progress | ~30–50 |
| `BIBLE.md` §22 | "Phase B implemented" paragraph + Deferred list update | ~15 |
| `test/community-class-thread-pull.test.js` | **new** — T1–T5 + R1 sentinels | ~80–120 |
| `engineering-team/stories/14-community-class-thread-pull.test-plan.md` | **new** | — |
| `engineering-team/reviews/14-community-class-thread-pull.md` | **new** | — |

## Implementation notes

### File layout
- New: `src/api/concept/pullClassThread.js` (mirrors `src/api/concept/exportSet.js` shape — handler exported as `handlePullCommunityClassThread`).
- Registered in `src/api/index.js`:
  ```js
  app.post('/api/concept/:handle/pull-community-class-thread',
    requireOwner,
    handlePullCommunityClassThread);
  ```
  (precedent: line 491 for `/api/concept/:handle/export-set`.)

### Algorithm (pseudocode — Implementer locks direction against pass-1d)

```
function handlePullCommunityClassThread(req, res):
  handle = req.params.handle
  cr = lookupCommunityReferenceForHandle(handle)  // from manifest
  if !cr: return 400 "no communityReference for handle"

  curatorPk = parseATag(cr.headerATag).pubkey
  supersetUuid = `39999:${curatorPk}:${handle}-superset`

  // Verify #11 anchor exists
  if !await runCypher(`MATCH (n:Superset {uuid:$u}) RETURN n`, {u:supersetUuid}):
    return 400 "Phase A anchor missing — run firmware install first"

  visited = new Set([supersetUuid])
  queue = [supersetUuid]
  stats = { fetched:0, materialized:0, edgesMerged:0, skipped:0, errors:[] }
  maxDepth = parseInt(env.BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH, 10) || 16
  maxFetch = parseInt(env.BRAINSTORM_COMMUNITY_PULL_MAX_FETCH, 10) || 2000
  depth = 0

  while queue.length && depth < maxDepth:
    nextQueue = []
    for parentUuid of queue:
      try:
        events = await fetchExternal({kinds:[39999], '#z':[parentUuid]}, cr.relayHints)
      catch e:
        stats.errors.push({step:'fetch', parent:parentUuid, message:e.message})
        continue

      for ev of events:
        if stats.fetched >= maxFetch: break  // budget
        stats.fetched++
        memberUuid = `39999:${ev.pubkey}:${dTagFrom(ev.tags)}`
        if visited.has(memberUuid): continue
        visited.add(memberUuid)

        // Publish + materialize (per-event graceful)
        try:
          await postStrfryPublish(ev)
          await executeCypher(buildImportCypher(ev))
          stats.materialized++
        catch e:
          stats.errors.push({step:'materialize', uuid:memberUuid, message:e.message})
          continue

        // Classify
        isSet = hasOutgoingATagToKind39999(ev.tags)
        try:
          if isSet:
            await runCypher(`MATCH (n {uuid:$u}) SET n:Set`, {u:memberUuid})
            // MERGE IS_A_SUPERSET_OF in pass-1d direction (LOCKED by Implementer)
            await runCypher(
              `MATCH (c:Set {uuid:$c}),(p {uuid:$p})
               WHERE p:Set OR p:Superset
               MERGE (c)-[:IS_A_SUPERSET_OF]->(p)`,
              {c:memberUuid, p:parentUuid})
            stats.edgesMerged++
            nextQueue.push(memberUuid)
          else:
            // Leaf element
            await runCypher(
              `MATCH (p {uuid:$p}),(e {uuid:$e})
               WHERE p:Set OR p:Superset
               MERGE (p)-[:HAS_ELEMENT]->(e)`,
              {p:parentUuid, e:memberUuid})
            stats.edgesMerged++
        catch e:
          stats.errors.push({step:'edge', uuid:memberUuid, message:e.message})
          continue
    queue = nextQueue
    depth++

  // Replicate install.js Pass-1d "prune redundant Superset edges" within foreign sub-graph
  await prunePassesOnForeignSubgraph(curatorPk)

  truncated = stats.fetched >= maxFetch
  return 200 {supersetUuid, ...stats, truncated, depth}
```

(The exact direction of `IS_A_SUPERSET_OF` above is a **placeholder** — the Implementer MUST diff against `install.js` Pass-1d and lock it to byte-equivalence before submitting for review.)

### BIBLE §22 update
Append: "**Phase B (Story #14 / ADR 0010, mechanism amended by ADR 0011):** owner-on-demand class-thread closure pull via `POST /api/concept/:handle/pull-community-class-thread`. `#n`/`#s` tag walk from the #11 community Superset anchor (with back-compat z-tag walk during the dual-emit cycle per ADR 0011); foreign Sets get explicit `:Set` label; canonical `HAS_ELEMENT` / `IS_A_SUPERSET_OF` edges MERGEd between foreign nodes (no `source` property). No editorial relationships, no election into local class thread. Idempotent + per-member graceful + visited-set + max-depth + total-fetch budget."

Update the Deferred list: remove "element/set bulk import"; add "editorial relationship types (separate ADR)", "election surface (separate ADR)", "concept-graph fidelity upgrade (separate ADR)".

### Tester sentinels (structural — Tester phase will sharpen)
- **T1** — Endpoint registered (`grep` in `src/api/index.js` for the literal `/api/concept/:handle/pull-community-class-thread`).
- **T2** — Handler walks z-tags (`grep` in `pullClassThread.js` for literal `'#z'` and `kinds:[39999]`).
- **T3** — Handler classifies Set vs element and `SET n:Set` for Sets (`grep` for `SET n:Set` and the classification predicate).
- **T4** — Handler MERGEs canonical edges with NO `source` property (`grep` for `MERGE` lines, assert no `source:` token in any MERGE for `HAS_ELEMENT` / `IS_A_SUPERSET_OF`).
- **T5** — Visited-set + max-depth guard present (`grep` for `visited` and `maxDepth` symbols).
- **R1** — Regression guard: existing #11 `REFERENCES{source:'firmware-community'}` MERGE in `install.js` unchanged.

### Cycle-local smoke (authoritative)
- **S1** — Pre-check: confirm #11 anchor exists locally for `nostr-relay` (if not, owner runs firmware install).
- **S2** — Pre-check: confirm curator has class-thread members on `wss://dcosl.brainstorm.world`. If not, surface + STOP (feature-blocking upstream of #14).
- **S3** — POST `/api/concept/nostr-relay/pull-community-class-thread` (owner-authenticated). Expect 200 with non-zero `materialized` + `edgesMerged`.
- **S4** — `MATCH (s:Superset {uuid:'<communitySuperset>'})-[:HAS_ELEMENT*0..1]->(e) RETURN count(*)` > 0 (direct element membership materialized).
- **S5** — Recursive traversal through foreign sub-Sets to leaves returns > 0 (direction subject to pass-1d lock).
- **S6** — `MATCH (n:Set) WHERE n.uuid STARTS WITH '39999:<curatorPk>:' RETURN count(n)` > 0 (foreign Sets have `:Set` label).
- **S7** — Honest invariant: local concept's own HAS_ELEMENT count + own IS_A_SUPERSET_OF count = pre-pull values (snapshot before, re-check after).
- **S8** — Idempotency: re-run S3; counts S4/S5/S6 unchanged.
- **S9** — Reviewer audit: `MATCH ()-[r]->() WHERE type(r) NOT IN ['HAS_ELEMENT','IS_A_SUPERSET_OF','REFERENCES','...known existing types...'] AND startNode(r).uuid STARTS WITH '39999:<curatorPk>:' RETURN type(r), count(*)` → expect zero non-class-thread edges from foreign nodes.
- **S10** — Rule-5 audit (per ADR 0008 §5): document benign on server (no programmatic enforcement); same posture as #11.

## Surfaced findings (deliberately handed to future streams — not absorbed here)
1. **Concept Graph fidelity gap.** The kind-39999 `<dtag>-concept-graph` event published per ADR 0007 captures structural identity (2 nodes, 1 relationship for `nostr-relay`) rather than full class-thread enumeration. This is the basis for *rejecting* Option B. Fixing it is its own future stream — design questions include the fidelity contract (enumerate-leaves vs enumerate-all-nodes vs enumerate-all-edges), curator-side tooling, backward compatibility.
2. **Auto-pull-at-install.** Explicitly rejected here. If ever pursued, separate ADR with explicit trade-off discussion.
3. **Election surface.** How the owner promotes individual community elements into their own concept's HAS_ELEMENT class thread — trust, provenance, dedup, UI affordance. Deliberately deferred.
4. **Editorial relationship types.** Separate ADR — `RECOMMENDED_BY` / `ENDORSES` / `DEPENDS_ON` / curator-marker edges. Trust + provenance + first-class-vs-stub semantics to be designed deliberately.

## Out of scope
Editorial relationship types; election; install-time auto-pull; concept-graph fidelity upgrade; hybrid (Option C) mechanism; changes to #10 / #11 / REFERENCES / `communityReference` field / export.
