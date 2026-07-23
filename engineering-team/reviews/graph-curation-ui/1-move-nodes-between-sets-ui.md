# Review: Story 1 — Place and move nodes between sets from the concept pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-22
**Diff:** `git diff staging...HEAD` (commits `c1e3b5fb` story+epic, `92f812f6` ADR, `31dab766` failing tests + runner registration, `db61f2a5` implementation)
**Story:** `engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0001-shared-placement-dialog-over-primitives.md`
**Test plan:** `engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/move-nodes-between-sets-ui.test.js` (story suite, isolation) — **PASS: 20 passed, 0 failed, 0 skipped.** Stack present: both H sentinels executed against real Neo4j (not skipped).
- [x] `npm test` (full run, executed by reviewer; log retained in session scratchpad `npm-test-reviewer.log`) — **`move-nodes-between-sets-ui suite: PASS (20 passed, 0 failed)`; Total skipped: 51; Overall: FAIL**, attributable to exactly two reds, **both verified pre-existing/environmental and neither caused by this branch**:
  1. `harness-lint suite: FAIL (28 passed, 1 failed)` — reviewer re-ran `bash scripts/harness-lint.sh` directly: the single violation is `L9 BIBLE.md — 'Last updated: 2026-07-02' lags the last git change (2026-07-20) by 18d (>14)`. This branch does not touch BIBLE.md (`git diff staging...HEAD --name-only` contains no BIBLE.md), and both dates predate the branch's first commit (2026-07-22). Pre-existing; already visible in the session-start digest; also recorded as pre-existing in the test plan's Verification section.
  2. `relationship-primitives suite: FAIL (22 passed, 1 failed)` — H8, the whole-relay strfry count-bracket equality documented deterministically brittle in **OPEN.md row 75** (dated 2026-07-22). Reviewer re-ran `node test/relationship-primitives.test.js` in isolation: **PASS 23/23 including H8**. Corroborating evidence the drift is a live publisher, not this branch: the Implementer's full-run H8 drift was +10 at count ~5,999,867; the reviewer's full-run drift was +2 at count ~6,000,042 — the relay grew ~175 events *between* the two runs with this branch's code unchanged. The branch touches no server code and mints no events (UI-only; the endpoints it calls are the same primitives H8 itself proves event-free when quiet).
  - Every other suite in the reviewer's full run: PASS (the 5 `*-publish` suites with unmet preconditions report SKIP and are counted in `Total skipped: 51`, matching the Implementer's baseline run suite-for-suite).
