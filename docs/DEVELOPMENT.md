# Development Guide

## Setup

### Dev mode (bind-mount local code)

Use the dev compose override to mount your local repo into the container:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This bind-mounts the repo at `/usr/local/lib/node_modules/brainstorm` inside the container, so edits to server-side code are reflected immediately after restarting the service:

```bash
docker compose exec tapestry supervisorctl restart brainstorm
```

### React UI (Vite dev server)

The frontend lives in `ui/` and uses Vite for development:

```bash
cd ui
npm install
npx vite --host
```

This starts a dev server at [http://localhost:5173/kg/](http://localhost:5173/kg/) with hot module replacement. API requests are proxied to the Docker container on port 8080 (configured in `ui/vite.config.js`).

> **Known issue:** The Vite dev server gets SIGKILL'd approximately every 30 minutes, likely due to memory pressure. Just restart it when this happens. The production build (served by Express at `:8080/kg/`) is not affected.

### Building for production

```bash
cd ui
npm run build
```

This outputs to `ui/dist/`, which is served by the Express server at `/kg/`.

## Project Structure

```
tapestry/
├── docker-compose.yml          # Production compose
├── docker-compose.dev.yml      # Dev override (bind-mounts code)
├── Dockerfile                  # Container build
├── README.md
├── docs/                       # Documentation
│   ├── QUICKSTART.md
│   ├── ARCHITECTURE.md
│   ├── CONFIGURATION.md
│   ├── DEVELOPMENT.md          # (this file)
│   └── legacy/                 # Old Brainstorm docs
│
├── src/                        # Server-side code
│   ├── api/                    # Express API endpoints
│   │   ├── index.js            # Route registration
│   │   ├── auth/               # NIP-07 authentication
│   │   ├── neo4j/              # Neo4j queries + event sync
│   │   ├── profiles/           # Profile fetching from external relays
│   │   ├── settings/           # Settings API (owner-only)
│   │   └── strfry/             # Strfry scan + publish
│   ├── config/
│   │   └── settings.js         # Two-layer settings loader
│   └── concept-graph/
│       └── parameters/
│           ├── defaults.json   # Shipped defaults (git-tracked)
│           └── defaults.conf   # Legacy shell format (deprecated)
│
├── ui/                         # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx             # Router (all routes under /kg)
│   │   ├── main.jsx            # Entry point
│   │   ├── styles.css          # Global styles (dark theme)
│   │   ├── api/                # API clients (relay, cypher)
│   │   ├── components/         # Shared components
│   │   │   ├── AuthorCell.jsx  # Clickable author with avatar
│   │   │   ├── Breadcrumbs.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── Header.jsx      # Auth UI + user dropdown
│   │   │   └── Layout.jsx      # Sidebar + main content
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # NIP-07 auth state
│   │   ├── hooks/
│   │   │   ├── useCypher.js    # Neo4j query hook
│   │   │   └── useProfiles.js  # Profile fetching with cache
│   │   └── pages/              # Route pages
│   │       ├── concepts/       # Concept graph browser
│   │       ├── events/         # Event browser
│   │       ├── lists/          # DList browser + forms
│   │       ├── nodes/          # Neo4j node browser
│   │       ├── settings/       # Settings page (owner-only)
│   │       └── users/          # Nostr user directory
│   └── vite.config.js          # Vite config (proxy to :8080)
│
└── scripts/                    # Build + setup scripts
```

## Adding a new page

1. **Create the component** in `ui/src/pages/<section>/`
2. **Add the route** in `ui/src/App.jsx` — nest under the appropriate parent
3. **Add to sidebar** (if top-level) in `ui/src/components/Layout.jsx`
4. Breadcrumbs work automatically from route `handle.crumb` properties

## Adding a new API endpoint

1. **Create the handler** in `src/api/<module>/`
2. **Register the route** in `src/api/index.js`
3. **Restart brainstorm:** `docker compose exec tapestry supervisorctl restart brainstorm`

### Auth middleware

For owner-only endpoints, use `requireOwner` from `src/api/settings/settingsApi.js`:

```javascript
const { requireOwner } = require('./settings/settingsApi');
app.get('/api/my-endpoint', requireOwner, handler);
```

## Useful commands

```bash
# View container services
docker compose exec tapestry supervisorctl status

# Restart a specific service
docker compose exec tapestry supervisorctl restart brainstorm
docker compose exec tapestry supervisorctl restart neo4j

# Run a Cypher query
docker compose exec tapestry bash -c "echo 'MATCH (n) RETURN count(n)' | cypher-shell -u neo4j -p <password>"

# Scan strfry events
docker compose exec tapestry strfry scan '{"kinds":[39998]}'

# Sync from an external relay
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' --dir down

# Check container resource usage
docker stats tapestry
```

## Conventions

- **Dark theme:** All UI uses CSS variables defined in `styles.css` (e.g., `var(--bg-primary)`, `var(--text)`, `var(--accent)`)
- **Author display:** Always use the shared `AuthorCell` component — it shows avatar + name and links to the user profile
- **Profile fetching:** Use the `useProfiles` hook — it handles caching and async loading
- **Tables:** Use the `DataTable` component for consistent styling and row click behavior
- **Neo4j queries:** Use the `useCypher` hook for React components, or `GET /api/neo4j/run-query?cypher=` for server-side
