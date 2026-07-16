# ADR 0001: Profile-tag reads resolve by the stable a-coordinate (consume-by-#a)

**Status:** Proposed
**Date:** 2026-07-07
**Story:** `engineering-team/stories/profile-tag-hardening/1-consume-by-a-coordinate.md`

## Context

Every `nostr-user-tag` assertion (kind 39999) is written with a **hybrid** parent
reference (ADR `profile/0022-nostr-user-tag-hybrid-ea-reference.md`):

- `["a", "39999:<tagAuthorPubkey>:<slug>"]` — the tag-element's **stable identity**.
- `["e", "<tagEventId>"]` — the **applied-version provenance**.
- `content.nostrUserTag.tagAddress` mirrors the `a` value.

Verified in the writer (`ui/src/utils/publishProfileTag.js:61-88`): the `a`
coordinate is built from the **tag-element author's real pubkey** (`tag.authorPubkey`)
and slug — it does **not** involve the TA or the ADR-0015 `LEGACY_*` z-tag literal.
The z-tag composition is a separate concern and is untouched by this ADR.

ADR-0022's contract is explicit: **consume by `#a`; treat `e` as provenance, not
identity.** But every read in `src/api/profile-tags/index.js` resolves strictly by
the `e` event-id. Because a tag-element is a kind-39999 **parameterized-replaceable**
event, re-minting the same `(author, slug)` (or any edit) produces a *new* event-id at
the *same* a-coordinate. strfry retains only the latest version per `(kind, author, d)`,
so:

- The old event-id vanishes from strfry; assertions that froze it in `e` now dangle.
- `#e:[currentTagEventId]` scans **silently omit** every assertion that referenced a
  prior version — a durable-list correctness bug in the same family as the note-TL cap
  we just fixed.
- The `tags-for-profile` read keys taggings by `e` and the UI joins `availableTags` by
  `eventId`, so a replaced tag renders as a truncated id (`id.slice(0,8)`) instead of
  its name.

The **event-tag** stack already solves this: `src/api/event-tags/index.js:155-168`
scans candidates keyed on the target (`#e`/`#a`), collects distinct descriptor
coordinates, and resolves headers by `(author, d-tag)`. This ADR brings the
profile-tag stack up to the same doctrine.

### Constraints (non-negotiable, from CLAUDE.md)

- **POV-first / filter-at-read-time.** No denormalized global "applied set"; keep
  deriving per-request from raw assertions under the active POV filter.
- **strfry filter semantics.** Tags *within one filter* are AND-ed. `#a` and `#e` in a
  single filter would mean "match both" — wrong. A **union** therefore requires **two
  scans** whose results are concatenated and de-duplicated.
- **TA pubkey resolved at runtime**, except the ADR-0015 `LEGACY_*` z-tag carve-out —
  which this change never touches (the `a` coordinate is the tag author's own pubkey).
- JS-without-build; no new tooling.

### Concepts touched (read-path only)

- `39998:<TA>:nostr-user-tag` — the assertions being read/aggregated.
- `39998:<TA>:tag` — the tag-element whose `39999:<author>:<slug>` coord is the stable id.
- `39998:<TA>:tag-pinning` — the pin driving the pubkey TL (kind-30392) that must span versions.

No concept **schema** changes here. ADR-0022 already added the optional `tagAddress`
field to the `nostr-user-tag` json-schema. **No firmware reinstall is required.**

## Options considered

### Option A — Union-scan the assertion-aggregation sites; canonicalize display by coordinate (chosen)

Introduce one shared union primitive and apply it to the three read sites that
**aggregate assertions by tag identity**. Expose the assertion's `a` coordinate
(`tagAddress`) in the `tags-for-profile` response and let the UI canonicalize the
display grouping by coordinate.

Per aggregation site, replace the single `#e` scan with a **union of two scans** —
`#a:[coords]` (all versions, new) ∪ `#e:[eventIds]` (legacy provenance, retained) —
concatenated and passed through the existing `dedupeReplaceable`. The candidate
coordinates are built from the tag-elements the site already loads (`ev.pubkey` +
`payload.slug` → `39999:<author>:<slug>`).

- **Pros:** strict superset of today (union never removes, only adds); one coherent
  doctrine across the read, the durable TL, search, and the authored-by view; reuses the
  proven `dedupeReplaceable` dedup; no write change, no migration, no schema/firmware
  change; POV filtering stays exactly where it is (applied after the union scan).
- **Cons:** two strfry scans per aggregation site instead of one (both are indexed
  single-char-tag scans; negligible); each changed count-grouping site must switch its
  internal grouping key from event-id to coordinate so unioned versions actually collapse.

### Option B — Minimal, AC-only: change only the pubkey TL + tags-for-profile + UI

Union only `aggregateProfilesTagged` (the kind-30392 TL, AC-2) and fix the
`tags-for-profile` response + UI (AC-1/AC-5). Leave `computeTagMatches` (search) and
`handleAuthoredBy` (authored-by counts) on `#e`.

- **Pros:** smallest diff; strictly satisfies the written ACs.
- **Cons:** institutionalizes an inconsistency the story's "one coherent consume-by-#a
  doctrine" framing warns against — the *same* replaced tag would span versions in the
  pubkey TL but silently version-split in search results and in the authored-by activity
  view. Those two sites are the identical bug in sibling endpoints; leaving them invites a
  second bug report and a near-duplicate follow-up ADR. Rejected.

### Option C — Coordinate-primary rewrite (drop `e`, backfill)

Rewrite the write path and reads to key purely on `a`, add a backfill of stored
assertions, and drop `e` grouping entirely.

- **Pros:** simplest end-state; one key.
- **Cons:** directly contradicts ADR-0022 (which *deliberately* retains `e` for
  provenance / drift detection) and the story's out-of-scope (no write change, no
  migration); loses provenance; can't re-sign other users' assertions (they're
  user-signed). Rejected.

