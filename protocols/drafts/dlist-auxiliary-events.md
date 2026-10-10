> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Implementation (reference deployment):** none. Nothing emits or reads `o` yet. The parked engineering entry is `engineering-team/stories/_intake.md` § "2026-10-10 — Emit and read the `o` tag".
> **Sources:** worksheet [W25](../worksheet.md#w25--auxiliary-events-of-a-dlist-header-o) (graduated here) and [W2](../worksheet.md#w2--single-char-tag-namespace-registry); the owner's design session of 2026-10-09: the owner proposed a lowercase back-pointer with a role element (first as `y` or `q`), with uppercase for the reverse; the letter `o`, role tokens and leaving `O` unassigned were suggested in the session and approved by the owner; the owner added bare-name values and kinds `39999`/`9999`. Also [Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept; [Opinionated Views](./opinionated-views.md) § 7; [Class Thread Relationships](./class-thread-relationships.md) § Direction principle; [Inherit-From](./inherit-from.md) (the `b` tag's shape and its rule for unknown types); `nostr-protocol/nips` at `a79e21d` (prior art).
> **Why this exists:** a DList grows events that serve it without being its items: a JSON Schema, a superset, a view brief. `z` can't point at the list they serve, because `z` makes an event an item. Tapestry ties its own core nodes to their header by `d` tags and payload, which works only for the header's own author and which relays can't index.

---

DList Auxiliary Events (`o`)
============================

`draft` `optional`

An **auxiliary event** serves a DList without being one of its items: it defines, validates, structures or presents the list. This NIP defines the `o` tag, by which an auxiliary event names the list it serves and the role it plays for it.

## 1. Terms

- **List** — a Decentralized List, as in the [DList NIP](../nips/decentralized-lists.md): a header, or a bare name for a list nobody has declared.
- **Auxiliary event** — an event that exists to serve a list: to define, validate, structure or present the list and its items. Tapestry's core nodes other than the Concept Header (the seven core-node roles in § 4; [Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept) and view briefs ([Opinionated Views](./opinionated-views.md) § 7) are auxiliary events.
- **Role** — what an auxiliary event does for its list: `json-schema`, `opinionated-view`, and so on (§ 4).

Items of the list are not auxiliary events, and neither are statements about the list or its items. § 8 lists what `o` is not for.

## 2. The `o` tag (normative)

```json
["o", "<list>", "<role>"]
```

- **Element 2 names the list served**, in one of the three forms the DList NIP allows for a `z` value:
  - a header's coordinate, `<kind>:<pubkey>:<d>`, for kinds `39998` and `39999`;
  - a header's event id, for kinds `9998` and `9999`;
  - a bare name, for a list nobody has declared, such as `"restaurants"`.

  Element 2 is the value relays index (NIP-01). Readers MUST NOT assume a `39998:` prefix.
- **Element 3 is the role** (§ 4). It is never a relay hint. If relay hints are ever wanted, they go in element 4.
- **Matching is exact string equality**, as for `z`. `"dog"`, `"Dog"` and `"dogs"` are three different lists.

Readers tell the three forms apart the way they do for `z`. The DList NIP doesn't spell this out; the usual reading is that 64 lowercase hex characters are an event id, `<kind>:<64 lowercase hex>:<d>` is a coordinate, and anything else is a bare name (open question 1).

A JSON Schema that Alice publishes for her `dog` concept:

```json
{ "kind": 39999, "pubkey": "<alice>", "content": "", "tags": [
  ["d", "dog-json-schema"],
  ["z", "39998:<deployment key>:json-schema"],
  ["o", "39998:<alice>:dog", "json-schema"],
  ["json", "{\"word\": {…}, \"jsonSchema\": {…}}"]
]}
```

Its `z` makes it an item on the list of JSON Schemas. Its `o` says which list it is the JSON Schema for.

## 3. Who carries it

- **Kinds.** An auxiliary event is a kind `39999` event (preferred) or a kind `9999` event. A `9999` can't be updated in place, the same trade-off as for any item. Other kinds are out of scope for this version (open question 4).
- **An auxiliary event is an item of its role's list.** Its own `z` names that list: a JSON Schema is an item on the list of JSON Schemas, a view brief an item on the Opinionated Views list. `z` says what the event is; `o` says which list it serves. The DList NIP already requires a `z` on every `9999` and `39999` event; this only says which list one of them names (one per role, if the event has several).
- **`z` and `o` may name the same list.** They answer different questions, so an event can be both an item of a list and auxiliary to it. That happens when a list serves itself: the `json-schema` concept's own JSON Schema is an item on the list of JSON Schemas *and* that list's JSON Schema. Readers keep both.
- **Several lists.** An event MAY carry several `o` tags, one per list it serves, each with its own role. Their order carries no meaning.
- **Headers don't carry `o`** in this version: kinds `39998` and `9998`, and `39999`/`9999` events declared as headers ([DList Header Declaration](./dlist-header-declaration.md) § 1). One header relating to another is the `b` tag's job ([Inherit-From](./inherit-from.md)).
- **No stamping.** `o` names the list the event was written for. It is never cloud-stamped or ancestor-expanded the way `z` can be ([Stamping](./stamping.md)); readers widen at query time instead (§ 5).

## 4. Roles

- **Open vocabulary.** A spec that defines an auxiliary role adds its token to the table below. A new role needs no ADR.
- **Known roles only.** Readers act on a role only when it exactly matches a role they know, never because it differs from some other role. An absent or unknown role reads as "auxiliary, role unspecified": a `#o` query still returns the event, but a reader never treats it as filling a known role. This is the same fail-safe as the `b` tag's unknown type ([Inherit-From](./inherit-from.md) § The `b` tag).
- **Deployment-free.** The event's `z` names its role's concept by coordinate, and that coordinate differs on every deployment (worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity)). The role token doesn't. In the reference firmware each of the seven core-node tokens equals the `d` of its role's concept header; `opinionated-view` is the `d` of the Opinionated Views header ([Opinionated Views](./opinionated-views.md) § 7.1), whose publisher is still open. When the event's `z` names its role's list by coordinate, a reader MAY check that the coordinate's `d` equals the token; on a mismatch it SHOULD treat the role as unknown.
- **Role specs may narrow.** A role's own spec may restrict the value forms of § 2 and says how to choose among several candidates for that role. Tapestry core nodes serve a concept header, so they use the coordinate form.

