# Tapestry Bible

> **Audience:** AI agents and developers joining the Tapestry project.
> Read this file to fully onboard — it covers what Tapestry is, how it works, what's been built, what's in progress, and how to contribute.
>
> Specifics of the reference deployment at `brainstorm.world` (deploy targets, droplet specs, CI/CD workflows, branch protection ruleset, active team, tracking issues, operational gotchas we've hit) live in a sibling document: [OPERATIONS.md](./OPERATIONS.md). If you're forking this repo to run your own instance, BIBLE is the doc you want — OPERATIONS describes someone else's running instance.

**Last updated:** 2026-05-04 (preferences audit §6.1 + §6.2; session persistence; user-counts; cycle-* skills)

---

## Table of Contents

1. [What Is Tapestry?](#1-what-is-tapestry)
2. [Vision and Why It Matters](#2-vision-and-why-it-matters)
3. [Repos and Branches](#3-repos-and-branches)
4. [Architecture](#4-architecture)
5. [The Tapestry Protocol](#5-the-tapestry-protocol)
6. [The Concept Graph Data Model](#6-the-concept-graph-data-model)
7. [Firmware](#7-firmware)
8. [Word-Wrapper JSON Format](#8-word-wrapper-json-format)
9. [Core Nodes of a Concept](#9-core-nodes-of-a-concept)
10. [Normalization Rules](#10-normalization-rules)
11. [API Reference](#11-api-reference)
12. [CLI Reference (tapestry-cli)](#12-cli-reference-tapestry-cli)
13. [React UI Structure](#13-react-ui-structure)
14. [Configuration](#14-configuration)
15. [Development Workflow](#15-development-workflow)
16. [What's Been Built](#16-whats-been-built)
17. [What's In Progress](#17-whats-in-progress)
18. [What's Yet To Be Built](#18-whats-yet-to-be-built)
19. [Key Design Decisions](#19-key-design-decisions)
20. [People](#20-people)
21. [Glossary](#21-glossary)
22. [Community-Reference Model](#22-community-reference-model)
23. [Class-Thread Membership Tags (`n`, `s`)](#23-class-thread-membership-tags-n-s)
24. [Task Queue (BullMQ behind /api/run-task)](#24-task-queue-bullmq-behind-apirun-task)
25. [The Inherit-From Tag (`b`)](#25-the-inherit-from-tag-b)

---

## 1. What Is Tapestry?

Tapestry is a **decentralized knowledge graph protocol and application** built on [nostr](https://nostr.com). It lets communities collaboratively curate structured data — lists, categories, schemas, properties — without any central authority.

At its core, Tapestry takes flat nostr events (specifically "DList" events — Decentralized Lists) and weaves them into a navigable, validated **concept graph** stored in Neo4j. Think of it as a decentralized ontology engine where anyone can define concepts, anyone can contribute elements, and the community uses Web of Trust (GrapeRank) to achieve "loose consensus" on which definitions and curations are trustworthy.

**The two products:**

- **tapestry** (server) — Docker container running strfry (nostr relay) + Neo4j (graph DB) + Express (API + UI). This is the runtime.
- **tapestry-cli** — Command-line tool for querying, syncing, creating concepts, normalizing the graph. Talks to the server via HTTP API.

---

## 2. Vision and Why It Matters

### The Problem
Structured knowledge on the internet lives in centralized silos — Wikipedia, Wikidata, Google Knowledge Graph. These are maintained by gatekeepers. Decentralized alternatives (like plain nostr) give you free speech but no structured data.

### The Solution
Tapestry brings **structured, validated, community-curated data** to nostr. Any concept (dogs, programming languages, medical conditions, restaurant types) can be defined as a DList with:
- A concept header (what is this thing?)
- A superset (the set of all instances)
- A JSON schema (what properties should instances have?)
- Properties (name, breed, color...)
- Elements (Fido, Rover, Rex...)

Multiple people can define the same concept independently. The **Grapevine** (Web of Trust algorithm) determines which definitions achieve **loose consensus** — Alice's and Bob's webs of trust overlap enough to converge on shared definitions without any central coordinator.

### NosFabrica Context
Tapestry is being built under **NosFabrica**, a company focused on sovereign healthcare on nostr and Bitcoin. The immediate application is health data trust engines — but the protocol is general-purpose.

---

## 3. Repos and Branches

| Repo | URL | Default Branch | Description |
|------|-----|----------------|-------------|
| **tapestry** (server) | `github.com/nous-clawds4/tapestry` | `main` | Docker stack: strfry + Neo4j + Express + React UI + Meilisearch + NIP-50 proxy + firmware |
| **tapestry-cli** | `github.com/nous-clawds4/tapestry-cli` | `main` | CLI tool for graph operations |

### Recommended branch strategy

`main` is the production branch — direct push triggers a deploy via `.github/workflows/deploy-brainstorm.yml`. Standard contribution flow uses an intermediate `staging` branch as a verification gate:

```
feat/foo (off staging)
  → PR → staging   → CI auto-deploys to a staging environment
  → verify
  → PR → main      → CI auto-deploys to production
```

Long-lived sandbox branches (e.g. for substantial in-progress features that need their own deploy environment) follow the same pattern: dedicated branch + dedicated workflow + dedicated droplet.

For the specific branches and deploy targets configured in the reference deployment at `brainstorm.world` (including `staging`, `feature-magic-carpet`, and a few legacy/parked branches), see [OPERATIONS.md §1–§2](./OPERATIONS.md).

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│              tapestry container                           │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐           │
│  │  strfry   │  │  Neo4j   │  │   Express    │           │
│  │  (relay)  │  │  (graph) │  │  (API + UI)  │           │
│  │  :7777    │  │  :7687   │  │  :7778       │           │
│  └─────┬────┘  └──────────┘  └──────────────┘           │
│        │                                                  │
│  ┌─────┴──────────┐                                      │
│  │  nip50-proxy   │  NIP-50 search → Meilisearch         │
│  │  :7780         │  all other traffic → strfry           │
│  └────────────────┘                                      │
│        │                                                  │
│  ┌─────┴──────────┐                                      │
│  │  nginx (:80)   │  reverse proxy                       │
│  └────────────────┘                                      │
│        │                                                  │
└────────┼─────────────────────────────────────────────────┘
         │
    Port 80 (host) — or 127.0.0.1:8080 behind host nginx

┌────────────────────────┐   ┌────────────────────────┐
│  nostr-search-api      │   │  nostr-search-meili    │
│  (Express, :3069)      │──→│  (Meilisearch, :7700)  │
│  Live ingestion +      │   │  Full-text search index │
│  search proxy          │   │  2M+ profiles          │
└────────┬───────────────┘   └────────────────────────┘
         │
         │ WebSocket (kind 0 events)
         ↓
    tapestry:80/relay (strfry)
```

### Services

| Service | Port | Role |
|---------|------|------|
| **strfry** | 7777 (internal WS) | High-performance C++ nostr relay, patched with Redis integration. After writing events to LMDB, pushes kind 3/10000/1984 events to Redis queue for streaming ETL. |
| **Neo4j** | 7474 (HTTP), 7687 (Bolt) | Graph database. Turns flat events into a navigable concept graph with labeled nodes and typed relationships. |
| **Express** | 7778 (internal) → 80 (host) | REST API server. Serves the React SPA from `dist/`, provides all API endpoints. Proxies search requests to nostr-search-api. In production behind host nginx, Docker binds to `127.0.0.1:8080:80`. |
| **nip50-proxy** | 7780 (internal) | NIP-50 relay proxy. Sits between nginx and strfry. Intercepts search REQs and routes them through Meilisearch + WoT scoring. Passes all other traffic to strfry transparently. Auto-triggers the WoT pipeline for new observers. |
| **stream-consumer** | — | Node.js process that reads events from Redis queue and writes NostrUser nodes + FOLLOWS/MUTES/REPORTS relationships to Neo4j via Bolt driver. Managed by supervisord. |
| **nginx** | 80 (internal) | Reverse proxy routing `/api/*` to Express, `/relay` to nip50-proxy, etc. |
| **supervisord** | — | Process manager inside the container. Controls all services (neo4j, strfry, strfry-router, nip50-proxy, stream-consumer, brainstorm). |
| **redis** | 6379 (Docker network only) | Separate Docker container. Message queue for streaming ETL — buffers events between strfry and the Neo4j consumer. ~50MB RAM. |
| **nostr-search-api** | 3069 | Search API server. Connects to strfry via WebSocket for live kind 0 ingestion, proxies search queries to Meilisearch, handles WoT score loading. |
| **nostr-search-meili** | 7700 | Meilisearch instance (pinned at `v1.12.8` in `docker-compose.yml`). Full-text search index for nostr profiles. Searchable by name, NIP-05, bio, website, Lightning address. **Known issue:** v1.12 panics on certain queries (e.g. `q=primal`) due to a milli interner u16 overflow — `nostr-search/src/search.js` catches the panic and returns a friendly notice in place of a 500. See §17 "Meilisearch upgrade" for the path to a real fix. |

### Docker Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `tapestry-neo4j` | `/var/lib/neo4j/data` | Neo4j database |
| `tapestry-strfry` | `/var/lib/strfry` | strfry LMDB event store |
| `tapestry-data` | `/var/lib/brainstorm` | App data + user settings |
| `tapestry-logs` | `/var/log/brainstorm` | Logs |
| `nostr-search-meili` | `/meili_data` | Meilisearch index data |

### Data Flow

```
External relays ──strfry router──→ strfry (local) ──import──→ Neo4j (graph)
                                       ↑                         ↑
                                 Express API ←──── React UI (browser)
                                       ↑
                                   NIP-07 signing (nos2x / Alby)

Profile search pipeline:
External relays ──strfry router──→ strfry ──WebSocket──→ nostr-search-api ──→ Meilisearch
  (userProfiles preset)          (kind 0)   (live ingest)    (index)         (full-text search)
                                                                                    ↑
                                                              Express proxy ←── React UI

NIP-50 relay search pipeline (for external nostr clients):
Client ──wss://relay──→ nginx ──→ nip50-proxy ──search──→ nostr-search-api ──→ Meilisearch
                                      │                                         (WoT-scored)
                                      └──non-search──→ strfry (passthrough)
```

1. **Sync**: `strfry sync` pulls events from external relays
2. **Import**: Events are imported into Neo4j as nodes with tags, labels, and relationships
3. **Normalize**: The concept graph normalizer creates derived structure (Superset nodes, wiring, etc.)

---

## 5. The Tapestry Protocol

### Event Kinds

| Kind | Type | Description |
|------|------|-------------|
| **39998** | Replaceable ListHeader | Defines a concept/list. Addressable via a-tag (`39998:<pubkey>:<d-tag>`). Preferred for new headers. |
| **39999** | Replaceable ListItem | An element of a concept/list. Addressable via a-tag (`39999:<pubkey>:<d-tag>`). Preferred for all new events. |
| **9998** | Non-replaceable ListHeader | Legacy. Same purpose as 39998 but immutable. |
| **9999** | Non-replaceable ListItem | Legacy. Same purpose as 39999 but immutable. |

### Key Insight: Kind Unification

What makes something a concept is **not its event kind** — it's its **position in the graph**. A node becomes a concept when other nodes reference it via their `z` tag. A kind 39999 ListItem can function as a concept if other items point to it. The preferred practice is to use kind 39999 for everything, including concept definitions.

### Addressing (a-tag / UUID)

Every replaceable event has a stable address: `<kind>:<pubkey>:<d-tag>`. This is stored as the `uuid` property on Neo4j nodes and is the primary identifier throughout the system.

### Parent Pointer (z-tag)

Every ListItem has a `z` tag pointing to its parent concept's a-tag:
```json
["z", "39998:<pubkey>:<d-tag>"]
```
This is the fundamental link between items and concepts.

### Header→ConceptGraph Pointer (`concept-graph` tag)

Every kind-39998 ConceptHeader emitted by `create-concept` carries a self-describing pointer to its Concept Graph core node:
```json
["concept-graph", "39999:<pubkey>:<d-tag>-concept-graph"]
```
The value is **computed** from the header's own (signing) pubkey + d-tag — not Neo4j-looked-up — so it is correct even before the Concept Graph node exists. **Resolution contract:** to locate a concept's Concept Graph from only its Header, use the `concept-graph` tag **if present, else compute** `39999:<pubkey>:<d-tag>-concept-graph`. The deterministic fallback covers legacy/firmware headers minted before this tag (no mass re-emit needed) and headers from curators who don't carry it. This lets a single fetched Header self-resolve its full concept off-relay, without the (invisible-off-relay) `IS_THE_CONCEPT_GRAPH_FOR` Neo4j edge. ADR 0007, hybrid design C; the consumer is the deferred element/superset materialization stream.

### Implicit vs. Explicit Relationships

**Most relationships are implicit** — derived by the graph engine from event structure (z-tags, kind numbers, naming conventions). Only editorial/provenance relationships (IMPORT, SUPERCEDES, PROVIDED_THE_TEMPLATE_FOR, ENUMERATES) are explicit nostr events.

Do not create explicit relationship events unless the relationship has editorial significance. Do not expect a nostr event for every Neo4j relationship.

### JSON Data Storage

Element data is stored in a `json` tag (not `content`):
```json
["json", "{\"dog\":{\"name\":\"Fido\",\"breed\":\"Golden Retriever\"}}"]
```

The JSON is namespaced by concept slug — a single element can carry data from multiple concepts simultaneously. The `content` field is for human-readable text.

---

## 6. The Concept Graph Data Model

### Neo4j Node Labels

| Label | Source | Description |
|-------|--------|-------------|
| `NostrEvent` | All events | Base label for any imported nostr event |
| `ListHeader` | kind 9998/39998 | DList header |
| `ListItem` | kind 9999/39999 | DList item |
| `ClassThreadHeader` | Derived | A node that initiates a class thread (concept definition) |
| `Superset` | Derived | Superset node in the hierarchy |
| `Set` | Derived | A subset of a superset |
| `Property` | Derived | Property definition for a concept |
| `JSONSchema` | Derived | JSON Schema associated with a concept |
| `NostrUser` | All events | User node, one per unique pubkey |
| `NostrEventTag` | All events | Tag on an event |

### Relationship Types

#### Class Thread Relationships
| Relationship | Direction | Phase |
|-------------|-----------|-------|
| `IS_THE_CONCEPT_FOR` | ConceptHeader → Superset | Initiation |
| `IS_A_SUPERSET_OF` | Superset → Superset/Set | Propagation |
| `HAS_ELEMENT` | Superset/Set → Element | Termination |

#### Core Node Wiring
| Relationship | Direction |
|-------------|-----------|
| `IS_THE_JSON_SCHEMA_FOR` | JSONSchema → ConceptHeader |
| `IS_THE_PRIMARY_PROPERTY_FOR` | PrimaryProperty → ConceptHeader |
| `IS_THE_PROPERTIES_FOR` | PropertiesSet → ConceptHeader |
| `IS_THE_PROPERTY_TREE_GRAPH_FOR` | PropertyTreeGraph → ConceptHeader |
| `IS_THE_CORE_NODES_GRAPH_FOR` | CoreNodesGraph → ConceptHeader |
| `IS_THE_CONCEPT_GRAPH_FOR` | ConceptGraph → ConceptHeader |

#### Property Relationships
| Relationship | Direction |
|-------------|-----------|
| `IS_A_PROPERTY_OF` | Property → Primary Property (top-level) or Property → Property (nested) |
| `ENUMERATES` | Superset → Property (horizontal integration, explicit event) |

##### Property Tree Structure
The property tree mirrors the JSON Schema structure:
- **JSON Schema** ← Primary Property ← top-level properties ← nested properties
- Top-level schema properties wire to the **Primary Property** (not directly to the JSON Schema)
- Nested object properties wire to their parent property

##### Deterministic D-Tags for Properties
Property events use deterministic d-tags: `<property-slug>-<8-char-sha256(parentUUID)>`.
This makes `generate-property-tree` **idempotent**: re-running produces identical event IDs,
strfry replaces existing events (kind 39999 is replaceable), and Neo4j MERGEs on UUID.

##### Two-Way Sync: JSON Schema ↔ Property Tree
| Direction | Endpoint | Notes |
|-----------|----------|-------|
| Schema → Tree | `POST /api/normalize/generate-property-tree` | Idempotent, safe to re-run |
| Tree → Schema | `POST /api/property/generate-json-schema` | Reads tree, writes to JSONSchema node |

#### Editorial Relationships (explicit events)
| Relationship | Meaning |
|-------------|---------|
| `IMPORT` | "I agree with your concept definition" — implies IS_A_SUPERSET_OF between supersets |
| `SUPERCEDES` | "I've evaluated your definition and replaced it with mine" — non-destructive |
| `PROVIDED_THE_TEMPLATE_FOR` | Provenance link from original to forked node |
| `REFERENCES` (concept-level) | Deferred non-committal pointer: local Concept Header → an external curator's Concept Header. Neo4j-only, carries `source`. NOT an explicit event, NOT agreement, NOT `IS_A_SUPERSET_OF`. Disambiguate from the tag-level `REFERENCES` (`NostrEventTag → NostrEvent`, every `e`/`a` tag) by endpoint labels + `source`. See §22. |
| `INHERITS_FROM` | "My definition defers to the parent's, unless I override" — child→parent, live. NOT IMPORT (no absorption), NOT `IS_A_SUPERSET_OF`. Canonical (no `source`). Encoded as the single-char `b` tag, not a descriptor event. See §25. |

#### Infrastructure
| Relationship | Meaning |
|-------------|---------|
| `AUTHORED` | NostrUser → NostrEvent |
| `HAS_TAG` | NostrEvent → NostrEventTag |

### The Class Thread

Every concept, when fully normalized, has a **class thread** — a path through the graph:

```
Initiation                    Propagation (0+ hops)              Termination
ConceptHeader ──IS_THE_CONCEPT_FOR──→ Superset ──IS_A_SUPERSET_OF──→ ... ──HAS_ELEMENT──→ Element
```

**Minimal example:**
```
(dog:ListHeader)──[:IS_THE_CONCEPT_FOR]──→(allDogs:Superset)──[:HAS_ELEMENT]──→(fido:ListItem)
```

**Hierarchical example:**
```
(animal)──→(allAnimals:Superset)──→(allDogs:Superset)──→(allSheepDogs:Superset)──→(rover:ListItem)
```

---

## 7. Firmware

The **firmware** is the canonical set of JSON definitions that describe the tapestry protocol's own meta-concepts. It sits between the fixed logic of the code and the dynamic data of the graph.

### Location

```
tapestry/firmware/
  versions/
    v0.0.1/          ← legacy
    v1.0.0/          ← current version
  active/             ← symlink to current version (versions/v1.0.0)
```

The server reads from `firmware/active/` at runtime.

### What Firmware Defines

The v1.0.0 manifest (`manifest.json`) contains:

- **11 relationship types** (CLASS_THREAD_INITIATION, CLASS_THREAD_PROPAGATION, CLASS_THREAD_TERMINATION, CORE_NODE_JSON_SCHEMA, CORE_NODE_PRIMARY_PROPERTY, CORE_NODE_PROPERTIES, CORE_NODE_PROPERTY_TREE_GRAPH, CORE_NODE_CORE_GRAPH, CORE_NODE_CONCEPT_GRAPH, PROPERTY_MEMBERSHIP, PROPERTY_ENUMERATION)
- **34 concepts** organized by category (some concepts belong to multiple categories):
  - **Core (8):** superset, concept-header, primary-property, properties-set, json-schema, property-tree-graph, core-nodes-graph, concept-graph
  - **Graph-theoretic (6):** node-type, relationship, relationship-type, graph, graph-type, word
  - **Graphs (5):** graph, property-tree-graph, core-nodes-graph, concept-graph, tapestry
  - **Nostr (4):** nostr-user, nostr-relay, nostr-event, nostr-kind
  - **Tapestry (2):** class-thread, word-wrapper
  - **Web-of-trust (2):** graperank, web-of-trust
  - **Other:** set, property, json-data-type, list, validation-tool, validation-tool-type, image, image-type, image-validation-script, plus example concepts (dog, dog-breed)
- **Elements:** json-data-types (string, number, integer, boolean, object, array, null), node-types, graph-types, validation-tool-types
- **Sets:** graphs, relationship-types (class-threads, core-nodes), validation-tools, properties, sets

### Key Design: Deterministic D-Tags

Firmware concepts use the slug as the d-tag, making UUIDs deterministic:
```
39998:<tapestry-assistant-pubkey>:<slug>
```

The function `firmware.conceptUuid(slug)` computes this from the TA pubkey + slug. No more hardcoded UUIDs in config files.

### Firmware Install

The install is a **two-pass process**:
1. **Pass 1:** Bootstrap all concepts + elements (creates events, publishes to strfry, imports to Neo4j)
2. **Pass 2:** Enrich JSON Schemas with full content

Triggered via the Dashboard "Install Tapestry firmware" button or `POST /api/firmware/install`.

---

## 8. Word-Wrapper JSON Format

All core nodes and firmware concepts use the **word-wrapper JSON format**. This is the canonical structure for the `json` tag on any tapestry node:

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

### Structure

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

---

## 9. Core Nodes of a Concept

Every fully-formed concept has **8 core nodes**:

| # | Node | Role | z-tag concept |
|---|------|------|---------------|
| 1 | **Concept Header** | The concept definition itself (the ListHeader or ListItem that IS the concept) | varies |
| 2 | **Superset** | "The superset of all X" — root of the class thread | `superset` |
| 3 | **JSON Schema** | Validates the structure of elements | `json-schema` |
| 4 | **Primary Property** | The main property key for this concept's namespace in element JSON | `primary-property` |
| 5 | **Properties Set** | Collection of all properties | `properties-set` |
| 6 | **Property Tree Graph** | Graph of schema → properties relationships | `property-tree-graph` |
| 7 | **Concept Graph** | Graph of the class thread (supersets, sets, elements) | `concept-graph` |
| 8 | **Core Nodes Graph** | Graph showing all 8 core nodes and their wiring | `core-nodes-graph` |

Each core node (except the Concept Header itself) is a kind 39999 event with:
- A `z` tag pointing to its firmware concept's UUID
- A `json` tag in word-wrapper format
- Wiring relationships back to the Concept Header

### Health Audit

The UI at `Concepts → Detail → Health Audit` checks:
- Do all 8 core nodes exist?
- Does each have JSON?
- Is the JSON valid against its firmware schema?
- Are all wiring relationships present?

Buttons: **Create** (for missing nodes), **Fix JSON** (for invalid JSON), **Rebuild** (for valid JSON you want to regenerate).

---

## 10. Normalization Rules

Full rules are documented in `tapestry-cli/docs/NORMALIZATION.md`. Summary:

| Rule | Description |
|------|-------------|
| **1** | Every concept MUST have a Superset |
| **2** | Every ListItem MUST have a valid parent pointer (z-tag) |
| **3** | Every element MUST be reachable via a class thread |
| **4** | Elements MUST validate against their concept's JSON Schema |
| **5** | Superset nodes MUST reference the canonical superset concept |
| **6** | Explicit relationship events MUST have nodeFrom, nodeTo, relationshipType tags |
| **7** | No hard duplication (uniqueness constraints on id, pubkey, uuid) |
| **8** | Soft duplication resolved via IMPORT and SUPERCEDES |
| **9** | The Class Thread Anomaly — exactly one node is an element of its own superset (the concept-header concept) |
| **10** | Concept slugs MUST be locally unique |
| **11** | Every concept MUST have exactly one active JSON Schema node |

### Intentional Violations

Not all violations are bugs:
- **Work in progress** — partially defined concepts
- **Cross-author soft duplication** — expected in decentralized systems
- **Inferrable HAS_ELEMENT** — z-tag makes the relationship deducible; explicit edge optional for large concepts

---

## 11. API Reference

Base URL: `http://localhost:8080`

### Normalization / Concept Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/normalize/create-concept` | Create a full concept (all 8 core nodes) |
| POST | `/api/normalize/skeleton` | Create missing core nodes for an existing concept |
| POST | `/api/normalize/json` | Regenerate JSON for core nodes |
| POST | `/api/normalize/create-element` | Create a new element of a concept |
| POST | `/api/normalize/save-schema` | Save/update a concept's JSON Schema |
| POST | `/api/normalize/save-element-json` | Save/update an element's JSON |
| POST | `/api/normalize/create-property` | Create a property for a concept |
| POST | `/api/normalize/generate-property-tree` | Generate property tree from JSON Schema (idempotent) |
| POST | `/api/normalize/prune-superset-edges` | Prune redundant direct Superset edges |
| POST | `/api/normalize/add-node-as-element` | Wire an existing node as element of a concept |
| POST | `/api/normalize/link-concepts` | Create IS_A_SUPERSET_OF between concepts |
| POST | `/api/normalize/enumerate` | Create ENUMERATES relationship |
| POST | `/api/normalize/set-slug` | Set/update a node's slug |
| POST | `/api/normalize/create-set` | Create a new Set node under a Superset |
| POST | `/api/normalize/add-to-set` | Add an element to a Set |
| POST | `/api/normalize/fork-node` | Fork another author's node |
| POST | `/api/normalize/set-json-tag` | Set/update any node's json tag |
| POST | `/api/normalize/migrate-primary-property-ztags` | Migrate z-tags to point to primary property concept |

### Firmware

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/firmware/install` | Install/reinstall firmware concepts |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit/health` | Overall graph health summary |
| GET | `/api/audit/concepts-summary` | Summary of all concepts |
| GET | `/api/audit/concept?concept=<name>` | Detailed audit for one concept (skeleton, health checks) |
| GET | `/api/audit/stats` | Graph statistics |
| GET | `/api/audit/skeletons` | Check all concept skeletons |
| GET | `/api/audit/orphans` | Find orphaned nodes |
| GET | `/api/audit/wiring` | Check relationship wiring |
| GET | `/api/audit/labels` | Check Neo4j labels |
| GET | `/api/audit/firmware` | Check firmware installation status |
| GET | `/api/audit/threads` | Analyze class threads |

### Neo4j

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/neo4j/run-query?cypher=<query>` | Run Cypher query (legacy, use POST) |
| POST | `/api/neo4j/query` | Run Cypher query (preferred) |
| GET | `/api/neo4j/event-check?uuid=<uuid>` | Check if event exists in Neo4j |
| POST | `/api/neo4j/event-update` | Import/update a single event in Neo4j |
| GET | `/api/neo4j/event-uuids` | List all event UUIDs |

### Strfry (Local Relay)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/strfry/scan?filter=<json>` | Scan events matching a filter |
| GET | `/api/strfry/scan/count?filter=<json>` | Count events matching a filter (can take minutes on large DBs; nginx timeout extended to 600s) |
| GET | `/api/strfry/scan/stream?filter=<json>` | Stream events as JSONL (no memory issues, nginx no-buffering) |
| POST | `/api/strfry/publish` | Sign and publish an event |
| GET | `/api/strfry/router-status` | Router sync status |
| POST | `/api/strfry/router-toggle` | Enable/disable a sync stream |
| POST | `/api/strfry/negentropy-sync` | Trigger negentropy sync from a relay |
| POST | `/api/strfry/wipe` | Wipe all strfry events (dangerous!) |

### Auth (NIP-07)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Get a challenge for NIP-07 signing |
| POST | `/api/auth/login` | Submit signed challenge, get session |
| GET | `/api/auth/status` | Check current auth status |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/user-classification` | Get user role (owner/customer/guest) |

### NIP-05 Server (`.well-known`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/.well-known/nostr.json` | Public NIP-05 registry. Optional `?name=<x>` filter (per spec). CORS open (`Access-Control-Allow-Origin: *`). `Cache-Control: public, max-age=300`. Backed by the `nip05.names` and `nip05.relays` keys in the two-layer settings system (§14). |

Identifiers are managed via `PUT /api/settings` (owner-only — see below). The PUT handler validates `nip05.names` keys against `/^[a-z0-9._-]+$/`, pubkeys against 64-char hex, and relays against `wss://`/`ws://` prefixes. Any failure returns HTTP 400 with details.

### Settings (Owner only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get merged settings |
| PUT | `/api/settings` | Update settings (deep merge) |
| DELETE | `/api/settings/<keyPath>` | Reset a key to default |

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profiles?pubkeys=<csv>` | Fetch kind:0 profiles from external relays (cached) |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/get-user-data?pubkey=<x>&observerPubkey=<y>` | Detailed per-user data including `followingCount`, `followerCount`, `verifiedFollowerCount`, GrapeRank scores, and observer-relative graph metrics (frenCount, mutualFollowerCount, recommendation counts, etc.). Owner POV by default. Slow on populated graphs (~10s+) due to multiple `OPTIONAL MATCH` traversals. |
| GET | `/api/get-user-counts?pubkey=<x>` | Lightweight: returns just `{ followingCount }` from the user's most recent kind 3 event in strfry. No Neo4j traversal. Sub-second. Used by the profile page's Following count display. |
| GET | `/api/owner/pubkey` | The instance owner's hex pubkey. Public, no auth. Mirrors `/api/assistant/pubkey` for the TA. Read at app mount via `ConfigContext`. |
| GET | `/api/owner-info` | Owner pubkey plus npub and domain name. Public. Pre-existing endpoint kept alongside the more focused `/api/owner/pubkey`. |
| GET | `/api/relays` | The configured `aRelays` object from settings. Public. UI components read this via `ConfigContext` instead of hardcoding relay arrays. |

### API Documentation

Swagger UI is served at `/docs` — interactive OpenAPI documentation for all REST endpoints. Publicly accessible (no auth required).

### Search (Meilisearch)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search/profiles/meili?q=<query>&limit=<n>&offset=<n>` | Full-text profile search. Supports optional params: `wotPov=house\|user`, `userPubkey=<hex>`, `pubkeyLookup=<hex>` (direct lookup), `nip05Lookup=<identifier>` (parallel NIP-05 verification). |
| GET | `/api/search/profiles/meili/stats` | Index stats: document count, field distribution, profile freshness |
| GET | `/api/search/profiles/meili/document/:pubkey` | Fetch a single profile document from Meilisearch by pubkey |
| POST | `/api/search/profiles/meili/resync` | Trigger live ingester resync (clears dedup map, reconnects to relay) |
| GET | `/api/search/profiles/meili/bulk-status` | Status of bulk re-indexing from strfry |
| POST | `/api/search/profiles/meili/load-scores` | Batch-upsert WoT scores into profiles index. Scores must use suffixed field names: `wot_<metric>_<8char>`. |
| GET | `/api/search/profiles/meili/settings` | Meilisearch index settings (filterable/sortable attributes) |
| GET | `/api/search/profiles/meili/tasks` | Meilisearch task queue status |
| DELETE | `/api/search/profiles/meili/wipe` | Delete entire Meilisearch index (requires re-ingest) |
| POST | `/api/search/profiles/meili/backfill-profiles` | Restore profile data for scored profiles missing kind 0 data |

### NIP-50 Relay Search (WebSocket)

External nostr clients can search via the relay WebSocket at `wss://<host>/relay`.

**Protocol:** Standard NIP-01 REQ with NIP-50 `search` field:
```json
["REQ", "<subId>", {"kinds": [0], "limit": 20, "search": "jack observer:<pubkey> sort:followers:desc filter:rank:gte:2"}]
```

**Custom extensions** (in the search string, per NIP-50 key:value pattern):

| Extension | Format | Description |
|-----------|--------|-------------|
| `observer` | `observer:<hex-pubkey>` | User's pubkey for WoT point of view. Resolved to delegated pubkey via user prefs. Falls back to house POV if omitted. |
| `sort` | `sort:<metric>:<asc\|desc>` | Sort by WoT metric (e.g., `sort:followers:desc`) |
| `filter` | `filter:<metric>:<op>:<value>` | Filter by WoT metric threshold (ops: `gte`, `lte`, `gt`, `lt`, `eq`) |

**NIP-11 discovery:** `curl -H "Accept: application/nostr+json" https://<host>/relay` returns relay info with `50` in `supported_nips`.

**Auto-trigger:** If the observer's WoT scores aren't in Meilisearch, the proxy automatically runs the full pipeline in the background (find kind 10040, sync TAs, parse metrics, load scores). The current search returns unscored; the next search will be fully WoT-scored.

**Event signatures:** When the proxy returns events to clients, it fetches the **original events from strfry** via a temporary WebSocket REQ (by event ID), rather than reconstructing them from Meilisearch fields. This ensures the `content`, `id`, and `sig` are exactly as the author signed them — no reconstruction, no signature mismatch. Clients like `nak` will validate signatures correctly.

### Grapevine / Search Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/grapevine/preferences` | Get house-wide search preferences (POV pubkey, metrics, filters, sort). Public read — the inline picker and anonymous visitors need to be able to read the resolved house default. |
| PUT | `/api/grapevine/preferences` | Update house-wide search preferences. **Owner/admin only.** These are site-wide defaults that cascade to all users without per-user overrides (see §14 "Search-preferences cascade"). |

### User Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user-prefs` | Get current user's saved preferences (requires session) |
| PUT | `/api/user-prefs` | Save user preferences (shallow merge). Key fields: `pov`, `rankAuthor`, `rankRelay`, `filters`, `sortConfig`, `selectedMetrics`. |

### Streaming ETL Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/streaming-etl/status` | Consumer status (supervisorctl), Redis queue depth, processed event counts |
| POST | `/api/streaming-etl/control` | Start/stop/restart the consumer. Body: `{ action: "start"|"stop"|"restart" }` |
| GET | `/api/streaming-etl/logs?lines=15` | Tail the consumer log file (max 100 lines) |

---

## 12. CLI Reference (tapestry-cli)

Install: `cd tapestry-cli && npm install && npm link`

Config: `TAPESTRY_API_URL` env var (default: `http://localhost:8080`)

### Commands

```bash
# Status
tapestry status                    # Service health + stats

# Queries
tapestry query "<cypher>"          # Run Cypher against Neo4j

# Sync
tapestry sync                      # Full sync from external relays → strfry → Neo4j

# Concepts
tapestry concept list              # List all concepts
tapestry concept add <name> [items...]  # Create concept + optional elements
tapestry concept element <concept> <name>  # Add element to concept
tapestry concept schema <concept>  # View/create JSON schema
tapestry concept slug <concept> <slug>  # Set concept slug
tapestry concept link <from> <to>  # Create IS_A_SUPERSET_OF
tapestry concept enumerate <concept> <property>  # Create ENUMERATES

# Normalization
tapestry normalize check           # Run all normalization checks
tapestry normalize check-supersets # Check Rule 1 (missing supersets)
tapestry normalize fix-supersets   # Create missing supersets
tapestry normalize skeleton <concept>  # Create missing core nodes
tapestry normalize json <concept>  # Regenerate core node JSON

# Properties
tapestry property create <concept> <name>  # Create property
tapestry property generate-tree <concept>  # Generate property tree graph

# Sets
tapestry set create <concept> <name>  # Create set under superset
tapestry set add <set-uuid> <element-uuid>  # Add element to set

# Forking
tapestry fork <node-uuid>         # Fork another author's node

# Events
tapestry event set-json <uuid> <json>  # Set json tag on any event

# Audit
tapestry audit health              # Overall health
tapestry audit concept <name>      # Audit one concept
tapestry audit stats               # Graph statistics
tapestry audit skeletons           # Check all skeletons
tapestry audit orphans             # Find orphans
tapestry audit wiring              # Check relationships
tapestry audit labels              # Check Neo4j labels
tapestry audit firmware            # Check firmware status
tapestry audit threads             # Analyze class threads

# Config
tapestry config                    # Show current config
```

---

## 13. React UI Structure

**Dev server:** `http://localhost:5173/` (Vite, proxies `/api` to :8080)
**Production:** `http://localhost:80/` (Express serves built files from `dist/`)

The React app is split into two top-level areas:
- **Brainstorm Search** — the public-facing search UI at root `/`
- **Tapestry Dashboard** — the knowledge graph management UI at `/tapestry/`

Legacy Brainstorm HTML pages are served at `/legacy/` (not part of the React SPA).

### Page Hierarchy

```
/                                 Brainstorm Search (landing + results)
├── user/:pubkey                  Profile detail (follow, mute, report)
├── settings                      Search settings (WoT pipeline, metrics, filters)
├── about                         Brainstorm + NosFabrica overview, links to nostr
├── how-search-works              Mechanics: Meilisearch + Verification (GrapeRank)
├── personalization               POV explainer (House vs My Point of View)
└── developers                    NIP-50 developer integration docs

/tapestry/                        Dashboard (Getting Started + stats)
├── concepts/                     Concept list
│   ├── new                       Create new concept
│   └── :uuid/                    Concept detail (tabs):
│       ├── (overview)            Summary
│       ├── core-nodes            Core node listing
│       ├── health                Health Audit (skeleton checks + fix buttons)
│       ├── elements/             Element list
│       │   ├── new               Create element
│       │   ├── add-node          Add existing node as element
│       │   └── :elemUuid         Element detail
│       ├── properties/           Property list
│       │   └── new               Create property
│       ├── dag/                  Organization (Sets) view
│       │   └── new-set           Create set
│       ├── visualization         Graph visualization (placeholder)
│       └── schema                JSON Schema editor
├── lists/                        Simple Lists (raw DList browser)
│   ├── new                       Create DList
│   └── :id/                      DList detail (tabs):
│       ├── (overview)            Info + Neo4j import buttons
│       ├── items/                Item list
│       │   └── new               Create item
│       ├── raw                   Raw nostr event
│       └── actions               DList actions
├── databases/
│   ├── neo4j/                    Neo4j overview + node browser
│   │   └── nodes/:uuid           Node detail (JSON, concepts, relationships, raw)
│   └── strfry                    Strfry overview (lazy-load kind counts)
├── grapevine/
│   ├── meilisearch               Meilisearch admin (stats, scores, backfill)
│   ├── search-preferences        WoT search config (POV, metrics, filters)
│   └── ...                       Trust lists, assertions, determinations
├── users/                        Nostr user directory
│   ├── search                    Profile search (admin, backend)
│   └── :pubkey                   User profile
├── io/
│   ├── import                    Import tools
│   └── export                    Export tools
├── about/                        About page
└── settings/                     Settings (owner only)
    ├── (general)
    ├── relays                    Relay + negentropy sync configuration
    ├── databases                 Database management + wipe
    ├── auditing                  Graph audit tools
    ├── uuids                     Concept UUID config
    └── firmware                  Firmware explorer

/legacy/                          Legacy Brainstorm HTML pages
/relay                            NIP-50 relay proxy (nginx → nip50-proxy)
/browser/                         Neo4j Browser (nginx → Neo4j:7474)
/api/*                            REST API endpoints
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataTable` | `components/DataTable.jsx` | Reusable sortable table with row click |
| `AuthorCell` | `components/AuthorCell.jsx` | Author display with avatar + name |
| `Breadcrumbs` | `components/Breadcrumbs.jsx` | Auto-generated from route handles |
| `Layout` | `components/Layout.jsx` | Sidebar navigation + main content |
| `Header` | `components/Header.jsx` | Auth UI + user dropdown |
| `AuthContext` | `context/AuthContext.jsx` | NIP-07 auth state management |

### Hooks

| Hook | Purpose |
|------|---------|
| `useCypher(query, params)` | Run Neo4j query, return { data, loading, error } |
| `useProfiles(pubkeys)` | Fetch + cache nostr profiles |

### Conventions

- **Dark theme** — CSS variables in `styles.css` (`--bg-primary`, `--text`, `--accent`)
- **No markdown tables in Discord/WhatsApp** — bullet lists instead
- **API clients** in `ui/src/api/` (relay.js, cypher.js, normalize.js, audit.js)

### Brainstorm Search Features

The search UI at root `/` provides several smart lookup modes beyond standard text search:

**Direct Nostr Identity Lookup** — When the user enters a valid npub, hex pubkey, or nprofile, the frontend decodes it to a hex pubkey and passes `pubkeyLookup=<hex>` to the proxy. The proxy fetches the profile directly from Meilisearch by document ID, bypassing WoT filtering and sorting entirely. Returns a single result instantly.

**NIP-05 Verified Profile Lookup** — When the query matches a NIP-05 pattern (e.g., `bob@example.com`), the proxy verifies it in parallel with the normal search by fetching `https://<domain>/.well-known/nostr.json?name=<name>` (5-second timeout). If valid, the verified profile is returned as `nip05Result` in the response — the frontend renders it as a pinned card with a green "✅ NIP-05 Verified" badge above the normal results. The NIP-05 profile is deduplicated from the normal results list.

**Broken Avatar Fallback** — When a profile has a picture URL that fails to load (e.g., dead hosting), the `onError` handler replaces the broken `<img>` with a 👤 placeholder div, preventing layout collapse.

**Strfry Overview Lazy-Load** — The strfry database page (`/tapestry/databases/strfry`) loads the total event count on mount, then provides per-kind count buttons that load individually on demand. This avoids the previous approach of running 12 parallel `strfry scan --count` commands (which timed out on databases with millions of events).

### WoT Score Architecture

WoT scores in Meilisearch are **namespaced by observer POV** using an 8-character suffix derived from the delegated pubkey:

```
Field naming: wot_<metric>_<delegatedPubkey.slice(0,8)>
Example:      wot_followers_78ed0837  (House POV)
              wot_rank_a1b2c3d4       (User's POV)
```

**Score loading flow:**
1. User's kind 10040 event specifies a `rankAuthor` (delegated pubkey) and `rankRelay`
2. TAs (kind 30382 events) are synced from the relay into local strfry
3. TAs are streamed, parsed, and field names are constructed with the suffix: `wot_<metric>_<suffix>`
4. Scores are batch-upserted into Meilisearch via `POST /api/search/profiles/meili/load-scores`
5. The suffix is registered as a filterable+sortable attribute in Meilisearch

**POV resolution during search:**
1. Client sends `wotPov=user&userPubkey=<hex>` (or `wotPov=house`)
2. Proxy reads user prefs from `/var/lib/brainstorm/user-prefs/<pubkey>.json`
3. Extracts `rankAuthor` → derives `povSuffix = rankAuthor.slice(0, 8)`
4. Namespaces filter keys (`rank` → `wot_rank_<suffix>`) and sort fields
5. Falls back to house prefs if user's `rankAuthor` is not found

**User preferences** (saved to `/var/lib/brainstorm/user-prefs/<pubkey>.json`):
- `pov` — `'user'` or `'nosfabrica'` (house)
- `rankAuthor` — hex pubkey of the delegated trust authority
- `rankRelay` — relay URL for syncing TAs
- `filters` — per-metric filter config (e.g., `{ rank: { enabled: true, cutoff: 2 } }`)
- `sortConfig` — `{ metric: 'followers', direction: 'desc' }`
- `selectedMetrics` — array of metric names to use

**Score readiness check** (`checkMeiliScores`): Verifies that Meilisearch has fields matching the user's specific suffix (`wot_*_<suffix>`), not just any `wot_*` field. This prevents false positives from house POV scores or legacy unsuffixed fields.

### Streaming ETL Pipeline

Real-time event processing from strfry to Neo4j, keeping NostrUser nodes and FOLLOWS/MUTES/REPORTS relationships up to date as events arrive.

**Architecture:**
```
strfry (LMDB write) → redis_rpush("strfry:events") → Redis queue → stream-consumer → Neo4j (MERGE)
```

**strfry C++ patch** (`patches/strfry-redis/`): The upstream strfry source is patched during Docker build via `apply-patches.sh`. The patch adds:
- `redis.h` / `redis.cpp` — persistent Redis connection using hiredis
- `redis_init()` call in `main.cpp.tt` after config is loaded
- `redis_rpush()` call in `WriterPipeline.h` after LMDB commit, for kinds 3/10000/1984 only
- Config entries `redis.host` and `redis.port` in `golpe.yaml`
- `-lhiredis` linker flag in `rules.mk`

The patch is non-blocking — relay throughput is unaffected by Redis latency. If Redis is down, events are silently dropped (strfry continues normally).

**Node.js consumer** (`src/pipeline/stream/redis-consumer.js`): Blocking pop (`blpop`) from Redis, processes one event at a time:
- Kind 3: MERGE publisher + followed pubkeys, create FOLLOWS edges, delete stale follows
- Kind 10000: Same pattern with MUTES relationships
- Kind 1984: Additive only — MERGE REPORTS edges, never delete
- Uses `writeCypher()` from `src/lib/neo4j-driver.js` (Bolt driver, connection pooled)
- MERGE queries ensure idempotency — duplicate events are harmless

**Control panel:** Managed via the "⚡ Streaming ETL" tab on the Relays settings page (`/tapestry/settings/relays`). Shows consumer status, Redis queue depth, processed/error counts, and a live log viewer. Start/stop/restart via `supervisorctl`.

**Why not a strfry write plugin?** Write plugins run BEFORE the LMDB write and block the pipeline — every event waits for the plugin response. During negentropy syncs (millions of events), this would stall the relay. The C++ patch runs AFTER the LMDB commit, non-blocking.

### Graph Algorithms (GDS)

Neo4j's Graph Data Science library (GDS 2.13.4) is installed and configured (`dbms.security.procedures.unrestricted=gds.*`). Currently used for:

**Hop Distance Calculation** (`src/algos/calculateHopsFrontier.sh`): Calculates the shortest hop distance from the instance owner to every other NostrUser via the FOLLOWS graph. Uses a frontier-based BFS approach — each iteration only scans edges from the current hop level's nodes, not the entire graph.

Algorithm:
1. Initialize all NostrUser nodes to `hops=999` (batched, 50K rows per transaction)
2. Set owner to `hops=0`
3. For each hop level N (0→12): match nodes at hop N whose FOLLOWS targets are still at 999, set targets to N+1
4. Stop when no more updates or max hops reached

Performance comparison (2.46M nodes, 30M FOLLOWS relationships):
- **Legacy iterative Cypher** (`calculateHops.sh`): Each iteration scans ALL 30M edges looking for any node to update. Up to 12 × 30M = 360M relationship scans.
- **Frontier-based** (`calculateHopsFrontier.sh`): Each iteration only scans edges from the ~N nodes at the current hop level. Hop 1: 775 nodes × their edges. Hop 2: 309K nodes × their edges. Total work proportional to reachable graph, not total graph.

Empirical results: Hop 1 completes in 8ms (775 nodes), hop 2 in 1.5s (309K nodes). Total runtime is seconds, not minutes.

Three versions are retained for comparison/fallback:
- `calculateHopsFrontier.sh` — current default (frontier BFS, fastest)
- `calculateHopsGDS.sh` — GDS-based attempt (GDS BFS doesn't provide hop distances directly; retained for reference)
- `calculateHops.sh` — legacy iterative Cypher (slowest but simplest)

**Personalized PageRank** (`src/algos/calculatePersonalizedPageRank.sh`): Uses `gds.pageRank.write()` with the owner as source node. Projects the FOLLOWS graph, runs PageRank with dampingFactor=0.85, writes results back as `personalizedPageRank` property.

**Graph Projection Caching** (`src/algos/projectFollowsGraphIntoMemory.sh`): Reusable script that projects the FOLLOWS graph into GDS memory as `followsGraph`. Checks if the projection exists and is < 3 hours old before re-projecting. Used by PageRank; the hop calculation uses its own temporary projection.

### GrapeRank (Customer Trust Scoring)

GrapeRank is the per-customer personalized trust scoring algorithm — "PageRank for people" with explicit handling of rating confidence, mutes, reports, and an attenuation factor for non-observer raters. Each customer's scorecards live on `NostrUserWotMetricsCard {customer_id, observer_pubkey, observee_pubkey}` nodes with properties `influence`, `average`, `confidence`, `input`. The owner's scorecards live directly on `NostrUser` nodes (same four properties).

**Pipeline** (`src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh`), 5 phases:
1. **CSV initialization** — Cypher dumps of follows/mutes/reports/ratees into `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/` (skipped if cached; the CSVs are shared across customers in a batch run)
2. **Ratings interpretation** — `interpretRatings.js` combines the three relationship CSVs into `ratings.json` with precedence reports > mutes > follows
3. **Scorecards initialization** — `initializeScorecards.js` seeds the starting scorecards (see warm start below)
4. **GrapeRank iteration** — `calculateGrapeRank.js` iterates until max_diff < 0.001 or 60 iterations; each iteration recomputes every ratee's influence as a confidence-weighted, attenuated average of its raters' influence × rating × rating confidence
5. **Neo4j update** — `updateNeo4jWithApoc.js` writes scorecards back via APOC batched UPSERTs (batchSize 250)

**Warm start** — opt-in toggle exposed on task-explorer.html for `calculateCustomerGrapeRank` and its four ancestor tasks (`updateAllScoresForSingleCustomer`, `processCustomer`, `processAllActiveCustomers`, `processAllTasks`). The flag is passed as a positional arg and threaded through the shell hierarchy. When enabled, `initializeScorecards.js` runs a tiered fallback:
1. **`self`** — if the customer has prior `NostrUserWotMetricsCard` scores, seed from them (typical recalculation case; converges in 1–3 iterations instead of ~12–31).
2. **`owner`** — first-time customer: if the owner is reachable within 3 directed FOLLOWS hops *from* the customer (capped `shortestPath` query), seed from the owner's `NostrUser` scorecards. Directionality matters: GrapeRank influence propagates from observer outward along FOLLOWS, so the owner must be *downstream* of the new customer for their scores to approximate the customer's POV.
3. **`cold`** — no prior scores and no reachable owner; all ratees start at `[0, 0, 0, 0]` (legacy behavior).

The algorithm is a contraction mapping (ATTENUATION_FACTOR < 1), so any starting point converges to the same fixed point — warm start only affects iteration count, not the final scores.

**Observability**:
- `initialize_scorecards_summary` PROGRESS event: `warm_start_source` (`self`/`owner`/`cold`/`failed`/`disabled`), `owner_seed_hops`, `warm_started_count` vs `cold_started_count`, `total_scorecards`
- `iteration_complete` PROGRESS event: `iterations`, `converged`, `max_difference`, `calculation_time_ms`
- Each phase's success event includes `phase_duration_seconds`
- `/var/log/brainstorm/customers/<name>/graperank_history.jsonl` — per-run summary appended for each calculation (survives temp-dir cleanup on success)
- All events emit with the shell orchestrator's PID (via `BRAINSTORM_TASK_PID` env var), so child Node.js scripts appear in the same task-timeline session in `task-explorer.html` and `task.html`

**Typical runtime** (observer with ~287k-node network, April 2026):
- Cold start: ~20 min (~15 min in iteration phase, 31 iterations)
- Warm start (self): ~5 min (112 s iteration, 1 iteration)
- Ratings interpretation (~170 s) now dominates total runtime when warm-started; next optimization target

---

## 14. Configuration

### Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OWNER_PUBKEY` | ✅ | Hex pubkey of the instance owner |
| `NEO4J_PASSWORD` | ✅ | Neo4j database password |
| `DOMAIN_NAME` | No | Domain name (default: `localhost`) |

### nostr-search-api Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEILI_URL` | `http://nostr-search-meili:7700` | Meilisearch URL |
| `RELAY_URL` | `ws://tapestry:80/relay` | strfry relay WebSocket URL for live ingestion |
| `TAPESTRY_URL` | `http://tapestry:80` | Tapestry API URL for bulk ingest streaming |
| `PORT` | `3069` | API listen port |
| `SYNC_ON_START` | `true` | Set to `false` to disable auto-ingestion on startup |
| `REINGEST_INTERVAL_HOURS` | `24` | Hours between automatic bulk re-ingestion (0 to disable) |

### Two-Layer Settings

```
defaults.json (shipped with code, git-tracked) + settings.json (user overrides, persistent volume) = merged config
```

Arrays are **replaced**, objects are **deep-merged**. The `getSettings()` accessor re-reads both files on every call — no in-process cache, so settings edits take effect on the next request without a restart.

**Top-level keys:** `aRelays`, `adminPubkeys`, `grapevine`, `nip05`.

The `nip05` key (added 2026-04-25) backs the `/.well-known/nostr.json` endpoint:

```json
{
  "nip05": {
    "names":  { "<name>": "<hex-pubkey>", ... },
    "relays": { "<hex-pubkey>": ["wss://...", ...], ... }
  }
}
```

`names` maps the local-part of the NIP-05 identifier (e.g., `"brainstorm"` for `brainstorm@brainstorm.world`) to a hex pubkey. `relays` advertises where the holder of that pubkey can be reached. Editing happens via the owner-gated `PUT /api/settings` (see §11) or — for first-time prod registration — directly in the volume's `settings.json` (see §15 "Editing settings.json on a deployed droplet").

### Search-preferences cascade

The Meilisearch proxy (`src/api/search/profiles/meili/index.js` lines 137–181) resolves `sort` and `filter` for each search request through three layers:

1. **User's per-user prefs** — `/var/lib/brainstorm/user-prefs/<pubkey>.json`, written via `PUT /api/user-prefs` by signed-in users. *(Underlying API works; no UI exposes sort/filter writes here today — see §17 "What's In Progress".)*
2. **House-wide prefs** — `settings.grapevine.searchPreferences.{filters,sort}`, written via `PUT /api/grapevine/preferences` (owner/admin only since 2026-04-25). The `/tapestry/grapevine/search-preferences` page is the UI.
3. **Text relevance** — Meilisearch's default ranking when no `sort` param is sent.

Three distinct sort intents on the user side:

| Intent | `userPrefs.sortConfig` value | Cascade behavior |
|--------|------------------------------|------------------|
| Use house default | `null` or absent | falls through to house prefs → if house has nothing, text relevance |
| Force text relevance | `{ metric: null, direction: 'desc' }` | overrides house, no sort param sent |
| Specific metric | `{ metric: 'rank', direction: 'desc' }` | overrides house, that metric used |

Same shape for filters: `null`/absent = use house, `{}` = explicit no filters, `{key: value}` = specific filters.

**Historical note:** prior to 2026-04-25, the proxy unconditionally forced `wot_followers:desc` whenever a POV suffix existed and no explicit metric was selected — so the user-side "None" option was unreachable, and the default for unconfigured installs was followers-desc rather than text relevance. Fix removed the forced fallback; default behavior now matches the cascade above.

### brainstorm.conf

Legacy server config at `/etc/brainstorm.conf` inside Docker. Contains:
- `BRAINSTORM_RELAY_PUBKEY` / `BRAINSTORM_RELAY_NPUB` — Tapestry Assistant public key (private key is in SecureKeyStorage only, NOT in this file)
- `BRAINSTORM_OWNER_PUBKEY` — Owner pubkey
- Neo4j connection details
- Session secret

**Note:** `BRAINSTORM_RELAY_PRIVKEY` is no longer stored in brainstorm.conf (removed for security). Legacy code that reads it from there will fail — use SecureKeyStorage instead. See "Assistant Keys" section below.

### Neo4j Config Path (Docker)

Neo4j 5.x looks for its config at `/usr/share/neo4j/conf/` by default, but the Dockerfile installs it at `/etc/neo4j/neo4j.conf` (Debian convention). The `NEO4J_CONF="/etc/neo4j"` environment variable in `docker/supervisord.conf` bridges this gap. Without it, Neo4j falls back to defaults (localhost-only binding, no APOC/GDS procedure allowlists, default memory settings). On bare-metal installs, systemd handles this automatically — Docker/supervisord needs it explicitly.

**Memory, GC, and concurrency settings** are NOT in the Dockerfile — they are written dynamically by `entrypoint.sh` at startup based on the machine's actual RAM and CPU count. See the Memory Architecture section under Development Workflow for details. The Dockerfile only configures static settings (listen addresses, procedure allowlists, APOC config).

### Assistant Keys

Every owner, admin, and customer has an **assistant** — a server-side nostr identity that publishes kind 30382 Trust Assertions and other automated events on their behalf. Under the hood, all assistant keys are stored in SecureKeyStorage and accessed uniformly.

**Owner's assistant** = the Tapestry Assistant (TA). Created at first container startup by `setup/create_nostr_identity.sh`. Stored in SecureKeyStorage as `tapestry-assistant`. Also signs firmware events, concept graph nodes, and other automated Tapestry operations.

**Customer's assistant** = Customer Relay Key. Created at customer sign-up via `createSingleCustomerRelay()`. Stored in SecureKeyStorage under the customer's hex pubkey.

**Unified key access (`src/utils/assistantKeys.js`):**
- `getAssistantKeys(pubkey)` — routes to the correct key: owner pubkey → `tapestry-assistant` in SecureKeyStorage, anyone else → customer relay key.
- `getOwnerAssistantKeys()` — shortcut that always returns the TA key.
- `getOwnerAssistantPubkey()` — sync helper that returns just the TA pubkey (reads from env, brainstorm.conf pubkey, or SecureKeyStorage JSON file).
- All code that previously read `BRAINSTORM_RELAY_PRIVKEY` from brainstorm.conf now uses these functions. The legacy plaintext key file (`brainstorm_relay_keys.sh`) is no longer created on new installs.

**Dynamic TA pubkey in the React UI:**
- `GET /api/assistant/pubkey` returns the owner's TA pubkey (no auth required — pubkey is public).
- `ConfigContext` (`ui/src/context/ConfigContext.jsx`) fetches the TA pubkey at app startup.
- All UI components use `useConfig().taPubkey` instead of a hardcoded constant.

**NIP-85 page (`nip85.html`):**
- Uses the same NIP-07 publish flow as `customer.html`: `POST /api/create-unsigned-kind10040` → NIP-07 sign → `POST /api/publish-signed-kind10040`.
- The `create-unsigned-kind10040` endpoint defaults to the session pubkey when no explicit pubkey is provided, so the owner doesn't need to pass one.

### Router Presets

#### Instances are self-contained

Each Tapestry instance's strfry is the **complete source of truth** for that instance. There is no canonical pool that instances must defer to:

- **Headers** (kind 39998) are written to local strfry by `POST /api/firmware/install` — every instance that has run firmware install has its own copy.
- **Elements** (kind 39999) and other UGC are written to local strfry by `publishEverywhere` (`ui/src/utils/nostrPublish.js`) — they land on the strfry of the instance where the user published, plus any external relays the client also targets.

Nothing in the protocol *requires* an instance to sync with another instance to function. A fresh instance that has run firmware install and accepts its own users' publishes is fully operational on its own. Treat any cross-instance mirror — `dcosl.brainstorm.world`, `dcosl.brainstorm.social`, or another instance's relay — as **just another relay**, not a canonical home.

#### Presets are opt-in cross-instance mirroring

Router presets exist so an operator can *choose* to share or pull state with other relays. Strfry sync streams are configured in `setup/router-presets.json`. All streams default to disabled. Toggle via `POST /api/strfry/router-toggle` or the UI at `/tapestry/settings/relays`.

| Preset | Direction | Kinds | Relays | Purpose |
|--------|-----------|-------|--------|---------|
| `dcosl` | both | 9998, 9999, 39998, 39999 | dcosl.brainstorm.world, dcosl.brainstorm.social | Opt-in mirror of list events with other instances' public relays |
| `dcosl2` | down | 9998, 9999, 39998, 39999 | relay.damus.io | Pull list events that appeared on a general-purpose relay |
| `userProfiles` | down | 0 | wot.grapevine.network, profiles.nostr1.com, purplepag.es | Continuous kind 0 profile sync for search |
| `trustedLists` | both | 30392–30395 | nip85.brainstorm.world, nip85.nostr1.com, nip85.grapevine.network | NIP-85 trusted list events |

> **Important:** Enable the `userProfiles` preset to keep the Meilisearch profile index up to date. Without it, only profiles already in strfry will be searchable.

> **Note on `dcosl` / `dcosl2`:** these are *not* required for an instance to host its own tags, concept graph, or UGC. Enable them only if you want this instance to receive list events that originated elsewhere (down), or republish its own to a shared mirror (up).

---

## 15. Development Workflow

### Quick Start

```bash
# 1. Clone both repos
git clone https://github.com/nous-clawds4/tapestry.git
git clone https://github.com/nous-clawds4/tapestry-cli.git

# 2. Start the server
cd tapestry && git checkout main
cp .env.example .env   # edit OWNER_PUBKEY, NEO4J_PASSWORD, DOMAIN_NAME
docker compose up -d

# 3. Start the React dev server (optional, for UI development)
cd ui && npm install && npx vite --host
# → http://localhost:5173/        (Brainstorm Search at root)
# → http://localhost:5173/tapestry (Tapestry Dashboard)

# 4. Install the CLI
cd ../tapestry-cli && npm install && npm link
tapestry status
```

### Two frontends during development

- **`:5173`** — Vite dev server. Always reflects latest source code (hot reload). Use this for development.
- **`:80` (or `:8080`)** — Production build served by Express inside Docker. Requires `cd ui && npm run build` to update after UI changes.

### Dev Mode (bind-mount code)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Server code changes are reflected after:
```bash
docker compose exec tapestry supervisorctl restart brainstorm
```

**Important:** With dev bind-mount, the container's `node_modules` volume may be empty on first start. If you get `Bad Request` errors from Express, run:
```bash
docker compose exec tapestry bash -c 'cd /usr/local/lib/node_modules/brainstorm && npm install'
docker compose exec tapestry supervisorctl restart brainstorm
```

### Building for Production

```bash
cd ui && npm run build   # outputs to dist/, served by Express at /
```

### Docker Rebuild (after server-side changes)

```bash
docker compose build tapestry && docker compose up -d tapestry
```

### Production Deployment (with host nginx + SSL)

For production behind a host nginx reverse proxy with Certbot SSL:
```bash
# Docker binds to localhost:8080 (not port 80, which host nginx owns)
sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml

# Host nginx proxies port 80/443 → 127.0.0.1:8080
# See .github/workflows/deploy-brainstorm.yml for CI/CD reference
```

### CI/CD Pipelines

GitHub Actions workflows in `.github/workflows/` deploy long-lived branches to dedicated droplets via SSH. Each workflow follows the same shape — pull, port-remap (`sed 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml`), `docker compose up -d --build`, image prune. Secrets follow the convention `DEPLOY_HOST_<NAME>`, `DEPLOY_USER_<NAME>`, `DEPLOY_SSH_KEY_<NAME>`.

The reference deployment at `brainstorm.world` runs three such workflows; specifics are documented in [OPERATIONS.md §1, §3](./OPERATIONS.md).

### Branch Promotion Flow

For all functional changes (and docs-only changes for consistency):

1. Branch off `staging` (e.g., `feat/foo`, `fix/bar`, `chore/baz`)
2. Open PR with base = `staging`
3. Merge → CI auto-deploys to your staging environment
4. Verify
5. Open PR `staging → main`
6. Merge → CI auto-deploys to production
7. Source feature branch is auto-deleted (assuming the repo has "Automatically delete head branches" enabled)

### Branch Protection

Recommended for any long-lived branch (`main`, `staging`, sandbox feature branches): protect against deletion **and** force-pushes. A minimal GitHub Ruleset with "Restrict deletions" + "Block force pushes" suffices.

- **Restrict deletions** prevents the "Automatically delete head branches" repo setting from auto-removing a long-lived branch when it's the *head* of a promotion PR (e.g., `staging → main` would otherwise delete `staging`).
- **Block force pushes** prevents history rewrites that would lose collaborator work and invalidate CI/CD's record of which SHA was deployed.

Short-lived feature branches (`feat/*`, `fix/*`, `chore/*`) are NOT protected and are auto-deleted by GitHub on merge — desired behavior for keeping the branch list tidy.

The specific ruleset configured in the reference deployment is in [OPERATIONS.md §4](./OPERATIONS.md).

### Server Recommendations

For a production instance serving Brainstorm Search to many users:

- **Memory-optimized** droplet (Meilisearch + Neo4j + strfry are all memory-heavy)
- **16GB minimum** — functional but tight
- **32GB recommended** — comfortable for millions of profiles and dozens of WoT users
- **CPU** — not a bottleneck; Meilisearch queries use microseconds of CPU per search
- AMD and Intel perform equivalently for this workload

### Memory Architecture

Neo4j memory is configured **dynamically at container startup** by `entrypoint.sh`. The script detects system RAM, reserves memory for non-Neo4j services, and allocates the rest to Neo4j heap and page cache. G1GC and concurrent transaction limits are also set based on machine size.

For empirical RAM/disk measurements on the reference deployment (32GB droplet, 2.6M profiles, 30M FOLLOWS), see [OPERATIONS.md §5](./OPERATIONS.md).

**Dynamic allocation formula** (in `docker/entrypoint.sh`):

| Machine | Reserved (non-Neo4j) | Neo4j Heap | Page Cache | Tx Memory | GC | Concurrent Txns |
|---|---|---|---|---|---|---|
| 8 GB | 3.5 GB | 1.9 GB | 1.9 GB | 0.9 GB | Default | 100-400 |
| 16 GB | 7.0 GB | 3.8 GB | 3.8 GB | 1.9 GB | G1GC | 200-800 |
| 32 GB | 12.0 GB | 8.3 GB | 8.3 GB | 4.2 GB | G1GC + 16m regions | 800 |

G1GC is enabled when heap ≥ 4GB (reduces GC pause times for large heaps). G1HeapRegionSize is set to 16m when heap ≥ 8GB. ExitOnOutOfMemoryError is always enabled.

**Incremental memory per WoT user** (personalized search):

Each user who loads WoT scores into Meilisearch adds POV-suffixed fields (e.g., `wot_rank_<8char>`, `wot_followers_<8char>`) to their scored profiles. Memory cost per user:

| Parameter | Typical Value |
|---|---|
| Profiles scored per user | 100K-200K |
| Metrics per profile | 2-5 |
| Bytes per numeric field | ~8 (value) + index overhead |
| **Incremental RAM per user** | **~15-25 MB** |
| **Incremental disk per user** | **~100-160 MB** |

At ~20 MB per user, a 32GB server with 12GB reserved for Meilisearch and other services can comfortably support **hundreds of concurrent WoT users** before memory pressure. The bottleneck is Meilisearch's filterable/sortable index structures, not the raw score values.

**Scaling guidance:**
- **< 50 WoT users**: 16 GB server is sufficient
- **50-500 WoT users**: 32 GB server recommended
- **500+ WoT users**: 64 GB or split Meilisearch to a dedicated server

### SSL Setup (one-time)

```bash
apt install -y nginx certbot python3-certbot-nginx

# Create nginx site config proxying to Docker on 127.0.0.1:8080
# (include proxy_set_header, WebSocket upgrade, 100m client_max_body_size)

certbot --nginx -d brainstorm.world
# Certbot auto-renews via systemd timer
```

### Firewall (UFW)

Docker port forwarding requires UFW to be enabled on the host, even with permissive rules:

```bash
ufw allow 'Nginx Full'
ufw allow 22/tcp
ufw allow 7474/tcp
ufw allow 7687/tcp
ufw default allow incoming
ufw default allow outgoing
ufw --force enable
```

### Accessing Neo4j Browser (production)

The Neo4j browser at `/browser` on HTTPS sites doesn't work because the browser forces `bolt+s://` connections but Neo4j's Bolt port doesn't have SSL termination. Use an SSH tunnel instead:

```bash
# From your local machine (use non-standard ports if local Docker is also running Neo4j):
ssh -L 17474:localhost:7474 -L 17687:localhost:7687 root@<droplet-ip>

# Then open in browser:
# http://localhost:17474/browser/preview/
# Connect with: bolt://localhost:17687
```

### Editing `settings.json` on a deployed droplet

The `tapestry-data` Docker named volume mounts to `/var/lib/brainstorm/` **inside the container**. On the host, this volume's actual storage is at `/var/lib/docker/volumes/tapestry_tapestry-data/_data/` — **not** at `/var/lib/brainstorm/` on the host. Editing the host path has no effect; the brainstorm process reads from the volume.

Two ways to edit the right file:

```bash
# Option A — inside the container (cleanest)
cd /opt/tapestry
docker compose exec tapestry sh -c 'cat > /var/lib/brainstorm/settings.json' <<'EOF'
{ ... your JSON ... }
EOF

# Option B — write directly to the volume's host mountpoint
MP=$(docker volume inspect tapestry_tapestry-data --format '{{.Mountpoint}}')
nano "$MP/settings.json"
```

No restart needed — `getSettings()` re-reads on every request. (Hit on 2026-04-25 while registering the first NIP-05 identifier; documenting so it doesn't bite again.)

### Docker Compatibility Notes

- **No `sudo` in scripts**: Inside Docker, everything runs as root. Scripts that use `sudo` will fail with "command not found" because `sudo` doesn't recognize scripts without execute permissions. Use `bash script.sh` instead of `sudo script.sh`.
- **Neo4j config path**: Requires `NEO4J_CONF="/etc/neo4j"` in supervisord (see Configuration section above).
- **Batch transfer scripts** (`transfer.sh`, `callBatchTransfer.sh`) have been updated to use `bash` instead of `sudo` for Docker compatibility.

### Useful Commands

```bash
# Service status inside container
docker compose exec tapestry supervisorctl status

# Run Cypher
docker compose exec tapestry bash -c "echo 'MATCH (n) RETURN count(n)' | cypher-shell -u neo4j -p <password>"

# Scan strfry
docker compose exec tapestry strfry scan '{"kinds":[39998]}'

# Count strfry events by kind (can take minutes on large DBs)
curl 'http://localhost:8080/api/strfry/scan/count?filter={"kinds":[0]}'

# Optional one-shot pull of list events from another instance's relay
# (only needed if you want that instance's data and aren't running the dcosl preset)
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' --dir down
```

---

## 16. What's Been Built

### Server (tapestry repo, main branch)

- ✅ Docker stack (strfry + Neo4j + Express + nginx + supervisord)
- ✅ NIP-07 authentication (owner/customer/guest roles)
- ✅ Two-layer settings system
- ✅ Full React UI with sidebar navigation, dark theme
- ✅ Concept browser with 8 tabs per concept
- ✅ Simple Lists browser with Neo4j import (3 import modes: header only, expand to concept, expand + import elements)
- ✅ Health Audit page with Create/Fix JSON/Rebuild buttons for all 8 core nodes
- ✅ New Concept form (creates all 8 core nodes automatically)
- ✅ New Element form
- ✅ New Property form
- ✅ JSON Schema viewer/editor per concept
- ✅ Organization (Sets/DAG) view
- ✅ Node detail browser (JSON, concepts, relationships, raw data, Neo4j)
- ✅ User directory with profile fetching
- ✅ Settings page (relays, databases, UUIDs, firmware explorer)
- ✅ Firmware v0.0.1 (24 concepts, 11 relationship types, elements, sets)
- ✅ Firmware install process (two-pass)
- ✅ All normalize/audit API endpoints
- ✅ Server-side signing via TA key
- ✅ Strfry router with presets and toggle
- ✅ Word-wrapper JSON format for all node types
- ✅ Getting Started onboarding checklist on Dashboard
- ✅ Responsive mobile layout with collapsible sidebar
- ✅ Meilisearch profile search (nostr-search-api + nostr-search-meili containers)
- ✅ Search page with search-as-you-type, pagination, profile cards with banners/age/website/Lightning
- ✅ WoT-enhanced search with filters, sort, and score loading from Search Preferences
- ✅ Profile freshness pipeline: live ingestion, scheduled 24h bulk re-ingestion, retry logic
- ✅ `userProfiles` router preset for continuous kind 0 sync from profile-aggregating relays
- ✅ Firmware v1.0.0 with biconditional ENUMERATES schema conditionals
- ✅ NIP-50 relay proxy (nip50-proxy) — exposes Meilisearch + WoT search via standard nostr WebSocket protocol
- ✅ NIP-50 custom extensions: `observer:<pubkey>`, `sort:<metric>:<direction>`, `filter:<metric>:<op>:<value>`
- ✅ NIP-11 relay info advertising NIP-50 support with extension documentation
- ✅ Background WoT pipeline auto-trigger — when a NIP-50 search arrives for an observer whose scores aren't loaded, the proxy automatically runs the full pipeline (find kind 10040 → parse rank tag → negentropy sync TAs → parse metrics → load scores into Meilisearch)
- ✅ Direct nostr identity lookup — npub, hex pubkey, or nprofile bypasses text search and fetches profile directly from Meilisearch by document ID
- ✅ NIP-05 verified profile lookup — parallel verification pins verified profile at top of results with ✅ badge, deduplicated from normal results
- ✅ Broken avatar fallback — broken image URLs replaced with 👤 placeholder instead of collapsing layout
- ✅ WoT score POV suffix namespacing — scores stored as `wot_<metric>_<8char>` to support multiple simultaneous POVs
- ✅ Personalized search POV toggle — users can switch between House and personal WoT scores; `rankAuthor` persisted in user prefs
- ✅ Strfry lazy-load kind counts — individual on-demand counts replace monolithic 12-scan status endpoint
- ✅ URL path refactor — Brainstorm Search at root `/`, Tapestry dashboard at `/tapestry/`, legacy at `/legacy/`
- ✅ CI/CD deployment workflows — GitHub Actions auto-deploy to Digital Ocean on push
- ✅ Production SSL via host nginx + Certbot
- ✅ Streaming ETL pipeline — strfry → Redis → Neo4j for real-time FOLLOWS/MUTES/REPORTS processing
- ✅ strfry C++ Redis patch (non-blocking rpush after LMDB commit, applied during Docker build)
- ✅ Redis service in Docker stack (~50MB RAM, message queue buffer)
- ✅ Streaming ETL control panel on Relays settings page (status, start/stop, queue depth, log viewer)
- ✅ Swagger API documentation at `/docs`
- ✅ Customer GrapeRank warm start — initialize scorecards from prior Neo4j scores instead of `[0,0,0,0]`; converges in 1–3 iterations vs ~12–31 cold (~4× speedup, 20 min → 5 min observed)
- ✅ Warm Start UI toggle in task-explorer.html — exposed on `calculateCustomerGrapeRank`, `updateAllScoresForSingleCustomer`, `processCustomer`, `processAllActiveCustomers`, and `processAllTasks`
- ✅ Owner-seeded warm start for first-time customers — if the owner is within 3 directed FOLLOWS hops downstream of the customer, seed from the owner's `NostrUser` scorecards; otherwise cold start
- ✅ GrapeRank observability — per-phase timing in structured events, `iteration_complete` event with convergence metrics (iterations, max_diff, warm_start_source), persistent per-customer `graperank_history.jsonl`
- ✅ NIP-05 server endpoint at `/.well-known/nostr.json` — settings-backed registry under `nip05.names` and `nip05.relays`. Public read with CORS open + 5-minute soft cache. Owner-only writes via `PUT /api/settings` validated for name regex (`/^[a-z0-9._-]+$/`), 64-char hex pubkeys, and `wss://`/`ws://` relay URLs. First identifier in production: `brainstorm@brainstorm.world` (2026-04-25).
- ✅ Cosmetic refresh (2026-04-25) — Verification rename ("WoT Rank" → "Verification Score", "Followers" → "Verified Followers"); `/personalization` split into `/personalization` (POV philosophy) + new `/how-search-works` (Meilisearch + GrapeRank mechanics); new `/about` page; unified header (no back button, no wordmark) on all non-landing pages; experimental corner-anchored landing layout (About top-left, Developers / How search works / Settings spread across the footer corners + middle); MyPovLabel — the user's profile pic + name show in "Searching as:" when "My WoT" is the active POV.
- ✅ Meilisearch sort cascade fix (2026-04-25) — removed the forced `wot_followers:desc` fallback that was preventing the user-side "None (text relevance only)" option from taking effect. Three-layer cascade now resolves cleanly: user prefs → house prefs → text relevance. Default behavior for unconfigured installs becomes text relevance instead of followers-desc; owner can still establish a house-wide default via Search Preferences. See §14 "Search-preferences cascade".
- ✅ Owner/admin auth gate on `PUT /api/grapevine/preferences` (2026-04-25) — the dashboard's House Search Defaults page (`/tapestry/grapevine/search-preferences`) now requires owner/admin role for saves. Previously the endpoint was publicly writable; anyone could rewrite site-wide defaults. Page heading updated to "House Search Defaults"; non-owners see a view-only banner and disabled save button. GET stays public so anonymous visitors and the inline picker can read the resolved house defaults.
- ✅ Following count on `/user/:pubkey` (2026-05-03) — Twitter/Damus-style `X Following` row beneath the profile header on the public profile page. Initial implementation read from `/api/get-user-data`'s `followingCount`; replaced with the new lightweight `/api/get-user-counts` endpoint (below) for ~50× speedup over the multi-traversal handler. The Verified Followers card stays in the Reputation section as the single source of truth for that number.
- ✅ `GET /api/get-user-counts` endpoint (2026-05-03) — lightweight follow-count read backed by a strfry `kind 3` lookup + `p`-tag count. Sub-second response vs. the multi-second `/api/get-user-data` it replaced for the simple count case. The kind 3 event is the source of truth (no batch-recomputation lag) and works even before the Neo4j graph is crawled for a new user.
- ✅ Dynamic `OWNER_PUBKEY` and relay lists in the UI (2026-05-04) — replaced the hardcoded literal in `ui/src/config/pubkeys.js` (which was actually the wrong pubkey for production owner identification — Nous, not Dave) with `ConfigContext` reads from new `GET /api/owner/pubkey` and `GET /api/relays` endpoints. 9 OWNER_PUBKEY consumers and 4 hardcoded-relay consumers migrated. Real bug fix for any non-NosFabrica deployment plus a real fix on production.
- ✅ Dead-settings cleanup + System tab removal (2026-05-04) — removed the unused `trustScoreCutoff` and `neo4jCypherQueryUrl` keys from `defaults.json`, deleted the orphaned `src/concept-graph/deprecated-parameters/defaults.json`, deleted `ui/src/pages/settings/SystemSettings.jsx` and the `🖥️ System` tab from the Settings page (only existed to edit those dead keys). Settings page now has 5 tabs: `📡 Relays · 🗄️ Databases · 🔑 Concept UUIDs · 🔧 Firmware · 🔍 Auditing Tools`.
- ✅ Catch-all routes for unmatched URLs (2026-05-04) — direct navigation to any unmatched URL (`/foo`, `/tapestry/foo`, `/tapestry/settings/system`) now renders a friendly `NotFound` page with a link home, instead of React Router's default `Unexpected Application Error! 404 Not Found` developer-mode UI. Added at three nesting levels in `App.jsx`. The `/tapestry/settings/*` catch-all redirects to `/relays` (the default tab).
- ✅ Threshold consolidation at 0.05 (2026-05-04) — verified-follower/muter/reporter cutoffs in the legacy listings (previously hardcoded `0.05`) and the owner-side `calculateVerified*Counts.sh` (previously hardcoded `0.1`) now both read `VERIFIED_{FOLLOWERS,MUTERS,REPORTERS}_INFLUENCE_CUTOFF` from `/etc/graperank.conf` with `0.05` as the unified default. See [docs/PREFERENCES_AUDIT.md §6.2](./docs/PREFERENCES_AUDIT.md). Customer-side already had configurable cutoffs (defaulting to `0.01`); customer plane unchanged.
- ✅ Persistent sessions across deploys (2026-05-04) — sessions are now Redis-backed (`connect-redis` over the existing `ioredis` client + the `tapestry-redis` Docker container) AND `SESSION_SECRET` persists across container rebuilds via a file on the `tapestry-data` volume. Both halves are necessary: Redis alone leaves the secret rotating on every deploy and invalidates cookies; persistent secret alone leaves sessions in MemoryStore wiped by container rebuild. Together: signed-in users (and the autonomous-verification Chrome session) survive every deploy. See [OPERATIONS.md §8.5/§8.6](./OPERATIONS.md).
- ✅ `/cycle-*` slash commands and `docs/SMOKE_TEST.md` (2026-05-04) — four user-invocable skills at `.claude/skills/cycle-{local,staging,prod,full}/SKILL.md` encoding the deploy patterns: build → docker cp → `:8080`, push → PR → staging, promotion → main, and the chained version with halt-on-failure and explicit prod-merge gate. Companion `docs/SMOKE_TEST.md` is the canonical five-tier smoke-test definition (pipeline readiness, sanity reachability, PR-specific, Chrome visual, regression sweep). The `.gitignore` was switched from `.claude/` to `.claude/*` + `!.claude/skills/` so per-user state stays ignored but project skills ship with the repo.
- ✅ `CLAUDE.md` root pointer (2026-05-03) — short index file at the repo root pointing AI coding tools at BIBLE.md and OPERATIONS.md as the two canonical onboarding docs.
- ✅ Preferences audit (`docs/PREFERENCES_AUDIT.md`, 2026-05-03) — comprehensive inventory of every preference-shaped value across the codebase (5 storage planes, 5 fragmentation patterns) with a sequenced cleanup plan. §6.1 quick wins all shipped (this batch). §6.2 partially closed (verified-cutoffs unified at 0.05). §6.3 (owner ↔ customer parallel planes) is the open architectural question.

### CLI (tapestry-cli repo)

- ✅ All commands refactored to use server API (no local event building/signing)
- ✅ Query, sync, status
- ✅ Concept management (add, element, schema, slug, link, enumerate)
- ✅ Normalization (check, check-supersets, fix-supersets, skeleton, json)
- ✅ Property management (create, generate-tree)
- ✅ Set management (create, add)
- ✅ Fork command
- ✅ Audit commands (health, concept, stats, skeletons, orphans, wiring, labels, firmware, threads)

---

## 17. What's In Progress

- **JSON validation** — audit validates core node JSON against firmware schemas; element validation against concept schemas exists but needs polish
- **Meilisearch scalability** — at 2M+ profiles on a 2-vCPU machine, indexing can saturate CPU; may need tuning for production
- **NIP-50 adoption** — relay proxy is live; working to get nostr client developers to integrate WoT-powered search results
- **GrapeRank performance optimization** — first wave (warm start) shipped; the ~55% of remaining runtime spent in the ratings-interpretation phase is the next optimization target
- **Relay Discovery** — Trust-weighted relay endorsement and tagging feature. Currently being developed on its own long-lived branch in the reference deployment. (See [OPERATIONS.md §2](./OPERATIONS.md) for the specific branch and history in this fork.)
- **Magic Carpet bounty system** — Experimental nostr-bounty feature: list curators offer Lightning sats to trusted contributors who add items to curated lists. SQLite-backed bounties + NIP-57 zap flow. Sandbox-only — not yet intended for production.
- **Meilisearch upgrade** — Currently pinned at v1.12.8 in `docker-compose.yml`. v1.12.x panics on certain queries (e.g. `q=primal`) due to an internal interner u16 overflow in milli. Workaround in place: `nostr-search/src/search.js` catches the panic and returns a friendly notice in place of a 500. Real fix is to upgrade to a version that resolves this; verify index compatibility, plan a reindex, and remove the workaround.
- **Per-user search-prefs UI** — The Meilisearch proxy resolves search sort/filter through a three-layer cascade (user → house → text relevance — see §14 "Search-preferences cascade"), but there is currently no UI letting a signed-in user override the house defaults. The third tier of the cascade exists in the code but is unreachable from the frontend. `PUT /api/user-prefs` is wired server-side; only the client-side UI is missing. Open design questions: where the picker lives (UserMenu inline picker? new page? section on the existing dashboard Search Preferences page?), and how to render the "Use House Default" / "None" / specific-metric three-state.
- **Unit tests for the meili-proxy cascade resolver** — The sort/filter cascade in `src/api/search/profiles/meili/index.js` is currently inline in the route handler with no isolated tests. Worth extracting a small `resolveSortParam(userPrefs, housePrefs, povSuffix)` helper and asserting the three states (user override / house default / text relevance) to lock in the regression that surfaced when "None (text relevance only)" was being silently overridden.

---

## 18. What's Yet To Be Built

### Near-Term

- [ ] **Element JSON validation against concept schemas** — full validation pipeline in the audit
- [ ] **Pruning UI** — standalone pruning buttons exist on Health Audit; consider auto-prune after firmware install
- [ ] **Loose consensus demonstration** — show how two users' WoTs converge on shared definitions
- [ ] **IMPORT/SUPERCEDES UI** — buttons to import or supercede another user's concept
- [ ] **Continuous normalization monitoring** — run checks on heartbeat/cron, alert on violations
- [ ] **Multi-user support** — different views based on trust scores
- [ ] **Client-side signing flow** — server returns unsigned event templates, client signs via NIP-07, posts back
- [ ] **Search for concepts/elements/properties** — extend Meilisearch to index concept graph data, not just profiles
- [ ] **Tier 2 warm-start heuristics** — nearest-customer seeding when the owner is not reachable; community-detection-based seed selection

### Medium-Term

- [ ] **Firmware Layer 2** — firmware defines structure too, code becomes generic interpreter
- [ ] **NIP-85 trusted assertions** — publish curated lists as NIP-85 events
- [ ] **Cross-instance federation** — multiple Tapestry instances syncing and discovering each other's concept graphs
- [ ] **SALUD protocol integration** — health data structured via tapestry concepts
- [ ] **GrapeRank integration** — full PageRank-style trust scoring applied to concept curation
- [ ] **GrapeRank Scoring Systems registry** — formalize multiple GR scoring systems (baseline influence, GR Community membership, future variants) as first-class addressable resources, so curators can reference a system by stable identifier (e.g. via a `weighting_model` field)

### Long-Term

- [ ] **Tapestry of Tapestries** — instances importing concepts from each other, WoT-weighted
- [ ] **Mobile client** — lightweight concept browser for nostr mobile apps

---

## 19. Key Design Decisions

1. **Kind unification** — Any event kind can be a concept. What matters is graph position, not event kind.
2. **Implicit relationships by default** — Only editorial relationships are explicit nostr events. This avoids infinite regress.
3. **Word-wrapper JSON** — Every node's JSON is namespaced by its type roles, allowing multi-concept membership.
4. **Firmware over config** — Meta-concept definitions live in versionable JSON files, not hardcoded in the database.
5. **Deterministic d-tags** — Firmware concept UUIDs are computed from pubkey + slug, not random.
6. **Server-side signing** — The TA key signs automatically. Client signing is optional (not yet implemented).
7. **Targeted import over full resync** — Individual events are imported to Neo4j surgically, not via full database rebuild.
8. **Two-layer settings** — Shipped defaults + user overrides, deep-merged at runtime.
9. **The Class Thread Anomaly** — One self-referential concept (concept-header) is structurally necessary and by design.

---

## 20. People

| Person | Role | Nostr npub |
|--------|------|------------|
| **Dave Strayhorn** (wds4/straycat) | Creator of Brainstorm, DCoSL, GrapeRank. NosFabrica co-founder. | `npub1u5njm6g5h5cpw4wy8xugu62e5s7f6fnysv0sj0z3a8rengt2zqhsxrldq3` |
| **Avi Burra** | NosFabrica co-founder. Healthcare veteran, PlebChain Radio host. | — |
| **Jon Gordon** | NosFabrica co-founder. | — |
| **Vitor (Pamplona?)** | NosFabrica co-founder. NIP-82 medical data. | — |
| **Vinney** | Active DList contributor (Real Paid Gigs, Food Experts). | — |
| **Matthias DeBernardini** | Platform Engineer at AnchorWatch. WoT tooling. | `npub137wy27rlz7djjjtq3l724ea88dd86y4y45cft9xz5gp8xcq6uu8s53ked7` |

---

## 21. Glossary

| Term | Definition |
|------|-----------|
| **a-tag** | Stable address for replaceable events: `<kind>:<pubkey>:<d-tag>`. Same as UUID in Neo4j. |
| **Class Thread** | The path Concept → Superset → (Supersets) → Elements. Defines how a concept is structured. |
| **Class Thread Anomaly** | The one concept (concept-header) that is an element of its own superset. A structural necessity, not a bug. |
| **Core Nodes** | The 8 nodes every concept should have: header, superset, schema, primary property, properties set, 3 graphs. |
| **d-tag** | The `d` tag on a replaceable event. Combined with kind and pubkey, forms the a-tag. |
| **DCoSL** | Decentralized Curation of Simple Lists — the precursor protocol to tapestry. |
| **DList** | Decentralized List — a nostr event (kind 9998/39998 header + 9999/39999 items). |
| **ENUMERATES** | A relationship where a concept's elements define the allowed values for a property. Horizontal integration. |
| **Firmware** | The versioned set of JSON definitions for the protocol's own meta-concepts. Read by the server at runtime. |
| **graphContext** | Top-level sibling of `word` in tapestryJSON. Contains local, dynamic, non-portable metadata (identifiers, concept membership, schema validation). Stripped before sharing via nostr events. |
| **GrapeRank** | "PageRank for people" — iterative, personalized-per-observer trust scoring. Weighted average of raters' influence × rating × rating confidence, with an attenuation factor on non-observer raters. Converges to a fixed point determined purely by the observer pubkey and the rating graph. |
| **Grapevine** | The Web of Trust system that determines which curations achieve community consensus. |
| **IMPORT** | Editorial relationship: "I agree with your concept and want to benefit from your curated elements." |
| **INHERITS_FROM** | Canonical child→parent definitional-inheritance edge from the `b` tag: "I defer to the parent's definition, live, unless I override." Distinct from IMPORT (absorption; implies IS_A_SUPERSET_OF) and REFERENCES (non-committal stub). No `source`. ADR 0027. See §25. |
| **concept-graph (header tag)** | Self-describing tag on a kind-39998 ConceptHeader: `["concept-graph","39999:<pubkey>:<d-tag>-concept-graph"]` (computed). Resolution = tag-if-present else compute the same a-tag. Lets a single fetched Header resolve its full concept off-relay. ADR 0007. See §5. |
| **communityReference** | A firmware-concept pointer `{ headerATag, relayHints[], knownGoodEventId? }` to an external curator's published concept. Resolved at install into a `REFERENCES` placeholder. See §22. |
| **grapevine → firmware → none** | The community-reference resolution precedence: the user's Grapevine is the correct selector of "the community's definition"; the firmware-baked pointer is only a cold-start default; else nothing. Mirrors Warm Start's `self → owner → cold`. See §22. |
| **Loose Consensus** | When two users' WoTs overlap enough to converge on the same definition without central coordination. |
| **REFERENCES (concept-level)** | Neo4j-only deferred stub edge: local Concept Header → an external curator's Concept Header (`source` set). NOT agreement/import. Overloaded with the tag-level `REFERENCES`; disambiguate by endpoint labels + `source`. See §22. |
| **Meilisearch** | Full-text search engine used for profile search. Runs as a separate Docker container (`nostr-search-meili`). Indexes 2M+ kind 0 profiles with sub-10ms query times. |
| **NIP-05** | Nostr verification standard. A NIP-05 identifier (e.g., `bob@example.com`) is verified by fetching `https://domain/.well-known/nostr.json?name=bob` and checking the pubkey mapping. |
| **NIP-07** | Nostr browser extension signing standard. Used for authentication. |
| **NIP-50** | Nostr search protocol. The nip50-proxy implements this to expose Meilisearch + WoT search via standard nostr WebSocket protocol. |
| **nip50-proxy** | Service inside the tapestry container (port 7780) that sits between nginx and strfry, intercepting search REQs and routing them through Meilisearch. |
| **Normalization** | The process of ensuring the concept graph follows structural rules. |
| **nostr-search-api** | Separate Docker container (port 3069) that handles live profile ingestion from strfry and proxies search queries to Meilisearch. |
| **POV (Point of View)** | The WoT perspective used for filtering/sorting search results. Either `house` (instance default) or `user` (personalized). Determines which `povSuffix` is used. |
| **povSuffix** | 8-character prefix of the delegated pubkey (`rankAuthor.slice(0, 8)`). Used to namespace WoT score fields in Meilisearch (e.g., `wot_followers_78ed0837`). |
| **rankAuthor** | The hex pubkey of the delegated trust authority whose Trust Assertions (kind 30382) provide WoT scores for a given POV. Stored in user prefs. |
| **SUPERCEDES** | Editorial relationship: "I've evaluated your definition and chosen to replace it with mine." Non-destructive. |
| **Assistant** | A server-side nostr identity that publishes events on behalf of an owner, admin, or customer. The owner's assistant is the Tapestry Assistant (TA); customer assistants are created at sign-up. All stored in SecureKeyStorage. |
| **Tapestry Assistant (TA)** | The owner's assistant — server-side nostr identity that signs automated events (firmware, concepts, kind 30382 Trust Assertions). Stored in SecureKeyStorage as `tapestry-assistant`. |
| **Trust Assertions (TAs)** | Kind 30382 nostr events published by a `rankAuthor` that assign trust scores (rank, followers, etc.) to other pubkeys. Synced via negentropy and loaded into Meilisearch for WoT-powered search. |
| **Warm Start** | An opt-in GrapeRank initialization mode that seeds scorecards from previously-computed scores instead of `[0,0,0,0]`. Three sources in tiered fallback: `self` (customer's own prior scores), `owner` (owner's `NostrUser` scores when the owner is within 3 directed FOLLOWS hops downstream of the customer), and `cold` (no seed available; legacy behavior). Typically cuts customer GrapeRank runtime from ~20 min to ~5 min. |
| **Word-wrapper** | The canonical JSON format where every node's data includes a `word` section plus type-specific sections. |
| **b tag** | Single-char inherit-from pointer on a kind-39998/39999 event: `["b","<parent-a-tag>","inherit"]`. Child-claims-parent — "my definition is the parent's, unless I override." Materializes `(child)-[:INHERITS_FROM]->(parent)`. ADR 0027. See §25. |
| **z-tag** | The `z` tag on a ListItem that points to its parent concept's a-tag. Fundamental parent pointer. |

---

## 22. Community-Reference Model

A firmware concept may carry a `communityReference` — `{ headerATag, relayHints[], knownGoodEventId? }` — a **deferred, non-committal pointer** to an external curator's published concept (a kind-39998 Header). At firmware install, `pass_communityReferences` fetches that Header from `relayHints`, republishes it to local strfry **without re-signing**, **explicitly materializes it as a Neo4j node** (`buildImportCypher`/`executeCypher`), then MERGEs `(localHeader)-[:REFERENCES {source:'firmware-community'}]->(communityHeader)`. Idempotent; fully graceful (any miss → log + continue, never throws; the local concept is unaffected).

**The `REFERENCES` edge is a stub, not an assertion.** It means "this external curator's concept is a recognized reference for my local concept; I *may* later pull from it" — not agreement, not "imported," not `IS_A_SUPERSET_OF`. It is distinct from the (deferred) editorial `IMPORT`. One local concept may `REFERENCES` **many** external concepts (e.g. Miles's *Jazz Musicians* and Dizzy's) — many-to-one via distinct target nodes; provenance per-edge via `source`.

**Collision contract (binding).** `REFERENCES` is overloaded: event ingest builds high-volume `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)` for every `e`/`a` tag. Concept-level `REFERENCES` is disambiguated by **endpoint labels** (`ListHeader→ListHeader`) **and** `r.source` (tag-level never sets it). Any consumer traversal MUST filter on both; a bare `MATCH ()-[:REFERENCES]->()` is a defect.

**Resolution model.** The *correct* long-term selector of "the community's definition" is the user's Grapevine (WoT loose consensus over published curations). The firmware-baked pointer is a **cold-start default**, not the truth. Precedence: **`grapevine-resolved → firmware-blessed → none`** — mirroring the Warm Start tiered fallback (`self → owner → cold`).

**Accepted compromise (Flaw A) and its exit.** A firmware-baked pointer is a *centralized* editorial choice (the dev team picks the blessed curator pubkey — currently the reference deployment's TA). Accepted **temporarily**; the exit is the **registry-as-DList**: the per-concept pointer itself becomes a community-curated, Grapevine-ranked DList, retiring the hardcoded choice.

**Candidate exit mechanism — the `b` / `INHERITS_FROM` tag (ADR 0027).** A `b` tag (§25) is a published, `#b`-queryable, per-pubkey pointer naming a preferred definition. Aggregating a concept's **incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV**, yields "which definition my web of trust loosely agrees on" — exactly the `grapevine-resolved` selector above. This makes `b`-edges a **candidate mechanism** for the registry-as-DList exit. Recorded as candidate only; the registry design is not ratified here (a future ADR in the 0006 line).

**Invariants & principles.**
1. *Relay invariant:* concept export and `communityReference.relayHints` must target the same relay set (the purpose-built DList relay, not general-purpose relays) or the round-trip cannot close.
2. *Export is own-authored:* you never re-export another curator's concept under your identity.
3. *Materialization ≠ derive:* publishing to strfry does not create a Neo4j node — Pass-3 derive only computes `tapestryJSON` for nodes already present; ingesting a foreign event requires the explicit eventSync import path.
4. *Verification:* structural sentinels cannot prove relay + Neo4j + install round-trips — the local/staging/prod smoke is the authoritative behavioral gate (it caught the materialization defect that all structural tests missed).

**Header→ConceptGraph (implemented — ADR 0007, §5):** the `concept-graph` header tag + tag-else-compute resolution makes a single fetched Header self-resolve its full concept off-relay.

**Superset link, Phase A (implemented — ADR 0008):** at firmware install, `pass_communityReferences` also materializes the community Superset (deterministic `39999:<curatorPk>:<dtag>-superset`), explicitly labels it `:Superset` (`buildImportCypher` gives only `:ListItem` for 39999), and MERGEs the **canonical** `(localSup:Superset)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` edge — a structural bookmark that participates in class-thread traversals.

**Phase B (implemented — Story #14, ADR 0010 with mechanism amended by ADR 0011):** owner-on-demand class-thread closure pull via `POST /api/concept/:handle/pull-community-class-thread` (NIP-07-gated). Walks the curator's class-thread closure via `#n` + `#s` tag filters (single-char child-claims-parent tags — see §23) from the #11 community Superset anchor; back-compat z-at-Header walk at root depth covers curators that haven't migrated to `n`/`s` tags. Foreign Sets get explicit `:Set` label; canonical `HAS_ELEMENT` / `IS_A_SUPERSET_OF` edges MERGEd between foreign nodes (no `source` property — canonical relationships, not stubs). **Binding invariants:** authorship trust gate (refuses events whose `pubkey !== curatorPk`); no editorial relationships; no election into local class thread; local concept untouched. Idempotent + per-member graceful + visited-set + max-depth + max-fetch budget.

**Deferred (see ADR 0006 / ADR 0011):** privacy tiers; signed/first-class editorial relationship-type; registry-as-DList (flaw-A exit); cutover ADR (deprecate the descriptor-event dual-emit); migration CLI for existing local events; `IS_A_PROPERTY_OF` / `REFERENCES` as single-char tags (reserved-future candidates); election surface; concept-graph fidelity upgrade.

---

## 23. Class-Thread Membership Tags (`n`, `s`)

**Canonical single-char child-claims-parent tags** for the class-thread relationships, defined for kind-39999 only (this section). Single-char ⇒ relay-indexed by default per NIP-01; child-claims-parent direction mirrors `z` tag's pattern and decentralizes naturally (no parent maintains a children-list event). Established by ADR 0011 to collapse Tapestry's prior two-tier encoding (membership via z-tags + structure via separate relationship-descriptor events) into a single tier where the source event carries both.

| Tag | Logical relationship | On-wire (child carries tag) | Neo4j edge written by consumers |
|---|---|---|---|
| `n` | HAS_ELEMENT-inverse | child claims parent set / superset | `(parent)-[:HAS_ELEMENT]->(child)` |
| `s` | IS_A_SUPERSET_OF-inverse | child set/superset claims parent superset | `(parent)-[:IS_A_SUPERSET_OF]->(child)` |

**Tag value format:** parent's a-tag form (`<kind>:<pubkey>:<dtag>`) — same shape as `z` tag values. E.g. `['n', '39999:919ba08a…:the-set-of-paid-nostr-relays']`.

**Multi-parent semantics:** an event may carry multiple `n` tags (member of multiple sets) and multiple `s` tags (subset of multiple supersets — rare but expressible). Same multi-tag pattern as `z`.

**Emission sites (dual-emit policy during back-compat cycle):** `handleCreateSet` emits the new `s` tag on the Set event before signing; `handleAddToSet` emits the new `n` tag via re-publishing the source event (locally-authored items only — foreign-authored items cannot be re-signed; descriptor event still fires for those). Both sites also continue publishing the prior relationship-descriptor events for one full release cycle. A future cutover ADR will deprecate the descriptor emission.

**Trust constraints when consuming `n`/`s` tags from foreign curators (binding):**
1. **Authorship gate:** materialize events only when `pubkey === curatorPk` (the same TA whose Header anchored the #11 `IS_A_SUPERSET_OF` edge). Prevents cross-instance election (someone publishing an event with `['n', '<myLocalSuperset-uuid>']` cannot trick a consumer into MERGEing edges into the consumer's local class thread).
2. **Local-graph isolation:** the only cross-pubkey edge allowed in the graph is the #11 `(localSuperset)-[:IS_A_SUPERSET_OF]->(communitySuperset)` anchor, established by firmware install. Phase B's tag walk never MERGEs an edge whose parent endpoint is in the local TA's sub-graph.
3. **Class-thread only:** consumers walking `n`/`s` MUST MERGE only `HAS_ELEMENT` and `IS_A_SUPERSET_OF` edges (canonical class-thread relationships); no editorial relationship types are inferable from these tags. *(This constraint is specific to `n`/`s`; the editorial inherit-from relationship has its own single-char tag `b` — see §25.)*

**Direction principle (reserved, codified):** lowercase single-char tags encode **child-claims-parent**. Uppercase single-char tags (currently unassigned) would encode **parent-claims-child** for the same logical relationship type if a future ADR adopts the inverse direction. **Do not assign uppercase forms speculatively** — only when a concrete consumer needs the inverse direction AND that inverse cannot be more cleanly expressed as a derived aggregate query (relay filter for `#n=X` already returns all children of X). The inherit-from tag `b` (§25) follows this convention and reserves uppercase **`B`** for a future parent-claims-child / federation inverse.

**Future-candidate relationship tags** (NOT implemented; documented for protocol hygiene so the next ADR-author doesn't accidentally repurpose neighboring letters):
- `IS_A_PROPERTY_OF` (property tree). Candidate letter TBD. Hot-read-path candidate.
- `REFERENCES` (Story #8 community-reference; flaw-A exit). Candidate letter TBD. Open question: publishing semantics — consumer-owned tag on consumer's concept Header, or separate "reference manifest" kind-39999 event?
- Editorial relationships. The inherit-from relationship is now realized as the **`b` tag** → `INHERITS_FROM` (the first editorial single-char tag, also extending the single-char namespace to kind-39998) in **§25** / ADR 0027. Others (`RECOMMENDED_BY`, `ENDORSES`, etc.) remain for a future ADR (trust, provenance, first-class-vs-stub semantics).

---

## 24. Task Queue (BullMQ behind /api/run-task)

Operator-triggered tasks (recalculate scores, refresh search index, sync WoT, etc.) flow through a durable **per-task BullMQ queue** behind `POST /api/run-task`. The queue lives inside the `tapestry` container alongside Express and is backed by the same Redis container the strfry-stream-consumer and session store use (separate keyspaces; no conflict).

**Topology — per-task Queue + Worker.** At brainstorm startup, `bin/control-panel.js` reads `src/manage/taskQueue/taskRegistry.json` and for each registered task constructs one BullMQ `Queue` plus one in-process `Worker`. The Worker's processor (`src/manage/taskQueue/queue/processor.js#processJob`) spawns `launchChildTask.sh` with the right env + args — `pgrep` belt-and-suspenders inside the bash script still guards against concurrent spawns. Job deduplication uses BullMQ's native `jobId`: `${taskName}:${pubkey}` for customer-scoped tasks; `${taskName}` alone for non-customer ones. Concurrent submissions for the same `(taskName, pubkey)` while a previous attempt is in `wait` or `active` join one execution; once the previous attempt finalizes (completed or failed), the next submission creates a fresh execution. The wait/active-only dedup window is enforced by passing `removeOnComplete: true` + `removeOnFail: true` on `queue.add` — see ADR 0022 for the empirical investigation.

**Feature flag — `TASK_QUEUE_ENABLED`.** Boolean knob in `/etc/brainstorm.conf`. When `true` (default since story #17 / ADR 0015), `/api/run-task` enqueues; when `false` (rollback path), the legacy direct-spawn code runs unchanged. Redis-down with the flag on returns HTTP 503 + `{code:"QUEUE_UNAVAILABLE"}` so monitoring distinguishes it from generic 5xx.

**Source-of-truth chain (config flow).** The flag's lifecycle traces back through stories #16 + #17:
```
config/brainstorm.conf.template            (repo-tracked source of truth)
         │  (rendered at container start by tools/render-conf-template.js,
         │   substituting ${VAR_NAME} against process.env)
         ▼
/etc/brainstorm.conf                       (regenerated unconditionally on every restart)
         │  (sourced by start-brainstorm.sh)
         ▼
bin/control-panel.js                       (reads TASK_QUEUE_ENABLED via brainstormConfig.get)
```
The drift sentinels in `test/entrypoint-template-rendering.test.js` (T7 + T8) trip CI if a future change reintroduces a `<<CONFEOF` heredoc in `docker/entrypoint.sh` or moves off exactly-one `render-conf-template.js` invocation.

**Operator UI — BullBoard.** When the flag is on, BullBoard mounts at `/admin/queues/` behind a custom `requireOwnerOrAdmin` middleware (story #18 / ADR 0016). The session pubkey must equal `BRAINSTORM_OWNER_PUBKEY` or be in `BRAINSTORM_ADMIN_PUBKEYS`; everyone else gets HTTP 403 with `error: "Owner or admin access required"`. Admin-management endpoints (`/api/admin/list|add|remove`) deliberately stay on the stricter `requireOwnerOnly` — admins cannot promote or remove other admins (privilege-escalation guardrail).

**Cross-task serialization — `neo4j-heavy` resource class.** BullMQ's built-in concurrency cap is per-queue; story #15 / ADR 0013 adds a Redis-backed counted semaphore that gates cross-queue concurrency on registry-tagged tasks. The owner trio (`calculateOwnerHops`, `calculateOwnerPageRank`, `calculateOwnerGrapeRank`) is tagged `resourceClass: "neo4j-heavy"`; default cap = 1 (one heavy operation at a time). Cap configurable per class in `/etc/brainstorm-task-queue.json`. Wait events emit `resource_class_wait_begin` / `resource_class_wait_end` / `resource_class_released` tokens to `events.jsonl` for operator triage. Untagged tasks bypass the semaphore entirely (no overhead).

**Protection model — entry-point tagging is load-bearing** (story #26 / ADR 0023, 2026-05-24). The semaphore wrap lives inside the BullMQ Worker callback, so a tagged task's `resourceClass` only engages when the task is invoked via BullMQ — directly via `/api/run-task` or as a scheduled-tasks entry. When a parent script invokes a child via subshell (`launch_child_task`, `bash $script`, direct executable, or `node $script.js`), the child runs as a forked subprocess outside BullMQ and its tag is dormant on that path. The protection convention is therefore: **every entry-point in a tagged child's invocation chain must itself be tagged** — direct paths engage the wrap natively; subshell-spawned children inherit semaphore-held state from a tagged ancestor's still-running Worker callback. PR #201 + story #26 / ADR 0023 enforce this by tagging orchestrator-level parents (`updateAllScoresForOwner`, `processCustomer`, `processAllActiveCustomers`, `processAllTasks`, `processNpubsUpToMaxNumBlocks`). Dormant child tags are retained intentionally as defense-in-depth: they engage on direct invocation. **Adding a new tagged task means auditing its subshell-spawn parents and tagging any that aren't already.** See ADR 0023's audit-results table in ADR 0013 for the full mapping.

**Discoverability.** The dashboard at `/tapestry` shows an "Admin tools" panel (owner+admin only) with a one-click link to BullBoard — see OPERATIONS.md §10.2 for the operator-side details.

**ADRs:** [0012](engineering-team/decisions/0012-task-queue-phase-1-bullmq.md) (BullMQ phase 1); [0013](engineering-team/decisions/0013-task-queue-neo4j-resource-class.md) (resource-class semaphore); [0014](engineering-team/decisions/0014-entrypoint-template-rendering.md) (template-driven config); [0015](engineering-team/decisions/0015-task-queue-on-by-default.md) (default flipped on); [0016](engineering-team/decisions/0016-bullboard-admin-access.md) (owner-or-admin gate); [0022](engineering-team/decisions/0022-manual-task-retrigger-dedup-fix.md) (wait/active-only dedup window via `removeOnComplete`+`removeOnFail`); [0023](engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md) (entry-point tagging is load-bearing — audit closes subshell-chain coverage gaps); [0024](engineering-team/decisions/0024-scheduled-task-timeout-propagation.md) (scheduled-task timeout propagation fix); [0025](engineering-team/decisions/0025-kill-timeout-orphans-by-default.md) (kill timeout-orphans by default).

---

## 25. The Inherit-From Tag (`b`)

**A general definitional-inheritance primitive.** The `b` tag lets any addressable DList object declare *"my definition is this parent's, unless I state otherwise."* It is the single-char, child-claims-parent sibling of the class-thread tags in §23 — but where `n`/`s` express *structure* (containment), `b` expresses *editorial inheritance* (deference). Established by ADR 0027 (ADR 0006/0011 lineage). The Communities Protocol's participant-affiliation pointer is its first consumer (`affiliation` → `b` with type `inherit`); it is **not** community-specific.

| Tag | Logical relationship | On-wire (child carries tag) | Neo4j edge written by consumers |
|---|---|---|---|
| `b` | inherit-from (definitional inheritance with override) | child claims a parent it defers to | `(child)-[:INHERITS_FROM]->(parent)` |

**Wire format:** `["b", "<parent-a-tag>", "<type>"]`. Element 2 is the parent's a-tag (`<kind>:<pubkey>:<dtag>` — same shape as `z`/`n`/`s`; the NIP-01-indexed value). Element 3 is the **affiliation type**, default `"inherit"`, carried as a non-indexed positional element (as NIP-01's `e` tag carries its `root`/`reply` marker). E.g. `['b', '39998:<alice>:dogs', 'inherit']` — "my `dogs` concept defers to Alice's."

**Kinds:** defined for **kind-39998 and kind-39999** — any addressable DList object (concept headers *and* items/sets/Declarations). Broader than `n`/`s`, which are kind-39999-only.

**Multi-parent:** an event may carry multiple `b` tags (inherit from multiple parents — rare; resolution order is a consumer concern, deferred). Same multi-tag pattern as `z`/`n`/`s`.

**Edge direction — child→parent (diverges from `n`/`s`; do NOT flip).** `n`/`s` flip their child-claims-parent encoding into a *parent→child* Neo4j edge because their semantics are containment (the parent owns the child). `b` does **not** flip: it writes `(child)-[:INHERITS_FROM]->(parent)`, because (a) deference reads naturally child→parent, and (b) a parent's **incoming** `INHERITS_FROM` edges are exactly "everyone who defers to this definition" — the trust-weightable query the registry use case (§22) needs. Implementers must not copy the `n`/`s` direction-flip.

**Edge properties.** `INHERITS_FROM` is a **canonical, asserted relationship** (the child published a `b` tag) — so, unlike the concept-level `REFERENCES` stub and like `HAS_ELEMENT`/`IS_A_SUPERSET_OF`, it carries **no `source` property**. It MAY carry a `type` property (default `"inherit"`) mirroring tag element 3.

**Resolution — live, read-time.** A child's **effective definition** is computed on read, never snapshotted:
```
effective(node) = merge( effective(parent_via_b), node.statedFields )
```
- **Live:** the walk reads each ancestor's *current* state, so a child tracks the parent's future edits ("whatever Alice says"). Only the `INHERITS_FROM` edge is materialized; the definition is not copied into the child. (Same read-time pattern as the Communities Protocol's `effectiveCD`.)
- **Override = the child's own stated fields.** A field the child states explicitly overrides the inherited value; an omitted field is inherited. An unedited child performs pure inheritance.
- **Termination:** stop at a root (no `b` tag) or a `maxDepth` guard; a cycle guard (visited-set keyed on a-tag) prevents loops. Reuses the bounded-walk pattern of ADR 0010/0011.
- **Scope today:** the pattern above plus **field-level (whole-field replace)** override. The **set-valued override algebra** — how a child adds/removes/replaces individual elements of an inherited *set* — is deferred to the first consumer that needs it (the first consumer, CD inheritance, overrides only scalars).

**Place in the editorial-relationship family (§6).** `b` is the first editorial relationship encoded as a single-char tag rather than a relationship-descriptor event. It is distinct from the others:

| Relationship | Posture | Liveness | Override | Implies `IS_A_SUPERSET_OF`? |
|---|---|---|---|---|
| `REFERENCES` (concept-level) | non-committal bookmark ("may pull later") | — | — | no |
| `IMPORT` | absorb the parent's elements; **importer** authoritative | snapshot/pull | agreement, not override | **yes** |
| `SUPERCEDES` | replace the parent with mine | — | — | no |
| **`b` / `INHERITS_FROM`** | **defer; parent stays authoritative** | **live (re-resolved each read)** | **first-class "unless stated"** | **no** |

**Trust-coupling (intrinsic to live deference).** Inheriting from a parent means inheriting its *future* edits and trust trajectory — if the parent drifts or is compromised, the child's effective definition drifts silently. The escape hatch is built in: the child's overrides pin what it wants fixed, and re-publishing the `b` tag (a different parent, or a future divergence type) detaches it. PoV/GrapeRank re-gate visibility on every resolution.

**Direction principle / reserved `B`.** Per §23's convention, lowercase `b` = child-claims-parent. Uppercase **`B`** is **reserved** (not assigned) for a future parent-claims-child / federation inverse — e.g. a parent recognizing a child as "the same community." Do not assign speculatively.

See ADR 0027 for the full rationale, the rejected alternatives (folding into `IMPORT`; multi-char tags), and the deferred design questions.

---

*This document is maintained by the development team. When making significant architectural changes, update this file.*
