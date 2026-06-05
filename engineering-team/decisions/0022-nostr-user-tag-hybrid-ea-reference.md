# ADR 0022: nostr-user-tag parent reference — hybrid `e` + `a`

**Status:** Accepted — partially supersedes ADR-0001 (wire-shape / parent-reference section only)
**Date:** 2026-06-05
**Story:** none (wire-shape decision surfaced by the Communities cross-team dependency; tracked in `engineering-team/follow-ups.md` → "Revisit nostr-user-tag wire shape: `e` vs `a`")

## Context

ADR-0001 shipped the `nostr-user-tag` assertion (kind 39999) referencing its parent **tag-element** with a single `['e', tagEventId]` — a frozen, content-addressed event id. The tag-element is itself a kind-39999 **parameterized-replaceable** event, addressable by the NIP-01 coordinate `39999:<tagAuthorPubkey>:<slug>`.

Two forces make the single-`e` reference worth revisiting now, before assertion volume grows:

1. **Communities consumes nostr-user-tag as a membership atom** — "who carries tag X." That is a *consume-by-stable-identity* pattern: it wants "all assertions of tag X across its whole life," which is a clean `#a` scan but, under `e`, requires enumerating *every historical event-id* of X (the set splits every time the tag author edits the replaceable tag-element). This is the actual blocking dependency for Communities v1 membership.
2. **nostr-user-tag is a trust/membership signal**, so the *mutability* of the parent matters. With pure `a`, the tag author can edit the tag-element's content (rename "early-supporter" → something else) and every existing assertion silently re-points to the new meaning. With `e`, the applied version is frozen.

**Relevant facts (verified in code 2026-06-05):**
- Current publisher: `ui/src/utils/publishProfileTag.js:43-67` — emits `['e', tag.eventId]`, no `a`. `tag` arg carries `{eventId, slug}` but **not** the tag-element author pubkey needed to build the `a` coord.
- The assertion's own `d`-tag is `profile-tag-<slug>-<target8>-<asserter8>` — **slug-keyed (identity-based)**. So the assertion already identifies *itself* addressably, while pointing at its *parent* by frozen id — an internal inconsistency.
- The **pin** events already use hybrid `e`+`a` (`ui/src/utils/publishTagPin.js:119-120`). Precedent exists in the same stack.
- Nostr relays index **all single-character tags**. Both `e` and `a` are single-char → both are server-side filterable. Carrying both costs ~1 extra tag (~50 bytes) and *zero* query penalty; consumers pick `#a` (grouping/identity) or `#e` (provenance) at will.
- `a` does not worsen slug collisions: the coord `39999:<author>:<slug>` already commits to a specific author, same as `e`.
- The firmware schema `firmware/versions/v1.0.0/concepts/nostr-user-tag/json-schema.json` currently requires `tagEventId` (mirrors `e`) and declares no address field.

## Options considered

### Option A — keep `e` only (status quo)
Frozen event-id reference.
- **Pros:** smallest; perfect provenance; matches the pre-Story-1 relay-tag precedent.
- **Cons:** "all assertions of tag X" splits across every historical event-id on each tag edit; orphaned by per-version kind-5 delete; doesn't express the tag as a stable identity — the exact thing Communities needs. Internally inconsistent with the slug-keyed `d`-tag.

### Option B — switch to `a` only
Addressable coordinate `39999:<tagAuthor>:<slug>`.
- **Pros:** clean stable-identity grouping (`#a`); NIP-01-conventional for replaceables; survives edits and per-version deletes.
- **Cons:** **loses provenance** — silently follows the tag author's later edits. For a *membership/trust* signal that is a real footgun (definition mutates under existing assertions). Also a breaking wire change.

### Option C — hybrid `e` + `a`
Carry both: `a` for stable identity, `e` for the applied version.
- **Pros:** stable-identity grouping (`#a`) *and* provenance (`#e`); lets read endpoints choose granularity; enables drift detection (compare live `a`-content vs frozen `e`-content); consistent with the slug-keyed `d`-tag and with the pin events; both tags relay-indexed so no query cost; **additive** (see Consequences) so it doesn't break existing assertions.
- **Cons:** ~1 extra tag per event; write code populates two refs; read code must pick which ref is authoritative per purpose.

## Decision

**Option C — hybrid `e` + `a`.** The assertion references its parent tag-element with **both** an `a` coordinate (stable identity) and an `e` event-id (applied-version provenance):

