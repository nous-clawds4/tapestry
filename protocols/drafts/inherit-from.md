> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** BIBLE.md §25/§26 (extracted per protocols-directory story 5, `protocols-directory` ADR 0003) and ADRs 0027/0028; extraction pattern: `protocols-directory` ADR 0001

---

Inherit-From & Resolved Definition (`b`)
=====

This NIP defines a general definitional-inheritance primitive in two halves: the **`b` tag** (the write primitive — "my definition is this parent's, unless I state otherwise") and the **resolved definition** (the read primitive — the live, deterministic merge that computes what a node's definition actually resolves to).

## Relationship to other specs

The `b` tag rides on the addressable kinds defined by [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md). It is the single-char, child-claims-parent sibling of the [class-thread tags](./class-thread-tags.md) — but where `n`/`s` express *structure* (containment), `b` expresses *editorial inheritance* (deference). It lets any addressable DList object declare deference to another's definition.

## The `b` tag

| Tag | Logical relationship | On-wire (child carries the tag) | Derived relationship (in the consumer's graph) |
|---|---|---|---|
| `b` | inherit-from (definitional inheritance with override) | child claims a parent it defers to | `(child)-[INHERITS_FROM]->(parent)` |

**Wire format:** `["b", "<parent-a-tag>", "<type>"]`. Element 2 is the parent's a-tag (`<kind>:<pubkey>:<d-tag>` — same shape as `z`/`n`/`s` values; the NIP-01-indexed value). Element 3 is the **type**, default `"inherit"`, carried as a non-indexed positional element (as NIP-01's `e` tag carries its `root`/`reply` marker). E.g. `["b", "39998:<alice>:dogs", "inherit"]` — "my `dogs` concept defers to Alice's."

**Kinds:** defined for **kind 39998 and kind 39999** — any addressable DList object (concept headers *and* items/sets/declarations). Broader than the [class-thread tags](./class-thread-tags.md), which are kind-39999-only.

## Multi-parent semantics

An event may carry multiple `b` tags (inherit from multiple parents — rare but expressible), following the same multi-tag pattern as `z`/`n`/`s`. **Order is load-bearing:** when ancestors conflict on a field the child leaves unstated, the first-listed `b` wins — resolved below.

## The derived relationship

`INHERITS_FROM` is an **asserted** relationship — the child itself published the `b` tag. It MAY carry the type from tag element 3 (default `"inherit"`).

**Direction — child→parent; do NOT flip.** Unlike the [class-thread tags](./class-thread-tags.md), whose child-claims-parent encoding is flipped into a *parent→child* derived relationship (containment: the parent owns the child), `b` does **not** flip: consumers derive `(child)-[INHERITS_FROM]->(parent)`, because (a) deference reads naturally child→parent, and (b) a parent's **incoming** `INHERITS_FROM` edges are exactly "everyone who defers to this definition" — the query the Aggregation section below needs. Implementers must not copy the `n`/`s` direction-flip.

## Resolution: the resolved definition

A node's **resolved definition** — what its definition actually resolves to after following its `b` deferences — is computed **on read**, against its ancestors' *current* state, and never snapshotted into the node. The walk is **live**: a child tracks its parents' future edits ("whatever Alice says"). The derived `INHERITS_FROM` relationship is the only materialized artifact.

The **deference closure** — the set of all nodes a node transitively defers to — is likewise computed on read, never stored. It is **not guaranteed acyclic**: mutual deference (Alice `b`→Bob, Bob `b`→Alice) creates cycles, which the resolution rule's visited-set handles.

**Resolution rule:**

1. **The node's own stated fields win.** A field the child states explicitly overrides the inherited value; an omitted field is inherited. An unedited child performs pure inheritance. Any conflict is settlable by stating the field yourself; conflicts only bite for fields you leave unstated.
2. **For unstated conflicts among multiple `b` parents, first-listed `b` wins** — walk depth-first in the order the `b` tags are listed on the event; the first value to land sticks. Precedence is **author-controlled** (you order your `b` tags), deterministic, and **observer-independent** (a node's own definition does not change based on who resolves it).
3. **A visited-set keyed on a-tag bounds cycles.** The walk always terminates — at a root (no `b` tag), at an implementation-chosen depth guard, or via the visited-set — and always yields *an* answer, never "ambiguous → undefined."

```
resolved(node):
  visited = {}
  return merge_walk(node, visited)

merge_walk(node, visited):
  if node.a-tag in visited: return {}            # cycle guard
  visited.add(node.a-tag)
  result = {}
  for parent in node.b-tags (in listed order):   # ancestors; first-listed wins
    result = fill_unset(result, merge_walk(resolve(parent), visited))
  return overlay(result, node.statedFields)       # the node's own fields always win
```

## Scope (v1)

Field-level override only — a stated field replaces the inherited one wholesale. The **set-valued override algebra** — how a child adds/removes/replaces individual *elements* of an inherited set — is explicitly deferred to the first consumer that needs it, tracked as worksheet [W6](../worksheet.md#w6--set-valued-override-algebra-for-resolved-definition).

## Security considerations

**Trust-coupling is intrinsic to live deference.** Inheriting from a parent means inheriting its *future* edits and trust trajectory — if the parent drifts or is compromised, the child's effective definition drifts silently. The escape hatches are built in: the child's overrides pin the fields it wants fixed, and re-publishing the `b` tag (a different parent, or detaching entirely) severs the deference.

## Aggregation: who defers to a definition

Because the derived relationship points child→parent, a parent's **incoming** `INHERITS_FROM` edges enumerate exactly "everyone who defers to this definition" — a trust-weightable signal an observer can rank. Its use as a mechanism for cross-deployment concept identity is an open protocol problem, tracked as worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity).

## Place in the editorial-relationship family

*Only `b` is defined in this document. `REFERENCES`, `IMPORT`, and `SUPERCEDES` are named here for contrast only; their wire formats are not specified anywhere yet (`REFERENCES`' open publishing semantics are tracked as worksheet [W5](../worksheet.md#w5--references-publishing-semantics)).*

`b` is the first editorial relationship encoded as a single-char tag rather than a relationship-descriptor event. It is distinct from the others:

| Relationship | Posture | Liveness | Override | Implies `IS_A_SUPERSET_OF`? |
|---|---|---|---|---|
| `REFERENCES` (concept-level) | non-committal bookmark ("may pull later") | — | — | no |
| `IMPORT` | absorb the parent's elements; **importer** authoritative | snapshot/pull | agreement, not override | **yes** |
| `SUPERCEDES` | replace the parent with mine | — | — | no |
| **`b` / `INHERITS_FROM`** | **defer; parent stays authoritative** | **live (re-resolved each read)** | **first-class "unless stated"** | **no** |

`b` follows the lowercase child-claims-parent direction principle and reserves uppercase `B` for a future parent-claims-child / federation inverse — see the [class-thread tags spec](./class-thread-tags.md) § "Direction principle and reserved letters"; the convention is not restated here.
