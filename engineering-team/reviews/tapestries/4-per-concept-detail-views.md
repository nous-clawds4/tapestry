# Review: Story 4 — Per-concept detail views (Firmware-Explorer parity)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-25
**Diff:** `git diff origin/staging...HEAD` (commits 5bdabbc2 story, 3cd62423 adr, aa1b3ed7 tests, 9e2668ec impl)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/tapestry-per-concept-detail-views.test.js` — **17 passed, 0 failed, 3 skipped** (re-run independently). U/S executed gate green; H1–H3 SKIP (running :7778 stack serves the shared checkout, not this worktree — expected).
- [x] `node test/firmware-concept-elements-sets.test.js` — **19 passed, 0 failed** (re-run independently). The firmware regression suite is green after the R2 re-aim; its H1–H4 ran live and passed.
- [x] `vite build` (author-run, spot-verified) — compiles; only the pre-existing chunk-size warning.
- [x] `node --check` on all 3 changed server files — clean.
- [ ] _Lint/typecheck/build gate not configured — skipped per project policy._

## Spec adherence
- [x] Every acceptance criterion has a passing test. AC1→U4/S4/S6/S7; AC2→U4/S4/S6; AC3→U1/U2/**U5**/U7/S2/S8/H1; AC4→S6 (+ existing firmware-concept-elements-sets covers Direct/Full/scope/sort of the reused ConceptMembersView); AC5→U3/U6/H3; AC6→R2(mine).
- [x] No criterion silently dropped. The LMDB-resolution crux (AC3) is proven stack-free by U5 (synthesized `lmdb:` pointer) since the instance has 0 live pointers.
- [x] No behavior added beyond the story. Membership + tapestry-level integration views untouched (R2 mine).

## ADR adherence
- [x] Files match ADR 0004 Implementation notes exactly: `src/lib/conceptCoreNodes.js` (helper), `GET /api/concept-graph/node/:handle/core-nodes`, firmware rewire, `ui/src/api/conceptCoreNodes.js`, `ui/src/components/concept/CoreNodeViews.jsx`, FirmwareExplorer import, TapestryDetail per-concept panel.
- [x] Decision 1 (neo4j+LMDB source) honored — `getConceptCoreNodes` reads relationships via Cypher and JSON via `resolveValue`.
- [x] Decision 2 (server-side, handle-keyed, LMDB-resolving; share & rewire) honored — one copy of the Cypher; firmware endpoint rewired onto it.
- [x] Decision 3 (extract shared UI + reuse ConceptMembersView) honored.
- [x] No new dependencies.

## Concept-graph integrity
- [x] Handles are `kind:pubkey:slug`; the handle travels as the `$uuid` **param**, never interpolated (verified in the helper + U7).
- [x] **No hardcoded TA pubkey** — swept the entire added diff for 64-hex; none. Handles come from `composed.nodes` (runtime) client-side and from the request path server-side.
- [x] Firmware reinstall **not required** — no `firmware/*.json`, schema, or concept-definition changes.

## Things tests can't catch (manual audit)
- [x] **Firmware rewire is behavior-preserving.** The 8-core-node Cypher moved **verbatim** into the helper (`MATCH (h:ListHeader {uuid:$uuid})` + identical OPTIONAL MATCHes; RETURN aliases identical — the base's extra `AS name`/`AS uuid` belong to the untouched header-lookup query). `coerceJson(resolveValue(v))` ≡ old `parseJson(v)` for the actual data domain (string|null; 0 lmdb pointers today: `resolveValue` passes the string through, `coerceJson` `JSON.parse`s it; null→null). The `installed:false` guard (`headers.length === 0`) still precedes the helper call, so `getConceptCoreNodes` is only invoked with a real header uuid.
- [x] **R2 re-aim is faithful, not a weakening.** `FirmwareOverview`/`FirmwareNodeJson` moved verbatim to `CoreNodeViews.jsx` (7 structural markers intact); FirmwareExplorer imports `ConceptNodeJson`/`ConceptOverview` aliased to the old names. The re-aimed R2 checks *more* than before — FE still uses `FirmwareNodeJson` **and** the shared module carries `firmware-view-toggle` + `JsonView` + `ConceptNodeJson`. Toggle behavior preserved.
- [x] **Source-of-truth switch (S8).** `match.graph` occurrences in TapestryDetail: **0** — the old strfry import-JSON per-concept view is gone; detail is fetched by the member header handle. `imports` is no longer destructured from `useTapestryGraph` (no dead var).
- [x] **`CORE_NODE_ROLES` was genuinely dead** on `origin/staging` (1 occurrence = definition only); no test referenced it. Clean removal.
- [x] No secrets; no stray `console.log` in the feature paths (the endpoint's `console.error` on failure matches the sibling concept-graph handlers); no commented-out code.
- [x] Error/edge paths: fetch error → error state; `found:false` → "Not in the graph"; missing core node → the component's own "does not exist" state; `useEffect` guards races via a `cancelled` flag and resets to Overview + refetches on handle change; the members view is remounted by `key` on concept/kind switch.
- [x] Security: read-only GET; `$uuid` param (no injection); no new auth surface (consistent with the public, read-only concept-graph API and the public tapestry page).

## House rules check
- [x] Concept Graph API authority respected — the feature reads through the concept-graph API / its Neo4j+LMDB read path (the authoritative source), consistent with ADR 0004 and the firmware precedent.
- [x] No new lint/typecheck/build tooling.
- [x] Architecture invariants: the per-concept detail is a **structural inspector** (all members regardless of author), not POV-scoped — matching the ADR and the existing firmware `ConceptMembersView` precedent. POV filtering is correctly deferred.

## Findings

### Blocking
_None._

### Non-blocking
1. **ui/src/pages/tapestries/TapestryDetail.jsx:114–117** — the Overview `description` is best-effort from the header JSON (`word/set/conceptHeader.description`). The Firmware Explorer sources its richer description from the firmware manifest (`firmware.getConcept(slug).conceptHeader.description`), which a handle-keyed tapestry read cannot reach; for concepts whose header JSON lacks a `description`, the Overview shows an empty description line. The substantive Overview content (the 8-core-node exists/JSON table + the concept name) is fully present, so AC2 is met. Optional follow-up: surface the header's `oNames`/description more robustly, or accept the minor gap.
2. **H-class + full browser E2E are staging-verified, not local.** By design (the worktree is not served by the local Docker stack, and no tapestry is seeded locally). H1 (schema/primary-property present for `dog`), H2 (firmware `/concept/dog` ≡ core-nodes endpoint), H3 (graceful `found:false`), and the open-a-tapestry walkthrough must be confirmed in the `cycle-staging` smoke. Recorded, not a defect.
3. **Deferred (per ADR):** `ConceptMembersView` member JSON is still read raw via `/api/neo4j/query` without LMDB resolution — a no-op today (0 pointers), the same latent gap the firmware page already has; to close when JSON offloading is enabled.

### Harness friction
None.

## Verdict
**PASS**

The implementation faithfully realizes ADR 0004: per-concept detail reads relationships from Neo4j and node JSON through the Tapestry-LMDB resolver, behind a shared handle-keyed helper that also (behavior-identically) backs the Firmware Explorer. All acceptance criteria are covered by green U/S tests; the firmware regression suite is green after a faithful R2 re-aim; the two author-flagged risks (rewire parity, R2 re-aim) hold up under audit. The three non-blocking items are documented deferrals/staging-verifications, not defects.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run (see below).