```jsonc
{
  "kind": 39999,
  "tags": [
    ["d", "profile-tag-<slug>-<target8>-<asserter8>"],
    ["p", "<targetPubkey>"],
    ["a", "39999:<tagAuthorPubkey>:<slug>"],   // NEW — stable tag identity (consume by #a)
    ["e", "<tagEventId>"],                      // retained — version-at-apply-time (provenance)
    ["z", "39998:<TA>:nostr-user-tag"],
    ["polarity", "1"]
  ]
}
```

**Consumer guidance (Communities and any other reader): group/scan by `#a`; treat `e` as provenance, not identity.** Everything else in ADR-0001 (the `z`/`p`/`polarity` semantics, the slug-keyed `d`-tag, polarity bucketing) stands unchanged. This ADR supersedes *only* ADR-0001's parent-reference choice.

## Consequences

**Enables:**
- Communities' "who carries tag X" as a single `#a` subscription that survives tag edits — unblocks v1 membership without enumerating historical event-ids.
- Drift detection for trust contexts: a consumer can compare the live `a`-resolved tag-element against the frozen `e` version to see if the tag's meaning changed since application.

**Backward compatibility — additive, does not break existing assertions:**
- Old assertions carry `e` only; new ones carry `e`+`a`. Adding `a` breaks nothing already published.
- Read paths that scan `#e` (as today) match old and new events identically — **no read breakage**.
- A consumer that scans `#a` (Communities) will not see `e`-only legacy events. Resolve either by (a) unioning `#a` + known legacy `#e` ids during a transition, or (b) a one-pass **backfill**: re-emit each legacy assertion with `a` added and the *same* `d`-tag — because the assertion is a slug-keyed parameterized-replaceable, this cleanly *replaces* the old event (no dupes, no orphans). Backfill volume is small and instance-local (feature is ~weeks old; per OPERATIONS.md each instance's strfry is self-contained, so there is no single large global set).

**Constrains / debt:**
- Write code now needs the tag-element **author pubkey** at publish time to build the coord (it currently only has `{eventId, slug}`).
- Two references to keep consistent; read code must document which is authoritative per query.

**Firmware reinstall required?** **Yes.** The `nostr-user-tag` json-schema gains an optional `tagAddress` field. Run `POST /api/firmware/install` after the change (per CLAUDE.md house rule).

## Implementation notes

- **`ui/src/utils/publishProfileTag.js`** — extend the `tag` arg to `{eventId, slug, authorPubkey}`; add `['a', \`39999:${tag.authorPubkey}:${tag.slug}\`]` to the `tags` array (place it before `e`); add `tagAddress` to the `content` JSON mirror (`{ nostrUserTag: { taggedPubkey, tagEventId, tagAddress } }`). Keep the `e` tag. The `z`-tag literal (`LEGACY_Z_TAG_PUBKEY` per ADR-0015) is unchanged.
- **Callers** (`ui/src/hooks/useProfileTags.js`, Tag page apply/dispute, `ui/src/components/TagPageRow.jsx` etc.) — thread the tag-element's author pubkey (the `.pubkey` of the kind-39999 tag-element event, already available where `availableTags` are fetched) into the `tag` object.
- **Firmware `firmware/versions/v1.0.0/concepts/nostr-user-tag/json-schema.json`** — add an **optional** `tagAddress` property (string, the `39999:<author>:<slug>` coord) alongside the existing `tagEventId`. Keep `tagEventId` **required** so legacy `e`-only events still validate. Reinstall firmware.
- **Read/score `src/api/profile-tags/index.js`** — current `#e`-based scans keep working; no forced change. Where stable-identity grouping is wanted (and for the consumer-facing endpoints Communities will hit), add support to scan/group by `#a` (`aggregateProfilesTagged` and friends), preferring `a` and falling back to `e` for legacy events during the transition.
- **(Optional, separate) backfill script** — enumerate existing `nostr-user-tag` assertions per instance, re-emit each with `a` added + same `d`-tag. Not required to land the hybrid; do it when `#a`-completeness over historical assertions is needed.

## Out of scope
- Changing the assertion's **own** `d`-tag (stays slug-keyed — already addressable).
- Executing the backfill (separate, cheap, optional — gated on when `#a`-completeness over legacy data is needed).
- Extending the firmware schema engine to source fields from event-tags (still out, per ADR-0001).
- Any community-specific coupling on the tag — the tag stays general, person-scoped, community-agnostic (Communities *claims* tags; the tag never points at a community).
