# Event Index (wire format) — Design Handoff

**Status:** ✅ SUPERSEDED (2026-10-15): ratified the same day in docs-mode. **[protocols/drafts/event-index.md](../protocols/drafts/event-index.md) is authoritative**; this file keeps the decisions behind it and the alternatives set aside.
**Created:** 2026-10-15
**Provenance:** NosFabrica design sessions, 2026-10-15. This is the Capture step of the [Protocol-Spec workflow](../engineering-team/workflows/protocol-spec-workflow.md), for the wire format only. The index itself (its storage, HTTP API and operations) is specified in the Event Index repository.

---

## 1. What Event Index is

Event Index is a commons modeled on Podcast Index: an open directory of public iCalendar feeds (Luma, Meetup, Mobilizon, Gancio, Google, any `.ics`). The directory is itself a DList. An indexer polls each listed calendar, keeps every event as normalized iCalendar (the record, RFC 5545), and projects each one as a NIP-52 calendar event signed by **one custodial key per calendar**, so the real organizer shows as host in every nostr client. brainstorm.world is one consumer of the index.

Two requirements shape the wire format: the real organizer must show up, and a visitor who isn't signed in can RSVP and comment with an email address, signed by a custodial guest key that a separate guest service holds.

## 2. Decisions that bind the wire format (NosFabrica, 2026-10-15)

- **The directory of calendars is the commons, and it is a DList**, not a database that a DList mirrors.
- **One custodial key per calendar**, held by the index. Keys are random, never derived, so a claim can hand one over.
- **NIP-52 is the nostr format.** No new event kind; interop with existing NIP-52 clients (Formstr, Flockstr, Coracle).
- **The iCalendar record is the truth.** NIP-52 is a lossy projection of it: a summary and a link on nostr, the full description in the record.
- **Aggregator feeds are discovery only.** Directory entries carry a role, `calendar` or `aggregator`; only calendars get a key and sign events.
- **A calendar's identity is a platform-stable id** when one exists, never its feed URL, which can change.
- **Trust flows through the directory.** A calendar key's standing comes from the directory entry that names it, not from a contact list the index key would have to grow without bound.
- **No destructive surprises.** An event is withdrawn only after it is missing across several polls; an event with RSVPs is republished as cancelled rather than deleted; projections carry no NIP-40 expiration.
- **Feed URLs are public directory data**; private feed URLs (any URL carrying a token, such as iCloud and Outlook shared-calendar links) are refused.
- **Republish only when the projected event changes**, not on `SEQUENCE` or `LAST-MODIFIED`.
- **Removing a calendar ships first; claiming comes later.** Until claims open, the calendar key's kind 0 offers only removal.
- **Kind 0 wording:** platform names as their owners style them, with a line saying the index is not affiliated with the platform.
- **Hidden venues are not published or kept.** When a platform shows the venue only to registered guests, no projection carries a place.
- **Summary-only sources.** For Luma and Meetup, public output is the summary and the link: no full description and no images, and no kind 0 `picture`.
- **List headers follow NosFabrica's standard for DLists:** a maintainer's key signs them through List Management. The Event Index key is the curator that signs the directory entries; calendar keys sign the events.
- **Events are listed by Method 3** (one `z` per event) on a proposed *Events* header, not yet published, and **the `q` rule covers any addressable original**: ADR `event-index/0001`.
- **When an event moves under another calendar's key**, the copy at the old address is deleted, even if it had RSVPs.
- **Guest keys** are labeled as custodial accounts created by email, and are held by a self-hosted Keycast behind a seam of standards: ADR `event-index/0002`.

## 3. Considered and set aside

- **One index key signing every event, with `p` naming the organizer.** A Luma organizer has no pubkey to name, so every client would show the index as host.
- **Aggregator feeds as calendars with their own keys.** Every event found only in a city feed would read as hosted by the city feed.
- **The directory `d` from the feed URL.** Luma moved from `lu.ma` to `luma.com`; every entry would have changed identity.
- **The index key following every calendar key as the trust mechanism.** A kind 3 is one event, and default strfry limits hold about 850 `p` tags. Kept only as an interim bootstrap.
- **NIP-40 expiration after an event ends.** Relays that honor it would drop the event that RSVPs and comments hang from, and past events have value.
- **Deleting a projection on the first poll that misses it.** Feeds flap.
- **Curator copies of native nostr events** (a curator 39999 with `a` per native 31923). Gains little and costs upkeep; native 31923s are read by kind.
- **`SEQUENCE` or `LAST-MODIFIED` as the republish trigger.** Luma's `SEQUENCE` is one number shared by every event, and `DTSTAMP` changes on every fetch.
- **An RSVP `d` of `rsvp:<coordinate>`.** NIP-52 says the client generates a unique `d`, and Brainstorm writes a random one; readers take the newest RSVP per author per event instead.
- **A new event kind**, **an index-specific cancellation tag**, **adopting NIP-52R recurrence labels now**: anything that would amend NIP-52 is proposed upstream instead.

## 4. Where each part landed

- The directory, the `removed` convention, the Events header and Method 3, the projection, calendar keys, RSVP and comment shapes, removing and claiming → [protocols/drafts/event-index.md](../protocols/drafts/event-index.md).
- The Method 3 example → `protocols/drafts/decentralized-lists-compat.md` § "Extending to other NIPs".
- The `q` rule for any addressable original → `protocols/drafts/assistant-designation.md` § Curation copies.
- Open conventions → worksheet W30 (`date` type), W31 (date roles, end time), W32 (host role word), W33 (trust through directory membership), W34 (tier two for a bare kind).
- Cancellation → `protocols/upstream/nip-52-cancellation.md` (not submitted).
- The item format, and guest custody → ADRs `event-index/0001` and `event-index/0002`.
- What is left for this repo → `engineering-team/stories/_intake.md`, entry 2026-10-15 "Event Index".
