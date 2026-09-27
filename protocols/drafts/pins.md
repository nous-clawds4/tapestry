> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** [`tags.md`](./tags.md) (§ Pins, § Unpinning), `event-taggings.md`, `shared-concepts.md`, `inherit-from.md`, [`decentralized-lists.md`](../nips/decentralized-lists.md), `trusted-lists.md`; the companion drafts [Treasure Maps](./treasure-maps.md), [Spawning](./spawning.md) and [Amendments proposal](./amendments-2026-09.md); the Brainstorm mock's “What My Community Curates” pages (September 2026).
> **Draft 3:**
> - Pins are **actions** ("Spawns a Trusted List curated by my Assistant", and so on), and each supported set is (action Pin, content category).
> - Supported sets follow the Treasure Maps rule "list kind = how members are referenced": Supported DLists and Concepts are `30397` (members are lists); Supported Scores and Tags are `30396` (members are Score items and Tags, which are DList items).
> - A Tag can be pinned **generically** or **for one category**; the most specific pinning wins.
> - The categories supported for each Tag are themselves a spawned Trusted List.
>
> **If adopted, replaces:** § Pins and § Unpinning of `tags.md`, per § 10.

---

Pins & Pinnings
===============

`draft` `optional`

This NIP defines **Pins** — named personal preferences such as *Spawns a Trusted List curated by my Assistant* or *Show on profile pages* — and **Pinnings**, assertions that a target is on a Pin (`+`) or excluded from it (`−`).

Pins are built exactly like [Tags & Taggings](./tags.md). Both are [Decentralized Lists](../nips/decentralized-lists.md) under the hood, with signed kind-`39999` assertions and `+`/`−` polarity. They differ in what they're for:

- **Tags** describe the world, to help people *find* things: "this restaurant is Mexican".
- **Pins** record what *I* want: which insights my Assistant curates and publishes, and how things are shown to me. "Spawn a Trusted List for Restaurants in Nashville", "hide the Memes Tag on profile pages".

Two rules follow from the difference:

- **The owner's own pinning decides** (§ 6).
- **Most Pins are actions:** pinning a target tells an Assistant to do something with it (§ 8).

## 1. Terms

- **Pin** — a kind-`39999` event that is also a DList header: *the list of things pinned to X*. Anyone may create one. Deployments seed the well-known Pins (§ 8).
- **Action Pin** — a Pin whose pinnings ask an Assistant to spawn an insight from the target: a Trusted List, a Score, or a Concept.
- **Pinning** — a kind-`39999` DList item asserting that a target is on a Pin (`polarity 1`) or excluded from it (`polarity -1`).
- **Target** — the thing pinned. For the action Pins it is always an **item of a DList**:
  - a Score (an item of the Scores concept);
  - a DList header (an event of the content category *DList headers*, kind `39998` — Content Categories § 1.3);
  - a Tag (an item of the `tag` concept).
- **Context** — an optional qualifier narrowing a pinning to one content category: *Mexican*, **for Restaurants in Nashville**.
- **Generic pinning** — a pinning with no context: it applies in every category where the target applies (§ 6.2).
- **Owner** — the person whose preference a pinning expresses, i.e. its author.
- **Effective set** — for one owner and one Pin: the (target, context) pairs that count as pinned (§ 6).

## 2. Pins

```json
{
  "kind": 39999,
  "pubkey": "<TA>",
  "tags": [
    ["d", "spawns-trusted-list"],
    ["z", "39998:<TA>:pin"],
    ["names", "thing that spawns a Trusted List curated by my Assistant", "things that spawn a Trusted List curated by my Assistant"],
    ["description", "Pin a DList or a Tag here, and your Assistant publishes the Trusted Lists it spawns."],
    ["spawns", "list"],
    ["for", "39999:<TA>:kind-39998"],
    ["for", "39998:<TA>:tag"],
    ["required", "a", "The DList header or Tag being pinned"],
    ["allowed", "Z", "Content category (DList) this pinning is limited to"],
    ["allowed", "K", "Content category (event kind) this pinning is limited to"]
  ],
  "content": ""
}
```