| Role | What the event is | Defined in |
|---|---|---|
| `superset` | the superset of all the concept's elements | [Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept |
| `json-schema` | the JSON Schema that validates the list's items | same |
| `primary-property` | the main property key for the concept's namespace in item JSON | same |
| `properties-set` | the collection of the concept's properties | same |
| `property-tree-graph` | the graph of schema → properties relationships | same |
| `concept-graph` | the graph of the concept's class thread | same |
| `core-nodes-graph` | the graph of the concept's core nodes and their wiring | same |
| `opinionated-view` | a view brief: how a platform could show the list's items | [Opinionated Views](./opinionated-views.md) § 7 |

## 5. Finding auxiliary events

Every auxiliary event of a list `L` that carries `o`:

```json
{"kinds": [39999, 9999], "#o": ["<L>"]}
```

- **Name the kinds.** No other NIP uses `o` today (worksheet W2), but a filter that names its kinds stays correct if one ever does.
- **Roles are filtered in the client.** Relays index only element 2.
- **The list author's own:** add `"authors": ["<L's author>"]`.
- **Several headers for one list.** To cover headers that stand for the same list (redundant headers, or a shared concept and the headers affiliated with it), put all their values in one `#o` filter, as the DList NIP does for `#z`. Which headers to include is the reader's choice ([Shared Concepts](./shared-concepts.md) § Reach and § Clouds); this NIP defines exact matching only.
- **Older events.** Events published before `o` existed don't carry it. For Tapestry core nodes, readers fall back to the older links ([Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept).

## 6. Authority and point of view (normative)

