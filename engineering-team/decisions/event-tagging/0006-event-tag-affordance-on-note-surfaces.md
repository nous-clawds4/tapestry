# ADR 0006: Event-tag affordance on note surfaces

**Status:** Accepted — prerequisite (Story 7) shipped; see "Dependency (RESOLVED)" below
**Date:** 2026-06-30
**Story:** `engineering-team/stories/event-tagging/6-event-tag-affordance-on-note-surfaces.md`

> **Dependency — RESOLVED 2026-06-30.** A POV-first gap surfaced during architecture: `for-event` (`src/api/event-tags/index.js`) POV-trust-filters every asserter with **no carve-out for the viewer**, so a logged-in viewer whom the house POV doesn't rank ≥ `minRank` would NOT see their own just-applied tag after a reload (it would vanish — optimistic UI masks it only until refetch). Per the story's scope rule, the operator **kicked back** to a small **Story 7** that added a durable, trust-unfiltered **`mine`** channel (ADR 0007; impl `db752c9c`, review PASS `ce413761`). The `mine` response shape is now **concrete**: `for-event?eventId=…&viewerPubkey=<hex>` returns `mine: [{ tag:{authorPubkey,slug}, stance:'apply'|'dispute', eventId, createdAt }]`. The implementation notes below (the `useEventTags` `mine` field) now bind to that shape. Story 6 proceeds.

## Context

Story 6 is the UI face of the epic: put the apply/dispute + add-existing + create-new tagging affordance onto every kind-1 note surface, displaying a note's counted tags POV-aware, while changing **neither** the Story-4 read API nor the Story-5 write hook.

Facts that shape the design:

- **One shared note unit already exists and anticipates this.** Every note surface — the live feed (`ui/src/pages/BrainstormFeed.jsx:92`), the single-event page (`BrainstormEvent.jsx:136`), a user's notes list (`BrainstormUserNotes.jsx:109`), and the profile content section (`ProfileContentSection.jsx:50`) — renders through `ui/src/components/NoteCard.jsx`. Its own docstring says: *"Future per-note improvements (reposts, reply indicator, event tags) belong HERE so every location gets them at once."* So a single integration point in `NoteCard` lights up all surfaces.
- **There is already a stub entry point.** `ui/src/components/NoteActionsMenu.jsx` renders a *"Tag Event"* menu item that currently flashes *"not yet supported"* — the placeholder this story makes real.
- **A complete, proven precedent exists — profile (pubkey) tagging.** `ui/src/components/ProfileTagsSection.jsx` orchestrates a chip row + add/search/create dialog over `useProfileTags`, reusing two **already-generic** components:
  - `TagChip` (`ui/src/components/TagChip.jsx`) — renders a tag chip with an apply/dispute popover and asserter avatars; its only structural coupling to profile-tags is `tag.eventId` (used for a DOM id, `:46`) and `applications/disputes[].authorPubkey` + `viewerPubkey`.
  - `AddTagDialog` (`ui/src/components/AddTagDialog.jsx`) — search-existing (over `availableTags`) + create-new; fully generic via `onSelectExisting(tag)` / `onCreateNew({name,description})`.
- **The read + write contracts are fixed and sufficient (Stories 4 & 5):**
  - Read: `GET /api/event-tags/for-event?eventId=<hex>` returns `{ tags: [{ tag:{authorPubkey,slug}, applications:[{authorPubkey,…}], disputes:[…] }], unverifiable, … }`, **already POV-filtered server-side**. Tag *display names* are not in this response — they come from the **shared** `GET /api/profile-tags/available-tags` → `{ tags:[{ eventId, slug, name, description, authorPubkey }] }` (Story 4 explicitly reuses this for "available tags"). Joining the two on `(authorPubkey, slug)` yields both the `name` and the `eventId` that `TagChip` wants.
  - Write: the Story-5 hook `useEventTagging()` (`ui/src/hooks/useEventTagging.js`) exposes `applyTag(tagInput, target)` / `disputeTag(tagInput, target)` where `tagInput = {name,description}` (new) or `{authorPubkey,slug}` (existing) and `target = {id}` (a kind-1 note). It decides the 1/2/3-publish sequence, publishes through the **guarded** `publishOrThrow` (local-only invariant inherited), and returns `{ sequence, published, failedAt? }`.
