# ADR 0002: Type-aware tag picker (live HINT ∪ USAGE endpoint + hard-filtered browse) + scheduled TL regen

**Status:** Accepted (operator-directed 2026-07-06: hard-filter browse + search-all escape; live viewer-inclusive compute; two-context scope)
**Date:** 2026-07-06
**Story:** `engineering-team/stories/tag-applicability/2-type-aware-picker-and-scheduled-regen.md`
**Epic:** `engineering-team/epics/tag-applicability.md`
**Depends on:** `tag-applicability/0001` (the z-hints, `computeTagUsageRows`, `buildMembers`, the two published kind-30393 lists + their loopback refresh)

## Context

Story 2 makes the tag picker type-aware and schedules the Story-1 list regeneration.

### Operator direction (2026-07-06) — supersedes two points of the original brief

1. **Browse is hard-filtered to the context** — the picker's default view shows **only** the
   current context's tags (super simple), NOT a "relevant-first + all-tags" section list.
2. **Search is scoped to the context, with a same-slug "Show other results" escape** *(David,
   2026-07-06 — supersedes the earlier "search reaches all" note)*. Typing filters **within** the
   current context's list. When the query matches a tag **outside** the context — in particular an
   **identical slug** (typing "LFO" for an event while "LFO" exists on pubkeys) — the picker shows a
   **"Show other results"** link that expands to reveal those cross-context matches, so the user
   adopts the existing tag instead of minting a duplicate. This escape **folds in Story 3** (the
   same-slug anti-fork affordance) and is what keeps scoped search safe from the `funny` re-mint.
   Each row carries a small **usage-context hint** ("LFO · people & content") derived from list
   membership, so a cross-context pick is knowing.
