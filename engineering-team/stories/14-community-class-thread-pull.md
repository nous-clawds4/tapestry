# Story 14: Pull community-curated class thread (on-demand owner action)

**Status:** Approved
**Created:** 2026-05-19
**Type:** Feature

## Background

Stream #6 of the ADR 0006 deferred roadmap — the "next stream" that Story #11 (`IS_A_SUPERSET_OF` placeholder) explicitly named: **bulk element/set import**. Now unblocked by the materialized cross-curator `(localSup:Superset)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` anchor (#11 Phase A), which is live + verified on local and shipped to staging/prod for #11.

> *"The element/set bulk import (Option B / 'full importation') — the curator's elements + sets as local nodes; its own future stream with its own ADR (trust/provenance/dedup designed deliberately)."* — Story #11 "Out of scope"

**Grounding finding** (this story's discovery phase): the Concept Graph node (kind-39999 `<dtag>-concept-graph`) is **NOT a full class-thread manifest** — for `nostr-relay` it contains only 2 nodes (header + superset) and 1 relationship (`IS_THE_CONCEPT_FOR`). It is **sparse by design** (it captures the concept's structural identity, not the enumeration of its members). Therefore the "read the Concept Graph as a manifest" mechanism is unavailable; this story uses a **z-tag recursive walk** instead (the same primitive `install.js` Pass-1d uses locally for the owner's own events).

**Honest invariant baked into this story** (binding on implementer): only **class-thread** relationships are wired (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`). **No editorial relationships** are pulled in, **no election** of community elements into the local concept's class thread (the curator's elements DO NOT become the local owner's elements; they remain foreign nodes reachable only by curator-rooted traversal through the #11 IS_A_SUPERSET_OF anchor). The local concept's own class thread is byte-unchanged.

## User-facing description

As the instance owner, after a community concept is linked via the #11 placeholder, I click **"Pull community class thread"** on the concept's detail page. The system fetches the curator's full class-thread vocabulary (sets + elements) into my Neo4j as foreign nodes with the canonical class-thread edges between them. From then on, my class-thread queries can traverse from my local concept into the curator's full vocabulary via the existing #11 link — without my own concept's elements being modified or my own class thread being touched.

This is an **on-demand owner action**, not an install-time auto-pull. The owner is explicitly opting in to materializing the curator's vocabulary; install stays Phase A (REFERENCES + IS_A_SUPERSET_OF placeholder only).

## Acceptance criteria

- [ ] **AC-1 (endpoint surface):** New owner-only endpoint `POST /api/concept/:handle/pull-community-class-thread` exists, gated by `requireOwner` (NIP-07-authenticated, owner pubkey only) — mirrors Story #9's `/api/concept/:handle/export-set` pattern.
- [ ] **AC-2 (start anchor):** Starting node is the materialized community Superset from #11, looked up by uuid (`39999:<curatorPk>:<dtag>-superset` — deterministic per ADR 0008 Phase A). If the #11 anchor is absent (i.e. firmware install never ran, or `communityReference` is unset for this handle), endpoint returns 4xx with a clear message; nothing materialized.
- [ ] **AC-3 (mechanism — z-tag recursive walk):** Perform a breadth-first walk over kind-39999 events `#z`-tagged at the current uuid against the concept's `communityReference.relayHints`. For each fetched event: (a) publish to local strfry via `/api/strfry/publish` (no re-sign); (b) materialize via `executeCypher(buildImportCypher(ev))`; (c) classify as Set (has `#a` tags referencing a parent Superset/Set, or its own a-tags do) vs leaf element; (d) `SET n:Set` on Sets via the existing `MATCH (n {uuid:$u}) SET n:Set` precedent (`src/api/normalize/index.js:2937`); elements stay `:ListItem`; (e) enqueue Sets for further walking.
- [ ] **AC-4 (canonical class-thread edges, no `source` property):** Between foreign nodes, MERGE the canonical class-thread relationships matching `install.js` Pass-1d direction exactly: `(parent)-[:HAS_ELEMENT]->(element)` and the appropriate `IS_A_SUPERSET_OF` direction for set-subset hierarchy. No `source` property — these are canonical class-thread relationships (same posture as #11's `IS_A_SUPERSET_OF`, *not* the Neo4j-only stub posture of `REFERENCES`).
- [ ] **AC-5 (per-member graceful, idempotent, terminating):** Per-event try/catch around relay fetch, publish, materialization, and each edge MERGE — errors logged + skipped, never thrown. Deterministic a-tags + MERGE ⇒ re-running the endpoint produces zero duplicate nodes/edges. Visited-set on uuid prevents revisiting; max-depth guard prevents pathological walks (ADR 0010 specifies bound).
- [ ] **AC-6 (honest invariants — binding):**
  - **No editorial relationship types** wired (e.g. no `RECOMMENDED_BY`, no `ENDORSES`, no curator-marker edges) — strictly class-thread.
  - **No election:** zero new edges are added that cross from the local concept's class thread into the foreign sub-graph except the existing #11 `(localSup)-[:IS_A_SUPERSET_OF]->(communitySup)`. The local concept's own `HAS_ELEMENT` set and own internal `IS_A_SUPERSET_OF` hierarchy are byte-unchanged.
  - **Class-thread only:** foreign elements/sets are reachable from the local concept *only* by traversing through the #11 placeholder edge.
- [ ] **AC-7 (zero collateral):** No behavior change for anything not querying through the new foreign nodes/edges. Install stays Phase A. Existing tests stay green.

## Concepts touched

- **Existing (unchanged):** local `ListHeader`, local `Superset`, local `Set` hierarchy, local elements, the #11 `(localSup)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` anchor, the #11 `(localHeader)-[:REFERENCES {source:'firmware-community'}]->(communityHeader)` stub.
- **New foreign nodes (materialized on first pull, idempotent on re-pull):**
  - Foreign Sets — `39999:<curatorPk>:<various>` with labels `:NostrEvent:ListItem:Set` (kindToLabel gives `:ListItem`; explicit `SET n:Set` adds the class-thread label).
  - Foreign elements — `39999:<curatorPk>:<various>` with labels `:NostrEvent:ListItem` (no `:Set`; these are leaves).
- **New canonical edges between foreign nodes:** `HAS_ELEMENT` (Set→element), `IS_A_SUPERSET_OF` (set-subset, direction matching install.js Pass-1d).

## Out of scope (deferred under ADR 0006 or this ADR 0010)

- **Editorial relationship types** — e.g. `RECOMMENDED_BY`, `ENDORSES`, `DEPENDS_ON`, curator-attribution markers. Its own future stream with its own ADR.
- **Election of community elements into local class thread** — making the curator's elements appear as if they were the local owner's own (i.e. adding `(localSet)-[:HAS_ELEMENT]->(communityElement)` or merging the two element pools). This is a deliberate next-stream design question (trust, provenance, dedup, user-curation surface).
- **kind-1 (note) traversal or WoT-ranking of foreign elements** — out of scope (search-engine territory, not class-thread).
- **Install-time auto-pull** — this story is explicitly **on-demand owner action**. Install stays Phase A (REFERENCES + IS_A_SUPERSET_OF placeholder only). Auto-pull-at-install is its own future trade-off (storage, install time, owner consent).
- **Concept Graph fidelity upgrade** — the grounding finding that the kind-39999 `concept-graph` event is sparse (2 nodes / 1 relationship for `nostr-relay`) is a separate finding worth its own future stream/ADR. Today it is the basis for *rejecting* the manifest-driven mechanism in favor of z-tag walk; fixing it is not in scope here.
- **Hybrid mechanism** (concept-graph-as-index + z-tag walk as fallback) — deferred. Becomes useful once concept-graph fidelity is upgraded; this story commits to pure z-tag walk for now.
- **Changes to #10 (`concept-graph` tag), the `REFERENCES` edge, the `communityReference` manifest field, `publishEverywhere`/export, the #11 IS_A_SUPERSET_OF placeholder.**

## Open questions (resolved in Architecture / ADR 0010)

- **Mechanism selection (z-tag walk vs concept-graph manifest vs hybrid)** — resolved by grounding (Concept Graph is sparse, not a manifest). Z-tag walk chosen. ADR records the rejected alternatives + their reactivation criteria.
- **Edge direction for `IS_A_SUPERSET_OF` and `HAS_ELEMENT`** — must be byte-equivalent to `install.js` Pass-1d. ADR specifies the exact pass-1d wiring as the source of truth.
- **`:Set` label SET** — uses existing precedent at `src/api/normalize/index.js:2937` (`MATCH (n) SET n:Set`). ADR confirms.
- **Classification of Set vs element from an event** — ADR 0010 specifies the disambiguation rule (a-tags / z-tags inspection).
- **Termination & cycle protection** — visited-set on uuid + max-depth guard. ADR 0010 specifies the bound (initial recommendation: max-depth = 16, configurable).
- **Per-event graceful posture** — mirrors #11 per-edge graceful (try/catch around each materialization and each edge MERGE). ADR confirms.
- **UI surface** — button on `ConceptDetail.jsx` next to "Publish concept to community". Progress / count surfaced inline. ADR confirms.
- **Concept-Graph-fidelity surfaced as separate stream** — ADR 0010 includes a "Surfaced findings" section that explicitly hands this finding off to a future ADR rather than absorbing it.

## Linked artifacts

- ADR: `engineering-team/decisions/0010-community-class-thread-pull.md` (Accepted; mechanism superseded by ADR 0011 — Implementer-phase grounding found the original z-tag walk filter shape and Set/element classification rule incompatible with Tapestry's actual published encoding)
- ADR amendment: `engineering-team/decisions/0011-class-thread-tags-and-phase-b-mechanism.md` (Accepted) — establishes single-char `n` and `s` tags (child-claims-parent) for HAS_ELEMENT/IS_A_SUPERSET_OF; amends Phase B to walk these tags; specifies dual-emit migration cycle + trust constraints + reserved-future direction convention
- Test plan: `engineering-team/stories/14-community-class-thread-pull.test-plan.md` (re-baseline pending — sentinels written against ADR 0010's z-tag-walk mechanism; Tester re-baseline for ADR 0011's `n`/`s`-tag-walk mechanism is the next phase)
- Review: `engineering-team/reviews/14-community-class-thread-pull.md` (Review phase)