- **`o` is a claim and grants nothing.** Anyone may publish an auxiliary event for anyone's list. Readers MUST NOT reject one, at write or ingest time, because of who signed it.
- **The list author's own.** An auxiliary event signed by the author of the header it names is that author's own. When a header has two possible authors (a person and their Tapestry Assistant), first find the governing header by the dual-author rule ([Assistant Designation](./assistant-designation.md) § Dual-author lookup and precedence). That header's author's auxiliary events are its own. No further precedence rule applies.
- **What "own" is worth is up to the role's spec.** For a Tapestry concept, the header author's own core nodes are the concept's definition ([Tapestry Concepts](./tapestry-concepts.md) § Core nodes of a concept). [Opinionated Views](./opinionated-views.md) § 7.3 ranks every brief per point of view, the list author's included.
- **Everyone else's** are candidates. Which ones count, and in what order, is decided per point of view when they are read, by the reader's web of trust, as for any DList item. *(Non-normative: what trusted people do with a candidate, such as a list author adopting it, a curator copying it or a platform building from a brief, is better evidence than how many people published one. See [Show and Tell](../../design-philosophies/show-and-tell.md), E15.)*
- **Derived relationships.** A consumer MAY derive a relationship between an auxiliary event and its list (for Tapestry, the core-node wiring such as "is the JSON Schema for") only from events signed by the author of the list's header. A third party's `o` derives nothing in that author's graph. This is the authorship gate of [Class Thread Relationships](./class-thread-relationships.md) § Security considerations, applied to `o`. A bare-name list has no author, so all of its auxiliary events are candidates.
- **Agreement with older links.** Where an event also names its list another way (a core node's `word.coreMemberOf`, a view brief's `category`), publishers MUST keep the two in agreement. On a disagreement the role's own spec says which one governs. Where it says nothing, a reader derives nothing from the event for that list.

## 7. Copies, inheritance and private events

