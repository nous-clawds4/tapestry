# ADR 0001: Shared placement dialog + pure placement-ops core over the relationship primitives

**Status:** Proposed
**Date:** 2026-07-22
**Story:** `engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`

## Context

The story adds owner-facing place/move/remove affordances on three existing pages. The backend is
done (ADR `relationship-primitives/0001`): `POST /api/normalize/add-relationship` /
`delete-relationship`, body `{fromUuid, toUuid, relType}`, direction `(from)-[rel]->(to)`
parent-first, whitelist `HAS_ELEMENT` / `IS_A_SUPERSET_OF` (either spelling), idempotent `result`
discriminator, hazard `note` on every graph-changing success, in-handler owner gate. A browser
call is an authenticated-remote caller riding the owner session cookie — exactly the 403/401
ladder ADR `security-auth-exposure/0002` leaves in place. **No server-side change is needed or
allowed in this story.**

Verified constraints and patterns (live stack `:7778`, 0 behind `origin/staging`):

- **Concept orientation** (Phase 1 + this phase): `39998:<TA>:set`, `:superset`, `:class-thread`,
  `:shared-concept` all live in the graph; no concept definitions change → **no firmware
  reinstall**.
- **Read queries the UI must stay consistent with:** `SetDetail.jsx:41-64` (supersets/subsets via
  `IS_A_SUPERSET_OF`, elements via `IS_A_SUPERSET_OF*0..10` + `HAS_ELEMENT` — direct and indirect
  rows are indistinguishable today), `ConceptDag.jsx:21-32` (same DAG walk).
- **House UI patterns:** fetch-helper convention `ui/src/api/normalize.js` (throws on
  `!success`); `useCypher(...).refetch` (`ui/src/hooks/useCypher.js:34`); client owner gate
  `user?.classification === 'owner' || 'admin'` (`ElementDetail.jsx:19`); result banners
  `health-banner health-pass|warn|fail` (`ElementDetail.jsx:283-302`); `ConfirmDialog`
  (`ui/src/components/ConfirmDialog.jsx`); set-picker `<select>` precedent
  (`NewSet.jsx:19-27, 121-141`).
- **Test-harness constraint (shapes the design):** no jsdom/testing-library exists; UI stories
  are tested by *source-level* assertions over JSX plus *executed* pure ESM utils
  (`test/event-page-ui.test.js:10-16`). Logic we want genuinely unit-tested must therefore live
  in a pure module, not inside a component.
- **ADR conflict check:** builds on `relationship-primitives/0001` (consumes its contract;
  whitelist untouched) and `0002` (probe untouched); consistent with
  `security-auth-exposure/0001/0002`; ADR 0015's `LEGACY_*` exception irrelevant here (placements
  are uuid-based; no TA-pubkey use at all). Nothing superseded.

## Options considered

### Option A — Shared `PlacementDialog` + pure placement-ops util + thin per-page mounting *(chosen)*

One dialog component serves all three surfaces in two modes (`intoSet`: destination fixed, pick
node; `forNode`: node fixed, pick destination ± source placement to move). All decision logic —
kind→relType mapping, direction, move-op ordering, cycle-exclusion filtering — lives in a pure
ESM util the test runner can execute.

**Pros:** the story's three hardest correctness points (direction, move ordering, cycle guard)
become executable-testable; one implementation of pickers/banners/gating instead of three;
in-place `refetch` (no navigation) satisfies "without a full page reload" naturally; the dialog
is the template for future primitives UI (`HAS_SUBGOAL` later = one map entry + a candidate
query).
**Cons:** one more shared component + util on a UI that mostly favors routed pages for writes;
the dialog carries two modes' worth of props.

### Option B — Routed full-page flows per surface (the `NewSet`/`AddNodeAsElement` pattern)

**Pros:** matches the existing write-flow pattern; no modal state.
**Cons:** three routes plus App.jsx wiring for what the story frames as a few-click curation
action; navigation round-trips defeat "with ease"; move (source + destination + kind) forces
either a multi-step wizard or query-param threading; post-action refresh becomes full
navigations. More files, worse fit.

### Option C — Bespoke inline controls per page, no shared component

**Pros:** smallest per-page diffs, no new shared surface.
**Cons:** direction/ordering/cycle logic duplicated three times in JSX — exactly where the
harness cannot execute tests; drift between surfaces is guaranteed over time. Rejected: it puts
the least-testable code where the most correctness lives.

## Decision

**Option A**, with these sub-decisions:

