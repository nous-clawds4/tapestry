# Build Audit: Firmware Explorer

**Book:** `engineering-team/audits/firmware-explorer/book.md`
**Date:** 2026-07-23
**Branch / commit range:** `93251f62..28e012eb` (feature, merged to staging as #426); promoted to `main` as `cd5062de` (#427)
**Provenance:** Acceptance-frame *(recorded in the epic file at Planning; `book.md` created at close)*
**Confidence:** high

> As-built record for the firmware-explorer book — one story, delivered through the full
> five-phase cycle and shipped to production the same day.

## 1. What shipped

- Per-concept **Elements** view in the Firmware Explorer — a name-sorted list of a concept's
  member instances, each opening its JSON on the right. — `stories/firmware-explorer/1-concept-elements-and-sets-viewer.md`
- Per-concept **Sets** view — the same, for the concept's subsets. — same story.
- A **Direct / Full** scope toggle governing **both** lists (Direct = the concept's own
  members one hop off its Superset; Full = the transitive closure through nested subsets,
  plus — for elements — implicit z-tagged members), defaulting to Direct, with a live count. — same story.
- **JSON detail** for a selected element/set with the shipped `JsonView` **Viewer ⇄ Raw**
  toggle, matching the core-node views; graceful "no JSON" / empty / not-installed states. — same story.

## 2. Epics & stories rolled up

### Epic: `firmware-explorer`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 concept-elements-and-sets-viewer | Elements/Sets master-detail views with Direct/Full toggle + JSON Viewer/Raw drill-down | Done | `reviews/firmware-explorer/1-concept-elements-and-sets-viewer.md` (PASS) |

Prior in-line work in this UI area (pre-epic, shipped directly, not part of this book's diff):
the core-node JSON Viewer/Raw toggle + `JsonView` component (`fea8b0ef`).

## 3. As-built inventory

- **User-facing:** Settings → Firmware Explorer, per selected concept — two new view tabs
  (Elements, Sets) after the core-node tabs, each a list → JSON-detail master-detail pane.
  New component `ui/src/pages/settings/ConceptMembersView.jsx`; wiring in
  `ui/src/pages/settings/FirmwareExplorer.jsx`; styles in `ui/src/styles.css` (`.firmware-members*`).
- **Domain:** none changed. Read-only inspector over the existing class-thread structure
  (`ConceptHeader —IS_THE_CONCEPT_FOR→ Superset —HAS_ELEMENT→ elements`; `Superset —IS_A_SUPERSET_OF→ subsets`).
  No schema change, **no firmware reinstall**.
- **Data & contracts:** no new server route. Reads go through the existing
  `POST /api/neo4j/query` via a new pure client module `ui/src/api/conceptMembers.js`
  (`buildMembersQuery` + `fetchConceptMembers`); `ui/src/api/cypher.js` gained an optional
  `params` argument (backward-compatible). The concept handle travels as the `$h` **param**,
  never interpolated.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | frame: "browse … elements and sets … drill into any one" | Elements *and* Sets both gained the **Direct/Full** toggle (frame only implied a scope choice for elements) | intentional-change | operator decision at the Planning gate (story "Resolved decisions" #1) | richer: subset lists can also expand to their transitive closure | — |
| 2 | frame implies a plain list | each view shows a **count** header | intentional-change | operator decision at Planning (story "Resolved decisions" #2) | at-a-glance scale of a concept's membership | — |
| 3 | (unstated) how the read reaches the graph | handle passed as a Cypher **param**, not interpolated | constraint-discovered | `/api/neo4j/query` write-guard 403s on write-keyword slugs (`set`, …); ADR 0001 Context §1 | none (correct + injection-safe) | the sibling `ConceptElements` page still interpolates → **OPEN.md #84** |
| 4 | (unstated) detail-pane implementation | `MemberDetail` re-scaffolds the Viewer/Raw toggle rather than sharing `FirmwareNodeJson`'s | interpretation | minor duplication accepted; ADR 0001 "Out of scope" | none | optional DRY: extract a shared `JsonDetail` component |

**Undocumented work:** none — the entire diff maps to the story + ADR 0001. (`test/test.js` also
adds `captureAGoalAndSeeItResult` to the skip reducer, a benign correction of a prior-story
omission — flagged in the review, non-blocking.)

## 5. Quality state at close

- **Test gate:** the story suite `test/firmware-concept-elements-sets.test.js` — **19/19**
  (U pure-ESM builder/fetch/params contract; S source wiring; H integration sentinels run the
  real queries against live Neo4j; R regression). Full `npm test` "Overall:" is environmentally
  FAIL on the local stack (OPEN.md #27) — the CI stack-free run is the binding gate and passed
  via #426/#427.
- **Build:** `vite build` clean (pre-existing >500 kB chunk warning only).
- **Shipped & smoke-tested:** staging (#426) and production (#427), Tiers 1–5 clean; the
  params write-guard-dodge validated live on **three distinct TA pubkeys** (local `e00ed090`,
  staging `8e901369`, prod `919ba08a`) — vindicating the runtime-handle rule.
- **Accepted / open:** OPEN.md #84 (ConceptElements shares the write-guard fragility).

## 6. Carry-forward register

- [ ] Migrate `ConceptElements` (and any sibling interpolating pages) to parameterized
  `cypher(query, params)` — **OPEN.md #84** (from §4 #3).
- [ ] Optional DRY: extract a shared JSON-detail component reused by `FirmwareNodeJson` and
  `ConceptMembersView` (from §4 #4; ADR 0001 out-of-scope).

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| `book.md` not opened at intake (anchor recorded in the epic file instead), so cross-session completion detection had nothing to compute against | this book (book.md note); review completion-detection note | **OPEN.md #78** (existing — this is the **2nd occurrence**; row annotated) |
| Verifying worktree UI locally is high-friction: the vite **dev** cold-start stalls on this app's module graph (monaco), and Settings/Firmware is owner-gated (no agent NIP-07 login) | session experience; captured in the `feedback-parallel-session-shared-checkout` memory (updated this session with the prod-`dist` static-preview + temp-bare-route techniques) | **declined** — environmental tooling knowledge, already captured in the worktree memory; not a harness-workflow defect, and the harness meta-lesson backlog is already at escalation (session-start digest: 29 open) |
