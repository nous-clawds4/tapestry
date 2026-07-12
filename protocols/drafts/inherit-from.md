> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** the **`b` write-primitive** (firmware emitter, `pointer`-typed seed) and the **type-gated edge derivation** (`pointer`/absent → `REFERENCES {source:'b-tag'}`, `inherit` → `INHERITS_FROM`) are **implemented** — `community-reference` ADR 0034 (emitter in `pass_communityReferences`, derivation in `buildImportCypher`) and applied to the tag concepts via `tag-federation` ADR 0002. The **resolved-definition read primitive** (the live inherit-typed merge/closure walk, §"Resolution") is **not** implemented (firmware seeds only `pointer`, which doesn't participate in resolution).
> **Sources:** BIBLE.md §25/§26 (extracted per protocols-directory story 5, `protocols-directory` ADR 0003) and ADRs 0027/0028, as amended by `community-reference` ADR 0029 (the element-3 type registry); extraction pattern: `protocols-directory` ADR 0001

---

Inherit-From & Resolved Definition (`b`)
=====

This NIP defines a general definitional-relationship primitive in two halves: the **`b` tag** (the write primitive — a typed, child-claims-parent pointer at another addressable object) and the **resolved definition** (the read primitive — the live, deterministic merge that computes what a node's definition actually resolves to). The `b` tag carries one of two **types**: `"pointer"` (correspondence — "this is the shared definition my object corresponds to," with no deference) and `"inherit"` (definitional deference — "my definition is this parent's, unless I state otherwise"). Only inherit-typed tags participate in resolution.

## Relationship to other specs

The `b` tag rides on the addressable kinds defined by [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md). It is the single-char, child-claims-parent sibling of the [class-thread tags](./class-thread-tags.md) — but where `n`/`s` express *structure* (containment), `b` expresses an *editorial relation* whose meaning is selected by its type: correspondence (`"pointer"`) or definitional deference (`"inherit"`). It lets any addressable DList object bookmark, or declare deference to, another's definition.

## The `b` tag

| Tag + type | Logical relationship | On-wire (child carries the tag) | Derived relationship (in the consumer's graph) |
|---|---|---|---|
| `b` type `"inherit"` | inherit-from (definitional inheritance with override) | child claims a parent it defers to | `(child)-[INHERITS_FROM]->(parent)` |
| `b` type `"pointer"` (incl. absent type) | correspondence (non-committal; no deference) | child names a target it corresponds to | `(child)-[REFERENCES {source:'b-tag'}]->(target)` |

**Wire format:** `["b", "<target-a-tag>", "<type>"]`. Element 2 is the target's a-tag (`<kind>:<pubkey>:<d-tag>` — same shape as `z`/`n`/`s` values; the NIP-01-indexed value). Element 3 is the **type**, one of a closed two-value registry (`community-reference` ADR 0029):

- **`"pointer"`** — a correspondence/locator claim: "my object corresponds to that one." No deference, no resolution semantics, no trust-coupling. **An absent element 3 reads as `"pointer"`** — the fail-safe, least-commitment reading: an underspecified tag never grants live deference. E.g. `["b", "39998:<community>:dogs", "pointer"]` — "my `dogs` concept corresponds to the community's."
- **`"inherit"`** — live definitional deference: "my definition is this parent's, unless I state otherwise." Must be explicit. E.g. `["b", "39998:<alice>:dogs", "inherit"]` — "my `dogs` concept defers to Alice's."

**Choosing the type — one question:** *when they edit their list, should the meaning of yours change?* Yes → `"inherit"`; no — just connected/corresponding → `"pointer"`.

The type is carried as a non-indexed positional element (as NIP-01's `e` tag carries its `root`/`reply` marker) — so relays cannot filter `#b` results by type; consumers fetch and filter locally. Future type values (e.g. ADR 0027's anticipated deliberate-divergence marker) require a new ADR. The `"pointer"` type realizes the concept-level `REFERENCES` posture on the wire — it resolves what worksheet [W5](../worksheet.md#w5--references-publishing-semantics) tracked as option (a), a consumer-owned tag on the consumer's own header.

**Kinds:** defined for **kind 39998 and kind 39999** — any addressable DList object (concept headers *and* items/sets/declarations). Broader than the [class-thread tags](./class-thread-tags.md), which are kind-39999-only.

## Multi-parent semantics

An event may carry multiple `b` tags, mixing types freely (e.g. one `"inherit"` delegation plus one `"pointer"` correspondence). Multiple inherit-typed tags (inherit from multiple parents) are rare but expressible, following the same multi-tag pattern as `z`/`n`/`s`. **Order is load-bearing among inherit-typed tags only:** when ancestors conflict on a field the child leaves unstated, the first-listed inherit-typed `b` wins — resolved below. Pointer-typed tags never participate in resolution, and their position among the `b` tags carries no meaning.

## The derived relationship

Derivation is **type-gated**, and the gate requires an *explicit* `"inherit"` — an absent type reads as `"pointer"`; consumers must never gate on "not pointer":

- An **inherit-typed** `b` tag derives `(child)-[INHERITS_FROM]->(parent)` — an **asserted** relationship (the child itself published the tag), canonical (no `source` property).
- A **pointer-typed** (or untyped) `b` tag derives a concept-level `(child)-[REFERENCES {source:'b-tag'}]->(target)` edge — likewise asserted, but carrying `source`, because concept-level `REFERENCES` is overloaded with other producers and `source` is the disambiguator (see the consuming deployment's collision contract, BIBLE §22).

**Direction — child→parent/target; do NOT flip.** Unlike the [class-thread tags](./class-thread-tags.md), whose child-claims-parent encoding is flipped into a *parent→child* derived relationship (containment: the parent owns the child), `b` does **not** flip — for either type: (a) deference and correspondence both read naturally child→target, and (b) a target's **incoming** edges are exactly "everyone who defers to / corresponds to this definition" — the queries the Aggregation section below needs. Implementers must not copy the `n`/`s` direction-flip.

## Resolution: the resolved definition

A node's **resolved definition** — what its definition actually resolves to after following its inherit-typed `b` deferences — is computed **on read**, against its ancestors' *current* state, and never snapshotted into the node. The walk is **live**: a child tracks its parents' future edits ("whatever Alice says"). The walk follows **inherit-typed `b` tags only** — pointer-typed tags are invisible to resolution. The derived `INHERITS_FROM` relationship is the only materialized artifact.

The **deference closure** — the set of all nodes a node transitively defers to, following unbroken chains of inherit-typed `b` tags — is likewise computed on read, never stored. A pointer-typed tag **breaks the chain**: it contributes nothing to the closure, and a node carrying only pointer-typed `b` tags has a closure of itself alone. **Affiliation rides the closure:** "is this node affiliated with definition X" = "does X appear in the node's deference closure" — transitive through deference (a deliberate, documented consequence of declaring `"inherit"`), never through mere correspondence. Closure membership is a set; `b`-tag order is irrelevant to it (order matters only for field resolution). The closure is **not guaranteed acyclic**: mutual deference (Alice `b`→Bob, Bob `b`→Alice) creates cycles, which the resolution rule's visited-set handles.

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

## Scope (v1)

The type registry is **closed at two values** (`"pointer"`, `"inherit"`); new values require a new ADR. In aggregation ([Shared Concepts](./shared-concepts.md)), pointer-typed edges carry **zero aggregation weight** in v1; graded weighting is deferred to the future registry ADR. Field-level override only — a stated field replaces the inherited one wholesale. The **set-valued override algebra** — how a child adds/removes/replaces individual *elements* of an inherited set — is explicitly deferred to the first consumer that needs it, tracked as worksheet [W6](../worksheet.md#w6--set-valued-override-algebra-for-resolved-definition); when designed, it operates over the inherit-typed deference closure only.

## Security considerations

**Trust-coupling is intrinsic to live deference — and scoped to it.** Inheriting from a parent (type `"inherit"`) means inheriting its *future* edits and trust trajectory — if the parent drifts or is compromised, the child's effective definition drifts silently. The escape hatches are built in: the child's overrides pin the fields it wants fixed, and re-publishing the `b` tag (a different parent, downgrading `"inherit"` to `"pointer"`, or detaching entirely) severs the deference. A pointer-typed tag carries **no** trust-coupling — which is why the fail-safe default is `"pointer"`: an underspecified tag must never silently subscribe its author to someone else's future edits.

## Aggregation: who defers to a definition

The policy reading of a target's incoming `b`-derived edges — deference aggregation vs. discovery walks, observer weighting, and the cloud model built on them — is specified in [Shared Concepts](./shared-concepts.md). One mechanical fact belongs with the primitive: because the type element is non-indexed, a relay-side `#b` filter returns both types; aggregators fetch, then filter by type locally.

## Place in the editorial-relationship family

*Only `b` is defined in this document. `IMPORT` and `SUPERCEDES` are named here for contrast only; their wire formats are not specified anywhere yet. The concept-level `REFERENCES` posture, formerly in that unspecified list, is now wire-encodable as the pointer-typed `b` tag (above) — resolving worksheet [W5](../worksheet.md#w5--references-publishing-semantics), which graduated to this spec.*

`b` is the first editorial relationship encoded as a single-char tag rather than a relationship-descriptor event. Its two types span two rows of the family:

| Relationship | Posture | Liveness | Override | Implies `IS_A_SUPERSET_OF`? |
|---|---|---|---|---|
| **`b` type `"pointer"` / `REFERENCES`** (concept-level) | non-committal correspondence ("may pull later") | — | — | no |
| `IMPORT` | absorb the parent's elements; **importer** authoritative | snapshot/pull | agreement, not override | **yes** |
| `SUPERCEDES` | replace the parent with mine | — | — | no |
| **`b` type `"inherit"` / `INHERITS_FROM`** | **defer; parent stays authoritative** | **live (re-resolved each read)** | **first-class "unless stated"** | **no** |

`b` follows the lowercase child-claims-parent direction principle and reserves uppercase `B` for a future parent-claims-child / federation inverse — see the [class-thread tags spec](./class-thread-tags.md) § "Direction principle and reserved letters"; the convention is not restated here.
