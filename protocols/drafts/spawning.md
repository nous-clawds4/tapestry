> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Draft 4:** DList items get their own kinds, `30396` / `30386`; header detection follows [DList Header Declaration](./dlist-header-declaration.md).
> **Draft 3:** the list kind says how members are referenced (`30397` = lists of **lists**, members are `z` values); the category slot says which category. DList-based lists take their kind from the header's **subject**. Supported DLists and Concepts are `30397`; Supported Scores and Tags are `30394`. Category types come from [Content Categories](./content-categories.md).
> **Canonical:** not yet published
> **Companion to:** [Treasure Maps](./treasure-maps.md) (keys, scopes, the `d` = scope rule), [Pins](./pins.md), [`tags.md`](./tags.md), `event-taggings.md`, `trusted-lists.md`, [NIP-85](https://nips.nostr.com/85).
> **Why this exists:** no current draft says *what makes a Trusted List exist*. Each publisher has its own answer (`refreshPinnedTags`, `refreshApplicabilityLists`, …). This NIP lists every way an insight can be spawned, and the rules they share.

---

Spawning
========

`draft` `optional`

A **spawner** is something whose existence implies an insight: a DList implies "the items my community accepts"; a (Tag, category) pair implies "the items in that category my community tags as X". **Spawning** is an Assistant publishing and maintaining that insight for an observer.

Every spawner maps to exactly one **spawn key**: an exact Treasure Map key. A spawned Trusted List uses `d` = the key minus its kind (Treasure Maps § 5.1). So from a spawner alone, anyone can compute where the list lives.

## 1. Principles

1. **One spawner, one List, one Score family.** Every List spawner also spawns Scores: the same key under the matching `3038x` kind, plus `:<metric>`. The Score family carries a per-subject value for everything the List considered.
2. **Spawners are public; methods are private.** The spawner and its key are on the wire. How membership is computed — trust, weights, cutoffs — is the Trust Determination Method's business, filed under the same key, and stays off the wire.
3. **Two gates.** An Assistant spawns an insight for observer O only when:
   - **(a) the Map gate:** O's Treasure Map names this Assistant on the winning key for it (Treasure Maps § 6); and
   - **(b) the support gate:** if that winning key is a scope, the spawner's components are in O's effective supported sets (Pins § 6). An exact key passes (b) on its own.
4. **Deterministic identity.** `d` = scope. The `d` tag says what the list is about (§ 4).
5. **Retire in place.** A spawned list that no longer passes both gates is replaced by an empty event carrying `["status", "retracted"]` at the same `d`. It is never silently abandoned.

## 2. The spawn key

```
List:   <list kind>:<system>:<category>[:<descriptor>]
Score:  <score kind>:<system>:<category>[:<descriptor>]:<metric>
```

- **List kind** — set by how members are referenced (Treasure Maps § 4.2): `30392` pubkeys (`p`), `30393` events (`e`), `30394` addressable events (`a`), `30395` NIP-73 ids (`i`), `30396` DList items (`a`/`e`), `30397` lists (`z`).
- **System** — `dlist`, `tag`, `pin`, `contexts`, `applicable`, … (§ 3).
- **Category** — which content category the members come from: empty for profiles, an event kind, a NIP-73 type, or a DList header. The category and the list kind must agree (Treasure Maps § 4.3).
- **Descriptor** — the Tag or Pin, where the system has one.

## 3. Every spawner

### 3.1 DList-based — a DList header

| | |
|---|---|
| Spawner | DList header D, not marked `["items", "assertion"]` |
| List | `<kind>:dlist:⟨D⟩`: the **subjects** of the items of D that O's community accepts. The kind follows the subject (Content Categories § 5): the items themselves → `30396`; `p` → `30392`; `e` → `30393`; `a` → `30394`; `i` → `30395`; subjects that are headers (DList Header Declaration § 1) → `30397`. |
| Scores | the matching `3038x` key plus `:<metric>`: how strongly each subject belongs to D |
| Support gate | D in Supported DLists |
| Reads | kind 39999/9999 items with `#z` = D; their reactions / endorsements |

- *"The Trusted List of every item my trusted community accepts as a genuine Restaurant in Nashville"*: `30396:dlist:⟨Restaurants in Nashville⟩`.
- *"…the pubkeys my trusted community accepts as nostr developers"*: `30392:dlist:⟨Nostr developers⟩`.
- **Items whose subject is a `t` string** (the DList NIP's dog names) spawn no Trusted List: no list kind holds strings.
- **Assertion headers** (Pins, tagging headers, Tags-as-headers) never spawn DList-based lists. Their lists come from § 3.2 and § 3.3.

### 3.2 Tag-based — a (Tag, category) pair

| Category | List | Scores |
|---|---|---|
| profiles | `30392:tag::⟨T⟩` | `30382:tag::⟨T⟩:<metric>` |
| event kind k (non-addressable) | `30393:tag:k:⟨T⟩` | `30383:tag:k:⟨T⟩:<metric>` |
| addressable kind k | `30394:tag:k:⟨T⟩` | `30384:tag:k:⟨T⟩:<metric>` |
| NIP-73 type | `30395:tag:<type>:⟨T⟩` | `30385:tag:<type>:⟨T⟩:<metric>` |
| DList D | `30396:tag:⟨D⟩:⟨T⟩` (`30392` if D's subject is `p`) | `30386:tag:⟨D⟩:⟨T⟩:<metric>` |
| DList headers (`39998`) | `30397:tag:39998:⟨T⟩` — DLists tagged T | `30387:tag:39998:⟨T⟩:<metric>` |

- **Support gate:** (T, C) is in the effective set of `spawns-trusted-list` (Scores: `spawns-score`). Pins § 6.2 resolves a category-specific pinning before a generic one. D need **not** be a Supported DList: Tag lists of Restaurants in Nashville don't require a DList-based list of restaurants.
- **Reads:** taggings of T (pubkey taggings via `#a`; event taggings via the per-tag header `#z`), limited to targets in the category.
- *"The Trusted List of every Restaurant in Nashville that my trusted community tags as Mexican."*
- **Discovery gap:** see the Tags review, point 6.

### 3.3 Pin-based — an (action Pin, content category) pair

A Pin applied to the items of one content category spawns a Trusted List of the targets pinned. As everywhere, the list kind follows how members are referenced: **`30397`** when the members are lists (DList headers, used as lists), **`30396`** when they are DList items used as things (Score items, Tags, content-category items).

```
<list kind>:pin:<category>:⟨Pin⟩
```

Membership is the observer's **effective set** (Pins § 6), not a community vote alone.

| Supported set | Key | Members |
|---|---|---|
| Supported Scores | `30396:pin:⟨Scores⟩:⟨Spawns a Score⟩` | `a` Score items (`rank`, `followers`, …) |
| Supported DLists — Lists | `30397:pin:39998:⟨Spawns a Trusted List⟩` | `z` DList headers |
| Supported DLists — Scores | `30397:pin:39998:⟨Spawns a Score⟩` | `z` DList headers |
| Supported Concepts | `30397:pin:39998:⟨Spawns a Concept⟩` | `z` DList headers |
| Supported Tags — Lists | `30396:pin:⟨Tags⟩:⟨Spawns a Trusted List⟩` | `a` Tags pinned generically **or** for at least one category |
| Supported Tags — Scores | `30396:pin:⟨Tags⟩:⟨Spawns a Score⟩` | `a` Tags |
| Tags on profile pages | `30396:pin:⟨Tags⟩:⟨Show on profile pages⟩` | `a` Tags, in `position` order |

- **`39998`** is the event-kind content category *DList headers* (Content Categories § 1.3). Its members here are used as **lists**, so they are `z` values, and one `30397` list holds headers of all four kinds: `39998`/`39999` by coordinate, `9998`/`9999` by event id.
- **⟨Scores⟩** is the new Scores shared concept. Each item is one metric, with a name and a description. Which algorithm computes it is the Assistant's business.
- **⟨Tags⟩** is the existing `tag` concept.
- **Bootstrap — the root rule.** The supported sets are what the support gate reads, so they can't sit behind it themselves.
  - An Assistant with any scope key in O's Map MUST compute O's supported sets, whether or not it publishes them.
  - Supported sets pass the support gate automatically. They still need the Map gate to be *published*.

#### 3.3.1 Categories for Tag T — a transposed pin list

For each Tag on Supported Tags, the categories in which it spawns lists form one more Trusted List:

```
30396:contexts:⟨Spawns a Trusted List⟩:⟨T⟩
```

- **Members** — the categories C for which (T, C) is effective (Pins § 6.2), as `a` coordinates of `content-category` items: the Profiles item, event-kind and external items, and — for DList categories — the category item that points at the header (Content Categories § 3.2). The members are *categories as things* (content-category items), not lists to be queried, so the list is `30396`.
- **Why it's a separate list.** A generic pinning covers "wherever T applies". Applicability is per point of view and changes over time, so the resolved categories are an insight, not something a client can read off the pinnings.
- **Transposition.** It is Supported Tags read column by column: for this Tag, which categories. Its row-by-row mirror — for this category, which Tags — is the applicability list adjusted by pinnings (§ 3.5). Only one of the two needs publishing; the other is derivable. This draft publishes per Tag, because that's how people pin.
- **New system word:** `contexts`. Layout: `<kind>:contexts:<Pin>:<target>`, meaning "the categories in which <target> is pinned to <Pin>".
- **Assistant duty.** Each (T, C) member drives one Tag-based spawner (§ 3.2).

### 3.4 Native — a Score item

| | |
|---|---|
| Spawner | a Score item M (e.g. `rank`) on Supported Scores. A pinning context (Pins § 3) narrows it to one subject kind; generic means every subject kind the Assistant supports for M. |
| Spawns | Scores only: `k:M` for every subject (NIP-85, unchanged). No List. |
| Support gate | M in the effective set of (`spawns-score`, ⟨Scores⟩) |
| Treasure Map key | unchanged: `30382:rank`. The Score item's `d` MUST equal the NIP-85 metric name. |

### 3.5 Applicability — a context (existing, to be aligned)

| | |
|---|---|
| Spawner | a target context: pubkeys, events of kind k, items of DList D |
| List | the Tags that apply to that context (HINT ∪ USAGE, tags.md § Applicability) |
| Today | kind `30394`, `d = tag-applicability-nostr-event` / `…-nostr-pubkey` |
| Proposed key | `30396:applicable:<context>` (members are Tags, which are DList items; today's lists are `30394` and would re-kind): empty for pubkeys, `k` for a kind, ⟨D⟩ for a DList |

**Decided (W23):** applicability is the **community default** for Supported Tags. `community(supported-tags, C)` = applicable(C), weighted by trust from the owner's point of view; pinnings adjust it. The hints extend to every content category (Amendments § 4).

### 3.6 Concept — a DList header

| | |
|---|---|
| Spawner | DList header D |
| Spawns | not a Trusted List: a curated **Concept**, `39998:<d>`. A header copy and item copies, authored by the Assistant (Treasure Maps § 4.5). |
| Support gate | D ∈ Supported Concepts |

The same header spawns both 3.1 and 3.6. They're gated independently (Supported DLists vs Supported Concepts) and published in different forms.

### 3.7 Candidates, not yet specified

- **Communities.** A community declaration claims tag-elements, and its roster derives from the taggings. Its roster would be a Tag-based `30392` list under a `community` system word.
- **Composite lists** (DList NIP Example 5: a list of lists). DList-based already covers the list of lists itself (`30397:dlist:⟨D⟩`). A *union* of its member lists' items would be a new `union` system word.
- **Scorecards.** One subject, one context. A GrapeRank Scorecard spawner is (context, subject category), with new kinds.
- **Search.** A saved keyword query as a spawner? Probably not: it's a client view, not an insight.

## 4. What a spawned list carries

| Tag | Required | Meaning |
|---|---|---|
| `d` | yes | the scope: the spawn key minus its kind |
| member tags | yes | `p` / `e` / `a` / `i` / `z`, per kind. `30397` `z` members are references, never membership claims (Treasure Maps § 5.5). |
| `truncated` | when partial | trusted-lists.md completeness signal |
| `status` | on retirement | `retracted` |
| `title` | optional | a human label |

- **No `metric`, `observer`, `cutoff` or `min-rank` tags.** trusted-lists.md allows them today. Under principle 2 they reveal the method, so they SHOULD be dropped.
- `observer` is implied: each Assistant key serves one observer (Treasure Maps § 9).

## 5. Lifecycle

1. **Spawn** — both gates pass: compute, then publish at `d` = scope.
2. **Refresh** — republish when inputs change. The replaceable event means consumers always see the latest.
3. **Hand-off** — the observer moves the winning key to another Assistant. The old one retracts; the new one spawns. For a while both may be live; clients follow the Map.
4. **Retire** — a gate fails (removed from a supported set, Map entry removed): retract in place.
5. **Restore** — the gate passes again: republish at the same `d`. The address never changes.

## 6. Open questions

1. ~~`30396` for string members~~ — withdrawn; `30396` is now the DList-items kind, and Supported Scores is a `30396` of Score items.
2. **Categories for Tag T** (§ 3.3.1): a per-Tag list (`contexts`), or per-category lists (applicability adjusted by pinnings), or both?
3. ~~The Tag-in-DList discovery gap~~ — accepted as is (W21 rejected): readers scan the Tag's taggings and intersect with the DList's items.
4. ~~Applicability as the Supported Tags default~~ — decided (W23), § 3.5.
5. **Should dropping `metric` / `observer` wait** until the pinned-tag TLs migrate, since current readers may use them?
6. ~~Mixed-item DLists~~ — resolved: `30396` holds both.