## Decision

We chose **Option A**. It honors ADR-0022's contract, is a provable strict superset of
current behavior, and applies the consume-by-`#a` doctrine uniformly to every site that
aggregates assertions by tag identity — while leaving the one genuine per-version
provenance lookup (`handleTagById`'s viewer-pin check) on `#e`, where version-specificity
is correct.

### The union primitive

At each aggregation site, given a set of candidate tag-elements each carrying
`{eventId, authorPubkey, slug}`:

```
coords    = tagElements.map(t => `39999:${t.authorPubkey}:${t.slug}`)   // stable identity
eventIds  = tagElements.map(t => t.eventId)                              // legacy provenance
byA       = await federatedScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#a': coords })
byE       = await federatedScan({ kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], '#e': eventIds })
assertions = dedupeReplaceable([ ...byA, ...byE ])
```

**Dedup key:** `dedupeReplaceable` already collapses on `${pubkey}|${d-tag}` (falling
back to `${pubkey}|${id}`). Each assertion's `d`-tag is
`profile-tag-<slug>-<target8>-<asserter8>`, so an assertion appearing in **both** legs
(it carries a matching `a` *and* a matching `e`) collapses to a single survivor —
**counts cannot double**. Legacy `e`-only assertions (no `a`) appear only in the `byE`
leg and resolve exactly as today. New `a`-bearing assertions on *any* version appear in
the `byA` leg. This is the same union+dedup shape `federatedScan` already uses for
local∪remote.

**Legacy-on-prior-version boundary (unchanged from today):** a legacy `e`-only
assertion that froze a *prior* version's event-id is neither caught by `#a` (it has no
`a`) nor by `#e:[currentTagEventId]`. That is *already* invisible today, and the story
marks backfill/migration out of scope (ADR-0022 case (c)). The union is a strict
superset — it never regresses this case, it just doesn't magically resolve it.

## Consequences

**Enables:**
- The kind-30392 pubkey Trusted List spans all tag-element versions (AC-2), with **zero**
  change to `refreshPinnedTags` — it passes only `tagEventId` and consumes only `byTarget`
  (verified `src/api/trustedList/refreshPinnedTags.js:156-159`); the union is internal to
  `aggregateProfilesTagged`.
- A replaced tag-element resolves to its name in the profile chip row, the manage dialog,
  and search (AC-1, AC-5) — no more truncated ids.
- Search (`/match`) and the authored-by activity view count assertions across versions.

**Constrains / debt:**
- Two indexed scans per aggregation site instead of one (negligible; both `#a` and `#e`
  are relay-indexed single-char tags).
- `handleTagById`'s viewer-pin check stays `#e` (a per-version, by-id provenance lookup).
  A viewer's pin of a *prior* tag-element version will not surface as `viewerPin` when the
  endpoint is queried with a *newer* event-id. That is a **pin** cross-version concern,
  orthogonal to this assertion-read story — see Out of scope.
- `handleTagIndex` and `handleWotTags` group by referenced `tagEventId` without an `#e`
  filter and share the same latent version-split. They are not among the story's four
  named sites and reworking their **external** response contract (both key rows/ids by
  event-id) is a larger change — flagged as follow-up, not done here.

