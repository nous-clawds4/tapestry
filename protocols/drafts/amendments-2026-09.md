> **Repo metadata — not part of the spec text.**
> **Status:** 💭 proposal — amendments to existing drafts, for review
> **Found:** `b` tags → `inherit-from.md` § "The `b` tag" and `shared-concepts.md`; `z` tags → `nips/decentralized-lists.md` (parent pointer) and `tapestry-concepts.md` (the a-tag form, concept anatomy); `n` / `s` tags → `class-thread-relationships.md`. None of them defines a self-pointing `b`; the worksheet (b-coverage discipline) mentions "self-declared" headers without a wire form.

---

# Protocol amendments (proposed)

## 1. New Shared Concepts (firmware)

Each is a DList header with a self-pointing `b` tag (§ 3), seeded by firmware under the deployment's authority key.

| Concept `d` | Items are | Used by | Status |
|---|---|---|---|
| `content-category-type` | the three types: `profile`, `event-kind`, `dlist` | Content Categories § 3.1 | **new** |
| `concept-header` (the Concept for Concept Headers) | declared `39999`/`9999` headers, via `z` | [DList Header Declaration](./dlist-header-declaration.md) § 4 | **exists** — community handle `39998:8e901369d45081cf05fe17ba802441dd731f73e000149c333daf4880a58e5fb1:concept-header` (straycat's Tapestry Assistant, staging), self-declared canonical |
| `content-category` | Profiles, one item per event kind, optional DList pointers | Content Categories § 3.2; pinning contexts; Categories for Tag T; search chips | **new** |
| `score` | one per metric: `d` = NIP-85 metric name, plus `name` and `description` | Supported Scores | **new** |
| `pin` | Pins | Pins § 2 | **new** |
| `nostr-pinning` | Pinnings | Pins § 3 | **new** |
| `tag` | Tags | Supported Tags | exists |
| `trust-determination-method` (parent) + `native-score-…`, `tag-based-…`, `dlist-based-…`, `pin-based-…` (parallel children: `s` → parent, `b` inherit) | stored methods, published by the owner's Assistant and encrypted to it; public templates optional | Treasure Maps § 9.1, Assistant Tasks § 4 | **new** — see [Trust Determination Methods](./trust-determination-methods.md) |
| `trust-source` | ways to measure trust: `graperank`, `follows`, `hops`, … (growable) | Trust Determination Method § 3.1 | **new** |
| `score-algorithm` | algorithms a provider may use to compute a native Score: `graperank`, `pagerank`, … (growable); each item declares its parameters | Trust Determination Method § 3.2 | **new** |

- Seed items for `score`: the NIP-85 metrics people actually use (`rank`, `followers`, `reporters`, `hops`), not the full NIP-85 list.
- *Withdrawn:* `concept` (the Concepts concept) and `nostr-event-kind`. The first is replaced by the event-kind category *DList headers* (§ 2); the second by `content-category`.

## 2. ~~DList headers are implicitly items of the Concepts concept~~ — withdrawn

A DList header is an event of kind `39998`, so it is already an item of an event-kind content category (Content Categories § 1.3). No new concept, and no implicit-membership rule, is needed.

Consequence: Supported DLists and Supported Concepts are (Pin, kind-`39998` category) lists. Their members are headers **used as lists**, so they are kind **`30397`** with `z` members, one list holding headers of all four kinds (Spawning § 3.3).

## 3. A self-pointing `b` declares a header canonical

**Proposed addition to `inherit-from.md` § "The `b` tag"** (and a matching line in `shared-concepts.md` § Declared affiliation):

> **Self-declaration.** A header whose pointer-typed `b` tag names **its own** a-coordinate (`["b", "39998:<own pubkey>:<own d>"]`) declares itself **canonical**: the root other headers affiliate with. It asserts no deference (a node can't inherit from itself), opens no new path, and carries zero aggregation weight, like any pointer. Coverage tooling treats it as *dispositioned: self-declared*, the third state alongside *wired* (a `b` to another header) and *deliberately unaffiliated* (`b-tag-deferred`). Canonical is a claim, not a fact: readers still resolve convergence per point of view (clouds).

## 4. Tag applicability extends to every content category

**Proposed for `tags.md` § Applicability hints:** alongside `tag-for-nostr-pubkey` / `tag-for-nostr-event`, allow a hint per content category: `tag-for-kind:<k>` and `tag-for-dlist:<coord>`. The derived HINT ∪ USAGE view then answers "does Mexican apply to Restaurants in Nashville?". That answer is what a generic Tag pinning expands over (Pins § 6.2).

## 5. ~~Descriptor tags `K` / `Z` mean content categories~~ — withdrawn

Worksheet W18 was rejected (2026-09-27). Trusted Lists carry no descriptor tags. Pinnings use a multi-letter `context` tag instead, pending review.

## 6. Trusted List kinds: `30397` is for lists (proposed for `trusted-lists.md`)

**Proposed replacement for the kind table in `trusted-lists.md`:**

| TL kind | = TA + 10 | Member type | Member tag | A client… |
|---|---|---|---|---|
| `30392` | `30382` | pubkeys | `p` | fetches the profile |
| `30393` | `30383` | events | `e` | fetches the event |
| `30394` | `30384` | addressable events | `a` | fetches the event |
| `30395` | `30385` | external identifiers (NIP-73) | `i` | resolves the identifier |
| **`30396`** | **`30386`** | **DList items** (`39999` and `9999` alike) | **`a` / `e`** | **fetches the item, reads it through its header** |
| **`30397`** | **`30387`** | **lists** (DList headers, as parents) | **`z`** | **queries `#z` for the list's items** |

Add two rules:

- **The kind says how members are referenced; a separate category (Treasure Maps § 4.3) says where they come from.** A Trusted List of restaurants is `30396`; a Trusted List of DLists is `30397`.
- **`z` members are references, never membership claims.** Readers MUST NOT count a Trusted List as an item of the lists it names.

`30386` (a Score about a DList item) and `30387` (a Score about a list) are the matching NIP-85-style Score kinds. None of the four exists in NIP-85 today; (worksheet W17: propose all four together, as part of the Trusted Lists family; no NIP-85 amendment for now). All four would be proposed upstream together.

## 7. `tags.md` and `event-taggings.md`: Trusted Lists they spawn

**Proposed short section** in each: a (Tag, category) pair spawns a Trusted List and a Score family, keyed and kinded as in [Spawning](./spawning.md) § 3.2. Tags applied to items of a DList spawn `30396` lists. Tags applied to DLists themselves spawn `30397` lists.
