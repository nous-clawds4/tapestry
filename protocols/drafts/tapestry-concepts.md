> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** BIBLE.md §5/§8/§9 (extracted per protocols-directory story 3, `protocols-directory` ADR 0001), ADR 0007 (header→concept-graph resolution contract), and the [Decentralized Lists base NIP](../nips/decentralized-lists.md)

---

Tapestry Concepts
=====

This NIP defines the conventions Tapestry layers on top of [Decentralized Lists](../nips/decentralized-lists.md) to express **concepts**: community-defined types whose elements carry structured, schema-describable data, and whose structure (class membership, properties, graphs) is derivable from the events themselves.

## Relationship to Decentralized Lists

Tapestry Concepts uses the event kinds and the `z`-tag parent-pointer pattern defined by the Decentralized Lists base NIP. A Tapestry *concept* is a list in the base NIP's sense — a header that items join via `z` tags — with the following additions, each specified below:

- the `z` tag value is constrained to the a-tag form;
- element data is carried in a `json` tag, namespaced by concept;
- a canonical payload structure (the **word-wrapper** format) for all Tapestry nodes;
- a scheme of **core nodes** that give every fully-formed concept the same composite anatomy;
- a `concept-graph` header tag with a deterministic resolution contract;
- a principle distinguishing **derived** relationships (computed from event structure) from **explicit** relationship events (reserved for editorial claims).

A reader who understands only the base NIP can still parse Tapestry events as ordinary list headers and items; the conventions here are additive.

## Event kinds

| Kind | Type | Description |
|------|------|-------------|
| **39998** | Replaceable ListHeader | Defines a concept/list. Addressable via a-tag (`39998:<pubkey>:<d-tag>`). Preferred for new headers. |
| **39999** | Replaceable ListItem | An element of a concept/list. Addressable via a-tag (`39999:<pubkey>:<d-tag>`). Preferred for all new events. |
| **9998** | Non-replaceable ListHeader | Legacy. Same purpose as 39998 but immutable. |
| **9999** | Non-replaceable ListItem | Legacy. Same purpose as 39999 but immutable. |

## Addressing

Every replaceable event has a stable address: `<kind>:<pubkey>:<d-tag>` (the NIP-01 a-tag form). This address is the primary identifier for every Tapestry node; implementations are expected to key their stores on it.

## The parent pointer (z tag)

Every ListItem has a `z` tag pointing to its parent concept's a-tag:

```json
["z", "39998:<pubkey>:<d-tag>"]
```

This is the fundamental link between items and concepts.

A concept/DList header (kind 39998) for a given user may be authored by either the user's own key or their Tapestry Assistant. Which of the two candidate headers governs for a user and concept slug is specified by the **dual-author precedence rule** in [Tapestry Assistant Designation & Dual-Author Header Resolution](./assistant-designation.md) (personal-authored header wins; else the TA-authored header, discovered via the user's kind-10040; never by recency).

The base NIP permits `z` values in three forms (a header event id, the a-tag form, or a bare human-readable list name). Tapestry Concepts constrains this: the `z` value is the parent's **a-tag form**. Per kind unification (below), the parent may itself be a kind `39999` event, in which case the `z` value is its `39999:<pubkey>:<d-tag>` address.

