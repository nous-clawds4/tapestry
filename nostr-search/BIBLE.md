# Nostr Search — BIBLE

> Full-text search engine for nostr kind 0 profiles. Sub-10ms queries across 750K+ profiles.
> Designed as a microservice that integrates with Tapestry's existing strfry relay.

---

## What This Does

Indexes **all kind 0 (profile metadata) events** from a configurable nostr relay into Meilisearch, a full-text search engine. Users can search by name, display_name, nip05, about, lightning address, website, or any field in a kind 0 event. Results return in <10ms with typo tolerance and prefix matching.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Tapestry Stack                         │
│                                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │            tapestry container                 │        │
│  │  ┌────────┐  ┌───────┐  ┌────────┐  ┌─────┐│        │
│  │  │ strfry │  │ Neo4j │  │Express │  │nginx ││        │
│  │  │ :7777  │  │ :7474 │  │  :80   │  │     ││        │
│  │  └───┬────┘  └───────┘  └────────┘  └─────┘│        │
│  └──────┼───────────────────────────────────────┘        │
│         │                                                │
│         │ strfry scan (JSONL pipe via docker exec)        │
│         ▼                                                │
│  ┌─────────────┐    ┌────────────┐                       │
│  │ meilisearch │◀───│    api     │──▶ :3069 (HTTP)       │
│  │   :7700     │    │ (express + │                       │
│  │ (search     │    │  static UI)│                       │
│  │  engine)    │    └────────────┘                       │
│  └─────────────┘                                         │
│                                                          │
│  sync.sh: strfry sync + scan → ingest-stdin.js → meili  │
└──────────────────────────────────────────────────────────┘
```

### Containers (added by nostr-search)

| Container | Image | Role | Port |
|-----------|-------|------|------|
| `nostr-search-meili` | `getmeili/meilisearch:v1.12` | Full-text search index | 7700 |
| `nostr-search-api` | Custom (Node 22 Alpine) | REST API + static search UI | 3069 |

### Sync (uses Tapestry's existing strfry)

No dedicated sync container. Instead, `sync.sh` runs on the host and:

1. Calls `docker exec tapestry strfry sync <relay> --filter '{"kinds":[0]}' --dir down` to pull kind 0 events via negentropy
2. Calls `docker exec tapestry strfry scan '{"kinds":[0]}'` to export as JSONL
3. Pipes into `node src/ingest-stdin.js` which batch-upserts into Meilisearch

This avoids duplicating strfry. Tapestry's strfry stores the events in its existing LMDB; Meilisearch indexes them for search.

Run `sync.sh` manually or via cron for periodic updates.

---

## Quick Start

```bash
# Prerequisites: Tapestry must be running
cd nostr-search

# Start Meilisearch + API
docker compose up -d

# Run initial sync (pulls kind 0 from relay into strfry, then indexes in Meilisearch)
bash sync.sh

# Open search UI
open http://localhost:3069
```

Or use the combined start script:

```bash
bash start.sh
```

### Periodic Sync via Cron

```bash
# Sync every 10 minutes
*/10 * * * * cd /path/to/nostr-search && bash sync.sh >> /var/log/nostr-search-sync.log 2>&1
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYNC_RELAY_URL` (arg to sync.sh) | `wss://wot.grapevine.network` | Relay to sync kind 0 events from |
| `CONTAINER` (env for sync.sh) | `tapestry` | Docker container name running strfry |
| `MEILI_URL` (env for sync.sh) | `http://localhost:7700` | Meilisearch URL |
| `API_PORT` (env for compose) | `3069` | Host port for the search API |
| `MEILI_PORT` (env for compose) | `7700` | Host port for Meilisearch |
| `MEILI_ENV` (env for compose) | `development` | Set to `production` + provide `MEILI_MASTER_KEY` for prod |

---

## API Reference

### `GET /api/search?q=<query>&limit=<n>&offset=<n>`

Full-text search across all kind 0 profile fields.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | required | Search query (supports typos, prefixes) |
| `limit` | int | 20 | Max results (max 100) |
| `offset` | int | 0 | Pagination offset |

**Response:**

```json
{
  "hits": [
    {
      "id": "<hex pubkey>",
      "pubkey": "<hex pubkey>",
      "npub": "npub1...",
      "created_at": 1711234567,
      "name": "Alice",
      "display_name": "Alice ⚡",
      "nip05": "alice@example.com",
      "about": "Nostr enthusiast",
      "picture": "https://...",
      "banner": "https://...",
      "lud16": "alice@walletofsatoshi.com",
      "lud06": "",
      "website": "https://alice.dev",
      "username": ""
    }
  ],
  "query": "alice",
  "processingTimeMs": 2,
  "estimatedTotalHits": 342,
  "limit": 20,
  "offset": 0
}
```

**Key fields in each hit:**

| Field | Description |
|-------|-------------|
| `id` / `pubkey` | Hex public key (primary identifier) |
| `npub` | Bech32-encoded public key (for display) |
| `name` | Profile name |
| `display_name` | Display name (may differ from name) |
| `nip05` | NIP-05 identifier (e.g., `alice@example.com`) |
| `about` | Profile bio/description |
| `picture` | Avatar URL |
| `banner` | Banner image URL |
| `lud16` | Lightning address (LNURL) |
| `website` | Website URL |
| `created_at` | Unix timestamp of the kind 0 event |
| `processingTimeMs` | Meilisearch query time in milliseconds |
| `estimatedTotalHits` | Total matching profiles (capped at 1000) |

