# Tapestry (Brainstorm) Codebase Analysis

> **Generated:** 2026-02-27  
> **Branch:** concept-graph  
> **Forked from:** [Pretty-Good-Freedom-Tech/brainstorm](https://github.com/Prett-Good-Freedom-Tech/brainstorm)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Entry Point and Server](#entry-point-and-server)
3. [Configuration System](#configuration-system)
4. [API Layer](#api-layer)
5. [ETL Pipeline](#etl-pipeline)
6. [GrapeRank Algorithm](#graperank-algorithm)
7. [Concept Graph](#concept-graph)
8. [NIP-85 Trusted Assertions](#nip-85-trusted-assertions)
9. [Customer System](#customer-system)
10. [Negentropy Sync](#negentropy-sync)
11. [Task Queue and Scheduling](#task-queue-and-scheduling)
12. [Frontend](#frontend)
13. [Install and Setup](#install-and-setup)
14. [External Dependencies](#external-dependencies)
15. [Systemd Services](#systemd-services)
16. [Code Quality Observations](#code-quality-observations)
17. [Docker Considerations](#docker-considerations)

---

## 1. Architecture Overview

Tapestry/Brainstorm is a **personalized Web of Trust (WoT) Nostr relay** that:

1. Runs a **strfry** Nostr relay to collect events
2. Processes events through an **ETL pipeline** into a **Neo4j** graph database
3. Computes trust scores using **GrapeRank**, **PageRank**, and hop distance algorithms
4. Publishes results as **NIP-85 Trusted Assertions** (kind 30382 events) back to Nostr
5. Supports multiple **customers/observers** — each gets personalized trust scores
6. Provides a web **control panel** (Express.js on port 7778) for management

### Component Diagram

```
┌─────────────┐    negentropy     ┌──────────────┐
│ External     │ ───────────────► │   strfry     │
│ Relays       │    sync          │  (port 7777) │
└─────────────┘                   └──────┬───────┘
                                         │
                      ┌──────────────────┤
                      │ stream (NDK)     │ batch (strfry scan)
                      ▼                  ▼
                ┌──────────┐      ┌──────────────┐
                │ Queue    │      │ Batch ETL    │
                │ (files)  │      │ (shell+JS)   │
                └────┬─────┘      └──────┬───────┘
                     │                   │
                     ▼                   ▼
               ┌─────────────────────────────┐
               │      Neo4j Graph DB         │
               │  (NostrUser, FOLLOWS,       │
               │   MUTES, REPORTS, etc.)     │
               └─────────────┬───────────────┘
                             │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
              ┌─────────┐ ┌──────┐ ┌─────────┐
              │GrapeRank│ │PageRk│ │  Hops   │
              └────┬────┘ └──┬───┘ └────┬────┘
                   │         │          │
                   ▼         ▼          ▼
              ┌──────────────────────────────┐
              │   NIP-85 Publishing          │
              │   (kind 30382 events)        │
              └──────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │  Express Control Panel       │
              │  (port 7778)                 │
              └──────────────────────────────┘
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Relay | strfry (compiled from source) |
| Graph DB | Neo4j 5.26.x Community + GDS 2.13.4 + APOC 5.26.10 |
| App Server | Express.js (Node.js ≥18) |
| Algorithms | Custom JS (GrapeRank), Neo4j GDS (PageRank), Cypher (Hops) |
| Event Streaming | NDK (@nostr-dev-kit/ndk) |
| Task Orchestration | Bash scripts + systemd timers |
| Config | `/etc/brainstorm.conf` (sourced bash file) |
| OS | Ubuntu/Debian (assumes apt, systemd, sudo) |

---

## 2. Entry Point and Server

### `index.js` — Library Entry Point
```js
module.exports = { generateNip85Data, publishNip85Events, loadConfig };
```
This is a **library** entry point for programmatic use — it exports NIP-85 generation/publishing functions. **Not** the server entry point.

### `bin/control-panel.js` — Server Entry Point
This is the **actual server**. Key characteristics:
- Express.js app on port `CONTROL_PANEL_PORT` (default 7778)
- Serves static files from `public/`
- Session middleware with `express-session`
- CORS enabled for all origins
- Auth middleware applied globally
- Registers ~120+ API routes via `src/api/index.js`
- Supports both HTTP and HTTPS modes
- Loads secure storage env from `/etc/brainstorm/secure-storage.env`

### `package.json` Highlights
- **Name:** `brainstorm` (v0.0.1-alpha)
- **License:** AGPL-3.0
- **Key dependencies:** `@graperank/calculator`, `@nostr-dev-kit/ndk`, `neo4j-driver`, `nostr-tools`, `express`, `ws`
- **Node requirement:** ≥18
- **Scripts:** `npm run control-panel` starts the server; `npm run publish` runs NIP-85 publishing with GC exposed and 4GB max heap

---

## 3. Configuration System

### Primary Config: `/etc/brainstorm.conf`
A **bash-sourceable** file with `export VAR="value"` format. Used by both shell scripts (`source /etc/brainstorm.conf`) and Node.js (parsed by `lib/config.js` and `src/utils/config.js`).

**Key variables:**
| Variable | Purpose |
|----------|---------|
| `BRAINSTORM_RELAY_URL` | Relay WebSocket URL |
| `BRAINSTORM_OWNER_PUBKEY` | Instance owner's hex pubkey |
| `NEO4J_URI` | Neo4j Bolt connection (default `bolt://localhost:7687`) |
| `NEO4J_USER` / `NEO4J_PASSWORD` | Neo4j credentials |
| `CONTROL_PANEL_PORT` | Control panel HTTP port (default 7778) |
| `STRFRY_DOMAIN` | Domain name for the relay |
| `BRAINSTORM_MODULE_BASE_DIR` | Install location (default `/usr/local/lib/node_modules/brainstorm/`) |
| `BRAINSTORM_BASE_DIR` | Data directory (`/var/lib/brainstorm`) |
| `BRAINSTORM_LOG_DIR` | Log directory (`/var/log/brainstorm`) |
| `BRAINSTORM_RELAY_PRIVKEY` / `BRAINSTORM_RELAY_NSEC` | Relay signing keys |
| `SESSION_SECRET` | Express session secret |

### Additional Config Files
| File | Purpose |
|------|---------|
| `/etc/graperank.conf` | GrapeRank algorithm parameters (rigor, attenuation, follow/mute/report weights) |
| `/etc/brainstorm/secure-storage.env` | Encrypted key storage config |
| `/etc/strfry.conf` | Strfry relay configuration |
| `/etc/strfry-router.config` | Strfry router (negentropy sync) config |
| `config/concept-graph.conf.template` | Concept graph UUIDs and relay lists |

### Config Loading (`lib/config.js`)
Priority order:
1. Environment variables (highest)
2. `/etc/brainstorm.conf` (production)
3. `.env` file (development)
4. Default values (lowest)

### ⚠️ Hardcoded Paths (Docker-critical)
- `/etc/brainstorm.conf` — hardcoded in dozens of shell scripts and JS files
- `/etc/graperank.conf` — hardcoded in GrapeRank scripts
- `/var/lib/brainstorm/` — customer data, pipeline queues, algorithm temp files
- `/var/lib/neo4j/import/` — Neo4j import directory for APOC
- `/var/log/brainstorm/` — log directory
- `/usr/local/lib/node_modules/brainstorm/` — installed module path
- `/usr/local/bin/brainstorm-node` — NVM wrapper script
- `/usr/local/bin/strfry` — strfry binary
- `/usr/local/lib/strfry/plugins/` — strfry write policy plugins

---

## 4. API Layer

### Key file: `src/api/index.js`
Registers ~120+ endpoints on the Express app. Major endpoint groups:

| Group | Examples | Purpose |
|-------|----------|---------|
| **Auth** | `POST /api/auth/verify`, `/login`, `/logout`, `/status` | NIP-98-style Nostr auth |
| **Status** | `GET /api/status`, `/neo4j-status`, `/strfry-stats` | System health checks |
| **NIP-85** | `POST /api/publish-kind30382`, `GET /api/get-nip85-status` | Trusted Assertion publishing |
| **Users** | `GET /api/get-profiles`, `/get-user-data`, `/get-network-proximity` | User data queries |
| **GrapeRank** | `POST /api/generate-graperank`, `GET /api/get-graperank-config` | Trust score computation |
| **Pipeline** | `POST /api/batch-transfer`, `/reconciliation`, `/negentropy-sync` | ETL operations |
| **Customers** | `GET /api/get-customers`, `POST /api/add-new-customer` | Multi-observer management |
| **Search** | `GET /api/search/profiles`, `/keyword` | Profile search with precomputed whitelist maps |
| **Export** | `GET /api/get-whitelist`, `/get-blacklist-config` | Data export |
| **Algos** | `POST /api/calculate-hops`, `/generate-pagerank` | Algorithm triggers |
| **Manage** | `POST /api/run-task`, `/brainstorm-control`, `/run-script` | Task management |
| **Neo4j Health** | `GET /api/neo4j-health/complete`, `/alerts` | Database monitoring |
| **Task Dashboard** | `GET /api/task-dashboard/state`, `/task-explorer/data` | Monitoring UI data |
| **Service Mgmt** | `GET /api/service-management/status`, `POST /control` | Systemd service control |

### Auth System (`src/middleware/auth.js`)
- Nostr-based authentication — users sign challenges with their Nostr keys
- Owner pubkey from config has full admin access
- Manager pubkeys get elevated access
- Customers can authenticate and see their personalized data
- Public pages bypass auth

---

## 5. ETL Pipeline

### Key directory: `src/pipeline/`

Three pipeline modes:

### A. Batch Pipeline (`src/pipeline/batch/`)
- `processNostrEvents.sh` — Master script that processes kinds 3, 10000, 1984
- Uses `strfry scan` to export events from strfry's LMDB
- JS scripts (`kind3EventsToFollows.js`, `kind10000EventsToMutes.js`, `kind1984EventsToReports.js`) transform events into relationship JSON
- Files moved to `/var/lib/neo4j/import/` for APOC loading
- Cypher commands (via `cypher-shell`) use `apoc.periodic.iterate` for bulk insertion
- Creates `NostrUser` nodes and `FOLLOWS`/`MUTES`/`REPORTS` relationships

### B. Streaming Pipeline (`src/pipeline/stream/`)
- `addToQueue.mjs` — NDK-based WebSocket listener subscribing to kinds [3, 10000, 1984, 1]
- Writes event files to queue directories at `/var/lib/brainstorm/pipeline/stream/queue/`
- Filename pattern: `{pubkey}_{kind}` (deduplicates rapid updates)
- `processQueue.sh` / `processWotQueue.sh` — Processes queued events into Neo4j
- `processContentQueue.sh` — Handles kind 1 (note) events separately

### C. Reconciliation (`src/pipeline/reconciliation/` and `src/pipeline/reconcile/`)
- Compares Neo4j state against strfry (source of truth)
- Three phases: mutes, follows, reports
- Uses JS scripts to compute diffs and APOC Cypher for bulk updates
- Queue-based approach: `createReconciliationQueue.js` + `processReconciliationQueue.js`

### Data Flow
```
strfry (LMDB) → strfry scan → JSON → JS transform → JSON → Neo4j import → APOC load → Neo4j
strfry (WS)   → NDK sub     → Queue files → Shell scripts → cypher-shell → Neo4j
```

---

## 6. GrapeRank Algorithm

### Key directories: `src/algos/personalizedGrapeRank/`, `src/algos/customers/personalizedGrapeRank/`

### Algorithm Description
GrapeRank is a **personalized trust propagation algorithm** similar to PageRank but with:
- **Ratings** interpreted from follows (+1), mutes (-0.1), and reports (-0.1) with configurable confidence
- **Scorecards** for each user: `[influence, average, confidence, input]`
- **Attenuation factor** (default 0.85) reduces influence at each hop
- **Rigor** parameter controls how much input is needed for high confidence
- **Convergence** via iteration (max 60 iterations, threshold 0.001)
- Owner's scorecard is fixed at `[1, 1, 1, 9999]` (seed user)

### Key Files
| File | Purpose |
|------|---------|
| `calculateGrapeRank.js` | Core iterative algorithm (reads ratings.json, outputs scorecards.json) |
| `initializeRatings.js` / `.sh` | Extracts follow/mute/report relationships from Neo4j → ratings JSON |
| `initializeScorecards.js` | Creates initial scorecards from Neo4j user nodes |
| `updateNeo4j.js` / `updateNeo4jWithApoc.js` | Writes computed scores back to Neo4j |
| `calculatePersonalizedGrapeRank.sh` | Orchestrator that chains all steps |

### Data Files (at `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/`)
- `ratings.json` — `{context: {ratee_pk: {rater_pk: [rating, confidence]}}}`
- `scorecards.json` — `{pk: [influence, average, confidence, input]}`
- `scorecards_metadata.json` — Calculation stats

### Customer GrapeRank
- Same algorithm but per-customer, stored under `/var/lib/brainstorm/customers/{dir}/`
- Uses `@graperank/calculator` npm package as an alternative engine (`src/algos/importedGrapeRankEngine/`)

### Configurable Parameters (from `/etc/graperank.conf`)
| Parameter | Default | Range |
|-----------|---------|-------|
| RIGOR | 0.5 | 0.0–1.0 |
| ATTENUATION_FACTOR | 0.85 | 0.0–1.0 |
| FOLLOW_RATING | 1 | -1.0–1.0 |
| FOLLOW_CONFIDENCE | 0.03 | 0.0–1.0 |
| MUTE_RATING | -0.1 | -1.0–1.0 |
| MUTE_CONFIDENCE | 0.5 | 0.0–1.0 |

Three presets available: permissive, default, restrictive.

---

## 7. Concept Graph

### Key directories: `src/manage/concept-graph/`, `src/concept-graph/`

Handles **kind 39998** (concept definitions) and **kind 39999** (concept relationships) events — the DCoSL (Decentralized Curation of Simple Lists) protocol.

### `src/manage/concept-graph/batchTransfer.sh`
1. Uses `strfry scan` to export kinds [9998, 9999, 39998, 39999] events
2. `processTags.js` transforms event tags into structured JSONL
3. Loads into Neo4j as `NostrEvent` and `NostrEventTag` nodes with `:AUTHORS`, `:HAS_TAG`, `:REFERENCES` relationships
4. Creates cross-references between tags and `NostrUser`/`NostrEvent` nodes

### `src/concept-graph/parameters/defaults.json`
Contains concept UUIDs for built-in concept types (relationships, node types, sets, supersets, JSON schemas, properties) and relay configurations.

### Observations
- The concept graph is relatively self-contained
- Uses the same Neo4j instance as WoT data
- References external API at `https://straycat.brainstorm.social/api/knowledge-graph-query`

---

## 8. NIP-85 Trusted Assertions

### Key directories: `src/algos/nip85/`, `src/algos/customers/nip85/`

### What It Does
Publishes WoT scores as **kind 30382** events (Trusted Assertions) to Nostr relays, allowing other clients/relays to consume trust data.

### Key Files
| File | Purpose |
|------|---------|
| `publishNip85.sh` | Owner-level orchestrator |
| `publish_kind30382.js` | Creates and signs kind 30382 events from Neo4j data |
| `publish_nip85_10040.mjs` | Publishes kind 10040 (relay trust attestation) events |
| `customers/nip85/publishNip85.sh` | Per-customer publishing |
| `customers/nip85/publish_kind30382.js` | Customer-level 30382 publishing |

### Publishing Flow
1. Query Neo4j for users with hops < 20 and their scores
2. Create kind 30382 events signed with relay's private key (or customer's relay key)
3. Publish to configured NIP-85 relays and popular general-purpose relays

### Target Relays
- NIP-85 specialty: `wss://nip85.brainstorm.world`, `wss://nip85.nostr1.com`
- General: `wss://relay.nostr.band`, `wss://relay.damus.io`, `wss://relay.primal.net`

---

## 9. Customer System

### Key files: `src/utils/customerManager.js`, `customers/`

### Architecture
- Each customer = one Nostr pubkey (the "observer")
- Customers get **personalized** trust scores computed from their perspective
- Data stored in `/var/lib/brainstorm/customers/{customer_dir}/`
  - `preferences/graperank.conf`, `whitelist.conf`, `blacklist.conf`
  - `results/graperank/`, `pagerank/`, etc.
- Customer metadata in `/var/lib/brainstorm/customers/customers.json`

### CustomerManager Class
Full CRUD with:
- File locking (`proper-lockfile`) for concurrent access safety
- Caching (30s TTL)
- Atomic file writes (write temp → rename)
- Backup/restore with ZIP support
- Secure key storage integration
- Deletion with audit trail (`.deleted-backups/`)

### Customer Processing Pipeline
Per customer, runs:
1. `prepareNeo4jForCustomerData` — Creates metrics card nodes
2. `calculateCustomerHops` — Hop distances from customer's pubkey
3. `calculateCustomerPageRank` — Personalized PageRank via Neo4j GDS
4. `calculateCustomerGrapeRank` — Personalized GrapeRank
5. `processCustomerFollowsMutesReports` — Verified follower/muter/reporter counts
6. `exportCustomerKind30382` — Publish customer's NIP-85 assertions

### Subscription Tiers
Defined in customer data: `service_tier` (default "free"), `update_interval` (default 604800 = 1 week).

---

## 10. Negentropy Sync

### Key directory: `src/manage/negentropySync/`

Uses strfry's built-in **negentropy** protocol for efficient set reconciliation with remote relays.

### Sync Scripts
| Script | Syncs | Kinds | Source Relay |
|--------|-------|-------|-------------|
| `syncWoT.sh` | WoT data | 0, 3, 1984, 10000, 30000, 38000, 38172, 38173 | `wot.grapevine.network` |
| `syncProfiles.sh` | Profiles | 0 | `purplepag.es` |
| `syncPersonal.sh` | Owner's content | Various | Multiple relays |
| `syncDCoSL.sh` | Concept graph | 9998, 9999, 39998, 39999 | `dcosl.brainstorm.world` |

### Command Pattern
```bash
sudo strfry sync wss://$relay --filter '{"kinds": [...]}' --dir down
```

### Observations
- Sync is download-only (`--dir down`)
- Single hardcoded relay per sync type (not configurable without editing scripts)
- No retry logic beyond the task queue's timeout handling

---

## 11. Task Queue and Scheduling

### Key directory: `src/manage/taskQueue/`

### Two Systems

#### Legacy: `processAllTasks.sh`
- Sequential orchestrator called by systemd timer (every 12 hours by default)
- Runs child tasks in order: neo4jConstraints → syncWoT → batchTransfer → reconciliation → npubs → ownerScores → customerProcessing
- Uses `launchChildTask.sh` wrapper with structured logging

#### New: Task Queue Manager
- `taskQueueManager.sh` — Priority-based task orchestrator
- `taskScheduler.js` — Evaluates system state, queues by priority
- `taskExecutor.sh` — Executes queued tasks
- `systemStateGatherer.js` — Collects system state for dashboard

### Task Registry (`taskRegistry.json`)
Comprehensive JSON registry of ~40+ tasks with:
- Scripts, arguments, parent/child relationships
- Timeout durations, retry counts
- Structured logging status
- Priority and frequency metadata
- Error handling options (kill preexisting, restart, max retries)

### Structured Logging
- Events written to `events.jsonl`
- Event types: `TASK_START`, `TASK_END`, `TASK_ERROR`, `PROGRESS`, `CHILD_TASK_START/END/ERROR`, `HEALTH_ALERT`
- Utilities in `src/utils/structuredLogging.sh` and `.js`

### Health Monitoring
- `taskWatchdog.sh` — Detects stuck/orphaned tasks
- `systemResourceMonitor.sh` — System resources + Neo4j health
- `taskBehaviorMonitor.sh` — Anomaly detection
- `neo4jStabilityMonitor.sh` — Neo4j crash patterns, OOM detection

---

## 12. Frontend

### Key directory: `public/`

Static HTML/CSS/JS pages served by Express. Notable pages:

| Page | Purpose |
|------|---------|
| `index.html` | Landing/dashboard |
| `home.html` | Home dashboard |
| `profile.html` | User profile view |
| `nip85.html` | NIP-85 management |
| `about-trusted-assertions.html` | Educational page |
| `grapevine-analysis.html` | Grapevine visualization |
| `network-visualization-lite.html` | D3-based network graph |
| `neo4j-performance-metrics.html` | DB monitoring dashboard |
| `neo4j-error-logs.html` | Error log viewer |
| `whitelist-control-panel.html` | Whitelist management |
| `blacklist-control-panel.html` | Blacklist management |
| `graperank-control-panel.html` | GrapeRank config |
| `follow-recs*.html` | Follow recommendations |
| `service-management-dashboard.html` | Systemd service management |
| `task-watchdog-dashboard.html` | Task monitoring |
| `task-behavior-analytics-dashboard.html` | Task analytics |

### Frontend Tech
- Vanilla HTML/CSS/JS (no framework)
- Chart.js for visualizations
- D3.js for network graphs
- Fetches data from `/api/*` endpoints

---

## 13. Install and Setup

### `bin/install.js` — Main Installer
Interactive Node.js installer that:
1. Creates `/etc/brainstorm.conf` with user-provided values (domain, owner pubkey, neo4j password)
2. Creates `/etc/strfry-router.config`
3. Installs Neo4j (via `setup/install-neo4j.sh`)
4. Installs strfry (via `setup/install-strfry.sh`)
5. Sets up strfry write-policy plugins
6. Creates pipeline directories
7. Installs ~12 systemd service/timer units
8. Configures sudo privileges for `brainstorm` user
9. Sets up secure key storage
10. Generates Nostr relay identity

Supports `--use-empty-config` for non-interactive mode and `UPDATE_MODE=true` to preserve existing data.

### Neo4j Setup (`setup/install-neo4j.sh`)
- Installs **Neo4j 5.26.10** Community from Debian repo
- Installs **GDS 2.13.4** and **APOC 5.26.10** plugins
- Configures memory for 32GB servers (heap 11.7GB, pagecache 12GB)
- Enables G1GC with tuning, heap dump on OOM
- Sets initial password to `neo4jneo4j`
- Creates APOC config for file import

### Strfry Setup (`setup/install-strfry.sh`)
- Clones and compiles strfry from source
- Creates `strfry` user
- Configures Nginx reverse proxy (control panel at `/`, relay at `/relay`)
- Sets up Let's Encrypt SSL via certbot
- Creates systemd service

### Neo4j Constraints (`setup/neo4jConstraintsAndIndexes.sh`)
Creates constraints and indexes:
- `NostrUser.pubkey` — UNIQUE constraint
- `NostrUser.hops`, `.personalizedPageRank` — indexes
- `NostrEvent.id` — UNIQUE constraint
- `NostrEventTag.uuid` — UNIQUE constraint
- Customer-specific metric card indexes

### Key Directories Created
| Path | Purpose |
|------|---------|
| `/var/lib/brainstorm/` | Main data directory |
| `/var/lib/brainstorm/customers/` | Customer data |
| `/var/lib/brainstorm/pipeline/` | ETL pipeline queues |
| `/var/lib/brainstorm/algos/` | Algorithm temp files |
| `/var/lib/brainstorm/monitoring/` | Health monitoring data |
| `/var/lib/brainstorm/secure-keys/` | Encrypted key storage |
| `/var/log/brainstorm/` | Application logs |

---

## 14. External Dependencies

### System-level
| Dependency | Purpose | Install Method |
|-----------|---------|---------------|
| **strfry** | Nostr relay | Compiled from source |
| **Neo4j 5.26.x** | Graph database | Debian repo |
| **Neo4j GDS 2.13.4** | Graph algorithms (PageRank) | JAR download |
| **Neo4j APOC 5.26.10** | Utility procedures (batch import) | JAR download |
| **cypher-shell** | CLI for Neo4j queries | Comes with Neo4j |
| **Nginx** | Reverse proxy | apt |
| **certbot** | SSL certificates | apt |
| **jq** | JSON processing in bash | apt (assumed) |
| **Node.js ≥18** | Runtime via NVM | NVM |

### npm Dependencies (key ones)
| Package | Purpose |
|---------|---------|
| `@graperank/calculator` | Alternative GrapeRank engine |
| `@nostr-dev-kit/ndk` | Nostr event subscription |
| `neo4j-driver` | Neo4j JavaScript driver |
| `nostr-tools` | Nostr event signing, nip19 encoding |
| `express` | HTTP server |
| `proper-lockfile` | File-based locking |
| `archiver` / `extract-zip` | Backup compression |
| `ws` / `websocket` | WebSocket implementations |

---

## 15. Systemd Services

### Active Services
| Service | Purpose |
|---------|---------|
| `brainstorm-control-panel.service` | Express web server (User=brainstorm) |
| `strfry.service` | Strfry relay |
| `strfry-router.service` | Strfry negentropy router |
| `addToQueue.service` | Streaming event listener (NDK) |
| `processQueue.service` | Queue processor |
| `neo4j.service` | Neo4j database (managed by neo4j package) |

### Timer-based Services
| Timer | Service | Default Interval |
|-------|---------|-----------------|
| `processAllTasks.timer` | processAllTasks.service | 12 hours |
| `reconcile.timer` | reconcile.service | (configured) |
| `calculateHops.timer` | calculateHops.service | (configured) |
| `calculatePersonalizedPageRank.timer` | ... | (configured) |
| `calculatePersonalizedGrapeRank.timer` | ... | (configured) |
| `brainstorm-monitoring-scheduler.timer` | ... | (configured) |

### Service User
All brainstorm services run as user `brainstorm` with NVM-managed Node.js via `/usr/local/bin/brainstorm-node` wrapper.

---

## 16. Code Quality Observations

### Strengths
- **Comprehensive task registry** with detailed metadata for every background task
- **Structured logging** throughout with JSON events — very helpful for monitoring
- **Atomic file operations** in CustomerManager (write-to-temp + rename)
- **File locking** for concurrent access to customers.json
- **Extensive API surface** — well-organized with separate modules per domain
- **Good documentation** in code comments and about.md files

### Concerns
1. **Heavy use of shell scripts for core logic** — ~80% of the pipeline and algorithm orchestration is in bash. Makes testing, error handling, and portability harder.
2. **Hardcoded absolute paths everywhere** — `/etc/brainstorm.conf`, `/var/lib/brainstorm/`, `/usr/local/lib/node_modules/brainstorm/`, etc. are hardcoded in dozens of files. No central path resolution.
3. **`sudo` calls in application code** — Many scripts use `sudo strfry scan`, `sudo cypher-shell`, `sudo chown`. Requires specific sudoers configuration.
4. **No test coverage for core algorithms** — Test directory has basic test files and Playwright E2E tests, but no unit tests for GrapeRank, ETL, or Neo4j operations.
5. **Duplicate/backup files in tree** — Many `*_backup*.js`, `*_deprecated*.sh`, `*_copy.*` files committed. Suggests frequent experimentation without cleanup.
6. **Config file parsed differently in different places** — `lib/config.js` and `src/utils/config.js` both parse `/etc/brainstorm.conf` with different approaches (regex vs. `source`). TODO note acknowledges they should be merged.
7. **Shell-to-Neo4j pipeline fragility** — Data flows through temp files in `/var/lib/neo4j/import/` with `sudo mv` and manual cleanup. Race conditions possible.
8. **No containerization support** — Designed entirely for bare-metal Ubuntu with systemd.

---

## 17. Docker Considerations

### Major Challenges

#### A. Multi-process Architecture
Brainstorm requires **5+ separate processes**:
- strfry relay
- Neo4j database
- Express control panel
- addToQueue (NDK listener)
- processQueue (queue processor)
- Periodic task timers

**Approach:** Use `docker-compose` with separate containers for strfry, Neo4j, and the brainstorm app (which runs control panel + workers).

#### B. Hardcoded Paths
Nearly every shell script references absolute paths. Options:
1. **Mount volumes at expected paths** — Easiest. Mount config at `/etc/brainstorm.conf`, data at `/var/lib/brainstorm/`, etc.
2. **Rewrite paths to use env vars** — Better long-term but massive refactor.
3. **Symlink approach** — Create symlinks in container from expected paths to actual locations.

**Recommended:** Option 1 (volume mounts) for initial Docker support.

#### C. `sudo` Usage
Many scripts call `sudo strfry scan`, `sudo cypher-shell`, etc. In Docker containers running as root (or the target user), `sudo` is unnecessary and may fail.

**Fixes needed:**
- Remove `sudo` from strfry commands (run as strfry user or root)
- Remove `sudo` from cypher-shell commands (configure Neo4j auth)
- Remove `sudo chown` calls (set ownership via Dockerfile/entrypoint)

#### D. systemd Replacement
Docker doesn't use systemd. Need to replace:
- Timer-based services → cron jobs or a process manager (supervisord, s6-overlay)
- Service management API endpoints → direct process control or healthchecks

#### E. Neo4j Configuration
- Neo4j 5.26.x has an official Docker image (`neo4j:5.26-community`)
- GDS and APOC plugins need to be added to the image or mounted
- APOC config (`apoc.conf`) needs to be mounted at `/var/lib/neo4j/conf/`
- Import directory at `/var/lib/neo4j/import/` needs to be shared between containers

#### F. strfry
- No official Docker image; needs to be compiled in a build stage
- Data directory at `/var/lib/strfry` needs persistent volume
- Config at `/etc/strfry.conf` needs mounting

### Proposed Docker Compose Structure

```yaml
services:
  neo4j:
    image: neo4j:5.26-community
    volumes:
      - neo4j-data:/data
      - neo4j-import:/var/lib/neo4j/import
      - ./setup/apoc.conf:/var/lib/neo4j/conf/apoc.conf
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["graph-data-science", "apoc"]
    ports:
      - "7474:7474"
      - "7687:7687"

  strfry:
    build: ./docker/strfry
    volumes:
      - strfry-data:/var/lib/strfry
      - ./setup/strfry.conf.template:/etc/strfry.conf
    ports:
      - "7777:7777"

  brainstorm:
    build: .
    volumes:
      - ./:/app
      - brainstorm-data:/var/lib/brainstorm
      - neo4j-import:/var/lib/neo4j/import  # shared
      - brainstorm-logs:/var/log/brainstorm
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - BRAINSTORM_RELAY_URL=ws://strfry:7777
    ports:
      - "7778:7778"
    depends_on:
      - neo4j
      - strfry
```

### Key Changes Needed for Docker
1. **Replace `sudo` calls** in all scripts (grep shows ~100+ occurrences)
2. **Make NEO4J_URI configurable** to point to `neo4j` container (already partly supported via config)
3. **Replace `strfry` binary path** or ensure it's on PATH
4. **Replace systemd timers** with cron, supervisord, or similar
5. **Share Neo4j import directory** between containers via volume
6. **Create entrypoint script** that runs control panel + addToQueue + processQueue
7. **Handle strfry `scan` commands** — these need access to strfry's LMDB, so batch pipeline scripts must run in the strfry container or share the volume
8. **Config file generation** — Entrypoint should generate `/etc/brainstorm.conf` from environment variables

### Estimated Effort
- **Phase 1 (Docker basics):** 2-3 days — Dockerfile, docker-compose, volume mounts, config from env vars
- **Phase 2 (sudo removal + path fixes):** 3-5 days — Audit and fix all scripts
- **Phase 3 (Full orchestration):** 2-3 days — Replace systemd, handle multi-process, health checks
- **Total:** ~1-2 weeks for a solid Docker deployment
