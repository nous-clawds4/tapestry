# Normalization Tooling — Architecture Design

*Draft: 2026-03-03, Nous*

## The Problem

The Tapestry knowledge graph has normalization rules (documented in `tapestry-cli/docs/NORMALIZATION.md`) that ensure data consistency across strfry events and the Neo4j concept graph. Violations accumulate naturally as events are authored by different users, re-authored under new keys, or created by automated tooling that doesn't enforce every rule.

Currently, detection and repair is manual — we run ad hoc Cypher queries, write one-off scripts, and fix things case by case. This doesn't scale. We need a systematic approach.

## Core Architecture: Pattern → Detection → Action

Every normalization concern follows the same three-step structure:

### 1. Pattern (What are we looking for?)

A named, documented condition that represents a normalization violation or data quality issue. Each pattern has:
- **ID**: machine-readable slug (e.g., `orphan-node`, `missing-json`, `stale-z-tag`)
- **Severity**: `error` | `warning` | `info`
- **Scope**: which node types / event kinds it applies to
- **Description**: human-readable explanation of why this matters
- **Detection query**: Cypher query or strfry scan that finds violations

### 2. Detection (How do we find violations?)

A function that runs the pattern's query and returns a list of violations, each with:
- The offending node/event UUID(s)
- Context (what's wrong, what it's connected to)
- Suggested fix (if deterministic)

### 3. Action (What do we do about it?)

Actions fall on a spectrum of automation safety:

| Level | Description | Example |
|-------|-------------|---------|
| **Report** | Show the violation to the user | "Node X has no name tag" |
| **Suggest** | Propose a specific fix | "Add json tag with value {...}" |
| **Auto-fix (safe)** | Fix automatically, no data loss risk | "Add missing Neo4j label" |
| **Auto-fix (destructive)** | Fix automatically, but changes events | "Re-publish event with corrected z-tag" |
| **Manual** | Requires human judgment | "Two schemas exist for this concept — which is canonical?" |

## Pattern Catalog

### Category 1: Structural Completeness

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `incomplete-concept` | error | Concept missing any of the 6 constituents (header, superset, schema, 3 graphs) | Report + Suggest |
| `missing-is-the-concept-for` | error | ListHeader with no IS_THE_CONCEPT_FOR relationship | Report |
| `missing-is-the-json-schema-for` | error | JSONSchema not wired to its ListHeader | Auto-fix (safe) |
| `missing-graph-wiring` | error | Graph exists but no IS_THE_CORE/CLASS_THREADS/PROPERTY_TREE_GRAPH_FOR to header | Auto-fix (safe) |
| `orphan-superset` | warning | Superset with no IS_THE_CONCEPT_FOR pointing to it | Report |
| `orphan-schema` | warning | JSONSchema with no IS_THE_JSON_SCHEMA_FOR pointing from it | Report |

### Category 2: Element Binding

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `implicit-only-element` | warning | Element has z-tag (implicit) but no HAS_ELEMENT path from superset (explicit) | Suggest |
| `explicit-only-element` | info | Element has HAS_ELEMENT but no z-tag | Report (may be intentional) |
| `stale-z-tag` | error | z-tag references a UUID that doesn't exist in strfry/Neo4j | Report |
| `wrong-z-tag-pubkey` | error | z-tag UUID contains old pubkey (e.g., Dave's instead of TA's after re-authoring) | Auto-fix (destructive) |

### Category 3: JSON Data

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `missing-json` | warning | Element has no json tag | Suggest (generate from existing tags) |
| `invalid-json-syntax` | error | json tag value is not valid JSON | Report |
| `json-schema-violation` | error | json tag doesn't validate against concept's schema | Report + Suggest |
| `json-schema-missing` | warning | Concept has no schema, so elements can't be validated | Report |

### Category 4: Naming & Identity

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `missing-name` | error | Node has no name/names/title/alias/slug tag | Report |
| `missing-neo4j-name` | warning | Neo4j node has no `name` property (but event has name tag) | Auto-fix (safe) |
| `duplicate-d-tag` | error | Two events with same kind + pubkey + d-tag (strfry should prevent, but check) | Report |
| `slug-collision` | warning | Two graph nodes share the same slug | Report |

### Category 5: Replaceable Event Consistency

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `neo4j-stale` | warning | Neo4j event has older created_at than strfry version | Auto-fix (safe) — re-import |
| `neo4j-orphan` | warning | Neo4j has event not in strfry | Report |
| `duplicate-listhead` | warning | Multiple ListHeaders for same concept (different authors/kinds) | Manual |
| `duplicate-schema` | warning | Multiple JSONSchemas wired to same ListHeader | Manual |

### Category 6: Neo4j Labels & Relationships

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `missing-label` | warning | Event should have label (ListHeader/ListItem/Superset/etc.) but doesn't | Auto-fix (safe) |
| `missing-class-thread-header-label` | warning | Node has IS_THE_CONCEPT_FOR but no :ClassThreadHeader label | Auto-fix (safe) |
| `phantom-node` | error | Node created by MERGE that has no corresponding event (artifact of setup.sh cmd 10) | Report |
| `broken-relationship` | error | Relationship event's nodeFrom/nodeTo references non-existent UUID | Report |

### Category 7: Graph JSON Integrity

