# ADR 0001: Profile-tag concept and architecture

**Status:** Accepted
**Date:** 2026-05-06
**Story:** `engineering-team/stories/1-tag-user-profiles.md`

## Context

Story 1 asks for the ability to apply categorical tags to user pubkeys with explicit polarity (apply / dispute). v1 is **valence-naive**: signed assertions are persisted and counted, but no GrapeRank-weighted aggregation runs over them yet (the valence/interpretation arc is a separate, deferred initiative).

**Concept-graph orientation.** Called `/api/concept-graph/summaries` and drilled into three handles:

- `39998:<TA>:tag` — exists in the graph; the schema retrieved from `/node/<handle>/...` carries `slug` (unique), `name`, `description`, and `applicableTo: [conceptSlug]`. The graph reflects a richer schema than the firmware files currently on `main` (see "Constraints" below).
- `39998:<TA>:nostr-relay-tag` — exists in the graph as an assertion concept linking `relayEventId` → `tagEventId` with optional `confidence ∈ [0,1]`. **The firmware definition for this concept was reverted from `main` in commit `08743b7e` ("Remove Relay Discovery feature from main", 12 days ago)**, so the graph entry is stale residue from a prior install. The pattern itself is the precedent the story cites.
- `39998:<TA>:nostr-user` — exists; element schema requires `pubkey`, with optional `npub`, `nprofile`. No changes needed.

**Constraints.**
- A minimal `tag` concept (slug-only) exists in `firmware/versions-grapevine/v0.0.1/concepts/tag/`. A richer version with `name`, `description`, and `applicableTo` lived briefly in `firmware/versions/v1.0.0/concepts/tag/` and was reverted in commit `08743b7e`. The story's UX (chip name + tooltip description + WoT-network filtering) requires the richer fields.
- **`firmware/active` is a symlink to `firmware/versions/v1.0.0/`** — that is the only firmware tree the install pipeline (`POST /api/firmware/install`) reads from. Files placed in `versions-grapevine/v0.0.1/concepts/` are dormant until a separate manifest swap activates them. Therefore the new concept and the enriched `tag` schema must live in `firmware/versions/v1.0.0/concepts/` and be registered in `firmware/versions/v1.0.0/manifest.json`. *(This constraint was discovered during implementation; prior wording of this ADR placed both concepts in `versions-grapevine/`. Amended in place — see Implementation notes below.)*
- No new lint/typecheck/build tooling per project rule.
- JS-without-build front end; backend is plain Node/Express modules under `src/api/`.
- Publishing flow must reuse `ui/src/utils/nostrPublish.js` (`publishEverywhere`, `publishToLocalStrfry`).
- Concept changes require firmware reinstall (`POST /api/firmware/install`).

## Options considered

### Option A — One assertion concept (`nostr-user-tag`); polarity and references on event-tags

Mirror the deleted `nostr-relay-tag` shape, with two improvements over a literal mirror:

1. The target identifier is the raw `taggedPubkey` (64-char hex), not a `userEventId` referencing a kind 39999 nostr-user record. Pubkey is the canonical Nostr identity; requiring an indexed user record as a tagging precondition would gate the feature unnecessarily.
2. **Polarity, target pubkey, and the applied tag are all expressed as Nostr event-tags, not JSON content.** This makes them relay-filterable and removes semantically load-bearing data from the JSON payload.

**Wire shape (kind 39999):**

```jsonc
{
  "kind": 39999,
  "tags": [
    ["d", "profile-tag-<tagSlug>-<targetPubkey.slice(0,8)>-<authorPubkey.slice(0,8)>"],
    ["p", "<targetPubkey>"],                 // target — relay-filterable via #p
    ["e", "<tagEventId>"],                   // kind 39999 tag-element being applied — relay-filterable via #e
    ["z", "39998:<TA>:nostr-user-tag"],      // membership in the assertion concept
    ["polarity", "1"],                       // OR "-1"; absent = "1" (default positive)
    ["json", "{\"nostrUserTag\":{\"taggedPubkey\":\"...\",\"tagEventId\":\"...\"}}"]
  ]
}
```

The two structural references on the event are intentionally distinct:

- `e`-tag: "this event *references* that specific tag element." Following its chain (39999 tag-element → 39998 `tag` concept-header) tells you the referenced thing is a tag.
- `z`-tag: "*this event itself* is a list-element of the `nostr-user-tag` concept." That is how the firmware concept-graph install pipeline recognizes the event and registers it as a `HAS_ELEMENT` of the `nostr-user-tag` concept-header. Without it, install is broken and `#z` enumeration of all profile-tag assertions becomes untenable.

