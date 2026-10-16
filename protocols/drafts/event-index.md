> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** `docs/EVENT_INDEX_DESIGN_HANDOFF.md` (NosFabrica, 2026-10-15); `event-index` ADRs 0001 (the item format, and keeping the Events header) and 0002 (guest custody); [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) and [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md) as of `nostr-protocol/nips` `a79e21d` (2026-10-05); the `p` role words in Flockstr (`host`, `components/Modals/CreateCalendarEvent.tsx`) and in Formstr's NIP-52R draft (`organizer`).
> **Boundary note:** this draft is the wire format: the events an index publishes, and the events other people publish about them. The index's own iCalendar profile, platform adapters and HTTP API are specified in the Event Index repository's `spec/`; its NIP-52 mapping restates § 4 here and must match it. How Brainstorm or any other client renders these events is that client's own business.
> **Related:** worksheet [W30](../worksheet.md#w30--a-date-value-type-for-dlist-fields)–[W34](../worksheet.md#w34--tier-two-for-a-bare-kind) hold the conventions this draft uses before they are ratified; [DList Cross-NIP Compatibility](./decentralized-lists-compat.md) Method 3; [Assistant Designation](./assistant-designation.md) § Curation copies (the `q` rule § 9 follows); the NIP-52 cancellation proposal, [`upstream/nip-52-cancellation.md`](../upstream/nip-52-cancellation.md).

---

Event Index
===========

`draft` `optional`

**Event Index** is an open directory of public event calendars, kept as a [Decentralized List](../nips/decentralized-lists.md), and an indexer that mirrors each listed calendar's events into nostr as [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) calendar events. Each calendar gets a nostr key of its own, held by the index, so that an event mirrored from a Meetup group reads as that group's event in every NIP-52 client, not as the index's.

An event's full record is iCalendar ([RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)), kept and served by the index. The NIP-52 event is a lossy projection of it that links back to the record. This draft defines no new event kind.

## 1. Terms

| Term | Meaning |
|---|---|
| **Index** | A service that keeps the directory and publishes the projections. Anyone may run one. |
| **Header key** | The key that signs the directory's list headers: a maintainer's key, which keeps them like any other DList header (with Brainstorm-UI's List Management, for instance). It is not the index key. |
| **Index key** | The index's own key: the directory's curator. It signs the directory entries the index files, and its own profile, relay list and contact list. It signs no header and no calendar event. |
| **Directory entry** | A kind `39999` item on the *Event Calendars* list (§ 2): one calendar feed, or one discovery feed. |
| **Calendar** | An entry whose role is `calendar`: an organizer's own calendar. Its events are projected. |
| **Aggregator** | An entry whose role is `aggregator`: a feed that lists other people's events (a Luma city page, a "what's on" calendar). It only leads the index to calendars; its events are never projected, because the aggregator would then read as their host. |
| **Calendar key** | The key an index holds for one calendar (§ 5). It signs that calendar's projections. |
| **Record** | The index's normalized iCalendar copy of one event. Its format is the index's `spec/`, not this draft. |
| **Projection** | The kind `31923` (or `31922`) event a calendar key signs for one record (§ 4). |

The placeholders `<header key>`, `<index key>`, `<index relay>`, `<index API>`, `<index domain>` and `<index client name>` stand for one deployment's values. A spec names no deployment's key ([protocols/README.md](../README.md), the boundary rule). In the reference deployment the *Event Calendars* header is, for example, `39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:event-calendars`, and the other values are, in order: an index key created when it first publishes, `wss://relay.eventindex.space`, `https://api.eventindex.space/api/1.0/`, `eventindex.space` and `eventindex`.

## 2. The directory: Event Calendars

### 2.1 The header

Published by a maintainer's key. The reference deployment's header, as published on `wss://dcosl.brainstorm.world` (template ids shortened to placeholders):

```json
{
  "kind": 39998,
  "pubkey": "<header key>",
  "tags": [
    ["d", "event-calendars"],
    ["names", "Event Calendar", "Event Calendars"],
    ["description", "Public event calendars from Luma, Meetup and other iCalendar feeds, gathered by Event Index (eventindex.space). Each calendar's events are mirrored to nostr as NIP-52 events, signed by a key Event Index holds for that calendar, so the organizer shows as the host. The directory is in the public domain (CC0); the events belong to their organizers."],
    ["required", "name", "The calendar's name, as its organizer gives it"],
    ["required", "role", "calendar for an organizer's own calendar; aggregator for a feed that only leads to other calendars"],
    ["recommended", "p", "The calendar's nostr key (hex), held by Event Index until its organizer claims the calendar"],
    ["recommended", "index-name", "The calendar's name on Event Index: its page is eventindex.space/calendar/<name> and its nostr address <name>@eventindex.space"],
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

- **Declarations.** `required` and `recommended` are the DList NIP's. `optional` is not: it is Brainstorm-UI's convention, and its presentation conventions read it, like the NIP's `allowed`, as a field an item may carry. Readers SHOULD read `optional` as `allowed` (open question 8).
- **Presentation.** `field-type`, `display`, the list's own `image` and `link` are Brainstorm-UI's provisional presentation conventions, which worksheet W27 (open PR #819) asks about. A reader that doesn't know them ignores them.
- **Links come from URL templates**, not from a `url` field. Each `link` tag pins a URL template by its event id and binds one of the entry's fields to the template's placeholder (Brainstorm-UI's URL template convention). The three templates are *Event Index calendar*, `https://eventindex.space/calendar/{name}` (bound to `index-name`); *Luma calendar*, `https://luma.com/calendar/{id}` (bound to `luma-id`); and *Meetup group*, `https://www.meetup.com/{group}/` (bound to `meetup-group`). An entry gets the links whose fields it carries.
- **Licenses.** `["license", "CC0-1.0"]` gives the directory data's license as an SPDX identifier, and the `r` tags point at the index's site and the license texts. The events themselves belong to their organizers.

### 2.2 Entries

An entry is a kind `39999` event with `["z", "39998:<header key>:event-calendars"]` and the fields above, signed by whoever files it: the index key, for the entries the index files itself.

**`d` is the calendar's stable identity**, never its feed URL, which may change (Luma moved from `lu.ma` to `luma.com`). A writer builds it as:

| Source | `d` |
|---|---|
| Luma calendar | `luma:<calendar id>` (`luma:cal-…`) |
| Luma city page (an aggregator) | `luma:<place id>` (`luma:discplace-…`) |
| Meetup group | `meetup:<urlname>`, lowercased |
| Mobilizon group | `mobilizon:<instance host>/@<group>` |
| A native NIP-52 calendar | `nostr:31924:<pubkey>:<d>`: the prefix, then the calendar's address. This is a `d` prefix, not a [NIP-21](https://github.com/nostr-protocol/nips/blob/master/21.md) URI. |
| Anything else | `ics:` followed by the lowercase hex SHA-256 of the canonical feed URL: scheme `webcal` replaced by `https`, scheme and host lowercased, a default port and any fragment removed |

The index's `spec/` may add sources that have stable ids. A calendar key belongs to its entry's `d` (§ 5.1), so a changed feed URL keeps the key.

**`index-name`** is the calendar's name on the index: its page there, and the local part of its calendar key's NIP-05 address (§ 5.2). The index assigns it, from NIP-05's characters only, and never gives it to another calendar.

**Example:**

```json
{
  "kind": 39999,
  "pubkey": "<index key>",
  "tags": [
    ["d", "meetup:brooklyn-bitcoin-meetup"],
    ["z", "39998:<header key>:event-calendars"],
    ["name", "Brooklyn Bitcoin Meetup"],
    ["role", "calendar"],
    ["p", "<calendar key>"],
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

**Who may file.** Anyone may file an entry under their own key. Which entries an index polls is that index's policy; which entries a reader sees is decided from the reader's point of view. A feed URL is public data: an entry never names a private feed address (a URL carrying a token or secret), and an index refuses one.

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

Only an entry's author can retire it, since only they can republish it. This is the convention Brainstorm-UI already reads for entries on its Dictionary list (`lib/dictionaryConcepts.ts`). Whether it should hold for every DList is open question 6.

## 3. Events: the list of projected events

### 3.1 The header (proposed)

**Not published yet**; whether to publish it is open question 9. As proposed, a maintainer's key would publish it, as for *Event Calendars*:

```json
{
  "kind": 39998,
  "pubkey": "<header key>",
  "tags": [
    ["d", "events"],
    ["names", "Event", "Events"],
    ["description", "Upcoming meetups, talks and workshops from the calendars on Event Calendars, mirrored to nostr by Event Index (eventindex.space) as NIP-52 calendar events. Each event is signed by its calendar's own key and links to its page at the source and its full record on Event Index. The events belong to their organizers."],
    ["item-kind", "31923", "Time-based calendar event (NIP-52)"],
    ["item-kind", "31922", "Date-based calendar event (NIP-52)"],
    ["required", "title", "The event's title, as its organizer wrote it"],
    ["required", "start", "When it starts: unix seconds, or YYYY-MM-DD for an all-day event"],
    ["recommended", "end", "When it ends, in the same form as start"],
    ["recommended", "location", "Where it happens, as the organizer wrote it: an address, a room or a link"],
    ["recommended", "summary", "A short summary of the event"],
    ["optional", "start_tzid", "Time zone of the start, as an IANA name, e.g. America/Los_Angeles"],
    ["optional", "end_tzid", "Time zone of the end, when it differs from the start's"],
    ["optional", "image", "The event's image"],
    ["optional", "g", "Geohash of where it happens"],
    ["optional", "r", "Event page"],
    ["optional", "t", "A topic; repeats"],
    ["field-type", "start", "date"],
    ["field-type", "end", "date"],
    ["field-type", "image", "url"],
    ["field-type", "r", "url"],
    ["display", "title", "title"],
    ["display", "summary", "summary"],
    ["display", "image", "image"],
    ["display", "link", "r"],
    ["display", "location", "g"],
    ["image", "https://cdn.jsdelivr.net/gh/Event-Index/index@v0.1.2/brand/mark/mark-tile-512.png"],
    ["r", "https://eventindex.space"],
    ["r", "https://github.com/Event-Index/index/blob/main/brand/LICENSE"]
  ]
}
```

The `date` field type is proposed in worksheet [W30](../worksheet.md#w30--a-date-value-type-for-dlist-fields). A `["display", "date", "start"]` role ([W31](../worksheet.md#w31--date-display-roles-for-dlist-items)) would join once it settles and the tools that edit headers know it: Brainstorm-UI's List Management drops display roles it doesn't know. The declarations apply additively over NIP-52's own requirements ([DList Cross-NIP Compatibility](./decentralized-lists-compat.md) § `item-kind`).

### 3.2 Listing: Method 3

Once the header is published, every projection carries `["z", "39998:<header key>:events"]`: it lists itself, as the calendar's own claim ("I claim to be on this list"), by Method 3 of [DList Cross-NIP Compatibility](./decentralized-lists-compat.md). Until then, projections carry no `z`. NIP-52 uses no `z` tag, so the extra tag is harmless to NIP-52 clients. A reader finds the items with:

```json
{ "kinds": [31922, 31923], "#z": ["39998:<header key>:events"] }
```

- Anyone may add the same `z` to their own NIP-52 event, and readers weigh it from their point of view like any other claim. A reader that wants only one index's projections keeps the items whose author is the `p` of a directory entry it trusts (§ 5.6).
- The items are not on relays that accept only list kinds. Read them from the index relay or another relay that holds NIP-52 events (§ 10), even when the header came from a list-only relay.
- The header lists no kind `39999` items. A native NIP-52 event that someone already published is read by its kind, never copied into a curator item.

## 4. The NIP-52 projection

### 4.1 Which kind

A record whose `DTSTART` is a date (`VALUE=DATE`) becomes a kind `31922`; every other record becomes a kind `31923`. The calendar's key signs it.

### 4.2 Tags from the record

| iCalendar | Tag | Rule |
|---|---|---|
| `UID` | `d` | The lowercase hex SHA-256 of the UTF-8 `UID`. For one occurrence of a recurring event, of `UID` + `:` + the occurrence's original start (its `RECURRENCE-ID`, before any override moves it) written as unix seconds in decimal, or as `YYYY-MM-DD` for a date. The hash is uniform and never leaks what a `UID` carries; an edit replaces the event at the same address. |
| `SUMMARY` | `title` | Required. A record with no `SUMMARY` isn't projected. |
| `DTSTART` | `start` | Unix seconds (`31923`) or `YYYY-MM-DD` (`31922`). A floating time is read in the calendar's `X-WR-TIMEZONE`, else UTC. |
| `TZID` of `DTSTART` | `start_tzid` | `31923` only. The IANA zone. For a UTC or floating time, the calendar's `X-WR-TIMEZONE` MAY be given when it names an IANA zone. |
| `DTEND`, or `DTSTART` + `DURATION` | `end`, `end_tzid` | Exclusive, as NIP-52 says. No end in the record, or an end that isn't after the start (NIP-52 requires `start` < `end`): no `end` tag. `end_tzid` only when it differs from `start_tzid`. |
| the start and end | `D` | `31923` only: one `D` for each UTC day from `floor(start / 86400)` to `floor((end − 1) / 86400)`; just the first when there is no `end`. |
| `DESCRIPTION` | `summary` and `content` | Both carry the same short text, at most 280 characters of the description. The full description stays in the record, which § 4.3's last `r` links to. |
| `LOCATION`, `VLOCATION` | `location` | As written; one tag per distinct value. None for a hidden venue (§ 4.8). |
| `GEO` | `g` | Geohash of precision 9. Free-text locations are never geocoded. None for a hidden venue (§ 4.8). |
| `URL` | `r` | The event's page; when the record has none, the calendar's page. This is the first `r` of § 4.3, not a second one. |
| `IMAGE`, else an `ATTACH` of an image type | `image` | None for a summary-only source (below). |
| `CATEGORIES` | `t` | Each value lowercased, once. |
| `STATUS:CANCELLED` | (title) | § 4.6. |
| `PARTICIPANT` naming a nostr key | `p` | `["p", "<pubkey>", "", "<role>"]`, the role being the participant's type lowercased. Only for a pubkey the record names; never derived from an email address. |
| `ORGANIZER`, `ATTENDEE` | — | Never projected (§ 4.8). |

**Summary-only sources.** A projection's `summary` and `content` carry only the short text for every source. Some platforms' terms allow no more than a summary and a link, so for those sources an index also leaves out `image`, and the calendar key's kind 0 has no `picture` (§ 5.2). Which sources these are is the index's policy; the reference deployment treats Luma and Meetup this way, and may loosen it for one calendar after its organizer claims it or opts in.

### 4.3 Tags the index adds

```json
["z", "39998:<header key>:events"],
["p", "<calendar key>", "<index relay>", "host"],
["r", "<the event's page>"],
["r", "<index API>/events/byid/<record id>.ics"],
["alt", "<calendar name>: <title>, <date>"],
["client", "<index client name>"]
```

- **`z`** only once the Events header is published (§ 3.2).
- **`host`** names the calendar whose key signs the event. Each co-host calendar adds one more `host` `p` (§ 4.7). NIP-52 leaves the role word free: Flockstr writes `host`, Formstr writes `organizer`. Writers write `host`; readers SHOULD read both ([W32](../worksheet.md#w32--the-host-role-word-on-nip-52-p-tags)).
- **The two `r` tags** come in that order. The first is the event's page at its source (§ 4.2), and the last is the full record as iCalendar. When there is no page at all, only the record's `r` is written. The record's id is the index's (its `spec/`).
- **`alt`** is the [NIP-31](https://github.com/nostr-protocol/nips/blob/master/31.md) fallback text; `<date>` is the start date, `YYYY-MM-DD`, in `start_tzid`'s zone (UTC when there is none). NIP-31 is marked `unrecommended` upstream; the tag is kept because it costs nothing and helps clients that don't know NIP-52.
- **No `expiration` tag** ([NIP-40](https://github.com/nostr-protocol/nips/blob/master/40.md)). Relays that honor one would drop the event that RSVPs and comments hang from, and a past event keeps its value.

### 4.4 Recurrence

NIP-52 has no recurrence. An index expands a recurring record into one projection per occurrence, inside a window it chooses, with an override (`RECURRENCE-ID`) replacing its occurrence. Each occurrence has its own `d` (§ 4.2). A change that moves an event to a new address (a single event that becomes recurring, or a timed event that becomes all-day, so its kind changes) deletes the event at the old address with a kind `5` as in § 4.6, even when it has RSVPs, rather than marking it cancelled: the event wasn't cancelled. Its RSVPs and comments don't carry over to the new address.

### 4.5 Versions

An index publishes a new version of a projection only when its tags or content change, never merely because the feed's `SEQUENCE`, `LAST-MODIFIED` or `DTSTAMP` moved. A new version's `created_at` is later than the last one's.

### 4.6 Cancellation and withdrawal

- **Cancelled.** A record marked `STATUS:CANCELLED` is republished at the same address with its title prefixed `Cancelled: `. Readers that know this draft SHOULD show the event as cancelled rather than show the prefix as part of its name. NIP-52 has no cancellation convention yet; one is proposed upstream ([`upstream/nip-52-cancellation.md`](../upstream/nip-52-cancellation.md)), and once NIP-52 has one, an index uses it instead of the prefix.
- **Gone from its feed.** An index MUST NOT withdraw an event because one poll missed it: feeds flap. Its `spec/` sets how long an event must be missing first. An upcoming event that has RSVPs is then republished as cancelled; one with none is deleted. A past event is left alone.
- **Deletion** is a [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) kind `5` from the calendar key, carrying an `e` for every version id it published, the `a` coordinate, and `["k", "<31922 or 31923>"]`. Some relays honor deletion only by event id.

### 4.7 Co-hosts

When several calendars on the directory list the same event (the same `UID`), it is projected once. One of them, chosen by a deterministic rule in the index's `spec/`, signs it; every other one adds `["p", "<its calendar key>", "<index relay>", "host"]`, and its kind `31924` lists the event too (§ 5.4). If the signing calendar changes, so does the event's address: the event at the old address is deleted as in § 4.4, even when it has RSVPs.

### 4.8 What never leaves the record

`ORGANIZER` and `ATTENDEE` addresses never reach a projection, a kind `0`, or any other public event. An organizer's name (an `ORGANIZER`'s `CN`) may appear as text, as a calendar's `name` for example; an email address never does.

**Hidden venues.** When a platform shows an event's venue only to the guests who registered, its projection carries no `location` and no `g`, even when the feed gives them (Luma's feeds carry the exact `GEO` of such events). The index doesn't keep the exact position either. A reader that wants to place such an event uses the calendar's area (its directory entry's `location` or `g`). How an index tells that a venue is hidden is per platform (its `spec/`).

### 4.9 Example

As it would be once the Events header is published:

```json
{
  "kind": 31923,
  "pubkey": "<calendar key>",
  "content": "Monthly meetup for bitcoiners in Brooklyn. Short talks, then open discussion.",
  "tags": [
    ["d", "<sha256 of the UID>"],
    ["title", "October meetup"],
    ["start", "1792447200"],
    ["end", "1792454400"],
    ["start_tzid", "America/New_York"],
    ["D", "20745"],
    ["summary", "Monthly meetup for bitcoiners in Brooklyn. Short talks, then open discussion."],
    ["location", "Pioneer Works, 159 Pioneer St, Brooklyn, NY"],
    ["g", "dr5r7v3gn"],
    ["t", "bitcoin"],
    ["z", "39998:<header key>:events"],
    ["p", "<calendar key>", "<index relay>", "host"],
    ["r", "https://www.meetup.com/brooklyn-bitcoin-meetup/events/312345678/"],
    ["r", "<index API>/events/byid/<record id>.ics"],
    ["alt", "Brooklyn Bitcoin Meetup: October meetup, 2026-10-19"],
    ["client", "<index client name>"]
  ]
}
```

## 5. Calendar keys

### 5.1 One key per calendar

An index creates one key for each feed-backed `calendar` entry it adopts for indexing, and none for an aggregator or for an entry that stands for a native NIP-52 calendar (`source` `nostr`): that entry's `p` is the calendar's own author, and its events are read by kind, never re-signed. The key is random, never derived from anything: a claim may hand it to the organizer (§ 8), and a key the index could derive again could never be forgotten. The key belongs to the entry's `d`. The entry names it in `p`.

### 5.2 Kind 0

The calendar key's metadata ([NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), [NIP-24](https://github.com/nostr-protocol/nips/blob/master/24.md)):

| Field | Value |
|---|---|
| `name` | RFC 7986 `NAME`; else `X-WR-CALNAME`, unless it is a platform default (Luma's "Personal"); else the `ORGANIZER`'s `CN`; else the entry's `name` |
| `picture` | RFC 7986 `IMAGE`, else the entry's `image`. None for a summary-only source (§ 4.2). |
| `website` | the calendar's page on its platform: RFC 7986 `URL`, else the link the entry's `luma-id` or `meetup-group` template builds (§ 2.1) |
| `nip05` | `<index-name>@<index domain>`, the entry's `index-name` (§ 2.2). The index serves it at `/.well-known/nostr.json`. |
| `about` | the sentence for the calendar's state, below |

Every person who sees a calendar key is told it is a mirror, who made it, and where the organizer can act:

| State | `about` |
|---|---|
| Mirrored | *Events of ⟨name⟩, mirrored from ⟨platform⟩ by ⟨index name⟩, which is not affiliated with ⟨platform, plain⟩. Organizer? You can have this calendar removed: ⟨the calendar's page on the index⟩.* |
| Removed (§ 7) | *No longer mirrored by ⟨index name⟩ at its organizer's request.* |
| Claimed, key handed over (§ 8) | *Claimed by its organizer on ⟨date⟩.* (Afterwards the organizer may write anything.) |
| Claimed, organizer's own key (§ 8) | *This calendar now publishes as ⟨npub⟩.* |

⟨platform⟩ is the platform's name as its owner styles it, mark included ("Meetup®"); ⟨platform, plain⟩ is the same name without the mark ("Meetup"). When there is no platform, ⟨platform⟩ is "its calendar feed" and the not-affiliated clause is left out. The reference deployment's ⟨index name⟩ is "Event Index", and its calendar pages are `https://eventindex.space/calendar/<index-name>`. For example: *Events of Brooklyn Bitcoin Meetup, mirrored from Meetup® by Event Index, which is not affiliated with Meetup. Organizer? You can have this calendar removed: https://eventindex.space/calendar/meetup-brooklyn-bitcoin-meetup.*

The *Mirrored* sentence offers only removal while the index doesn't accept claims (§ 8). When it starts to, the sentence adds the claim offer, and every calendar key republishes its kind 0.

### 5.3 Kind 10002

The calendar key's relay list ([NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md)) names `<index relay>` with no marker, so RSVPs and comments sent to the host's inbox reach the index, plus the general relays the index publishes to. It never names a relay that won't hold the calendar's events, such as one that takes only list kinds.

### 5.4 Kind 31924

Each calendar key publishes one NIP-52 calendar:

```json
{
  "kind": 31924,
  "pubkey": "<calendar key>",
  "content": "<the calendar's description>",
  "tags": [
    ["d", "calendar"],
    ["title", "<the calendar's name>"],
    ["a", "31923:<calendar key>:<d>", "<index relay>"]
  ]
}
```

- One `a` for every upcoming event the calendar signs or co-hosts (§ 4.7), and for those of the past 30 days. Republished when that set changes.
- The `d` is always `calendar`. NIP-52 asks for a unique `d`; the address is unique because a key has one calendar, and the fixed `d` lets a reader find the calendar of an index event at `31924:<the event's author>:calendar`. Clients that follow calendars (Formstr, Flockstr) can follow it.

### 5.5 The index key

The index key's kind 0 names the index (the reference deployment: `name` "Event Index", `nip05` `_@eventindex.space`, `about` *"The open directory of public event calendars. Mirrors them as nostr calendars so any app can render them. eventindex.space"*). It is the directory's curator: it signs the directory entries the index files, its own kind 0 and kind `10002`, and its contact list (§ 5.6). It signs no header (a maintainer's key does, § 2.1), and never authors a calendar event, RSVP or comment.

### 5.6 Trust

A calendar key starts with no followers, so a client that filters by trust would hide it.

- **The rule that scales:** a calendar key's standing comes from the directory entry that names it in `p`, weighted by the reader's trust in that entry's author. Trust engines don't read this yet; it is worksheet [W33](../worksheet.md#w33--trust-through-directory-membership).
- **Interim:** the index key follows the calendar keys it indexes, in its kind `3`, while there are few enough to fit. A contact list is one event, and a relay's size limit (65,536 bytes on default strfry settings) holds about 850 `p` tags. The follow says "this index mirrors this calendar", not that anyone vouches for the organizer.

## 6. Responses: RSVPs and comments

Anyone may RSVP to or comment on a projection, signed by any key: their own, or a custodial key a guest service holds for them. The shapes are plain NIP-52 and NIP-22, the same whoever signs.

### 6.1 Guest keys

A guest service lets a person who isn't on nostr respond with an email address. It signs for them with a key it holds (`event-index` ADR 0002). Its kind 0:

- `name`: the display name the person gave;
- `nip05`: a name under the guest service's own domain;
- `about`: a sentence saying the account was created with an email address and its key is held by the service until its owner takes it.

An email address never appears on a relay: not in the kind 0, not in an RSVP or comment. A guest may take their key (as a [NIP-49](https://github.com/nostr-protocol/nips/blob/master/49.md) `ncryptsec`) or link a key of their own, after which the service stops signing for them.

### 6.2 RSVP

A NIP-52 kind `31925`:

```json
{
  "kind": 31925,
  "content": "",
  "tags": [
    ["a", "31923:<calendar key>:<d>", "<index relay>"],
    ["e", "<id of the version responded to>", "<index relay>"],
    ["d", "<any unique id>"],
    ["status", "accepted"],
    ["p", "<calendar key>", "<index relay>"]
  ]
}
```

- **`d` is any unique id.** NIP-52 says it is generated by the client; Brainstorm writes a random one. A writer SHOULD reuse its previous `d` for the same event when it has it, so that a change replaces the earlier answer.
- **Readers take the newest `31925` per author per `a`**, whatever its `d`. They SHOULD ignore one dated more than a day ahead of their clock, so that a future date can't pin an answer.
- `status` is `accepted`, `declined` or `tentative`; `e` and `fb` are optional, as NIP-52 says.
- A calendar key never RSVPs to its own events, and readers MAY ignore one that does.

### 6.3 Comment

A [NIP-22](https://github.com/nostr-protocol/nips/blob/master/22.md) kind `1111`. A top-level comment on a projection:

```json
{
  "kind": 1111,
  "content": "See you there.",
  "tags": [
    ["A", "31923:<calendar key>:<d>", "<index relay>"],
    ["K", "31923"],
    ["P", "<calendar key>", "<index relay>"],
    ["a", "31923:<calendar key>:<d>", "<index relay>"],
    ["e", "<id of the version commented on>", "<index relay>"],
    ["k", "31923"],
    ["p", "<calendar key>", "<index relay>"]
  ]
}
```

Use `31922` in `K` and `k` for a date-based event. Replies follow NIP-22.

### 6.4 Withdrawing

A response is withdrawn by a NIP-09 kind `5` from its author: for an RSVP, `["e", "<RSVP id>"]`, `["a", "31925:<author>:<d>"]`, `["k", "31925"]`; for a comment, `["e", "<comment id>"]`, `["k", "1111"]`.

### 6.5 Where responses go

To the author's write relays and the host's inbox, which for a calendar key is `<index relay>` (§ 5.3). Never to a relay that takes only list kinds.

## 7. Removing a calendar

An organizer can have their calendar removed. The index decides what proof it accepts (its `spec/`). Then:

1. The entry is republished with `["removed", "organizer request"]` (§ 2.3).
2. Every upcoming projection of the calendar is deleted (§ 4.6), even one that has RSVPs: the organizer asked. Past ones stay.
3. The calendar key's kind 0 `about` becomes the *Removed* sentence (§ 5.2), and its kind `31924` is republished naming only the events that remain.
4. The index drops the key from its contact list (§ 5.6), never polls the feed again, and doesn't file the same `d` again.

## 8. Claiming a calendar

An organizer who proves control of the calendar's source takes it over. Proof is any of:

- a token the index gives them, placed in the calendar's description or in one of its events;
- [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) at the calendar's own domain, naming a pubkey;
- an email to the feed's `ORGANIZER` address, **only** where that address is the organizer's own. It isn't on Luma, whose `ORGANIZER` is always `calendar-invite@lu.ma`.

The organizer then chooses one of two outcomes.

**Use my own key (recommended).** The organizer names their pubkey. The index:

1. republishes the directory entry with its first `p` naming the organizer's key, and `calendar` naming their kind `31924` if they have one. The first `p` is always the calendar's current key. Until the calendar key's last projection has passed, the entry keeps the calendar key as a second `p`, and the index keeps following it (§ 5.6), so readers who find projections through the directory (§ 3.2) still find those; then the index republishes the entry without it;
2. publishes a last kind 0 for the calendar key with the *own key* sentence (§ 5.2), and republishes its kind `31924` with the same words in its content, followed by a [NIP-21](https://github.com/nostr-protocol/nips/blob/master/21.md) `nostr:` link to the organizer's calendar when there is one;
3. stops projecting new events; the upcoming projections stay until they pass, so their RSVPs and comments keep their target, and each one that the organizer has also published names it by § 9.

The organizer's own NIP-52 events are read by kind, like any native event.

**Take the key.** The index publishes the *key handed over* sentence (§ 5.2), hands the key to the organizer as a NIP-49 `ncryptsec`, stops signing with it and deletes its copy. The organizer is told that the index held the key before, and that using their own key is cleaner.

## 9. Copies yield to originals

When an index knows that one of its projections duplicates a NIP-52 event published by someone else (the organizer's own event, after a claim, or a native event that matches the record), the projection names that original by address:

```json
["q", "<kind>:<pubkey>:<d>", "<relay>"]
```

- A reader that holds both shows one event, the original. The original's author governs its content.
- How an index decides that two events are the same is its own (`spec/`).
- This is the events version of the curation-copy rule in [Assistant Designation](./assistant-designation.md) § Curation copies: an addressable original is named by its address, which survives its author's edits. Unlike a curation copy, a projection doesn't carry the original's content, so it carries no `q` naming a version.

## 10. Relays

| Events | Where an index publishes them |
|---|---|
| the headers and the directory entries | `<index relay>`, and relays that hold DLists (such as `wss://dcosl.brainstorm.world`, which takes only kinds `9998`, `9999`, `39998`, `39999` and `7`) |
| projections and calendar keys' kind `31924`s | `<index relay>`; general relays for upcoming events only, rate-limited; search relays that index NIP-52 |
| kind `0` and kind `10002` of every calendar key and of the index key; the index key's kind `3` | `<index relay>`, general relays, and profile relays such as `wss://purplepag.es` |
| deletions | wherever the deleted event went |

A projection's only home is never a relay that ordinary clients can't read. RSVPs and comments go where § 6.5 says.

## 11. Open questions

1. **A role for the end time.** [W31](../worksheet.md#w31--date-display-roles-for-dlist-items) proposes `date` for an item's primary time and leaves the end open. The proposed Events header would carry only `["display", "date", "start"]` until it is settled.
2. **The host role word.** Write `host`, read `host` and `organizer` ([W32](../worksheet.md#w32--the-host-role-word-on-nip-52-p-tags)). To be raised with Formstr and NIP-52's maintainers; if they agree, it goes upstream with the cancellation proposal.
3. **Trust through directory membership** ([W33](../worksheet.md#w33--trust-through-directory-membership)). Until a trust engine reads it, the interim contact list (§ 5.6) caps a single index at about 850 calendars that a follow-based trust lens can see.
4. **Tier two for a bare kind** ([W34](../worksheet.md#w34--tier-two-for-a-bare-kind)). The proposed Events header's declarations would reach only clients that read Method 3 items. A header that declares a kind as its items without each item carrying `z` would let a schema-driven renderer draw native NIP-52 events too.
5. **Cancellation.** The `Cancelled: ` prefix (§ 4.6) is a stopgap until NIP-52 has a convention ([proposal](../upstream/nip-52-cancellation.md)).
6. **`removed` for every DList?** § 2.3 defines it for directory entries only. If it holds for any kind `39999` item, it belongs in the [Decentralized Lists](../nips/decentralized-lists.md) NIP or its companion.
7. **NIP-24's `bot` flag.** A calendar key's content is automated, which is what `bot` marks; but a client that hides or badges bots would undo the point of the key, which is that the organizer shows as host. Calendar keys don't set it for now; their `about` sentence says what they are.
8. **`optional` or `allowed`.** The live *Event Calendars* header declares fields `optional`, Brainstorm-UI's convention; the DList NIP's word for the same thing is `allowed`. Either the NIP gains `optional` as a synonym, or headers write `allowed`.
9. **Publishing the Events header** (§ 3). It costs one `z` per event and serves DList clients that read Method 3 items, but Brainstorm lists no items under it until it reads `item-kind`. Until it is published, projections carry no `z`.
