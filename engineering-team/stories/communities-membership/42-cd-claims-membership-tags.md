# Story 42: A Community Declaration claims its membership tag(s)

**Status:** Definition side DONE + independently reviewed (2026-06-05). The wire format, projection, and §26 inheritance are complete on the relay layer. AC#4 (convener-facing UI in the found/fork flows) is DEFERRED to the Story 45 display batch — the builder already accepts `circle.claims/threshold/cutoff`, so the UI hook is ready; surfacing convener controls now, over an engine that can't compute a live roster until the nostr-user-tag core lands, would be a hollow surface (same call as Story 45's display deferral). Open Q#1 is RESOLVED (Vinney: a kind-39998 concept).
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
Membership is "people carrying the tag(s) this community claims." So a Community Declaration must declare **which label(s)** count, plus a **threshold** and an **influence cutoff**. This is the definition side — no roster yet.

## User-facing description
As a **Convener**, I want to say which trust signal makes someone a member of my circle, so that belonging is defined by a rule, not a list I maintain.

## Acceptance criteria
- [x] The CD carries a `claims` declaration: one or more tag-label references the community consumes as membership.
- [x] The CD carries a membership **threshold** and an **influence cutoff** preset.
- [x] The `claims`/threshold/cutoff resolve through `b`-inheritance (§26) — a fork inherits them unless it overrides.
- [ ] **DEFERRED (Story 45 batch):** Founding + fork flows let the convener set/inherit these (plain-language UI). Builder already accepts the inputs; UI not yet wired (see status note).

## Out of scope
Roster derivation (Story 44). Writing tags (Story 43). The exact label encoding — Open Q#5 in ADR 0030.

## Build notes (2026-06-05)
Four-layer inheritance, all reviewed:
- **Builder** `ui-communities/src/events/declaration.js` — founding materializes defaults (claims own concept, threshold 1, cutoff 0.5) so the root is self-describing; a fork omits unset fields so they inherit live (§26).
- **Projection** `ui-communities/src/events/fetch.js` (`projectDeclaration`) — reports the wire faithfully: absent threshold/cutoff → `null` (not a default), claims → `[]`. Defaulting is NOT done here, so a default never masquerades as a stated value.
- **Resolver** `ui-communities/src/lib/resolveDefinition.js` — `claims`/`membershipThreshold`/`influenceCutoff` added to the folded `DEFINITION_FIELDS`; empty-array/`null` inherit, `0` is a real (overriding) value.
- **Consumer** `deriveRoster` coalesces `null → default` (single source of truth).
- Tests: `test/cd-claims-field.test.js` (11/11). Independent review: **PASS, no blocking issues.**

## Linked artifacts
ADR 0030; Open Q#1 RESOLVED (kind-39998 concept); Q#5 encoding still open (does not block this layer).
