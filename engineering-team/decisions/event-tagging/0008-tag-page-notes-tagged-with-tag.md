# ADR 0008: Tag detail page — notes tagged with this tag

**Status:** Accepted
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/8-tag-page-notes-tagged-with-tag.md`

## Context

Story 8 adds a **notes view** to the tag detail page (`ui/src/pages/Tag.jsx`), which today shows only **profiles** (pubkey-taggings, via `/api/profile-tags/profiles-tagged`). The data to do this exists, but the read it needs — "which kind-1 notes carry this tag" — was **not** built by Story 4 (which built `for-event` = tags *on* a note, and `headers-for-tag`). This is the **reverse / forward-discovery** direction.

Facts that shape the design:

- **The forward-discovery primitive exists in the core.** `filterTaggingsUsingTag({ headerAuthorPubkey, slug })` (`src/lib/event-tagging/filters.js:17`) returns `{ kinds:[39999], '#z':[taggingHeaderAddr(headerAuthorPubkey, slug)] }` — all taggings referencing *one* header's coordinate. A tag can have **multiple** per-tag headers (any author may mint one), so "notes tagged with this tag" is a **union across the tag's legitimate headers**, discovered exactly as `headers-for-tag` already does (`handleHeadersForTag`, `src/api/event-tags/index.js:156` — scans `filterTaggingHeadersForTag` per honored authority).
- **The existing classifier groups by the wrong key.** `classifyEventTaggings` (`classify.js:57`) groups candidates **by tag** and discards the target (its entries keep `eventId`/`authorPubkey`/`polarity`, not the `e`/`a` the assertion points at). For this story the tag is **fixed** and we must group **by target note** — so the classifier can't be reused as-is for the grouping, though its per-candidate gating discipline (descriptor → header resolvable → honored authority → tag identity → polarity → trust; viewer → `mine`) is exactly what we want.
- **Note rendering is already a solved, server-side concern.** The feed/event/per-user-notes read paths fetch kind-1 events from the **general-purpose relay set** (`resolveGeneralPurposeRelays` + `querySync`) and turn them into NoteCard-ready items via `enrichNotes(notes, scanStrfry)` (`src/api/_shared/noteEnrichment.js:79`). The notes view needs the same: resolve target note ids → fetch those kind-1 events → enrich. (Confirmed in Story-6 testing: note bodies live on external relays, not local strfry; only the *taggings* are local.)
- **The viewer's own stance must survive POV (AC-3/-4).** This is the by-tag analogue of Story 7: a note the viewer tagged must appear even when the POV doesn't trust the viewer. Same principle — a `mine` channel, here grouped by target.
- **Operator note:** UI portions will likely **skip automated tests**. So the design must put the **risky logic in a pure, cheaply-testable core function** (the target grouping + POV + `mine`), keeping the untestable surface (relay I/O, JSX) thin — mirroring how Stories 4/7 isolated `classifyEventTaggings`.

Concept Graph reachable (`:8877`); no concept/firmware change → no reinstall.

## Options considered

### Where the "group taggings by target" logic lives

**Option A — a new pure core function `groupTaggingsByTarget`, sibling to `classifyEventTaggings` (recommended).** Same inputs (`candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey`) plus the fixed `tag` identity; returns targets grouped with apply/dispute entries + a `mine` set. Pure, dependency-free, CJS-testable with synthetic fixtures, SDK-extractable, covered by the existing core purity guard.
- **Pros:** The bug-prone logic (per-target grouping, multi-header union, POV filter, `mine`) is unit-testable without a stack — which is exactly what lets us *skip* UI tests safely. Reuses the gating discipline of the existing classifier.
- **Cons:** A second classifier-shaped function in the core (shared gate helpers can be factored to avoid drift).

**Option B — group inline in the handler.** Rejected: re-implements the classifier's gating outside the core (drift — the very thing the core exists to prevent), and is untestable without the live stack.

### How target notes are fetched + rendered

**Option C — the endpoint resolves target ids, fetches the kind-1 notes from the relay set, and returns enriched NoteCard items (recommended).** Mirrors the feed/event read paths exactly (`resolveGeneralPurposeRelays` + `querySync({kinds:[1], ids})` + `enrichNotes`). One relay query for all ids.
- **Pros:** Reuses the proven note-read machinery; the UI just renders `NoteCard`s (which then attach the Story-6 affordance per note). One round trip.
- **Cons:** Couples the endpoint to the relay-fetch path (acceptable — it's the established pattern; injected deps keep the pure parts testable).

**Option D — return only target ids; the UI fetches each note via `/api/event`.** Rejected: N requests, and re-invents enrichment client-side.

### Endpoint shape

**Option E — one new read `GET /api/event-tags/for-tag` (recommended).** Symmetric with `for-event`: `for-event` = tags on an event; `for-tag` = notes for a tag. Params: `tagAuthor` + `slug` (tag identity), optional `viewerPubkey`, optional `authorities`, POV params (`wotPov`/`userPubkey`) — same conventions as `for-event`.

## Decision

**A + C + E.** A new pure `groupTaggingsByTarget` in the event-tagging core does the per-target grouping (POV-filtered counted set + trust-unfiltered `mine`), unioning taggings across **all** the tag's honored/legitimate headers. A new `GET /api/event-tags/for-tag` handler composes the existing pieces — discover headers → scan taggings per header → group by target → fetch + `enrichNotes` the target kind-1 notes from the relay set — and returns NoteCard-ready items (the union of POV-counted and `mine`), with per-note apply/dispute counts for curation. `Tag.jsx` gains a **Notes** view (toggle alongside Profiles) that calls the endpoint and renders each note via the shared `NoteCard` (which carries the Story-6 affordance for free).

Resolved open questions:
- **Q1 (multi-header union):** "tagged with this tag" = taggings referencing **any** legitimate header for the tag, across all **honored authorities** (default canonical + runtime TA, overridable via `authorities` — same sovereignty model as `for-event`/`headers-for-tag`). Discovered via the existing `filterTaggingHeadersForTag` scan, then `filterTaggingsUsingTag` per discovered header, unioned + `dedupeReplaceable`.
- **Q2 (ordering):** default order is **note recency** (notes are time-oriented), with the per-note apply/dispute counts returned so a "most-tagged" sort can be added later; finer curation is a design detail, not fixed here.
- **Q3 (placement):** a **Profiles | Notes** view toggle on `Tag.jsx`, reusing the page's existing view-control pattern — design picks the exact control.
- **Q4 (disputed notes) + addressable targets:** the view scopes to **`e`-targeted kind-1 notes** (the epic's UI scope); a note net-disputed by the POV follows the same default as the counted set (apply-positive shown; mirror the profiles view's curation where it fits). `a`-addressable targets are out of scope for the view.

## Consequences

- **Enables** the tag page to show notes, closing the loop from Story-6 testing; each rendered note inherits the Story-6 tagging affordance with no extra work.
- **Testable seam preserved:** `groupTaggingsByTarget` is pure → the per-AC read logic (grouping, multi-header union, POV filter, `mine`) is unit-testable with no stack, so the UI can skip automated tests with low risk. The handler's relay-fetch/enrich is verified by a skip-gated HTTP smoke + manual browser, like the other note read paths.
- **No change to Stories 4–7 surfaces** — `for-event`, `headers-for-tag`, the write hook, and the note-surface affordance are consumed/reused, not modified. The profiles view is untouched.
- **Per-tag fan-out** is one endpoint call per tag-page view (not per note) — much lighter than the note-surface case.
- **Local-only invariant** is unaffected — this is a read; any tagging from a rendered note goes through the existing guarded write path.
- **Follow-up:** addressable (`a`) targets in the notes view; richer curation/sort; possibly sharing the by-tag `mine` logic with the `for-event` one if a common helper emerges.
- **Firmware reinstall?** No.

## Implementation notes

- **Core — `src/lib/event-tagging/classify.js` (new export `groupTaggingsByTarget`)**, pure:
  - Signature `groupTaggingsByTarget({ candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey, tag })` where `tag = { authorPubkey, slug }`.
  - Per candidate: resolve descriptor → header (from `headers`) → header honored (joins an honored `tagging-with-specific-tag`) → header names **this** `tag` (its `a` = `39999:<tag.authorPubkey>:<tag.slug>`) → polarity bucket. Extract the **target** from the candidate's `e` (id) / `a` (address). Group by target. Counted set applies `isAsserterTrusted`; if `c.pubkey === viewerPubkey`, also record the target in `mine` regardless of trust (latest-wins per target). Returns `{ targets: [{ target:{id?|address?}, applications:[…], disputes:[…] }], mine: [{ target, stance, eventId, createdAt }] }`. Stays within the core purity guard (no I/O).
  - Factor the shared per-candidate gates with `classifyEventTaggings` where clean (avoid two drifting copies of the legitimacy logic).
- **Server — `src/api/event-tags/index.js` (new `handleForTag`, route `GET /api/event-tags/for-tag`)**:
  - Validate `tagAuthor` (hex) + `slug`; resolve `authorities` (reuse `resolveAuthorities`) and `viewerPubkey` (reuse the `isHexPubkey` guard).
  - Discover headers: for each authority, `strfryScan(core.filterTaggingHeadersForTag({ tagAuthorPubkey: tagAuthor, slug, taPubkey: authority }))`; `dedupeReplaceable` (this is the same logic as `handleHeadersForTag` — extract a shared helper).
  - For each discovered header, `strfryScan(core.filterTaggingsUsingTag({ headerAuthorPubkey: header.pubkey, slug }))`; union + `dedupeReplaceable` → candidates.
  - `buildTrustPredicate` (reuse) → `groupTaggingsByTarget({ …, tag:{ authorPubkey: tagAuthor, slug } })`.
  - Resolve target note ids (the `e` targets) = union of counted targets + `mine` targets; fetch `querySync(relays, { kinds:[1], ids })` via `resolveGeneralPurposeRelays` (reuse the feed/event read-path deps; inject `querySync`/`scanStrfry`/`runCypher` so the pure parts stay testable); `enrichNotes(events, scanStrfry)`.
  - Respond `{ success, tagAuthor, slug, authorities, povSuffix, minRank, notes: [ enrichedItem + { applications, disputes, mine } ], mine }`. Order by note `createdAt` desc (Q2 default).
  - Register the route in `src/api/index.js` alongside the other `/api/event-tags/*` routes.
- **UI — `ui/src/pages/Tag.jsx`**: add a **Notes** view (toggle alongside the existing Profiles view; reuse `TagViewControls`/page conventions). A small read hook fetches `/api/event-tags/for-tag?tagAuthor=…&slug=…&viewerPubkey=…` and renders each returned item via the shared `NoteCard` (which attaches the Story-6 affordance). Empty state when `notes` is empty. *(Per the operator: UI portions are not automatically tested — source-contract + manual browser verification on the local stack.)*

## Out of scope

- **The profiles view** and all its controls — untouched.
- **The note-surface affordance** (Story 6) and the single-note own-stance read (Story 7) — reused, not modified.
- **Addressable (`a`) targets, richer curation/sort, pinning notes, ranking** — follow-ups.
- **External publishing** — local-only invariant holds.
