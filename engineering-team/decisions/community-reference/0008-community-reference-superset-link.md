# ADR 0008: Community-reference Superset link (materialization placeholder)

**Status:** Accepted
**Date:** 2026-05-19
**Story:** `engineering-team/stories/11-community-reference-superset-link.md`
**Relates to:** ADR 0005 (+Rev 1, Rev 2), ADR 0006, ADR 0007

## Context
The `REFERENCES` edge from ADR 0005 is inert; #10 unblocked Phase A by giving deterministic concept-graph resolution. Story #11's intent (verbatim from the originating discussion): establish the **structural placeholder** — `localSuperset-[:IS_A_SUPERSET_OF]->communitySuperset` — so the community's structure is reachable by class-thread traversal **without bulk-copying** the curator's elements/sets (explicitly deferred).

Grounded facts:
- Community Superset a-tag is **deterministically derivable**: `39999:<curator-pubkey>:<slug>-superset` (firmware `${slug}-superset` convention, `src/api/normalize/index.js:338`). Same pragmatism as #10.
- `pass_communityReferences` already materializes the foreign Header via `buildImportCypher`/`executeCypher` and MERGEs `REFERENCES` post-derive — the symmetrical pattern applies.
- `IS_A_SUPERSET_OF` is the **canonical class-thread propagation relationship** (firmware rel-type, derived consumers exist), unlike the Neo4j-only stub `REFERENCES`. Reachability "just works" if the materialized community Superset carries the `:Superset` label.
- `buildImportCypher` labels by kind: 39999 → `:ListItem` (`src/api/neo4j/eventSync.js` `kindToLabel`). So the foreign community Superset arrives `:NostrEvent:ListItem` — the `:Superset` label must be **explicitly SET** for class-thread queries (`(:Superset)-[:IS_A_SUPERSET_OF]->…`) to include it.

## Options considered

### Option A — Deterministic compute + SET :Superset + post-derive MERGE (chosen)
In `pass_communityReferences`, after the existing Header materialization, compute `communitySupersetUuid = 39999:${curatorPk}:${dTag}-superset`; fetch via `/api/relay/external`; `apiPost('/api/strfry/publish', { event })`; `executeCypher(buildImportCypher(ev))`; **then `SET n:Superset` on that node** (one-line Cypher). Extend the `pending` link record so the existing post-derive block also MERGEs `(localSup:NostrEvent {uuid:$from})-[:IS_A_SUPERSET_OF]->(communitySup:NostrEvent {uuid:$to})` with the same presence-check + graceful-log pattern Rev 2 established. **No `source` property** on this edge — it's the canonical relationship, not the Neo4j-only stub. Provenance is implicit in the target node's a-tag.
**Pros:** smallest change, mirrors the proven Rev-2 materialize-pre-derive / MERGE-post-derive shape; deterministic + idempotent; graceful (missing community Superset → log + skip; the existing REFERENCES edge is unaffected); reuses the same primitives.
**Cons:** non-conforming curators (Superset published under a different d-tag than `<slug>-superset`) graceful-skip — acceptable for Phase A.

### Option B — Concept-graph-mediated resolution (deferred enhancement)
Use #10's `concept-graph` tag-else-compute to fetch the foreign Concept Graph node, parse its members, identify the superset. Heavier (extra fetch + parse + tolerance for foreign Concept-Graph formats); covers non-conforming curators. Rejected for Phase A; recorded as its own future enhancement if non-conforming curators materially appear.

### Option C — MERGE the edge without materializing the foreign Superset node
Skip fetch/materialize; just `MERGE (b:NostrEvent {uuid:$to})` (creates a stub node by uuid). Defeats the reachability purpose — a stub without the `:Superset` label and without the foreign event's tags is not a useful target for class-thread queries. Rejected.

## Decision
**Option A.** Deterministic compute; fetch + publish + materialize via the proven primitives; **explicitly SET `:Superset` on the materialized foreign node**; MERGE the canonical `IS_A_SUPERSET_OF` edge post-derive; graceful + idempotent.