1. **Pure core `ui/src/utils/placement.js`** (executable ESM):
   `PLACEMENT_KINDS = { element: 'HAS_ELEMENT', subset: 'IS_A_SUPERSET_OF' }` (alias spellings —
   the same strings the pages' Cypher displays; server accepts either);
   `buildPlacementOps({ nodeUuid, destSetUuid, kind, source })` returns the ordered op list
   enforcing **parent-first direction** (`fromUuid` = set, `toUuid` = node) and
   **add-before-delete** for moves (no-orphan invariant: worst partial state is the node in *two*
   places, visible and self-healing, never zero);
   `filterDestinations(candidates, { nodeUuid, kind, descendantUuids })` implements the cycle
   guard.
2. **Client `ui/src/api/relationships.js`**: `addRelationship` / `deleteRelationship` following
   the `normalize.js` convention **but returning the full response object** — `result`, `note`,
   `from`/`to` labels are load-bearing UI inputs; on `!success` throw `Error(data.error)` with
   `.status` and `.allowed` attached.
3. **Cycle guard is UI policy** (per `relationship-primitives/0001` decision 4, primitives carry
   none): subset placements exclude the node itself and — when the node is a set — its
   descendants (one query: `MATCH (n {uuid:…})-[:IS_A_SUPERSET_OF*0..10]->(d) RETURN d.uuid`);
   element placements exclude only self. Advisory only — raw API callers can still create
   cycles; display queries are `*0..10`-bounded, so no hangs.
4. **Direct-placement flag:** SetDetail's elements query gains a per-row
   `EXISTS { MATCH (s)-[:HAS_ELEMENT]->(elem) } AS direct`; the remove control renders only on
   `direct` rows (and on Direct Subsets rows, which are direct by construction). Remove buttons
   `stopPropagation()` against the row's navigate.
5. **Result surfacing:** `created`/`deleted` → `health-pass` banner with the server's hazard
   `note` rendered verbatim beneath it (`health-warn`); `already-existed`/`not-found` → neutral
   "no change was needed"; failures → `health-fail` with the server error text. Never suppress
   the note (epic guardrail).
6. **Owner gating:** the `ElementDetail.jsx:19` classification pattern on every affordance;
   non-owners render nothing new (server 403/401 remains the real gate).
7. **Refresh:** pages hand the dialog an `onChanged` callback that calls their `useCypher`
   refetches; no navigation.

## Consequences

- Few-click curation on all three surfaces with one tested core; the pure util is where future
  placement kinds land.
- Move is two non-atomic HTTP calls; add-first ordering caps the damage at "in both places,
  retry the remove" — surfaced in the dialog's partial-failure message. Accepted for a
  single-operator tool.
- The `EXISTS` per element row is bounded by concept size; measured-not-presumed rule applies if
  a concept ever grows huge.
- Client-side cycle guard can go stale between fetch and confirm (TOCTOU) — accepted; same class
  as the concurrency caveat in the primitives ADR.
- No new dependencies, no route changes, no server changes.
- **Firmware reinstall required?** **No.**

## Implementation notes

Test-file changes (suite, runner registration) are Phase 3 — the Tester's lane.

- **NEW `ui/src/utils/placement.js`** — pure ESM, no React imports: `PLACEMENT_KINDS`,
  `buildPlacementOps(...)` (returns e.g. `[{op:'add', fromUuid, toUuid, relType},
  {op:'delete', …}]`), `filterDestinations(...)`. JSDoc states the direction rule once.
- **NEW `ui/src/api/relationships.js`** — the two fetch helpers, `normalize.js` style, full-body
  return.
- **NEW `ui/src/components/PlacementDialog.jsx`** — props `{ open, mode: 'intoSet'|'forNode',
  conceptUuid, fixedSet?, fixedNode?, source?, onChanged, onClose }`; destination picker reuses
  the `NewSet.jsx:20-26` DAG query; candidate-node picker (`intoSet` mode) unions the concept's
  sets (`ConceptDag` query, minus the fixed set) and elements (superset `*0..10` +
  `HAS_ELEMENT`), with kind radio (element/subset); banners per decision 5.
- **EDIT `ui/src/pages/concepts/SetDetail.jsx`** — import `useAuth`; "＋ Add to this set…" button
  (owner-only) opening `intoSet` mode; elements query gains `direct`; remove buttons on Direct
  Subsets rows (`deleteRelationship({fromUuid: setUuid, toUuid: row.uuid,
  relType: 'IS_A_SUPERSET_OF'})`) and `direct` element rows (`… relType: 'HAS_ELEMENT'`) behind
  `ConfirmDialog`; destructure the three list refetches and pass as `onChanged`.
- **EDIT `ui/src/pages/concepts/ElementDetail.jsx`** — Overview gains a "Placements" section:
  direct parents via `MATCH (p)-[r:HAS_ELEMENT|IS_A_SUPERSET_OF]->(e {uuid:…})
  RETURN p.uuid, p.name, labels(p), type(r)`; each row links to the set page and (owner) offers
  "Move…" (`forNode` mode with `source` prefilled) and "Remove"; plus "＋ Add placement…"
  (`forNode`, no source).
- **EDIT `ui/src/pages/concepts/ConceptDag.jsx`** — owner-gated Actions column: "Place / move…"
  per row (`forNode` mode, node = the row's set; subset kind preselected).
- **No changes:** `App.jsx` routes, any `src/` server file, any firmware JSON.
- Suggested test split (Tester finalizes): **U-executed** over `placement.js` (kind map,
  direction, add-before-delete ordering, cycle filter); **S-source** over the three pages +
  dialog (endpoints wired, owner gate present, `stopPropagation`, note rendered, refetch
  invoked); **H-class** live check of the `direct`-flag and parents queries using the book's
  throwaway-node fixture pattern; **R-sentinels** for the unchanged read queries.

## Out of scope

- Event-backed durable moves; any whitelist extension; any server/firmware change;
  drag-and-drop; migrating `AddNodeAsElement`; a global toast system.