- **Firmware reinstall required? No.** No concept definition changes; `tagAddress` already
  exists in the `nostr-user-tag` schema (ADR-0022). This is a read-path change only.

## Implementation notes

### (a) The four `#e`-keyed scan sites — verdict table

| # | Line | Function | Computes / consumer | Verdict |
|---|------|----------|---------------------|---------|
| 1 | ~442-446 | `computeTagMatches` | Search: name-matched tags → profiles with them applied. Consumed by `GET /match` + the Meili search proxy. | **CHANGE** — union `#a`∪`#e`; regroup by coordinate internally. |
| 2 | ~574-578 | `aggregateProfilesTagged` | Per-target apply/dispute counts → `GET /profiles-tagged` **and** the kind-30392 pubkey TL. | **CHANGE (required, AC-2)** — union `#a`∪`#e`. Already groups by `#p` target, so the union alone fixes it. |
| 3 | ~720-725 | `handleTagById` viewer-pin scan | "Has *this viewer* pinned *this specific tag event*." A **pin** (`tag-pinning`) provenance lookup on a by-id endpoint. | **KEEP `#e`** — version-specific provenance; pin cross-version is out of scope (follow-up). |
| 4 | ~1268-1272 | `handleAuthoredBy` parent-tag scan | Parent-tag aggregate (Reading A) + per-(tag,target) peer counts (Reading B) for the owner's taggings → `GET /authored-by`. | **CHANGE** — union `#a`∪`#e`; **regroup** `parentCounts`/`peerCounts` by coordinate. |

**Per-site specifics:**

- **Site 2 — `aggregateProfilesTagged({ tagEventId, povSuffix, minRank })`** (the required
  fix). Resolve the passed `tagEventId` to its coordinate: `federatedScan({ kinds:[39999],
  ids:[tagEventId] })` → `parseTagPayload` for the slug + `ev.pubkey` for the author →
  `coord = 39999:${ev.pubkey}:${slug}`. Union `#a:[coord]` ∪ `#e:[tagEventId]`, dedupe,
  then run the existing per-`#p`-target grouping unchanged. If the tag-element is not
  locally resolvable, fall back to the `#e`-only scan (strict superset preserved).
  *Optional perf:* accept optional `{ tagAuthorPubkey, tagSlug }` hints so
  `refreshPinnedTags` (which already holds the resolved `tag`) can skip the re-fetch;
  `handleProfilesTagged` does not pre-fetch, so internal resolution must remain the
  default.

- **Site 1 — `computeTagMatches`.** `findTagsByNameSubstring` must additionally return
  `authorPubkey: ev.pubkey` (the `ev` is in scope at `index.js:374`). Build `coords` from
  the matched tags, union `#a:[coords]` ∪ `#e:[eventIds]`. Change the inner grouping so an
  assertion maps to its matched tag by **coordinate** (resolve the assertion's `a` value,
  or fall back to its `e` via the current `tagById`), and key `matchedTags` by the
  canonical tag's coordinate. The **external** response still exposes each matched tag's
  current `eventId`/`slug`/`name`/`count` — shape unchanged.

- **Site 4 — `handleAuthoredBy`.** Step 4 already loads `tagElementEvents` by id into
  `tagByEventId`; capture each element's `ev.pubkey` so a coordinate can be built per
  `tagEventId`. Union the step-5 parent scan `#a:[coords]` ∪ `#e:[remainingTagIds]`. Then
  **change the grouping keys**: `parentCounts` and `peerCounts` must key on the tag
  **coordinate** (not `eTag[1]`), and step-6 composition must look up
  `parentCounts.get(coordOf(c.tagEventId))` / `peerCounts.get(\`${coord}|${target}\`)`.
  Rows still expose `tagEventId: c.tagEventId` for provenance — external shape unchanged;
  only the counts become version-spanning. Consumer `ui/src/components/AuthoredTaggingSection.jsx`
  reads `tagName`/`tagSlug`/counts and links `/tag/<slug>/<tagEventId>` — no change needed.

- **Site 3 — `handleTagById`.** No change. It is `GET /by-id?tagEventId=…`, inherently a
  single-version endpoint, and its `viewerPin` field means "did the viewer pin *this*
  version." Union here would silently change that semantic. Left as-is.

### (b) Union + dedup mechanism

As specified under **The union primitive** above: two `federatedScan` legs (`#a`, `#e`),
concatenated, `dedupeReplaceable`. Dedup key = `${pubkey}|${d-tag}` (per-assertion),
guaranteeing no double-count and correct legacy resolution.