- **Copies.** A curation copy of an item ([Assistant Designation](./assistant-designation.md) § Curation copies) never carries `o`; a copy's tags are a closed list. An Assistant that copies another list's auxiliary event for its own curated header publishes the copy as its own event, with `o` naming its own header. It SHOULD point back to the original with `q`, in the form Curation copies uses, so that readers can count the two as one.
- **Inheritance.** An `o` names one list and never carries over to another. Whether a list that defers to another's definition (an inherit-typed `b`) also uses that list's auxiliary events, such as its JSON Schema, is not decided here (open question 3).
- **Private auxiliary events.** A private auxiliary event (worksheet [W22](../worksheet.md#w22--private-insights-and-preferences): published by the owner's Assistant, NIP-44-encrypted to itself, marked `["private", "1"]`) keeps its `o` inside the encrypted content. Only `d` and `z` stay in the clear, as for private pinnings ([Pins](./pins.md) § 9). It counts only for its owner.

## 8. What `o` is not for

- **Membership.** An item joins a list with `z`.
- **Class-thread structure.** A set's or a lower superset's place in the class thread uses `n` and `s` ([Class Thread Relationships](./class-thread-relationships.md)). A concept's own Superset, Properties Set and Primary Property are auxiliary events (§ 4); its other properties are reached through the `properties-set` and `property-tree-graph`. `IS_A_PROPERTY_OF` remains a candidate for a letter of its own (worksheet W2).
- **Statements about a list or its items.** Taggings, pinnings (their `context`), comments (NIP-22), reactions (NIP-25), labels (NIP-32), reports (NIP-56) and highlights (NIP-84) keep their own pointers.
- **Discovery hints.** Trusted Lists are found by their exact `d` key (worksheet [W18](../worksheet.md#w18--descriptor-tag-letters-k--z--t)), and Scores by the name of their value tag ([Treasure Maps](./treasure-maps.md) § 5.2).
- **Relations between lists.** Affiliation and deference are the `b` tag.
- **General references.** `a` and `e` mention events for any reason.

**Why `o`, when the `Z` hints were rejected.** Worksheet W18 and [W21](../worksheet.md#w21--category-hints-on-taggings-z--k) rejected uppercase `Z` as a category hint on Trusted Lists, pinnings and taggings. Those hints were added to events that can already be found another way: a Trusted List by its exact `d` key, a tagging by scanning its Tag's taggings. A third party's auxiliary event has no other relay-indexed link to the list it serves. Its `d` belongs to its own author, payload fields aren't indexed, and scanning every JSON Schema under every deployment's `json-schema` concept has no bound. View briefs are the exception: a bounded scan of the Opinionated Views list already finds them ([Opinionated Views](./opinionated-views.md) § 7.2), so for them `o` is a convenience. What sets `o` apart from the rejected hints is that it says what the event is for (§ 1); it is not a browsing aid.

## 9. Direction and the letter

- **Direction.** `o` follows the direction principle of [Class Thread Relationships](./class-thread-relationships.md): lowercase, the event names what it belongs to, like `z`, `n`, `s` and `b`.
- **`O` is reserved and unassigned.** It would be the inverse: a header naming its auxiliary events. Nothing needs it yet. A `#o` query finds a list's auxiliary events, and for a Tapestry concept the header's `concept-graph` tag and the Core Nodes Graph's `constituents` already point from the concept to its core nodes. If `O` is ever assigned, it means "the header author's pick": one voice among many, and a header republish each time the pick changes.
- **Upstream.** No NIP uses `o` or `O` as a tag (`nostr-protocol/nips` at `a79e21d`; worksheet W2).

## 10. Alternatives considered

- **`a` with a role marker.** NIP-01 makes element 3 of `a` a relay hint, so the marker would have to go in element 4 (`["a", <header>, "", <role>]`). Relays index `a` today, but `#a` on a header returns every event that mentions it: items that list it ([DList Cross-NIP Compatibility](./decentralized-lists-compat.md), Method 2), tagging and pinning targets, reactions, deletions, zaps and comments. Naming kinds drops the reactions, deletions, zaps and comments, but not the items, taggings and pinnings, which are kind-`39999` events like auxiliary events. On a kind-`39999` event, an `a` also reads as "this item lists that event". So an auxiliary event SHOULD NOT also carry a plain `a` to the list it serves.
- **NIP-32 labels.** A self-label can state a role, but NIP-32 makes a self-label refer only to the event that carries it, so it has no slot for the list. Naming the list needs a plain `a` beside it, which brings back the `a` problem, or a separate kind-`1985` label event. An event serving two lists would also lose which role goes with which list.
- **A new `b` type**, such as `["b", <header>, "json-schema"]`. `b` relates one list to another: correspondence and deference. Existing readers read an unknown `b` type as `"pointer"` ([Inherit-From](./inherit-from.md)), so they would take an auxiliary event as declaring affiliation with the list it serves.
- **Uppercase `Z`** (worksheet W25's first suggestion). It breaks the direction principle above and reopens the W18 and W21 rejections. NIP-22's convention, where uppercase marks a root scope, would fit `Z`, but it isn't ours.
- **`y` or `q`** (the owner's first letters). `y` is NIP-69's platform tag. `q` is NIP-18's quote tag, which NIP-18 puts on any event that cites another, and [Assistant Designation](./assistant-designation.md) already uses its form for curation copies. A `#q` query on a header would mix quotes and auxiliary events, and NIP-18 makes element 3 of `q` a relay URL, so the role would have to move to element 4, as with `a`.

## 11. Open questions

1. **Telling the value forms apart.** The DList NIP doesn't define how a reader tells a bare name from an event id or a coordinate (§ 2 gives the usual reading). It should, for `z` and `o` alike.
2. **A bare-name list that later gets a header.** No spec says how a header relates to an earlier bare-name list of the same name, so nothing says whether readers of the header should also query the bare name's `#o`.
3. **Inheritance.** Does a list that defers to another's definition (inherit-typed `b`) use that list's auxiliary events for roles it has none of its own? This belongs to [Inherit-From](./inherit-from.md), alongside worksheet [W7](../worksheet.md#w7--item-kind-interplay-with-concept-headers).
4. **Other kinds.** Should events of other kinds carry `o`? One candidate is a NIP-89 handler (kind `31990`) announcing the DLists it has views for ([Opinionated Views](./opinionated-views.md) open question 5). A filter naming kinds `39999`/`9999` would not find them.
5. **Where roles are registered.** Is a table in this NIP enough, or should roles be a DList of their own, curated like everything else?
6. **Several own events for one role.** [Tapestry Concepts](./tapestry-concepts.md) doesn't say which of a header author's own events fills a core-node role when more than one names the header with that role.