## Consequences
- Reachability is real: `(localSup:Superset)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` participates in class-thread traversals (concept-graph summaries' `IS_A_SUPERSET_OF*` patterns will include it).
- **Honest invariant preserved:** community element/set nodes still aren't local; traversal reaches `communitySup` but its `HAS_ELEMENT` children don't exist locally until the deferred bulk/on-demand pull. The `IS_A_SUPERSET_OF` edge is the bookmark.
- **Normalization interactions (the Story-#11 open questions, settled here):**
  1. *Prune-superset-edges pass* (`install.js` Pass-1e, Pass 2) — looks for *alternate paths* between local Superset and the same target; our new cross-curator edge has no alternate path (the community Superset is freshly imported with only our edge incoming) → **non-firing, safe by construction**. Documented; cycle-local smoke confirms.
  2. *Rule 5* ("Superset nodes MUST reference the canonical superset concept") — the foreign Superset's z-tag references the curator's superset concept (`39998:<curatorPk>:superset`), not ours. **Resolution: let the cycle-local smoke surface whatever the audit does**; if it flags, the in-line fix is a Rule-5 exemption keyed on the incoming-edge source / pubkey-not-equal-to-local-TA. Do **not** preemptively engineer it.
- **Firmware reinstall required?** Yes — `pass_communityReferences` extended; the `IS_A_SUPERSET_OF` edge materializes only on install.
- **BIBLE update:** §22 "Community-Reference Model" — note the Superset link is now wired (Phase A); update "Deferred" line to "element/set *bulk* import" (the Superset link itself is no longer deferred).
- **Blast radius:** `src/firmware/install.js` `pass_communityReferences` (+ post-derive block) + BIBLE §22. No new files; no manifest change; no UI change; no scope creep.

## Implementation notes
- **`src/firmware/install.js` `pass_communityReferences`** — after the existing `await executeCypher(buildImportCypher(ev))` for the Header, add:
  - compute `communitySupersetUuid = \`39999:${curatorPk}:${dTag}-superset\``;
  - build `/api/relay/external` filter `{kinds:[39999],authors:[curatorPk],"#d":[\`${dTag}-superset\`]}`; `apiGet`; missing event ⇒ log + continue (no edge);
  - `apiPost('/api/strfry/publish', { event })`;
  - `await executeCypher(buildImportCypher(ev))`;
  - **`runCypherApi('MATCH (n:NostrEvent {uuid:$uuid}) SET n:Superset', { uuid: communitySupersetUuid })`** — the critical labeling step.
  - extend `pending` with `{ slug, supersetFrom: \`39999:${taPubkey}:${dTag}-superset\`, supersetTo: communitySupersetUuid }`.
- **Post-derive block (`install.js` ~`:1141`)**: alongside the existing REFERENCES MERGE, add (with presence-check + graceful try/catch identical to Rev 2's pattern):
  `MATCH (a:NostrEvent {uuid:$from}),(b:NostrEvent {uuid:$to}) MERGE (a)-[:IS_A_SUPERSET_OF]->(b)` — no `source` property; this is the canonical class-thread propagation relationship.
- **`BIBLE.md` §22** — one line under the model: "Phase A of element/superset materialization (story #11): the community Superset is materialized and linked via the canonical `(localSup)-[:IS_A_SUPERSET_OF]->(communitySup)`; community element/set *data* pull remains deferred." Update the "Deferred" list to replace "element/superset materialization" with "element/set bulk import".
- **Tester:** structural sentinel that `pass_communityReferences` (a) fetches the `-superset` variant via `/api/relay/external`, (b) emits the `SET n:Superset` Cypher, (c) post-derive MERGEs `[:IS_A_SUPERSET_OF]` between the deterministic local and community Superset a-tags. Behavioral proof — cycle-local smoke: after firmware install, query confirms the foreign Superset exists as `:NostrEvent:ListItem:Superset` and the edge `(:Superset)-[:IS_A_SUPERSET_OF]->(:Superset)` matches between `39999:<localTA>:nostr-relay-superset` and `39999:<curator>:nostr-relay-superset`; idempotency on reinstall; graceful skip when the foreign Superset isn't on dcosl; check whether Rule-5 audit flags the foreign Superset (and decide inline if it does).

## Out of scope
Bulk element/set import (Option B / "full importation" — future stream, own ADR with trust/provenance/dedup designed); on-demand expansion API; any consumer/query that surfaces community elements; changes to #10 / REFERENCES / `communityReference` field / export. Non-conforming-curator Concept-Graph-mediated resolution (deferred Option-B-resolution-path).