### (c) `tags-for-profile` response-shape change + every consumer

`handleTagsForProfile` scans by `#p:[pubkey]` (not `#e`) and returns flat
`applications`/`disputes` lists — it is **not** one of the four scan sites and needs no
union. The fix is a **field addition** plus UI canonicalization:

- **Server `handleTagsForProfile` (`index.js:258-276`):** for each entry, read the
  assertion's own `a` tag → add `tagAddress: aTag ? aTag[1] : null`. **Keep `tagEventId`**
  (provenance / back-compat). New entry shape:
  `{ eventId, authorPubkey, tagEventId, tagAddress, polarity, createdAt }`.
- **Server `handleAvailableTags` (`index.js:195-204`):** add
  `tagAddress: \`39999:${ev.pubkey}:${t.slug}\`` to each tag (author + slug already
  present). This is the explicit, unambiguous join key.

**Grouping/canonicalization happens in the UI** (keeps the server response flat and
POV-derivation untouched). Resolve each assertion to a canonical tag via
`tagAddress → availableTags` **or** `tagEventId → availableTags`, then group by the
resolved tag's `tagAddress`. Legacy `e`-only and hybrid assertions on the same tag thus
collapse onto one chip. An assertion whose tag resolves to neither map falls back to a
per-assertion key + the existing truncated-id render (unchanged behavior).

**All consumers of the `tags-for-profile` response (grep-verified):**

1. **`ui/src/hooks/useProfileTags.js:55-64`** — pass-through; entries now carry
   `tagAddress`. `myApplications`/`myDisputes` filter by `authorPubkey` — unaffected. No
   logic change (verify the new field flows through).
2. **`ui/src/components/ProfileTagsSection.jsx:29-55`** — **change.** Build
   `byAddress`/`byEventId` maps from `availableTags`; group `applications`/`disputes` by
   resolved coordinate; key chips + `appsByTagId`/`disputesByTagId` by coordinate; keep the
   truncated-id fallback for unresolvable tags. Rename `appliedTagEventIds` →
   `appliedTagKeys` (coordinates).
3. **`ui/src/components/ManageTagsDialog.jsx:20,53-54`** — **change.** Build the lookup by
   `tagAddress` (fall back to `eventId`); resolve each `myAssertion` via `a.tagAddress` →
   name; keep the truncated-id fallback.
4. **`ui/src/components/AddTagDialog.jsx:54,74`** — **change.** Consume `appliedTagKeys`
   (coordinates) and test `availableTags` membership via `t.tagAddress` instead of
   `t.eventId`, so a tag applied through a prior version is correctly shown as
   already-applied.
5. **`ui/src/components/TagChip.jsx`** — **verify only.** It receives a `tag` from
   `availableTags` (current version, so `tag.eventId` is current) and renders links
   `/tag/<slug>/<eventId>`. Works unchanged once grouping resolves to the current tag.

### (d) Backward-compat with legacy `e`-only assertions

The `e` leg is **retained** at every changed site (union, never replace). Legacy
`e`-only assertions appear only in the `byE` leg and resolve identically to today (AC-3).
The `dedupeReplaceable` dedup key is per-assertion, so mixing legs never double-counts.

### (e) Strict-superset confirmation (un-replaced tags unchanged)

For a tag-element that was **never replaced**, its single event-id equals its current
version. `#e:[eventId]` and `#a:[coord]` return the *same* assertion set, `dedupeReplaceable`
collapses the overlap, and the UI resolves the coordinate to the same single tag. Counts,
membership, and display are byte-for-byte identical to today (AC-4). The union only ever
**adds** assertions that reference a *different* version of the same coordinate — it never
removes one.

## Out of scope

- **Pin cross-version resolution** (`handleTagById` viewer-pin; the `pins` list). Pins also
  reference tags by hybrid `e`+`a` and dangle on replacement, but that is the pin/TL stack,
  orthogonal to assertion reads. Recommended follow-up.
- **`handleTagIndex` / `handleWotTags` coordinate re-keying.** Same latent version-split,
  but they key their *external* rows/ids by event-id; reworking that contract is a separate
  change. Follow-up.
- **Preventing** duplicate/replacement mints (tag-applicability picker).
- **Write path** (already emits hybrid `a`+`e`) and any **backfill/migration** of stored
  assertions (ADR-0022 case (b), lazy client self-re-emit — optional, eventual).
- The **note/event-tag** stack (already resolves by a-coordinate).
