> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Draft 3:** DList items get their own kinds (`30396`/`30386`); header detection moves to [DList Header Declaration](./dlist-header-declaration.md).
> **Draft 2:** the list kind follows how members are referenced, not the category type (§ 2); `30397` = lists of lists. Adds the subject rule and the assertion marker (§ 5).
> **Canonical:** not yet published
> **Sources:** [`decentralized-lists.md`](../nips/decentralized-lists.md); `decentralized-lists-compat.md` (foreign kinds as list items); `class-thread-relationships.md` (`n`); `inherit-from.md` / `shared-concepts.md` (`b`); the companion drafts [Treasure Maps](./treasure-maps.md), [Spawning](./spawning.md) and [Pins](./pins.md); Brainstorm search results' category chips.
> **Why this exists:** the Treasure Map category slot, the Tag and Pin context, and the search chips all rely on the idea of a *content category*, but nothing defines it. This NIP does.

---

Content Categories
==================

`draft` `optional`

A **content category** is a kind of thing a person might look for, tag, pin or trust-rank: *profiles*, *product listings*, *Restaurants in Nashville*. On Brainstorm's search results, each chip is a content category.

Every content category is one of **four types**, told apart by *how an item says what it is*:

| Type | A category is… | Example | An item claims membership by… | Items are referenced by |
|---|---|---|---|---|
| **Profile** | the one category of all pubkeys | *Profiles* | being a pubkey — no claim needed | `p` |
| **Event kind** ("old-school DList") | a nostr event kind, defined by a NIP | *Product listings* (kind `30402`, NIP-99) | its `kind` field | `e`, or `a` if addressable |
| **DList** (Tapestry DList) | a Decentralized List header | *Restaurants in Nashville* | its `z` tag | `a` for `39999` items, `e` for `9999` |
| **External** (NIP-73) | a type of external identifier | *Books* (`isbn`) | the type prefix of its identifier | `i` |

## 1. The two kinds of list

- **Tapestry DLists** follow the [Decentralized Lists](../nips/decentralized-lists.md) NIP literally.
  - A list header (kind `39998`/`9998`) describes the list, including the expected format of its items.
  - Each item self-identifies with a `z` tag pointing at the header: *child claims parent*.
- **Old-school DLists** are ordinary nostr NIPs, read through the same lens.
  - A NIP plays the part of the list header: it describes the category and its items' format.
  - The event `kind` plays the part of the `z` tag: an event of kind `30402` claims to be a product listing, just as a `39999` item with `z` → Restaurants in Nashville claims to be a restaurant in Nashville.

  The nostr community doesn't call NIPs "lists"; the analogy is imperfect but useful. It lets one set of rules — for tagging, pinning, spawning Trusted Lists and ranking — cover both.

### 1.1 Why Tapestry DLists

- **They're unlimited.** Addressable event kinds are a finite namespace — about ten thousand — shared by every developer, so each new kind risks colliding with someone else's use. `z` values are unlimited: anyone can make as many DList headers as they want without polluting anyone's kind space.
- **Anyone can make one.** Defining a NIP takes a nostr developer. A DList is meant to be created on the fly by anyone — "Taco Trucks in Nashville" — with no knowledge of the protocol. That is the democratizing step.

Old-school DLists stay first-class: most nostr content lives in them, and they carry community agreement that no single DList yet has.

### 1.2 Profiles

Profiles are a type of their own, not an event kind.

- A pubkey needs no event to exist, and a profile tagging targets the pubkey (`p`), not its kind-`0` metadata event.
- There is exactly **one** profile category. "Podcasters" is not a category; it is a Tag applied to profiles (or a DList of people, which is a DList category).

### 1.3 DList headers — one category, four kinds

The Decentralized Lists NIP allows a list header in **four kinds**. Which events are headers is specified in [DList Header Declaration](./dlist-header-declaration.md):

> Kinds `39998` and `9998` are always headers. Kinds `39999` and `9999` are **items by default**, and headers only when they declare it with `["z", "list"]` or `z` → the Concept for Concept Headers.

