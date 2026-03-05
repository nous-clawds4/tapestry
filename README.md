# Tapestry

A local-first knowledge graph for [nostr](https://nostr.com), implementing the **tapestry protocol** for decentralized curation of simple lists (DCoSL) and personalized web of trust metrics using the GrapeRank algorithm.

This is a fork of the [Brainstorm](https://github.com/pretty-good-freedom-tech/brainstorm) prototype, now being rebuilt by the team at [NosFabrica](https://nosfabrica.com). Development is focused on the **concept graph** — a structured knowledge graph built from nostr events (DLists), stored in Neo4j, and browsable through a React UI.

Tapestry runs locally in a Docker container. You own your data. It's designed to be operated by **humans** through the browser UI, or by **AI agents** through the CLI and API.

---

## Quickstart

### Prerequisites

- **Docker Desktop** (or Docker Engine + Compose) — [install](https://docs.docker.com/get-docker/)
- **Git**
- A **nostr key** and a **NIP-07 browser extension** (e.g., [nos2x](https://github.com/nickhntv/nos2x-fox), [Alby](https://getalby.com), or [Nostr Connect](https://github.com/nickhntv/nos2x))

### 1. Clone the repository

```bash
git clone https://github.com/nous-clawds4/tapestry.git
cd tapestry
git checkout concept-graph
```

### 2. Configure environment

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Your nostr public key (hex format, not npub)
OWNER_PUBKEY=your_hex_pubkey_here

# Choose a strong password for Neo4j
NEO4J_PASSWORD=change_me_to_something_secure
```

> **How to find your hex pubkey:** If you only have your `npub`, you can convert it at [njump.me](https://njump.me) or using the `nak` CLI: `nak key decode npub1...`

### 3. Build and start

```bash
docker compose up -d
```

The first build takes 10–15 minutes (compiling strfry, installing Neo4j, etc.). Subsequent starts are fast.

### 4. Verify it's running

```bash
docker compose logs -f
```

Wait until you see the brainstorm service start. Then open:

- **Control Panel:** [http://localhost:8080](http://localhost:8080)
- **Knowledge Graph UI:** [http://localhost:8080/kg/](http://localhost:8080/kg/)
- **Neo4j Browser:** [http://localhost:8080/browser/preview/](http://localhost:8080/browser/preview/) (user: `neo4j`, password: what you set above)
- **Nostr Relay:** `ws://localhost:8080/relay`

### 5. Sign in

1. Open the Knowledge Graph UI at [http://localhost:8080/kg/](http://localhost:8080/kg/)
2. Click **"Sign in with Nostr"** in the top right
3. Your NIP-07 extension will prompt you to approve
4. You should see your name and an **Owner** badge

### 6. Import data from the DCoSL relay

Your Tapestry instance starts with an empty database. To import existing DList data from the DCoSL network:

```bash
# Sync DList events from the DCoSL relay into your local strfry
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' \
  --dir down
```

> **Note:** A more streamlined import workflow is coming soon. For now, you can also use the **tapestry-cli** tool to sync and normalize data into Neo4j.

---

## Development Setup

For active development, use the dev compose override which bind-mounts your local code:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

After editing server-side code, restart the brainstorm service:

```bash
docker compose exec tapestry supervisorctl restart brainstorm
```

### React UI Development

The React frontend lives in `ui/` and uses Vite:

```bash
cd ui
npm install
npx vite --host
```

This starts a dev server at [http://localhost:5173/kg/](http://localhost:5173/kg/) with hot module replacement. API requests are proxied to the Docker container on port 8080.

---

## Architecture

Tapestry runs as a single Docker container with several services managed by supervisord:

| Service | Purpose |
|---------|---------|
| **Express** (brainstorm) | API server, serves the control panel and Knowledge Graph UI |
| **strfry** | Local nostr relay — stores all events (DLists, profiles, etc.) |
| **Neo4j** | Graph database — concept graph, relationships, trust scores |
| **nginx** | Reverse proxy — all services accessed via port 8080 |

### Key concepts

- **DLists (Decentralized Lists):** Nostr events (kinds 9998/39998 for headers, 9999/39999 for items) that define structured data — lists of things curated by your web of trust
- **Concept Graph:** DList headers that follow the tapestry protocol form a knowledge graph in Neo4j with node types, relationship types, properties, and JSON schemas
- **Two-layer settings:** Shipped defaults (`src/concept-graph/parameters/defaults.json`) merged with user overrides (`/var/lib/brainstorm/settings.json`), configurable via the Settings page

### Data flow

```
External relays (DCoSL, purplepag.es, etc.)
        ↓ sync
   Local strfry (ws://localhost:8080/relay)
        ↓ import + normalize
   Neo4j concept graph
        ↓ query
   React UI (port 8080/kg/)
```

---

## What's in the UI

| Page | Description |
|------|-------------|
| **📋 Simple Lists** | Browse all DList headers with item counts, author profiles, Neo4j sync status |
| **🧩 Concepts** | Concept graph — node types, properties, schemas, DAG structure |
| **📡 Events** | Browse nostr events by type |
| **🔵 Nodes** | All Neo4j nodes with labels and relationships |
| **👤 Nostr Users** | User directory with profiles fetched from external relays |
| **🔗 Relationships** | Neo4j relationship browser |
| **🛡️ Trusted Lists** | (Coming soon) WoT-curated list views |
| **⚙️ Settings** | Owner-only — configure relays, concept UUIDs, system parameters |

---

## Configuration

### Environment variables (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OWNER_PUBKEY` | ✅ | Your nostr hex pubkey — determines who is the "Owner" in the UI |
| `NEO4J_PASSWORD` | ✅ | Password for Neo4j (used by the API server) |
| `DOMAIN_NAME` | Optional | Domain name for the instance (default: `localhost`) |

### Settings system

Tapestry uses a two-layer configuration:

1. **Defaults** (`src/concept-graph/parameters/defaults.json`) — shipped with the code, includes relay lists and canonical concept UUIDs
2. **User overrides** (`/var/lib/brainstorm/settings.json`) — persistent Docker volume, written by the Settings page

Changes to relay lists take effect immediately. Changes to concept UUIDs or system parameters require a restart.

---

## Agent Setup (for AI agents)

Tapestry can be operated by AI agents (e.g., under [OpenClaw](https://github.com/openclaw/openclaw)). In addition to the Docker stack, agents need:

1. **[tapestry-cli](https://github.com/nous-clawds4/tapestry-cli)** — command-line tool for querying, syncing, and managing the instance
2. **Tapestry skill** — teaches the agent the API, schema, and workflows

See [Agent Setup](docs/QUICKSTART.md#agent-setup) in the Quickstart guide for installation instructions.

---

## Ports

| Port | Service | Notes |
|------|---------|-------|
| 8080 | Express API + UI | Main entry point — all services proxied through here |
| 5173 | Vite dev server | Only during development (`npx vite`) |

All services are accessed through the nginx proxy on port 8080:

| Path | Service | Notes |
|------|---------|-------|
| `/kg/` | Knowledge Graph UI | React app |
| `/browser/preview/` | Neo4j Browser | Database access (user: `neo4j`) |
| `/relay` | strfry relay | Local nostr relay (WebSocket: `ws://localhost:8080/relay`) |
| `/api/` | Express API | REST endpoints |

---

## License

GNU Affero General Public License v3.0

## Contributing

Contributions are welcome! Please feel free to submit comments, bug reports and issues. If you would like to submit a pull request, please create a new issue first and describe the changes you would like to make.
