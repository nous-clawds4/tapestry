# ADR 0003: Feed events as curator-signed list items; no custodial calendar keys

**Status:** Accepted (NosFabrica, 2026-10-16). Supersedes ADR 0001.
**Date:** 2026-10-16
**Story:** none: docs lane (Protocol-Spec workflow, docs-mode), recorded in the intake entry of 2026-10-15, "Event Index". Design record: `docs/EVENT_INDEX_DESIGN_HANDOFF.md`.

## Context

ADR 0001 kept one custodial nostr key per mirrored calendar: the index signed each feed event as a NIP-52 event with that key, so the organizer would show as host in NIP-52 clients, and the event listed itself on an Events header by Method 3. Running it showed the flaw: a profile named after an organizer who never made it reads as impersonation, whatever its `about` text says, because the name is all most readers see. NIP-52 assumes the signer is the organizer, so a mirror signed in the organizer's name can't avoid the confusion.

What the keys did, and what each needs instead:

- **The organizer shows as host** in NIP-52 clients → the organizer named as text on the item; a profile only for the organizer's own verified key.
- **Nostr RSVPs and comments** on mirrored events → RSVP at the source's event page, where the organizer sees RSVPs anyway.
- **Claiming by taking over the key** → nothing to hand over; the organizer links their own key instead.
- **Showing in NIP-52 calendar clients** → lost. Calendar apps outside nostr still reach the events through the index's `.ics` feeds.
- **Trust per organizer key**, with a follow list the index would have to grow without bound → not needed: every item is signed by the index key, which has standing of its own.

What the surrounding specs say:

- **[Decentralized Lists](../../../protocols/nips/decentralized-lists.md)**: a curator files kind-`39999` items under a header by `z`; this is the standard form, and what Brainstorm draws today (its `isDListItem` accepts kinds `39999` and `9999`).
- **[Content Categories](../../../protocols/drafts/content-categories.md)** § 1: a NIP kind is already a list. Native NIP-52 events don't need copying; ADR 0004 lists them by kind.
- **[Opinionated Views](../../../protocols/drafts/opinionated-views.md)** § 2.1: items with the same subject value count as filings of the same subject, which is what a shared external identifier gives across curators.
- **NIP-73**: `["i", "<URL, normalized, no fragment>"]` with `["k", "web"]` identifies a web page.
- **NIP-40**: an `expiration` lets relays drop an event after a time, and tells readers to ignore it.

## Options considered

### Option A — Keep custodial calendar keys, with clearer labels

Keep signing NIP-52 events per calendar, and make the profile say more plainly that it is a mirror.

- **For:** feed events keep showing in NIP-52 calendar clients, as organizers' events.
- **Against:** the label doesn't fix the problem: readers see the name, not the `about`. And it keeps a vault of keys in other people's names, a follow list that can't scale, and a claim flow that hands keys over.

### Option B — Curator-signed list items

Each feed event becomes a kind-`39999` item signed by the index key, with NIP-52's field names, the organizer as text, and the organizer's key only once verified.

- **For:** the index speaks only as itself; no keys in anyone's name; items are standard DList items any DList client can show; the curator's standing covers every item.
- **Against:** NIP-52 calendar clients don't show items; nostr RSVPs on mirrored events go away (they move to the source).

### Option C — No event items: the directory only

List only calendars; leave events in the index's API and `.ics` feeds.

- **For:** the least on relays.
- **Against:** nostr clients get no events at all, and a schema-driven renderer has nothing to draw.

## Decision

We chose **Option B**: feed events are kind-`39999` items on an *Events* list, signed by the index key as curator, and the index never signs as an organizer. Normative in [protocols/drafts/event-index.md](../../../protocols/drafts/event-index.md) §§ 3–4, 7–9.

Sub-decisions:

