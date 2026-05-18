# Story 9: Publish/export a concept to the community

**Status:** Approved
**Created:** 2026-05-17
**Type:** Feature

## Background
The community-reference import (Story 8) consumes whatever a curator publishes. That import contract cannot be soundly specified until the **export** contract is fixed — export is the producer. Today there is no concept-level publish, only per-event browser-side `publishEverywhere` ([ui/src/utils/nostrPublish.js:95](../../ui/src/utils/nostrPublish.js)). This story defines the owner action that exports a locally-curated concept so other instances can discover and (per Story 8) import it.

Decided in the Architecture step-back:
- **Default = Full, Concept-Graph-rooted:** the 39998 Header + the 39999 Concept Graph node + its transitive closure (superset, sets, elements, schema, primary property, properties-set, property-tree-graph, core-nodes-graph).
- **The 39998 Header is always included as the graceful-degradation floor** — consistent with Story 8's "Header is the minimum an importer needs."
- **Scope = own-authored TA-signed events only.** Imported foreign nodes are NOT re-exported (provenance principle: you never rebroadcast someone else's concept under your identity). This also keeps Story 8's Neo4j-only IMPORT edges from leaking on export — both sides stay consistent for free.
- **Owner-only** action (like Settings).

## User-facing description
As the owner/operator, I want a "Publish concept" action that broadcasts my locally-curated concept to community relays, so other instances can discover and reference my definition.

## Acceptance criteria
- [ ] Given the owner triggers "Publish concept" for `nostr-relay`, when it runs, then every own-authored (TA-signed) constituent event — Header + Concept Graph node + its transitive closure (superset/sets/elements/schema/properties/3 graphs) — is published to the community relays.
- [ ] Given the concept includes nodes imported from other authors, when export runs, then those foreign-authored nodes are NOT published (only TA-authored events).
- [ ] Given `graphContext` is local-only, when an event is exported, then `graphContext` is stripped (portable word-wrapper only).
- [ ] Given export is re-run, when it runs again, then it is idempotent (replaceable events; no divergence).
- [ ] Given some relays fail, when export runs, then per-event/per-relay successes and failures are reported; partial failure does not abort the whole export.
- [ ] Given a non-owner, when they attempt the action, then it is denied (owner-only).

## Concepts touched
- `39998:<TA-pubkey>:nostr-relay` (Header) and its 8 core nodes incl. `39999:<TA-pubkey>:nostr-relay-concept-graph`, plus sets/elements — all TA-authored.

## Out of scope
- Privacy-tiered selective export (deferred — three-tier privacy model).
- The Header → Concept-Graph nostr-event-tag protocol change (plan item (1) / ADR). Without it, an importer can't auto-discover the Concept Graph from a single fetched Header — but **export itself is unaffected**; importers degrade to the Header floor until that lands.
- Export progress/UX polish.
- Any concept beyond `nostr-relay` for end-to-end verification.

## Open questions
None blocking. Note: full Concept-Graph-rooted *retrieval* on the import side depends on the deferred Header→ConceptGraph tag; until then importers degrade to Header-only — acceptable and already the agreed floor.

## Linked artifacts
- ADR: `engineering-team/decisions/0004-publish-export-a-concept.md` (Accepted)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
