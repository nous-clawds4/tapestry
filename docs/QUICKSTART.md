# Quickstart Guide

Get Tapestry running locally in under 15 minutes.

## Humans and Agents

Tapestry is designed to be operated by **humans** and **AI agents** alike. Everything you can do through the UI, an agent can do through the API — and vice versa.

- **If you're a human:** Follow this guide. The browser UI at `/kg/` is your main interface.
- **If you're an AI agent** (e.g., running under [OpenClaw](https://github.com/openclaw/openclaw)): You'll also want the **tapestry-cli** and the **Tapestry skill** — see [Agent Setup](#agent-setup) at the end of this guide.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Docker Desktop** | Any recent | [Install](https://docs.docker.com/get-docker/). Make sure Docker Compose v2 is included. |
| **Git** | Any | For cloning the repo |
| **Nostr keypair** | — | Your `npub` / hex pubkey. If you don't have one, create one with [Alby](https://getalby.com) or any nostr client. |
| **NIP-07 extension** | — | Browser extension for signing. Recommended: [nos2x](https://github.com/nickhntv/nos2x-fox) (Firefox), [Alby](https://getalby.com) (Chrome/Firefox), or [Nostr Connect](https://github.com/nickhntv/nos2x) |

### Resource requirements

- **Disk:** ~2 GB for the Docker image + data
- **RAM:** 4 GB minimum (Neo4j is the main consumer)
- **CPU:** Any modern machine. First build compiles strfry from source (~10 min).

## Step 1: Clone

```bash
git clone https://github.com/nous-clawds4/tapestry.git
cd tapestry
git checkout concept-graph
```

## Step 2: Configure

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
OWNER_PUBKEY=your_hex_pubkey_here
NEO4J_PASSWORD=change_me_to_something_secure
```

**Finding your hex pubkey:**

If you only have your `npub`, convert it:

- **Web:** Paste your npub at [njump.me](https://njump.me) — the hex key is shown on the profile page
- **CLI:** `nak key decode npub1yourkey...` (if you have [nak](https://github.com/fiatjaf/nak) installed)
- **Python:** `from nostr.key import PublicKey; print(PublicKey.from_npub("npub1...").hex())`

## Step 3: Build and start

```bash
docker compose up -d
```

**First run:** The Docker image builds from scratch. This takes 10–15 minutes because it:
1. Compiles strfry (C++ nostr relay) from source
2. Installs Neo4j 5.x
3. Installs Node.js dependencies

**Subsequent starts** are fast (seconds).

### Watch the logs

```bash
docker compose logs -f
```

You'll see strfry, Neo4j, and the brainstorm Express server start up. Wait until you see output from the brainstorm service before proceeding.

Press `Ctrl+C` to stop watching logs (the container keeps running).

## Step 4: Verify

Open these URLs in your browser:

| URL | What you should see |
|-----|---------------------|
| [http://localhost:8080](http://localhost:8080) | Brainstorm control panel |
| [http://localhost:8080/kg/](http://localhost:8080/kg/) | Knowledge Graph UI (dark theme, sidebar nav) |
| [http://localhost:7474](http://localhost:7474) | Neo4j Browser (login with `neo4j` / your password) |

## Step 5: Sign in

1. Open [http://localhost:8080/kg/](http://localhost:8080/kg/)
2. Click **"Sign in with Nostr"** in the top-right corner
3. Your NIP-07 extension will pop up asking you to approve
4. After signing, you should see your **name**, **avatar**, and an **Owner** badge

> If you see "Guest" instead of "Owner", double-check that the `OWNER_PUBKEY` in `.env` matches the hex pubkey of the key loaded in your NIP-07 extension.

## Step 6: Import data

Your instance starts empty. Import existing DList data from the DCoSL relay:

```bash
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' \
  --dir down
```

This pulls all DList headers and items from the DCoSL network into your local strfry. You should see sync progress in the output.

After syncing, go to **📋 Simple Lists** in the UI — you should see the imported lists.

### Import into Neo4j

The strfry sync gets events into your local relay. To build the concept graph in Neo4j, you'll need the **tapestry-cli** tool (documentation coming soon). For now, you can use the **Neo4j import** buttons on individual list detail pages in the UI.

## Step 7: Explore

- **📋 Simple Lists** — Browse DList headers, see items, check Neo4j sync status
- **🧩 Concepts** — Explore the concept graph (after Neo4j import)
- **👤 Nostr Users** — See all users who have authored events
- **⚙️ Settings** — Configure relay lists, concept UUIDs (owner only)

## Troubleshooting

### Container won't start

```bash
# Check container status
docker compose ps

# View logs
docker compose logs tapestry

# Restart
docker compose restart
```

### "Sign in" doesn't work

- Make sure your NIP-07 extension is active on the page
- Check the browser console for errors
- Try a hard refresh (`Ctrl+Shift+R`)

### Neo4j won't connect

```bash
# Check if Neo4j is running inside the container
docker compose exec tapestry supervisorctl status

# Restart Neo4j
docker compose exec tapestry supervisorctl restart neo4j
```

### Reset everything

```bash
# Stop and remove containers + volumes (⚠️ deletes all data)
docker compose down -v
docker compose up -d
```

## Agent Setup

If you're an AI agent (or setting up Tapestry for an agent to operate), you'll need two additional pieces:

### tapestry-cli

A command-line tool for querying, syncing, and managing the Tapestry instance.

```bash
# Clone the CLI repo
git clone https://github.com/nous-clawds4/tapestry-cli.git
cd tapestry-cli

# Install dependencies and link globally
npm install
npm link
```

You should now have the `tapestry` command available:

```bash
tapestry status        # Check all services
tapestry query "MATCH (n) RETURN count(n) AS total"   # Run Cypher
tapestry sync          # Sync events from external relays into strfry + Neo4j
tapestry normalize check  # Check normalization rules
```

The CLI talks to `http://localhost:8080` by default (configurable via `TAPESTRY_API_URL` env var).

### OpenClaw Tapestry Skill

If running under [OpenClaw](https://github.com/openclaw/openclaw), install the Tapestry skill so your agent knows how to interact with the instance:

```bash
# Copy the skill into your OpenClaw skills directory
cp -r tapestry-cli/skill /path/to/openclaw/skills/tapestry
```

The skill (`SKILL.md`) teaches the agent:
- How to query the concept graph via Cypher
- Available API endpoints and their usage
- Neo4j schema (node labels, relationship types, tag conventions)
- Common query patterns for concepts, items, and users
- Event sync workflows (check, import, update)

With the Docker stack running, the CLI installed, and the skill loaded, an agent can fully operate a Tapestry instance — querying the knowledge graph, syncing data from external relays, creating and publishing DList events, and managing the concept graph.

## Next steps

- [Architecture Guide](ARCHITECTURE.md) — understand the system design
- [Configuration Guide](CONFIGURATION.md) — detailed settings reference
- [Development Guide](DEVELOPMENT.md) — contribute or extend Tapestry
