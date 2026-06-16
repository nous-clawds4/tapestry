# ADR 0002: nostr-user-tag hybrid e+a writer — Story-2 implementation decisions

**Status:** Accepted
**Date:** 2026-06-12
**Story:** `engineering-team/stories/tag-stack-merge-hardening/2-nostr-user-tag-hybrid-ea-writer.md`
**Epic:** tag-stack-merge-hardening
**Governing ADR:** ADR-0022 (`engineering-team/decisions/0022-nostr-user-tag-hybrid-ea-reference.md`, Accepted) — the hybrid `e`+`a` wire shape. This ADR does **not** revisit that decision; it records the implementation-level choices Story 2 needs and resolves the story's two open questions.

## Context

ADR-0022 mandates that each `nostr-user-tag` assertion carry both `['a', '39999:<tagAuthorPubkey>:<slug>']` (stable identity) and the existing `['e', <tagEventId>]` (provenance). The writer `ui/src/utils/publishProfileTagAssertion` (`ui/src/utils/publishProfileTag.js:43`) is still `e`-only. Story 2 is scoped to **writer + firmware only** — no `#a` read support, no lazy re-emit (PO decisions, 2026-06-12).

Verified facts (code, 2026-06-12):

- The writer receives a `tag` object and uses `tag.eventId` + `tag.slug`; it must additionally use the tag-element **author pubkey** to build the `a` coordinate.
- **Both apply surfaces already carry the author pubkey on their tag objects:**
  - Profile chip popover → `useProfileTags` `availableTags` ← `handleAvailableTags`, which returns `authorPubkey: ev.pubkey` (`src/api/profile-tags/index.js:144`).
  - Tag page → `useTagDetail` ← `/api/profile-tags/by-id` `handleTagById`, which returns `authorPubkey: ev.pubkey` (`src/api/profile-tags/index.js:676`).
- **Not an apply surface:** `findTagsByNameSubstring` `tagHits` (`:306`) omit `authorPubkey`, but those rows *navigate* to `/tag/:slug/:tagId`; they do not publish. No change needed (noted for any future apply-from-search surface).
- **Gap:** `createTag` returns `{ eventId, slug, name, description }` without `authorPubkey` (`useProfileTags.js:123`). For a just-created tag the author is the current user (`signed.pubkey`).
- Tag-elements are **user-authored** kind-39999 events (`createTag` signs with the user's key), so `39999:<tagAuthorPubkey>:<slug>` uses the creating user's pubkey — **not** the TA.
- Firmware: `firmware/active` is a symlink → `firmware/versions/v1.0.0`; the installer reads `firmware/active` (`src/api/normalize/firmware.js:18`). The `nostr-user-tag` json-schema's `nostrUserTag` object has `required: ["taggedPubkey", "tagEventId"]`.

## Options considered

### Failure behavior when `tag.authorPubkey` is missing at publish time (story open question 1)

- **Option A — refuse to publish (throw) (chosen).** If `tag.authorPubkey` is absent or not 64-hex, throw before signing. Both apply surfaces + the `createTag` fix supply it, so the throw never fires in normal use; it's a guard against a future caller that forgets. Preserves wire integrity (never emit a malformed `a`).
- **Option B — silently fall back to `e`-only.** Never breaks an apply, but silently re-introduces the exact `e`-only legacy-set growth Story 2 exists to stop. **Rejected** — self-defeating; a missing author would pass unnoticed and erode the fix.

**Chosen: A.** Hard-refuse, paired with threading `authorPubkey` through every apply surface (both already have it server-side; only `createTag`'s return needs the field) so refuse is a guard, not a normal path.

### ADR-0022 placement (story open question 2)

ADR-0022 sits at the flat `decisions/0022-...` and a duplicate `decisions/profile/0022-...` (merge artifact). **Decision:** leave ADR-0022 where it is and reference it as the governing ADR; do **not** move/renumber it (it's cross-epic — surfaced by the Communities dependency, not owned by this epic). The duplicate-path cleanup stays on the Tier-4 doc-hygiene list (`_intake.md` 2026-06-12), not this story.

## Decision

Implement ADR-0022's writer + firmware changes, Story-2-scoped: hard-refuse on missing author, thread `authorPubkey` (already present on both apply surfaces; add to `createTag`'s return), add optional `tagAddress` to the firmware schema, reinstall firmware. No read-path or migration changes.

## Consequences

- New assertions are born hybrid `e`+`a`; the `e`-only legacy set stops growing (the merge blocker closes). Existing `e`-only assertions are untouched and still match current `#e` reads (AC-4).
- **No ADR-0015 conflict:** the `a` coordinate references the user-authored tag-element (`39999:<tagAuthor>:<slug>`), not the TA. ADR-0015 pins only the `z`-tag *concept* handle to the legacy TA pubkey — unchanged here.
- **Firmware reinstall required:** the schema gains an optional `tagAddress`. Run `POST /api/firmware/install` after deploy (AC-6). Old `e`-only events still validate (`tagAddress` optional, `tagEventId` still required — AC-5).
- A future apply-from-search surface would need `authorPubkey` added to `findTagsByNameSubstring` — noted, not in scope.

## Implementation notes

- **`ui/src/utils/publishProfileTag.js`** (`publishProfileTagAssertion`):
  - Update the `tag` arg contract to `{ eventId, slug, authorPubkey }`.
  - Guard: if `tag.authorPubkey` is missing or not `^[0-9a-f]{64}$`, `throw` before signing (Option A).
  - Add `['a', \`39999:${tag.authorPubkey}:${tag.slug}\`]` to `tags`, placed **before** the `['e', tag.eventId]` entry (matches ADR-0022's sketch). Keep `e`, `z` (`NOSTR_USER_TAG_HANDLE`, unchanged), `d`, `p`, `polarity`.
  - Add `tagAddress` to the content mirror: `{ nostrUserTag: { taggedPubkey, tagEventId, tagAddress } }`.
- **`ui/src/hooks/useProfileTags.js`** (`createTag` return, `:123`): add `authorPubkey: signed.pubkey` so create-then-apply supplies the coord.
- **No change** to the apply call sites in `useProfileTags` (`applyTag`/`disputeTag`) or `Tag.jsx` (`:95`/`:101`) — their `tag` objects already carry `authorPubkey` from `handleAvailableTags` / `handleTagById`. The Implementer should verify at runtime that the field is populated on each surface (a quick console/log or test), since the throw now depends on it.
- **`firmware/active/concepts/nostr-user-tag/json-schema.json`** (real file: `firmware/versions/v1.0.0/...` via symlink): add an **optional** `tagAddress` property (string; `name`/`title`/`slug`/`description` mirroring the existing `tagEventId` block, description noting it mirrors the event's `a` tag). **Keep `required: ["taggedPubkey", "tagEventId"]`** — do not add `tagAddress` to `required`.
- **Deploy step:** `POST /api/firmware/install` after the change lands (per CLAUDE.md house rule).

## Out of scope

- `#a` read/group support on our endpoints (`aggregateProfilesTagged` etc.) — deferred (Story 2 scope).
- Lazy client self-re-emit of legacy `e`-only assertions — deferred follow-up.
- `findTagsByNameSubstring` `authorPubkey` — only if a future surface applies from search.
- Moving/deduplicating ADR-0022's file paths — Tier-4 doc hygiene.
