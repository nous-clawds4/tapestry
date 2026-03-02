# Architecture

## Overview

Tapestry runs as a single Docker container with multiple services managed by **supervisord**. All data stays local — you own it.

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

## Services

### strfry (Local Nostr Relay)

- **Port:** 7777 (WebSocket)
- **Purpose:** Stores all nostr events locally — DLists, profiles, reactions, etc.
- **Data:** Persisted in Docker volume `tapestry-strfry`
- **Access:** Server-side via `strfry scan` CLI, or WebSocket at `ws://localhost:7777`

strfry is a high-performance C++ nostr relay. Tapestry uses it as a local event store — a source of truth for raw nostr data before it gets structured into the Neo4j graph.

### Neo4j (Graph Database)

- **Port:** 7474 (HTTP browser), 7687 (Bolt protocol)
- **Purpose:** Stores the concept graph — structured relationships between DList events
- **Data:** Persisted in Docker volume `tapestry-neo4j`
- **Access:** Cypher queries via the Express API or direct Bolt connection

Neo4j turns flat nostr events into a navigable knowledge graph. A DList header becomes a `ListHeader` node; items become `ListItem` nodes. Relationships like `IS_THE_CONCEPT_FOR`, `HAS_ELEMENT`, `IS_A_SUPERSET_OF` create the concept hierarchy.

#### Key node types

| Label | Source | Description |
|-------|--------|-------------|
| `NostrEvent` | All events | Base label for any imported nostr event |
| `ListHeader` | kind 9998/39998 | DList header — defines a list concept |
| `ListItem` | kind 9999/39999 | DList item — member of a list |
| `Superset` | Derived | Superset node in the concept hierarchy |
| `Property` | Derived | Property definition for a concept |
| `JSONSchema` | Derived | JSON Schema associated with a concept |
| `NostrUser` | All events | User node, one per unique pubkey |
| `NostrEventTag` | All events | Tag on an event (d, z, name, etc.) |

#### Key relationship types

| Relationship | Meaning |
|-------------|---------|
| `IS_THE_CONCEPT_FOR` | ListHeader → Superset (class thread initiation) |
| `IS_A_SUPERSET_OF` | Superset → Superset/Set (class thread propagation) |
| `HAS_ELEMENT` | Set/Superset → ListItem (class thread termination) |
| `IS_A_PROPERTY_OF` | Property → JSONSchema |
| `IS_THE_JSON_SCHEMA_FOR` | JSONSchema → ListHeader |
| `ENUMERATES` | Concept → Property (horizontal integration) |
| `HAS_TAG` | NostrEvent → NostrEventTag |
| `AUTHORED` | NostrUser → NostrEvent |

### Express (API Server)

- **Port:** 80 (internal), exposed as 8080 on host
- **Purpose:** REST API, serves the control panel and React UI
- **Config:** `/etc/brainstorm.conf`

The Express server provides:

- **Strfry API** (`/api/strfry/scan`, `/api/strfry/publish`) — query and publish events
- **Neo4j API** (`/api/neo4j/run-query`, `/api/neo4j/event-check`, etc.) — Cypher queries, event sync
- **Profiles API** (`/api/profiles`) — fetch kind:0 profiles from external relays with caching
- **Settings API** (`/api/settings`) — two-layer config management
- **Auth API** (`/api/auth/*`) — NIP-07 challenge-response authentication

## Data Flow

```
External relays                    NIP-07 (browser)
(DCoSL, purplepag.es, etc.)        ↓ sign events
        ↓ strfry sync              ↓
   ┌────────────┐            ┌──────────┐
   │   strfry    │◄──────────│  Express  │◄──── React UI
   │ (events)    │──────────►│  (API)    │────► React UI
   └────────────┘  scan      └──────────┘
        │                         │
        │ import + normalize      │ Cypher queries
        ▼                         ▼
   ┌────────────┐            ┌──────────┐
   │   Neo4j     │◄──────────│  Express  │
   │ (graph)     │──────────►│  (API)    │
   └────────────┘            └──────────┘
```

### Sync → Import → Normalize

1. **Sync:** `strfry sync` pulls events from external relays into local strfry
2. **Import:** Events are imported into Neo4j as `NostrEvent` nodes with tags and relationships
3. **Normalize:** The concept graph normalizer applies rules to create derived nodes (Supersets, Properties, etc.) and relationships

## Docker Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `tapestry-neo4j` | `/var/lib/neo4j/data` | Neo4j database files |
| `tapestry-strfry` | `/var/lib/strfry` | strfry LMDB event store |
| `tapestry-data` | `/var/lib/brainstorm` | App data + user settings |
| `tapestry-logs` | `/var/log/brainstorm` | Application logs |
| `tapestry-node-modules` | (dev only) | Preserves container's node_modules |

## Authentication

Tapestry uses **NIP-07** for authentication:

1. Browser calls `window.nostr.getPublicKey()` to get the user's pubkey
2. Server issues a challenge
3. Browser signs a kind 22242 event with the challenge via `window.nostr.signEvent()`
4. Server verifies the signature and creates a session

User roles:
- **Owner:** pubkey matches `BRAINSTORM_OWNER_PUBKEY` in config — full access including settings
- **Customer:** registered in the customer database — standard access
- **Guest:** authenticated but not owner or customer — read-only access

## Tapestry Assistant

Each Tapestry instance has a **Tapestry Assistant** — a server-side nostr identity used for automated actions (creating events, signing on behalf of the instance). Its keypair is stored in `/etc/brainstorm.conf` as `BRAINSTORM_RELAY_PRIVKEY`.

The Assistant can:
- Publish DList events to strfry
- Sign events when the user chooses "Tapestry Assistant" as the author in the New DList form
- Represent the instance on the nostr network