- **A Pin is its own list header.** It carries `names` (singular and plural), so a pinning joins it with a direct `z`. The tag-element / tagging-header split in Event Taggings isn't needed (Tags review, point 3).
- `z` → the deployment's `pin` concept: this event *is a Pin*.
- `spawns` (action Pins only) — `list`, `score` or `concept`: what the Assistant spawns from each pinned target. Future insight types (for example `scorecard`) add values.
- `for` (optional, repeatable) — the content categories (Content Categories § 2) whose items the Pin is meant for. A multi-letter tag, so not relay-indexed: a hint, never a gate. The pair (Pin, one of these categories) is what spawns a supported set (§ 8).
- `use` (optional) — `display` marks Pins that only clients act on (§ 8.2). Action Pins imply `assistant`.
- `required` / `allowed` — the standard DList rules for the pinning's target and context tags.
- Addressed as `39999:<author>:<slug>`.

## 3. Pinnings

```json
{
  "kind": 39999,
  "pubkey": "<owner>",
  "tags": [
    ["d", "pin-spawns-trusted-list-3f9a0c2e-e5272de9"],
    ["a", "39999:<author>:mexican"],
    ["z", "39999:<TA>:spawns-trusted-list"],
    ["z", "39998:<TA>:nostr-pinning"],
    ["context", "39998:<curator>:restaurants-in-nashville"],
    ["polarity", "1"]
  ],
  "content": ""
}
```

*"Spawn a Trusted List of Mexican restaurants in Nashville."* Without the `context` tag it would read *"Spawn a Trusted List of Mexican things, in every category where Mexican applies."*

- **Target** — exactly one of `a` (addressable: DList headers, Tags, Score items, Pins), `e` (plain events, kind-`9999` items), `p` (pubkeys), `i` (NIP-73 identifiers) or `t` (strings). The action Pins use `a`. Because the Pin is named by `z`, no indirection is needed and every target slot stays free.
- **`z` → the Pin** — membership: "this pinning is an item on the list of things pinned to *Spawns a Trusted List*". Relay-filterable.
- **`z` → `nostr-pinning`** — the concept of all pinnings. It follows the federation rules of Event Taggings § Concept namespaces.
- **`polarity`** — `"1"` pin (include), `"-1"` exclude. Absent means `"1"`. It is bucketed as in Tags (`≥ 0.5`, `≤ −0.5`; the band in between is reserved).
- **Context** (optional, at most one; **pending review**, see the pinning-context issue): `["context", "<coordinate>"]` names a content category (Content Categories § 2). That is a DList header, or a `content-category` item for profiles, an event kind or an external type.
  - **No context tag = generic.**
  - The tag is multi-letter, so relays don't index it. Readers fetch a Pin's pinnings through its `z` and read `context` client-side.
  - **Interim rule:** publish generic pinnings only until this is settled. A reader that doesn't understand `context` would read a per-category exclusion as a generic one.
- **`position`** (optional) — a number. It orders the effective set wherever order matters, such as Tag chips on a profile page. Lower comes first.
- **`content`** — empty, or a free-text note. It never holds a method (§ 7).

### 3.1 The pinning `d` tag (normative)

```
d  = pin-<pinSlug>-<h8>-<owner8>
h8 = first 8 hex characters of sha256( <target value> + "|" + <context value, or ""> )
```

- Each owner has one live stance per (Pin, target, context). Republishing replaces it, including a flip from `+` to `−`.
- The generic pinning and each category-specific pinning of the same Tag are **separate events**, so both can coexist (§ 6.2).
- **Why a hash.** Event Taggings takes the first 8 characters of an `a` target's *author*, so two targets by the same author collide (Tags review, point 1). Hashing the whole target (plus context) avoids that.

## 4. Unpinning

Unpinning returns a target to the default (§ 6).

- **Delete** the pinning (NIP-09 kind `5`), **or** republish it with `["polarity", "0"]` ("no stance"). The second is proposed because deletions propagate unreliably.
- **Excluding is not unpinning.** `−` means "not for me, even if my community includes it".
- To exclude a Tag in one category while keeping it everywhere else: a generic `+` plus a category-specific `−` (§ 6.2).

## 5. Discovery