**Polarity semantics.** v1 publishers emit only `"1"` (applied) or `"-1"` (disputed). The full open range `[-1, +1]` is reserved for the future valence arc; `0` is reserved for "no opinion / observational interest." v1 consumers parse `polarity` to a number and bucket strictly:

- `>= 0.5` → applied
- `<= -0.5` → disputed
- `(-0.5, 0.5)` → neutral; not counted in apply/dispute chips

This is forward-compatible: graded weights from the valence arc slot in without a wire-format migration.

**JSON payload role.** `taggedPubkey` and `tagEventId` mirror the `p` and `e` event-tags as schema-validated copies — same values restated, not a separate source of truth. Polarity is *not* in JSON. Going to a fully empty JSON would require either neutering the firmware schema (loses its descriptive role) or extending the firmware schema engine to source fields from event-tags (its own ADR, out of scope).

**Schema (in firmware json-schema.json):**

```jsonc
{
  "nostrUserTag": {
    "required": ["taggedPubkey", "tagEventId"],
    "properties": {
      "taggedPubkey": "string (64-char hex)",
      "tagEventId":   "string (event id of kind 39999 tag element)"
    }
  }
}
```

**Identity = (author, target, tag).** Re-publishing with the same `d` tag overwrites (replaceable parameterized event). Switching apply ↔ dispute is just an overwrite with flipped polarity. Revoke = NIP-09 kind-5 deletion event referencing the assertion id.

**Pros**
- Mirrors the existing precedent (one concept, one event kind).
- Polarity, target, and applied-tag are all filterable on the relay side via NIP-01 tag filters (`#p`, `#e`, `#polarity`, `#z`) without parsing JSON.
- Polarity is forward-compatible with graded valence weights `[-1, +1]` from the deferred design memo — no v1 wire-format migration.
- Defaulting rule (`+1` if absent) is honored cheaply on read.
- No semantically load-bearing data lives only in JSON.

**Cons**
- JSON contains a mirror of `taggedPubkey` and `tagEventId` (cosmetic redundancy required by the firmware schema engine until that engine grows event-tag sourcing).
- Diverges from precedent in one place: target is a raw pubkey, not an event id. Justified by Nostr conventions; worth flagging.

### Option B — Two assertion concepts (`nostr-user-tag-application` + `nostr-user-tag-dispute`)

Polarity is encoded in the concept itself. Each assertion is one of two concepts; relay-side filtering by `#z` is a clean apply-vs-dispute separator.

**Pros**
- Each event is self-describing without parsing JSON.

