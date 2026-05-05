# Tapestry — Agent Guide

This file is for AI agents working on the Tapestry codebase. Read it before doing anything else.

---

## 1. Find the local instance's port and TA pubkey first

The control panel API runs on a port set by `CONTROL_PANEL_PORT` in `/etc/brainstorm.conf` (a Tapestry deployment generates this from `config/brainstorm.conf.template` at first container startup). The default in the template is `7778`, but **don't assume it** — different deployments and dev setups override it. Find it before you start:

```bash
# Preferred — the running config
grep -E '^export CONTROL_PANEL_PORT=' /etc/brainstorm.conf 2>/dev/null \
  || grep -E '^export CONTROL_PANEL_PORT=' config/brainstorm.conf.template
```

Set it as an env var for the rest of the session so the examples below work:

```bash
export TAPESTRY_PORT=<the value you found>
```

You will also need the **Tapestry Assistant (TA) pubkey** for this instance. Every concept graph handle has the form `kind:pubkey:slug`, and the pubkey is always the local TA. Get it once:

```bash
curl -s http://localhost:$TAPESTRY_PORT/api/assistant/pubkey
```

The TA is per-deployment — created at first container startup by `setup/create_nostr_identity.sh` and stored as `tapestry-assistant`. Never hardcode the value.

---

## 2. Orient yourself with the Concept Graph API first

Before reading source files or BIBLE.md, call the summaries endpoint. It gives you a compact picture of the entire domain in ~3k tokens:

```bash
curl http://localhost:$TAPESTRY_PORT/api/concept-graph/summaries
```

Each entry has: `handle`, `name`, `description` (~1 sentence), `elementCount`, `setCount`. Scan these to identify which concepts are relevant to your task. Then stop — do not load more until you need it.

---

## 3. The three-call pattern

**Step 1 — orient (always):**
```bash
GET /api/concept-graph/summaries
```
Read all concept names + descriptions. Identify the 1–3 concepts relevant to your task.

**Step 2 — inspect (when you need structure):**
```bash
GET /api/concept-graph/node/:handle/neighbors
```
One-hop view. Shows all connected nodes grouped by relationship type (IS_THE_JSON_SCHEMA_FOR, IS_THE_CONCEPT_FOR, HAS_ELEMENT, etc.) — as summaries, not full content. Use this to understand what's wired to a concept without loading everything.

**Step 3 — read (when you need content):**
```bash
GET /api/concept-graph/node/:handle
```
Full node content including the `json` tag (word-wrapper format with schema, properties, description). Only call this for nodes you've already identified as directly relevant.

---

## 4. What NOT to do

**Don't use `/subgraph` with depth > 1** unless you specifically need a nested tree structure. Depth 2 pulls in hundreds of nodes and is almost always more than you need.

**Don't load BIBLE.md or firmware JSON files** to understand a concept that's already in the graph. The graph is the authoritative, queryable form of that knowledge.

**Don't call `/neighbors` on every node you encounter.** Follow the handle only when a neighbor is relevant to your task.

**Don't hardcode the port or TA pubkey.** Discover both per §1.

---

## 5. Handle format

Handles are stable Neo4j node UUIDs in the format `kind:pubkey:slug`:
- `39998:<TA pubkey>:nostr-relay` — a ConceptHeader (kind 39998)
- `39999:<TA pubkey>:nostr-relay-schema` — a core node (kind 39999)

The `pubkey` segment is always this instance's TA pubkey (see §1). Once you have it, you can construct handles deterministically from slugs.

---

## 6. Server

The control panel API runs at `http://localhost:$TAPESTRY_PORT` (per §1). All concept-graph endpoints are read-only GETs.

To reinstall firmware after adding new concept definitions:
```bash
curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install
```