| Question | Filter |
|---|---|
| Every pinning on a Pin | `{"kinds":[39999], "#z":["39999:<TA>:spawns-trusted-list"]}` |
| One owner's pinnings on a Pin | …plus `"authors":["<owner>"]` |
| Pinnings of one target, on any Pin | `{"kinds":[39999], "#z":["39998:<TA>:nostr-pinning"], "#a":["<coord>"]}` |
| Pinnings on a Pin in one category | the Pin's pinnings, filtered by `context` client-side |
| Every Pin | `{"kinds":[39999], "#z":["39998:<TA>:pin"]}` |

As with Tags, filters return **candidates**. What counts is decided per point of view at read time.

## 6. The effective set (normative)

### 6.1 Owner over community

For owner O and Pin X:

```
community(X) = (target, context) pairs whose pinnings, from asserters O's point of view trusts, net to "pinned"
own+(X)      = pairs O pinned    (polarity ≥ 0.5)
own−(X)      = pairs O excluded  (polarity ≤ −0.5)
```

- **The owner decides.** O's own `+` or `−` overrides the community in both directions. Every other asserter is one weighted voice among many, exactly as for Tags. This is the defining difference from Tags, where O's own tagging is only one voice, because a tagging is a claim about the world.
- **Silence defers to the community.** Anything O never pinned (or unpinned) follows `community(X)`. New owners start with a useful set on day one.
- **How "net to pinned" is computed** — trust scores, weights, cutoffs — belongs to the Trust Determination Method and stays off the wire (§ 7).

### 6.2 Specific over generic

Is target T pinned to X **in category C**? Take the first of these that exists:

1. O's pinning of T with context C
2. O's generic pinning of T
3. the community's stance on T with context C
4. the community's stance on T, generic

- A **category-specific** stance always beats a **generic** one at the same level, and the owner's level always beats the community's.
- This is the Treasure Maps precedence rule, "the most specific entry wins", applied to pinnings.
- **Generic + means "wherever it applies".** A generic `+` on Tag T covers the categories where T **applies** from O's point of view: HINT ∪ USAGE (tags.md § Applicability), extended to kinds and DLists (Tags review, point 9). "Mexican" pinned generically covers Restaurants in Nashville and Recipes, not Lightning Nodes.
- **Generic − means "nowhere"**, unless a category-specific `+` overrides it.
- Targets that aren't Tags (DList headers, Score items) may still take a context: a Score item "rank" pinned with `["context", "39999:<TA>:profiles"]` means profile rank only. The same rules apply.

### 6.3 Conflicts

O's latest pinning per `d` wins (replaceable). Different Pins never conflict: *Spawns a Trusted List* and *Spawns a Concept* are independent actions on the same DList header.

## 7. What a pinning never carries

No algorithm, no data source, no cutoff, no observer parameters. This is the Treasure Maps principle: *what and where, never how.*

- A Score item names *what* the metric is (name, description). **Which algorithm computes it is the duty of the Assistant**, more precisely of the WoT Service Provider that runs it.
- The deployed `tag-pin` event's `curation-method` JSON is retired (§ 10). Its contents move to the owner's private Trust Determination Methods.

## 8. Well-known Pins

### 8.1 Action Pins

Deployments SHOULD seed these three under their authority key.

| `d` | `spawns` | Applies to items of | Pinning a target means… |
|---|---|---|---|
| `spawns-trusted-list` | `list` | DList headers (kind `39998`), Tags | "my Assistant publishes the Trusted Lists this spawns" |
| `spawns-score` | `score` | Scores, DList headers, Tags | "my Assistant publishes the Scores this spawns" |
| `spawns-concept` | `concept` | DList headers | "my Assistant curates this DList actively: its own copy of the header, sets and elements" |
| `add-to-dictionary` | `dictionary` | DList headers | "my Assistant keeps a copy of this concept's header only, `b`-tagged to the shared concept" |

Each (action Pin, category) pair spawns one **supported set**: a Trusted List whose members are the effective pinned targets (Spawning § 3.3). It is `30397` when the targets are used as lists (DList headers), and `30396` when they are DList items used as things (Score items, Tags).

