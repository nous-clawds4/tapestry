# Story 8: Community-reference pointer — Nostr Relay stub

**Status:** Approved
**Created:** 2026-05-17
**Type:** Feature

## Background
A firmware concept is a *local* definition authored by this instance's Tapestry Assistant. The community also curates definitions of the same concepts (e.g. "Nostr Relay"). We want firmware to carry a pointer to the community-curated definition so a fresh install can establish a **deferred placeholder link** to it — without importing the full class thread now, and without re-deciding at install time what "the community's definition" is.

Accepted-and-deferred (recorded here, resolved in plan item (1), NOT this story):
- **Flaw A** — a firmware-baked pointer is dev-curated, not Grapevine-selected. Inherent to firmware; to be addressed when firmware itself is community-curated.
- **Registry-as-DList** — the per-concept pointer should eventually be a community-curated DList; hardcoded for now.

Design decided in Discovery: the **minimum a community curator must publish** is the kind 39998 Concept Header (graceful degradation — if nothing else is reachable, we still anchor the concept). Scope is limited to **one concept: `nostr-relay`**.

**Depends on:** Story 9 (Publish/export a concept). The import contract here *consumes* the export contract defined there — export is the producer. The ADR for this story is renumbered **0005** and is finalized only after the export ADR (**0004**) is accepted.

## User-facing description
As a Tapestry operator, when I install firmware, I want my local `nostr-relay` Concept Header linked (as a deferred placeholder) to the community-curated `nostr-relay` Concept Header, so the community's curation can later be materialized without re-deciding what the community's definition is.

## Acceptance criteria
- [ ] Given a firmware concept with a `communityReference` (`headerATag`, `relayHints[]`, optional `knownGoodEventId`), when firmware install runs, then the community Concept Header (kind 39998) is fetched from the relay hints and imported as a Neo4j node whose uuid is its own a-tag (distinct from the local TA header).
- [ ] Given the community Header was imported, when install completes, then a placeholder edge exists from the local `nostr-relay` Concept Header to the community `nostr-relay` Concept Header.
- [ ] Given the community Header cannot be fetched (no relay carries it / timeout), when install runs, then the miss is logged, install continues, and the local firmware concept is created/updated exactly as before (graceful degradation — no install failure).
- [ ] Given `knownGoodEventId` is set, when fetching, then the fetched event's id is verified against it; a mismatch is treated as a miss (graceful + logged).
- [ ] Given firmware install is re-run, when it runs again, then no duplicate community node and no duplicate placeholder edge are created (idempotent).

## Concepts touched
- `39998:<TA-pubkey>:nostr-relay` — local Concept Header for Nostr Relay (gains one outgoing placeholder edge).
- `39998:<curator-pubkey>:nostr-relay` — community Concept Header, newly imported as a distinct foreign node.

## Out of scope
- Fetching/wiring the community Superset, sets, elements, or JSON Schema.
- Element/superset materialization (the placeholder edge *is* the deferral).
- The Concept-Header → Concept-Graph nostr-event-tag protocol change (separate ratifiable ADR under plan item (1); prerequisite for single-event full retrieval, not for this stub).
- Promoting the placeholder to a protocol-correct signed IMPORT relationship event + a first-class firmware IMPORT relationship-type (deferred to (1)).
- The three-tier privacy model.
- Any concept other than `nostr-relay`.

## Open questions
None blocking — resolved in Discovery. Noted: the placeholder edge is Neo4j-only for this stub (a documented deviation from "explicit relationships are nostr events" / Normalization Rule 6), tracked as debt for plan item (1).

## Linked artifacts
- ADR: `engineering-team/decisions/0005-community-reference-nostr-relay-stub.md` (Accepted; depends on ADR 0004)
- Test plan: `engineering-team/stories/8-community-reference-nostr-relay-stub.test-plan.md` (4 sentinels; behavioral AC-1…AC-5 deferred to local/staging smoke — authoritative, Reviewer-required)
- Review: `engineering-team/reviews/8-community-reference-and-export.md` — **PASS (Re-review 2)**; ADR 0005 Rev 2 fixed the M1 materialization defect + IMPORT→REFERENCES{source}; M1 **closed** on local consumer; ships as follow-up feat→staging→main
