> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** the **`b` write-primitive** (firmware emitter, `pointer`-typed seed) and the **type-gated edge derivation** (`pointer`/absent → `REFERENCES {source:'b-tag'}`, `inherit` → `INHERITS_FROM`) are **implemented** — `community-reference` ADR 0034 (emitter in `pass_communityReferences`, derivation in `buildImportCypher`) and applied to the tag concepts via `tag-federation` ADR 0002. The **resolved-definition read primitive** (the live inherit-typed merge/closure walk, §"Resolution") is **not** implemented (firmware seeds only `pointer`, which doesn't participate in resolution). The `inherit-items` type (`dlist-curation` ADR 0003) derives the pointer form until the derivation is updated, and no item-set resolver exists (intake entry 2026-09-10).
> **Sources:** BIBLE.md §25/§26 (extracted per protocols-directory story 5, `protocols-directory` ADR 0003) and ADRs 0027/0028, as amended by `community-reference` ADR 0029 (the element-3 type registry); extraction pattern: `protocols-directory` ADR 0001

---

Inherit-From & Resolved Definition (`b`)
=====

This NIP defines a general definitional-relationship primitive in two halves: the **`b` tag** (the write primitive — a typed, child-claims-parent pointer at another addressable object) and the **resolved definition** (the read primitive — the live, deterministic merge that computes what a node's definition actually resolves to). The `b` tag carries one of three **types**: `"pointer"` (correspondence — "this is the shared definition my object corresponds to," with no deference), `"inherit"` (definitional deference — "my definition is this parent's, unless I state otherwise"), and `"inherit-items"` (item inheritance — "my list's items are this parent's, plus my own"). Only `"inherit"`-typed tags participate in definition resolution; only `"inherit-items"`-typed tags in item resolution.

## Relationship to other specs

The `b` tag rides on the addressable kinds defined by [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md). It is the single-char, child-claims-parent sibling of the [class-thread tags](./class-thread-relationships.md) — but where `n`/`s` express *structure* (containment), `b` expresses an *editorial relation* whose meaning is selected by its type: correspondence (`"pointer"`), definitional deference (`"inherit"`), or item inheritance (`"inherit-items"`). It lets any addressable DList object bookmark, or declare deference to, another's definition.

## The `b` tag

| Tag + type | Logical relationship | On-wire (child carries the tag) | Derived relationship (in the consumer's graph) |
|---|---|---|---|
| `b` type `"inherit"` | inherit-from (definitional inheritance with override) | child claims a parent it defers to | `(child)-[INHERITS_FROM]->(parent)` |
| `b` type `"inherit-items"` | inherit-items (item inheritance, additive) | child claims a parent whose items it inherits | `(child)-[INHERITS_ITEMS_FROM]->(parent)` |
| `b` type `"pointer"` (incl. absent type) | correspondence (non-committal; no deference) | child names a target it corresponds to | `(child)-[REFERENCES {source:'b-tag'}]->(target)` |

**Wire format:** `["b", "<target-a-tag>", "<type>"]`. Element 2 is the target's a-tag (`<kind>:<pubkey>:<d-tag>` — same shape as `z`/`n`/`s` values; the NIP-01-indexed value). Element 3 is the **type**, one of a closed three-value registry (`community-reference` ADR 0029; `"inherit-items"` added by `dlist-curation` ADR 0003):

- **`"pointer"`** — a correspondence/locator claim: "my object corresponds to that one." No deference, no resolution semantics, no trust-coupling. **An absent element 3 reads as `"pointer"`** — the fail-safe, least-commitment reading: an underspecified tag never grants live deference. E.g. `["b", "39998:<community>:dogs", "pointer"]` — "my `dogs` concept corresponds to the community's."
- **`"inherit"`** — live definitional deference: "my definition is this parent's, unless I state otherwise." Must be explicit. E.g. `["b", "39998:<alice>:dogs", "inherit"]` — "my `dogs` concept defers to Alice's."
- **`"inherit-items"`** — live deference over the parent's *items*: "my list's items are this parent's items, plus my own." Additive in v1 (a child cannot subtract from what it inherits). Must be explicit. Inherits no definition fields — that is `"inherit"`'s facet; the two may be carried together. E.g. `["b", "39998:<community>:dogs", "inherit-items"]` — "my `dogs` list inherits the community list's items, plus my own." Not a declared affiliation (see [Shared Concepts](./shared-concepts.md) § "Declared affiliation").

**Choosing the type — one question:** *when they edit their list, should the meaning of yours change?* Yes → `"inherit"`; no — just connected/corresponding → `"pointer"`. *When they add an item, should it appear in yours?* Yes → `"inherit-items"` (with or without `"inherit"`, per the definition question).

The type is carried as a non-indexed positional element (as NIP-01's `e` tag carries its `root`/`reply` marker) — so relays cannot filter `#b` results by type; consumers fetch and filter locally. Future type values (e.g. ADR 0027's anticipated deliberate-divergence marker) require a new ADR. The registry is the deference family's namespace: `"inherit"` is the definition facet and `inherit-<facet>` names any further facet, each by its own ADR. **There is no `inherit-all`** — an author wanting several facets carries one tag per facet. **An absent or *unknown* element 3 reads as `"pointer"`**; readers gate on the explicit strings `"inherit"` and `"inherit-items"`, never on "not pointer" — which is what lets a facet be added without any existing reader granting deference it was not told about. The `"pointer"` type realizes the concept-level `REFERENCES` posture on the wire — it resolves what worksheet [W5](../worksheet.md#w5--references-publishing-semantics) tracked as option (a), a consumer-owned tag on the consumer's own header.

**Reserved value (element 2).** Exactly one non-locator value is **reserved**: the literal string `b-tag-deferred` — carried as a bare `["b", "b-tag-deferred"]` with no type element, it marks its carrier as **deliberately unaffiliated** ("I considered a shared twin and chose none"; semantics in [Shared Concepts](./shared-concepts.md) § "Deliberate non-affiliation", resolved worksheet [W16](../worksheet.md#w16--marking-deliberately-no-shared-affiliation-sentinel-b-value-vs-local-disposition)). It is by construction neither an a-tag nor an event id; the value form remains otherwise closed, and no other non-locator string is valid. Consumers MUST derive nothing from it — no edge, no target node, no aggregation weight of any kind — and SHOULD render it as its own disposition state, never as a failed lookup. The type registry above is untouched: this reserves a *value*, not a type.

**Kinds:** defined for **kind 39998 and kind 39999** — any addressable DList object (concept headers *and* items/sets/declarations). Broader than the [class-thread tags](./class-thread-relationships.md), which are kind-39999-only.

## Multi-parent semantics

An event may carry multiple `b` tags, mixing types freely (e.g. one `"inherit"` delegation plus one `"pointer"` correspondence). Multiple inherit-typed tags (inherit from multiple parents) are rare but expressible, following the same multi-tag pattern as `z`/`n`/`s`. **Order is load-bearing among inherit-typed tags only:** when ancestors conflict on a field the child leaves unstated, the first-listed inherit-typed `b` wins — resolved below. Pointer-typed tags never participate in resolution, and their position among the `b` tags carries no meaning. Multiple `"inherit-items"` tags union their parents' items (§ "Resolution: the resolved item set"); their order carries no meaning either.

## The derived relationship

Derivation is **type-gated**, and the gate requires an *explicit* `"inherit"` or `"inherit-items"` — an absent or unknown type reads as `"pointer"`; consumers must never gate on "not pointer":

- An **inherit-typed** `b` tag derives `(child)-[INHERITS_FROM]->(parent)` — an **asserted** relationship (the child itself published the tag), canonical (no `source` property).
- An **`inherit-items`-typed** `b` tag derives `(child)-[INHERITS_ITEMS_FROM]->(parent)` — asserted and canonical like `INHERITS_FROM`, and a *distinct* relationship, so that a bare match on `INHERITS_FROM` keeps meaning definition deference (`dlist-curation` ADR 0003).
- A **pointer-typed** (or untyped) `b` tag derives a concept-level `(child)-[REFERENCES {source:'b-tag'}]->(target)` edge — likewise asserted, but carrying `source`, because concept-level `REFERENCES` is overloaded with other producers and `source` is the disambiguator (see the consuming deployment's collision contract, BIBLE §22).

**Direction — child→parent/target; do NOT flip.** Unlike the [class-thread tags](./class-thread-relationships.md), whose child-claims-parent encoding is flipped into a *parent→child* derived relationship (containment: the parent owns the child), `b` does **not** flip — for every type: (a) deference and correspondence both read naturally child→target, and (b) a target's **incoming** edges are exactly "everyone who defers to / corresponds to this definition" — the queries the Aggregation section below needs. Implementers must not copy the `n`/`s` direction-flip.

## Resolution: the resolved definition

A node's **resolved definition** — what its definition actually resolves to after following its inherit-typed `b` deferences — is computed **on read**, against its ancestors' *current* state, and never snapshotted into the node. The walk is **live**: a child tracks its parents' future edits ("whatever Alice says"). The walk follows **`"inherit"`-typed `b` tags only** — pointer-typed and `"inherit-items"`-typed tags are invisible to definition resolution and to the definition deference closure below (items have their own walk, § "Resolution: the resolved item set"). The derived `INHERITS_FROM` relationship is the only materialized artifact.

The **deference closure** — the set of all nodes a node transitively defers to, following unbroken chains of inherit-typed `b` tags — is likewise computed on read, never stored. A pointer-typed tag **breaks the chain**: it contributes nothing to the closure, and a node carrying only pointer-typed `b` tags has a closure of itself alone. **Affiliation rides the closure:** "is this node affiliated with definition X" = "does X appear in the node's deference closure" — transitive through deference (a deliberate, documented consequence of declaring `"inherit"`), never through mere correspondence. Closure membership is a set; `b`-tag order is irrelevant to it (order matters only for field resolution). The closure is **not guaranteed acyclic**: mutual deference (Alice `b`→Bob, Bob `b`→Alice) creates cycles, which the resolution rule's visited-set handles.

The **any-type** counterpart — *reach*, the closure over every `b` type — is a distinct construct defined in [Shared Concepts](./shared-concepts.md) § Reach; it feeds stamp selection, never resolution.

**Resolution rule:**

1. **The node's own stated fields win.** A field the child states explicitly overrides the inherited value; an omitted field is inherited. An unedited child performs pure inheritance. Any conflict is settlable by stating the field yourself; conflicts only bite for fields you leave unstated.
2. **For unstated conflicts among multiple inherit-typed `b` parents, first-listed wins** — walk depth-first in the order the inherit-typed `b` tags are listed on the event; the first value to land sticks. Precedence is **author-controlled** (you order your `b` tags), deterministic, and **observer-independent** (a node's own definition does not change based on who resolves it).
3. **A visited-set keyed on a-tag bounds cycles.** The walk always terminates — at a root (a node with no inherit-typed `b` tag; a node carrying only pointer-typed `b` tags is a root), at an implementation-chosen depth guard, or via the visited-set — and always yields *an* answer, never "ambiguous → undefined."

```
resolved(node):
  visited = {}
  return merge_walk(node, visited)

merge_walk(node, visited):
  if node.a-tag in visited: return {}            # cycle guard
  visited.add(node.a-tag)
  result = {}
  for parent in node.b-tags where type == "inherit" (in listed order):
                                                 # ancestors; first-listed wins
    result = fill_unset(result, merge_walk(resolve(parent), visited))
  return overlay(result, node.statedFields)       # the node's own fields always win
```

In the pseudocode, `parent` ranges over the node's **explicitly inherit-typed** `b` tags in listed order — the filter is `type == "inherit"`, never "not pointer," since an absent type means `"pointer"`; `resolve(parent)` fetches the node at the a-tag carried in that tag's second element.

A node's *stated fields* are the fields its own definition states. The precise binding of definition fields to the payload encoding — which parts of a node's `json`-tag payload participate in resolution — is **not yet formalized**.

## Resolution: the resolved item set

A node's **resolved item set** — the items its list actually holds after following its `"inherit-items"` deferences — is, like the resolved definition, computed **on read** against its parents' *current* items and never snapshotted. The walk follows **`"inherit-items"`-typed `b` tags only**; `"inherit"` and `"pointer"` tags are invisible to it. Its closure — the **items-deference closure** — is the set of nodes reached through unbroken chains of `"inherit-items"` tags; it is distinct from the definition deference closure and does not feed affiliation.

**Rule (v1, additive):**

1. **Union.** The resolved item set is the node's own items together with the resolved item sets of every parent its `"inherit-items"` tags name — transitively.
2. **Order carries no meaning.** Sets union; among several `"inherit-items"` parents there is nothing to rank (contrast the field walk, where first-listed wins).
3. **A visited-set keyed on a-tag bounds cycles**; the walk always terminates and always yields a set.
4. **No subtraction.** A child cannot remove or replace an item it inherits; removal and replacement are **not defined** in v1 and remain deferred (worksheet [W6](../worksheet.md#w6--set-valued-override-algebra-for-resolved-definition)).

```
items(node):
  visited = {}
  return items_walk(node, visited)

items_walk(node, visited):
  if node.a-tag in visited: return {}            # cycle guard
  visited.add(node.a-tag)
  result = own_items(node)
  for parent in node.b-tags where type == "inherit-items":   # order-free
    result = result ∪ items_walk(resolve(parent), visited)
  return result
```

`own_items(node)` is the set of items filed under the node — for a kind-39998 header, the kind-39999 events whose `z` names it ([Decentralized Lists](../nips/decentralized-lists.md)). What "its items" means for a kind-39999 carrier is **not yet formalized**, mirroring the definition walk's payload-binding note above; the resolver follow-up settles it.

**A candidate set, not a trusted one.** The resolved item set says which items a reader *considers*; it says nothing about whether any of them is trusted. Every contributing item is still filtered at read time by the observer's point of view — by its own author's standing, under the observer-relative rule of [Shared Concepts](./shared-concepts.md) — exactly as the node's own items are. Item inheritance therefore never launders trust: an item inherited from a parent is judged by the same observer, on the same terms, as if it had been found under the parent.

`"inherit-items"` inherits no definition fields and `"inherit"` inherits no items; a node may carry both, to the same target or to different ones, and each walk reads only its own type.

## Scope (v1)

The type registry is **closed at three values** (`"pointer"`, `"inherit"`, `"inherit-items"`); new values require a new ADR. In aggregation ([Shared Concepts](./shared-concepts.md)), pointer-typed edges carry **zero aggregation weight** in v1; graded weighting is deferred to the future registry ADR. Field-level override only — a stated field replaces the inherited one wholesale. The **set-valued algebra** for inherited items is specified above for the **additive** case (`"inherit-items"`, `dlist-curation` ADR 0003 — the first consumer); **removal and replacement** of inherited items remain deferred, tracked as worksheet [W6](../worksheet.md#w6--set-valued-override-algebra-for-resolved-definition), and when designed will operate over the items-deference closure only.

## Security considerations

**Trust-coupling is intrinsic to live deference — and scoped to it.** Inheriting from a parent (type `"inherit"`) means inheriting its *future* edits and trust trajectory — if the parent drifts or is compromised, the child's effective definition drifts silently. The escape hatches are built in: the child's overrides pin the fields it wants fixed, and re-publishing the `b` tag (a different parent, downgrading `"inherit"` to `"pointer"`, or detaching entirely) severs the deference. A pointer-typed tag carries **no** trust-coupling — which is why the fail-safe default is `"pointer"`: an underspecified tag must never silently subscribe its author to someone else's future edits. The same coupling holds for `"inherit-items"`: inheriting a parent's items means inheriting its future *additions*, and the same escape hatches apply — re-publish the tag naming a different parent, downgrade it to `"pointer"`, or detach.

## Aggregation: who defers to a definition

The policy reading of a target's incoming `b`-derived edges — deference aggregation vs. discovery walks, observer weighting, and the cloud model built on them — is specified in [Shared Concepts](./shared-concepts.md). One mechanical fact belongs with the primitive: because the type element is non-indexed, a relay-side `#b` filter returns every type; aggregators fetch, then filter by type locally.

## Place in the editorial-relationship family

*Only `b` is defined in this document. `IMPORT` and `SUPERCEDES` are named here for contrast only; their wire formats are not specified anywhere yet. The concept-level `REFERENCES` posture, formerly in that unspecified list, is now wire-encodable as the pointer-typed `b` tag (above) — resolving worksheet [W5](../worksheet.md#w5--references-publishing-semantics), which graduated to this spec.*

`b` is the first editorial relationship encoded as a single-char tag rather than a relationship-descriptor event. Its three types span three rows of the family:

| Relationship | Posture | Liveness | Override | Implies `IS_A_SUPERSET_OF`? |
|---|---|---|---|---|
| **`b` type `"pointer"` / `REFERENCES`** (concept-level) | non-committal correspondence ("may pull later") | — | — | no |
| `IMPORT` | absorb the parent's elements; **importer** authoritative | snapshot/pull | agreement, not override | **yes** |
| `SUPERCEDES` | replace the parent with mine | — | — | no |
| **`b` type `"inherit"` / `INHERITS_FROM`** | **defer; parent stays authoritative** | **live (re-resolved each read)** | **first-class "unless stated"** | **no** |
| **`b` type `"inherit-items"` / `INHERITS_ITEMS_FROM`** | **defer over items; parent stays authoritative** | **live (re-resolved each read)** | additive only (v1) — no subtraction | **no** — deference, not containment |

`b` follows the lowercase child-claims-parent direction principle and reserves uppercase `B` for a future parent-claims-child / federation inverse — see the [class-thread relationships spec](./class-thread-relationships.md) § "Direction principle and reserved letters"; the convention is not restated here.
