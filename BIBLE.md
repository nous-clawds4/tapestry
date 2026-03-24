# Tapestry Bible

> **Audience:** AI agents and developers joining the Tapestry project.
> Read this file to fully onboard — it covers what Tapestry is, how it works, what's been built, what's in progress, and how to contribute.

**Last updated:** 2026-03-10

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

| Repo | URL | Active Branch | Description |
|------|-----|---------------|-------------|
| **tapestry** (server) | `github.com/nous-clawds4/tapestry` | `concept-graph` | Docker stack: strfry + Neo4j + Express + React UI + firmware |
| **tapestry-cli** | `github.com/nous-clawds4/tapestry-cli` | `main` | CLI tool for graph operations |

> **Important:** All active development on the server is on the `concept-graph` branch, not `main`.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────┐
│                Docker Container                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  strfry   │  │  Neo4j   │  │   Express    │  │
│  │  (relay)  │  │  (graph) │  │  (API + UI)  │  │
│  │  :7777    │  │  :7687   │  │  :80         │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│        │              │              │           │
│        └──────────────┼──────────────┘           │
│                       │                          │
│              ┌────────┴────────┐                 │
│              │    nginx (:80)  │                 │
│              │  reverse proxy  │                 │
│              └─────────────────┘                 │
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │
                   Port 8080 (host)
