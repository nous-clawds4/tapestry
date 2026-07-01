# ADR 0009: Unified taggings — read-time normalization core

**Status:** Accepted
**Date:** 2026-06-30
**Design doc:** `engineering-team/designs/unified-taggings.md` (full model; this ADR ratifies it)
**Driving story:** `engineering-team/stories/event-tagging/9-unified-tag-index-notes-and-profiles.md` (first consumer)
**Also underpins:** Stories 10 (unified search) and 11 (profile tagging-activity spans notes)

## Context

The tag universe is split: profile-taggings (`nostr-user-tag`) and event-taggings (`nostr-event-tag`) are separate stacks sharing only the tag-*element*. Surfaces that should span "all tags" (the `/tags` index, tag search, a profile's tagging activity) are profiles-only, which reads as a bug (a note-only tag never appears on `/tags`). We want ONE tag universe, extensible to future tagging types (article, community, tag-of-tag), under three operator constraints:

1. **No protocol/write change** — read/aggregation only.
2. **The dependency-free proto-SDK inherits the unification** — not app glue.
3. **Opinionated *local* aggregation** — no new published format, no constraint on other publishers (CLAUDE.md invariant #2).

All three resolve to the same architecture: **normalize at read time, in the core.** See the design doc for the full model, registry, tuple, and constraint analysis.

## Options considered

- **A — Read-time normalization core + family registry (chosen).** A pure `taggings` layer in `src/lib/event-tagging` normalizes every member's assertions to one tuple `{tag, target, stance, asserter}`; generic aggregators (index/search/per-tag/per-target) run over the stream; POV-trust/authority/`mine`/dedupe are shared. New unified reads consume it; the wire/write are untouched. Satisfies all three constraints simultaneously.
- **B — Patch each surface to also count notes (tactical).** Rejected: hard-codes two special cases into each endpoint; a third tagging type means a third patch everywhere; no SDK benefit; deepens the divergence.
- **C — Converge the wire shapes (one tagging format for all targets).** Rejected: violates constraint 1 (protocol change) and constraint 3 (would pressure other publishers); and it's impossible to enforce on a permissionless network anyway. Convergence belongs at aggregation, not on the wire.

## Decision

**Option A.** Build a read-time **taggings normalization core** with a **family registry**; unify at aggregation, never on the wire. Ratified calls from the design discussion:

1. **Core home:** grow the existing dependency-free `src/lib/event-tagging` into the taggings normalization layer (one SDK). event-tagging + profile-tagging become **registry members**, not parallel cores.
2. **Canonical tag key = the coordinate `authorPubkey:slug`** (edit-stable), not the tag-element event id. This merges "used on a profile" + "used on a note" into one row (`available-tags` already maps eventId ↔ coordinate).
3. **`mine` in the index:** a tag the viewer used on a note appears even when the POV doesn't count them — same principle as Stories 7–8.
4. **Scope = Phase 1 only, now.** Build the unified core + wire the **new** unified reads (`/tags` counts notes; unified search; profile activity). **Leave the live `/api/profile-tags/*` and `/api/event-tags/*` endpoints untouched.** Migrating their internals onto the normalizer (behavior-preserving, output contracts identical) is a **separate low-risk cleanup, deferred to after this ships** (operator decision, 2026-06-30).

## Consequences

- **Enables** `/tags`, search, and profile tagging-activity to span the whole tag universe, and any future tagging type to join by registering one member (no new stack).
- **SDK-extractable:** a third party lifting the core inherits unified reads.
- **No protocol/write/format change; no live-endpoint change** — strictly additive, so the shipped profile-tagging feature can't break. Some read logic is temporarily duplicated (old per-type endpoints + new normalizer) until the deferred Phase-2 cleanup.
- **Scan cost:** the unified index scans the union of member concept-`z`s over kind-39999 — broader than either alone; bound/paginate like Story 8's cap.
- **Purity guard applies:** the normalizer/registry/aggregators are pure and dependency-free (no `window`/`fetch`/`Date`/literals) — the existing core purity test covers them.
- **Firmware reinstall?** No (no concept change).

## Implementation notes (for Story 9, the first consumer)

- **Core (`src/lib/event-tagging`, new modules):**
  - `normalizeTaggings({ assertions, headers, members, honoredAuthorities }) → Tagging[]` — pure; maps each kind-39999 assertion via its matching member to `{ tag:{authorPubkey,slug}, target:{type,ref}, stance, asserter, eventId, createdAt }`, applying the honored-authority legitimacy gate once.
  - A **registry** of `TaggingFamilyMember = { name, conceptZ(taPubkey), extractTag(assertion, ctx), extractTarget(assertion) }`, seeded with `nostr-user-tag` (target `p`; tag = direct `a`/`e`, per the ADR-0022 hybrid shape) and `nostr-event-tag` (target `e`/`a`; tag via header descriptor — reuse the `classifyEventTaggings` gating).
  - `indexByTag(taggings, { isAsserterTrusted, viewerPubkey }) → rows keyed by authorPubkey:slug` with per-tag counts across target types + `mine`. (Stories 10/11 add `searchTags` and asserter-filtered views over the same stream.)
- **Server:** a new unified read (e.g. `GET /api/tags/index` or `/api/event-tags/index`, name TBD in Story 9) that scans `{kinds:[39999], '#z':[…member conceptZs…]}`, resolves event-tag headers, calls `normalizeTaggings` → `indexByTag`, enriches tag display (name/description) via the shared catalogue, POV-filters, paginates. Existing endpoints unchanged.
- **UI:** `Tags.jsx` consumes the unified read; presentation of profile-vs-note counts is a design detail (Story 9 Open Q1).

## Out of scope

- **Migrating the live profile-tagging / event-tagging endpoints onto the normalizer** — deferred Phase-2 cleanup (post-ship).
- **Any wire/write/format change** — none.
- **Federation of event-tag reads** — unchanged (local-only by ADR 0004).