So **DList headers** is one content category, of the event-kind type, defined by that rule rather than a single kind.

- **Discovery** takes two filters (DList Header Declaration § 3): `{"kinds":[39998, 9998]}`, plus `{"kinds":[39999, 9999], "#z":["list", "<Concept for Concept Headers>"]}`.
- **Its canonical identifier is `39998`**, whichever of the four kinds a given header has. That is the category slot value (§ 2).
- *"Tag a DList"* and *"pin a DList"* mean tagging or pinning its header, whatever its kind.
- The same header is also a **DList** category in its own right, whose items are the list's items. The header as a *target* is an item of *DList headers*; the header as a *category* is a parent of items.
- § 6 checks the rest of the protocols for places that assumed headers are always `39998`.

## 2. Identifying a category

| Type | Canonical identifier | In a Treasure Map / spawn key category slot | As a pinning context |
|---|---|---|---|
| Profile | the firmware item `39999:<TA>:profiles` | empty | `["context", "39999:<TA>:profiles"]` |
| Event kind | the kind number (`39998` for *DList headers*) | the number, e.g. `30402` | `["context", "39999:<TA>:kind-30402"]` |
| DList | the header's a-coordinate (`39998` or `39999` header), or its event id (`9998` or `9999`) | its canonical naddr, or canonical nevent | `["context", "<header coord or id>"]` |
| External | the NIP-73 type (`isbn`, `web`, `podcast:guid`, …) | the type (percent-encode any `:`) | `["context", "39999:<TA>:external-isbn"]` |

- The **category slot** is unchanged from the Treasure Maps draft, except that a DList category may now be a canonical **nevent** (only the event-id TLV, for determinism) when its header is immutable.
- **Pinning contexts** (Pins § 3; pending review) name a category by coordinate: a DList header, or a `content-category` item for profiles, event kinds and external types. The uppercase `K` / `Z` descriptor letters were rejected (worksheet W18).
- The **list kind** a category spawns follows from its type (Spawning § 2), and within a type from how items are referenced:

| Category type | Items are | Trusted List kind | Score kind |
|---|---|---|---|
| Profile | pubkeys | `30392` | `30382` |
| Event kind, items referenced by id | events | `30393` | `30383` |
| Event kind, items referenced by address | addressable events | `30394` | `30384` |
| DList | the header's **subject** (§ 5.1): the items themselves → `30396` (`39999` and `9999` alike); subject `p` → `30392`; `e` → `30393`; `a` → `30394`; `i` → `30395`; subjects that are headers → `30397` | by subject | by subject |
| External | NIP-73 identifiers | `30395` | `30385` |
| *any*, when the members are **lists** used as parents (e.g. *DList headers* as lists) | `z` values | `30397` | `30387` |

**The rule:** the list kind says how members are referenced (`p`, `e`, `a`, `i`, `z`), and so what a client does with each one; the category slot says which category they come from. A `30396` member is a DList item: fetch it and read it through its header. A `30397` member is a list: unpack it with `#z`.

The External row follows NIP-85, where `30385` scores NIP-73 identifiers; `30395` is its list analog, by the same +10 rule as the other list kinds.

One `30396` list holds `39999` and `9999` items together, and one `30397` list holds headers of all four kinds, by coordinate or event id.

## 3. Firmware: two Shared Concepts

Each is seeded under the deployment's authority key, with a self-pointing `b` (Protocol amendments § 3).

### 3.1 Content category types

```json
{ "kind": 39998, "pubkey": "<TA>", "tags": [
  ["d", "content-category-type"],
  ["names", "content category type", "content category types"],
  ["description", "The four ways a content category is identified: profile, event kind, DList, external."],
  ["b", "39998:<TA>:content-category-type"],
  ["required", "slug"], ["required", "description"]
]}
```

Four items (kind `39999`, `z` → `39998:<TA>:content-category-type`):

