> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** `docs/EVENT_INDEX_DESIGN_HANDOFF.md` (NosFabrica, 2026-10-15 and 2026-10-16); `event-index` ADRs 0003 (feed events as curator-signed items; no custodial keys), 0004 (lists pulled by kind) and 0002 (guest custody), with 0001 superseded; [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md), [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md), [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md) and [NIP-73](https://github.com/nostr-protocol/nips/blob/master/73.md) as of `nostr-protocol/nips` `a79e21d` (2026-10-05); the `p` role words in Flockstr (`host`) and Formstr's NIP-52R draft (`organizer`).
> **Boundary note:** this draft is the wire format: the events an index publishes, and how a reader finds and reads them. The index's own iCalendar profile, platform adapters and HTTP API are specified in the Event Index repository's `spec/`, which must match § 4 and § 9.1 here. How Brainstorm or any other client renders these events is that client's own business.
> **Related:** worksheet [W30](../worksheet.md#w30--a-date-value-type-for-dlist-fields)–[W33](../worksheet.md#w33--trust-through-directory-membership) hold conventions this draft uses before they are ratified, and [W34](../worksheet.md#w34--tier-two-for-a-bare-kind) graduated into § 6; [DList Cross-NIP Compatibility](./decentralized-lists-compat.md) (`item-kind`, Methods 2 and 3), which § 6 extends; [Assistant Designation](./assistant-designation.md) § Curation copies (the address form § 7 uses); the NIP-52 cancellation proposal, [`upstream/nip-52-cancellation.md`](../upstream/nip-52-cancellation.md).

---

Event Index
===========

`draft` `optional`

**Event Index** is an open directory of public event calendars, kept as a [Decentralized List](../nips/decentralized-lists.md), and a curator that lists each calendar's events as DList items. Events that organizers already publish on nostr ([NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md)) are read by their kind and never copied.

The index never signs as an organizer. Every item it publishes is signed by the index's own key, names its organizer as text, and names an organizer's nostr key only once the organizer has verified it (§ 9). An event's full record is iCalendar ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)), kept and served by the index; an item is a short, linked summary of it.

This draft defines no new event kind. § 6, a list whose items are the events of a kind, is a general extension of DList Cross-NIP Compatibility's `item-kind`.

## 1. Terms

| Term | Meaning |
|---|---|
| **Index** | A service that keeps the directory and lists the events. Anyone may run one. |
| **Header key** | The key that signs the lists' headers: a maintainer's key, which keeps them like any other DList header (with Brainstorm-UI's List Management, for instance). It is not the index key. |
| **Index key** | The index's own key: the curator. It signs directory entries, event items, and its own profile and relay list. It never signs as an organizer. |
| **Directory entry** | A kind `39999` item on the *Event Calendars* list (§ 2): one calendar, one nostr publisher, or one aggregator. |
| **Feed calendar** | An organizer's calendar read from an iCalendar feed (Luma, Meetup, Mobilizon, Gancio, Google, any `.ics`). Its events become event items. |
| **Native publisher** | A key that publishes NIP-52 events itself. Its events are read by kind (§ 5). |
| **Aggregator** | An entry whose role is `aggregator`: a feed that lists other organizers' events (a Luma city page), which only leads the index to calendars; or a nostr key that re-publishes other organizers' events, whose events are kept and attributed to it (§ 5). |
| **Organizer's key** | A nostr key the organizer controls: a native publisher's own key, or a key an organizer has verified for a feed calendar (§ 9). An index never holds one. |
| **Record** | The index's normalized iCalendar copy of one event. Its format is the index's `spec/`, not this draft. |
| **Event item** | A kind `39999` item on the *Events* list (§ 3), signed by the index key, for one record or one occurrence of a recurring record (§ 4). |

The placeholders `<header key>`, `<index key>`, `<index relay>`, `<index API>`, `<index domain>` and `<index client name>` stand for one deployment's values: the normative text names no deployment's key ([protocols/README.md](../README.md), the boundary rule). Informative only: in the reference deployment the *Event Calendars* header is `39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:event-calendars`, and the other values are, in order: `cb26b1c0bfb64ef59c03baeccdcd71d14f477a62966f2bfbde2c33ef80f766dc`, `wss://relay.eventindex.space`, `https://api.eventindex.space/api/1.0/`, `eventindex.space` and `eventindex`.

## 2. The directory: Event Calendars

### 2.1 The header

Published by a maintainer's key. The reference deployment's header on `wss://dcosl.brainstorm.world`, with its template ids shortened to placeholders, and the `p`, `role` and `index-name` descriptions as this draft states them:

```json
{
  "kind": 39998,
  "pubkey": "<header key>",
  "tags": [
    ["d", "event-calendars"],
    ["names", "Event Calendar", "Event Calendars"],
    ["description", "Public event calendars from Luma, Meetup and other iCalendar feeds, gathered by Event Index (eventindex.space). The directory is in the public domain (CC0); the events belong to their organizers."],
    ["required", "name", "The calendar's name, as its organizer gives it"],
    ["required", "role", "calendar for an organizer's own calendar; aggregator for a feed, or a key, that lists other organizers' events"],
    ["recommended", "p", "The nostr key (hex) that publishes this calendar's events, or that its organizer has verified. Never a key Event Index holds"],
    ["recommended", "index-name", "The calendar's name on Event Index: its page is eventindex.space/calendar/<name>"],
    ["recommended", "feed", "The iCalendar feed the calendar is read from"],
    ["field-type", "feed", "url"],
    ["recommended", "source", "Where the feed comes from: luma, meetup, mobilizon, gancio, google, ics or nostr"],
    ["recommended", "location", "City or region the calendar is about, e.g. San Diego, US"],
    ["recommended", "g", "Geohash of the calendar's usual area"],
    ["optional", "luma-id", "The calendar's id on Luma, e.g. cal-BvuRd9eaZnDGBwy"],
    ["optional", "meetup-group", "The group's name in its Meetup address, e.g. sdbitcoiners"],
    ["optional", "calendar", "A native kind-31924 calendar this entry stands for"],
    ["field-type", "calendar", "address"],
    ["optional", "t", "A topic or search term, such as the city and the source; repeats"],
    ["optional", "description", "The calendar's own description, from its feed"],
    ["optional", "image", "The calendar's own image, from its feed"],
    ["field-type", "image", "url"],
    ["display", "title", "name"],
    ["display", "summary", "location"],
    ["display", "image", "image"],
    ["display", "location", "g"],
    ["display", "fact", "source", "Source"],
    ["image", "https://cdn.jsdelivr.net/gh/Event-Index/index@v0.1.2/brand/mark/mark-tile-512.png"],
    ["link", "<Event Index calendar template id>", "wss://dcosl.brainstorm.world", "name", "index-name"],
    ["link", "<Luma calendar template id>", "wss://dcosl.brainstorm.world", "id", "luma-id"],
    ["link", "<Meetup group template id>", "wss://dcosl.brainstorm.world", "group", "meetup-group"],
    ["r", "https://eventindex.space"],
    ["r", "https://github.com/Event-Index/index/blob/main/seeds/LICENSE"],
    ["r", "https://github.com/Event-Index/index/blob/main/brand/LICENSE"],
    ["license", "CC0-1.0"]
  ]
}
```

- **Declarations.** `required` and `recommended` are the DList NIP's. `optional` is not: it is Brainstorm-UI's convention, which its presentation conventions read like the NIP's `allowed`, as a field an item may carry. Readers SHOULD read `optional` as `allowed` (open question 6).
- **Presentation.** `field-type`, `display`, the list's own `image` and `link` are Brainstorm-UI's provisional presentation conventions, which worksheet W27 (open PR #819) asks about. A reader that doesn't know them ignores them.
- **Links come from URL templates.** Each `link` tag pins a URL template by its event id and binds one of the entry's fields to the template's placeholder (Brainstorm-UI's URL template convention). The three templates are *Event Index calendar*, `https://eventindex.space/calendar/{name}` (bound to `index-name`); *Luma calendar*, `https://luma.com/calendar/{id}` (bound to `luma-id`); and *Meetup group*, `https://www.meetup.com/{group}/` (bound to `meetup-group`). An entry gets the links whose fields it carries.
- **Licenses.** `["license", "CC0-1.0"]` gives the directory data's license as an SPDX identifier, and the `r` tags point at the index's site and the license texts. The events themselves belong to their organizers.

### 2.2 Entries

An entry is a kind `39999` event with `["z", "39998:<header key>:event-calendars"]` and the fields above, signed by whoever files it: the index key, for the entries the index files.

**`d` is the calendar's stable identity**, never its feed URL, which may change (Luma moved from `lu.ma` to `luma.com`). A writer builds it as:

| Source | `d` |
|---|---|
| Luma calendar | `luma:<calendar id>` (`luma:cal-…`) |
| Luma city page (an aggregator) | `luma:<place id>` (`luma:discplace-…`) |
| Meetup group | `meetup:<urlname>`, lowercased |
| Mobilizon group | `mobilizon:<instance host>/@<group>` |
| Public Google calendar | `google:<calendar id>`, percent-decoded |
| A nostr publisher | `nostr:<hex pubkey>`. The entry stands for the key: some publishers keep no kind `31924` at all. |
| Anything else | `ics:` followed by the lowercase hex SHA-256 of the canonical feed URL: scheme `webcal` replaced by `https`, scheme and host lowercased, a default port, any fragment and an empty query removed |

The index's `spec/` may add sources that have stable ids. A claim (§ 9) never changes an entry's `d`.

**`index-name`** is the calendar's name on the index, used for its page there. The index assigns it from NIP-05's characters (`a-z0-9-_.`) and never gives it to another calendar. A nostr publisher's is `nostr-` followed by the first 16 hex digits of its key.

**What an entry carries, by kind of entry:**

| Entry | `role` | `source` | `feed` | `p` | `calendar` |
|---|---|---|---|---|---|
| Feed calendar | `calendar` | the platform | yes | the organizer's key once verified (§ 9), else none | none |
| Feed calendar, claimed: "I publish myself" | `calendar` | `nostr` | none | the organizer's key | their newest `31924`, if any |
| Feed calendar, claimed: "publish for me, as me" | `calendar` | the platform | yes | the organizer's key | `31924:<organizer's key>:<entry d>` (§ 9.1) |
| Native publisher | `calendar` | `nostr` | none | the publisher's key | their newest `31924`, if any |
| Feed aggregator | `aggregator` | the platform | yes | none | none |
| Nostr aggregator | `aggregator` | `nostr` | none | the aggregator's key | none |

A claimed entry keeps its `luma-id` or `meetup-group`, and the name and description it had from the feed.

**Example**, a feed calendar whose organizer hasn't verified a key:

```json
{
  "kind": 39999,
  "pubkey": "<index key>",
  "tags": [
    ["d", "meetup:brooklyn-bitcoin-meetup"],
    ["z", "39998:<header key>:event-calendars"],
    ["name", "Brooklyn Bitcoin Meetup"],
    ["role", "calendar"],
    ["index-name", "meetup-brooklyn-bitcoin-meetup"],
    ["feed", "https://www.meetup.com/brooklyn-bitcoin-meetup/events/ical/"],
    ["source", "meetup"],
    ["location", "Brooklyn, US"],
    ["g", "dr5rm"],
    ["meetup-group", "brooklyn-bitcoin-meetup"],
    ["t", "brooklyn"],
    ["t", "meetup"]
  ]
}
```

**Who may file.** Anyone may file an entry under their own key. Which entries an index reads is that index's policy; which entries a reader sees is decided from the reader's point of view. An index files the feed calendars it is given or finds, and lists a nostr publisher once it has an upcoming event (§ 5): being listed needs nothing from the publisher, and says only that the index reads its public events. A feed URL is public data: an entry never names a private feed address (a URL carrying a token or secret), and an index refuses one.

**Publishing many at once.** A writer filing many entries SHOULD spread their `created_at` so that no second holds more than a few thousand events. Relays page by `created_at`, and a relay with a 10,000-event limit can't page past a second holding more than that.

### 2.3 Retiring an entry: `removed`

An entry is retired by republishing it (same `d`) with one more tag:

```json
["removed", "<reason>"]
```

- The reason is free text for people, such as `organizer request`.
- Readers drop a removed entry from the list. They MAY still show it as removed, with its reason, where they show history.
- Republishing the entry without the tag restores it.
- A kind `5` deletion is not used: the entry would vanish instead of reading as removed, which a public directory should show, and some relays honor deletion only by event id.

Only an entry's author can retire it, since only they can republish it. This is the convention Brainstorm-UI already reads for entries on its Dictionary list (`lib/dictionaryConcepts.ts`). Whether it should hold for every DList is open question 7.

## 3. Events: the list of event items

### 3.1 The header (proposed)

**Not published yet** (open question 5). As proposed, a maintainer's key publishes it, as for *Event Calendars*. Field names follow NIP-52's, so code that draws NIP-52 events can draw items; the declarations may still change before it is published.

```json
{
  "kind": 39998,
  "pubkey": "<header key>",
  "tags": [
    ["d", "events"],
    ["names", "Event", "Events"],
    ["description", "Events from the calendars on Event Calendars, listed by Event Index (eventindex.space): one item per event, naming its organizer and linking to its page at the source. The events belong to their organizers."],
    ["required", "title", "The event's title, as its organizer wrote it"],
    ["required", "start", "When it starts: unix seconds, or YYYY-MM-DD for an all-day event"],
    ["required", "organizer", "Who runs the event, as text"],
    ["required", "source", "Where the event comes from: luma, meetup, mobilizon, gancio, google or ics"],
    ["recommended", "end", "When it ends, in the same form as start"],
    ["recommended", "start_tzid", "Time zone of the start, as an IANA name, e.g. America/Los_Angeles"],
    ["recommended", "location", "Where it happens, as the organizer wrote it: an address, a room or a link"],
    ["recommended", "g", "Geohash of where it happens"],
    ["recommended", "summary", "A short summary of the event"],
    ["recommended", "calendar", "The calendar's entry on Event Calendars"],
    ["recommended", "i", "The event's page, as a shared identifier (NIP-73)"],
    ["recommended", "r", "The event's page, then its full record on Event Index"],
    ["allowed", "end_tzid", "Time zone of the end, when it differs from the start's"],
    ["allowed", "image", "The event's image"],
    ["allowed", "p", "The organizer's own nostr key, once verified"],
    ["allowed", "status", "cancelled, when the organizer has cancelled it"],
    ["allowed", "t", "A topic or search term; repeats"],
    ["field-type", "start", "date"],
    ["field-type", "end", "date"],
    ["field-type", "image", "url"],
    ["field-type", "r", "url"],
    ["field-type", "calendar", "address"],
    ["display", "title", "title"],
    ["display", "summary", "summary"],
    ["display", "image", "image"],
    ["display", "location", "g"],
    ["display", "link", "r"],
    ["display", "fact", "organizer", "Organizer"],
    ["image", "https://cdn.jsdelivr.net/gh/Event-Index/index@v0.1.2/brand/mark/mark-tile-512.png"],
    ["r", "https://eventindex.space"],
    ["r", "https://github.com/Event-Index/index/blob/main/brand/LICENSE"]
  ]
}
```

The `date` field type is proposed in worksheet [W30](../worksheet.md#w30--a-date-value-type-for-dlist-fields). A `["display", "date", "start"]` role ([W31](../worksheet.md#w31--date-display-roles-for-dlist-items)) would join once it settles and the tools that edit headers know it: Brainstorm-UI's List Management drops display roles it doesn't know. Items are ordinary kind `39999` items, so the header needs no `item-kind`. The proposed headers in this draft write the NIP's `allowed`; a header written in List Management says `optional` instead, which reads the same (open question 6).

### 3.2 One list now, lists by source later

*Events* starts as one list, and each item's `source` says where it came from. It is meant to become a master list with child lists **by source**: Luma events, Meetup events, iCalendar feed events (Google, Mobilizon, Gancio, generic `.ics`), and Nostr events pulled by kind (§ 6). The split is by source, not by format: `.ics`, jCal and JSON-LD are three ways the index serves one record.

> **Seam: master and child lists.** How a master list relates to its child lists is being specified separately, as a general DList mechanism, and is not specified here. This draft depends on it at this point only: when it lands, the child headers are published, and each item is republished with its child list's `z` (and whatever else that mechanism asks of an item). Nothing else in this draft changes.

## 4. Event items

### 4.1 The item

One item per event, or per occurrence of a recurring event (§ 4.3), signed by the index key, with `content` empty:

| Tag | From the record | Rule |
|---|---|---|
| `d` | | § 4.2. |
| `z` | | `39998:<header key>:events` (§ 3.2). |
| `title` | `SUMMARY` | Required. A record with no `SUMMARY` isn't listed. |
| `start` | `DTSTART` | Unix seconds; `YYYY-MM-DD` for a date, as NIP-52's date-based kind. A floating time is read in the calendar's `X-WR-TIMEZONE`, else UTC. |
| `end` | `DTEND`, or `DTSTART` + `DURATION` | Exclusive, in the same form as `start`. None when the record has no end, or an end that isn't after the start. |
| `start_tzid`, `end_tzid` | `TZID` | Timed events only. The IANA zone; for a UTC or floating time, the calendar's `X-WR-TIMEZONE` MAY be given when it names an IANA zone. `end_tzid` only when it differs from `start_tzid`. |
| `location` | `LOCATION`, `VLOCATION` | As written; one tag per distinct value. None for a hidden venue (§ 4.9). |
| `g` | `GEO` | Geohash of precision 9. Free-text locations are never geocoded. None for a hidden venue. |
| `summary` | `DESCRIPTION` | At most 280 characters of the description. The full description stays in the record. |
| `image` | `IMAGE`, else an `ATTACH` of an image type | None for a summary-only source (§ 4.9). |
| `organizer` | | Always: the calendar's name, else the `ORGANIZER`'s `CN`. Text only. |
| `p` | | `["p", "<organizer's key>", "<relay>", "host"]`, only for a key the organizer has verified for the calendar (§ 9). Never a key the index holds. |
| `calendar` | | The address of the calendar's directory entry, `39999:<entry author>:<entry d>`. One more for each co-host calendar (§ 4.5). |
| `status` | `STATUS:CANCELLED` | `cancelled`; absent otherwise (§ 4.7). |
| `i`, `k` | `URL` | `["i", "<the event's page>"]` and `["k", "web"]`, the NIP-73 form for a web page (§ 7). The URL is normalized: scheme and host lowercased, the host in its platform's own form (`lu.ma` becomes `luma.com`; Meetup's is `www.meetup.com`), no fragment, no empty query. Only when the event has a page of its own. |
| `source` | | `luma`, `meetup`, `mobilizon`, `gancio`, `google` or `ics`. |
| `r` | `URL` | The event's page at its source (else the calendar's page), then the full record, `<index API>/events/byid/<public id>.ics`. |
| `t` | `CATEGORIES` | Each value lowercased, once. The index MAY add search terms, such as the city. |
| `expiration` | | § 4.8. |
| `alt` | | `<organizer>: <title>, <date>`, the [NIP-31](https://github.com/nostr-protocol/nips/blob/master/31.md) fallback text; `<date>` is the start date, `YYYY-MM-DD`, in `start_tzid`'s zone (UTC when there is none). |
| `client` | | `<index client name>`. |

`ORGANIZER` and `ATTENDEE` addresses are never listed (§ 4.9). The header `required`s none of `p`, `e`, `a` or `i`, so none of them names the item's subject (Content Categories § 5.1): an item is its own subject, and its `p` (the host), `i` and `t` are plain fields. `calendar` is a named field so that its meaning doesn't depend on the header's declarations.

### 4.2 The `d`

`<prefix>:<public id>`. The prefix is `luma`, `meetup`, or `ics` for every other feed. The public id is the record's id on the index's API:

```
event key = lowercase hex SHA-256 of the UTF-8 UID
            (for one occurrence of a recurring event: of UID + ":" + its occurrence key)
public id = base32(first 20 bytes of SHA-256(UTF-8(<calendar's entry d> U+0000 <event key>)))
```

`base32` is RFC 4648 lowercase without padding: 32 characters of `a-z2-7`. The occurrence key is the occurrence's original start (its `RECURRENCE-ID`, before any override moves it) as unix seconds in decimal, or `YYYY-MM-DD` for a date.

The `d` is the same at every poll, rebuild and claim, so reading a feed again replaces an item instead of adding one. Another curator MAY use the same rule; a `d` is still per author, so the same `d` from two curators makes two items (§ 7).

### 4.3 Recurrence

An index expands a recurring record into one item per occurrence, inside a window it chooses, with an override (`RECURRENCE-ID`) replacing its occurrence.

### 4.4 Versions and withdrawal

- An index publishes a new version of an item only when its tags change, never merely because the feed's `SEQUENCE`, `LAST-MODIFIED` or `DTSTAMP` moved. A new version's `created_at` is later than the last one's.
- An index MUST NOT withdraw an item because one poll missed its event: feeds flap. Its `spec/` sets how long an event must be missing first.
- An item is withdrawn by a [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) kind `5` from the index key carrying an `e` for every version id it published, the `a` coordinate, and `["k", "39999"]`. Some relays honor deletion only by event id.
- When an event's address changes (a single event becomes recurring, or the calendar that gives its `d` changes, § 4.5), the item at the old address is withdrawn.
- A writer publishing many items at once SHOULD spread their `created_at`, as for entries (§ 2.2).

### 4.5 Co-hosts

When several calendars on the directory list the same event (the same `UID`), it gets one item. One of them, chosen by a deterministic rule in the index's `spec/`, gives the item its `d` and its first `calendar`; each other one adds a `calendar`. `organizer` names the first.

### 4.6 Who the host is

The item's author is the index, never the organizer. A reader shows `organizer` as the event's host, and shows a profile for the host only from a `p` with role `host`. Readers SHOULD read `organizer` as well as `host` as the role word in that `p` ([W32](../worksheet.md#w32--the-host-role-word-on-nip-52-p-tags)).

### 4.7 Cancellation

A record marked `STATUS:CANCELLED` keeps its item, republished with `["status", "cancelled"]` and its title unchanged. Readers SHOULD show the event as cancelled. An item has no other `status` value.

### 4.8 Expiration

Every item carries a [NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md) `["expiration", "<unix seconds>"]` 30 days after the event's end: its `end`, else its `start` (a date read as 00:00 UTC). Relays that honor NIP-40 drop the item then, and readers SHOULD ignore an expired item, as NIP-40 says. The record stays in the index's API. Because items expire, an index sends them only to relays that support NIP-40 (NIP-40: clients SHOULD NOT send expiring events to relays that don't): relays that list it in their NIP-11 `supported_nips`, or whose operators confirm it (§ 11).

### 4.9 Hidden venues, summary-only sources, and what never leaves the record

- **Hidden venues.** When a platform shows an event's venue only to the guests who registered, its item carries no `location` and no `g`, even when the feed gives them (Luma's feeds carry the exact `GEO` of such events). The index doesn't keep the exact position either. A reader that wants to place such an event uses the calendar's area (its entry's `location` or `g`). How an index tells that a venue is hidden is per platform (its `spec/`).
- **Summary-only sources.** Some platforms' terms allow no more than a summary and a link. For those sources an item carries no `image`. Which sources these are is the index's policy; the reference deployment treats Luma and Meetup this way, and may loosen it for one calendar after its organizer claims it or opts in.
- **Never published:** `ORGANIZER` and `ATTENDEE` addresses. An organizer's name may appear as text (the `organizer` field); an email address never does.

### 4.10 Example

A Meetup event (a summary-only source), whose organizer hasn't verified a key:

```json
{
  "kind": 39999,
  "pubkey": "<index key>",
  "content": "",
  "tags": [
    ["d", "meetup:rpclwfhp3xtb4jpkpxlehhyje3ngv3ha"],
    ["z", "39998:<header key>:events"],
    ["title", "October meetup"],
    ["start", "1792447200"],
    ["end", "1792454400"],
    ["start_tzid", "America/New_York"],
    ["location", "Pioneer Works, 159 Pioneer St, Brooklyn, NY"],
    ["g", "dr5r7v3gn"],
    ["summary", "Monthly meetup for bitcoiners in Brooklyn. Short talks, then open discussion."],
    ["organizer", "Brooklyn Bitcoin Meetup"],
    ["calendar", "39999:<index key>:meetup:brooklyn-bitcoin-meetup"],
    ["i", "https://www.meetup.com/brooklyn-bitcoin-meetup/events/312345678/"],
    ["k", "web"],
    ["source", "meetup"],
    ["r", "https://www.meetup.com/brooklyn-bitcoin-meetup/events/312345678/"],
    ["r", "<index API>/events/byid/rpclwfhp3xtb4jpkpxlehhyje3ngv3ha.ics"],
    ["t", "bitcoin"],
    ["expiration", "1795046400"],
    ["alt", "Brooklyn Bitcoin Meetup: October meetup, 2026-10-19"],
    ["client", "<index client name>"]
  ]
}
```

Its `UID` is `event_312345678@meetup.com`, so its event key is `5d35c27e…a2528d` and its public id `rpclwfhp3xtb4jpkpxlehhyje3ngv3ha`. It starts 2026-10-19 at 18:00 in New York and expires 30 days after its end.

## 5. Native NIP-52 events

- An index reads NIP-52 calendar events (kinds `31922` and `31923`) by kind from public relays, checks their signatures, and keeps each as a record served like any other. It never re-signs, re-publishes, or copies one into an item. Deletions by their authors (NIP-09) are honored. Which events it keeps beyond that (hygiene such as a parseable start) is its `spec/`.
- **Publishers are listed.** Each key with an upcoming event gets a directory entry (§ 2.2), filed by the index key: `d` `nostr:<hex pubkey>`, `source` `nostr`, `p` the publisher, `role` `calendar`, or `aggregator` for a key that re-publishes other organizers' events. The entry stays after that. The publisher can have it removed (§ 8).
- **Aggregators on nostr.** An aggregator's events are kept and attributed to it. When an organizer's own event and an aggregator's copy of it both exist, the organizer's is the original (§ 7).
- **Listing them.** Native events are the items of a list pulled by kind (§ 6): the *Nostr events* child list (§ 3.2), with no copy and no `z` needed.

## 6. Lists pulled by kind

[DList Cross-NIP Compatibility](./decentralized-lists-compat.md) lets a header declare a foreign kind with `item-kind`. An event of that kind then joins the list in one of two ways: its author claims the list with a `z` (Method 3), or a curator's item points at it (Method 2). Native publishers don't add another list's `z`, and a curator item per event costs one more event for every event. This section adds a third way: **membership by kind**. It is general, not specific to Event Index, and belongs in DList Cross-NIP Compatibility once ratified.

### 6.1 What the header declares

A fourth element on `item-kind`:

```json
["item-kind", "<kind>", "<description>", "kind"]
```

- **`kind`**: every event of that kind is a candidate item of the list. No `z` and no curator item is needed.
- **`z`, or no fourth element**: DList Cross-NIP Compatibility's rule, unchanged. An event of that kind is an item only when it claims the list with `z` (Method 3) or a curator's item points at it (Method 2).
- The description may be empty (`""`) to reach the fourth element.
- An unknown fourth element reads as `z`.
- A header may mix rules: `kind` for some kinds, `z` for others, and standard `9999` and `39999` items as usual when it also declares them.
- The header's declarations (`required`, `recommended`, `allowed`, `disallowed`) apply additively over the kind's own NIP, as for any `item-kind`. An event of the kind that lacks a field the header `required`s, or carries one it `disallowed`s, is not an item.

Membership by kind suits kinds whose events are what the list is about: Content Categories' "old-school DList", where a NIP plays the header and the kind plays `z` ([Content Categories](./content-categories.md) § 1). The header adds what a NIP doesn't carry: a name, declarations a schema-driven renderer can draw from ([Opinionated Views](./opinionated-views.md) § 2), presentation hints, and a place among other lists.

### 6.2 Selecting the items

- **Query by kind, without `#z`:** `{"kinds": [31922, 31923]}` for the example below, on the relays where events of that kind live: the reader's own, and others it knows hold the kind.
- **Bound every read.** A `z` list is bounded by who claims it; a kind list is not. Readers MUST bound each read (a time window with `since` and `until`, a `limit`, paging), and SHOULD narrow by the kind's own indexed tags where the list's use allows (for NIP-52, the `#D` day tags of a date range).
- **Validate** each event against the kind's NIP and the header's declarations (§ 6.1).
- **Merge** an event found by kind and also claiming the list by `z` into one item.
- **Keep the newest** event per address across relays; honor its author's NIP-09 deletions, by `e` and by `a`; ignore expired events (NIP-40).

### 6.3 Trust-filtering the items

Nobody vouches for an item of a list pulled by kind: the header's author doesn't, and no author claims the list. So which items a reader sees is decided entirely when it reads, from the reader's point of view, as for any open DList (the DList NIP, § "List curation and spam prevention").

- Readers SHOULD filter or rank items by their author's standing from the reader's point of view (a web-of-trust score such as GrapeRank's).
- Readers MAY use a directory as the filter: only events whose author is the `p` of a directory entry the reader trusts (for events, an *Event Calendars* entry, § 2). An entry filters only as well as its author vets: an entry an index files automatically (§ 5) says only that the index reads that key, not that anyone vouches for it. Worksheet [W33](../worksheet.md#w33--trust-through-directory-membership) asks how trust engines should weigh entries.
- A reader with no trust signal for the list SHOULD say so rather than show the unfiltered kind as the list.

### 6.4 Relation to Methods 2 and 3

- **Method 3** (the author's `z`): a list declared by kind already contains these events. The `z` still adds the author's claim that the event is meant for the list, which readers MAY weigh.
- **Method 2** (a curator's item): a curator's voice, independent of membership by kind. A curator list and a kind list over the same events can stand side by side. Event Index does both: feed events as its own items on *Events*, and native events by kind on *Nostr events*.
- **Duplicates.** The same real-world event can be both a native event and a curator's item. § 7 says how readers group them.

### 6.5 Readers that don't know the fourth element

A reader that knows `item-kind` but not the fourth element treats the kind as Method 3, and finds only events carrying the list's `z`: fewer items, never wrong ones. A reader that knows only the base DList NIP ignores `item-kind`.

### 6.6 Example: Nostr events (proposed)

```json
{
  "kind": 39998,
  "pubkey": "<header key>",
  "tags": [
    ["d", "nostr-events"],
    ["names", "Nostr Event", "Nostr Events"],
    ["description", "Calendar events their organizers publish on nostr (NIP-52), listed by their kind. Which ones you see depends on whom you trust."],
    ["item-kind", "31923", "Time-based calendar event (NIP-52)", "kind"],
    ["item-kind", "31922", "Date-based calendar event (NIP-52)", "kind"],
    ["required", "title", "The event's title"],
    ["required", "start", "When it starts: unix seconds, or YYYY-MM-DD for an all-day event"],
    ["recommended", "end", "When it ends, in the same form as start"],
    ["recommended", "location", "Where it happens"],
    ["recommended", "summary", "A short summary of the event"],
    ["allowed", "start_tzid", "Time zone of the start, as an IANA name"],
    ["allowed", "image", "The event's image"],
    ["allowed", "g", "Geohash of where it happens"],
    ["allowed", "r", "A page about the event"],
    ["allowed", "t", "A topic; repeats"],
    ["field-type", "start", "date"],
    ["field-type", "end", "date"],
    ["field-type", "image", "url"],
    ["field-type", "r", "url"],
    ["display", "title", "title"],
    ["display", "summary", "summary"],
    ["display", "image", "image"],
    ["display", "location", "g"],
    ["display", "link", "r"]
  ]
}
```

## 7. Duplicates, copies and originals

- **Within one curator**, the deterministic `d` (§ 4.2) means re-reading a feed replaces an item instead of adding one, and co-hosts share one item (§ 4.5).
- **Across curators**, a `d` is per author, so two curators listing the same event make two items. The shared `i` groups them: readers SHOULD treat items with the same `i` as one event. That rests on every curator normalizing the page URL the same way (§ 4.1).
- **Copies yield to originals.** Ranked from the original down: the organizer's own NIP-52 event (native, or claimed, § 9); a curator's item mirrored from a feed; an aggregator's copy. When an index knows that one of its items duplicates an organizer's own NIP-52 event, the item carries `["q", "<kind>:<pubkey>:<d>", "<relay>"]`, naming the original by address, as [Assistant Designation](./assistant-designation.md) § Curation copies names an addressable original. A reader holding both shows the original. An aggregator's events are its own signed events, so an index marks them as copies only in its own API.
- How an index decides that two events are the same is its `spec/`.

## 8. Removing a calendar

An organizer can have their calendar removed. The index decides what proof it accepts (its `spec/`); a request signed by the entry's `p` key is enough. Then:

1. The entry is republished with `["removed", "organizer request"]` (§ 2.3).
2. Every item the index published for the calendar is withdrawn (§ 4.4).
3. The index never reads the feed, or the publisher's events, again, and doesn't file the same `d` again. For a native publisher, it stops keeping and serving their events; their events on nostr remain theirs.

## 9. Claiming a calendar

An organizer who proves control of a feed calendar and of a nostr key links the two. The proof of the calendar is a token the index gives them, placed in the calendar's description or in one of its events, or [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) at the calendar's own domain naming the key; the proof of the key is an event it signs. Details are the index's `spec/`. The organizer then chooses one of three outcomes, all with their own key and consent:

- **Verify and link.** The entry's `p` becomes the organizer's key, and every item of the calendar gains `["p", "<organizer's key>", "<relay>", "host"]`. The index keeps listing the calendar's events as items.
- **"I publish myself."** The organizer publishes their own NIP-52 events. The entry is republished with `source` `nostr`, no `feed`, and `p` the organizer's key; the calendar's upcoming items are withdrawn (§ 4.4); and the organizer's events are read by kind like any native publisher's (§ 5).
- **"Publish for me, as me."** The organizer gives the index a [NIP-46](https://github.com/nostr-protocol/nips/blob/master/46.md) remote signer limited to kinds `31922`, `31923`, `31924` and `5`, and the index publishes the calendar's events as NIP-52 events signed by the organizer's key (§ 9.1). The entry keeps its `source` and `feed`, with `p` the organizer's key and `calendar` their `31924`. Their NIP-52 events are the originals; the calendar's items stay as copies, each naming its original (§ 7). The organizer can disconnect the signer at any time, which turns this into "I publish myself".

  NIP-46 limits a signer by kind only, so the index MUST use it narrowly: it signs a kind `5` only to delete events it published for the organizer, and a kind `31924` only with the entry's `d` (§ 9.1). The claim page tells the organizer so before they connect.

An index never holds an organizer's key, and never hands over a key of its own.

### 9.1 NIP-52 events published for an organizer

Under "publish for me, as me", each record becomes a NIP-52 event signed by the organizer's key: a kind `31923`, or a kind `31922` when `DTSTART` is a date.

- **Tags as for an item** (§ 4.1) where NIP-52 defines them: `title`, `start`, `end`, `start_tzid`, `end_tzid`, `location`, `g`, `image` (the content policy of § 4.9 applies), `t`, and the two `r`s; plus `summary` and `content` carrying the same short text.
- **`d`** is the event key of § 4.2, so an edit replaces the event at the same address.
- **`D`** (`31923` only): one tag for each UTC day from `floor(start / 86400)` to `floor((end − 1) / 86400)`, just the first when there is no `end`.
- **`p`**: `["p", "<organizer's key>", "<relay>", "host"]`.
- **Cancelled:** the title is prefixed `Cancelled: ` until NIP-52 has a cancellation convention ([proposal](../upstream/nip-52-cancellation.md)).
- **`alt`** and **`client`** as for an item. No `z`, no `expiration`.
- **The organizer's calendar:** one kind `31924` with `d` equal to the entry's `d` (so it never collides with a calendar the organizer keeps), `title` the calendar's name, and an `a` for each upcoming event and those of the past 30 days.
- The index writes no kind 0 or kind `10002` for the organizer. Relay hints name the organizer's first write relay; the index relay when the index hosts their events; else the first relay the index publishes their events to.

## 10. Responses

- **An item takes no nostr RSVP.** People RSVP at the source, through the item's first `r`: the organizer sees RSVPs there. NIP-52 RSVPs (kind `31925`) name only kinds `31922` and `31923` anyway.
- **Comments** ([NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md)) can root at an item's address like any addressable event's (`K` `39999`).
- **Native events, and events published for an organizer,** take standard responses:
  - an RSVP is a kind `31925` with `a` (the event's coordinate), `status`, `p` (the event's author), and a `d` that is any unique id. Readers take the newest `31925` per author per `a`, whatever its `d`, and SHOULD ignore one dated more than a day ahead of their clock. A writer SHOULD reuse its previous `d` for the same event;
  - a comment is a kind `1111` rooted at the event's address: `A`, `K`, `P`, and for a top-level comment `a`, `e` (the version commented on), `k`, `p`;
  - either is withdrawn by its author with a NIP-09 kind `5`.
- **Guest keys.** A guest service may sign responses for people without a nostr key, with a key it holds for each of them (`event-index` ADR 0002). Its kind 0 says the account is custodial and was created by email; an email address never appears on a relay.

## 11. Relays

| Events | Where they go |
|---|---|
| headers, directory entries, event items, and their deletions | `<index relay>`, relays that hold DLists (such as `wss://dcosl.brainstorm.world`, which takes only kinds `9998`, `9999`, `39998`, `39999` and `7`), and search relays that index them. Event items only to those that support NIP-40 (§ 4.8). Never general relays: they don't serve DList items. |
| NIP-52 events published for an organizer (§ 9.1) | the organizer's write relays, or `<index relay>` when the index hosts them |
| the index key's kind 0 and kind `10002` | `<index relay>`, general relays, and profile relays |

Native events are read where their authors publish them.

## 12. Open questions

1. **A role for the end time.** [W31](../worksheet.md#w31--date-display-roles-for-dlist-items) proposes `date` for an item's primary time and leaves the end open.
2. **The host role word.** Write `host`, read `host` and `organizer` ([W32](../worksheet.md#w32--the-host-role-word-on-nip-52-p-tags)). To be raised with Formstr and NIP-52's maintainers; if they agree, it goes upstream with the cancellation proposal.
3. **Trust for lists pulled by kind** ([W33](../worksheet.md#w33--trust-through-directory-membership)): how trust engines should weigh a directory entry's `p` when filtering a kind list (§ 6.3).
4. **Master and child lists** (§ 3.2): specified separately.
5. **Publishing the Events and Nostr events headers** (§§ 3.1, 6.6).
6. **`optional` or `allowed`.** The live *Event Calendars* header declares fields `optional`, Brainstorm-UI's convention; the DList NIP's word for the same thing is `allowed`. Either the NIP gains `optional` as a synonym, or headers write `allowed`.
7. **`removed` for every DList?** § 2.3 defines it for directory entries only. If it holds for any kind `39999` item, it belongs in the [Decentralized Lists](../nips/decentralized-lists.md) NIP or its companion.
8. **Cancellation in NIP-52.** Items carry `["status", "cancelled"]`; NIP-52 events published for an organizer prefix the title until NIP-52 has a convention ([proposal](../upstream/nip-52-cancellation.md)).
9. **Relays that keep expired items.** NIP-40 lets a relay keep an expired event; readers ignore it (§ 4.8). Whether an index should also delete items some time after they expire is open.
10. **Where § 6 lives.** It extends `item-kind` for every DList, so once ratified it moves to DList Cross-NIP Compatibility, leaving a pointer here.
