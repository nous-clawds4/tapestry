# ADR 0005: Community-reference pointer — Nostr Relay stub

**Status:** Accepted (revised 2026-05-18 — see Revision 1)
**Date:** 2026-05-17
**Story:** `engineering-team/stories/8-community-reference-nostr-relay-stub.md`
**Depends on:** ADR 0004 (export contract)

## Context
Establish a deferred placeholder from the local `nostr-relay` concept to the community-curated one at firmware install. Minimum unit = kind 39998 Header; graceful degradation; `nostr-relay` only. Flaw A and registry-as-DList accepted/deferred.

**Consumes ADR 0004:** a published community concept's Header is a TA-signed `39998:<curator>:nostr-relay` event re-published to `PUBLISH_RELAYS` (purplepag.es, wot.grapevine.network, relay.primal.net, nos.lol, relay.damus.io) with `graphContext` stripped. Therefore `communityReference.relayHints` **defaults to that PUBLISH_RELAYS set**, and the fetch filter `{kinds:[39998],authors:[curatorPk],"#d":["nostr-relay"]}` matches the exported Header exactly. No ADR conflict: 0005 depends on 0004; independent of 0002/0003.

Codebase constraints (verified): firmware install is multi-pass, server-side via internal Express bridge, iterates `manifest.concepts` (src/firmware/install.js); server-side relay fetch `GET /api/relay/external` (src/api/relay/fetchEvents.js); reuse path `POST /api/strfry/publish` then derive via `POST /api/tapestry-key/derive-all/:label` (src/api/tapestry-key/index.js:467); uuids distinct (`39998:<TA>` vs `39998:<curator>`); in-file MERGE pattern at src/firmware/install.js:470; **no IMPORT relationship-type in firmware**, no signed-IMPORT path in `src`.

## Options considered