| `d` | `name` | `description` | extra tags |
|---|---|---|---|
| `profile` | Profile | The single category of all nostr pubkeys. Items are pubkeys; no membership claim is needed. | `["member", "p"]` |
| `event-kind` | Event kind | A category defined by a NIP and identified by an event kind ("old-school DList"). Items claim membership by their kind. | `["member", "e"]`, `["member", "a"]` |
| `dlist` | DList | A category defined by a Decentralized List header. Items claim membership with a `z` tag. | `["member", "a"]`, `["member", "e"]` |
| `external` | External | A category of things outside nostr, identified by a NIP-73 type (`isbn`, `web`, …). Items claim membership by their identifier's type. | `["member", "i"]` |

### 3.2 Content categories

```json
{ "kind": 39998, "pubkey": "<TA>", "tags": [
  ["d", "content-category"],
  ["names", "content category", "content categories"],
  ["description", "Kinds of things people search for, tag, pin and rank. Each item names its type with an n tag."],
  ["b", "39998:<TA>:content-category"],
  ["required", "n", "Its content category type"],
  ["recommended", "k", "For event-kind categories: the kind"],
  ["recommended", "a", "For DList categories: the header"]
]}
```

Items (kind `39999`, `z` → `39998:<TA>:content-category`). Each names its type with the class-thread `n` tag ("member of the set"):

```json
{ "kind": 39999, "pubkey": "<TA>", "tags": [
  ["d", "profiles"], ["z", "39998:<TA>:content-category"],
  ["n", "39999:<TA>:profile"],
  ["names", "profile", "profiles"]
]}
```

```json
{ "kind": 39999, "pubkey": "<TA>", "tags": [
  ["d", "kind-30402"], ["z", "39998:<TA>:content-category"],
  ["n", "39999:<TA>:event-kind"],
  ["k", "30402"], ["nip", "99"],
  ["names", "product listing", "product listings"]
]}
```

```json
{ "kind": 39999, "pubkey": "<curator>", "tags": [
  ["d", "category-restaurants-in-nashville"], ["z", "39998:<TA>:content-category"],
  ["n", "39999:<TA>:dlist"],
  ["a", "39998:<curator>:restaurants-in-nashville"]
]}
```

```json
{ "kind": 39999, "pubkey": "<TA>", "tags": [
  ["d", "dlist-headers"], ["z", "39998:<TA>:content-category"],
  ["n", "39999:<TA>:event-kind"],
  ["k", "39998"], ["k", "9998"], ["k", "39999"], ["k", "9999"],
  ["rule", "kinds 39999/9999 count only when declared as headers (z → list or concept-header)"],
  ["names", "DList header", "DList headers"]
]}
```

```json
{ "kind": 39999, "pubkey": "<TA>", "tags": [
  ["d", "external-isbn"], ["z", "39998:<TA>:content-category"],
  ["n", "39999:<TA>:external"],
  ["k", "isbn"],
  ["names", "book", "books"]
]}
```

- **Firmware seeds** the Profiles item, one item **per event kind** people commonly search, the *DList headers* item, and common NIP-73 types.
  - Event kinds: notes (`1`), long-form articles (`30023`), wiki articles (`30818`), product listings (`30402`), communities (`34550`), and so on. A NIP defining several kinds gives several categories; the `nip` tag groups them.
  - NIP-73 types: `isbn`, `web`, `podcast:guid`, and so on.
- **DList categories are implicit.** Every DList header *is* a content category, so no item is required. An explicit item (as above) is a pointer that makes the DList show up where categories are browsed. It is community-curatable like any list item.
- **Which chips appear** in search is a display choice: a display Pin (`search-chips`) over content-category items, with the community's picks as default (Pins § 8.2).
- `n` points the item at a type *item*. Class-thread relationships allow that: the type items act as sets. An author-gated reader derives `HAS_ELEMENT` from it.

## 4. Tagging and pinning across types

Any item of any category can be tagged or pinned. The target tag follows the item, not the category:

| Target | Tag | Example |
|---|---|---|
| a profile | `p` | tag Avi as a Podcaster |
| an event of kind k | `e`, or `a` if addressable | tag a `30402` listing as Handmade |
| a DList item | `a` (`39999`) or `e` (`9999`) | tag a restaurant as Mexican |
| a DList | `a` of its header (`e` if `9998`/`9999`) | pin *Restaurants in Nashville* to *Spawns a Trusted List* |
| an external thing | `i` | tag an `isbn:` identifier as Science Fiction |