| Supported set | Spawned by | Triggers |
|---|---|---|
| Supported Scores | (`spawns-score`, **Scores** DList) | NIP-85 native Scores: `30382:rank`, … |
| Supported DLists — Lists | (`spawns-trusted-list`, **kind 39998**) | `<kind>:dlist:⟨D⟩`, kind by D's subject (e.g. `30396`) |
| Supported DLists — Scores | (`spawns-score`, **kind 39998**) | `<kind>:dlist:⟨D⟩:<metric>` (e.g. `30386`) |
| Supported Concepts | (`spawns-concept`, **kind 39998**) | a curated copy, `39998:<d>` plus item copies |
| Supported Tags — Lists | (`spawns-trusted-list`, **Tags**) | `<kind>:tag:<C>:⟨T⟩` for each supported category C |
| Supported Tags — Scores | (`spawns-score`, **Tags**) | `<kind>:tag:<C>:⟨T⟩:<metric>` |
| Categories for Tag T | (`spawns-trusted-list`, T), transposed | the categories C in which T spawns a list (Spawning § 3.3) |

- **Worked example.** Restaurants in Nashville is pinned to `spawns-trusted-list`, so the Assistant maintains `30396:dlist:⟨Restaurants in Nashville⟩`. Restaurants in NYC is pinned to both `spawns-trusted-list` **and** `spawns-concept`, so it gets the Trusted List **and** a curated Concept. It's one DList header, pinned twice.
- **In the Brainstorm mock**, the supported sets appear on *What My Community Curates* as **Scores I use**, **Lists I follow**, **Tags I follow** and **Concepts My Assistant Curates Actively**. “Lists I follow” shows the Lists and Scores sets together (the same for now), and “Tags I follow” does the same. The spec keeps them separable. The Dictionary uses a separate Pin, `add-to-dictionary`.

### 8.2 Display Pins

| `d` | Applies to items of | `+` | `−` |
|---|---|---|---|
| `profile-page-tags` | Tags | show this Tag on profile pages | hide it |

A display Pin gives both show and hide as `+` and `−` on one Pin. With the community default, that makes three states and nothing to conflict. Clients compute its effective set themselves. Assistants MAY publish it as a convenience.

## 9. Privacy

Pins reveal preferences, so an owner MAY keep pinnings private.

- **Decided (W22):** a private pinning is published by the owner's Assistant, NIP-44-encrypted to itself, and marked `["private", "1"]`. Only `d` and the `z` to the Pin stay in the clear. It is the same pattern as private Trust Determination Methods.
- Private pinnings count only for their owner's own effective set, never toward anyone else's community.

## 10. Migration from `tag-pinning`

| Today (tags.md § Pins) | Under this NIP |
|---|---|
| `z` → `tag-pinning` concept | `z` → `spawns-trusted-list` (and `spawns-score` if scores were included), plus `z` → `nostr-pinning` |
| `d = tag-pin-<slug>-<tagAuthor8>-<viewer8>` | `d = pin-spawns-trusted-list-<h8>-<owner8>` |
| a pin is always for profiles | generic, or a context; profile-only is `["context", "39999:<TA>:profiles"]` |
| `e` (version) + `a` (address) of the Tag | `a`; optional `e` provenance allowed |
| `curation-method` JSON | removed (§ 7) |
| `includeScoreInTL: true` | a second pinning on `spawns-score` |
| Unpin = NIP-09 deletion | deletion, or `polarity 0` (§ 4) |

Readers SHOULD union old and new pinnings until publishers migrate. Existing `tl-pin-…` Trusted Lists are retracted in place as their replacements publish.

## 11. Open questions

1. ~~Profiles as a context~~ — resolved: the Profiles content category item (Content Categories § 2).
2. **`polarity 0`** for unpinning: adopt it, or keep deletion only?
3. **Owner override for Tags too?** Should a viewer's own tagging override the community in their own view? That would make the two systems identical on the wire and differ only in UI.
4. ~~Private pinnings~~ — decided (W22), § 9.
5. ~~Community default for generic Tags~~ — decided (W23): applicability, weighted by trust, is the community's generic stance.
6. **Pinning Pins** (e.g. *Pins I follow*)? Nothing forbids it; is it wanted?
7. **Concept identity** for `pin`, `nostr-pinning` and the new Shared Concepts follows worksheet W1 ([Amendments proposal](./amendments-2026-09.md), § 1).