**Multi-`z` stamping (Tapestry-layer position — `community-reference` ADR 0029).** A deliberately-published item MAY carry multiple `z` tags: its personal parent pointer plus stamps naming the shared/community concepts it joins. The base NIP explicitly permits multi-`z` items while *recommending* one `z` per event as practice; Tapestry takes the multi-stamp position for items published for community visibility, because read-side derivation cannot reach items whose personal headers are unpublished (local-first publication: most personal headers never leave their local relay, so a published item must be self-contained to be discoverable). The stamping practice itself — which handles, how many, cloud formation and rotation — is open, tracked as worksheet [W11](../worksheet.md#w11--cloud-formation--multi-z-stamping-rules).

## Kind unification

What makes something a concept is **not its event kind** — it's its **position in the graph**. A node becomes a concept when other nodes reference it via their `z` tag. A kind 39999 ListItem can function as a concept if other items point to it. The preferred practice is to use kind 39999 for everything, including concept definitions.

## Data storage (json tag)

Element data is stored in a `json` tag (not `content`):

```json
["json", "{\"dog\":{\"name\":\"Fido\",\"breed\":\"Golden Retriever\"}}"]
```

The JSON is namespaced by concept slug — a single element can carry data from multiple concepts simultaneously. The `content` field is for human-readable text.

## The word-wrapper format

All Tapestry core nodes (and any node participating in the core-node scheme) use the **word-wrapper JSON format** as the canonical structure of the `json` tag:

```json
{
  "word": {
    "slug": "superset-for-the-concept-of-dogs",
    "name": "superset for the concept of dogs",
    "title": "Superset for the Concept of Dogs",
    "wordTypes": ["word", "set", "superset"],
    "coreMemberOf": [{ "slug": "concept-header-for-the-concept-of-dogs", "uuid": "39998:..." }]
  },
  "<type-specific-key>": {
    // ... type-specific properties
  }
}
```

Every word-wrapper JSON has:

1. **`word`** — universal metadata (slug, name, title, wordTypes, coreMemberOf)
2. **One or more type-specific sections** keyed by the node's role:
   - `conceptHeader` — for concept headers
   - `superset` — for superset nodes
   - `set` — for set nodes
   - `property` — for property nodes
   - `primaryProperty` — for primary property nodes
   - `graph` — for any graph node (contains nodes, relationshipTypes, relationships, imports)
   - `conceptGraph` — for concept graph nodes
   - `coreNodesGraph` — for core nodes graph nodes
   - `propertyTreeGraph` — for property tree graph nodes

Field notes:

- Wherever a `uuid` field appears in a word-wrapper payload, it carries the referenced node's a-tag address (see "Addressing" above).
- `wordTypes` lists the node's roles, drawn from the same vocabulary as the type-specific section keys and beginning with `word`; a node may also list broader roles it plays (e.g. a superset node carries `["word", "set", "superset"]`). The full value set and its constraints are not yet formalized.
- `coreMemberOf` is carried by a concept's core nodes and points back at the concept they belong to. The Concept Header itself — the node the others are core members *of* — omits it, as the first example below shows.

### Example: Concept Header

```json
{
  "word": {
    "slug": "concept-header-for-the-concept-of-dogs",
    "name": "concept header for the concept of dogs",
    "title": "Concept Header for the Concept of Dogs",
    "wordTypes": ["word", "conceptHeader"]
  },
  "conceptHeader": {
    "description": "Dog is a concept.",
    "oNames": { "singular": "dog", "plural": "dogs" },
    "oSlugs": { "singular": "dog", "plural": "dogs" },
    "oKeys": { "singular": "dog", "plural": "dogs" },
    "oTitles": { "singular": "Dog", "plural": "Dogs" },
    "oLabels": { "singular": "Dog", "plural": "Dogs" }
  }
}
```

### Example: Graph Node (Core Nodes Graph)

```json
{
  "word": {
    "slug": "core-nodes-graph-for-the-concept-of-dogs",
    "name": "core nodes graph for the concept of dogs",
    "title": "Core Nodes Graph for the Concept of Dogs",
    "wordTypes": ["word", "graph", "coreNodesGraph"],
    "coreMemberOf": [{ "slug": "concept-header-for-the-concept-of-dogs", "uuid": "..." }]
  },
  "graph": {
    "nodes": [{ "slug": "...", "uuid": "..." }, ...],
    "relationshipTypes": [{ "slug": "CLASS_THREAD_INITIATION" }, ...],
    "relationships": [{ "nodeFrom": { "slug": "..." }, "relationshipType": { "slug": "..." }, "nodeTo": { "slug": "..." } }, ...],
    "imports": []
  },
  "coreNodesGraph": {
    "description": "the set of core nodes for the concept of dogs",
    "constituents": {
      "conceptHeader": "<uuid>",
      "superset": "<uuid>",
      "jsonSchema": "<uuid>",
      "primaryProperty": "<uuid>",
      "propertyTreeGraph": "<uuid>",
      "conceptGraph": "<uuid>",
      "coreNodesGraph": "<uuid>"
    }
  }
}
```

## Core nodes of a concept

Every fully-formed concept has **8 core nodes**:

| # | Node | Role | Well-known concept (z target) |
|---|------|------|-------------------------------|
| 1 | **Concept Header** | The concept definition itself (the ListHeader or ListItem that IS the concept) | varies |
| 2 | **Superset** | "The superset of all X" — root of the class thread | `superset` |
| 3 | **JSON Schema** | Validates the structure of elements | `json-schema` |
| 4 | **Primary Property** | The main property key for this concept's namespace in element JSON | `primary-property` |
| 5 | **Properties Set** | Collection of all properties | `properties-set` |
| 6 | **Property Tree Graph** | Graph of schema → properties relationships | `property-tree-graph` |
| 7 | **Concept Graph** | Graph of the class thread (supersets, sets, elements) | `concept-graph` |
| 8 | **Core Nodes Graph** | Graph showing all 8 core nodes and their wiring | `core-nodes-graph` |

Each core node (except the Concept Header itself) is a kind 39999 event with:

- A `z` tag pointing to the a-tag of its **well-known core-node concept** (the slugs in the table above), as published by the deployment — see "Concept identity across deployments" below
- A `json` tag in word-wrapper format
- Wiring back to its Concept Header, expressed in the payload (`word.coreMemberOf`) and by **deterministic d-tags** derived from the concept's own d-tag (e.g. a concept whose header d-tag is `<d-tag>` has its Concept Graph at `39999:<pubkey>:<d-tag>-concept-graph`)

## The concept-graph header tag

Every kind-39998 ConceptHeader carries a self-describing pointer to its Concept Graph core node:

```json
["concept-graph", "39999:<pubkey>:<d-tag>-concept-graph"]
```

The value is **computed** from the header's own (signing) pubkey + d-tag — not looked up — so it is correct even before the Concept Graph node exists.

**Resolution contract:** to locate a concept's Concept Graph from only its Header, use the `concept-graph` tag **if present, else compute** `39999:<pubkey>:<d-tag>-concept-graph`. The deterministic fallback covers headers minted before this tag existed (no mass re-emit needed) and headers from curators who don't carry it. This lets a single fetched Header self-resolve its full concept off-relay.

This tag is defined here for kind-39998 headers. The compute fallback is phrased for any header (it derives from the header's own pubkey and d-tag); whether a kind-39999 event functioning as a concept (see "Kind unification") carries a `concept-graph` tag is **not yet specified**.

## Derived vs. explicit relationships

**Most relationships are derived** — computed by consumers from event structure (z-tags, kind numbers, naming conventions). Only editorial/provenance relationships (IMPORT, SUPERCEDES, PROVIDED_THE_TEMPLATE_FOR, ENUMERATES) are explicit nostr events.

Do not create explicit relationship events unless the relationship has editorial significance. Do not expect a nostr event for every derived graph relationship.

*The wire format of the explicit editorial relationship events is not defined in this document.*

## Concept identity across deployments

The well-known core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`) are concept headers like any other: each deployment publishes its own copies under its own publisher key, and core-node `z` tags within that deployment point at those addresses. This specification does not define how independent deployments agree on a *canonical* identity for a concept — that is an open protocol problem, tracked as [worksheet entry W1](../worksheet.md#w1--cross-deployment-concept-identity).