### Option A — Minimal: imported community Header node + Neo4j-only IMPORT edge, manifest-driven (chosen)
Fetch the community Header via `/api/relay/external`, publish to local strfry (no re-signing — curator's event), let Pass-3 derive it, `MERGE (localHeader)-[:IMPORT]->(communityHeader)`.
**Pros:** smallest blast radius, reuses every primitive, idempotent, reversible, unbundled.
**Cons:** IMPORT edge is Neo4j-only — documented Rule-6 deviation, tracked debt for plan item (1).

### Option B — protocol-correct signed IMPORT event + firmware relationship-type
Rule-6 correct but broad blast radius (firmware reinstall + BIBLE across instances), pre-empts deferred ADR-(1). Rejected for the stub.

### Option C — import Header node, no edge
No linkage ⇒ defeats purpose. Rejected.

## Decision
**Option A** — delivers the stated minimum with the smallest reversible footprint; Rule-6 deviation explicitly tracked for plan item (1).

## Consequences
- **Enables:** firmware-time deferred local→community linkage; foundation for later edge-walking materialization; generalizes via more `communityReference` entries.
- **Constrains:** IMPORT edge Neo4j-only until ADR-(1); foreign curator 39998 nodes live in the graph (distinguishable by pubkey). `relayHints` default = `PUBLISH_RELAYS` per ADR 0004 — if the export relay set changes, update both.
- **Follow-ups (→ plan item (1)/future):** signed IMPORT + firmware rel-type; Header→ConceptGraph tag; superset/element materialization; registry-as-DList; flaw A.
- **Firmware reinstall required?** **Yes** — `manifest.json` gains a field + new sub-pass; effective only on `POST /api/firmware/install`.

## Implementation notes
- **`firmware/active/manifest.json`** (edit versioned `versions/v1.0.0/manifest.json`) — add to the `nostr-relay` entry: `"communityReference": { "headerATag": "39998:<curator-pubkey>:nostr-relay", "relayHints": [<PUBLISH_RELAYS>], "knownGoodEventId": "<optional hex>" }`.
- **`src/firmware/install.js`** — add `async function pass_communityReferences(opts)`, invoked from `install()` after `pass1_bootstrap`, before the Pass-3 derive block. Per concept with `communityReference`: build filter (`ids:[knownGoodEventId]` if set, else `{kinds:[39998],authors:[curatorPk],"#d":[dTag]}`) → `apiGet('/api/relay/external', …)` → no event / id-mismatch ⇒ log miss + `continue` → `apiPost('/api/strfry/publish', { event })` passthrough (no re-sign) → `runCypherApi('MATCH (a {uuid:$from}),(b {uuid:$to}) MERGE (a)-[:IMPORT]->(b)', { from:'39998:'+TA+':'+slug, to:headerATag })`. Per-concept try/catch; never throw.
- No source change to `fetchEvents.js` / `publishEvent.js` / `tapestry-key/index.js`.

## Out of scope
Community Superset/sets/elements/schema retrieval; materialization; Header→ConceptGraph tag; signed IMPORT/firmware rel-type; privacy tiers; concepts beyond `nostr-relay`.

---

## Revision 1 (2026-05-18) — relayHints aligned to the DList relay

**Trigger:** Consequence of ADR 0004 Revision 1 (concept export now publishes **only** to `wss://dcosl.brainstorm.world`). The Context's "`communityReference.relayHints` defaults to that PUBLISH_RELAYS set per ADR 0004" is **superseded**: import must look where export actually publishes, or the round-trip cannot close by construction.

**What changes:**
- Shipped `communityReference.relayHints` becomes **`["wss://dcosl.brainstorm.world"]`** (replacing the 5 popular relays in the implemented manifest — an Implementer re-cycle task).
- Sentinel **TI1** stays valid: it asserts `relayHints` is a non-empty array of `ws(s)://` URLs — a single dcosl URL satisfies it. `headerATag` (`39998:919ba08a…:nostr-relay`) is unchanged.

**Rationale:** export ⇄ import relay-set consistency (ADR 0004 Rev 1 rationale (c)); concept/DList events belong on the purpose-built DList relay (the `dcosl` preset mirrors 39998/39999), not general-purpose relays.

**Consequences:** The export↔import chicken-and-egg closes only once brainstorm.world's TA (`919ba08a…`) has actually run concept export to `wss://dcosl.brainstorm.world` (the stepwise-to-prod plan). Until then, import graceful-degrades — the correct, intended behaviour (ADR 0005 AC-3). Reviewer non-blocking item (AC-4 dormant) is unaffected by this revision.

---

## Revision 2 (2026-05-19) — materialization fix + IMPORT→REFERENCES

**Trigger:** The M1 smoke (owner published the curator `nostr-relay` Header to dcosl; local consumer reinstall) **caught a real defect**: `pass_communityReferences` fetched + published the header to local strfry correctly, but the edge never formed (`community node … not present yet — deferred`). Root cause: the original Implementation-notes assumption *"publish to strfry → Pass-3 derive turns it into a node"* is **wrong**. `src/lib/tapestry-derive.js` `deriveAll`/`deriveByKey` operate on nodes **already in Neo4j** (`MATCH (n {tapestryKey})`, `WHERE n.tapestryKey IS NOT NULL`) — derive computes `tapestryJSON`; it does **not** ingest strfry events into Neo4j. Nothing materialized the foreign header, so the presence check (correctly) deferred forever.

**Materialization fix (supersedes the "derive materializes it" assumption):** `pass_communityReferences` now, immediately after `/api/strfry/publish`, explicitly materializes the fetched event as a Neo4j node via `buildImportCypher(ev)` + `executeCypher(...)` from `src/api/neo4j/eventSync` (the real single-event strfry→Neo4j import primitive; precedent `src/api/io.js`). For kind 39998 this MERGEs `(:NostrEvent:ListHeader {uuid:'39998:<curator>:nostr-relay', …})` + author/tags. The post-derive presence-check + edge MERGE are otherwise unchanged.

**Label change `IMPORT` → `REFERENCES`:** the deferred placeholder edge is renamed. Rationale: `IMPORT` is an already-defined Tapestry primitive (BIBLE §6/glossary: editorial "I agree, implies IS_A_SUPERSET_OF"; also the name of the ingest *step*) — squatting on it conflates the non-committal stub with the committal editorial primitive and forecloses the plan-item-(1) signed-IMPORT future. Owner decision after candid review.

**Accepted-collision mitigation (REQUIRED for any consumer):** `REFERENCES` is **already used** by `src/api/neo4j/eventSync.js` for the high-volume structural `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)` (every `e`/`a` tag). The owner chose `REFERENCES` eyes-open. The collision is **managed, not latent**: (1) endpoints differ — concept-level is `(:ListHeader)-[:REFERENCES]->(:ListHeader)` vs tag-level `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)`; (2) **every concept-level edge this code writes carries `source: 'firmware-community'`**; eventSync's tag edges never set `source`. **Contract for all future consumers/traversals of the concept-level REFERENCES: MUST filter by endpoint node labels AND/OR `r.source IS NOT NULL`.** A bare `MATCH ()-[:REFERENCES]->()` is ambiguous and is a defect.

**Consequences:** M1 now closes on a consumer instance after the curator export exists (curator header is live on dcosl, so the local/staging M1 smoke is **repeatable**). Test sentinel **TI2** updated: asserts the explicit materialization (`buildImportCypher|executeCypher`) and a `[:REFERENCES]` MERGE — the materialization-defect class is now pinned structurally (it previously passed while behaviour was broken). **RI1** generalized to "no first-class editorial relationship-type" (label-agnostic). No change to ADR 0004, the manifest, the export side, or the graceful path. Already shipped to prod via #156/#157 → this revision ships as a **follow-up `feat → staging → main` PR**.
