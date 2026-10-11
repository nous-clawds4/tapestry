> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Companion to:** [NIP-85: Trusted Assertions](https://nips.nostr.com/85) (kind `10040`). Additive: every NIP-85 entry in use today keeps its meaning.
> **Sources:** NIP-85; [`trusted-lists.md`](./trusted-lists.md) § Treasure-Map advertisement (`tl-treasure-map` ADR 0001); [`assistant-designation.md`](./assistant-designation.md) (`community-reference` ADR 0031, `dlist-curation` ADR 0002); [`tags.md`](./tags.md); the companion drafts [Content Categories](./content-categories.md), [Spawning](./spawning.md) and [Pins](./pins.md); the Brainstorm Treasure Map mock-up, September 2026; [`duty-menus.md`](./duty-menus.md) and [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md), with `duty-menus-and-self-maps` ADR 0003 (Self-Maps, § 9.2; the relay hint and the read-time fallback, § 3).
> **Draft 2:**
> - **The list kind says how members are referenced; the category slot says which category.** They are independent.
> - `30397` now means a list of **lists** (members are `z` values), and `30387` a Score about a list.
> - **DList items** get their own kinds: `30396` lists and `30386` Scores, with `a` (`39999`) or `e` (`9999`) members in one list. Every `30397:tag:⟨D⟩…` / `30397:dlist:⟨D⟩` key in draft 1 becomes `30396:…`, and every `30387:…` becomes `30386:…` (§ 12).
> - Whether a `39999`/`9999` event is a header follows [DList Header Declaration](./dlist-header-declaration.md).
> - The `dlist` system applies to every list kind: the kind follows the header's **subject** (§ 4.3).
> - New systems: `pin` and `contexts`.
>
> **If adopted, replaces:** the kind-10040 parse rules in `trusted-lists.md` and `assistant-designation.md` (see § 12).

---

Treasure Maps
=============

`draft` `optional`

A **Treasure Map** is a user's kind-`10040` event from NIP-85. Each of its tags names an **insight** — a Score, a List or a Concept derived from the user's community — together with the **Assistant** that publishes it and a relay where it can be found.

This NIP gives those tags one grammar. It extends NIP-85's `<kind>:<metric>` key so that it can also name Trusted Lists, scores within a context, and Concepts. It lets one entry cover many insights (a **scope**). It makes the **most specific** entry win, so entries can carve out exceptions. And it defines **Preferred** and **Alternate** providers.

## At a glance

```
<kind>:<metric>                             a NIP-85 score (unchanged)
<kind>:tag:<category>:<Tag>                 a Tag-based list      (score: add :<metric>)
<kind>:pin:<category>:<Pin>                 a Pin-based list      (score: add :<metric>)
<kind>:dlist:<DList>                        a DList-based list    (score: add :<metric>)
39998:<d-tag>                               a curated DList (Concept)
<kind> · 3038x · 3039x · *                  a whole kind · all Scores · all Lists · everything
```

- The **kind** says what the members are (pubkeys, events, addressable events, external things, lists). The **category** says which content category they come from.
- Cut a key short, or leave a segment empty, and it covers more.
- The most specific matching key wins.
- The same key listed more than once: the first is Preferred, the rest are Alternates.
- A List's `d` tag, and a Score's value tag, are the key minus its kind.

## 1. Principles

1. **Discovery first.** A Map exists so a client can build a `REQ` filter for an insight: which kind, which author, which relay (§ 3 says where to look when element 3 does not), which `d` tag or value tag. Every entry MUST translate into a filter without guesswork.
2. **A to-do list second.** An Assistant reads the Maps of the people it serves. Each entry naming it is a duty: publish and maintain this insight for that person, except as § 9 says.
3. **What and where, never how.** A Map does not record how an insight is computed: no algorithm, data sources, point of view, cutoffs, or any other part of a Trust Determination Method. These stay private by default. Clients learn what an insight is, why they'd want it and how to find it — nothing more. Assistants are assumed to know how to compute what they publish.
4. **Insights come in kinds; kinds come in families.** Scores (NIP-85 Trusted Assertions, `3038x`), Lists (Trusted Lists, `3039x`) and Concepts (Concept Graph headers, `39998`/`39999`). New insight formats, such as Scorecards, join as new families under the same grammar.
5. **The kind is about members; the category is about content.** A list's kind tells a client what it will do with each member (fetch a profile, fetch an event, query a list). The category slot tells it where the members come from. The two never stand in for each other.
6. **Systems are pluggable.** How an insight is determined — today **Tag-based**, **Pin-based** and **DList-based** — appears in a key as one word. A new system adds a word and a layout, not a new grammar.
7. **Deterministic.** From the Map alone, a client can compute the exact identifier of any insight it wants before contacting a relay. That is why every coordinate inside a key is a *canonical* naddr or nevent (§ 4.1).
8. **General to specific.** A key reads left to right from broad to narrow. A shorter key covers more. Where several keys match an insight, the most specific one wins.

## 2. Terms

- **Observer** — the author of the Map. The insights it names are *for* the observer; those a self-entry names are for the observer its key serves, where it serves one (§ 9.2).
- **Assistant** — the pubkey in element 2 of an entry: the key that signs the insight (NIP-85's "service provider").
- **Insight** — one publishable thing: a Score (a value tag in a NIP-85 assertion event), a List (a Trusted List event) or a Concept (a DList header with its items).
- **Key** — element 1 of an entry.
- **Scope** — everything in a key after the kind.
- **Exact key** — a key that names exactly one insight. Any other key is a **scope key** and covers many.
- **Category** — a content category ([Content Categories](./content-categories.md)): profiles, an event kind (`1`, notes), a NIP-73 type (`isbn`), or a DList (*Restaurants in Nashville*).
- **Subject** — what a list's members are. For a DList, the subject is the item tag its header names in `required` (`p`, `e`, `a`, `i`), or the items themselves if it names none (Content Categories § 5).
- **Tag** — a community-created label from Tags & Taggings: a kind-`39999` tag element such as *Mexican* or *Podcaster*.
- **Pin** — a named personal preference from [Pins](./pins.md), such as *Spawns a Trusted List*.
- **Metric** — the name of a score's value: `rank`, `followers`, `confidence`. It names the output, not the method.
- **Supported sets** — the observer's effective pinned sets: supported Scores, DLists, Tags, Concepts (§ 8).
- **Self-entry**, **self-Map** — § 9.2.
- **⟨Name⟩** — shorthand in this document for the canonical naddr (or nevent) of the named DList header, Tag or Pin.

## 3. The entry

```
["<key>", "<assistant pubkey>", "<relay>"]
```

NIP-85's shape, unchanged. Element 3 is a relay where the insight can be found: a hint, written when the entry was written (NIP-85 calls it a relay hint). It MAY be the empty string, which says that no relay is known; the entry keeps three elements.

A Map entry names who is asked to publish an insight. It does not promise that the insight exists.

**Filling element 3.** When a client writes an entry `[K, A, …]` and fills element 3 from what A publishes, it SHOULD take the relay of A's self-entry whose key is K, where A's self-Map has one (§ 9.2). Keys are compared as §§ 4.1, 4.4 and 4.5 read them, so `39998:dlist-header` is `39998`; a K that is a Concept kind and a colon alone (`39998:`, `39999:`) takes no relay from a self-entry until this NIP settles what such a key means. Otherwise it fills element 3 from A's Duty Menu as [Duty Menus](./duty-menus.md) § 6.2 step 5 says, which also says what to write for a key the menu does not offer and for an Assistant with no menu the client may fill from. A client of the Assistant service that runs A (§ 9), such as an instance writing an entry for its own Tapestry Assistant, MAY read A's menu from that service's own record, whether or not the service has published it; Duty Menus § 6.2 step 5 then applies to it as to a menu found. Its rows say, as a published menu's do, where A's insights will be published (Duty Menus § 5.1). The observer may write any relay by hand.

**When the insight is not there.** A reader that finds no copy of an insight that it accepts (§ 7) at the relay a provider's entry gives, for an entry with the insight's winning key (the empty string, a relay that does not answer, one that answers without it, or a copy older than the reader accepts that does not count as maintained, § 9.2), SHOULD look for it from that provider, A, at these relays, in order, skipping any it has already asked:

1. the relay of the self-entry in A's self-Map that wins the insight (§ 9.2);
2. the relay of the `duty` row of A's Duty Menu that answers the insight's exact key ([Duty Menus](./duty-menus.md) § 6.2), where A's menu is found (Duty Menus § 8.1) and is not a storefront (Duty Menus § 7);
3. the write relays of A's kind 10002 relay list (NIP-65).

A copy the reader does not accept does not end the search. If none of these relays gives a copy it accepts, A's insight is not found (§ 7).

- **Per insight.** The reader resolves the insight by its exact key, not the entry's key: under a scope key, A may publish part of the insights at another relay (Duty Menus § 6.2 step 4).
- **Read-time only.** It takes A's current self-Map and menu each time it reads, and writes nothing into the Map.
- **Storefront rows** never count in step 2, for any reader: they say where a provider's per-customer keys publish, not where the storefront key does (Duty Menus § 7). Duty Menus § 7's exception for the observer's own Assistant is for filling entries, not for reading them.
- **Enumerating** (§ 5.4). A client MAY also enumerate at the relays this fallback gives for the insights under the key: those of A's self-entries and menu rows that win any of them.

§ 7 says when a reader moves on to the next Alternate.

## 4. Keys

### 4.1 Segments, canonical naddrs and nevents

A key is a sequence of **segments** joined by `:`. A segment never contains `:`. So a coordinate — a DList header, a Tag or a Pin — appears in a key as an **naddr** (bech32 has no colons), never as a raw `<kind>:<pubkey>:<d>`.

- **Canonical naddr.** Exactly three TLV entries, in the order `0` (the `d` identifier), `2` (author), `3` (kind), and **no relay entries** (type `1`). Relay hints would let one coordinate encode several ways and break determinism.
- **Canonical nevent.** An immutable DList header (kind `9998` or `9999`) has no coordinate, so it appears as an nevent with exactly one TLV entry, `0` (the event id). No relay, author or kind entries.
- Readers MUST canonicalize every naddr and nevent they read (decode, re-encode) before comparing.
- One naddr holds one coordinate: kind, author, `d`. Never relays, event ids (versions), or anything about how the insight is computed.

### 4.2 The kind slot: what the members are

Segment 1 is one of:

- an **exact kind** — `30382`, `30394`, `39998`, …
- a **family wildcard** — `3038x` (every Score kind) or `3039x` (every List kind)
- **`*`** — every insight.

| Members (List) / subjects (Score) are… | Referenced by | Score kind | List kind |
|---|---|---|---|
| pubkeys | `p` | `30382` | `30392` |
| events | `e` (event id) | `30383` | `30393` |
| addressable events | `a` (coordinate) | `30384` | `30394` |
| **DList items** | `a` (`39999` item) or `e` (`9999` item) | `30386` | `30396` |
| external things (NIP-73) | `i` | `30385` | `30395` |
| **lists**, used as parents | `z` (the list's `z` value) | `30387` | `30397` |

- `3038x` kinds are NIP-85's. `3039x` are their list analogs (trusted-lists.md: list kind = score kind + 10).
- **`30386`/`30396` and `30387`/`30397` are new.** `30396` members are **DList items**: a client fetches each one and reads it through its parent header (named by the category segment of the list's `d` tag). One list holds `39999` and `9999` items alike. The four new kinds are to be proposed together, as part of the Trusted Lists family, not as a NIP-85 amendment for now (worksheet W17).
- `30397` members are **lists**: DList headers referenced by their `z` value, which a client uses to query `#z` for the list's items. That differs from a `30394` member, which a client fetches as an event.
- A `z` value can be an a-coordinate (`39998`/`39999` header), an event id (`9998`/`9999` header), or a human-readable string (the DList NIP's `["z", "dog"]`). So `30397` holds headers of all four kinds in one list, and readers must expect all three value forms.
- **One event, two roles.** A declared kind-`39999` header (DList Header Declaration § 2) is also an item of its parent list. In a `30396` it is a record; in a `30397` it is a list to unpack. The kind says which.
- Concepts (`39998`, `39999`) have their own key shape (§ 4.5).

### 4.3 The category slot, and systems

For Score and List kinds, segment 2 is a **system word** — or, for Scores only, a NIP-85 metric.

| System | List key | Score key | Descriptor |
|---|---|---|---|
| NIP-85 native | — | `<kind>:<metric>` | — |
| `tag` | `<kind>:tag:<category>:<Tag>` | `<kind>:tag:<category>:<Tag>:<metric>` | a Tag |
| `pin` | `<kind>:pin:<category>:<Pin>` | `<kind>:pin:<category>:<Pin>:<metric>` | a Pin |
| `dlist` | `<kind>:dlist:<DList>` | `<kind>:dlist:<DList>:<metric>` | — |
| `contexts` | `<kind>:contexts:<Pin>:<target>` | — | a Pin and a target |

**The category slot** holds a content category of any type (Content Categories § 2):

| Category type | Slot value |
|---|---|
| Profiles | empty |
| Event kind | the kind number, e.g. `30402`; `39998` for *DList headers* |
| External | the NIP-73 type, e.g. `isbn` (percent-encode any `:`) |
| DList | the header's canonical naddr, or canonical nevent |

**The kind and the category must agree.** The list kind is the members' reference type (§ 4.2), and the category must yield members of that type:

- `30392` — profiles (empty), or a DList whose subject is `p`;
- `30393` — a non-addressable event kind, or a DList whose subject is `e`;
- `30394` — an addressable event kind, or a DList whose subject is `a`;
- `30396` — a DList whose items are themselves the subjects (the usual case: restaurants), `39999` and `9999` alike;
- `30395` — a NIP-73 type, or a DList whose subject is `i`;
- `30397` — the *DList headers* category (`39998`), or a DList whose subjects are headers (a list of lists).

**A DList with mixed subjects** (rare: some items are headers, some aren't) spawns one list per kind under the same scope: a `30397` for the headers and a `30396` for the rest.

**System rules:**
- A Score key is always the matching List key plus `:<metric>`, with the kind's fourth digit changed from 9 to 8.
- **`tag` and `pin`** apply to every Score and List kind. A `pin` list holds the observer's *effective pinned set* (Pins § 6), so the supported sets (§ 8) are `pin` lists.
- **`dlist`** applies to every Score and List kind too. The kind follows the DList header's **subject**: `30392:dlist:⟨Nostr developers⟩` (subject `p`), `30396:dlist:⟨Restaurants in Nashville⟩` (`39999` items). A header marked `["items", "assertion"]` (Pins, tagging headers) MUST NOT be used with `dlist`. Its lists come from `tag` or `pin` (Content Categories § 5).
- **`contexts`** (lists only) lists the categories in which a target is pinned (Spawning § 3.3.1).
- Each system has one fixed layout, whatever the kind. A future system registers a word and a layout in this table.

### 4.4 Scopes and wildcards

- An **omitted** trailing segment, or an **empty** segment, means *any*. `30396:tag` and `30396:tag::` both mean every Tag-based list of DList items, for any DList and any Tag.
- An empty segment may sit in the middle: `30396:tag::⟨Vegan⟩` covers the Vegan list of every DList.
- The system slot can't be empty. To cover every system, stop after the kind: `30396`.
- A key whose slots are all filled is exact. For profiles the category slot is always empty and doesn't count; it's in the layout only so every kind shares one layout.

### 4.5 Concepts

Concept keys keep the shape ratified in assistant-designation.md: `39998:<d-tag>` (or `39999:<d-tag>` for a header declared as a kind-39999 item). Split at the **first** colon; the rest is the `d` tag, verbatim, and may contain colons. The bare kind `39998` means all of the observer's Concept headers; the legacy spelling `39998:dlist-header` means the same and stays valid. System words don't apply to Concept keys, and `*:tag` or `*:dlist` never match a Concept.

A curated DList and a DList-based list are different insights. `39998:<d>` asks the Assistant to publish kind-`39998`/`39999` events (a header and its item copies) — a Concept. `30396:dlist:⟨…⟩` asks it to publish a Trusted List — a List. An Assistant may drive both from the same Trust Determination Method, but the Map treats them as separate duties.

### 4.6 Reserved words

`tag`, `pin`, `dlist`, `contexts`, `dlist-header`, and every future system word. A reserved word MUST NOT be used as a NIP-85 metric name or as a Concept `d` tag.

`duty-menu` is not a reserved word in this sense: a kind-`39998` Concept header may use it as its `d`, as the Duty Menu header and its dictionary copies do. [Duty Menus](./duty-menus.md) § 4 reserves it as the `d` of a kind-`39999` menu.

For Map keys: no key matches a kind-`39999` Concept header whose `d` is `duty-menu`, such as an event that breaks that reservation. So `39999:duty-menu` names no Concept and asks for nothing, a client builds no filter for it (§ 5.3), and `*`, `39998` and `39999` never reach such a header, whatever they cover. `39998:duty-menu` is an ordinary Concept key.

### 4.7 Grammar

```
key       = kind-slot [ ":" scope ]
kind-slot = 5DIGIT / "3038x" / "3039x" / "*"
scope     = metric                                      ; NIP-85 native, Score kinds only
          / "tag"      [ ":" cat [ ":" ref [ ":" metric ] ] ]
          / "pin"      [ ":" cat [ ":" ref [ ":" metric ] ] ]
          / "dlist"    [ ":" dl  [ ":" metric ] ]
          / "contexts" [ ":" ref [ ":" target ] ]        ; List kinds only
          / d-tag                                       ; Concept kinds only; rest of string
cat       = "" / 1*DIGIT / nip73-type / dl
dl        = "" / naddr / nevent
ref       = "" / naddr                                  ; a Tag or a Pin
target    = "" / naddr / nevent
metric    = "" / 1*( ALPHA / DIGIT / "_" / "-" / "." )  ; not a reserved word
```

## 5. From entry to filter

A client knows the observer (the Map's author), the Assistant `A` (element 2) and the relay `R` (element 3). When R is empty, or does not hold the insight, § 3 says where to look next.

### 5.1 Lists: the `d` tag is the scope

A List's `d` tag is its exact key without the kind.

```
key:     30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩
filter:  {"kinds":[30396], "authors":[A], "#d":["tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩"]}   on R
members: ["a", "39999:<author>:<restaurant d>"], …   — fetch each restaurant, read it through the header in Z
```

```
key:     30397:pin:39998:⟨Spawns a Trusted List⟩
filter:  {"kinds":[30397], "authors":[A], "#d":["pin:39998:⟨Spawns a Trusted List⟩"]}   on R
members: ["z", "39998:<curator>:restaurants-in-nashville"], …   — query #z for each list's items
```

### 5.2 Scores: the value tag is the scope

A Score's value sits in the subject's NIP-85 assertion event (addressed by its subject, as NIP-85 defines), in a tag whose **name is the scope**. This is NIP-85's own rule — `30382:rank` means "read the `rank` tag" — applied to longer scopes.

```
key:     30386:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩:confidence
filter:  {"kinds":[30386], "authors":[A], "#d":["39999:<author>:<restaurant d>"]}   on R
read:    ["tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩:confidence", "<value>"]
```

- An item filed under several DLists carries one value tag per DList, which is why the context belongs in the tag name.
- For `30386` the subject is a DList item: its coordinate (`39999`) or event id (`9999`) in `d`. For `30387` the subject is a list: its `z` value in `d`.
- A Score scope key reads every value tag whose name matches it under § 4.4: `30382:tag` reads every tag named `tag:…`.

### 5.3 Concepts

As in assistant-designation.md: `39998:<d>` resolves to `{"kinds":[39998], "authors":[A], "#d":["<d>"]}`, then to the items filed under that header, found with `#z`. (No key reaches a kind-`39999` header whose `d` is `duty-menu`, § 4.6.)

### 5.4 Scope keys

A scope key covers many insights. A client can:

1. **Compute exact keys.** It usually knows what it wants (Vegan restaurants in Nashville). It builds that exact key, checks which entry wins it (§ 6) and queries by `#d`.
2. **Enumerate.** To see which lists an Assistant actually publishes under a scope, it fetches that Assistant's lists of the kind (`{"kinds":[30396], "authors":[A]}`) and keeps those whose `d` tag starts with the scope. The `d` tag *is* the scope (§ 5.1).

### 5.5 What published insights carry

- **Lists** MUST use `d` = scope (§ 5.1). What a list is about is read from its `d` tag; lists carry no descriptor tags. Uppercase `K` / `Z` / `T` descriptors were considered and rejected (worksheet W18).
- **`30397` members are references, never membership claims.** A `30397` list's `z` member tags name lists. Readers MUST NOT count a Trusted List as an item of the lists it names. DList retrieval MUST keep its kinds filter (`9999`, `39999`). DList compat readers count a foreign kind only when a header declares it with `item-kind`.
- **Scores** MUST name their value tag with the scope (§ 5.2).

## 6. Precedence: the most specific entry wins

When several entries match an insight, the entry with the most specific key wins. Compare keys segment by segment, left to right. At the first segment where they differ, the more specific one wins:

- kind slot: exact kind, then family wildcard, then `*`
- any later segment: a value beats empty or omitted.

Every matching key agrees with the insight wherever it names a value, so this always picks one winning key. Every entry with that key is a provider for the insight, in order (§ 7). Entries with other keys are ignored for it.

**Example.** A Map carries these five entries:

```
["*",                                                A0, …]
["3039x",                                            A1, …]
["3039x:tag",                                        A2, …]
["30396:tag:⟨Restaurants in Nashville⟩",             A3, …]
["30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩",   A4, …]
```

| Insight | Its exact key | Provider |
|---|---|---|
| Mexican restaurants in Nashville | `30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩` | A4 |
| Vegan restaurants in Nashville | `30396:tag:⟨Restaurants in Nashville⟩:⟨Vegan⟩` | A3 |
| Mexican recipes | `30396:tag:⟨Recipes⟩:⟨Mexican⟩` | A2 |
| Podcasters | `30392:tag::⟨Podcaster⟩` | A2 |
| Restaurants in Nashville, DList-based | `30396:dlist:⟨Restaurants in Nashville⟩` | A1 |
| Supported DLists | `30397:pin:39998:⟨Spawns a Trusted List⟩` | A1 |
| Mexican confidence score for Nashville restaurants | `30386:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩:confidence` | A0 |
| Profile rank | `30382:rank` | A0 |
| Curated Restaurants in Nashville (Concept) | `39998:restaurants-nashville` | A0 |

Two consequences:

- **Scores and Lists are separate.** A4 covers the Mexican *list*, not the Mexican *score*. To give A4 both, add `30386:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩`.
- **The left-most difference decides.** `3039x:tag` beats `*:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩` for the Mexican list, because the kind slot is compared first. To make an exception, name the kind.

**Why left-most rather than most segments.** Counting named segments sounds more intuitive but ties constantly — `30396:tag:⟨Restaurants in Nashville⟩` and `30396:tag::⟨Mexican⟩` each name three — and any tie-break would itself have to be left-most. The left-most rule never ties, matches the general-to-specific order of every key, and can be checked by eye: line the keys up and read across.

## 7. Preferred and Alternate

- Several entries may share one key. Their order matters: the first is the **Preferred** provider; the rest are **Alternates**, in order.
- Clients use the Preferred provider's insight. They fall back to the next Alternate when they find no copy of it that they accept: none at the relay its entry gives, nor, for a reader that follows § 3, at the relays § 3 looks at next. A reader that follows § 3 runs it for each provider in turn before moving to the next. A copy is accepted when it is no older than the reader will accept, or when it counts as maintained (§ 9.2). A reader that does not follow § 3 moves on after the entry's relay. They MAY show or compare Alternates.
- A client may ask several providers' relays at once. It uses the insight of the first provider, in order, whose copy it accepts.
- Every listed provider, Preferred or Alternate, is asked to publish and maintain the insight, except as § 9 says. Alternates are standbys that are already up to date. An Alternate whose duty is confirmed (§ 9.2) is a standby that is ready now.
- Order applies within one key. An entry with a less specific key is never a fallback for a more specific one. To give an insight a fallback, list Alternates on its own key.
- The same pubkey listed twice for one key: later listings are ignored.
- Reordering means republishing the Map with the entries in the new order.
- A NIP-85 client that reads only the first `30382:rank` entry gets the Preferred provider, as intended. trusted-lists.md and assistant-designation.md say that on duplicates the first occurrence wins; this NIP keeps that answer for the Preferred provider and makes later duplicates Alternates instead of ignoring them.

## 8. Supported sets

- In principle a scope key covers "every Tag" or "every DList". In practice it covers the observer's **supported sets**. These are Pin-based lists ([Pins](./pins.md) § 8, [Spawning](./spawning.md) § 3.3):
  - Supported Scores — `30396:pin:⟨Scores⟩:⟨Spawns a Score⟩`
  - Supported DLists — `30397:pin:39998:⟨Spawns a Trusted List⟩` (Lists) and `30397:pin:39998:⟨Spawns a Score⟩` (Scores)
  - Supported Concepts — `30397:pin:39998:⟨Spawns a Concept⟩`
  - Supported Tags — `30396:pin:⟨Tags⟩:⟨Spawns a Trusted List⟩`, with the categories for each Tag in `30396:contexts:⟨Spawns a Trusted List⟩:⟨T⟩`
- So `30396:tag:⟨Restaurants in Nashville⟩` means every Tag supported for Restaurants in Nashville, and `3039x:dlist` means a DList-based list for every supported DList.
- Clients don't need supported sets: they compute exact keys or enumerate (§ 5.4). Supported sets are for Assistants: they turn a scope into a finite to-do list.
- An exact key doesn't depend on supported sets. `30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩` is a duty whether or not Mexican is a supported Tag.
- Supported sets are exempt from the support gate that they themselves define (Spawning § 3.3, the root rule).

## 9. The Assistant's to-do list

- An Assistant reads the Map of each observer it serves. Its duties for that observer are every insight whose winning key (§ 6) lists it, as Preferred or Alternate.
- It expands scope keys over the observer's supported sets (§ 8), limited to the insight kinds and systems it can produce. It ignores entries it doesn't understand.
- How it computes each insight is its own business and stays off the Map (principle 3).
- **One key per observer.** An Assistant service that serves several people signs each person's insights with a separate key; element 2 is the key for this observer. NIP-85 already works this way: a Score event is addressed by its subject alone, so one key can hold only one observer's scores. List `d` tags (§ 5.1) behave the same way.
- **Self-entries.** An entry whose element 2 is the Map's own author is a *self-entry*: that key's report of what it is publishing now (§ 9.2). It creates no duty and designates no one. An Assistant takes duties only from entries that name it in the Maps of the observers it serves, never from its own Map. A reader judges element 2 against the Map's author first: an entry that names the author is a self-entry, whatever else that key signs for, and the next bullet is for every other entry.
- **Naming someone else's Assistant.** An entry other than a self-entry may name a key that signs for someone else — Alice's Assistant, publishing Alice's view. That entry creates no duty: the observer adopts Alice's insight as published. Clients resolve it like any other entry.
- **Finding the Maps.** Relays don't index element 2 of 10040 tags, so an Assistant learns out of band whose Maps to read — its owner's, its customers' (§ 13, question 5).
- **Revocation.** Republishing the Map without the entry ends the duty. Insights already published stay on relays; clients stop resolving them. The Assistant updates its self-Map (§ 9.2) before it stops updating them; § 9.2 also asks it to retract its Lists.

### 9.1 Trust Determination Methods (non-normative)

Methods stay off the Map (principle 3), but keys give them a natural identifier.

- **One parent concept**, *Trust Determination Method*, holds the fields every system shares: point of view, who is trusted, whether to publish. **One child per system** adds its own fields: Tag-based adds the scoring algorithm and cutoffs; DList-based adds its fields as they're defined. A future system adds a child.
- **Each stored method is filed under a key** — the key of the insight, or scope, it governs.
- **The same most-specific rule picks the method.** A method stored for `30396:tag:⟨Restaurants in Nashville⟩` applies to every Tag of that DList unless a more specific method exists. The Default method is the method for `*`.
- So an Assistant needs no extra identifiers: for each duty, the winning Map entry says *who*, and the winning method says *how*.
- The concept's shape (firmware headers, fields, the private item, templates) is in [Trust Determination Methods](./trust-determination-methods.md).

### 9.2 Self-Maps

A key's own Map can report what that key is publishing now. In the examples below, `<key>` → R stands for a self-entry or a `duty` row with that key and relay R, and `not-offered <key>` for a `not-offered` row, as in [Duty Menus](./duty-menus.md) § 6.2.

**Terms.** A *self-entry* is as § 9 defines it. A key's *self-Map* is its own kind 10040, read for its self-entries. Every Assistant SHOULD keep a self-Map, so that clients can tell which of its duties are live.

**Meaning.** A self-entry `[K, A, R]` says that A is publishing at R, and keeping up to date, each insight it speaks for that this self-entry wins. The self-entry that wins an insight is found by § 6 among A's self-entries alone; A's other entries take no part, and where § 6 picks no single one of them, no self-entry wins it. An insight that no self-entry wins is not reported as active. A self-entry means published and maintained, not merely assigned.

**What a self-entry speaks for.** A self-entry is read as § 9 has an Assistant read an entry: one with a scope key speaks only for insights in the supported sets of the observer its key serves (§ 8), and one with an exact key for its one insight. Of those, an Assistant's self-entries speak only for its duties (§ 9): the insights that the Map of the observer it serves gives to it. They say nothing about the other insights under their keys: those the observer gave to another key, and those outside its supported sets. A key that serves only itself, such as a person who publishes their own insights with their own key, speaks for every insight its self-entries win, read over its own supported sets. A key that serves several observers, as NIP-85 allows for an algorithm that is not personalized, has no one observer to read its self-entries over; what they speak for is open, with the other questions about such keys ([Duty Menus](./duty-menus.md) § 14, question 3). Until it is settled, readers read such a key's self-entries as any others (What a reader can tell), and this section's rules on what a self-entry speaks for do not bind them.

**What a reader can tell.** Whether a self-entry speaks for an insight it wins turns on the observer's supported sets and, for an Assistant, on the observer's Map. A reader may hold neither: clients don't need supported sets (§ 8). A reader takes a self-entry to speak for each insight it wins, unless it knows that the self-entry does not.

**Ties.** Where § 6 picks no single self-entry for an insight, as for a bare `39998` and a `39999` key, which § 6 does not yet order ([Duty Menus](./duty-menus.md) § 14, question 5), no self-entry wins it. The self-Map then says less, never something false.

**Its key.** Where it can, an Assistant uses as a self-entry's key the key of the observer's entry that gives it the duties, copied verbatim: where that key, beside A's other self-entries, wins only duties A publishes at one relay. Otherwise it writes narrower keys (below). A key that serves only itself chooses its keys under the same rule.

**Its relay.** Element 3 is the relay where A publishes the insights the self-entry wins that it speaks for. It is never the empty string. Where A publishes a Duty Menu that is not a storefront ([Duty Menus](./duty-menus.md) § 7), it is also the relay A's menu gives the self-entry's key (Duty Menus § 6.2 step 5), save while A moves those insights to that relay (below). A key to which A's menu gives another relay, or none, is not one of its self-entries' keys.

- Example: with A's menu `*` → R0, `3038x` → R1, and an observer who gives A `*` but gives its own Lists and Concepts to another key, A's duties under `*` are Scores, which it publishes at R1. A writes `3038x` → R1, not `*` → R1.

**More than one relay.** Where A publishes some of the duties under one key at another relay (a differing row's part, [Duty Menus](./duty-menus.md) § 6.2 step 4), A adds narrower self-entries naming that relay, so that each self-entry wins only duties A publishes at its relay. The meet of the observer's key with the row that sends them there (Duty Menus § 6.2 step 4) is such a key only when no other row within the key sends part of the meet elsewhere, and when the meets order as their rows do; Duty Menus § 6.2 step 5 shows meets that order the other way. A writes as many narrower self-entries as that takes, such as the meet of the key with a row nested in the part, or the meet of two meets, and checks the whole against the rule below.

- A nested row: with A's menu `3039x` → R0, `3039x:tag` → R1, `30396:tag` → R0, and the observer's `3039x`, A writes `3039x` → R0, `3039x:tag` → R1 and `30396:tag` → R0. Without the last, `3039x:tag` would win the Tag-based lists of DList items, which A publishes at R0.
- Meets that order the other way: with A's menu `3039x` → R0, `30396:tag::⟨T⟩` → R1, `3039x:tag:⟨D⟩` → R2, and the observer's `30396`, the meets `30396:tag::⟨T⟩` → R1 and `30396:tag:⟨D⟩` → R2 would give `30396:tag:⟨D⟩:⟨T⟩` R2, but A publishes it at R1. A adds the meet of the two meets, `30396:tag:⟨D⟩:⟨T⟩` → R1.

**A part A does not publish.** A key MUST NOT write a self-entry, or keep one past a brief gap (below), that wins an insight it speaks for but does not publish at that self-entry's relay. Where the observer's key would do so, because A does not publish part of it (a `not-offered` row within it) or publishes part of it at a relay that no narrower self-entry separates, A writes narrower keys in its place and leaves out what it cannot claim truly. A self-Map says less rather than more.

- Example: with Duty Menus § 13.2's menu (`3038x` → R, `not-offered 30385`) and the observer's `["3038x", A, R]`, A writes `30382`, `30383`, `30384`, `30386` and `30387` → R, not `3038x`. If the observer later gives `30385` to another Assistant, `30385` is no longer A's duty, and A may write `3038x` again.

**No order, no copies.** A self-entry never copies the observer's Preferred and Alternate order, or its other providers. An entry in A's Map that names another key is A's own request, read by § 9 like any entry. Copying the observer's entries would give those keys duties for A. A self-Map may also carry such ordinary entries.

**Private duties** never go in a self-Map's public tags. Whether they may go in `.content` is § 13, question 8.

**No expiration.** A kind 10040 that carries a self-entry carries no `expiration` tag (NIP-40). A self-entry lasts until its key removes it.

**A Concept kind and a colon.** A self-entry's key is never a Concept kind followed by a colon and nothing else (`39998:`, `39999:`); readers ignore such a self-entry. A self-entry writes the bare kind or a full Concept key.

**When it changes.**

- A key MUST NOT add a self-entry before the first full set of the insights it wins, of those it speaks for, has landed at its relay.
- It MAY keep a self-entry through a brief gap: a failed run, a relay that is down for a while, or an insight new among those the self-entry speaks for that the key will publish at the self-entry's relay and that has not landed there yet. A self-entry says that the key is keeping the insights up to date, not that every update has landed. An insight new among those the self-entry speaks for that the key will publish at another relay, or not at all, is no gap: as soon as the key learns of it, it narrows or removes the self-entry so that it does not win that insight, and adds a self-entry for it once its first full set has landed.
- It MUST remove or narrow a self-entry before it stops keeping up to date any insight that the self-entry wins and speaks for, whatever the reason: the service ended, the key was retired, or it can no longer publish it. A brief gap never covers a stop.
- A key MUST NOT add a self-entry that speaks for none of the insights it wins, and MUST remove one as soon as it learns that it speaks for none, as when the observer drops the key.
- A move to another relay ends the self-entry at the old relay, not the insights: the key first publishes a version whose self-entries name the new relay, and only then stops updating the copies at the old one. It does not retract what it moved; the copy left at the old relay is an older version.
- A key changes its self-Map by publishing a new version. Each version's `created_at` MUST be later than the version it replaces: NIP-01 keeps the version with the lowest id when two share a `created_at`, so an equal one can leave a removed self-entry in place. No NIP-09 deletion is needed.

**What follows a stop**, for each family (principle 4):

- **Lists.** A SHOULD retract each List it stops maintaining, whatever the reason: its self-entry was removed, or the List left the insights the self-entry speaks for (the observer gave it to another key, or dropped it from its supported sets). It retracts it by the retraction convention: an empty replacement carrying `["status", "retracted"]` ([Trusted Lists](./trusted-lists.md#common-wire-shape)), with a `created_at` later than the list's last version (NIP-01). A List it moved to another relay and still maintains there is not one it stops maintaining.
- **Scores** have no retraction convention. The removed self-entry is their "stopped" signal, and published values stay on relays (§ 9, Revocation). A Score that left what a self-entry speaks for has no such signal (below).
- **Concepts.** The curated header and its `b` stay ([Assistant Designation](./assistant-designation.md), Revocation); the removed self-entry says that curation has stopped. A does not delete the header, which other headers may point at. Curation copies follow Assistant Designation § Curation copies.

**Finding a self-Map.**

- A self-Map is A's kind 10040: `{"kinds":[10040], "authors":["<A>"]}`.
- A SHOULD send each version, including one that removes a self-entry, to its kind 10002 write relays, to the relays its self-entries name, and to every relay that a self-entry of an earlier version named. It may drop a relay it knows is gone.
- A reader SHOULD ask A's kind 10002 write relays (NIP-65), every relay hint it holds for A (element 3 of the entries naming A), and the relay that each self-entry it reads names. It uses the latest version among the answers: the latest `created_at`, and on a tie the lowest id (NIP-01). The order says where to look first, not where to stop. A relay that does not answer within the reader's own timeout is skipped. A reader may ask fewer relays, and may then get an older version.

**Confirmed duties.** A duty of A is confirmed when A's self-Map has a self-entry that wins it and that the reader takes to speak for it (What a reader can tell): the same key as the observer's entry, or another key that wins it among A's self-entries (§ 6). An entry is confirmed for the insights a self-entry wins and that the reader takes it to speak for, and for no others. § 7 reads a confirmed Alternate as a standby that is ready now.

**Maintained, at its relay.** An insight found at the relay of the self-entry that wins it counts as maintained, whatever its age, when the reader takes that self-entry to speak for it (What a reader can tell). NIP-85 asks providers to republish only when an insight's content changes, so a current insight can be old. A copy found at another relay gets no such allowance, and § 3 looks further for a newer one.

**Spot-check.** Before relying on a self-entry to switch an insight to its key, as when making an Alternate Preferred, a client SHOULD fetch a few of the insights the self-entry wins, at its relay: the self-entry is the key's claim, and the events are the proof.

**As a point of view.** Read as a point of view, like any Map, a self-Map's self-entries show the view of the observer its key serves, where it serves one (§ 9, One key per observer): the slice the key publishes, for the insights they speak for. They can also win insights the key no longer keeps up to date (below), so the view can carry stale copies. Entries in it that name other keys are its author's own requests (§ 9). A self-Map that has both, such as an instance's Tapestry Assistant's, read as a point of view mixes two observers' views.

**What the allowance rests on.** The allowance rests on the key's own word. It holds while the key removes or narrows a self-entry before it stops, and while readers see the change. It does not hold in four cases:

- a key that stops without removing its self-entries (it crashed, lost its key, or was abandoned) keeps its last insights counted as maintained, since a self-Map does not expire; so does a removal a reader never sees, such as one that missed the relay a reader holds for a key whose kind 10002 does not answer;
- until the key has read a change to the observer's Map, its self-entries can win a new duty it has not started;
- a self-entry with a scope key also wins insights outside the observer's supported sets, about which it says nothing. Copies the key published before the observer dropped them from its supported sets are no longer kept up to date: the key should retract the Lists (above), but Scores and Concepts stay as they were. A reader that does not hold the observer's supported sets, a reader of the observer's own Map included, cannot tell, so it takes such a copy as maintained; a reader that holds them does not (What a reader can tell);
- a self-entry can also win an insight that the observer its key serves gave to another key (above). A reader of a Map that names the key as someone else's Assistant, or of the self-Map as a point of view, cannot tell without the observer's Map, so it takes a stale copy of such an insight as maintained, unless it is a List the key retracted.

For a key that serves several observers, the allowance rests on nothing this section asks of the key: what its self-entries speak for is open (above), so no rule binds what they claim, though readers grant the allowance as for any other key. An observer's remedy is its own Map: drop the key, reorder its providers, or give the insight to another key.

**Keys the observer runs.**

- An instance's Tapestry Assistant (TA) keeps a self-Map too: its self-entries report what it publishes for its owner, and it never takes duties from them; it takes them from its owner's Map (§ 9). The TA's kind 10040 is both its self-Map and the instance's own Map, the instance being its own person ([Assistant Designation](./assistant-designation.md), § Relationship to instance identity). Entries in it that name other keys are ordinary entries.
- A person who publishes their own insights with their own key has no customer's Map to read. What they mean to publish next is theirs to keep, off the Map. Their Map names their key only for what is live, as self-entries added and removed as this section says. Their self-entries speak for every insight they win in their own supported sets, so for them too a self-entry means published and maintained.

**Counting Maps.** A self-entry never counts as its key's choice of a provider. A client that counts people by their Maps (adopters, participation, points of view to enumerate) SHOULD count a Map only when at least one of its public entries names a key other than its author. So it leaves out a self-Map made only of self-entries, and an empty Map. It also leaves out the Map of a person who serves as their own Assistant for every insight, since a reader cannot tell that Map from an Assistant's without deciding which keys are Assistants, which this NIP does not ask of it; and a Map whose entries are all private (NIP-85's `.content`), which outsiders cannot read. A person who names another key in a public entry is counted.

**Offered and active.** A key's Duty Menu ([Duty Menus](./duty-menus.md) § 10) says what it offers; its self-Map says what is active.

## 10. Every entry type

Each row gives a key pattern, an example where the pattern has parts, and the entry in plain English: read the column heading, then the row. Every Score kind, List kind and system in § 4 appears below. Scope keys always end with *"except where this Map says otherwise"* (§ 6).

### 10.1 Everything, and whole classes

| Key | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|
| `*` | …every insight for me — all my Scores, Lists and Concepts — except where this Map says otherwise. |
| `3038x` | …all my Scores, except where this Map says otherwise. |
| `3039x` | …all my Trusted Lists, except where this Map says otherwise. |
| `39998` (legacy: `39998:dlist-header`) | …my Concept Graph — my DList headers and the items filed under them — except where this Map says otherwise. |

### 10.2 Whole systems

| Key | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|
| `*:tag` | …every Tag-based insight for me, Scores and Lists, except where this Map says otherwise. |
| `*:pin` | …every Pin-based insight for me, including my supported sets, except where this Map says otherwise. |
| `*:dlist` | …every DList-based insight for me, Scores and Lists, except where this Map says otherwise. |
| `3038x:tag` | …all my Tag-based Scores, except where this Map says otherwise. |
| `3038x:dlist` | …all my DList-based Scores, except where this Map says otherwise. |
| `3039x:tag` | …all my Tag-based Trusted Lists, except where this Map says otherwise. |
| `3039x:pin` | …all my Pin-based Trusted Lists, including my supported sets, except where this Map says otherwise. |
| `3039x:dlist` | …all my DList-based Trusted Lists, except where this Map says otherwise. |

### 10.3 Whole kinds

| Key | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|
| `30382` | …every Score about profiles, of any system and metric, except where this Map says otherwise. |
| `30383` | …every Score about events, except where this Map says otherwise. |
| `30384` | …every Score about addressable events, except where this Map says otherwise. |
| `30386` | …every Score about DList items, except where this Map says otherwise. |
| `30385` | …every Score about external things — books, websites, podcasts — except where this Map says otherwise. |
| `30387` | …every Score about lists, except where this Map says otherwise. |
| `30392` | …every Trusted List of profiles, except where this Map says otherwise. *(Tapestry's existing generic entry.)* |
| `30393` | …every Trusted List of events, except where this Map says otherwise. |
| `30394` | …every Trusted List of addressable events, except where this Map says otherwise. |
| `30396` | …every Trusted List of DList items, Tag-based, Pin-based and DList-based, except where this Map says otherwise. |
| `30395` | …every Trusted List of external things, except where this Map says otherwise. |
| `30397` | …every Trusted List of lists, such as my supported DLists, except where this Map says otherwise. |

### 10.4 NIP-85 native Scores

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30382:<metric>` | `30382:rank` | …a rank for every profile, as seen from my trusted community. |
| `30383:<metric>` | `30383:offensive` | …an "offensive" score for every event. |
| `30384:<metric>` | `30384:rank` | …a rank for every addressable event. |
| `30385:<metric>` | `30385:rank` | …a rank for every external thing. |

### 10.5 Tag-based: profiles (`30392`, `30382`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30392:tag` | | …one Trusted List of profiles for each Tag in my supported Tags for profiles, except where this Map says otherwise. |
| `30392:tag::<Tag>` | `30392:tag::⟨Podcaster⟩` | …the Trusted List of every profile my trusted community tags as Podcaster. |
| `30392:tag:<DList>:<Tag>` | `30392:tag:⟨Nashville Chefs⟩:⟨Vegan⟩` | …the Trusted List of the Nashville chefs (a DList of people) my trusted community tags as Vegan. |
| `30382:tag` | | …for every profile, a Score for each Tag in my supported Tags for profiles, in every metric, except where this Map says otherwise. |
| `30382:tag::<Tag>` | `30382:tag::⟨Podcaster⟩` | …for every profile, its Podcaster Scores in every metric, except where this Map says otherwise. |
| `30382:tag::<Tag>:<metric>` | `30382:tag::⟨Podcaster⟩:confidence` | …for every profile, a confidence score for how strongly my trusted community agrees it is a Podcaster. |
| `30382:tag:::<metric>` | `30382:tag:::confidence` | …for every profile, a confidence score for each Tag in my supported Tags for profiles, except where this Map says otherwise. |

### 10.6 Tag-based: events (`30393`, `30383`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30393:tag` | | …for each event category I support, one Trusted List per supported Tag, except where this Map says otherwise. |
| `30393:tag:<kind>` | `30393:tag:1` | …one Trusted List of notes for each Tag in my supported Tags for notes, except where this Map says otherwise. |
| `30393:tag:<kind>:<Tag>` | `30393:tag:1:⟨Bitcoin⟩` | …the Trusted List of every note my trusted community tags as Bitcoin. |
| `30393:tag::<Tag>` | `30393:tag::⟨Bitcoin⟩` | …for each event category I support, the Trusted List of events my trusted community tags as Bitcoin, except where this Map says otherwise. |
| `30383:tag:<kind>:<Tag>:<metric>` | `30383:tag:1:⟨Bitcoin⟩:confidence` | …for every note, a confidence score for how strongly my trusted community agrees it is about Bitcoin. |
| `30383:tag:<kind>` | `30383:tag:1` | …for every note, a Score for each Tag in my supported Tags for notes, in every metric, except where this Map says otherwise. |

### 10.7 Tag-based: addressable events (`30394`, `30384`) and DList items (`30396`, `30386`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30394:tag` | | …for each addressable kind I support, one Trusted List per supported Tag, except where this Map says otherwise. |
| `30396:tag` | | …for each DList in my supported DLists, one Trusted List per supported Tag, except where this Map says otherwise. |
| `30394:tag:<kind>` | `30394:tag:30023` | …one Trusted List of long-form articles for each Tag in my supported Tags for articles, except where this Map says otherwise. |
| `30394:tag:<kind>:<Tag>` | `30394:tag:30023:⟨Tutorial⟩` | …the Trusted List of every long-form article my trusted community tags as Tutorial. |
| `30394:tag:<kind>:<Tag>` | `30394:tag:30402:⟨Handmade⟩` | …the Trusted List of every product listing my trusted community tags as Handmade. |
| `30396:tag:<DList>` | `30396:tag:⟨Restaurants in Nashville⟩` | …one Trusted List for each and every Tag in my list of supported Tags of Restaurants in Nashville, except those Tags assigned to other Assistants in this Treasure Map. |
| `30396:tag:<DList>:<Tag>` | `30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩` | …the Trusted List of every Restaurant in Nashville that is tagged as Mexican by my trusted community. |
| `30396:tag::<Tag>` | `30396:tag::⟨Vegan⟩` | …for each DList I support, the Trusted List of its items my trusted community tags as Vegan, except where this Map says otherwise. |
| `30386:tag:<DList>` | `30386:tag:⟨Restaurants in Nashville⟩` | …for every Restaurant in Nashville, a Score for each supported Tag, in every metric, except where this Map says otherwise. |
| `30386:tag:<DList>:<Tag>:<metric>` | `30386:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩:confidence` | …for every Restaurant in Nashville, a confidence score for how strongly my trusted community agrees it is Mexican. |
| `30384:tag:<kind>:<Tag>:<metric>` | `30384:tag:30023:⟨Tutorial⟩:confidence` | …for every long-form article, a confidence score for how strongly my trusted community agrees it is a Tutorial. |


### 10.8 Tag-based: external identifiers (`30395`, `30385`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30395:tag` | | …for each type of external thing I support, one Trusted List per supported Tag, except where this Map says otherwise. |
| `30395:tag:<type>` | `30395:tag:isbn` | …one Trusted List of books for each Tag in my supported Tags for books, except where this Map says otherwise. |
| `30395:tag:<type>:<Tag>` | `30395:tag:isbn:⟨Science Fiction⟩` | …the Trusted List of every book my trusted community tags as Science Fiction. |
| `30385:tag:<type>:<Tag>:<metric>` | `30385:tag:isbn:⟨Science Fiction⟩:confidence` | …for every book, a confidence score for how strongly my trusted community agrees it is Science Fiction. |

### 10.9 DList-based (kind follows the header's subject)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `3039x:dlist` | | …one Trusted List for each DList in my supported DLists, except where this Map says otherwise. |
| `30396:dlist:<DList>` | `30396:dlist:⟨Restaurants in Nashville⟩` | …the Trusted List of every item my trusted community accepts as a genuine Restaurant in Nashville. |
| `30392:dlist:<DList>` | `30392:dlist:⟨Nostr developers⟩` | …the Trusted List of the pubkeys my trusted community accepts as nostr developers. |
| `30394:dlist:<DList>` | `30394:dlist:⟨Nostr communities⟩` | …the Trusted List of the communities (kind `34550`, pointed at by the list's items) my trusted community accepts. |
| `3038x:dlist` | | …Scores for the subjects of every DList in my supported DLists, in every metric, except where this Map says otherwise. |
| `30386:dlist:<DList>` | `30386:dlist:⟨Restaurants in Nashville⟩` | …for every item of Restaurants in Nashville, its Scores in every metric, except where this Map says otherwise. |
| `30386:dlist:<DList>:<metric>` | `30386:dlist:⟨Restaurants in Nashville⟩:confidence` | …for every item of Restaurants in Nashville, a confidence score for how strongly my trusted community agrees it belongs there. |
| `30382:dlist:<DList>:<metric>` | `30382:dlist:⟨Nostr developers⟩:confidence` | …for every pubkey on the list of nostr developers, a confidence score for how strongly my trusted community agrees they belong there. |

### 10.10 Lists of lists (`30397`, `30387`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30397:dlist:<DList>` | `30397:dlist:⟨Lists of good movies by genre⟩` | …the Trusted List of the genre lists my trusted community accepts onto this list of lists. |
| `30397:tag:39998:<Tag>` | `30397:tag:39998:⟨Local⟩` | …the Trusted List of DLists my trusted community tags as Local. |
| `30387:tag:39998:<Tag>:<metric>` | `30387:tag:39998:⟨Local⟩:confidence` | …for every DList, a confidence score for how strongly my trusted community agrees it is Local. |
| `30387:dlist:<DList>:<metric>` | `30387:dlist:⟨Lists of good movies by genre⟩:confidence` | …for every genre list on that list of lists, a confidence score for how strongly it belongs there. |

### 10.11 Pin-based: supported sets and preferences (`pin`, `contexts`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `30397:pin:39998:<Pin>` | `30397:pin:39998:⟨Spawns a Trusted List⟩` | …my Supported DLists: the DLists whose Trusted Lists my Assistant publishes, as my community curates them and as I adjust them. |
| `30397:pin:39998:<Pin>` | `30397:pin:39998:⟨Spawns a Concept⟩` | …my Supported Concepts: the DLists my Assistant curates as Concepts. |
| `30396:pin:<DList>:<Pin>` | `30396:pin:⟨Scores⟩:⟨Spawns a Score⟩` | …my Supported Scores: the metrics my Assistant calculates and publishes. |
| `30396:pin:<DList>:<Pin>` | `30396:pin:⟨Tags⟩:⟨Spawns a Trusted List⟩` | …my Supported Tags: the Tags whose Trusted Lists my Assistant publishes. |
| `30396:contexts:<Pin>:<target>` | `30396:contexts:⟨Spawns a Trusted List⟩:⟨Mexican⟩` | …the content categories in which Mexican spawns a Trusted List for me. |
| `30396:pin:<DList>:<Pin>` | `30396:pin:⟨Tags⟩:⟨Show on profile pages⟩` | …the Tags I want shown on profile pages, in my order. |

### 10.12 Concepts (`39998`, `39999`)

| Key | Example | *I entrust Bob's Brainstorm Assistant to publish and maintain…* |
|---|---|---|
| `39998:<d-tag>` | `39998:restaurants-nashville` | …my curated copy of Restaurants in Nashville: its header, and a copy of each item my trusted community accepts. |
| `39999:<d-tag>` | `39999:nashville-food-trucks` | …my curated copy of a DList whose header is declared as a kind-39999 item. |

(The bare `39998` is in § 10.1.)

### 10.13 Reserved: future insight types

A **Scorecard** is one event per observer, observee and context, carrying GrapeRank's average, input, confidence and influence. The scope *is* GrapeRank's context, so a Scorecard family needs new kinds, not a new grammar: a key like `<scorecard kind>:tag::⟨Podcaster⟩` would read *"…for every profile, a Scorecard in the context of Podcaster."* Its kinds and addressing are to be defined.

## 11. The format questions, answered

**What goes in the Map for "Vegan Restaurants in Nashville"?**
`["30396:tag:⟨Restaurants in Nashville⟩:⟨Vegan⟩", "<assistant>", "<relay>"]`. The category and the Tag both go in the key, each as its own canonical naddr. So does the kind — `30396`, because the members are the restaurants themselves: DList items. (If the category were an event kind — notes about Bitcoin — the kind would be `30393` and the category `1`.)

**A1, A2 or A3?** A2, refined three ways: a system word after the kind, the category before the Tag, and canonical naddrs.

- *A1 (no kind).* A client can't fill `kinds` in its filter, and can't tell a Score (`30386`) from a List (`30396`) about the same pair — the distinction the mock's Scores and Lists toggles rely on. It also breaks every NIP-85 parser, which expects the kind first.
- *A3 (one packed naddr).* An naddr holds one address; holding two needs a new encoding that existing tools can't read. And a packed token is all-or-nothing, so it can't say "every Tag of this DList": no scopes, so no exceptions. A3's real advantage — room to grow — A2 keeps, because new systems and slots can be added.
- *Category before Tag.* General to specific: supported Tags belong to a category ("my supported Tags of Restaurants in Nashville"), so cutting the Tag off leaves exactly "every Tag of this DList". "Vegan in every DList" is still expressible: `30396:tag::⟨Vegan⟩`.

**Should the z-tag replace the kind?** It takes over the kind's second job, not its first. The kind slot stays the kind of the insight event, which says what the members are. The category, which the kind used to imply, gets its own slot: an event kind, a NIP-73 type, or a DList header. That follows the move from NIPs and event kinds to DList headers without breaking NIP-85.

**Why isn't a Trusted List of restaurants a `30397`?** Because `30397` is for members that are *lists*. A restaurant is a DList item (`30396`); a client fetches it. A member of Supported DLists is a list; a client queries `#z` with it. The same `a`-shaped value means different things in the two, so they need different kinds.

**How many colons?** A fixed number per system (§ 4.3), the same for every kind. Fewer segments, or an empty one, makes a scope.

**What goes in an naddr?** One coordinate: kind, author, `d`. Never relays, which break determinism, and nothing about how the insight is computed.

**Will clients have to decode every naddr in a Map?** No. For any exact key a client computes the `d` tag (Lists) or the value tag (Scores) directly: both are the scope. Decoding is needed only to show names, and it's cheap — naddrs are encoded, not encrypted.

**How do I give everything to one Assistant?** `["*", …]` — Assistant0. More specific entries carve out the exceptions (§ 6).

## 12. Migration

| Today (mock, Tapestry, or draft 1) | Under this draft |
|---|---|
| `30382:rank`, `30382:followers`, `30383:offensive`, … | unchanged |
| `30392` (Tapestry's generic list entry) | unchanged: a bare kind covers the whole kind |
| `30382:tag`, `30383:tag`, `30392:tag`, `30393:tag` | unchanged |
| `30397:tag`, `30387:tag` (all Tag-based lists / scores of DList items) | `30396:tag`, `30386:tag` |
| `30397:dlist`, `30387:dlist` | `3039x:dlist`, `3038x:dlist` (the kind now follows each header's subject) |
| `30397:tag:⟨D⟩:⟨T⟩`, `30387:tag:⟨D⟩:⟨T⟩:<metric>` (draft 1) | `30396:tag:⟨D⟩:⟨T⟩`, `30386:tag:⟨D⟩:⟨T⟩:<metric>` |
| `30397:dlist:⟨D⟩`, `30387:dlist:⟨D⟩:<metric>` (draft 1) | `30396:dlist:⟨D⟩`, `30386:dlist:⟨D⟩:<metric>` — or `30392` / `30382` etc., by subject |
| `30392:<Tag>` (Pubkey method with a Tag) | `30392:tag::<Tag>` |
| `30382:<Tag>:rank` | `30382:tag::<Tag>:rank` |
| `30397:<DList>:<score>` (mock: DList-based method, Lists) | `30396:dlist:<DList>`: Lists carry no metric |
| `30387:<DList>:<score>` (mock: DList-based method, Scores) | `30386:dlist:<DList>:<score>` |
| TBD: Nostr Event Kind (with or without a Tag) | `30393:tag:<kind>[:<Tag>]`; for an addressable kind such as `34550` communities, `30394:tag:<kind>[:<Tag>]` |
| TBD: Nostr Event ID with a Tag | `30393:tag::<Tag>` (a scope over event categories) |
| TBD: Nostr Event Address with a Tag | `30394:tag::<Tag>` (a scope over addressable-event categories) |
| TBD: DList Header with a Tag | `30396:tag:<DList>:<Tag>` |
| TBD: DList Header, no Tag (Tag-based) | `30396:tag:<DList>`: every Tag of that DList |
| `39998:dlist-header` | unchanged; same as `39998` |
| `39998:<d-tag>` (per-DList curation) | unchanged |
| Mock Concepts: `39998:<pubkey>:recipe:thanksgiving` | `39998:<d-tag>`: the header's author belongs in element 2 |
| List `d` tags such as `tl-pin-<obs8>-<tagAuthor8>-<slug>` | `d` = scope; old lists retracted in place (trusted-lists.md retraction convention) |
| Duplicate keys: first wins, later ones ignored | first is Preferred, later ones are Alternates |
| trusted-lists.md "named entries (reserved)" | realized: a more specific key overrides a less specific one (§ 6) |

The mock's "Nostr Event ID" and "Nostr Event Address" rows are read here as "events of any kind" and "addressable events of any kind".

## 13. Open questions

1. ~~Descriptor tag letters~~ — rejected (W18): lists carry no descriptor tags.
2. **Empty categories.** Here an empty category is always a scope (except for profiles), so there is no single "Bitcoin events of any kind" list; clients combine the per-category lists. Should an "any category" list exist too?
3. ~~Profiles within a category~~ — resolved: a DList whose subject is `p` is a category of `30392` (§ 10.5).
4. **NIP-73 types with colons** (`podcast:guid`). Proposal: percent-encode them (`podcast%3Aguid`).
5. **Finding one's duties.** Add optional `["p", "<assistant pubkey>"]` tags to the Map, so an Assistant can find the Maps naming it with `#p`? They reveal nothing the entries don't, but some clients notify on `p` tags. If they are adopted, an Assistant that finds Maps by `#p` skips any Map it wrote itself: its self-entries name it but create no duty (§ 9).
6. **Map size.** An exact key with two naddrs runs to about 250 characters. Scopes keep Maps small; a Map full of exceptions may hit relay size limits.
7. **NIP-85-only clients** read only exact `<kind>:<metric>` keys, so a Map that relies on `*` is invisible to them. Writers SHOULD also write explicit NIP-85 entries for the metrics they care about, naming the same providers (§ 14 does this for `30382:rank`).
8. **Private entries.** Decided (W22): private items follow one pattern everywhere. They are published by the owner's Assistant, NIP-44-encrypted to itself, and marked `["private", "1"]`. Delegation entries in the Map stay public until NIP-85's current private-entry text is checked. A self-Map keeps private duties out of its public tags (§ 9.2).
9. **Named variants of one list.** The mock's DList-based stored methods put a score name on the List key (`30397:<DList>:<score>`). This draft drops it: one list per exact key. If two lists for one DList are ever needed, that means a new system word, not a trailing name.
10. **Scorecards.** Kinds and addressing (subject plus context) to be defined (§ 10.13).
11. ~~Mixed-item DLists~~ — resolved: `30396` holds `39999` and `9999` items in one list.
12. **Is `*:<scope>` needed?** A `*:…` key never reaches a Concept (§ 4.3, § 4.5), so `*:<scope>` reaches exactly what `3038x:<scope>` and `3039x:<scope>` reach together. Dropping it would leave a bare `*` as the only key for everything, and remove the precedence cases between a family key and a `*:…` key (§ 6). For now, Brainstorm's Treasure Map page reads only a bare `*` (`*:` with nothing after it is the same key) and ignores any other `*:…` entry.

## 14. A complete Map

```json
{
  "kind": 10040,
  "pubkey": "<observer>",
  "tags": [
    ["30382:rank", "<my Brainstorm Assistant>", "wss://nip85.brainstorm.world"],
    ["30382:rank", "<my Tapestry Assistant>", "wss://nip85.nostr1.com"],
    ["*", "<my Brainstorm Assistant>", "wss://nip85.brainstorm.world"],
    ["3039x:tag", "<Bob's Brainstorm Assistant>", "wss://nip85.bob.example"],
    ["30396:tag:⟨Restaurants in Nashville⟩", "<Carol's Assistant>", "wss://relay.carol.example"],
    ["30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩", "<Dave's Assistant>", "wss://relay.dave.example"],
    ["30396:tag:⟨Restaurants in Nashville⟩:⟨Mexican⟩", "<Carol's Assistant>", "wss://relay.carol.example"],
    ["39998:restaurants-nashville", "<my Tapestry Assistant>", "wss://dcosl.brainstorm.world"]
  ],
  "content": ""
}
```

Read in plain English:

- **Profile rank:** my Brainstorm Assistant, with my Tapestry Assistant as the Alternate. It's written out so NIP-85-only clients see it; `*` would otherwise cover it.
- **Everything else:** my Brainstorm Assistant (`*`), including my supported sets, except:
  - Tag-based Trusted Lists go to Bob's Brainstorm Assistant;
  - except the Tag-based lists of Restaurants in Nashville, which go to Carol's Assistant;
  - except Mexican restaurants in Nashville, which go to Dave's Assistant, with Carol's as the Alternate.
- **My curated copy of Restaurants in Nashville:** my Tapestry Assistant.