**Cons**
- Doubles the firmware concept count for what is logically a single relationship.
- Doesn't extend cleanly to graded valence later (would need a third concept or a migration when the valence arc lands).
- Toggling apply ↔ dispute requires publishing two events (delete one concept's record, publish in the other) instead of a single overwrite.
- Diverges further from the relay-tag precedent.
- With Option A's event-tag changes, the only advantage Option B had (relay-side polarity filtering) is gone.

### Option C — Reuse Nostr kind-7 reactions on tag events

Apply = `+` reaction to a tag event with target pubkey in `p`; dispute = `-` reaction.

**Pros**
- Leverages an existing Nostr primitive; near-zero firmware footprint.

**Cons**
- Doesn't fit the firmware list/concept pattern (story acceptance criterion explicitly requires events conform to firmware list patterns).
- Loses the `tagEventId` ↔ `taggedPubkey` relationship as a structured concept the graph can reason about.
- Conflicts with reactions used elsewhere in the product.

## Decision

**Option A.** One assertion concept (`nostr-user-tag`); polarity, target pubkey, and applied tag all expressed as event-tags; JSON payload is a schema-validated mirror with no exclusive truths.

Why: it mirrors the precedent the story cites, keeps a single firmware concept, and the event-tag-first approach gives us relay-filterable polarity, target, and applied-tag references *and* a forward-compatible polarity range without a wire-format migration. Diverging from the precedent on target identifier (raw `taggedPubkey` vs. `userEventId`) is justified by Nostr conventions: pubkey is the identity.

## Consequences

**Enables:**
- Profile tagging end-to-end on a single concept.
- Future valence arc reads `polarity` as the seed of a graded weight without rewriting events or rerunning migrations.
- Relay-side filter queries by target pubkey (`#p`), applied tag (`#e`), polarity (`#polarity`), or assertion concept (`#z`) — none requiring JSON parse.
- WoT-tag enumeration is one filtered subscription against local strfry: `kinds:[39999], #z:[<nostr-user-tag handle>], authors:[<wot pubkeys>]`.

**Constrains / makes harder:**
- Polarity must be strictly defaulted to `1` on read whenever the event-tag is absent. Defaulting must be consistent across server (`tags.find(t => t[0] === 'polarity')?.[1] ?? '1'`) and client (same rule). Suggest a tiny shared helper.
- The JSON-as-mirror pattern is a slight redundancy required by the current firmware schema engine. Documented as a known cleanup target, not a blocker.

**Follow-ups / debt:**
- The story mentions in "Out of scope" that "relays already covered" by tagging — but `nostr-relay-tag` was reverted from `main`. After this story ships, relay tagging will need a separate re-introduction story. Not a blocker, but the story's framing is slightly out of date with reality. Flagged for PO awareness; no story rework needed.
- The valence/interpretation arc remains a separate multi-story effort (per the prior design memo). v1 ships without weighted scoring.
- The original draft of this ADR proposed an `applicableTo` field on the `tag` schema as a soft hint about which concepts a tag is meant for. **Dropped during implementation** — nothing in this story consumes it (the `nostr-user-tag` event joins arbitrary tag↔target without consulting it, and the picker shows tags used by the WoT network rather than filtering by applicability). If a future story needs it as a constraint, re-introduce as its own ADR.
- A future ADR may extend the firmware schema engine to source declared fields from event-tags directly, eliminating the JSON-mirror pattern.

**Firmware reinstall required?** **Yes.** Two concept changes: enrich `tag` schema, add `nostr-user-tag` concept. Run `POST /api/firmware/install` after merging.

## Implementation notes

### Firmware (in `firmware/versions/v1.0.0/concepts/`)

*(See "Constraints" above — the original draft of this ADR placed both concepts in `versions-grapevine/v0.0.1/concepts/`. That tree is dormant; `firmware/active` symlinks to `versions/v1.0.0/`, which is the only path the install pipeline reads. Both concepts must live here and be registered in `firmware/versions/v1.0.0/manifest.json`.)*

- **Re-introduce `tag/`** (the `versions/v1.0.0/concepts/tag/` directory was deleted in commit `08743b7e` along with the relay-discovery feature; recreate it). Three files:
  - `concept-header.json` — slug `tag`, oNames/oSlugs/oKeys/oTitles/oLabels in the standard form. The description from the deleted `08743b7e^` version is a fine reference template.
  - `json-schema.json` — enriched with `name` (required) and `description` (optional) added to the `tag` object alongside the existing `slug`. Keep `slug` required and `x-tapestry.unique = ["slug"]`.
  - `manifest.json` — empty `HAS_ELEMENT` and `IS_A_SUPERSET_OF` arrays.
- **Register `tag` and `nostr-user-tag` in `firmware/versions/v1.0.0/manifest.json`** as two new entries in the `concepts` array.
- **New concept directory `nostr-user-tag/`** with three files:
  - `concept-header.json` — slug `nostr-user-tag`, oNames/oSlugs/oKeys/oTitles/oLabels in the same style as the deleted `nostr-relay-tag` concept-header (template: `git show 08743b7e^:firmware/versions/v1.0.0/concepts/nostr-relay-tag/concept-header.json`). `oKeys.singular` should be `nostrUserTag`.
  - `json-schema.json` — the schema sketched in Option A (no polarity field).
  - `manifest.json` — empty `HAS_ELEMENT` and `IS_A_SUPERSET_OF` arrays (matches the existing `tag` manifest).

### Server API (in `src/api/profile-tags/index.js`)

Three GET endpoints registered in `src/api/index.js`:

- `GET /api/profile-tags/available-tags` — returns kind 39999 elements `#z`'d to `39998:<TA>:tag` from local strfry. Each entry: `{ eventId, slug, name, description, applicableTo }`. Used by the picker UI.
- `GET /api/profile-tags/tags-for-profile?pubkey=<hex>[&relays=...]` — fetch kind 39999 events `#z`'d to `39998:<TA>:nostr-user-tag` with `#p = pubkey`, from local strfry plus default external relays (mirror `DEFAULT_RELAYS` in the deleted `src/api/relay-discovery/index.js`). Returns `{ applications: [...], disputes: [...] }` where each entry has `{ eventId, authorPubkey, tagEventId, polarity, createdAt }`. Server reads polarity from the `["polarity", ...]` event-tag (defaulting `"1"` if absent), parses to a number, and buckets per the rules above (`>= 0.5` apply, `<= -0.5` dispute, otherwise neutral / not counted).
- `GET /api/profile-tags/wot-tags?viewer=<hex>` — uses local strfry's author-indexed kind 39999 events with `#z = nostr-user-tag` filtered by `authors:[<viewer's WoT pubkey set>]`, returning the union of `tagEventId`s referenced. v1 may scope this to "all tagEventIds referenced anywhere on local strfry" if WoT-author-list lookup is non-trivial; the WoT filter is a follow-up. Acceptable per story acceptance criterion 2.

Use `runCypher` from `src/lib/neo4j-driver` and `SimplePool` via the existing pattern in the deleted `src/api/relay-discovery/index.js` (read it from git history at `08743b7e^` for reference).

### UI

- **Hook `ui/src/hooks/useProfileTags.js`** — fetches the three endpoints above, returns `{ availableTags, applications, disputes, loading, error, refetch }` and exposes `applyTag(tag)`, `disputeTag(tag)`, `revoke(eventId)` methods. Each method:
  - Builds an unsigned kind-39999 event per the wire shape in Option A. **The `["polarity", ...]` tag is always emitted explicitly by v1 publishers** (`"1"` for apply, `"-1"` for dispute) — story requirement.
  - Calls `window.nostr.signEvent(unsigned)`.
  - Calls `publishEverywhere(signed)` from `ui/src/utils/nostrPublish.js`.
  - Calls `importAddressableToNeo4j(signed)` if available; fire-and-forget.
  - Calls `refetch()` on success.
  - `revoke(eventId)` publishes a kind-5 deletion event referencing the assertion id.
- **Component `ui/src/components/ProfileTagPanel.jsx`** — adapts the deleted `RelayTagPanel.jsx` (read from `git show 08743b7e^:ui/src/pages/relay-discovery/RelayTagPanel.jsx`):
  - Tag chip section: chips from `availableTags` filtered to those with ≥1 application or dispute on this pubkey. Each chip shows the WoT count and a popover (per the mockup) listing asserter avatars/names. Disputers are shown with a warning marker; no free-text rationale in v1.
  - Inline tag-creation flow: when no matching tag exists in the picker, "Create new tag…" opens a small form (name required, description optional) that publishes a new kind 39999 `tag` element via NIP-07 first, then proceeds to apply it.
  - "Manage" link: opens the same panel filtered to *my* assertions on this profile, each with a Revoke button.
- **Modify `ui/src/pages/BrainstormProfile.jsx`** at the action-button row (around line 245–270): add a `Tag` button alongside Follow / Mute / Report that toggles a `<ProfileTagPanel />` mounted below the actions. Wire to existing `useAuth` for NIP-07 status.

### Polarity defaulting helper

Centralize the read-side default. Recommended shared function (server and client):

```js
// readPolarity(event) → number in [-1, +1]
// Reads ["polarity", value] event-tag; returns 1 when absent or unparseable.
function readPolarity(event) {
  const t = (event.tags || []).find((x) => x[0] === 'polarity');
  if (!t || t[1] == null) return 1;
  const n = Number(t[1]);
  return Number.isFinite(n) ? n : 1;
}
```

Bucketing helper (`'apply' | 'dispute' | 'neutral'`) follows the `>= 0.5` / `<= -0.5` rule.

### Replaceable `d`-tag format

`profile-tag-<tagSlug>-<targetPubkey.slice(0,8)>-<authorPubkey.slice(0,8)>` — mirrors the relay-tag precedent (`tag-app-<slug>-<targetEventId.slice(0,8)>-<pubkey.slice(0,8)>`).

## Out of scope

- GrapeRank/aggregate trust scoring of profile-tags. Deferred to the valence arc.
- Per-user valence/interpretation overrides.
- Lifting `tag` from `versions-grapevine/` to `versions/v1.0.0/`.
- Re-introducing `nostr-relay-tag` (separate story).
- Sort/rank order of tag chips on a profile (display order unspecified).
- Free-text "dispute rationale" comment on a dispute assertion. Not in this story; deferred.
- Bulk operations or filter/search in the Manage view.
- Extending the firmware schema engine to source fields from event-tags (would eliminate the JSON-mirror pattern).