- [x] **Blast-radius disjointness (why the two reds cannot be this branch):** the only test file in `test/` referencing any of the six changed/added UI files is the new suite itself (`grep -rln` over `test/`); `git diff staging...HEAD` touches nothing under `src/` (verified empty); the only shared file touched is `test/test.js`, whose change is the additive four-touch registration of the new suite with its `fail === 0` term inserted **inside the live `overallOk` chain, before the severed terminator, per OPEN.md #43** (the pre-existing dead tail is untouched; the previous terminator `relationshipPrimitivesProbeResult... ;` correctly became `&&`).
- [x] `npm run test:playwright` — **not applicable**: no Playwright spec references the concept pages (`grep -rln "concepts\|/dag" tests/brainstorm/` → empty); the approved test plan covers this story via the npm-test U/S/H/R suite (the harness deliberately has no jsdom/testing-library).
- [x] **JSX compiles** (gap the configured gates can't catch — S-tests regex source, nothing parses it): in-container `vite build` (`docker exec tapestry sh -c "cd /usr/local/lib/node_modules/brainstorm/ui && node_modules/.bin/vite build"`) — **succeeds** (`✓ built in 2m 29s`; chunk-size warning pre-existing). `ui/dist` is gitignored; working tree stayed clean.
- [x] **Red-then-green verified mechanically:** `git ls-tree 31dab766` shows `placement.js` / `relationships.js` / `PlacementDialog.jsx` absent at the test commit — the U/S tests necessarily failed there (each throws a feature-missing message), matching the test plan's recorded red run.
- [x] _Lint not configured — skipped (harness-lint covered above)._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured as a gate — voluntary in-container build run above._

## Spec adherence

- [x] Every acceptance criterion has a passing test (coverage map audited against the actual suite, and the implementation hand-verified file by file):
  - **AC1 Set page — place:** SetDetail.jsx:174-179 owner-gated "＋ Add to this set…" → `intoSet` dialog (SetDetail.jsx:424-431); kind radio + node picker in PlacementDialog; refresh via `refetchAll` (SetDetail.jsx:80-84), no navigation. Tests U1-U3 (executed direction/kind semantics), S2.
  - **AC2 Set page — remove:** elements query gains `EXISTS { MATCH (s)-[:HAS_ELEMENT]->(elem) } AS direct` (SetDetail.jsx:70-78) — the `WITH DISTINCT s, elem` correctly carries `s` into the EXISTS scope, and **H1 proves the semantics live** (fixture B direct=true, chain-inherited C direct=false); remove buttons only on `direct` element rows (SetDetail.jsx:392-404) and Direct Subsets rows (direct by construction, SetDetail.jsx:303-317), behind ConfirmDialog, with `stopPropagation` (SetDetail.jsx:309, 397). Tests S3, U10, H1.
  - **AC3 Element page — placements visible:** direct-parents query across both kinds with `type(r)` (ElementDetail.jsx:58-63), rendered as a Placements table linking each row to the set page (ElementDetail.jsx:313-321 area). **H2 proves the query shape live.** Owner-only per logged Deviation 1 (see below). Tests S4, H2.
  - **AC4 Element page — move / add:** per-row "Move…" passes the specific `source` placement; "＋ Add placement…" passes none; the pure core orders **add-before-delete** and no-ops a same-place move (U4, U5 — executed); page reflects via `refetchParents`. Tests U4, U5, S4.
  - **AC5 Organization overview:** owner-gated per-row "Place / move…" (ConceptDag.jsx:77-97) in `forNode` mode, subset kind preselected; cycle filter executed-tested (U7). Tests S5, U7.
  - **AC6 Gating:** every new affordance on all three pages + the dialog-open paths sits behind the `user?.classification === 'owner' || 'admin'` pattern (SetDetail.jsx:20-21, ElementDetail.jsx:21-22, ConceptDag.jsx:19-20); dialogs are only openable from gated buttons; server-side 401/403 remains pinned by the relationship-primitives suite (U-gate + H7, passing in the reviewer's runs). Tests S2/S4/S5.
  - **AC7 Warning on every change:** the client returns the full body (`note` load-bearing, U8/U10 executed); the dialog renders the note in a `health-warn` banner on success **and on partial failure** (PlacementDialog.jsx:170-175, 159, 294-299); both page-level remove flows render it too (SetDetail.jsx:209-214, ElementDetail placements banner). Server sends the hazard note on every graph-changing success (`HAZARD_NOTE`, src/api/normalize/relationships.js:72-75 — unchanged by this branch). Never suppressed. Tests U8, U10, S1.
  - **AC8 Failures surfaced:** client throws `Error(data.error)` with `.status`/`.allowed` (U9 executed); dialog and both remove flows render `health-fail` banners; the move partial-failure path tells the user the node is in BOTH places and still calls `onChanged` (the add did land) — no silent failures. Tests U9, S1.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story — the two additions beyond the ADR's letter are logged in the story's `## Deviations` and audited below.

### Deviations audit (both accepted)

1. **Owner-only Placements section (ElementDetail).** AC3 ("the node's page shows its direct parent set(s)") and AC6 ("non-owner… views are unchanged from today") genuinely conflict for the non-owner *display*: today's element page shows no placements, so rendering the section to anon would change the anon view AC6 explicitly pins. Resolving toward AC6-strict matches the story's framing (owner curation throughout; the data stays publicly reachable via the set pages). Properly logged with date/role. Legitimate small deviation, not a kickback.
2. **Optional "move from" select in `forNode` mode without an explicit source (PlacementDialog).** AC5 requires the Organization rows to offer "the same place/move affordance" — without a way to name a source, ConceptDag could only ever *add* (leaving a re-parented set under both parents), under-delivering the "move" half of AC5. The select is the minimal completion of the ADR's own optional-`source` mode contract, defaults to the ADR's named plain-add path, and routes through the same executed-tested pure core. Legitimate — closer to necessary than to scope creep.

## ADR adherence

- [x] Files changed exactly match the ADR's implementation notes: NEW `ui/src/utils/placement.js`, `ui/src/api/relationships.js`, `ui/src/components/PlacementDialog.jsx`; EDIT `SetDetail.jsx`, `ElementDetail.jsx`, `ConceptDag.jsx`; plus the Tester-lane `test/` files and harness docs. **No `App.jsx` route changes, no `src/` server files, no firmware JSON** (all verified against the diff file list).
- [x] Layering respected: all direction/ordering/no-op/cycle logic lives in the pure ESM core (no React imports, executed by the runner); the dialog consumes core + client; pages mount thin.
- [x] Contract details verified: `PLACEMENT_KINDS` exactly the two alias spellings the server's firmware alias layer resolves (`resolveRelType`, src/api/normalize/relationships.js:83-94 — accepts either spelling; the primitives suite proves the alias spellings end-to-end); parent-first direction documented once and enforced (`fromUuid` = set); add-before-delete with the same-destination zero-ops guard; cycle-guard **exclusion queries are correct per mode** — `forNode` excludes descendants-of-node (a descendant destination would close `node → … → dest → node`), `intoSet` excludes ancestors-of-fixedSet (an ancestor candidate would become its own ancestor's child-set); both `*0..10`-bounded and both also self-excluding via `filterDestinations`; element-kind excludes only self (ADR decision 3, advisory by design).
- [x] No new dependencies (no package.json changes anywhere in the diff).

## Concept-graph integrity

- [x] Story's concept handles are in `kind:pubkey:slug` form and **verified accurate against the live instance**: `GET /api/assistant/pubkey` returns `11f23fe4…3767`, matching the handles quoted in the story. (Note: OPEN.md rows 44/71 recorded `e00ed090…` on 2026-07-16/21 — the container has been rebuilt since; exactly the churn those rows document, and exactly why code must never hardcode it.)
- [x] No concept definitions changed → **no firmware reinstall required** (ADR states it; confirmed — no firmware JSON in the diff; test fixtures are free-floating `:NostrEvent` nodes torn down in `finally`).
- [x] No re-derivation from BIBLE.md; placements are uuid-based, no concept-handle composition in code.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging / `console.log` / `debugger` / TODO / FIXME in the diff (grepped).
- [x] **No hardcoded TA pubkey**: no 64-hex literal anywhere in the `ui/` + `test/` diff (grepped); the naddr-style uuids flow from route params/outlet context at runtime; ADR-0015 `LEGACY_*` constants untouched.
- [x] Error paths handled: fetch-body parse failure (`res.json().catch(() => null)` → typed throw), 401/403/400/404 all surface; `not-found` on remove treated as stale-row no-change **with a refetch** (self-healing).
- [x] Concurrency: double-submit guarded (`busy` disables Confirm/inputs; `removeBusy` re-entry guard in both pages); TOCTOU between candidate fetch and confirm accepted by the ADR; move partial failure capped at "in both places" by add-first ordering and honestly surfaced.
- [x] Injection: dialog/pages interpolate uuids into Cypher sent to `/api/neo4j/query` — the pre-existing house pattern on every concept page; the endpoint accepts client Cypher by design, so no new capability is added. Writes go only through the owner-gated primitives, which whitelist-resolve `relType` server-side and never interpolate the caller's string.
- [x] `elem` dereference safe: early returns at ElementDetail.jsx:204-205 precede the dialog mount; `columns.push` in ConceptDag operates on a per-render local array (no cross-render mutation).

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling introduced.
- [x] Docker-aware: live tests use container loopback; reviewer's build check used the in-container toolchain (OPEN.md row 71 hazard respected — no host-side `npm install` in `ui/`).

## Product-guide adherence

- N/A — no PRD traced; story originates from the relationship-primitives book's descoped UI affordances via operator request.

## Findings

### Blocking

None.

### Non-blocking

1. **ui/src/components/PlacementDialog.jsx:33-34, 193-204** — a stale `selectedUuid` survives a kind switch: pick a candidate under kind `element`, switch to `subset`, and a candidate that is now cycle-excluded (a descendant) stays selected (the select renders blank but `canConfirm` stays true), so Confirm can write a cycle edge, bypassing the guard from inside the UI. Mitigations that keep this non-blocking: the guard is *advisory by ADR decision 3* (raw API callers can already create cycles), all display queries are `*0..10`-bounded (no hangs), the blank picker is visible, and the single-operator owner can delete the edge. Optional improvement: `setSelectedUuid('')` when `kind` changes, or re-validate the selection against `filterDestinations` inside `handleConfirm`.
2. **ui/src/components/PlacementDialog.jsx:115** — `moveFromKey.split('|')` destructures only the first two segments; a uuid containing `|` (exotic but legal in a d-tag) mis-parses, `effectiveSource` resolves null, and a selected "Move from" silently degrades to a plain add (message would read "Placement created", node left in both places). Optional improvement: split on the *last* `|` (relType never contains one).
3. **ui/src/components/PlacementDialog.jsx:185** — the overlay `onClick={onClose}` is not gated on `busy`, while the Close button is disabled during the two-call move; a stray overlay click mid-move dismisses the dialog and the user can miss the outcome / hazard-note / partial-failure banner (the operations still complete and `onChanged` still fires, so no data effect). Optional improvement: `onClick={busy ? undefined : onClose}`.
4. **ui/src/pages/concepts/ElementDetail.jsx:299-307 (post-diff numbering)** — redundant inner `{isOwner && …}` checks inside the already-`isOwner`-gated Placements block. Harmless; optional cleanup.

### Harness friction

1. **No book anchor for this epic:** `engineering-team/audits/graph-curation-ui/book.md` does not exist — the eager-anchor rule (CLAUDE.md → "Books of work", open at intake) was not followed when this epic/story was opened, so completion detection cannot be computed structurally at this PASS. Recommend the main session open the anchor (the epic's Goal + the story's resolved operator answers form a ready acceptance frame) or fold this story into a declared book; consider an OPEN.md `meta` row if not addressed this session. (Orientation docs otherwise held up: OPEN.md #43 and #75 described exactly what the reviewer found.)

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/graph-curation-ui/1-move-nodes-between-sets-ui.md`).
- [x] Completion detection run: **no book anchor exists for this epic** (see Harness friction 1), so a structural/semantic completeness check has no anchor to compute against. The epic file lists candidate follow-ups (event-backed durable moves) and the operator's ask was satisfied by this single story as scoped — the offer to close a book is deferred until an anchor exists. Flagged to the main session rather than auto-created (opening books is intake/PO lane).