| Pattern | Severity | Detection | Action Level |
|---------|----------|-----------|-------------|
| `graph-stale-uuid` | warning | Graph JSON references UUIDs with old pubkey | Auto-fix (destructive) |
| `graph-missing-node` | warning | Graph JSON references UUID not in Neo4j | Report |
| `graph-slug-collision` | warning | Graph JSON has duplicate slugs | Report |
| `subgraph-missing` | warning | Graph references subgraph UUID that doesn't exist | Report |

## Implementation Architecture

### Where does this live?

**Two surfaces, one engine:**

1. **tapestry-cli** (`tapestry normalize check|fix`): command-line, runs against Docker container. Good for batch operations, CI, and agent automation.

2. **UI** (`/kg/settings/health` or `/kg/diagnostics`): browser-based dashboard. Good for human review, manual resolution, and ongoing monitoring.

Both share the same pattern definitions and detection queries.

### Data Model

```javascript
// Pattern definition
{
  id: 'missing-json',
  category: 'json-data',
  severity: 'warning',
  description: 'Element has no json tag',
  scope: { labels: ['ListItem', 'ListHeader'] },
  detect: async (ctx) => { /* returns violations */ },
  suggest: async (violation, ctx) => { /* returns suggested fix */ },
  autofix: null, // or async function if safe to auto-fix
}

// Violation
{
  patternId: 'missing-json',
  severity: 'warning',
  nodeUuid: '39999:TA:abc123',
  nodeName: 'some element',
  context: { concept: 'property', conceptUuid: '...' },
  suggestion: { action: 'add-json-tag', value: {...} },
}

// Fix result
{
  patternId: 'missing-json',
  nodeUuid: '39999:TA:abc123',
  action: 'published-event',  // or 'updated-neo4j', 'added-label', etc.
  eventId: 'newEventId',
  rollback: { /* info to undo */ },
}
```

### API Endpoints

```
GET  /api/normalize/patterns          — list all patterns
GET  /api/normalize/check             — run all checks, return violations
GET  /api/normalize/check/:patternId  — run one pattern
POST /api/normalize/fix               — apply a suggested fix
POST /api/normalize/fix-all/:patternId — auto-fix all violations for a pattern (safe patterns only)
```

### Automation Strategy

**Fully automatable (run on every sync):**
- Missing Neo4j labels
- Missing Neo4j name property
- Missing ClassThreadHeader label
- Neo4j stale events (re-import from strfry)

**Semi-automatable (run with confirmation):**
- Add missing json tags (generate from existing tags)
- Wire missing HAS_ELEMENT relationships
- Fix stale z-tags after re-authoring
- Update graph JSON with corrected UUIDs

**Human-required:**
- Resolve duplicate schemas/headers
- Choose canonical version when multiple exist
- Decide whether orphan nodes should be deleted or wired
- Determine if implicit-only elements should become explicit

### Integration with Existing Tooling

- **setup.sh commands 1-9**: already do label assignment — these become the "auto-fix" for `missing-label`
- **setup.sh command 10**: dangerous MERGE — the tooling should replace this with targeted, safe relationship creation
- **batchTransfer.sh**: full resync — the tooling should make this unnecessary by doing incremental fixes
- **tapestry-cli `normalize check`**: already exists for some rules — extend with the full pattern catalog

### UI Dashboard Concept

```
┌─────────────────────────────────────────────┐
│ 🏥 Knowledge Graph Health                    │
├─────────────────────────────────────────────┤
│                                             │
│  ✅ Structural Completeness    12/12        │
│  ⚠️  Element Binding           347 warnings │
│  ❌ JSON Data                  2 errors     │
│  ✅ Naming & Identity          0 issues     │
│  ⚠️  Replaceable Events        3 warnings   │
│  ✅ Neo4j Labels               0 issues     │
│  ⚠️  Graph JSON                1 warning    │
│                                             │
│  [Run Full Check]  [Auto-fix Safe Issues]   │
│                                             │
│  ─── Recent Violations ───                  │
│  ❌ json-schema-violation: "JSON schema     │
│     for dog" fails validation               │
│  ⚠️  implicit-only: 335 relationships       │
│     have no explicit HAS_ELEMENT            │
│  ⚠️  neo4j-stale: 3 events need re-import   │
│                                             │
└─────────────────────────────────────────────┘
```

## Phased Rollout

**Phase 1 — Detection only**: Implement patterns + detection queries. CLI `tapestry normalize check` outputs a report. UI shows read-only dashboard.

**Phase 2 — Safe auto-fixes**: Add auto-fix for Neo4j-only operations (labels, names, re-imports). These don't touch strfry events.

**Phase 3 — Event-level fixes**: Add fix actions that publish corrected events to strfry (json tags, z-tag corrections). Requires signing via TA key.

**Phase 4 — Continuous monitoring**: Run checks on heartbeat or cron. Alert on new violations. Track fix history.

## Open Questions

1. **Should fixes be reversible?** We could track a fix log and support rollback, but for strfry events, "rollback" means publishing yet another event with `created_at + 1`. Is that worth the complexity?

2. **Per-user vs global?** In a multi-user world, normalization violations may be user-specific (Bob's events reference Alice's old UUIDs). Should the tooling be WoT-aware?

3. **Event immutability tension**: Nostr events are immutable — "fixing" means superseding. Should the tooling distinguish between "this event is wrong" and "this event is correct but a newer version should exist"?

4. **Where do pattern definitions live?** Hardcoded in the app? Or as concept graph events themselves (meta-normalization)? The latter is more elegant but adds bootstrapping complexity.
