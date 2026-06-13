# Story 2: nostr-user-tag writer emits hybrid e+a parent reference

**Epic:** tag-stack-merge-hardening
**Status:** Approved
**Created:** 2026-06-12
**Type:** Feature

## Background

ADR-0022 (Accepted) mandates that a `nostr-user-tag` assertion reference its
parent tag-element with **both** an `a` coordinate (stable identity,
`39999:<tagAuthorPubkey>:<slug>`) and the existing `e` event-id
(applied-version provenance). The writer (`ui/src/utils/publishProfileTag.js:56`)
still emits `e` only. Because the ADR ships in this PR, every assertion
published from now grows the un-backfillable `e`-only legacy set the ADR
exists to stop — so the writer is a pre-merge blocker. The fix makes new
assertions *born hybrid*; it does not migrate existing ones (additive, no
read breakage).

## User-facing description

As a **consumer of nostr-user-tag assertions** (Communities membership, and
our own future stable-identity reads), I want every newly-published assertion
to carry the tag's stable `a` coordinate alongside the frozen `e` reference,
so that "all assertions of tag X" is a single coordinate scan that survives
tag edits — without breaking any read path that scans `e` today.

## Acceptance criteria

- [ ] **AC-1 (hybrid wire shape):** Given a user applies or disputes a tag,
  when the assertion event is published, then its tags include both
  `['a', '39999:<tagAuthorPubkey>:<slug>']` and the existing
  `['e', <tagEventId>]`, with all other tags (`d`, `p`, `z`, `polarity`)
  unchanged.
- [ ] **AC-2 (content mirror):** Given the same assertion, when its content
  JSON is read, then the `nostrUserTag` object carries `tagAddress` (the `a`
  coordinate) alongside the existing `taggedPubkey` and `tagEventId`.
- [ ] **AC-3 (author resolved at apply time):** Given a tag is applied from
  any surface that can apply/dispute (profile chip popover, tag page), when
  the assertion is built, then the `a` coordinate uses the actual author
  pubkey of the referenced tag-element — not a placeholder, and not the
  asserter's own pubkey.
- [ ] **AC-4 (legacy reads unbroken):** Given existing `e`-only assertions and
  new hybrid ones, when a reader scans by `#e` as today, then it matches both
  old and new assertions identically (no behavior change to current read
  paths).
- [ ] **AC-5 (schema accepts both):** Given the firmware `nostr-user-tag`
  schema, when an `e`-only legacy assertion and a hybrid assertion are each
  validated, then both pass — the new `tagAddress` field is optional and
  `tagEventId` remains required.
- [ ] **AC-6 (firmware reinstall noted):** The change is accompanied by the
  firmware reinstall step (`POST /api/firmware/install`) so the updated schema
  is registered; this is called out in the change as a required deploy step.

## Concepts touched

- `nostr-user-tag` (`39998:<TA>:nostr-user-tag`, legacy-pinned per ADR-0015) —
  its assertion wire shape and json-schema. The `z`-tag literal stays pinned
  to `LEGACY_Z_TAG_PUBKEY` (ADR-0015) — unchanged.
- `tag` (`39998:<TA>:tag`) — the tag-element whose author pubkey + slug form
  the new `a` coordinate.
- **Firmware reinstall required** (schema gains optional `tagAddress`).

## Out of scope

- **#a read/group support on our own endpoints** (`aggregateProfilesTagged`
  etc.) — our reads keep scanning `#e`. Deferred until our own consumers need
  stable-identity grouping. (PO decision 2026-06-12.)
- **Lazy client self-re-emit** of pre-change assertions — the existing
  `e`-only legacy set is not migrated; new assertions are born hybrid
  regardless. File as a follow-up. (PO decision 2026-06-12.)
- Any change to `z`/`p`/`polarity` semantics, the slug-keyed `d`-tag, or
  polarity bucketing (ADR-0001, unchanged).
- The pin events (already hybrid e+a).

## Open questions

1. For the Architect: the tag-element author pubkey must be threaded from
   where `availableTags` are fetched (the kind-39999 tag-element's `.pubkey`)
   into the `tag` object every apply/dispute caller passes. ADR-0022's
   implementation notes name the call sites; confirm each one has the author
   pubkey available, and decide the failure behavior if it's somehow missing
   (e.g. refuse to publish vs. fall back to `e`-only — lean: refuse, so we
   never publish a malformed `a`).
2. For the Architect: ADR-0022 predates the epic-folder convention and lives
   at the flat path (and a duplicate under `decisions/profile/`). Reconcile/
   locate it for this epic during Architecture; confirm it doesn't contradict
   ADR-0015's legacy-pubkey pinning (it shouldn't — `a` uses the *tag author*,
   not the TA).

## Linked artifacts

- ADR: `engineering-team/decisions/tag-stack-merge-hardening/0002-nostr-user-tag-hybrid-ea-writer.md`
  (Story-2 implementation decisions) — under governing ADR-0022
  (`engineering-team/decisions/0022-nostr-user-tag-hybrid-ea-reference.md`, Accepted).
- Test plan: (after Test Design)
- Review: (after Review)