## 5. Checking the protocols for kind-`39999` / `9999` headers

Headers of kind `39999` or `9999` touch these places:

| Where | Assumption that breaks | Fix |
|---|---|---|
| **Item `z` values** | a reader expecting every `z` to begin `39998:` | `z` may name a `39999` header (`39999:<pk>:<d>`) or a `9998`/`9999` header by event id. Readers MUST NOT assume the prefix. `tapestry-concepts.md` should say so. |
| **Treasure Map category slot** | a DList category is always an naddr | also a canonical nevent, for immutable headers (§ 2). The grammar `cat` rule gains `nevent`. |
| **Treasure Map Concept keys** | `39998:<d-tag>` covers every curatable DList | Already handled: Treasure Maps § 4.5 allows `39999:<d-tag>`. Immutable headers can't have a curated *copy* at the same address, but the copy is a new Assistant-authored `39998` either way. |
| **Supported DLists / Concepts** | one list kind per set | one `30397` list per set: headers are members as lists (`z`), by coordinate or event id |
| **Header detection** | "is a header" = kind, or "has `names`" | kind `39998`/`9998`, or a declared `39999`/`9999` (`z` → `list` or the Concept for Concept Headers). A declared `39999` header is **both** a header and an item. See [DList Header Declaration](./dlist-header-declaration.md). |
| **Assertion lists** | every DList's items are things | Pins, per-tag tagging headers and (option B of the Tags review) Tags are headers whose items are *assertions*: pinnings, taggings. A DList-based list of such a header lists assertions, which is almost never wanted. See open question 2. |
| **DList-based curation of a `39999` header** | none | works as-is: items `z` to `39999:<pk>:<d>`, and the key's naddr encodes kind `39999`. |
| **`30397` members** | a `z` tag on any event is a membership claim | on a Trusted List, `z` members are references. Readers MUST NOT count a Trusted List as an item of the lists it names; DList retrieval keeps its kinds filter (`9999`, `39999`), and compat readers count foreign kinds only when a header declares `item-kind`. |

### 5.1 The subject rule

A DList's items may **be** the thing (a restaurant), **point at** the thing (a `p`-tagged "nostr developer"), or **assert something about** a thing (a pinning, a tagging). A Trusted List lists the things, whatever form the item takes:

- **The subject** of an item is the item tag its header names in `required` (`p`, `e`, `a`, `i`). If the header names none, the subject is the item itself. A subject that is a declared header is a **list**.
- **A DList-based list lists subjects**, and its kind follows the subject (§ 2): *nostr developers* → `30392:dlist:⟨…⟩`; *Restaurants in Nashville* → `30396:dlist:⟨…⟩`; a list of lists → `30397:dlist:⟨…⟩`, whether its items are declared headers or pointers to headers.
- **`t` subjects** (strings, such as dog names) spawn no Trusted List.
- **Assertion lists** — headers whose items are pinnings or taggings — carry `["items", "assertion"]`. They never spawn DList-based lists, because counting them needs polarity and asserter trust; their lists come from the `tag` and `pin` systems. By default they're also left out of Supported DLists and Supported Concepts candidates, search chips, and DList search.

## 6. Open questions

1. ~~A fourth type for external identifiers?~~ — resolved: yes, *External*, lists `30395`, following NIP-85's `30385`.
2. ~~Assertion headers~~ — resolved: `["items", "assertion"]` (§ 5.1).
3. ~~One category per kind or per NIP?~~ — resolved: per kind; `nip` groups kinds.
4. ~~`9998` vs `39998`~~ — resolved: one *DList headers* category covering all four header kinds (§ 1.3).
5. **Kind ranges vs kinds.** Is "all addressable events" (the TM scope `30394:tag`) a category? Proposal: no. Scopes cover sets of categories; categories stay atomic.
