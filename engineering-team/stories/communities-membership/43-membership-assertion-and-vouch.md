# Story 43: Assert membership (self-tag) and vouch for others

**Status:** Writer DONE + independently reviewed (2026-06-05). The pure builders (`events/assertion.js`) + publish-readiness are complete; signing/sending reuse `events/publish.js` (NIP-07). The vouch / "I'm in" UI actions are DEFERRED to the Story 45 display batch (you vouch from the People tab — buttons over an empty roster would be a hollow surface, same call as 42's AC4). Unblocked by spec: the carve is read-only, so the writer is ours.
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
Belonging is asserted via the existing `nostr-user-tag` primitive (Vinney's). A person self-tags with a claimed label ("I'm in") or vouches for someone else (tags them, +1); disputes are −1. Communities consumes the primitive unchanged.

## User-facing description
As a **Newcomer/Belonger**, I want to say I belong and vouch for people I trust, so that membership grows through trust.

## Acceptance criteria
- [x] A signed-in user can publish a **self-tag** carrying a label the circle claims (applicant signal) — `buildMembershipAssertion({target: self, polarity: +1})`.
- [x] A signed-in user can **vouch** for another (a +1 tag with the claimed label) and **dispute** (−1) — same builder, target=other, polarity ±1.
- [x] These use the shared `nostr-user-tag` event — no community-specific tag shape (test T7: no `claims`, no `brainstorm-community`).
- [ ] **DEFERRED (Story 45 batch):** Copy is peer/trust framed (no "approve/admit"); vouch reads as consequential — this is UI copy; the builder carries none. Ships with the People-tab vouch/self-tag actions.

## Build notes (2026-06-05)
- `ui-communities/src/events/assertion.js` — pure builders `buildTagElement` (the claimed label) + `buildMembershipAssertion` (the apply/dispute), returning unsigned kind-39999 events; `events/publish.js#publishEvent` signs (NIP-07) + sends — no new crypto. Exports the canonical read-side consts (`LEGACY_Z_TAG_PUBKEY`/`TAG_Z_TAG`/`NOSTR_USER_TAG_Z_TAG`) + `tagElementCoord`.
- **Born hybrid:** every assertion emits `a` (+`e`) from day one → zero backfill at the server's `#a` cutover.
- Writer↔reader polarity agree exactly (only explicit negative is a dispute); d-tag `profile-tag-<slug>-<target8>-<asserter8>` is deterministic, so a re-vouch REPLACES (replaceable-39999 keyed on author+d).
- Tests `test/membership-assertion.test.js` (10/10). Independent review: **PASS, no blocking issues** — added direct source-const tests for the ADR-0015 LEG pubkey (the eval harness was shadowing it).

## Out of scope
Roster computation (Story 44). Cold-start (Story 46). UI actions/copy (Story 45 batch).

## Linked artifacts
ADR 0030; `docs/COMMUNITIES_TAG_CORE_INTEGRATION_HANDOFF.md` (wire shape). Live publish wiring lands with the Story 45 display batch.