- **Viewer identity is client-side.** The profile page sources the viewer from `useAuth()` → `user.pubkey` (`BrainstormProfile.jsx:57,344`); `user = { pubkey, classification, profile }`. This is the correct identity source (per the project's "logged-in identity ≠ WoT-sync data" rule) and is available from any component via the context — no `NoteCard` prop-threading needed.
- **PO resolutions (story):** display the **counted** set only (unverifiable taggings deferred — logged in `_intake.md`); ship display + all three write interactions together (no phasing).

No concept/firmware change → no reinstall.

## Options considered

### Where the affordance is wired

**Option A — One `NoteTags` unit rendered inside the shared `NoteCard` (recommended).** A new `ui/src/components/NoteTags.jsx` (analog of `ProfileTagsSection`) owns the whole event-tag UI for one note; `NoteCard` renders `<NoteTags item={item} />`. Every surface inherits it at once.
- **Pros:** Single integration point — matches `NoteCard`'s stated design intent; impossible to "miss a surface"; no per-page wiring. Satisfies the "present on every surface" AC structurally.
- **Cons:** Couples display to `NoteCard` mounting (see read-strategy options below).

**Option B — Wire each note page separately.** Rejected: four call sites to keep in sync, drift-prone, and re-introduces exactly the per-surface divergence `NoteCard` exists to prevent.

### Reuse vs. fork the chip/dialog components

**Option C — Reuse `TagChip` + `AddTagDialog` via a thin adapter; new `NoteTags` + a new `useEventTags` read hook; writes via the existing `useEventTagging` (recommended).** The read hook enriches each counted tag `{authorPubkey,slug}` with `name`+`eventId` from `available-tags`, producing the shape the reused components already expect. Chip apply/dispute → `useEventTagging.applyTag/disputeTag({authorPubkey,slug}, {id})`; dialog select/create → the same with `{authorPubkey,slug}` / `{name,description}`.
- **Pros:** Maximum reuse; the new surface looks/behaves like the proven profile precedent; new code is thin (one read hook + one section component + an adapter).
- **Cons:** A small impedance-match — event-tags identify by the `(authorPubkey, slug)` coordinate, profile-tags by `tagEventId`; the adapter must supply a stable `eventId`-shaped key (the real tag-element `eventId` from the `available-tags` join, or a synthesized coordinate fallback when a counted tag isn't in `available-tags`).

**Option D — Fork note-specific `NoteTagChip` / `NoteAddTagDialog`.** Rejected: duplicates two non-trivial components for a cosmetic identity difference; drift risk; more to test.

**Option E — Generalize the profile components into shared generics first.** Rejected for v1: larger blast radius (touches the working profile feature), over-engineering before a second consumer's needs are known. The reuse-with-adapter path already shares the components; a later refactor can extract generics if a third consumer appears.

### How a note's tags are read (display-on-render is required by AC-1)

**Option F — Per-note `for-event` fetch on mount, enriched via `available-tags` (recommended).** `useEventTags(target, viewerPubkey)` fetches when a `NoteCard` mounts; `available-tags` is fetched once and cached/shared.
- **Pros:** Uses the Story-4 endpoint as-is; correct POV filtering is server-side; the hook is the single seam a future batch endpoint can replace without touching the UI.
- **Cons:** A feed of N notes issues N `for-event` requests. Mitigated by: the feature is new (most notes have **zero** event-tags today, so each call returns an empty set quickly), React only mounts visible cards, and `available-tags` is fetched once. Accept for v1; log a **batch-read** follow-up.

**Option G — Batch endpoint now.** Rejected: a Story-4 read-API change, explicitly out of scope for this story.

**Option H — Lazy (fetch only when the affordance is opened).** Rejected: AC-1 requires tags to be *visible on render*, not behind an interaction.

## Decision

**A + C + F.** A single `NoteTags` unit inside the shared `NoteCard`; reuse `TagChip` + `AddTagDialog` through a thin adapter fed by a new `useEventTags` read hook; writes via the existing `useEventTagging` (Story 5). Read each note's tags per-note via `for-event` on mount, enriching names/`eventId` from the shared `available-tags`; the hook is the seam for a future batch read.

Supporting decisions:
- **Viewer identity** comes from `useAuth()` inside `NoteTags` — no `NoteCard` signature change. Logged-out / no `user.pubkey` → tags still display, but apply/dispute/add/create are disabled (and the write hook independently throws a clear NIP-07 error if a signer is somehow absent, so nothing can publish).
- **The viewer's own stance is read durably from a `mine` channel (Story 7), not just optimistically.** Because `for-event`'s `tags` are POV-trust-filtered, they may not echo the viewer's *own* assertion if the POV doesn't trust them — so relying on optimism alone would make a just-applied tag *vanish on reload*. `NoteTags` therefore renders the viewer's own stance from `for-event`'s **`mine`** set (the viewer's assertions on this note, returned **unfiltered by trust** — added by Story 7), shown distinctly from the POV-counted `tags` ("you applied X — not yet counted in this view"). Optimistic update on write + `refetch()` remains, but only as a **latency nicety** on top of a durable read — correct across reload/navigation.
- **Partial failure** (`failedAt` from the write hook) surfaces as a retry-able error on the section; a retry re-invokes the same call (replaceable addresses → no duplicates).
- **The `NoteActionsMenu` "Tag Event" stub is retired** — its job moves into `NoteTags` (which owns its own add entry point). The dead "not yet supported" item is removed to avoid two competing entry points.

## Consequences

- **Enables** the full event-tagging feature to appear on all four note surfaces from one component, mirroring the profile-tagging UX, with no read-API/write-hook changes.
- **Local-only by construction:** every write goes through `useEventTagging` → guarded `publishOrThrow`; this ADR adds **no** new publish path. The Reviewer must reject any direct `publishEverywhere`/`PUBLISH_RELAYS` reach.
- **Per-note read fan-out** in feeds (Option F cons). Accepted for v1; **follow-up:** a batch `for-events` read to collapse N requests — log in `engineering-team/stories/_intake.md`. The `useEventTags` hook is the swap-seam.
- **Deferred (already logged):** surfacing the `unverifiable` bucket — `NoteTags` consumes only `tags` (counted) in v1.
- **Reuse coupling:** `TagChip`/`AddTagDialog` are now shared by two features; a change to their props must consider both call sites (noted on the components is optional). No generic extraction yet (Option E deferred).
- **Blocked on Story 7.** This UI cannot be correct (durable viewer stance) until `for-event` gains the `mine` channel. Story 6's Test Design/Implementation should not start until Story 7 lands. The UI design here is otherwise unaffected.
- **Firmware reinstall required?** No (no concept/firmware change).

## Implementation notes

Concrete module boundaries (the Implementer wires these; exact placement/markup density within the card is a design call — story Open Q1):

- **New read hook — `ui/src/hooks/useEventTags.js`** (analog of the read side of `useProfileTags`):
  - Signature `useEventTags(target, viewerPubkey)` where `target = { id }` for a kind-1 note (`item.id`).
  - Fetches `GET /api/event-tags/for-event?eventId=<target.id>` (pass viewer context so the server resolves the POV trust predicate, mirroring how `useProfileTags`/profile-tags reads pass the viewer). Fetches `GET /api/profile-tags/available-tags` once (cache/share) and joins on `(authorPubkey, slug)` to attach `name`, `description`, and `eventId` to each counted tag.
  - Returns `{ tags, mine, loading, error, refetch }` where each `tag = { eventId, authorPubkey, slug, name, description, applications, disputes }` (the shape `TagChip` consumes). `eventId` falls back to a synthesized `${authorPubkey}:${slug}` key if the tag is absent from `available-tags`. `mine` = the viewer's own stance per tag (apply/dispute), from `for-event`'s `mine` channel (Story 7) — durable and trust-unfiltered, so a tag the viewer applied is shown even when the POV doesn't (yet) count it.
  - Consumes the `tags` (counted) + `mine` (viewer's own) fields; ignores `unverifiable` (deferred).
- **New component — `ui/src/components/NoteTags.jsx`** (analog of `ProfileTagsSection.jsx`):
  - `const { user } = useAuth();` → `viewerPubkey = user?.pubkey`.
  - `const { applyTag, disputeTag } = useEventTagging();` (Story 5) for writes; `useEventTags(item, viewerPubkey)` for reads.
  - Renders the counted tags as reused `<TagChip … onApply onDispute viewerPubkey busy />`, and an add entry point that opens the reused `<AddTagDialog availableTags appliedTagEventIds onSelectExisting onCreateNew />`.
  - Handlers: `onApply(tag) → applyTag({authorPubkey:tag.authorPubkey, slug:tag.slug}, {id:item.id})`; `onDispute(...)` symmetric; `onSelectExisting(tag) → applyTag({authorPubkey,slug},{id})`; `onCreateNew({name,description}) → applyTag({name,description},{id})`. On success: optimistic stance update + `refetch()`. On `failedAt` (or throw): show a retry-able error banner.
  - Disable write controls when `!viewerPubkey`; tags still render.
- **`ui/src/components/NoteCard.jsx`** — render `<NoteTags item={item} />` in the card body (the docstring-designated home for event tags). No prop changes to `NoteCard`'s public signature.
- **`ui/src/components/NoteActionsMenu.jsx`** — remove the stub *"Tag Event"* menu item (its function is now in `NoteTags`).
- **Reused as-is:** `TagChip.jsx`, `AddTagDialog.jsx`. **Consumed unchanged:** `useEventTagging.js` (Story 5), `/api/event-tags/for-event` + `/api/profile-tags/available-tags` (Story 4 / existing).

## Out of scope

- **The `for-event` `mine`-channel read enhancement** — that is **Story 7** (kicked back to, not built here). The Story-5 write hook stays frozen. Story 6 only *consumes* the `mine` channel once Story 7 ships it.
- **A batch `for-events` read** — logged as a follow-up; v1 fetches per note.
- **Unverifiable-tagging UI** — deferred (logged in `_intake.md`).
- **Pinning event-tags, ranking/scoring, revoke/NIP-09** — epic-level out of scope (polarity flip covers "change my stance").
- **Exact visual placement/density and the search-existing micro-UX** — design/implementation detail (story Open Qs), constrained only to mirror the profile precedent.