### `GET /api/stats`

Index statistics.

**Response:**

```json
{
  "numberOfDocuments": 765725,
  "isIndexing": false,
  "fieldDistribution": { "name": 765725, "about": 765725, ... }
}
```

---

## Meilisearch Index Schema

**Index name:** `profiles`
**Primary key:** `id` (hex pubkey)

### Searchable Attributes (in weight order)

1. `name` — profile name (highest weight)
2. `display_name` — display name
3. `displayName` — alternate casing (some clients use this)
4. `username` — username field
5. `nip05` — NIP-05 identifier
6. `npub` — bech32-encoded public key
7. `about` — profile bio/description
8. `lud16` — Lightning address
9. `website` — website URL

### Search Features

- **Typo tolerance**: 1 typo for words ≥3 chars, 2 typos for words ≥6 chars
- **Prefix search**: All searchable fields
- **Ranking**: words → typo → proximity → attribute → sort → exactness

---

## Integration Guide

### From Tapestry's Express Server

Add a search endpoint to Tapestry's API that proxies to nostr-search:

```javascript
// In Tapestry's Express routes
app.get('/api/search/profiles', async (req, res) => {
  const { q, limit = 20 } = req.query;
  const result = await fetch(
    `http://localhost:3069/api/search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
  res.json(await result.json());
});
```

### From Any External Service

```bash
curl "http://localhost:3069/api/search?q=alice&limit=5"
```

### Direct Meilisearch Access (Advanced)

For more control (custom filters, facets), query Meilisearch directly:

```javascript
import { MeiliSearch } from 'meilisearch';
const meili = new MeiliSearch({ host: 'http://localhost:7700' });
const results = await meili.index('profiles').search('alice', {
  limit: 10,
  attributesToRetrieve: ['pubkey', 'npub', 'name', 'nip05', 'picture'],
});
```

### Adding Services to Tapestry's docker-compose.yml

To fully integrate, add these to Tapestry's existing `docker-compose.yml`:

```yaml
services:
  # ... existing tapestry service ...

  nostr-search-meili:
    image: getmeili/meilisearch:v1.12
    volumes:
      - nostr-search-meili:/meili_data
    environment:
      - MEILI_ENV=development
      - MEILI_NO_ANALYTICS=true
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nostr-search-api:
    build:
      context: ./nostr-search
      dockerfile: Dockerfile
    ports:
      - "3069:3069"
    environment:
      - MEILI_URL=http://nostr-search-meili:7700
    depends_on:
      nostr-search-meili:
        condition: service_healthy
    restart: unless-stopped

volumes:
  # ... existing volumes ...
  nostr-search-meili:
```

---

## File Structure

```
nostr-search/
├── BIBLE.md                # This file
├── docker-compose.yml      # Meilisearch + API containers
├── Dockerfile              # API server image (Node 22 Alpine)
├── .dockerignore
├── .env.example            # Environment variable reference
├── .gitignore
├── package.json
├── package-lock.json
├── start.sh                # Start stack + initial sync
├── sync.sh                 # Sync kind 0 from relay via Tapestry's strfry
├── src/
│   ├── search.js           # Express API (GET /api/search, GET /api/stats)
│   ├── ingest-stdin.js     # JSONL stdin → Meilisearch (used by sync.sh)
│   └── ingest.js           # WebSocket live ingester (optional, for real-time)
└── public/
    └── index.html          # Search UI (vanilla HTML/CSS/JS, dark theme)
```

## Key Design Decisions

1. **Meilisearch over Elasticsearch**: 10x less RAM, simpler ops, sub-10ms at 750K+ docs. Purpose-built for this scale.

2. **Reuse Tapestry's strfry**: No duplicate relay. `sync.sh` calls `docker exec tapestry strfry sync/scan` to leverage the existing LMDB store and negentropy implementation.

3. **Negentropy sync over WebSocket REQ**: Set reconciliation — only transfers events you don't have. Incremental syncs take seconds, not minutes.

4. **Batch upsert with pubkey dedup**: Kind 0 is replaceable. We always keep the latest `created_at` per pubkey.

5. **Searchable attribute weighting**: `name` ranked highest; `about` lowest (noisier matches).

6. **No dedicated sync container**: Keeps the footprint minimal. `sync.sh` runs on-demand or via cron. The alternative (`ingest.js` WebSocket) is included for real-time use cases.

## Performance

Benchmarked with 765,725 profiles from `wss://wot.grapevine.network`:

| Metric | Value |
|--------|-------|
| Search latency (p99) | <10ms |
| Typo-tolerant search | <10ms |
| Full re-index from strfry export | ~14 seconds |
| Negentropy sync (incremental) | <30 seconds |
| Negentropy sync (initial, 750K events) | ~5 minutes |
| Meilisearch RAM at 765K docs | ~1.2GB |

## Recommended Server Specs

| Profiles | RAM | Notes |
|----------|-----|-------|
| <100K | 2GB | Works alongside Tapestry on small VPS |
| 500K-1M | 4GB | Dedicated to search, consistent sub-5ms |
| 1M+ | 8GB | Headroom for growth + co-located services |
