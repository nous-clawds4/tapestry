# ADR 0004: Publish/export a concept — Concept-Graph-rooted

**Status:** Accepted (revised 2026-05-18 — see Revision 1)
**Date:** 2026-05-17
**Story:** `engineering-team/stories/9-publish-export-a-concept.md`

## Context
Export is the producer; the Story 8 import contract conforms to whatever this emits. Decided default: **Full, Concept-Graph-rooted, own-authored TA-signed events only, Header always included**.

Mechanism facts (verified):
- The concept's events already exist **signed in local strfry** (TA-signed, addressed `39998/39999:<TA>:<d-tag>`). Export = re-publish an existing event set outward; no serialization/transform except `graphContext` is stripped on share (BIBLE.md:1527).
- Per-event publish to **external** relays is **browser-side**: `publishEverywhere` → local strfry + `PUBLISH_RELAYS` (ui/src/utils/nostrPublish.js:95). `/api/strfry/publish` is local-only; `/api/relay/external` is fetch-only. No server-side external publisher exists.
- Concept enumeration is a Neo4j traversal from the Header via class-thread + core-node wiring; concept-graph API exists (`/api/concept-graph/node/:handle/neighbors`, `/subgraph/:handle`) — src/api/concept-graph/index.js:194.
- Concept Graph node handle: `39999:<TA>:nostr-relay-concept-graph` — the transitive root (imports subsets/elements + property-tree-graph + core-nodes-graph), confirmed live via `/neighbors`.
- Derived edges (HAS_ELEMENT/IS_A_SUPERSET_OF) are implicit — the importer re-derives them; they are not published.

## Options considered

### Option A — Server enumerates the own-authored set; UI loops existing `publishEverywhere` (chosen)
New owner-only endpoint returns the concept's **TA-authored** constituent events (traversal seeded at the Header, including the Concept Graph node and its closure, filtered to `pubkey == TA`). The existing concept-detail UI action loops the existing browser-side `publishEverywhere` over that set.
**Pros:** reuses the exact existing signer/publish path used for all other UGC; no new server-side relay-publish infra; idempotent (replaceable events); own-authored filter enforces the provenance principle for free; matches the decided default exactly.
**Cons:** export driven from an owner browser session (not a headless server job); large concepts → many sequential publishes (needs batching + partial-failure reporting).

### Option B — Server-side concept publisher
Add a server-side external-relay publisher; export runs entirely server-side.
**Pros:** headless; no browser needed. **Cons:** new external-publish infra duplicating the established browser path; diverges from how every other event is published today; larger blast radius for a producer stub. Rejected — not justified yet.

### Option C — Single bundled archive event
Wrap the whole concept in one event. **Cons:** breaks a-tag addressing and the class-thread model; importer can't address sub-nodes. Rejected.

## Decision
**Option A** — smallest design that produces exactly the event set Story 8 consumes, reusing the established publish/signer model, with the provenance filter built in.

## Consequences
- **Enables:** a deterministic "Publish concept" producing the import-side contract; graceful degradation (Header alone is valid); generalizes to any concept.
- **Constrains:** large concepts need batching + per-event/per-relay partial-failure reporting (not transactional). Re-publish = re-broadcast (consistent with existing firmware-header behavior). Full Concept-Graph-rooted *retrieval* on the import side needs the deferred Header→ConceptGraph tag (plan item (1)); **export is unaffected** — importers degrade to the Header floor until then.
- **Follow-ups:** Header→ConceptGraph tag ADR (1); privacy-tiered export; export progress UX.
- **Firmware reinstall required?** **No** — operator action over existing graph/events; no firmware/manifest change. (Contrast ADR 0005/import, which does require reinstall.)

## Implementation notes
- **New endpoint** (owner-guarded, like Settings): `GET /api/concept/:handle/export-set` → resolves `39998:<TA>:<slug>`, Cypher-traverses `IS_THE_CONCEPT_FOR | IS_A_SUPERSET_OF | HAS_ELEMENT | IS_THE_*_FOR` from the Header (incl. the Concept Graph node + closure), `WHERE node.pubkey = <TA pubkey>`, returns the raw signed events (graphContext stripped via the existing share path). New handler under `src/api/concept/` (or extend `src/api/concept-graph/`); reuse traversal helpers in src/api/concept-graph/index.js.
- **UI:** add a "Publish concept" action on the concept detail/actions surface (owner-only) that calls the endpoint then loops the existing `publishEverywhere` (ui/src/utils/nostrPublish.js:95), accumulating per-event `{successes, failures}` for a summary. Batch sequentially.
- **No change** to `nostrPublish.js`, `/api/strfry/publish`, or `PUBLISH_RELAYS` — reuse as-is.

## Out of scope
Privacy-tiered export; Header→ConceptGraph protocol tag; server-side headless export; concepts beyond `nostr-relay` for verification.

---

## Revision 1 (2026-05-18) — restricted DList relay target

**Trigger:** Review of stories #8/#9 (`engineering-team/reviews/8-community-reference-and-export.md`, CHANGES_REQUESTED) + an explicit owner relay-policy decision: concept export must publish **only to `wss://dcosl.brainstorm.world`**, not to the general-purpose `PUBLISH_RELAYS` set (purplepag.es / primal / damus / nos.lol / wot.grapevine.network).

**What changes:**
- The original Decision's "**No change to `nostrPublish.js` — reuse as-is**" and the implicit `publishEverywhere → PUBLISH_RELAYS` target are **superseded**. `publishEverywhere` is parameterized: `publishEverywhere(signedEvent, relays = PUBLISH_RELAYS)`. The default is unchanged, so every existing caller (profile follow/mute/report via `useProfileActions`) is byte-for-byte unaffected. The concept-export action passes `['wss://dcosl.brainstorm.world']`.
- Still ADR-0004 Option A in spirit: the browser primitive is reused (not a new server-side publisher); only its relay target is now an argument. Sentinels: **TE1** stays valid (the concept-export UI still calls `publishEverywhere`); **RE1** stays valid (`publishEverywhere` + `PUBLISH_RELAYS` still exported; no server-side `SimplePool.publish`).

**Rationale:** (a) avoid polluting general-purpose relays with concept/DList events; (b) `wss://dcosl.brainstorm.world` is the purpose-built DList relay — the `dcosl` router preset already mirrors kinds 9998/9999/39998/39999; (c) **export target and import `relayHints` must be the same relay set or the round-trip cannot close** — see ADR 0005 Revision 1. Junk-tolerance on the import side is the real robustness mechanism (owner's explicit framing); the restricted publish target is pollution-minimisation courtesy, not correctness.

**Consequences / follow-ups:** Implementer re-cycle: parameterize `publishEverywhere`; concept-export passes the dcosl set. No re-architecture. Reviewer finding #2 (`install.js:1141` misleading IMPORT log) is folded into the same Implementer pass (it is an Implementer fix, not an ADR change — referenced here only for chain coherence).
