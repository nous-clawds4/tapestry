# ADR 0001: Event Index's item format — directory entries as kind-39999 items, events as Method 3 self-listings on a proposed Events header

**Status:** Accepted (NosFabrica, 2026-10-15)
**Date:** 2026-10-15
**Story:** none: docs lane (Protocol-Spec workflow, docs-mode), recorded in the intake entry of 2026-10-15, "Event Index". Design record: `docs/EVENT_INDEX_DESIGN_HANDOFF.md`.

## Context

Event Index is an open directory of public iCalendar feeds that mirrors each listed calendar's events into nostr as NIP-52 calendar events, one custodial key per calendar (handoff § 1). Two things have to be listed:

1. **The calendars.** The directory is the commons, and it is a DList, not a database a DList mirrors. A calendar feed has no nostr event of its own to point at.
2. **The events.** Each projected event is a NIP-52 kind `31923` (or `31922`) signed by its calendar's key. It already exists as a nostr event of a known kind.

What the surrounding specs and code say:

- **[DList Cross-NIP Compatibility](../../../protocols/drafts/decentralized-lists-compat.md)** (🧪 publish-ready) gives three ways to list a foreign kind: Method 1 (native items with no reference), Method 2 (a curator's kind-`39999` item with an `a` to the foreign event), Method 3 (the foreign event carries a `z` to the header; the header declares the kind with `item-kind`). Method 3 needs the event's author to cooperate, and requires that the foreign NIP not use `z` already; NIP-52 doesn't.
- **[Content Categories](../../../protocols/drafts/content-categories.md)** § 1: a NIP kind is already an "old-school DList", the kind playing the part of `z`. Divine's videos (kind `34236`) reached Brainstorm that way: through per-kind views, with no list items (Brainstorm-UI PRs #211, #219, #220).
- **Brainstorm-UI today** (`staging`, 2026-10-15): `isDListItem` accepts kinds `39999` and `9999` only, and nothing reads `item-kind`. A `31923` that carries a `z` opens as an event, never as a list item. Brainstorm already searches and draws `31922`, `31923` and `31924` through its search relay and per-kind views.
- **Relays:** `wss://dcosl.brainstorm.world` stores only kinds `9998`, `9999`, `39998`, `39999` and `7`. The search relay already indexes the NIP-52 kinds.
- **This repo's code** reads list items of kinds `9999` and `39999` only (`ITEM_KINDS` in `src/api/dlist-curation/update.js`); curation copies name an original by address only when it is a kind `39999` (`itemRef` in `src/api/dlist-curation/updateEvents.js`).

## Options considered

### Option A — Method 2: a curator item per event

The index key publishes a kind-`39999` item under an Events header for every projected event, each with an `a` to the `31923`.

- **For:** Brainstorm's list pages would show the items today, since they are `39999`s.
- **Against:** it doubles every event (a second event per projection, republished and deleted in step with it); it puts the index key's voice ("I include this") where the calendar's own claim would do; and copying events that already exist on nostr gains little and costs upkeep. dcosl would take the items but not the events they point at.

### Option B — Method 3, and keep the Events header

Each projection carries `["z", "39998:<header key>:events"]`; the Events header declares `item-kind` `31923` and `31922` and the tier-two declarations (title, start, end, location, summary, image, `g`, `r`, `t`, with `date` hints pending worksheet W30/W31). The directory itself uses ordinary kind-`39999` entries (Method 1), because a calendar feed has nothing on nostr to point at.

- **For:** one tag per event and no second event; the claim is the calendar's own ("I claim to be on this list"); any DList client that implements Method 3 lists the events; anyone else can self-list a native NIP-52 event the same way, and readers weigh that per point of view.
- **Against:** Brainstorm lists no items under the header until it reads `item-kind` and Method 3; the items live on relays other than the one that holds the header (dcosl won't take `31923`s).

### Option C — No list: events by kind only

The projections carry no `z`; the Events list doesn't exist. Clients read events by kind, as Content Categories already allows.

- **For:** nothing to maintain; matches how Brainstorm reaches the events today.
- **Against:** no list-level declarations anywhere, so a schema-driven renderer has nothing to draw from; no way to tell "an event this index mirrored" from any other `31923` except by checking the author against the directory. Worksheet W34 (tier two for a bare kind) is the general fix, and it doesn't exist yet.

## Decision

We chose **Option B**: directory entries are kind-`39999` items under *Event Calendars*, and events list themselves on *Events* by Method 3, because it costs one tag per event, gives Method 3 clients the list today, and carries the declarations a schema-driven renderer needs once a client reads them. Native NIP-52 events already published by others are read by their kind and never copied into curator items.

**Who signs what.** The two list headers follow NosFabrica's standard for DLists: a maintainer's key signs them, through List Management like any other header. The index key is the directory's curator: it signs the kind-`39999` entries the index files, and no header. Calendar keys sign the events. *Event Calendars* is published; the *Events* header is proposed and not yet published (whether to publish it is open, event-index open question 9), and until it is, projections carry no `z`.

Sub-decisions, all normative in [protocols/drafts/event-index.md](../../../protocols/drafts/event-index.md):

1. **An entry's `d` is the calendar's stable platform identity** (`luma:cal-…`, `meetup:<urlname>`, …; else `ics:` + the hash of the canonical feed URL), never the feed URL. A native NIP-52 calendar's entry uses `nostr:` + its `31924` address. (§ 2.2)
2. **Retiring an entry is `["removed", "<reason>"]`** on a republished entry, the convention Brainstorm-UI's Dictionary code already reads, not a kind `5`: a deleted entry vanishes instead of reading as removed, and dcosl honors deletion by event id only. (§ 2.3)
3. **A projection's `d` is the SHA-256 of its `UID`**, or of `UID` + `:` + the occurrence's original start for one occurrence of a recurring event, so an override that moves an occurrence replaces it rather than adding one. (§ 4.2)
4. **Copies yield to originals by address.** The curation-copy `q` rule ([Assistant Designation](../../../protocols/drafts/assistant-designation.md) § Curation copies) named only kind-`39999` originals by address; it now names every addressable original that way, and a projection that duplicates someone's native NIP-52 event names it with the same `q` form (§ 9). No shipped behavior changes: this repo's curation reads only kinds `9999` and `39999`. The widening names originals; it doesn't settle which tags a copy of a foreign-kind original carries (below, Debt).

**Show and Tell.** A calendar key re-presents a feed its organizer published for their own attendees' calendars: a reuse, so the reuse hazard's three questions apply ([design-philosophies/show-and-tell.md](../../../design-philosophies/show-and-tell.md) § The reuse hazard). *Do they know?* The key's kind 0 says it is a mirror, by whom, and links the organizer to the calendar's page (§ 5.2). *Can they control it?* They can have it removed, a path that ships in the index's first phase, and later claim it (§§ 7–8). *Would they endorse the reading?* The listing claims only "these are this calendar's public events", with the platform named; it never presents the organizer as being on nostr by choice. The directory entry itself is a Tell: the index's deliberate statement that the calendar exists.

## Consequences

- **Enables:** Method 3 DList clients list every projected event with no extra events; NIP-52 clients see ordinary calendar events whose host is the calendar; a second index, or anyone, can file entries and self-list events under their own keys.
- **Constrains:** Brainstorm shows no items under the Events header until it reads `item-kind` and Method 3, or W34 lands. The Events concept should not be filed on Brainstorm's Dictionary before then: an empty list whose name contains "event" would take every search for "event".
- **Constrains:** the proposed Events header leaves out the `date` display role (W31) until Brainstorm-UI's List Management, which signs headers and drops display roles it doesn't know, knows it.
- **Debt:** the `q` rule's widening is written in the spec but not in code: when Tapestry's curation reads `item-kind`-declared kinds, `itemRef` must name any addressable original by address, not only kind `39999` (recorded in the intake entry).
- **Debt:** the curation-copy carry rule (Assistant Designation § Curation copies, What it carries) was written for DList items. For a foreign-kind original such as a NIP-52 event it would carry `p` and `t` as item tags and drop `start`, which the Events header requires. Before any curator copies foreign kinds, the carry rule needs a foreign-kind case.
- **Debt:** the `removed` convention is defined for directory entries only; whether it belongs in the DList NIP for every kind-`39999` item is open (event-index open question 6).
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

Docs-mode: the "implementation" is the spec edits.

- New: `protocols/drafts/event-index.md` (📝 pre-NIP), with a row in `protocols/README.md`'s spec index.
- `protocols/drafts/decentralized-lists-compat.md` § "Extending to other NIPs": a two-sentence example pointing at Event Index (the draft is 🧪 publish-ready, so nothing else changes there).
- `protocols/drafts/assistant-designation.md` § Curation copies: "kind-`39999` original" becomes "addressable original" in the `d`, Pointing back, and When the original changes paragraphs; Sources gains this ADR.
- `protocols/worksheet.md`: W30 (`date` value type), W31 (date display roles), W32 (host role word), W33 (trust through directory membership), W34 (tier two for a bare kind).
- `protocols/upstream/nip-52-cancellation.md`: the cancellation proposal (event-index § 4.6).
- No code. No test-file changes.

## Out of scope

- The index's internals: the iCalendar profile, platform adapters, its database and HTTP API (the Event Index repository's `spec/`).
- How Brainstorm renders index events (Brainstorm-UI's own issue and PRs).
- Guest custody (ADR 0002).