3. **The picker computes HINT ∪ USAGE _live_ and _viewer-inclusive_** — so a tag you just applied
   in a context **graduates into that context's browse immediately** (next open), not after the
   published-list regeneration. "Search once → apply → it's in browse thereafter." (The published
   kind-30393 lists remain the durable/federated artifact, kept fresh by the schedule; the local
   picker doesn't wait on them.)

### Spec correction (ratified): ONE tag picker, TWO contexts — not three

Only **`AddTagDialog`** is a *tag* picker (fully controlled: takes an `availableTags` array, filters
in memory — `AddTagDialog.jsx:28-44`). It mounts in two type contexts: **`ProfileTagsSection`**
(pubkey) and **`NoteTags`** (event). **`TagSomeoneModal`/`TagANoteModal` are NOT tag pickers** —
they take a fixed `tag` and pick a *target*; they apply the tag by its stable a-coordinate
(verified: `TagANoteModal.jsx:78` `{authorPubkey,slug}`; `publishProfileTagAssertion` `['a',39999:author:slug]`),
so they already reference the correct version of a dual-use tag and have nothing to reorder.

### Reused machinery (from Story 1)

- `computeTagUsageRows({wotPov})` (`event-tags/index.js:377`) → per-tag rows with
  `byType.{profile,event}` (house-POV **trusted** usage).
- `buildMembers(usageRows, hintEls, type)` (`refreshApplicabilityLists.js`) → the HINT ∪ USAGE
  union, deduped by a-coordinate, ordered by usage desc. **Both the publisher and this picker
  endpoint call it** — one definition of the rule.
- The pickers currently source `availableTags` (all tags, flat `{eventId,authorPubkey,slug,name,description}`)
  from `/api/profile-tags/available-tags` (`useProfileTags.js:54`, `useEventTags.js:25`).

### Constraints
- **Search-all escape preserved** (anti-re-mint). **Additive**; no change to the write paths, the
  tag index, or the Story-1 producer/scheduler contract. No new dependency; TA/POV resolved at runtime.

## Options considered

### Option A — Live HINT ∪ USAGE endpoint + AddTagDialog browse hard-filter + scheduler entry *(chosen)*

**Server:** `GET /api/tags/applicability?type=pubkey|event&viewerPubkey=<hex?>` computes the context
list **live** and returns member keys, ordered:
- **USAGE** = `computeTagUsageRows` with a **viewer-inclusive house predicate** — trusted iff
  `houseWoT(pk) || pk === viewerPubkey` — filtered to `byType[type]` (`pubkey→profile`, `event→event`).
  (Viewer-inclusive so you always see tags *you've* applied, regardless of WoT trust.)
- **HINT** = strfry `#z` scan for that type's hint constant (`TAG_FOR_NOSTR_{PUBKEY,EVENT}_Z`).
- **UNION** via the shared `buildMembers` → `{ members:[{authorPubkey,slug,applications}] }`.
Returns member keys only (`authorPubkey`+`slug`); the picker already holds full rows (with `eventId`)
from `available-tags`. **The picker does not read the published TL** — computing live gives immediate
graduation and is simpler (no TL parse). *(This is the deliberate deviation from the brief's
"read the TL with live fallback": the operative membership rule is identical; only freshness differs.)*

**Client** (reshaped 2026-07-06 — scoped search + "Show other results" + hints; the server
endpoint is unchanged — the hook just fetches BOTH type lists):
- `useTagApplicability(type, viewerPubkey)` fetches **both** `?type=event` and `?type=pubkey`
  (viewer-inclusive) and returns `{ applicableKeys, contextsByKey, loading }` — `applicableKeys` =
  the CURRENT type's ordered `authorPubkey:slug` keys (scoping); `contextsByKey` = `key →
  {people, content}` from each list's membership (for the hints + cross-context detection).
- `AddTagDialog` gains `applicableKeys` + `contextsByKey`. **Browse (no query): show ONLY tags whose
  key ∈ `applicableKeys`, ordered.** **Search (query): filter WITHIN `applicableKeys`** (scoped) —
  NOT the whole universe. Separately compute **other results** = `availableTags` matching the query
  but whose key ∉ `applicableKeys` (esp. an exact-slug match); if any, render a **"Show other
  results (N)"** toggle that reveals them. Each row shows a context hint from `contextsByKey[key]`
  ("· people & content"). Absent/empty `applicableKeys` ⇒ fall back to the full browse.
- `ProfileTagsSection` → `useTagApplicability('pubkey', viewer)`; `NoteTags` →
  `useTagApplicability('event', viewer)`; each passes `applicableKeys` + `contextsByKey`.

**Scheduler:** register `refreshApplicabilityLists` in `taskRegistry.json` (copy `refreshPinnedTagTLs`;
**no `resourceClass`**; `frequency:"timer-based"`), add `src/algos/refreshApplicabilityLists.sh`
(curls the existing loopback `POST /api/trusted-list/refresh-applicability-lists`), and seed a
**disabled** default schedule entry (`freshInstallEntries`). Keeps the published lists fresh for
federation/external consumers; operator sets cadence.

- **Pros:** browse is dead-simple (context-only); applied tags graduate immediately (live +
  viewer-inclusive); search always reaches everything (no re-mint); the union rule lives once
  (`buildMembers`, shared with the publisher); AddTagDialog stays controlled (an ordering/filter
  hint); scheduler is tiny (Story-1 endpoint already exists).
- **Cons:** the endpoint recomputes per call (bounded: one strfry scan + `computeTagUsageRows`, same
  cost as `/api/tags/index`); the picker still selects by `eventId` (OPEN #16 — untouched here).

### Option B — Picker reads the published kind-30393 TL directly (client `/api/strfry/scan`)

- **Cons (decisive):** browse lags the regeneration cadence (a just-applied tag doesn't appear until
  the next publish) — the operator explicitly wants immediate graduation; and it scatters TL parsing
  + fallback across both mounts. Rejected in favor of live compute.

### Option C — Hard-filter browse AND search to the context (no escape)

- **Cons (decisive):** removes the search-all escape → reproduces the exact `funny` re-mint bug for a
  live user. Rejected (the operator chose search-all as the escape).

## Decision

**Option A.** A live, viewer-inclusive `GET /api/tags/applicability?type=&viewerPubkey=` computes
HINT ∪ USAGE via the shared `buildMembers`, feeding `useTagApplicability` → an `applicableKeys` prop
that **hard-filters AddTagDialog's browse to the context while search still spans all tags**. Applied
tags graduate into browse immediately (live + viewer-inclusive). The published kind-30393 lists stay
the durable/federated artifact, kept fresh by a class-less `refreshApplicabilityLists` schedule entry
+ loopback-curl `.sh`. Scope: AddTagDialog's two contexts (the target-selector modals are out — they
already apply the correct a-coordinate version).

## Consequences

- **Enables:** simple context-scoped browse with no re-mint (search reaches all; applied tags
  graduate); Story 3's same-slug warning can reuse the same endpoint.
- **Deviation from brief (logged):** picker computes live rather than reading the published TL, and
  browse is hard-filtered with a *search* escape rather than a *section* escape — both operator-directed;
  the HINT ∪ USAGE membership rule and the anti-re-mint guarantee are preserved.
- **POV:** house WoT ∪ the viewer's own usage — POV-consistent and responsive.
- **Untouched:** OPEN #16 (picker still selects by `eventId`); the write paths; the target modals.
- **Firmware reinstall?** No.

## Implementation notes

- **`src/api/event-tags/index.js`** — extend `computeTagUsageRows({ wotPov, userPubkey, alsoTrust })`:
  when `alsoTrust` (a hex pubkey) is set, the trust predicate returns true for it unconditionally
  (`isAsserterTrusted = pk => baseTrusted(pk) || pk === alsoTrust`). Add
  `handleTagApplicability(req,res)`: validate `type∈{pubkey,event}` (400 else); `viewer =` hex
  `req.query.viewerPubkey` (optional); `usageRows = await computeTagUsageRows({ wotPov:'house', alsoTrust: viewer })`;
  `hintEls = scan {kinds:[39999], '#z':[type==='event'?TAG_FOR_NOSTR_EVENT_Z:TAG_FOR_NOSTR_PUBKEY_Z]}`;
  `members = buildMembers(usageRows, hintEls, type==='pubkey'?'profile':'event')` (require both from
  their modules); return `{success, type, source:'live', viewerIncluded:!!viewer, members}`. Register
  `app.get('/api/tags/applicability', …)` beside `/api/tags/index` (`src/api/index.js:557`). Public.
- **`ui/src/hooks/useTagApplicability.js`** — fetch BOTH `?type=event` and `?type=pubkey`
  (viewer-inclusive) in parallel; return `{ applicableKeys, contextsByKey, loading }`:
  `applicableKeys` = the current `type`'s ordered `authorPubkey:slug`; `contextsByKey[key] =
  { people: pubkeyList.has(key), content: eventList.has(key) }` over the union of both lists. Abort
  on unmount.
- **`ui/src/components/AddTagDialog.jsx`** — accept `applicableKeys` + `contextsByKey`.
  - **Browse (no query):** candidates whose key ∈ `applicableKeys`, ordered; `.slice(0,20)`.
  - **Search (query):** filter **within** `applicableKeys` (scoped) by name/slug/description.
  - **Other results:** `otherHits` = candidates matching the query whose key ∉ `applicableKeys`
    (prioritize an exact `slug === query` match). If `otherHits.length`, render a **"Show other
    results (N)"** button (`useState` expanded flag) that lists them below the scoped results.
  - **Row hint:** for each shown tag, render a small context label from `contextsByKey[key]`
    (people / content / both) so a cross-context pick is knowing.
  - Absent/empty `applicableKeys` ⇒ browse falls back to the full list (never blank).
- **`ProfileTagsSection.jsx` / `NoteTags.jsx`** — `useTagApplicability('pubkey'|'event', viewer)`;
  pass `applicableKeys` + `contextsByKey` to `<AddTagDialog>`.
- **Scheduler** — `taskRegistry.json` `refreshApplicabilityLists` (copy `refreshPinnedTagTLs`, no
  `resourceClass`); `src/algos/refreshApplicabilityLists.sh` (copy `refreshPinnedTagTLs.sh`, curl
  `…/refresh-applicability-lists`); disabled seed in `scheduled-tasks` `freshInstallEntries`.

### Testability
- **Server behavioral** (executes the module, injected deps): `computeTagUsageRows` `alsoTrust`
  includes the viewer's own untrusted taggings; `handleTagApplicability` (or an extracted pure
  `applicabilityMembers({usageRows,hintEls,type})`) → HINT ∪ USAGE union, type→byType mapping, viewer
  inclusion, ordering, `type` 400. `buildMembers` reuse asserted (one union definition).
- **Client sentinels:** the hook fetches the typed+viewer endpoint; AddTagDialog browse filters to
  `applicableKeys`, and the query branch still searches the whole `availableTags`; the two mounts pass
  their type + viewer.
- **Scheduler:** registry entry valid (`isRegisteredTask`); the `.sh` curls the loopback endpoint.
- **cycle-local smoke:** tag a note → only event-context tags in browse; search `funny` (a pubkey tag)
  → it appears → apply → reopen → `funny` now in the event browse (graduated); no re-mint.

## Out of scope
- Story 3 (same-slug create warning); OPEN #16 (event-id read hardening); the target-selector modals;
  a deliberate cross-context *browse* mode ("choose a tag out of field" — advanced, later); changing
  the `available-tags` source or the write paths.

## Open questions
None — browse-filter + search-all escape, live + viewer-inclusive compute, and the two-context scope
were operator-resolved 2026-07-06.
