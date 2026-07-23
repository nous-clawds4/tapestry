# ADR 0001: Concept Elements & Sets viewer in the Firmware Explorer

**Status:** Accepted
**Date:** 2026-07-23
**Story:** `engineering-team/stories/firmware-explorer/1-concept-elements-and-sets-viewer.md`

## Context

The Firmware Explorer (`ui/src/pages/settings/FirmwareExplorer.jsx`, ~1270 lines) lets an
operator pick a concept and view its 8 core class-thread nodes via a per-concept tab row
(`CORE_NODES`) whose content area renders either `FirmwareOverview` or `FirmwareNodeJson`.
`FirmwareNodeJson` already carries the **Viewer ⇄ Raw** toggle (`.firmware-view-toggle`)
over the dependency-free `JsonView` component (`ui/src/components/JsonView.jsx`,
`<JsonView data={obj} />` — takes a *parsed* JS value).

Story #1 adds two per-concept views — **Elements** and **Sets** — each a list → JSON-detail
drill-down, with a **Direct / Full** scope toggle (default Direct) governing **both** lists,
and a count header.

**Where the data lives.** A concept's members hang off its Superset:
`ConceptHeader —IS_THE_CONCEPT_FOR→ Superset —HAS_ELEMENT→ elements`, and
`Superset —IS_A_SUPERSET_OF→ subsets`. The Firmware Explorer already loads the header
handle for the selected concept at `conceptData.nodes.header.uuid`
(e.g. `39998:<TA>:dog`) — the exact key these queries need. Concept handles use the
**runtime** TA pubkey; nothing here hardcodes it.

**Validated against the live graph** (queries run through `/api/neo4j/query`):

| scope | dog | set | cross-check |
|---|---|---|---|
| elements / direct | 1 (`Rover`) | 58 | == summaries `elementCount` |
| elements / full   | 1 | 98 | +40 via nested sets + implicit z-tag |
| sets / direct     | 0 | 2 | == summaries `setCount` |
| sets / full       | 0 | 2 | no deeper nesting here |

**Two hard constraints discovered during design:**

1. **The `/api/neo4j/query` write-guard false-positives on interpolated handles.**
   `src/api/neo4j/queryPost.js:17` classifies a query as a write if
   `/\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i` matches the **cypher
   string**. Interpolating the `set` concept's handle (`…:set`) trips `\bSET\b` → the read
   is misrouted to `writeCypher` and **403s** for a non-owner/non-`localTrusted` caller.
   The fix is to pass the handle as a **Cypher parameter** (`$h`) so the query *template*
   contains no concept slug. `queryPost` already supports `{ cypher, params }` and runs
   parameterized reads via `runCypher`. (This also makes the query injection-safe.) The
   existing `ConceptElements` page interpolates handles and shares this latent fragility —
   noted as a follow-up below; **out of scope** here.

2. **Tests run stack-free (CI) on a CommonJS runner** (`node test/test.js`; no
   jsdom/vitest). Pure `ui/src` ESM modules are *executed* in tests via
   `loadEsm()` = `import(pathToFileURL(abs).href)` (precedent: `ui/src/utils/placement.js`
   → `filterDestinations`, tested in `test/move-nodes-between-sets-ui.test.js`). So the
   design must expose the query logic as a **pure ESM function** — no DB, no browser —
   to be gate-able in CI.

## Options considered

### Option A — Frontend-only: pure query-builder + parameterized `/api/neo4j/query` (chosen)

A new pure module `ui/src/api/conceptMembers.js` exports `buildMembersQuery({kind, scope})`
(returns a Cypher string keyed on `$h`) and `fetchConceptMembers({headerUuid, kind, scope})`
(calls the shared client with params). A new `ConceptMembersView` component renders the
master-detail. No server change.

- **Pros:** Uses only endpoints already on the shared backend → **worktree-verifiable** via a
  vite dev server proxying `/api` → `:7778`. Parameterized (correct read, injection-safe,
  dodges the write-guard). The builder is a pure ESM function → directly unit-testable under
  CI (`loadEsm`), locking in the validated Cypher shapes. Reuses `JsonView` + existing toggle
  styling.
- **Cons:** Introduces a one-line params extension to the shared `cypher()` client. Query
  logic lives client-side (not a documented server API surface).

### Option B — Reuse the REST concept-graph endpoints (`/neighbors` + `/node/:handle`)

Direct lists from `GET /api/concept-graph/node/<superset>/neighbors`; detail from
`GET /api/concept-graph/node/<handle>`.

- **Pros:** Zero new query code; sanctioned three-call pattern; no write-guard issue (GET).
- **Cons:** **Cannot do Full** — `/neighbors` is one-hop only (no transitive, no implicit
  z-tag), and the story requires Full for both lists. Also `/neighbors` is **direction-
  agnostic** (`(n)-[r]-(neighbor)`), so `IS_A_SUPERSET_OF` mixes a superset's subsets with
  its own parent-supersets — wrong for a clean "Sets" list. Rejected: fails the core
  requirement.

### Option C — New read-only server endpoint (`/api/concept-graph/node/:handle/members`)

Server computes elements/sets per (kind, scope), parameterized, via `runCypher`.

- **Pros:** Cleanest long-term API; parameterized server-side; no write-guard issue.
- **Cons:** Adds server surface for a read the client can already do; and the new endpoint
  would be **absent on the shared backend**, so worktree verification couldn't exercise it
  without also running a backend from the worktree (heavier). Deferred as the natural future
  refactor if this logic needs reuse or server-side caching.

