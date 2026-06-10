> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** BIBLE.md §23 (extracted per protocols-directory story 4, `protocols-directory` ADR 0002) and ADR 0011 (community-reference line); extraction pattern: `protocols-directory` ADR 0001

---

Class-Thread Membership Tags (`n`, `s`)
=====

This NIP defines two single-character tags, `n` and `s`, that encode **class-thread structure** — set membership and superset relationships — directly on [Tapestry Concepts](./tapestry-concepts.md) events, in child-claims-parent direction.

## Relationship to Tapestry Concepts

The `n` and `s` tags are defined for kind `39999` events only. They follow the same child-claims-parent pattern as the `z` parent pointer: the event that *belongs* carries the tag naming what it belongs to. Because they are single-character tags, relays index them by default (NIP-01), so class-thread structure is queryable by tag filter — and no parent ever needs to maintain a children-list event, which is what lets the structure decentralize naturally.

Together with `z`, these tags let a single source event carry both its membership and its structural position, with no separate relationship-descriptor event required.

## The tags

| Tag | Logical relationship | On-wire (child carries the tag) | Derived relationship (in the consumer's graph) |
|---|---|---|---|
| `n` | HAS_ELEMENT-inverse | child claims a parent set / superset | `(parent)-[HAS_ELEMENT]->(child)` |
| `s` | IS_A_SUPERSET_OF-inverse | child set/superset claims a parent superset | `(parent)-[IS_A_SUPERSET_OF]->(child)` |

Note the **direction flip**: on the wire, the child claims its parent; the relationship a consumer derives points parent→child. The relationship names are shared protocol vocabulary — the same identifiers appear in word-wrapper `relationshipTypes` payloads (see [Tapestry Concepts](./tapestry-concepts.md)).

## Tag value format

The tag value is the parent's a-tag form (`<kind>:<pubkey>:<d-tag>`) — the same shape as `z` tag values. For example:

```json
["n", "39999:<pubkey>:the-set-of-paid-nostr-relays"]
```

## Multi-parent semantics

An event may carry multiple `n` tags (member of multiple sets) and multiple `s` tags (subset of multiple supersets — rare but expressible). Same multi-tag pattern as `z`.

## Retrieval

All children of a parent `X` are returned by a relay filter on the indexed tag — `{"#n": ["<X's a-tag>"]}` (likewise `#s`). The parent maintains no children list; the children's own signed events are the source of truth for the structure.

## Security considerations

Consuming `n`/`s` tags from curators you do not control (a *curator* here is the keyholder whose signed events define a graph) carries known abuse patterns. Three rules are binding on consumers:

1. **Authorship gate.** When attributing class-thread structure to a curator, derive relationships only from events **signed by that curator** (event `pubkey` equals the curator's key). A tag naming some graph's node, published by anyone else, derives nothing in that graph. Without this gate, anyone can publish `["n", "<your-superset-address>"]` and graft themselves into a graph you trust (cross-instance election).
2. **No cross-graph derivation.** Relationships derived from a curator's tags stay within that curator's graph. Bridging two curators' graphs — for example, linking your own structure to a community's — is an explicit, consumer-side editorial act, never derived from a foreign event's tags.
3. **Class-thread relationships only.** From `n`/`s` a consumer derives only `HAS_ELEMENT` and `IS_A_SUPERSET_OF`. No editorial relationship is inferable from these tags; the editorial inherit-from relationship has its own single-char tag, `b` — specified in [Inherit-From & Resolved Definition](./inherit-from.md).

## Direction principle and reserved letters

Lowercase single-char tags encode **child-claims-parent**. Uppercase single-char tags (currently unassigned) would encode **parent-claims-child** for the same logical relationship type, if a future revision adopts the inverse direction. **Do not assign uppercase forms speculatively** — only when a concrete consumer needs the inverse direction *and* that inverse cannot be more cleanly expressed as a derived aggregate query (the `#n=X` filter already returns all children of `X`). The inherit-from tag `b` ([Inherit-From & Resolved Definition](./inherit-from.md)) follows this convention and reserves uppercase **`B`** for a future parent-claims-child / federation inverse.

**Candidate letters.** Further relationships (`IS_A_PROPERTY_OF`, `REFERENCES`, additional editorial types) are candidates for future single-char assignments. The cross-spec letter registry is an open protocol problem tracked as worksheet [W2](../worksheet.md#w2--single-char-tag-namespace-registry); the open publishing semantics for `REFERENCES` are tracked as [W5](../worksheet.md#w5--references-publishing-semantics). This spec assigns no new letters.
