# Event Index (wire format) — Design Handoff

**Status:** ✅ SUPERSEDED (2026-10-15; revised 2026-10-16): ratified in docs-mode. **[protocols/drafts/event-index.md](../protocols/drafts/event-index.md) is authoritative**; this file keeps the decisions behind it and the alternatives set aside.
**Created:** 2026-10-15
**Provenance:** NosFabrica design sessions, 2026-10-15 and 2026-10-16. This is the Capture step of the [Protocol-Spec workflow](../engineering-team/workflows/protocol-spec-workflow.md), for the wire format only. The index itself (its storage, HTTP API and operations) is specified in the Event Index repository.

---

## 1. What Event Index is

Event Index is a commons modeled on Podcast Index: an open directory of public event calendars (iCalendar feeds from Luma, Meetup, Mobilizon, Gancio, Google or any `.ics`, and nostr publishers of NIP-52 events). The directory is itself a DList. An indexer polls each listed feed, keeps every event as normalized iCalendar (the record, RFC 5545), and lists each one as a DList item signed by the index's own key, naming the organizer as text. Events that organizers publish on nostr themselves are read by their kind and never copied. brainstorm.world is one consumer of the index.

## 2. Decisions that bind the wire format

Revised by NosFabrica on 2026-10-16; the decisions of 2026-10-15 that the revision replaced are in § 3.

- **The directory of calendars is the commons, and it is a DList**, not a database that a DList mirrors.
- **The index never signs as an organizer.** A profile named after an organizer who never made it reads as impersonation, whatever its description says. There are no custodial calendar keys: ADR `event-index/0003`.
- **Feed events are kind-39999 items signed by the index key**, with NIP-52's field names; `organizer` always, as text; `p` (role `host`) only for the organizer's own verified key; `calendar` naming the calendar's entry; `status` for a cancelled event; a NIP-73 `i` with the event's page as the identifier shared across curators; `d` the index's public event id.
- **Lists split by platform, not by format**: *Luma*, *Meetup*, *Other platforms* (Google, Mobilizon, Gancio, and feeds on their own hosts), and *Nostr* pulled by kind, under a master *Events* list. It starts as one list with a `source` field; the master/child mechanism is specified separately.
- **`source` names where a calendar lives** (`luma`, `meetup`, `google`, `mobilizon`, `gancio`, `nostr`, else the feed's host name), never a format: every feed is iCalendar.
- **Item links come from URL templates** (the source's event page, and the index's `.ics` file), or a `url` for other platforms.
- **Native NIP-52 events are read by kind, never copied or re-signed**, and their publishers are listed in the directory. A list whose items are the events of a kind extends `item-kind`: ADR `event-index/0004`.
- **Duplicates:** a deterministic `d` within one curator, and the shared `i` across curators. An organizer's own event is the original; a mirrored item and an aggregator's copy yield to it.
- **Claims link the organizer's own key**: verify and link, "I publish myself", or "publish for me, as me" through a remote signer. *Event Calendars*' `p` means only a key that publishes the calendar's events or that its organizer has verified, never one the index holds.
- **Items expire 30 days after the event ends** (NIP-40); the record stays in the API.
- **Items, entries and headers go to the index relay, DList relays and search relays only.** RSVP happens at the source's event page.
- **A calendar's identity is a platform-stable id** when one exists, never its feed URL, which can change.
- **Feed URLs are public directory data**; private feed URLs (any URL carrying a token, such as iCloud and Outlook shared-calendar links) are refused.
- **Republish only when the item changes**, not on `SEQUENCE` or `LAST-MODIFIED`; never withdraw on one missed poll.
- **Hidden venues are not published or kept.** When a platform shows the venue only to registered guests, no item carries a place.
- **Summary-only sources.** For Luma and Meetup, public output is the summary and the link: no full description and no images.
- **List headers are signed by a maintainer's key**, through List Management like any other DList header; the index key is the curator that signs entries and items.
- **The `q` rule covers any addressable original.**
- **Guest keys** are labeled as custodial accounts created by email, and are held by a self-hosted Keycast behind a seam of standards: ADR `event-index/0002`.

## 3. Decisions of 2026-10-15 replaced on 2026-10-16

- **One custodial key per calendar**, held by the index, so the organizer would show as host in NIP-52 clients. Replaced by curator-signed items (ADR `event-index/0003`).
- **Trust through the directory** for those calendar keys, with the index key following them as a bootstrap. Not needed for the index's own events, which the index key signs; the question stays open for lists pulled by kind (worksheet W33).
- **NIP-52 as the format of the index's own events**, listed by Method 3 on an *Events* header (ADR `event-index/0001`, superseded). NIP-52 remains the format of native events and of events published for an organizer.
- **No NIP-40 expiration**, and **cancelling rather than deleting an event with RSVPs.** Items carry no nostr RSVPs, so both reasons fell away.
- **Kind 0 wording for calendar keys**, and **claiming by handing over the custodied key.** There are no calendar keys.

## 4. Considered and set aside

- **One custodial key per calendar, with clearer labels.** Readers see the name, not the description; it reads as impersonation.
- **One index key signing NIP-52 events with `p` naming the organizer.** A Luma organizer has no pubkey to name, and NIP-52 clients would show the index as host.
- **No event items, the directory only.** Nostr clients would get no events at all.
- **Aggregator feeds as calendars.** Every event found only in a city feed would read as hosted by the city feed.
- **The directory `d` from the feed URL.** Luma moved from `lu.ma` to `luma.com`; every entry would have changed identity.
- **Curator copies of native nostr events** (a curator 39999 per native 31923). Gains little and costs one event per event; native events are pulled by kind instead.
- **A new header tag, or a content-category item, to declare a list by kind.** A fourth element on `item-kind` degrades safely for old readers and keeps one tag per kind (ADR `event-index/0004`).
- **Splitting the lists by format** (`.ics`, jCal, JSON-LD). These are three ways of serving one record.
- **`ics` as a `source` value, and a source prefix on an item's `d`.** Every feed is iCalendar, so `ics` set nothing apart; a prefix would make addresses long and uneven, and the public id already hashes the calendar's `d`.
- **`SEQUENCE` or `LAST-MODIFIED` as the republish trigger.** Luma's `SEQUENCE` is one number shared by every event, and `DTSTAMP` changes on every fetch.
- **A new event kind**, **an index-specific cancellation tag on NIP-52 events**, **adopting NIP-52R recurrence labels now**: anything that would amend NIP-52 is proposed upstream instead.

## 5. Where each part landed

- The directory, the `removed` convention, the *Events* list and its items, native events, lists pulled by kind, duplicates, removing and claiming, responses → [protocols/drafts/event-index.md](../protocols/drafts/event-index.md).
- The pull-by-kind example → `protocols/drafts/decentralized-lists-compat.md` § "Extending to other NIPs".
- The `q` rule for any addressable original → `protocols/drafts/assistant-designation.md` § Curation copies.
- Open conventions → worksheet W30 (`date` type), W31 (date roles, end time), W32 (host role word), W33 (trust through directory membership, re-scoped); W34 graduated into the draft's § 6.
- Cancellation → `protocols/upstream/nip-52-cancellation.md` (not submitted).
- Decisions → ADRs `event-index/0003` (curator items) and `0004` (lists pulled by kind); `0002` (guest custody, amended); `0001` superseded.
- What is left for this repo → `engineering-team/stories/_intake.md`, entry 2026-10-15 "Event Index".