## Decision

We chose **Option A**. It is the only option that satisfies **Full** mode (B cannot), keeps
the change **frontend-only and worktree-verifiable** (C cannot), and yields a **pure,
CI-gate-able** query-builder. Parameters — not interpolation — are load-bearing: they are
what keeps the read a read and sidesteps the write-guard false-positive.

## Consequences

- **Enables** end-to-end concept exploration (structure + membership) inside the Firmware
  Explorer, reusing the shipped `JsonView`/toggle.
- **Constrains:** the query logic is client-side; if a server-side consumer ever needs the
  same lists, promote to Option C (the builder stays the single source of the Cypher shapes).
- **New shared-client capability:** `cypher(query, params)` — additive, backward-compatible
  (existing one-arg callers send `params:{}`, which the server already defaults).
- **Follow-up (out of scope):** the `ConceptElements` page's interpolated-handle queries share
  the write-guard fragility for write-keyword slugs (`set`, and hypothetically
  `create`/`delete`/…). Worth an OPEN.md row / a small hardening story to move it to params.
  Not fixed here.
- **POV / decentralization:** this is a structural inspector, not a POV-scoped view — no
  per-POV columns; lists show members regardless of author (no gating), matching
  `ConceptElements`. Honors the architecture invariants.
- **Firmware reinstall required?** **No.** No concept definitions, schema, or firmware seed
  change; read-only UI over existing graph data.

## Implementation notes

**New — `ui/src/api/conceptMembers.js`** (pure + thin I/O; the pure export is the test seam):

- `export function buildMembersQuery({ kind, scope })` — `kind ∈ {'elements','sets'}`,
  `scope ∈ {'direct','full'}`. Returns a Cypher string parameterized on `$h` (the header
  handle). Exact validated shapes:
  - elements/direct:
    `MATCH (h {uuid:$h})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT]->(e) OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type:'json'}) WITH DISTINCT e, head(collect(j.value)) AS json RETURN e.uuid AS uuid, e.name AS name, json`
  - elements/full: the above with `-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(e)`,
    `UNION` the implicit arm
    `MATCH (e)-[:HAS_TAG]->(:NostrEventTag {type:'z', value:$h}) … RETURN e.uuid AS uuid, e.name AS name, json`
  - sets/direct: `…-[:IS_A_SUPERSET_OF]->(s) … RETURN s.uuid AS uuid, s.name AS name, json`
  - sets/full: `…-[:IS_A_SUPERSET_OF*1..10]->(s) …`
  - No `ORDER BY` (UNION-incompatible) — sort by `name` client-side.
- `export async function fetchConceptMembers({ headerUuid, kind, scope })` —
  `return cypher(buildMembersQuery({ kind, scope }), { h: headerUuid })`.

**Edit — `ui/src/api/cypher.js`:** `export async function cypher(query, params = {})` and add
`params` to the POST body. One-line, backward-compatible.

**New — `ui/src/pages/settings/ConceptMembersView.jsx`:** `ConceptMembersView({ conceptData, kind })`.
- State: `scope` (default `'direct'`), `selected` (item uuid), plus `rows`/`loading`/`error`
  from a `useEffect` calling `fetchConceptMembers` on `(headerUuid, kind, scope)`.
- `headerUuid = conceptData?.nodes?.header?.uuid`; if absent, render the empty state.
- Left pane: Direct/Full toggle (reuse `.firmware-view-toggle`/`.firmware-view-btn`), count
  header ("N elements" / "N sets"), name-sorted selectable rows (fallback to short uuid when
  `name` is null); empty-state message when zero.
- Right pane: for the selected row, `JSON.parse` its `json`; on success show a
  Viewer ⇄ Raw toggle (Viewer default) — `<JsonView data={parsed}/>` vs a
  `.firmware-json-pre`; when `json` is null → "This item has no JSON." message; on parse
  failure → show the raw string in the `<pre>`.

**Edit — `ui/src/pages/settings/FirmwareExplorer.jsx`:**
- After the `CORE_NODES` tab buttons, render a small divider + two buttons (`Elements`,
  `Sets`) that set `selectedNode` to `'elements'` / `'sets'`.
- In the content branch: when `selectedNode` is `'elements'`/`'sets'` (and the concept is
  installed), render `<ConceptMembersView key={headerUuid + selectedNode} conceptData={conceptData} kind={selectedNode}/>`.
  The `key` remounts per concept+kind so scope resets to Direct and selection clears. The
  existing not-installed guard already precedes this branch (AC: graceful degrade).

**Edit — `ui/src/styles.css`:** `.firmware-members` (two-column list+detail, stack on
narrow), `.firmware-members-list`, `-item`(+`.active`), `-count`, `-detail`, reusing existing
palette vars and the `.firmware-view-*` / `.firmware-json-*` classes.

**Test seam (Phase 3 owns the tests):** `buildMembersQuery` is the executed U-class surface
(assert directed edges; `*0..10`+UNION+z-tag only for elements/full; `*1..10` for sets/full;
no `*` for direct; `$h` param present and **no interpolation**; correct RETURN columns).
UI wiring (new tabs, `ConceptMembersView` states, param passing) is covered by static source
assertions, per the `capture-a-goal-and-see-it` precedent. **No DB/browser tests** (CI is
stack-free).

## Out of scope
- Refactoring `FirmwareNodeJson` to share a JSON-detail component (minor duplication accepted;
  optional DRY follow-up).
- Fixing `ConceptElements`' interpolated-handle write-guard fragility.
- Any server endpoint (Option C) or caching.