```

### Services

| Service | Port | Role |
|---------|------|------|
| **strfry** | 7777 (internal WS) | High-performance C++ nostr relay. Local event store — source of truth for raw nostr events. |
| **Neo4j** | 7474 (HTTP), 7687 (Bolt) | Graph database. Turns flat events into a navigable concept graph with labeled nodes and typed relationships. |
| **Express** | 80 (internal) → 8080 (host) | REST API server. Serves the React UI at `/kg/`, provides all API endpoints. |
| **nginx** | 80 (internal) | Reverse proxy routing `/api/*` to Express, WebSocket to strfry, etc. |
| **supervisord** | — | Process manager inside the container. Controls all services. |

### Docker Volumes

| Volume | Mount | Purpose |
|--------|-------|---------|
| `tapestry-neo4j` | `/var/lib/neo4j/data` | Neo4j database |
| `tapestry-strfry` | `/var/lib/strfry` | strfry LMDB event store |
| `tapestry-data` | `/var/lib/brainstorm` | App data + user settings |
| `tapestry-logs` | `/var/log/brainstorm` | Logs |

### Data Flow

```
External relays ──strfry sync──→ strfry (local) ──import──→ Neo4j (graph)
                                      ↑                         ↑
                                Express API ←──── React UI (browser)
                                      ↑
                                  NIP-07 signing (nos2x / Alby)
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
    v0.0.1/          ← current version
  active/             ← symlink to current version
```

The server reads from `firmware/active/` at runtime.

### What Firmware Defines

The v0.0.1 manifest (`manifest.json`) contains:

- **11 relationship types** (CLASS_THREAD_INITIATION, CLASS_THREAD_PROPAGATION, CLASS_THREAD_TERMINATION, CORE_NODE_JSON_SCHEMA, CORE_NODE_PRIMARY_PROPERTY, CORE_NODE_PROPERTIES, CORE_NODE_PROPERTY_TREE_GRAPH, CORE_NODE_CORE_GRAPH, CORE_NODE_CONCEPT_GRAPH, PROPERTY_MEMBERSHIP, PROPERTY_ENUMERATION)
- **24 concepts** organized by category:
  - **Core (8):** superset, concept-header, primary-property, properties-set, json-schema, property-tree-graph, core-nodes-graph, concept-graph
  - **Graph-theoretic (6):** node-type, relationship, relationship-type, graph-type, word, graph
  - **Graphs (5):** graph, property-tree-graph, core-nodes-graph, concept-graph, tapestry
  - **Other:** set, property, json-data-type, list, validation-tool, validation-tool-type, image, image-type, image-validation-script
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
| POST | `/api/strfry/publish` | Sign and publish an event |
| GET | `/api/strfry/router-status` | Router sync status |
| POST | `/api/strfry/router-toggle` | Enable/disable a sync stream |
| POST | `/api/strfry/wipe` | Wipe all strfry events (dangerous!) |

### Auth (NIP-07)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Get a challenge for NIP-07 signing |
| POST | `/api/auth/login` | Submit signed challenge, get session |
| GET | `/api/auth/status` | Check current auth status |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/user-classification` | Get user role (owner/customer/guest) |

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

**Dev server:** `http://localhost:5173/kg/` (Vite, proxies API to :8080)
**Production:** `http://localhost:8080/kg/` (Express serves built files)

### Page Hierarchy

```
/kg/                              Dashboard (Getting Started + stats)
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
├── nodes/                        Neo4j node browser
│   └── :uuid/                    Node detail (tabs):
│       ├── (overview)
│       ├── json                  JSON data
│       ├── concepts              Which concepts this node belongs to
│       ├── relationships         Neo4j relationships
│       ├── neo4j                 Raw Neo4j data
│       └── raw                   Raw nostr event
├── events/                       Event browser
│   └── dlist-items/:id/          DList item detail
├── users/                        Nostr user directory
│   └── :pubkey                   User profile
├── relationships/                Relationship browser
├── trusted-lists/                Trusted lists
├── manage/                       Management tools
│   └── audit                     Audit dashboard
├── about/                        About page
└── settings/                     Settings (owner only)
    ├── (general)
    ├── relays                    Relay configuration
    ├── databases                 Database management
    ├── uuids                     Concept UUID config
    ├── firmware                  Firmware explorer
    └── system                    System settings
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

---

## 14. Configuration

### Environment Variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OWNER_PUBKEY` | ✅ | Hex pubkey of the instance owner |
| `NEO4J_PASSWORD` | ✅ | Neo4j database password |
| `DOMAIN_NAME` | No | Domain name (default: `localhost`) |

### Two-Layer Settings

```
defaults.json (shipped with code, git-tracked) + settings.json (user overrides, persistent volume) = merged config
```

Arrays are **replaced**, objects are **deep-merged**.

### brainstorm.conf

Legacy server config at `/etc/brainstorm.conf` inside Docker. Contains:
- `BRAINSTORM_RELAY_PRIVKEY` / `BRAINSTORM_RELAY_PUBKEY` — Tapestry Assistant keypair
- `BRAINSTORM_OWNER_PUBKEY` — Owner pubkey
- Neo4j connection details
- Session secret

### Tapestry Assistant

Each instance has a server-side nostr identity (the "TA") used for automated actions. Its keypair lives in `brainstorm.conf`. The TA signs events when creating concepts, firmware, core nodes, etc.

### Router Presets

Strfry sync streams are configured in `setup/router-presets.json`. All streams default to disabled. Toggle via `POST /api/strfry/router-toggle`.

---

## 15. Development Workflow

### Quick Start

```bash
# 1. Clone both repos
git clone https://github.com/nous-clawds4/tapestry.git
git clone https://github.com/nous-clawds4/tapestry-cli.git

# 2. Start the server
cd tapestry && git checkout concept-graph
cp .env.example .env   # edit OWNER_PUBKEY and NEO4J_PASSWORD
docker compose up -d

# 3. Start the React dev server (optional, for UI development)
cd ui && npm install && npx vite --host
# → http://localhost:5173/kg/

# 4. Install the CLI
cd ../tapestry-cli && npm install && npm link
tapestry status
```

### Dev Mode (bind-mount code)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Server code changes are reflected after:
```bash
docker compose exec tapestry supervisorctl restart brainstorm
```

### Building for Production

```bash
cd ui && npm run build   # outputs to ui/dist/, served by Express at /kg/
```

### Docker Rebuild (after server-side changes)

```bash
docker compose build tapestry && docker compose up -d tapestry
```

### Useful Commands

```bash
# Service status inside container
docker compose exec tapestry supervisorctl status

# Run Cypher
docker compose exec tapestry bash -c "echo 'MATCH (n) RETURN count(n)' | cypher-shell -u neo4j -p <password>"

# Scan strfry
docker compose exec tapestry strfry scan '{"kinds":[39998]}'

# Sync from DCoSL relay
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' --dir down
```

---

## 16. What's Been Built

### Server (tapestry repo, concept-graph branch)

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
- ✅ Settings page (relays, databases, UUIDs, firmware explorer, system)
- ✅ Firmware v0.0.1 (24 concepts, 11 relationship types, elements, sets)
- ✅ Firmware install process (two-pass)
- ✅ All normalize/audit API endpoints
- ✅ Server-side signing via TA key
- ✅ Strfry router with presets and toggle
- ✅ Word-wrapper JSON format for all node types
- ✅ Getting Started onboarding checklist on Dashboard

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

- **DList import flow** — just completed (3 import modes from Simple Lists page)
- **JSON validation** — audit validates core node JSON against firmware schemas; element validation against concept schemas exists but needs polish
- **Visualization tab** — two views implemented:
  - **Organization (Sets):** vis-network graph of class threads (Header → Superset → Sets → Elements). Toggle implicit HAS_ELEMENT edges on/off. Wind affects sets only (mass differentiation).
  - **Property Tree:** vis-network graph of property tree (JSON Schema → Primary Property → properties). Wind blows left to spread the tree horizontally.

---

## 18. What's Yet To Be Built

### Near-Term

- [ ] **Element JSON validation against concept schemas** — full validation pipeline in the audit
- [x] **Concept Graph visualization** — vis-network rendering of class threads and property trees (both views implemented)
- [ ] **Pruning UI** — standalone pruning buttons exist on Health Audit; consider auto-prune after firmware install
- [ ] **GrapeRank integration** — trust scores for WoT-weighted curation
- [ ] **Loose consensus demonstration** — show how two users' WoTs converge on shared definitions
- [ ] **IMPORT/SUPERCEDES UI** — buttons to import or supercede another user's concept
- [ ] **Continuous normalization monitoring** — run checks on heartbeat/cron, alert on violations
- [ ] **Multi-user support** — different views based on trust scores
- [ ] **Client-side signing flow** — server returns unsigned event templates, client signs via NIP-07, posts back

### Medium-Term

- [ ] **Firmware Layer 2** — firmware defines structure too, code becomes generic interpreter
- [ ] **NIP-85 trusted assertions** — publish curated lists as NIP-85 events
- [ ] **Cross-instance federation** — multiple Tapestry instances syncing and discovering each other's concept graphs
- [ ] **SALUD protocol integration** — health data structured via tapestry concepts
- [ ] **Search** — full-text search across concepts, elements, properties

### Long-Term

- [ ] **Grapevine integration** — full PageRank-style trust scoring applied to concept curation
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
| **GrapeRank** | "PageRank for people" — contextual trust scoring algorithm. |
| **Grapevine** | The Web of Trust system that determines which curations achieve community consensus. |
| **IMPORT** | Editorial relationship: "I agree with your concept and want to benefit from your curated elements." |
| **Loose Consensus** | When two users' WoTs overlap enough to converge on the same definition without central coordination. |
| **NIP-07** | Nostr browser extension signing standard. Used for authentication. |
| **Normalization** | The process of ensuring the concept graph follows structural rules. |
| **SUPERCEDES** | Editorial relationship: "I've evaluated your definition and chosen to replace it with mine." Non-destructive. |
| **Tapestry Assistant (TA)** | Server-side nostr identity that signs automated events. |
| **Word-wrapper** | The canonical JSON format where every node's data includes a `word` section plus type-specific sections. |
| **z-tag** | The `z` tag on a ListItem that points to its parent concept's a-tag. Fundamental parent pointer. |

---

*This document is maintained by the development team. When making significant architectural changes, update this file.*