1. **Field names copy NIP-52's** (`title`, `start`, `end`, `start_tzid`, `end_tzid`, `location`, `g`, `summary`, `image`), so code that draws NIP-52 events can draw items, and an item maps back to NIP-52 trivially when an organizer asks the index to publish as them. (§ 4.1)
2. **`organizer` is always present, as text; `p` (role `host`) only for the organizer's own verified key.** `calendar` names the calendar's directory entry by address, as a named field rather than an `a` tag, because in a DList item an `a` names the item's subject. (§ 4.1)
3. **`status` `cancelled`** replaces the `Cancelled: ` title prefix on items. (§ 4.7)
4. **A deterministic `d`**: the index's public event id alone (a hash of the calendar's `d`, the event's `UID` and its occurrence), with no source prefix: the calendar's `d` inside the hash already tells calendars apart, and a prefix would make addresses long and uneven. (§ 4.2)
5. **A NIP-73 `i`** holding the event's page URL is the identifier shared across curators: two curators' items with the same `i` are one event. (§§ 4.1, 7)
6. **Items expire 30 days after the event ends** (NIP-40). Items carry no nostr RSVPs, so the earlier reason for no expiration (RSVPs hanging from the event) no longer applies; the record stays in the API. (§ 4.8)
7. **Lists by platform, not by format.** *Events* starts as one list with a `source` field; it is meant to split into child lists by platform (*Luma*, *Meetup*, *Other platforms*, and *Nostr* pulled by kind) under a master list, by a mechanism specified separately. The draft leaves a marked seam for it and does not specify it. (§ 3.2)
8. **Claims link the organizer's own key.** Verify and link (the key becomes `p` on the entry and `host` on every item), "I publish myself", and "publish for me, as me" through a NIP-46 signer limited to kinds `31922`, `31923`, `31924` and `5`. Handing over a key the index holds is gone, since there is none. *Event Calendars*' `p` now means only a key that publishes the calendar's events (an organizer's, or a nostr aggregator's) or that its organizer has verified, never a key the index holds. Because NIP-46 limits a signer by kind only, the index signs a kind `5` only for events it published for the organizer, and a `31924` only with the entry's `d`. (§§ 2.1, 9)
9. **Carried over from ADR 0001:** an entry's `d` is the calendar's stable platform identity; retirement is `["removed", "<reason>"]`; and the `q` rule names any addressable original by its address. ADR 0001's hash of the `UID` becomes the event key inside an item's `d`. (§§ 2.2, 2.3, 4.2, 7)
10. **Native publishers and aggregators on nostr are listed in the directory** (`d` `nostr:<hex pubkey>`), their events read by kind and never re-signed or copied; copies yield to originals by the `q` rule. (§§ 2.2, 5, 7)
11. **Items, entries and headers go to the index relay, DList relays and search relays only**, never general relays, which don't serve DList items. (§ 11)
12. **`source` names where a calendar lives, never a format**: `luma`, `meetup`, `google`, `mobilizon`, `gancio` (and `nostr` on *Event Calendars*), else the feed's host name. Every feed is iCalendar, so `ics` set nothing apart; the format is the entry's `feed`, which an item reaches through `calendar`. (§§ 2.1, 4.1)
13. **Links come from URL templates**, as on *Event Calendars*: `luma-slug`, `meetup-group` and `meetup-event` fill the source's own event link, `index-id` (the public id again) fills the add-to-calendar link, and `url` carries the page for other platforms. Items carry no `r`. `when` writes the time out for people until renderers have a date type. (§§ 3.1, 4.1)

**Show and Tell.** The reuse hazard's questions ([design-philosophies/show-and-tell.md](../../../design-philosophies/show-and-tell.md) § The reuse hazard) get simpler answers than in ADR 0001. *Do they know?* An item is plainly the index's statement about a public event, signed by the index and naming the organizer as text. *Can they control it?* They can have the calendar removed, or link their own key, or publish themselves (§§ 8–9). *Would they endorse the reading?* The item claims only "this public event exists, at this page"; it never speaks as the organizer.

## Consequences

- **Enables:** standard DList items any DList client can list today; no keys in anyone's name; one curator's standing covers every item; a shared `i` lets several curators' listings of one event be grouped.
- **Constrains:** NIP-52 calendar clients (Flockstr, Formstr, Coracle) don't show index items. Brainstorm draws items at its schema-driven tier until it has an opinionated events view, and its Events tab may not include them until it does.
- **Constrains:** items go only to relays that support NIP-40 (it says clients SHOULD NOT send expiring events to relays that don't), listed in their NIP-11 or confirmed by their operators, and those relays must accept the volume (one item per upcoming event, republished on change).
- **Debt:** the master/child list mechanism (§ 3.2's seam); splitting the list republishes every live item once.
- **Debt:** the curation-copy carry rule (Assistant Designation § Curation copies, What it carries) was written for DList items. For a foreign-kind original such as a NIP-52 event it would carry `p` and `t` as item tags and drop `start`. Before any curator copies foreign kinds, the carry rule needs a foreign-kind case. (Carried over from ADR 0001.)
- **Debt:** the `optional` declaration word, the end-time display role and publishing the *Nostr events* header remain open (event-index § 12). Both list headers are signed: *Event Calendars* (event `681f3ceb…`) and *Events* (event `447b4101…`).
- **Firmware reinstall required?** No. Nothing in this repo's code changes.

## Implementation notes

Docs-mode: the "implementation" is the spec edits.

- `protocols/drafts/event-index.md` rewritten for this model: §§ 2–5 and 7–12, with § 6 from ADR 0004.
- `protocols/worksheet.md`: W32 restated for items; W33 re-scoped; W34 graduated (ADR 0004).
- `protocols/drafts/decentralized-lists-compat.md` § "Extending to other NIPs": its Event Index example points at § 6.
- `protocols/upstream/nip-52-cancellation.md`: its "When it lands" section names what still uses the prefix.
- No code. No test-file changes.

## Out of scope

- The index's own storage, HTTP API, and how it retires the keys it held before (the Event Index repository).
- The master/child list mechanism.
- How Brainstorm renders items.
