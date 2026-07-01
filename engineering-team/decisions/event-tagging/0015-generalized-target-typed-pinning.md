# ADR 0015: Generalized (target-typed) tag pinning — registry projection + kind-30003 note lists

**Status:** Accepted
**Date:** 2026-07-01
**Story:** `engineering-team/stories/event-tagging/12-generalized-tag-pinning.md`
**Builds on:** ADR 0009 (unified taggings normalization + registry), the profile pin/TL/export stack (kind-39999 pin → TA-signed kind-30392 TL → user-signed kind-30000 export).

## Context

Pinning a tag = a point-in-time snapshot of its curated members into a portable NIP-51 list. Today it's **profile-only**: it produces lists of *pubkeys* (`p` elements) — the TA-signed kind-30392 Trusted List (server cron) and the user-signed kind-30000 follow-set export. With the unified taggings model, a tag can also be applied to **notes**, and a note-tag's snapshot should be a **bookmark set of notes** (kind-30003, `e` elements).

Code map (2026-07-01) established:
- **Registry** (`src/lib/event-tagging/taggings.js`) — `taggingMembers` already classify each target as `{type:'profile'|'event'|'address'}`, but carry **no NIP-51 projection metadata**. This is the extension point.
- **List builder already generic** — `buildAndPublishTL()` (`src/api/trustedList/index.js:134–150`) already dispatches `p` vs `e` elements. The profile-only hardcoding lives *upstream*: `['p', pk]` mappings in `publishTagPin.js:410`, `refreshPinnedTags.js:189`, `handlePrepareNip51Export` (`trustedList/index.js:410`), the empty-guard (`publishTagPin.js:257`), and the export-status diff (`profile-tags/index.js:1609`).
- **`for-tag`** (`handleForTag`) already returns POV-curated notes with `applications`/`disputes`/`mine` — the note-pin membership source.
- **kind-30003** (bookmark set) is unused; it's the right NIP-51 kind for a note list.

## Decision (operator, 2026-07-01)

**1. Generalize via the registry (multi-projection), not a parallel pin stack.**
Add per-member NIP-51 projection metadata to `taggingMembers`:
```
{ name, conceptZ(), extractTag(), extractTarget(),
  nip51ListKind,     // profiles → 30000 ; notes → 30003
  nip51ElementTag,   // profiles → 'p'   ; notes → 'e'
  curationMethods }  // the curation options valid for this member (see #3)
```
Pinning a tag then materializes **one list per target type the tag actually has** — profiles → kind-30000 (unchanged) and notes → kind-30003 (new) — driven by the registry. A future tagging type gets pinning by registering its projection; no third pin stack.

**2. Export-time target-type selection.**
The curation/export options expose **which target types to include** — *profiles*, *notes*, or *both* (checkboxes; default both). So the user can emit just a follow-pack (profiles), just a bookmark list (notes), or both from a single pin. Only selected-and-present types are materialized.

**3. Two note-curation options (user-selectable).**
For note-tags, curation is one of:
- `notes:net-endorsed` — notes with `applications > disputes` at pin time, recency-ordered (the Notes-tab curated default; mirrors the profile pin's endorsements>disputes cutoff). **Default.**
- `notes:most-applied` — notes ranked by application count (most-backed first), regardless of net.
Profile curation is unchanged (`nip85:rank` + cutoff).

**4. Export-only depth for v1 (user-signed kind-30003 only).**
A note-pin publishes the **user-signed kind-30003** bookmark set directly from `for-tag`'s curated note set at pin time — a snapshot "authored under my key." **No** TA-signed kind-30392 note-TL, **no** server cron/refresh/retraction for notes in v1. Profile pinning (including its kind-30392 TL) is **untouched**.
> **Deferred → GitHub issue #336:** the TA-signed kind-30392-analog note-TL (continuously refreshed, WoT-readable) is the important fast-follow. v1 ships the visible capability without the server refresh machinery.

## Implementation sketch

**Core (`taggings.js`):** add `nip51ListKind` / `nip51ElementTag` / `curationMethods` to each member. Export a small helper `projectionFor(targetType)` so callers don't re-encode the p/e·30000/30003 mapping.

**Membership (client, v1 export-only):**
- Profiles → unchanged (reads kind-30392 TL via `prepare-nip51-export`).
- Notes → compute the curated set client-side from `/api/event-tags/for-tag` (curated = the chosen note-curation method applied to the returned notes), map to `{ tag:'e', value:id, author? }` items, and publish kind-30003 via the existing `buildAndPublishTL`-shaped element builder (it already handles `e`).

**Pin write (`publishTagPin.js`):** `pinTag` records the generalized curation config (target-type selection + per-type method). `publishNip51ExportForPin` becomes target-type-aware: for each selected+present type, build its list from that type's membership + `projectionFor(type)`; drop the hardcoded `['p', pk]` and the `p`-only empty-guard. `defaultCurationMethod` returns both a profile method and a note method (default `notes:net-endorsed`).

**Status tracking (`profile-tags/index.js`):** generalize `enrichRowsWithNip51ExportStatus`'s `p`-only diff to dispatch on the export event's kind (`p` for 30000, `e` for 30003). The existing dual-status pattern (`nip51ExportStatus` + `followPackStatus`) is the precedent for tracking multiple list kinds per pin.

**UI:** the pin affordance / curation dialog gains the target-type checkboxes and the note-curation choice. The tag-detail **Pinned** tab reflects whichever list(s) the pin materialized (a note list shows its notes). Lands in the unified-UI pass (not a partial ship).

## Consequences

- One pin, N registry-driven projections; profile pinning is backward-compatible (same kinds, same curation, same TL).
- Notes get a shareable bookmark set now; the TA-signed note-TL parity is a tracked fast-follow (#336).
- The registry is now the single source of truth for "how does target type X project into a NIP-51 list," so a future target type (e.g. addressable events) is a registration, not a new stack.
- v1 note membership is computed client-side from `for-tag` (bounded by `NOTES_CAP`); the deferred TA-TL will move it server-side and lift that bound.

## Open (Test Design / PO)

- Exact d-tag scheme for the kind-30003 export (mirror `tl-pin-…` / the profile export d-tag, target-type-qualified so a profiles-export and a notes-export of the same tag don't collide).
- Behavior when a selected target type has **zero** curated members (skip that list vs publish empty) — follow the profile empty-guard's "never publish an empty list" rule per type.
