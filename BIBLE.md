# Tapestry Bible

> **Audience:** AI agents and developers joining the Tapestry project.
> Read this file to fully onboard — it covers what Tapestry is, how it works, what's been built, what's in progress, and how to contribute.
>
> Specifics of the reference deployment at `tapestry.brainstorm.world` (deploy targets, droplet specs, CI/CD workflows, branch protection ruleset, active team, tracking issues, operational gotchas we've hit) live in a sibling document: [OPERATIONS.md](./OPERATIONS.md). If you're forking this repo to run your own instance, BIBLE is the doc you want — OPERATIONS describes someone else's running instance.

**Last updated:** 2026-08-17 (content: §3 "The wider estate" — names the NosFabrica production repos and the shared `NosFabrica/protocols` spec repo (whose `ECOSYSTEM.md` is the canonical estate inventory); closes the gap where the sanctioned onboarding path never mentioned the production half of the estate — estate-wiring; prior: §31 The Self and Its Keys — ratifies the instance-identity doctrine (the TA pubkey is the instance's "me"; the Owner a distinct correspondent; absorption explicit, chosen per feature) + §30 cross-ref + §16 changelog row — self-ontology #2 / ADR 0002, F0 of the shared-concepts-adoption book; prior: §6 tapestry elements author `word` + brain-first authoring note (misdiagnosis corrected), §16 changelog row — brain-first-tapestry-authoring book / ADR tapestries/0007; prior: §30 The Self and Its Stores — ratifies the self ontology (Neo4j = the definitive "me"; LMDB = subordinate cache; events = "letters") plus the binding obligations it creates — self-ontology #1 / ADR 0001; prior: §29 Derived-JSON Store — documents the standalone tapestry-store LMDB layer (`tapestryKey` + `lmdb:` pointers), alongside a `handlePut` await fix; §6 graph-embedding convention + §13 Tapestries area + §16 changelog — tapestries book; §11 relationship primitives + probe, §13 set-detail route + owner placement affordances — graph-curation-ui / relationship-primitives)

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
23. [Class Thread Relationships (`n`, `s`)](#23-class-thread-relationships-n-s)
24. [Task Queue (BullMQ behind /api/run-task)](#24-task-queue-bullmq-behind-apirun-task)
25. [The Inherit-From Tag (`b`)](#25-the-inherit-from-tag-b)
26. [Resolved Definition](#26-resolved-definition)
27. [Point of View (PoV) Resolution](#27-point-of-view-pov-resolution)
28. [Open Ranking (ORE) Provider](#28-open-ranking-ore-provider)
29. [Derived-JSON Store: tapestryKey and the tapestry-store LMDB](#29-derived-json-store-tapestrykey-and-the-tapestry-store-lmdb)
30. [The Self and Its Stores](#30-the-self-and-its-stores)
31. [The Self and Its Keys](#31-the-self-and-its-keys)

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

### The wider estate

Tapestry is the **R&D half of a two-organization estate operated by one team**; the production half lives under [NosFabrica](https://github.com/NosFabrica) (flagship deployment: `brainstorm.world`). Features and protocols are proven here first, then adopted by the production repos. The canonical inventory of the whole estate — every repository, deployment hostname, and role — is [ECOSYSTEM.md in `NosFabrica/protocols`](https://github.com/NosFabrica/protocols/blob/main/ECOSYSTEM.md). The immediate siblings:

| Repo | Role |
|------|------|
| [`NosFabrica/protocols`](https://github.com/NosFabrica/protocols) | Shared protocol specifications — the estate-wide publication tier that specs graduate to from [`protocols/`](./protocols/README.md) here — plus the canonical estate map |
| [`NosFabrica/Brainstorm-UI`](https://github.com/NosFabrica/Brainstorm-UI) | Production web UI |
| [`NosFabrica/brainstorm_server`](https://github.com/NosFabrica/brainstorm_server) | Production backend: event ingest, GrapeRank runs, Trusted Assertion publishing, Vespa profile search |
| [`NosFabrica/brainstorm_graperank_algorithm`](https://github.com/NosFabrica/brainstorm_graperank_algorithm) | The GrapeRank computation (Java worker) |
| [`nous-clawds4/brainstorm-cli`](https://github.com/nous-clawds4/brainstorm-cli) | CLI for LLM agents against the production Brainstorm backend |

### Recommended branch strategy

`main` is the production branch — direct push triggers a deploy via `.github/workflows/deploy-tapestry.yml`. Standard contribution flow uses an intermediate `staging` branch as a verification gate:

```
feat/foo (off staging)
  → PR → staging   → CI auto-deploys to a staging environment
  → verify
  → PR → main      → CI auto-deploys to production
```

Long-lived sandbox branches (e.g. for substantial in-progress features that need their own deploy environment) follow the same pattern: dedicated branch + dedicated workflow + dedicated droplet.

For the specific branches and deploy targets configured in the reference deployment at `tapestry.brainstorm.world` (including `staging`, `feature-magic-carpet`, and a few legacy/parked branches), see [OPERATIONS.md §1–§2](./OPERATIONS.md).

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

**Not a Docker volume — the derived-JSON store.** Separate from strfry's LMDB above, the control panel keeps its own application-level LMDB (the `lmdb` npm package) at `~/.tapestry/lmdb` inside the container, holding derived per-node JSON keyed by each node's `tapestryKey`. It is **not** mapped to a named volume — a rebuildable cache, not a source of truth — so don't confuse it with strfry's event store. See §29.

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

**The wire format is specified in [protocols/drafts/tapestry-concepts.md](protocols/drafts/tapestry-concepts.md) — normative:** event kinds, a-tag addressing, the `z` parent pointer and the Tapestry-layer multi-`z` stamping position (deliberately-published items MAY carry multiple `z` stamps — `community-reference` ADR 0029; the base NIP permits multi-`z` and only *recommends* one per event), kind unification, `json`-tag data storage, the `concept-graph` header tag and its tag-else-compute resolution contract, and the derived-vs-explicit relationships principle. This section covers how this codebase implements it.

- **Addressing:** the a-tag address is stored as the `uuid` property on Neo4j nodes — the primary identifier throughout the system.
- **`concept-graph` tag:** emitted by `create-concept` on every kind-39998 ConceptHeader. The off-relay resolution contract exists because the `IS_THE_CONCEPT_GRAPH_FOR` Neo4j edge is invisible off-relay. ADR 0007, hybrid design C; the consumer is the deferred element/superset materialization stream.
- **Derived relationships:** the graph engine materializes derived (implicit) relationships as Neo4j edges from event structure — see §6 for the data model and relationship inventory.

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
| `REFERENCES` (concept-level) | Non-committal pointer with **two producers**: the firmware-install stub (local Concept Header → an external curator's Concept Header; Neo4j-only, `source:'firmware-community'`) and pointer-typed `b` tags (asserted, wire-derived, `source:'b-tag'`, kinds 39998/39999 — `community-reference` ADR 0029). NOT agreement, NOT `IS_A_SUPERSET_OF`. Disambiguate from the tag-level `REFERENCES` (`NostrEventTag → NostrEvent`, every `e`/`a` tag) by `source` + endpoint labels. See §22. |
| `INHERITS_FROM` | "My definition defers to the parent's, unless I override" — child→parent, live. NOT IMPORT (no absorption), NOT `IS_A_SUPERSET_OF`. Canonical (no `source`). Encoded as the **inherit-typed** single-char `b` tag (`["b",…,"inherit"]` — explicit; pointer-typed or untyped `b` derives `REFERENCES` instead, `community-reference` ADR 0029), not a descriptor event. See §25. |

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

### Graph-embedding convention (Tapestries)

A **Tapestry** (`39998:<TA>:tapestry`) is a subset of Graph — "a graph of concept graphs." Its elements are self-describing: a tapestry element (kind-39999) carries a top-level **`graph`** block alongside `tapestry` — and, since tapestries #7 (ADR 0007), newly authored elements also carry a top-level **`word`** section (`{slug, name, wordTypes}`, mirroring the word deriver's defaults). Legacy elements may lack `word`; readers must tolerate both shapes, and the republish builders pass unknown top-level sections through without retrofitting:

- `nodes` — the member concepts / supersets / synthetic property nodes (`{slug, uuid?, name?}`)
- `relationshipTypes` — `{slug (semantic, e.g. CLASS_THREAD_PROPAGATION), alias (Neo4j edge label, e.g. IS_A_SUPERSET_OF)}`
- `relationships` — the asserted integrations `{nodeFrom, relationshipType, nodeTo}` (referenced by slug)
- `imports` — the member concepts' `*-concept-graph` core nodes, resolved at read time

The Tapestries UI (§13) renders this **as-authored**: it reads the element — and resolves its `imports` — from **strfry** (the shipped read-side convention, ADR tapestries/0001). Authoring, however, is **brain-first** since tapestries #7 (ADR 0007, per §30): the shared publish endpoint imports the instance's *own* tapestry letters into Neo4j in the same request — ListItem label, `HAS_ELEMENT` placement, `tapestryKey`, derived LMDB doc — so owner-authored elements exist in the brain from creation. (The earlier "a reconcile drops tapestry elements" reading, `OPEN.md` #88, was a misdiagnosis — no pruning mechanism ever existed; elements were simply never written to Neo4j. See #136.) Flipping the *read* source to the brain awaits the general letter ingest (#136 stage 2); third-party letters still publish permissionlessly and are not brain-imported until that ingest defines provenance. The curator-facing authoring UX remains an open product question — see `engineering-team/audits/tapestries/prd-seed.md`.

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

**The format is specified in [protocols/drafts/tapestry-concepts.md](protocols/drafts/tapestry-concepts.md) → "The word-wrapper format" — normative** (structure, the `word` block, type-specific keys, worked examples). In this codebase, all core nodes and firmware concepts carry word-wrapper JSON in their `json` tag; firmware schemas validate it at install time (§7).

A node's `json`-tag value may be held **inline** (as above) or **offloaded** to the derived-JSON LMDB store as an `lmdb:<tapestryKey>` pointer, resolved transparently on read (§29). That is a local storage detail; the wire format is unchanged.

---

## 9. Core Nodes of a Concept

**The 8-core-node scheme and the core-node wire shape are specified in [protocols/drafts/tapestry-concepts.md](protocols/drafts/tapestry-concepts.md) → "Core nodes of a concept" — normative.** In this deployment the well-known core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`) are firmware-published (§7), and core-node `z` tags point at those firmware concept handles.

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
| **2** | Every ListItem MUST have at least one valid parent pointer (z-tag) |
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
| POST | `/api/normalize/add-relationship` | Add ONE typed edge `(fromUuid)-[relType]->(toUuid)` between two existing nodes — strfry-free reference-graph edit; owner-gated; relType whitelist `HAS_ELEMENT`/`IS_A_SUPERSET_OF` (either spelling); idempotent (`created`/`already-existed`); graph-changing success carries a firmware-install-overwrite hazard `note` |
| POST | `/api/normalize/delete-relationship` | Delete that same single typed, directed edge — same gate/whitelist/idempotency (`deleted`/`not-found`), same hazard `note` |
| GET | `/api/normalize/relationship-primitives` | Read-only, credential-free deployment probe advertising the two primitives (registration evidence, not health) |
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
| POST | `/api/neo4j/query` | Run Cypher query. Reads are public; writes require owner/local-trusted auth (see §Auth). |
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
| GET | `/api/get-follows-hops?source=<x>&target=<y>` | Live **directed** FOLLOWS shortest-path hop distance from `source` to `target` (`shortestPath`, cap 20) via the pooled Bolt driver with a ~2.5s query timeout. `{ success, hops }` where `hops` is `0..20`, or `null` when no path within the cap. `400` on a non-64-hex pubkey. Public. Pubkeys bound as params. Backs the profile **HOPS** stat (#38). |
| GET | `/api/get-follows-hops-paths?source=<x>&target=<y>` | Up to 25 equally-short directed FOLLOWS paths (`allShortestPaths`, cap 20, `LIMIT 25`), each an ordered node list `[{ pubkey, influence }]` (Owner-PoV `influence` → per-card rank). `{ success, hops, paths, truncated }`; `{ hops:null, paths:[] }` when unreachable; self-view → a single-node path with `hops:0`. Public. Backs the follows-hops path page (#39). |
| GET | `/api/owner/pubkey` | The instance owner's hex pubkey. Public, no auth. Mirrors `/api/assistant/pubkey` for the TA. Read at app mount via `ConfigContext`. |
| GET | `/api/owner-info` | Owner pubkey plus npub and domain name. Public. Pre-existing endpoint kept alongside the more focused `/api/owner/pubkey`. |
| GET | `/api/relays` | The configured `aRelays` object from settings. Public. UI components read this via `ConfigContext` instead of hardcoding relay arrays. |

### Notes & Events (read paths)

Public, read-only kind-1 read paths sharing the `enrichNotes` item shape (§13) and the general-purpose relay-set sourcing (slug-from-TA, hardcoded fallback). All additive; no writes.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feed` | Live Feed read path — recent kind-1 from the source identity's follows (see changelog / `feedReadPath.js`). `status` ∈ {OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE} + `relaySource`. Public. |
| GET | `/api/user/:pubkey/notes?limit=<n>` | The N most-recent kind-1 authored by `:pubkey`, newest-first (cap 50), fetched from the general-purpose relays, enriched from local kind-0. `status` ∈ {OK, EMPTY, INVALID}; INVALID (malformed pubkey) → 400. Backs the profile **Content** section (limit 1) and the **`/user/:pubkey/notes`** page (limit 50). `src/api/notes/userNotesReadPath.js`. Public. |
| GET | `/api/event?id=<hex>&author=<hex>&relays=<csv>` | Resolve a single kind-1 by event `id`, or (by `author`) the author's most-recent kind-1, across a relay **union** = supplied hints + the author's NIP-65 (kind-10002) outbox write relays + the well-known set/fallback. `verifyEvent` + kind-gate. `status` ∈ {OK, UNSUPPORTED_KIND, INVALID_EVENT, NOT_FOUND, NO_AUTHOR_NOTE, INVALID}; INVALID → 400. Backs the **`/event`** view (the client decodes the six nevent/id/naddr/pubkey/npub/nprofile formats and passes id/author + hints). `src/api/event/eventReadPath.js`. Public. |

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
├── feed                          Live Feed — public kind-1 notes from the source identity's follows
├── user/:pubkey/notes            Per-user notes — the 50 most-recent kind-1 by that user
├── event                         Single-event view (kind-1) — nevent/id/naddr/pubkey/npub/nprofile + search fallback
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
│       │   └── :elemUuid         Element detail (owner: Placements panel — move/add/remove)
│       ├── properties/           Property list
│       │   └── new               Create property
│       ├── dag/                  Organization (Sets) view (owner: per-row Place/move…)
│       │   ├── new-set           Create set
│       │   └── :setUuid          Set detail — supersets/subsets/elements (owner: add to set, remove direct placements)
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
├── tapestries/                   Tapestries — View Tapestries directory (elements of the tapestry concept, read from strfry)
│   ├── new                       Create New Tapestry (inert placeholder; create/edit authoring deferred)
│   └── :uuid                     Tapestry Exploration — concept sidebar + integration graph + enum/element/subset tables + JSON (as-authored: element graph block + resolved imports)
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
| `NoteCard` | `components/NoteCard.jsx` | **Shared kind-1 note unit** — avatar + author link + relative time + actions menu + content. Reused by every note surface (see "Shared note rendering"). |
| `NoteContent` | `components/NoteContent.jsx` | Renders note text, linkifying NIP-21 `nostr:` entities (mentions → `/user/<pk>`, events → `/event?…`) |
| `NoteActionsMenu` | `components/NoteActionsMenu.jsx` | Per-note `⋯` menu (copy link / nevent / event id; tag stub) |
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

### Shared note rendering (kind-1)

Every surface that shows kind-1 notes composes **one** rendering unit and **one** server
enrichment, so a per-note improvement is made once instead of per-surface. This split is
the load-bearing decision — honor it when adding new note surfaces.

- **Client — `NoteCard` (`components/NoteCard.jsx`).** Pure presentational: it takes an
  already-enriched note `item` and renders the whole card (avatar + author-profile link +
  relative timestamp w/ exact time on hover + `NoteActionsMenu` + `NoteContent`). No data
  fetching, no read logic. Markup uses surface-neutral `bsp-note-card-*` classes (not
  `bsp-feed-*`) so non-feed surfaces reuse it without inheriting feed styling. Layout
  variants arrive as explicit props, never forks.
- **Server — `enrichNotes(notes, scanStrfry)` (`src/api/_shared/noteEnrichment.js`).**
  Turns raw kind-1 events into the item shape every read path serves, resolving author +
  mention display names from **local kind-0 only** (one scan covers both; bounded by
  `PROFILE_LOOKUP_CAP`). Read paths differ only in how they **select** raw events; they
  all call `enrichNotes`.

**The enriched note item shape (the contract):**

```
{ id, pubkey, createdAt, content,
  author:   { displayName, avatar },          // local kind-0; null when not held locally
  mentions: { <pubkey>: <displayName> } }       // resolved nostr:npub/nprofile refs (others omit → UI shows truncated npub)
```

**POV boundary.** Display names are self-asserted kind-0 metadata — **not** POV-dependent —
so `enrichNotes` resolves them globally (mirrors author enrichment, consistent with the
WoT-score namespacing rule above where only `wot_*_<suffix>` columns are POV-scoped). A
*POV-dependent* decoration (e.g. "is this mentioned/replied-to author in **my** WoT?") must
take the POV/source as a parameter and compute per-view — never bake a global answer into
the shape. See the architecture invariants in `CLAUDE.md` (POV-first; filter at view time).

**Consumers (all reuse `NoteCard` + `enrichNotes`):** the Live Feed (`/feed`); the profile
**"Content"** section (the viewed user's most-recent kind-1, at the bottom of `/user/:pubkey`);
the per-user **`/user/:pubkey/notes`** page (their 50 most-recent); and the single-event
**`/event`** view. The latter three select raw events *by author* / *by id* rather than by a
follow list, but run the same `enrichNotes` and render the same `<NoteCard>`. Their read paths
(`src/api/notes/userNotesReadPath.js`, `src/api/event/eventReadPath.js`) share the
general-purpose relay-set sourcing via `src/api/_shared/relaySource.js` (the `/event` path adds a
NIP-65 outbox leg + on-fetch `verifyEvent`); see the API Reference "Notes & Events" rows and the
changelog. Future per-note features (reposts, reply indicators, event tags) extend `NoteCard` +
`enrichNotes` once. *(Note: `feedReadPath.js` and `userNotesReadPath.js` still carry private
copies of the relay-sourcing helpers pending the consolidation tracked in
`engineering-team/follow-ups.md`.)*

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

> **Precomputed (above) vs. live, on-demand distance.** The `hops` node property is owner-rooted and batch-computed. Separately, the public profile UI computes **live** directed-FOLLOWS distance between an *arbitrary* `(source, target)` pair on demand — `shortestPath` for the count (HOPS stat #38, `GET /api/get-follows-hops`) and `allShortestPaths` (cap 20, `LIMIT 25`) for the path page (#39, `GET /api/get-follows-hops-paths`) — both via the pooled Bolt driver with a short query timeout and the pubkeys bound as parameters. The source is the logged-in viewer (else the owner). This live distance is independent of — and deliberately **not** reconciled with — the precomputed owner-rooted `hops` property above (the profile surfaces both; see the changelog and `OPEN.md` #7).

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

**TA designation on kind 10040 (target — `community-reference` ADR 0031; not yet wired).** A user's kind-10040 event MAY carry a `["39998:dlist-header", "<TA-pubkey>", "<relayURL>"]` entry designating their Tapestry Assistant as the authoring provider for their kind-39998 DList/concept headers — the npub-rooted way to discover a user's TA pubkey. The normative wire form, backward-compat, and the **dual-author header precedence rule** (personal-authored header wins; else the TA-authored header; never recency; freshness via an inherit-typed `b` delegation) are specified in [protocols/drafts/assistant-designation.md](protocols/drafts/assistant-designation.md). **Status today:** the 10040 generators do not yet emit this entry (they rebuild the full tag list from config; a merge-preserve fix is required) and no resolver applies the precedence rule — both are future engineering stories.

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
# See .github/workflows/deploy-tapestry.yml for CI/CD reference
```

### CI/CD Pipelines

GitHub Actions workflows in `.github/workflows/` deploy long-lived branches to dedicated droplets via SSH. Each workflow follows the same shape — pull, port-remap (`sed 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml`), `docker compose up -d --build`, image prune. Secrets follow the convention `DEPLOY_HOST_<NAME>`, `DEPLOY_USER_<NAME>`, `DEPLOY_SSH_KEY_<NAME>`.

The reference deployment at `tapestry.brainstorm.world` runs three such workflows; specifics are documented in [OPERATIONS.md §1, §3](./OPERATIONS.md).

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

certbot --nginx -d tapestry.brainstorm.world
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
- ✅ Verified-followers count + followers table on `/user/:pubkey` (2026-06-06, staging) — the profile counter row now shows a **Verified Followers** count beside Following (#33; reads the PoV-resolved Meili `wot_verifiedFollowerCount`/`followers`, House PoV default + `?pov=`), and that count links to a new **`/user/:pubkey/followers`** table (#34) — the inbound mirror of the follows list (#29), backed by `GET /api/get-grapevine-followers` (owner-POV; inbound `(follower)-[:FOLLOWS]->(observee)` filtered to verified `influence > VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`; whole-set + client 50/page; per-query 504 deadline). ADRs `engineering-team/decisions/profile/0029` + `0030`. On staging; later promoted to prod. Known limit: the inbound traversal for the very largest accounts (~23k+ verified) can hit the 15s deadline → intermittent graceful 504 (optimization deferred — see `docs/PROFILE_FOLLOWERS_HANDOFF_2026-06-06.md`).
- ✅ Verified-reporters count + reporters list on `/user/:pubkey` (2026-06-07, staging) — the profile counter row shows a **Verified Reporters** count beside Verified Followers (the NIP-56 report mirror of the followers count; verified-reporters #1), linking to a new **`/user/:pubkey/reporters`** table (#3) backed by `GET /api/get-grapevine-reporters` (#2; `(reporter)-[:REPORTS]->(observee)` filtered to verified, Owner PoV). ADRs `engineering-team/decisions/verified-reporters/0001`–`0003`.
- ✅ Profile verified counts moved to **Owner PoV** + verification explainer + dynamic reporter alarm (2026-06-08, staging) — the profile **Verified Followers / Verified Reporters** counts now read from Neo4j (Owner PoV) so the badge agrees with its list table, dropping the broken raw-follower Meili fallback (#35, ADR `profile/0031`); a shared **"What does verification mean?"** popover (profile + `/reporters`) shows the configured cutoff ×100 + owner name/avatar, and the Verified Reporters badge shows a red 🚩 alarm only past a popularity-adjusted threshold (`vr ≥ 3 + floor(vf/750)`) (#36, ADR `profile/0032`). The point-of-view model these counts use is the three-PoV standard ratified in **§27** (ADR `pov-resolution/0033`). On staging; later promoted to prod.
- ✅ Report Type + Reported columns on `/user/:pubkey/reporters` (2026-06-15, prod) — the reporters table now surfaces each NIP-56 report's `report_type` (humanized label) and `timestamp`, read from the `REPORTS` edge (`GET /api/get-grapevine-reporters` extended to return `rel.report_type` + `rel.timestamp` per edge). Default columns → **Picture / Report Type / Rank**; the **Reported** column shows relative "Xd, Yh ago" text but sorts by the **raw unix integer** (new opt-in `sortValue(row)` accessor on the shared `DataTable`, missing values sorted last in both directions — the existing string/`localeCompare` path is unchanged for all other consumers); a **"N reporters, M reports"** summary distinguishes distinct reporters from reports. Report-centric — one row per `REPORTS` edge, no client-side de-duplication (so duplicate-edge bugs stay visible). verified-reporters #4, ADR `verified-reporters/0004`.
- ✅ Live Feed at `/feed` (2026-06-15, prod) — a public, login-free, read-only feed of the most recent (≤50) kind-1 notes from the accounts the **source identity** follows (the logged-in user, else the House PoV identity), newest first. Follow list (kind-3) read from local strfry; followed authors' notes from the configured general-purpose relays; author name/avatar from local kind-0/Meilisearch. Additive and read-only — adds `GET /api/feed` (the read path) + the `/feed` page; no writes/publishes, no firmware/ranking/search changes. Intended as the host surface for a later tagging book. Direction-mode book; ADRs `live-feed/0001` (read path) + `0002` (page).
- ✅ Live Feed enhancements + shared note module (2026-06-18, staging) — a batch of additive `/feed` improvements, all behind the read path's existing contract: (1) author name/avatar link to `/user/<pubkey>`; (2) a per-note `⋯` actions menu (copy note link / nevent / event id; tag-event stub) + a placeholder `/event` page (`?id=`/`?nevent=`/`?naddr=`); (3) relative "time ago" timestamps (two y/d/h/m units, "just now" sub-minute, exact time on hover) reusing a parameterized `formatTimeAgo`; (4) NIP-21 `nostr:` entity linkification in note text (`npub/nprofile`→`/user`, `note/nevent/naddr`→`/event`; `nsec` never linkified); (5) mention **display-name** resolution (`@alice`, not `@npub1…`) resolved server-side in the read path from local kind-0. Then a **behavior-preserving refactor** extracted the shared seams so the two planned new note surfaces and future per-note features land once: client `NoteCard` + server `enrichNotes` (`src/api/_shared/noteEnrichment.js`) — see §13 "Shared note rendering". Staging only; prod promotion not yet done.
- ✅ Follows-hops **HOPS** stat on `/user/:pubkey` (2026-06-17, staging) — the profile counter row shows a **HOPS** value between Verified Followers and Verified Reporters: the **live, directed** FOLLOWS shortest-path distance from the source (logged-in viewer, else the **Owner** — not the House PoV) to the viewed profile. Computed on demand via `shortestPath((src)-[:FOLLOWS*..20]->(tgt))` through the pooled Bolt driver (~2.5s timeout, pubkeys bound) — **no** precomputed value, deliberately not reconciled with the owner-rooted `hops` property (§ Graph Algorithms). Loads async (own hook); renders **∞** for no-path-within-cap, **0** for self-view, and a non-misleading "—" on lookup error/timeout (never a false ∞). New public `GET /api/get-follows-hops`. profile #38, ADR `profile/0034`. On staging; **prod promotion held** (co-promotes with the tags bundle). Note: a second "Hops" figure also exists in the Reputation grid (precomputed, owner-rooted) — PoV reconciliation deferred (`OPEN.md` #7).
- ✅ Follows-hops **path page** + HOPS link activation (2026-06-17, staging) — the HOPS stat becomes a link to a new **`/user/:pubkey/follows-hops`** page showing one shortest follow-path as a vertical chain of profile cards (picture, name, Owner-PoV rank = `round(influence×100)`), ordered source→target, with a **re-roll** button that swaps in a random one of the equally-short paths (shown only when >1 exists). Backed by new public `GET /api/get-follows-hops-paths` (`allShortestPaths`, cap 20, `LIMIT 25`, returning up to 25 ordered `[{pubkey,influence}]` paths + a `truncated` flag); the client re-rolls client-side over the returned set. profile #39, ADR `profile/0035`. On staging; held with #38.
- ✅ Note surfaces — profile "Content" section + per-user `/user/:pubkey/notes` (2026-06-19, staging) — two read-only surfaces showing a *viewed user's own* kind-1 notes (no follow list, no PoV), reusing the shared `NoteCard` + `enrichNotes` seam (§13): a **"Content"** section at the bottom of `/user/:pubkey` showing the single most-recent note (empty state when none located) + a link, and a **`/user/:pubkey/notes`** page showing the 50 most-recent. New by-author read path **`GET /api/user/:pubkey/notes?limit=`** (`src/api/notes/userNotesReadPath.js`; `status` OK/EMPTY/INVALID; notes from the general-purpose relays, enriched from local kind-0). Additive; no firmware/ranking/search change. epic `note-surfaces`, ADRs `note-surfaces/0001` (read path) + `0002` (surfaces). Staging only; prod promotion not yet done.
- ✅ Event page — working `/event` single-event view (2026-06-19, staging) — replaces the placeholder. Resolves **kind-1** from six identifier formats (**nevent, id, naddr, pubkey, npub, nprofile**; precedence in that order), with a search-field fallback when no valid param. `nevent`/`id` → fetch the event (non-kind-1 → "kind N not yet supported"; fails verification → "does not validate"; valid → render like `/feed`); `pubkey`/`npub`/`nprofile` → the author's most-recent kind-1; `naddr` → "kind N not yet supported" from the coordinate (no fetch). New **`GET /api/event`** (`src/api/event/eventReadPath.js`): relay **union** = embedded hints + the author's NIP-65 (kind-10002) **outbox** write relays + well-known set/fallback; on-fetch `verifyEvent` (via a no-verify pool so the distinct does-not-validate outcome is reachable) + kind-gate; reuses `enrichNotes`. Introduced `src/api/_shared/relaySource.js` (extracted relay-sourcing; feed/user-notes re-point deferred — `follow-ups.md`). Additive; no firmware change. epic `event-page`, ADRs `event-page/0001` (read path) + `0002` (page UI). Staging only; prod promotion not yet done.
- ✅ Tapestries — browse & explore (2026-07-24, prod) — a public, read-only surface for **Tapestries** (curated collections of concepts; a Tapestry is a subset of Graph — "a graph of concept graphs"). A "🧵 Tapestries" nav group under Nostr Users → **View Tapestries** (directory of every element of the `tapestry` concept) + **Create New Tapestry** (inert placeholder; create/edit authoring deferred). Each row opens a per-tapestry **Exploration page** (`/tapestry/tapestries/:uuid`) modeled on the Firmware Explorer's read-only views — concept sidebar + vis-network integration graph + enumerations/elements/subsets tables + JSON viewer — rendered **as-authored** from the element's own `graph` block plus one-level-resolved `imports` (see §6 "Graph-embedding convention"). Reads tapestry elements from **strfry** via the existing `GET /api/strfry/scan` (not Neo4j — a reconcile drops tapestry elements; `OPEN.md` #88); additive, **no new backend/endpoints, no new deps** (vis-network already bundled); route by uuid (a-tag coordinate). epic `tapestries` (stories #1–#2), ADRs `tapestries/0001` (strfry read) + `0002` (as-authored render). Shipped staging (#438) + prod (#440).
- ✅ Brain-first tapestry authoring (2026-08-05, staging) — tapestry authoring writes the brain, per §30: a scoped post-import hook in `POST /api/strfry/publish` imports the instance's **own** tapestry letters (kind-39999, z-tagged to this instance's `tapestry` concept, authored by the TA or owner — both runtime-resolved) into Neo4j in the same request — event node + tags, `ListItem` label, `HAS_ELEMENT` placement under the tapestry Superset, `tapestryKey` (assigned once, §29), and the derived LMDB doc (cache invalidated pre-derive so republishes re-derive from the brain's fresh json). Response gains an additive `brainWrite` field; a hook failure is reported alongside publish success, never conflated (the letter cannot be unsent). Create drafts now author **`word`** alongside `tapestry`+`graph` (§6); republish builders pass it through and never retrofit legacy letters. Third-party client-signed publishing stays permissionless with **no** brain import (stage-2 ingest's lane, OPEN.md #136). Ends the split-brain where View Tapestries (strfry) listed tapestries the concept's Elements view (Neo4j) said didn't exist. epic `tapestries` story #7, ADR `tapestries/0007`. Staging via PR #489; prod held with the #131 batch.
- ✅ The Self and Its Keys — BIBLE §31 (2026-08-05, staging) — ratifies the instance-identity doctrine (worksheet W15, graduated): the instance is its own person and the **TA pubkey is its key**; the Owner is a distinct, maximally-trusted **correspondent** whose letters enter the brain only by explicit absorption (re-mint or TA-authored pointer, chosen per feature); every first-person query answers `authors:[TA]`. External readers resolving a *human's* headers keep assistant-designation's personal-wins rule byte-unchanged (ratified as a custody-asymmetry security posture); the tapestries-#7 owner lane is ruled an eager near-term absorption, with stage-2 ingest (OPEN.md #136) inheriting the general provenance lane — no permanent "counts as me" carve-out. Docs-only: no code, no wire format, no firmware change. epic `self-ontology` story #2, ADR `self-ontology/0002`. F0 of the `shared-concepts-adoption` book.

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
| **INHERITS_FROM** | Canonical child→parent definitional-inheritance edge from **inherit-typed** `b` tags only (`["b",…,"inherit"]` — explicit; an absent type reads as `"pointer"` and derives no INHERITS_FROM): "I defer to the parent's definition, live, unless I override." Distinct from IMPORT (absorption; implies IS_A_SUPERSET_OF) and REFERENCES (non-committal pointer). No `source`. ADR 0027 as amended by `community-reference` ADR 0029. See §25. |
| **concept-graph (header tag)** | Self-describing tag on a kind-39998 ConceptHeader: `["concept-graph","39999:<pubkey>:<d-tag>-concept-graph"]` (computed). Resolution = tag-if-present else compute the same a-tag. Lets a single fetched Header resolve its full concept off-relay. ADR 0007. See §5. |
| **communityReference** | A firmware-concept field `{ headerATag, relayHints[], knownGoodEventId? }` naming an external curator's published concept — the **seed** of the deployment's affiliation. As of `community-reference` ADR 0034 / `tag-federation` ADR 0002: install **seeds** a `"pointer"`-typed `b` on the TA-authored header (re-signed; never-clobber within a run) and the graph derives `REFERENCES {source:'b-tag'}`; the legacy `firmware-community` stub is skipped for `b`-carrying headers. Applied to `nostr-relay` + `tag`/`nostr-user-tag`/`tag-pinning`. See §22. |
| **grapevine → firmware → none** | The community-reference resolution precedence: the user's Grapevine is the correct selector of "the community's definition"; the firmware-baked pointer is only a cold-start default; else nothing. Mirrors Warm Start's `self → owner → cold`. See §22. |
| **Loose Consensus** | When two users' WoTs overlap enough to converge on the same definition without central coordination. |
| **REFERENCES (concept-level)** | Non-committal pointer edge, two producers: the firmware-install stub (local Concept Header → an external curator's Header; Neo4j-only, `source:'firmware-community'`) and pointer-typed `b` tags (asserted, wire-derived, `source:'b-tag'` — `community-reference` ADR 0029). NOT agreement/import. Overloaded with the tag-level `REFERENCES`; disambiguate by `source` + endpoint labels. See §22. |
| **Meilisearch** | Full-text search engine used for profile search. Runs as a separate Docker container (`nostr-search-meili`). Indexes 2M+ kind 0 profiles with sub-10ms query times. |
| **NIP-05** | Nostr verification standard. A NIP-05 identifier (e.g., `bob@example.com`) is verified by fetching `https://domain/.well-known/nostr.json?name=bob` and checking the pubkey mapping. |
| **NIP-07** | Nostr browser extension signing standard. Used for authentication. |
| **NIP-50** | Nostr search protocol. The nip50-proxy implements this to expose Meilisearch + WoT search via standard nostr WebSocket protocol. |
| **nip50-proxy** | Service inside the tapestry container (port 7780) that sits between nginx and strfry, intercepting search REQs and routing them through Meilisearch. |
| **Normalization** | The process of ensuring the concept graph follows structural rules. |
| **nostr-search-api** | Separate Docker container (port 3069) that handles live profile ingestion from strfry and proxies search queries to Meilisearch. |
| **POV (Point of View)** | The web-of-trust perspective a trust metric is computed relative to. There are exactly **three** — **Owner** (the instance owner's WoT, from Neo4j), **House** (the deployment's house WoT, kind-30382 → Meili), and **Personalized** (the end-user's own WoT). The search page's `house`/`user` toggle + `povSuffix` is the House↔Personalized pair; **Owner** is the Neo4j-sourced perspective (e.g. the profile verified counts + grapevine tables). See **§27 (Point of View (PoV) Resolution)** for the full standard, source map, and selection/fallback model. |
| **povSuffix** | 8-character prefix of the delegated pubkey (`rankAuthor.slice(0, 8)`). Used to namespace WoT score fields in Meilisearch (e.g., `wot_followers_78ed0837`). |
| **rankAuthor** | The hex pubkey of the delegated trust authority whose Trust Assertions (kind 30382) provide WoT scores for a given POV. Stored in user prefs. |
| **SUPERCEDES** | Editorial relationship: "I've evaluated your definition and chosen to replace it with mine." Non-destructive. |
| **Assistant** | A server-side nostr identity that publishes events on behalf of an owner, admin, or customer. The owner's assistant is the Tapestry Assistant (TA); customer assistants are created at sign-up. All stored in SecureKeyStorage. |
| **Tapestry Assistant (TA)** | The owner's assistant — server-side nostr identity that signs automated events (firmware, concepts, kind 30382 Trust Assertions). Stored in SecureKeyStorage as `tapestry-assistant`. |
| **Trust Assertions (TAs)** | Kind 30382 nostr events published by a `rankAuthor` that assign trust scores (rank, followers, etc.) to other pubkeys. Synced via negentropy and loaded into Meilisearch for WoT-powered search. |
| **Warm Start** | An opt-in GrapeRank initialization mode that seeds scorecards from previously-computed scores instead of `[0,0,0,0]`. Three sources in tiered fallback: `self` (customer's own prior scores), `owner` (owner's `NostrUser` scores when the owner is within 3 directed FOLLOWS hops downstream of the customer), and `cold` (no seed available; legacy behavior). Typically cuts customer GrapeRank runtime from ~20 min to ~5 min. |
| **Word-wrapper** | The canonical JSON format where every node's data includes a `word` section plus type-specific sections. |
| **b tag** | Single-char **typed** pointer on a kind-39998/39999 event: `["b","<target-a-tag>","<type>"]`, type registry `"pointer"` \| `"inherit"` (absent type = `"pointer"`, fail-safe). Child-claims-parent. `"inherit"` — "my definition is the parent's, unless I override" → `(child)-[:INHERITS_FROM]->(parent)`; `"pointer"` — correspondence only, no deference → `REFERENCES {source:'b-tag'}`. ADR 0027 as amended by `community-reference` ADR 0029. See §25. |
| **z-tag** | The `z` tag on a ListItem that points to its parent concept's a-tag. Fundamental parent pointer. Deliberately-published items MAY carry multiple `z` stamps (Tapestry-layer position vs the base NIP's one-`z` recommendation — `community-reference` ADR 0029; see §5 and the tapestry-concepts spec). |

---

## 22. Community-Reference Model

A firmware concept may carry a `communityReference` — `{ headerATag, relayHints[], knownGoodEventId? }` — the firmware's **seed** for the deployment's community affiliation (`community-reference` ADR 0030, amending the original stub design of ADR 0005). Its four retained functions: the boundary-rule-sanctioned home for hardcoded handle literals (bootstrap), the fetch path (`relayHints`), optional install-time pin-verification (`knownGoodEventId`), and driving the Phase-A superset link (ADR 0008, below).

**Ratified semantics (`community-reference` ADR 0030; implemented — see Status today):** at firmware install, for each manifest concept carrying a `communityReference`: fetch the community Header from `relayHints` → pin-verify when `knownGoodEventId` is present (mismatch → log + skip the *foreign-node materialization*, never throw) → **if the TA-authored local header carries no `b` tag of any type**, republish it with `["b", "<headerATag>", "pointer"]` appended (TA-signed; pointer-typed per ADR 0029, so the seed is a bookmark, never deference). Any existing `b` — any type, seeded or operator-set — suppresses the seed within that run (**never-clobber**; see the reinstall caveat in Status today). The graph edge then derives from the published event (`REFERENCES {source:'b-tag'}`) like every other tag-derived relationship. **The general principle: the manifest seeds published tags; the graph derives from published events; Neo4j-only stubs were the interim form.**

**Status today (implemented — `community-reference` Story 38 / ADR 0034 + `tag-federation` Story 2 / ADR 0002):** `pass_communityReferences` **seeds**: for each manifest concept carrying a `communityReference`, it scans the TA-authored local header (`39998:<localTA>:<slug>`) and — if it carries no `b` — appends `["b","<headerATag>","pointer"]`, **re-signs it with the TA key** (`signAndFinalize`/`loadTAKey`), republishes to local strfry, and imports it; the derivation (`buildImportCypher`) then materializes `(localHeader)-[:REFERENCES {source:'b-tag'}]->(target)` — and `(child)-[:INHERITS_FROM]->(parent)` for an inherit-typed `b`, registry-correct though firmware seeds only `pointer`. The legacy `(localHeader)-[:REFERENCES {source:'firmware-community'}]->(communityHeader)` stub MERGE is **skipped** for a `b`-carrying header (the edge derives from the published event); pre-existing stub edges remain valid-but-legacy (consumers filter on `source`). Applied to `nostr-relay` + `tag` / `nostr-user-tag` / `tag-pinning` (live-verified at install: the seed, the derived `source:'b-tag'` edge, the stub-skip, and the Superset link intact). Idempotent in **outcome** (exactly one `b`, one edge per concept). Fully graceful: the local pointer-`b` seeds from the manifest `headerATag` literal **even when the community-header fetch or pin-verify fails** — the pointer carries zero consensus weight (ADR 0029), so only the *foreign-node materialization + Superset link* gate on a successful pin, never the local seed. **Never-clobber is within-run-only:** firmware `pass1`/`pass2` rebuild the TA header from the static concept definition (no `b`) *before* `pass_communityReferences` runs, so a **reinstall re-seeds the firmware-default `b`** — an operator's manual re-point does **not** survive a reinstall (accepted; restore-firmware-defaults is the intended reinstall semantics; tracked for a future "firmware update" path). **Remaining debt:** a sweep of pre-existing `firmware-community` stub edges (harmless meanwhile under the collision contract below).

**The `REFERENCES` edge — stub or `b`-derived — is a bookmark, not agreement.** It means "this external curator's concept is a recognized reference for my local concept; I *may* later pull from it" — not agreement, not "imported," not `IS_A_SUPERSET_OF`. It is distinct from the (deferred) editorial `IMPORT`. One local concept may `REFERENCES` **many** external concepts (e.g. Miles's *Jazz Musicians* and Dizzy's) — many-to-one via distinct target nodes; provenance per-edge via `source`.

**Collision contract (binding).** `REFERENCES` is overloaded: event ingest builds high-volume `(:NostrEventTag)-[:REFERENCES]->(:NostrEvent)` for every `e`/`a` tag. Concept-level `REFERENCES` now has **two producers** — the firmware-community install stub (`source:'firmware-community'`, above) and pointer-typed `b` tags (`source:'b-tag'`, the first *asserted, wire-derived* producer — `community-reference` ADR 0029, §25). It is disambiguated by **`r.source`** (tag-level never sets it) **and** endpoint labels — noting the `b`-derived variant widens endpoints beyond `ListHeader→ListHeader`, since `b` rides on kinds 39998 *and* 39999. Any consumer traversal MUST filter on `source` (presence and value); a bare `MATCH ()-[:REFERENCES]->()` is a defect.

**Resolution model.** The *correct* long-term selector of "the community's definition" is the user's Grapevine (WoT loose consensus over published curations). The firmware-baked pointer is a **cold-start default**, not the truth. Precedence: **`grapevine-resolved → firmware-blessed → none`** — mirroring the Warm Start tiered fallback (`self → owner → cold`). The protocol-facing statement of this selector — and the cloud/aggregation model that consumes it — is normative in [protocols/drafts/shared-concepts.md](protocols/drafts/shared-concepts.md); this section remains the implementation-and-history record.

**Accepted compromise (Flaw A) and its exit.** A firmware-baked pointer is a *centralized* editorial choice (the dev team picks the blessed curator pubkey — currently the reference deployment's TA). Accepted **temporarily**; the exit is the **registry-as-DList**: the per-concept pointer itself becomes a community-curated, Grapevine-ranked DList, retiring the hardcoded choice. `community-reference` ADR 0030 consciously **widens** the compromise as the cold-start tier only: every **manifest** firmware concept MAY carry a `communityReference` (per-concept explicit `headerATag` entries; mixed curators per concept possible; runtime-created concepts deferred — no blessing path exists). The widening does not strengthen the tier: seeds are `"pointer"`-typed (ADR 0029), so they carry **zero consensus weight** — the grapevine tier's ability to supersede the firmware tier is unimpaired and measurable.

**Candidate exit mechanism — the `b` / `INHERITS_FROM` tag (ADR 0027).** A `b` tag (§25) is a published, `#b`-queryable, per-pubkey pointer naming a preferred definition. Aggregating a concept's **incoming `INHERITS_FROM` edges, weighted by each child author's GrapeRank influence from the observer's PoV**, yields "which definition my web of trust loosely agrees on" — exactly the `grapevine-resolved` selector above. This makes `b`-edges a **candidate mechanism** for the registry-as-DList exit. Recorded as candidate only; the registry design is not ratified here (a future ADR in the 0006 line). Per `community-reference` ADR 0029, this consensus aggregation counts **inherit-typed** edges only — pointer-typed `b` tags derive `REFERENCES`, not `INHERITS_FROM`, and carry zero consensus weight in v1; discovery walks (enumerating correspondents, not deferrers) include both types.

**Invariants & principles.**
1. *Relay invariant:* concept export and `communityReference.relayHints` must target the same relay set (the purpose-built DList relay, not general-purpose relays) or the round-trip cannot close.
2. *Export is own-authored:* you never re-export another curator's concept under your identity.
3. *Materialization ≠ derive:* publishing to strfry does not create a Neo4j node — Pass-3 derive only computes `tapestryJSON` for nodes already present; ingesting a foreign event requires the explicit eventSync import path.
4. *Verification:* structural sentinels cannot prove relay + Neo4j + install round-trips — the local/staging/prod smoke is the authoritative behavioral gate (it caught the materialization defect that all structural tests missed).

**Header→ConceptGraph (implemented — ADR 0007, §5):** the `concept-graph` header tag + tag-else-compute resolution makes a single fetched Header self-resolve its full concept off-relay.

**Superset link, Phase A (implemented — ADR 0008):** at firmware install, `pass_communityReferences` also materializes the community Superset (deterministic `39999:<curatorPk>:<dtag>-superset`), explicitly labels it `:Superset` (`buildImportCypher` gives only `:ListItem` for 39999), and MERGEs the **canonical** `(localSup:Superset)-[:IS_A_SUPERSET_OF]->(communitySup:Superset)` edge — a structural bookmark that participates in class-thread traversals. *Follow-up (flagged by `community-reference` ADR 0030, not designed):* the seed-not-stub promotion applies in spirit here too, with a wire caveat the ADR 0008 line must resolve — the `s` tag is child-claims-parent with a flipped derived edge, so an `s` on the TA's local superset would derive the *inverse* of the canonical Phase-A edge; an on-wire form needs either a curator-side tag or the reserved-unassigned uppercase inverse.

**Phase B (implemented — Story #14, ADR 0010 with mechanism amended by ADR 0011):** owner-on-demand class-thread closure pull via `POST /api/concept/:handle/pull-community-class-thread` (NIP-07-gated). Walks the curator's class-thread closure via `#n` + `#s` tag filters (single-char child-claims-parent tags — see §23) from the #11 community Superset anchor; back-compat z-at-Header walk at root depth covers curators that haven't migrated to `n`/`s` tags. Foreign Sets get explicit `:Set` label; canonical `HAS_ELEMENT` / `IS_A_SUPERSET_OF` edges MERGEd between foreign nodes (no `source` property — canonical relationships, not stubs). **Binding invariants:** authorship trust gate (refuses events whose `pubkey !== curatorPk`); no editorial relationships; no election into local class thread; local concept untouched. Idempotent + per-member graceful + visited-set + max-depth + max-fetch budget.

**Deferred (see ADR 0006 / ADR 0011):** privacy tiers; signed/first-class editorial relationship-type; registry-as-DList (flaw-A exit); cutover ADR (deprecate the descriptor-event dual-emit); migration CLI for existing local events; `IS_A_PROPERTY_OF` as a single-char tag (reserved-future candidate; `REFERENCES` no longer needs a letter — it rides the `b` tag's `"pointer"` type, `community-reference` ADR 0029); election surface; concept-graph fidelity upgrade.

---

## 23. Class Thread Relationships (`n`, `s`)

**The wire format is specified in [protocols/drafts/class-thread-relationships.md](protocols/drafts/class-thread-relationships.md) — normative:** the `n`/`s` tag definitions and direction flip, value format, multi-parent semantics, retrieval, the consumer security considerations, and the direction principle with reserved letters. Established by ADR 0011. This section covers how this codebase implements it.

- **Emission sites (dual-emit policy during back-compat cycle):** `handleCreateSet` emits the new `s` tag on the Set event before signing; `handleAddToSet` emits the new `n` tag via re-publishing the source event (locally-authored items only — foreign-authored items cannot be re-signed; descriptor event still fires for those). Both sites also continue publishing the prior relationship-descriptor events for one full release cycle. A future cutover ADR will deprecate the descriptor emission.
- **Trust-gate wiring (the spec's security considerations, concretely):** the authorship gate is `pubkey === curatorPk` — the TA whose Header anchored the #11 `(localSuperset)-[:IS_A_SUPERSET_OF]->(communitySuperset)` edge (firmware install; see §22). Phase B's tag walk never MERGEs an edge whose parent endpoint is in the local TA's sub-graph; that anchor is the only cross-pubkey edge in the graph.
- **Materialization:** consumers' derived relationships are MERGEd as Neo4j `HAS_ELEMENT` / `IS_A_SUPERSET_OF` edges — see §6 for the data model. For the editorial inherit-from tag (`b`) see §25.

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

**ADRs:** [0012](engineering-team/decisions/task-queue-scheduler/0012-task-queue-phase-1-bullmq.md) (BullMQ phase 1); [0013](engineering-team/decisions/task-queue-scheduler/0013-task-queue-neo4j-resource-class.md) (resource-class semaphore); [0014](engineering-team/decisions/task-queue-scheduler/0014-entrypoint-template-rendering.md) (template-driven config); [0015](engineering-team/decisions/task-queue-scheduler/0015-task-queue-on-by-default.md) (default flipped on); [0016](engineering-team/decisions/task-queue-scheduler/0016-bullboard-admin-access.md) (owner-or-admin gate); [0022](engineering-team/decisions/task-queue-scheduler/0022-manual-task-retrigger-dedup-fix.md) (wait/active-only dedup window via `removeOnComplete`+`removeOnFail`); [0023](engineering-team/decisions/task-queue-scheduler/0023-task-queue-semaphore-protection-audit.md) (entry-point tagging is load-bearing — audit closes subshell-chain coverage gaps); [0024](engineering-team/decisions/task-queue-scheduler/0024-scheduled-task-timeout-propagation.md) (scheduled-task timeout propagation fix); [0025](engineering-team/decisions/task-queue-scheduler/0025-kill-timeout-orphans-by-default.md) (kill timeout-orphans by default).

---

## 25. The Inherit-From Tag (`b`)

**The wire format and resolution semantics are specified in [protocols/drafts/inherit-from.md](protocols/drafts/inherit-from.md) — normative:** the `b` tag (three-element form, kinds 39998/39999), the element-3 **type registry** (`"pointer"` \| `"inherit"`; absent type reads as `"pointer"`, fail-safe), type-gated derivation, multi-parent semantics, the `INHERITS_FROM` derived relationship and its no-flip direction, the resolution algorithm, trust-coupling, and the editorial-relationship family contrast. Established by ADR 0027 (ADR 0006/0011 lineage), as amended by `community-reference` ADR 0029 (type registry). This section covers how this codebase implements it.

- **Neo4j edges (type-gated, ADR 0029; implemented — `community-reference` ADR 0034):** an explicitly **inherit-typed** `b` tag derives `(child)-[:INHERITS_FROM]->(parent)` — a canonical, asserted relationship: unlike the concept-level `REFERENCES` variants and like `HAS_ELEMENT`/`IS_A_SUPERSET_OF`, it carries **no `source` property**. A **pointer-typed** (or untyped) `b` tag derives `(child)-[:REFERENCES {source:'b-tag'}]->(target)` instead — asserted and wire-derived, subject to §22's collision contract. Both are materialized in `buildImportCypher` (the strfry→Neo4j import chokepoint, so derivation runs on install *and* ongoing sync); the type-gate keys on the explicit string `"inherit"` (never "not pointer"). See §6 for the editorial-relationship family in the data model.
- **First consumer:** the Communities Protocol's participant-affiliation pointer (`affiliation` → `b` with type `inherit`); the primitive is **not** community-specific. The explicit `inherit` type is **load-bearing** — an absent type reads as `"pointer"` and confers no deference. Affiliation = membership in the inherit-only deference closure; a pointer-typed link breaks the chain (ADR 0029).
- **Trust gating:** PoV/GrapeRank re-gate visibility on every resolution.
- **Walk mechanics:** the bounded-walk pattern (maxDepth, visited-set) reuses ADR 0010/0011; resolution walks traverse inherit-typed `b` tags only, while discovery walks include both types (ADR 0029). See ADR 0027 for the full rationale, the rejected alternatives (folding into `IMPORT`; multi-char tags), and the deferred design questions.

---

## 26. Resolved Definition

**The resolution algorithm is specified in [protocols/drafts/inherit-from.md](protocols/drafts/inherit-from.md) → "Resolution: the resolved definition" — normative** (own-fields-win; first-listed-wins among inherit-typed `b` tags for unstated conflicts; visited-set cycle guard; live read-time, observer-independent). Established by ADR 0028, the read-side companion to ADR 0027, as amended by `community-reference` ADR 0029 (the walk ranges over explicitly inherit-typed `b` tags only). This section covers how this codebase implements it.

- **Closure as a derived query:** `MATCH (n)-[:INHERITS_FROM*0..]->(x)` — computed on read, never stored. The query stays valid under ADR 0029 *because* derivation is type-gated: pointer-typed `b` never becomes `INHERITS_FROM`, so the closure is inherit-only by construction.
- **Named instance:** the Communities Protocol's `effectiveCD` is simply a named instance of Resolved Definition; §22's grapevine-resolution (which definition a web of trust converges on) selects among nodes' resolved definitions.
- **Rejected alternative:** WoT-weighted field resolution (which would make a node's own definition vary by observer) — see ADR 0028.

**Caching the resolved definition (Target — design; `community-reference` ADR 0032).** *Not wired:* no resolver and no cache exist (the merge-walk is itself a future implementation story — ADR 0028 §"Out of scope"). On-wire `b`-tags now exist (the `pointer`-typed firmware seed — ADR 0034), and pointer/inherit derivation is implemented (§25), but the *resolved-definition read* half needs **inherit-typed** `b`-tags in the wild plus the merge-walk resolver — both still future (firmware seeds only `pointer`, which doesn't participate in resolution). A deployment **MAY** maintain a **deployment-side materialized resolved definition** (Neo4j) to meet the "read one event, no repeated re-resolution" goal — with **zero wire change**.

- **Semantic transparency (cardinal).** The cache MUST NOT change what any node resolves to. On-read live resolution (above) stays authoritative; a cold, missing, or stale entry can never yield a different answer than a fresh walk. Equivalently: a conforming deployment could drop the entire cache at any instant with no observable effect but latency — pure on-read resolution is always valid, which is why the cache is a MAY, not a requirement.
- **Trigger:** maintained only for nodes carrying an **inherit-typed** `b` (the only nodes non-trivially resolved). Pointer-typed `b` derives `REFERENCES`, never enters the closure, and triggers nothing.
- **Refresh:** event-driven on ancestor edits **plus a periodic full re-resolve backstop**. Binding lesson from the reconciliation work (ADRs 0018/0020): the live path is lossy, so *consistency must re-derive edges, not trust bookkeeping* — an "id matches ⟹ cache fresh" fast-path is unsound; the backstop re-derives.
- **Never on-wire (load-bearing boundary).** The materialized definition lives **only** deployment-side. It is **never** republished into the header event as stated fields — that is the override-masquerade hazard (it would freeze ancestors' future edits and misrepresent authorial intent to other resolvers). The wire rule "computed on read … never snapshotted into the node" ([inherit-from.md](protocols/drafts/inherit-from.md)) keeps the cache invisible on the wire. The on-wire self-contained-snapshot variant is **deferred**; if a real offline-resilience consumer ever appears, the safe path is a stated-vs-synced field marking at inherit-from.md's open payload-binding item.
- **Composes from existing machinery (named, not built):** the `pass_communityReferences` fetch→publish→materialize path (§22), the strfry-router remote-subscription layer, BullMQ Job Schedulers (the periodic backstop, under the neo4j-heavy semaphore), ADR 0010's owner-consent / on-demand-pull posture, and ADR 0006's deferred element/superset materialization stream (§5) as the natural slot. Eviction/TTL is an implementation detail — always safe under the transparency invariant.

---

## 27. Point of View (PoV) Resolution

**Every trust metric in Tapestry is computed relative to a Point of View — and there are exactly three of them.** A "trust metric" is any count, score, or list derived from the web of trust (verified-follower counts, GrapeRank influence/rank, verified-reporter lists, search ranking). The same metric reads differently depending on *whose* web of trust answers it, so a surface that mixes sources can show the *same* number three different ways. This section is the canonical definition of the three PoVs, which source is authoritative for each, and the (target) model for selecting between them. Established by ADR 0033, ratifying the design captured in `docs/POV_RESOLUTION_DESIGN_HANDOFF.md`.

The section is split deliberately: **The standard** is normative and true today; **Status today** is what's actually wired; **Target direction** is direction, not yet built; **Open questions** are undecided. Do not read a target as a present-tense guarantee.

### The standard (ratified)

Every trust metric is computed relative to exactly one of three Points of View:

| PoV | Whose web of trust | Source of truth | Availability |
|---|---|---|---|
| **Owner** | the local Brainstorm instance's owner | **Neo4j** — `NostrUser` node properties (`influence`, `verified*Count`, `hops`) + live traversals | always locally available (the instance computes it) |
| **House** | the deployment's "house" web of trust | **kind 30382 Trusted Assertions** → Meili `wot_*_<houseSuffix>` | only if House assertions are published/imported |
| **Personalized** | the end-user's own web of trust | **kind 30382** per-user → Meili `wot_*_<userSuffix>` | only if that user's assertions exist |

Two normative rules accompany the table:

- **Following stays on strfry, non-PoV.** The Following count is read from strfry (kind-3 `p`-tags). It is **not** a trust metric and has **no** PoV — it is the freshest, cheapest count and is immune to the GrapeRank batch. (When the Owner scoring batch died mid-run on 2026-06-07, Following stayed correct while the PoV-derived counts went stale — evidence it must never be folded into the PoV machinery.)
- **Neo4j-sourced grapevine data is the Owner PoV — not "House."** Earlier copy and docs labeled Neo4j-sourced counts/lists "House (default)"; that was a **mislabel**. Anything read from Neo4j node properties or live traversals is the **Owner** PoV. "House" is specifically the kind-30382 → Meili `wot_*_<houseSuffix>` read.

### Status today

What each surface actually uses right now:

| Surface | Datum | Source today |
|---|---|---|
| Profile | Following count | strfry (`get-user-counts`) — non-PoV |
| Profile | Verified Followers / Verified Reporters counts | **Owner (Neo4j)** — shipped in profile #35/#36 (ADR 0031/0032); badge value agrees with the list table |
| Profile | HOPS stat + `/follows-hops` path | **Viewer→target, live** (logged-in viewer, else Owner) for the distance/path; per-card **rank is Owner PoV**. Shipped in profile #38/#39 (ADR 0034/0035) |
| `/follows`, `/followers`, `/reporters` tables | rows + count | **Owner** (live Neo4j) |
| Search page | ranking / scores | Meili, with a 2-way **House ↔ Personalized** toggle |

### Target direction (not yet built)

The following is the intended direction. **None of it is implemented yet** — it is recorded here so future work builds toward one model, not so surfaces can claim the behavior today.

- **Selection + persistence.** One **selected PoV** per end-user at a time (Owner / House / Personalized), **stored** (session and/or backend) and **sticky across pages** — change it on one page and it applies everywhere. A **3-way selector** UI: the search page's current 2-way House↔Personalized toggle gains **Owner**, and the same selector eventually appears on the profile, with the choice remembered when navigating back to search.
- **Fallback.** A surface always **attempts the selected PoV**; if the datum for that PoV is **unavailable**, it falls back along a **feature-specific chain** — the right fallback differs for the search bar vs a profile badge vs a list table vs future surfaces, so the chain is defined per feature, not globally.
- **Freshness is part of availability.** A PoV's data can be present-but-stale or mid-recompute (e.g. the interrupted Owner batch). "Available" is not just present/absent — stale/partial is a **state**, to be surfaced ("computing… / as of \<time\>") rather than silently shown as degraded numbers. A naïve "absent → fall back" rule is insufficient.

### Open questions

Undecided; each is a candidate for a future `pov-resolution` story (carried from the design handoff):

1. **Default selected PoV** for a new/anonymous user — Owner (always available) or House (richer, if present)?
2. **Resolver shape** — one unified PoV-aware endpoint vs a shared server module each endpoint calls (determines how many new endpoints exist).
3. **Freshness signaling** — how is "stale/partial" detected (batch run-state, timestamps on node props, a computed-at field), and do surfaces show a health indicator?
4. **Per-feature fallback chains** — enumerate them (search bar, profile badges, tables, future) across the three PoVs plus the raw/strfry primitives.
5. **Personalized source** — kind-30382-only, or also a local per-customer calculation?
6. **count = list-length guarantee** per PoV — exact (single live source) vs steady-state (precomputed badge + live table).

See ADR 0033 for the ratification decision (the normative/aspirational split) and the open questions it deliberately left undecided.

---

## 28. Open Ranking (ORE) Provider

Brainstorm exposes its web of trust over **[Open Ranking](https://github.com/Open-Ranking/protocol)** (ORE) — an external, MIT-licensed HTTP/JSON protocol for reputation/ranking/discovery on nostr. ORE is a **second, complementary export** alongside the NIP-85 (kind 30382/10040) publication: the *same* underlying GrapeRank / Neo4j / Meili data, but a **pull, request/response HTTP interface** for clients that don't speak the nostr relay protocol. It does **not** replace NIP-85 (which stays the signed, relay-native, independently-verifiable channel); ORE adds ad-hoc query patterns NIP-85 structurally can't serve (search by text; stats for an arbitrary pubkey). ORE is an external spec we *consume*, so it's documented here (per `protocols/README.md`'s boundary rule), not as a `protocols/` pre-NIP. Established by ADRs `open-ranking/0001` (provider + stats) and `open-ranking/0002` (search), book `engineering-team/audits/open-ranking/`; batch rank added by ADR `ore-parity/0001` and followers/muters by ADR `ore-parity/0002`, book `engineering-team/audits/ore-parity/`.

### Surface (as-built)

Public, read-only, **unauthenticated, unsigned**. All routes live **off the `/api/` prefix** (so `src/middleware/auth.js` auto-exempts them) and are served by the control panel from `src/api/open-ranking/`, registered next to NIP-05 in `src/api/index.js`. No firmware/schema/pipeline/nginx change; with the module unregistered the rest of the app is unchanged.

| Method | Path | ORE | Returns |
|---|---|---|---|
| GET | `/.well-known/open-ranking.json` | ORE-01 | Capability document — a JSON object keyed by endpoint path → arrays of Algorithm Objects (first element = default). |
| POST | `/stats/pubkey` | ORE-02 | `{ pubkey, rank, hops, followers, muters, reporters, follows, mutes, reporting, pagerank }` — inbound (followers/muters/reporters) **verified**; outbound (follows/mutes/`reporting`) exact totals; `pagerank` raw; no `ttl`. |
| POST | `/rank/pubkeys` | ORE-03 | `{ results: [{ pubkey, rank }] }` — batch rank of the supplied pubkeys (≤1000, duplicates collapsed), ranked desc, capped at `limit` (default = batch size, over-size silently clamped); every requested pubkey ranked, unknown → 0; no `ttl`. |
| POST | `/search/pubkeys` | ORE-05 | `{ results: [{ pubkey, rank }] }` — free-text profile search, ranked desc, capped at `limit` (no `ttl`). |
| POST | `/followers` | ORE-06 | `{ results: [{ pubkey, rank }], total }` — the target's **verified** followers ranked by their own global GrapeRank, desc; ≤`limit` (default 50, max 1000 → over `422`); `total` = live verified-set cardinality; unknown target → `200` empty (no 404); no `ttl`. |
| POST | `/muters` | ORE-07 | Same contract as `/followers` over the mute graph (verified muters). |

Each endpoint advertises a **global** algorithm `graperank` (`pov:false`, the default); `/stats/pubkey` additionally advertises a **personalized** `graperank-personalized` (`pov:true`). Personalized *search* is deferred (below). (Algorithm ids were renamed `grapevine`→`graperank` by ADR 0003, to match the GrapeRank algorithm and the kind-30382 metric vocabulary.)

### PoV mapping (ties to §27)

ORE's `pov` is §27's PoV machinery. The **global `graperank`** is the instance's **owner-anchored** view, but it is read from a different store per endpoint:

- **Stats** → **Neo4j**: `fetchProfileScores(pubkey, observerPubkey:'owner')` reads the `NostrUser` node — the **Owner PoV** (§27) — with `rank = round(influence × 100)`. The response also carries `hops`, raw `pagerank` (personalizedPageRank under the active POV), the **verified** inbound counts (`followers`=verifiedFollowerCount, `muters`=verifiedMuterCount, `reporters`=verifiedReporterCount, mirroring kind-30382), and the exact **outbound** totals `follows`/`mutes`/`reporting` (ADR 0003/0004 — "total" inbound is unknowable, so verified is the line; the outbound report count is named `reporting`, not ORE's *inbound* `reports`).
- **Batch rank** → **Neo4j**: one `UNWIND` over the same owner-baseline `NostrUser.influence` that stats reads (`rank = round(influence × 100)` — the two endpoints agree by construction); `OPTIONAL MATCH` + `COALESCE` ranks unknown pubkeys 0 (ORE-03's every-pubkey rule). One round trip per batch (`fetchInfluences`, `src/api/open-ranking/rank.js`).
- **Followers / muters** → **Neo4j**: live top-N + live count over the inbound `FOLLOWS`/`MUTES` edges filtered by the per-edge verified cutoffs (`VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` / `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, bound as `$cutoff`), each row ranked by the *follower's/muter's own* influence, ties broken `pubkey ASC`; both statements under the `NEO4J_QUERY_TIMEOUT_MS` deadline (`fetchVerifiedInbound`, `src/api/open-ranking/inbound.js`). `total` is the live count from the same scan — it can drift from `/stats/pubkey`'s batch-written `verified*Count` properties between recomputes (ADR ore-parity/0002 Option C, deliberate).
- **Search** → **Meili**: ranks by the owner's `wot_rank_<ownerSuffix>` column (`ownerSuffix = getOwnerAssistantPubkey().slice(0,8)` — the runtime TA helper, never hardcoded) via `nostr-search-api` with `sort=wot_rank_<ownerSuffix>:desc`; `rank` floors to 0 for unscored profiles. This is the kind-30382 → Meili read of §27, keyed to the owner's own delegated suffix.

The two stores key a PoV by **different pubkeys** — Neo4j cards by the human's **main pubkey** (`observer_pubkey`), Meili columns by the **delegated-key suffix** — which is the open seam recorded in worksheet **W13**.

**Personalized `graperank-personalized`** (stats only): the request `pov` is used directly as the Neo4j `observer_pubkey`, served **only for a provisioned PoV** — `isPovProvisioned(pov)` = (`pov === owner`) OR a `NostrUserWotMetricsCard {observer_pubkey: pov}` exists. An unprovisioned `pov` returns **`422`** with an `X-Reason` that explains the unavailability and names the endpoint's default global algorithm (the `pov not provisioned:` prefix is kept for log continuity), never a silent fallback to the owner view (the architecture-invariant rule: a global answer must not be presented as the caller's personal one). Upstream contract draft: `protocols/upstream/ore-01-pov-unavailable.md`.

### Conventions (ORE-00, as-built)

64-char-lowercase-hex pubkeys (npub rejected → `422`); `application/json` in/out; `Access-Control-Allow-Origin: *` on every response incl. errors; errors via HTTP status (`400` malformed JSON, `413` batch over the `/rank/pubkeys` 1000-pubkey provider max, `422` validation/algorithm/pov) + a human-readable `X-Reason` header; no `ttl` (dropped, ADR 0004); a `pov` sent to a global algorithm is **ignored**. Reads are synchronous → success is always `200` (no `202`/`Retry-After`). **`OPTIONS` preflight returns a `2xx` (204) via the platform's global CORS**, not a strict ORE-00 `200` — a documented cosmetic deviation (a strict-200 shim is a deferred follow-up). The outbound search call is bounded by `AbortSignal.timeout(5000)`.

### Security — personalized-stats enumeration oracle

The `graperank-personalized` **stats** path is an **unauthenticated provisioning-enumeration oracle**: a caller distinguishes provisioned (`200`) from unprovisioned (`422`) POVs, enumerating the instance's customer set. Acceptable on staging (test data); **it MUST be gated (ORE-A/NWT auth or a self-only check) before any production promotion.** Tracked in worksheet **W12**. The global algorithms and the global-only search carry no such oracle.

### Deferred

- **Personalized search** (`graperank-personalized` on `/search/pubkeys`) — needs a server-side **main→delegated PoV resolver** to bridge the two stores (worksheet **W13**); planned as `open-ranking` Story 3.
- **ORE-A / Nostr Web Token (kind 27519) auth**; the remaining ORE endpoints (`/recommend/pubkeys`, `/compromised/pubkeys` — unplanned); a standard PoV-availability mechanism / upstream ORE proposal (W12).

### Deployment

Live on **`staging.brainstorm.world`**: ORE-01 + ORE-02 via [apps#318](https://github.com/nous-clawds4/tapestry/pull/318) (2026-06-18); ORE-05 via [apps#322](https://github.com/nous-clawds4/tapestry/pull/322) (2026-06-19). **Also live on production (`tapestry.brainstorm.world`)** — the earlier "not on production" hold was resolved when ADR `open-ranking/0005` shipped the personalized-stats gate OFF by default (W12 gates *opening personalization*, not the global surface); both instances verified serving the ORE surface 2026-08-15. Sources: ADRs `engineering-team/decisions/open-ranking/0001`–`0002`; book `engineering-team/audits/open-ranking/`; worksheet W12/W13.

---

## 29. Derived-JSON Store: tapestryKey and the tapestry-store LMDB

> **Status: in progress.** This layer is scaffolded and wired, but the migration into it is **not** complete — most node JSON is still stored inline in the `json` tag (§8). Read this section as describing an in-flight subsystem, not a settled state.

Separate from strfry's internal LMDB event store (§4), the control panel keeps its **own** application-level LMDB key-value store — the [`lmdb`](https://www.npmjs.com/package/lmdb) npm package — for **serialized / derived per-node representations**. This is the "tapestry-store". It is unrelated to strfry's LMDB beyond both happening to use the LMDB library.

**Where it lives.** `src/lib/tapestry-store.js` opens a singleton LMDB at `process.env.TAPESTRY_LMDB_PATH || ~/.tapestry/lmdb` (compression on, 256 MB map). Inside the container that resolves under `/root/.tapestry/`, which is **not** mapped to a named Docker volume (§4) — so it is a **rebuildable cache**: lost on container *recreation* and repopulated by the derive engine, never a source of truth.

**Keying — the `tapestryKey` node property.** Each Neo4j node carries a `tapestryKey` (a v4 UUID, assigned once and never changed) that **is** the LMDB key. `POST /api/tapestry-key/initialize` stamps `SET n.tapestryKey` on every node lacking one, and the firmware install does the same (`src/firmware/install.js`, "assign tapestryKeys to all nodes"). Stored values are envelopes: `{ updatedAt, rebuiltFrom?, data }`. A companion `tapestryJsonUpdatedAt` timestamp is written back onto the node whenever the LMDB entry is (re)written.

**The `lmdb:` pointer convention.** Any string property value may hold either the inline value **or** a pointer of the form `lmdb:<tapestryKey>`. `src/lib/tapestry-resolve.js` (`isLmdbRef` / `toLmdbRef` / `resolveValue` / `resolveDeep`) resolves these transparently server-side; the client does the same via `ui/src/utils/lmdb.js`, which fetches `/api/tapestry-key/:key`. A reader gets the data whether it is inline or offloaded — so **resolve through this layer rather than reading a raw property**, since you cannot assume which form a given node uses.

**Write / derive path.** `src/lib/tapestry-derive.js` computes derived JSON per node and calls `store.put(node.tapestryKey, data, …)`, then stamps `tapestryJsonUpdatedAt`. The "offload" endpoints (`POST /api/tapestry-key/offload`, `/offload-all`) take an inline `json`-tag value, write it into LMDB under the parent event's `tapestryKey`, and replace the tag value with the `lmdb:` pointer. The full API surface (`status` / `initialize` / `get` / `put` / `offload` / `resolve` / `derive`) lives in `src/api/tapestry-key/index.js`. All async `store.put` writes must be awaited before the node timestamp is written or the response is sent (regression-guarded by `test/tapestry-key-put-await.test.js`).

**Relationship to the protocol (§5, §8).** Node content is still *specified* in the event's `json` tag (word-wrapper format); the tapestry-store is a **local storage optimization** over that content, not a wire-format change. a-tag addressing and the `json`-tag spec are unaffected.

**Migration status (as of 2026-07).** Per the post-install dashboard (`README.md`), a minority of nodes still need a `tapestryKey` and most `json` tags remain inline in Neo4j — reported there as "harmless and expected for now". The offload is incremental and ongoing.

---

## 30. The Self and Its Stores

**Tapestry is, first and foremost, a local-first personal knowledge graph.** The same data may live in several stores at once — Neo4j, the tapestry LMDB, local strfry, and external homes such as nostr relays or the filesystem. This section defines **which store holds the self**, and what each of the others is for. It governs the *identity* axis; it does not change any wire format. Which *key* speaks for the self is **§31**'s subject.

### The ontology (ratified)

| Store | Role | Notes |
|---|---|---|
| **Neo4j** | **The definitive "me."** | Complete, and mortal. A Neo4j backup restores the self in full. |
| **tapestry LMDB** | **"Me," but a subordinate cache** — never a co-equal seat of self. | Derivable from Neo4j; see §29. |
| **Signed nostr events** | **"Letters"** — authored by me, or received from peers. | The proof / communication / durability axis, **not** the identity substrate. |

**Derivability ≠ identity.** Events sit at the bottom of the *derivation* stack (events → graph → cache), but that does not make them the seat of self. A letter is derivable from me; a letter is not me. The derivation axis and the identity axis are different axes.

**Publishing is optional to selfhood.** A Neo4j write that is never published is a private thought; signing and publishing an event is writing and mailing a letter. A Tapestry instance may in principle operate without ever signing a single event. Consequently, unpublished state is **mortal and box-bound** — durability is provided deliberately (backup), never assumed.

**The asserted core.** The minimal full representation of the self is **"me minus everything recomputable."** Recomputable material includes (non-exhaustively):

- derived / implicit relationships, re-materializable from event structure and the normalization rules (§5–§6, §10);
- WoT scores (GrapeRank / influence / verified counts), recomputable from the follow / mute / report graph;
- JSON Schema documents, recomputable from a full property tree;
- all tapestry-LMDB derived JSON, by definition (§29).

This boundary is load-bearing: it scopes what a backup must preserve losslessly, and it bounds what a rebuild may legitimately touch.

### How this relates to principles 1–3

The architecture invariants in `CLAUDE.md` — POV-first, decentralized-first, filter-at-view-time — are **not repealed**. They continue to govern the **event and social axis unchanged**:

- Accept **all** signed events. Publication is never gated at write time, and this section grants no license to reject events from unknown or untrusted authors.
- Trust filtering stays at **read time, per POV**. There is still no global "the view."
- A trusted peer's incoming event is often more authoritative than the local graph's current belief — that is what learning from peers *is*. It **updates** the brain; it does not replace the brain as the seat of self.

On a multi-tenant instance, "me" is the **owner-POV slice**, not the whole database (§27). The ontology as stated targets the single-owner personal deployment.

### Obligations this creates (binding; not yet enforced)

**These are requirements the system must grow into. None of them is enforced today.** Each carries its current status; as the `self-ontology` epic lands, these statuses change.

- **Provenance taxonomy.** Every node and edge is exactly one of: **asserted / locally-authored** (precious — survives every rebuild), **event-projection** (disposable — re-derivable from the local event archive), or **peer-received** (recorded, trust-weighted per POV).
  *Status: no provenance marking exists. Representation, migration, and writer discipline are deferred.*
- **Non-destructive rebuild invariant.** No pipeline — strfry→Neo4j import, the stream-consumer ETL, normalization, firmware reinstall (including `tapestryKey` re-initialization), reconciliation, or dev tooling — may destroy locally-authored state. **Interim rule until provenance exists: treat any state a rebuild cannot reproduce as precious by default.**
  *Status: not enforced; the risk surfaces above are unaudited.*
- **LMDB dual role.** One store, two non-overlapping purposes: **primary / ongoing** — a compact low-latency cache, lossy and partial *by right*; **secondary / intermittent** — a full lossless serialization produced for backup. The two modes must be **distinguishable**, so a cache entry is never mistaken for backup-grade data (§29).
  *Status: only the cache mode exists; live instances report `derived: 0`. The serialization mode is unbuilt.*
- **Coverage.** A set of derived documents **covers** the graph iff every node and edge is losslessly represented in at least one document and the set reassembles the graph exactly. **Coverage is distinct from normalization:** the normalization rules (§10) guarantee the graph's internal consistency, not the completeness of the deriver set.
  *Status: today's derivers cover only concept-graph labels (Set, Superset, ListItem, ListHeader, ConceptHeader, JSONSchema, Property) — not the NostrUser / FOLLOWS / MUTES / REPORTS social graph.*

### Deliberately open

Not yet decided. These are this epic's deferred work, not omissions:

- **Provenance representation** — property, label, or separate ledger — plus migration of the existing graph and per-write-path writer discipline.
- **Backup mechanics** — encryption scheme; **key custody** (the key protecting the self's backup must survive *outside* the self); chunking against relay event-size limits; manifest and reassembly design; relay choice; retention and rotation.
- **Serialization-mode marking and run manifests** — the *requirement* that modes be distinguishable is ratified above; the design is not.
- **The "normalization ⇒ covering" conjecture** — that error-free normalization makes a concept-graph covering achievable is considered plausible and is **deliberately deferred, not assumed**.

The **shape** of the backup pipeline is ratified — a lossless serialization, encrypted and chunked into nostr events, stashed on a mirror relay — while none of its mechanics are. Note the asymmetry this ontology forces: publishing the graph as its constituent *semantic* events is nostr-native and verifiable, but **necessarily lossy for the definitive-me**, because asserted state has no event form. "I can always reconstruct myself from my published events" is false here.

See ADR 0001 (`self-ontology`) for the ratification decision; working notes and the reasoning that produced this section live in `docs/SELF_ONTOLOGY_DESIGN_HANDOFF.md`.

---

## 31. The Self and Its Keys

**The Tapestry instance is its own person, and the Tapestry Assistant (TA) pubkey is that person's key.** §30 defined which *store* holds the self; this section defines which *key* speaks for it. It governs the key axis of identity only — it defines no new tag, kind, or reader rule, and changes no wire format.

### The doctrine (ratified)

| Key | Role | Custody |
|---|---|---|
| **TA pubkey** | **The instance's "me."** Signs the instance's own headers, brain writes, and letters; every first-person query answers `authors:[TA]`. | Hot — created at first container startup, lives on the server. |
| **Owner main pubkey** | **The principal correspondent.** Maximally trusted, distinct in identity; letters absorbed only by explicit act (below). | Cold — interactive signing (NIP-07 / external signer); never held server-side. |
| **Customer relay keys** (multi-tenant) | Stated direction only, not normative — see Scope. | Server-side, per customer. |

- **The first-person rule.** Every "which events are mine?" question the instance asks — its own concept headers, its brain content, its first-person activity filters — is answered by author identity: `authors:[TA]`. (The Owner is Tony Stark; the TA is Jarvis.)
- **The Owner is a correspondent, not an alias.** Owner-authored events are letters *from* the Owner — privileged in trust, never conflated in identity. An owner-signed item filed under a TA-authored header is a correspondent using the instance's concept, and it is counted as exactly that.
- **Identity attaches to the instance, not the key custodian.** In the default deployment one human holds both nsecs — "the same person" in the everyday sense. But the custodians can differ: a non-technical owner may pay an administrator — human or LLM — to run the server, and then the TA nsec is handled by someone who is not the Owner at all. The doctrine holds unchanged in that world, which is precisely why the TA is not "the owner's second key": it is the instance's own name.

### The external layer (unchanged)

"What does this *human* think?" is a different question from "what is in the instance's filing system?", and it keeps its own rule. External readers resolving a human's concept/DList headers follow [protocols/drafts/assistant-designation.md](protocols/drafts/assistant-designation.md): the personally-signed header governs; the TA-authored header is the designated fallback. That specification's wire format and precedence are **byte-unchanged** by this section, and its personal-wins rule is ratified here as a **security posture**: the TA nsec is a hot server key, the Owner nsec is cold and interactive, and a compromised server must never be able to shadow the owner's deliberate personal statements. (Assistant-designation is itself specified-not-yet-wired; its own deployment-status note governs that.) External callers name humans by their main pubkey throughout — the instance's TA selfhood is never how the outside world addresses the human.

### Absorption (explicit, two modes)

Owner-authored letters enter the instance's brain only by an **explicit, auditable act** — never a silent identity merge. Two modes, both legitimate:

- **Re-mint** — the TA re-signs the content as its own: first-class owned state the TA can evolve and re-sign later (the restore-brain precedent, second-brain ADR 0008).
- **Pointer** — a TA-authored pointer event references the original: provenance preserved, no copy drift.

The choice between them — and whether a re-mint carries a provenance link back to its source event — is made **per feature, in that feature's ADR**; this section supplies the vocabulary only.

**Ruling (tapestries #7; binds future work).** The brain-first publish hook (ADR `tapestries/0007`) imports the instance's own tapestry letters where "own" includes *owner-signed* — an eager absorption of a maximally-trusted correspondent's letters, acceptable near-term. Stage-2 letter ingest (OPEN.md #136) inherits the correction: owner letters route through the general provenance-carrying ingest lane like any correspondent's, with **no permanent "counts as me" carve-out**. Stage-2 does not exist yet; this is a ruling about future work, not a description of present behavior.

### Scope

Normative for the **single-owner personal deployment**, like §30. On a multi-tenant instance the stated *direction* — not yet built, not yet normative — is that each provisioned persona's instance-side identity is its **delegated key**: the owner's is the TA; a customer's is their relay key (worksheet W13's resolver direction).

See ADR 0002 (`self-ontology`) for the ratification decision; the scoping that produced this section is preserved in `docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md` (superseded).

---

*This document is maintained by the development team. When making significant architectural changes, update this file.*
