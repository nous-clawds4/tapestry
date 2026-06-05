# Review: Story #14 — Community class-thread pull (Phase B)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-19
**Diff:** impl commit `41d39fee` (vs Test-Design-amendment boundary `42d1f3e5`)
**Story/ADR/Plan:** `stories/14-community-class-thread-pull.md` · `decisions/0010-community-class-thread-pull.md` (mechanism superseded by) `decisions/0011-class-thread-tags-and-phase-b-mechanism.md` · `stories/14-community-class-thread-pull.test-plan.md`

## Quality gate (run by reviewer, not trusted)
- [x] `npm test` — **Overall PASS**. community-class-thread-pull 10/10 (T1–T8 PASS post-impl; R1 + R2 PASS); all 9 prior suites green. Re-run by reviewer.
- [x] Lint/typecheck/build — not configured (per CLAUDE.md house rules: "Don't add new lint or typecheck tooling without an explicit ADR"). Skipped.

## Spec adherence (Story #14 ACs)
- **AC-1** (owner-only endpoint) ✓ — `src/api/index.js:493-494` registers `app.post('/api/concept/:handle/pull-community-class-thread', requireOwner, handlePullCommunityClassThread)`. Mirrors Story #9's export-set registration (line 491). T1 anchor.
- **AC-2** (start anchor; 4xx if absent) ✓ — `pullClassThread.js:127-137` explicit MATCH on `(:Superset {uuid:communitySupersetUuid})`; returns 400 with actionable message ("Run firmware install first") if absent. Behavioral S1 = cycle-local.
- **AC-3** (walk mechanism + `:Set` label SET) ✓ — `pullClassThread.js:155-298` BFS over `#n` + `#s` filters at kind 39999 (per ADR 0011 §"Phase B walk mechanism"); back-compat `#z`-at-curator-Header walk at root depth only (line 188). Classification via z-tag = `39998:<curatorPk>:set` (line 248-250, per ADR 0011 rule). `SET n:Set` on classified Sets (line 283). T2 + T3 anchors.
- **AC-4** (canonical class-thread edges, no `source` property) ✓ — Lines 260-272: `MERGE (p)-[:HAS_ELEMENT]->(c)` and `MERGE (p)-[:IS_A_SUPERSET_OF]->(c)`. No `{source:…}` property bag on either. T4 sweep confirms; reviewer grep of full file confirms only `HAS_ELEMENT` and `IS_A_SUPERSET_OF` MERGE statements exist (lines 263, 270 — plus docstring references on lines 34, 252).
- **AC-5** (per-member graceful, idempotent, terminating) ✓ — Per-event try/catch at each of: relay fetch (lines 169, 181, 200), publish + materialize (line 241), edge MERGE (line 275), label SET (line 287). visited-set (line 144), maxDepth (line 140, env `BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH` default 16), maxFetch (line 141, env `BRAINSTORM_COMMUNITY_PULL_MAX_FETCH` default 2000). Idempotency by visited-set + MERGE + deterministic uuids. T5 anchor; behavioral S8 = cycle-local.
- **AC-6** (honest invariants — no editorial relations, no election, local untouched):
  - **No editorial relationships** ✓ — Reviewer grep of `src/api/concept/pullClassThread.js` for any MERGE statement finds ONLY `:HAS_ELEMENT` and `:IS_A_SUPERSET_OF`. No `RECOMMENDED_BY` / `ENDORSES` / `DEPENDS_ON` / similar editorial types. T4 sweep + R2 dual-emit guard confirm.
  - **No election** ✓ — Trust gate present at `pullClassThread.js:226-234` (binding); rejects events whose `pubkey !== curatorPk` with skip-and-log-and-count semantics matching ADR 0011 §"Trust constraints" §1. By-construction local-graph isolation: queue starts at curator's Superset (line 145); `nextQueue` only adds Sets that passed the trust gate (line 290) — all curator-pubkey; so the parent endpoint of every MERGEd edge is curator-pubkey. T6 anchor; behavioral S12 = cycle-local (binding).
  - **Local concept untouched** ✓ — By construction, the walk never visits a local-TA-pubkey node. Cycle-local S7 (snapshot-pre = snapshot-post) is the binding behavioral check.
- **AC-7** (zero collateral) ✓ — `install.js` untouched (R1 PASS); Phase A flow byte-preserved. `normalize/index.js` additions are purely additive (the new `s` tag in `handleCreateSet` and the new `n`-tag republish in `handleAddToSet`); the existing descriptor-event publication is preserved (R2 PASS). No changes to Story #9's export-set, the #11 anchor, the `communityReference` manifest field, or the `concept-graph` tag.

## ADR 0010+0011 adherence
- ADR 0011 §"Phase B walk mechanism" (chosen Option A) — single-tier child-claims-parent walks via `#n` + `#s` ✓; root-iteration back-compat `#z` walk ✓; pass-1d-equivalent direction (parent→child) ✓.
- ADR 0011 §"Decision" §"Set vs element classification rule" — `isSet ⇔ event has z-tag = 39998:<curatorPk>:set` ✓ (line 248-250).
- ADR 0011 §"Emission policy (dual-emit cycle)" — `handleCreateSet` emits new `s` tag before signing ✓; `handleAddToSet` re-publishes source event with `n` tag appended (locally-authored items only; foreign items graceful-skip with log) ✓; descriptor events preserved (R2 PASS).
- ADR 0011 §"Trust constraints" §1 (authorship gate) ✓; §2 (local-graph isolation) ✓ by construction; §3 (no editorial relationships) ✓.
- ADR 0011 §"Termination guarantees" — visited-set ✓; max-depth (env-configurable default 16) ✓; max-fetch budget (env-configurable default 2000) ✓; per-event timeout (inherited from `/api/relay/external` 8000ms default per `src/api/relay/fetchEvents.js:19`) ✓.
- ADR 0011 §"Idempotency" — deterministic curator a-tags + Neo4j `MERGE` + visited-set within a walk ✓; cross-call MERGE-on-uuid guarantees no duplicate nodes/edges ✓. Behavioral S8 = cycle-local.
- ADR 0011 §"Response shape" — `{success, supersetUuid, fetched, materialized, edgesMerged, skipped, errors[], truncated, depth}` ✓ (lines 302-312).
- ADR 0011 §"UI surface" — button on `ConceptDetail.jsx` next to "Publish concept to community" ✓; inline progress / counts ✓; surfaces `skipped` (trust-gate annotation) + `truncated` indicator ✓.
- ADR 0011 §"BIBLE §22 update" — Phase B paragraph appended ✓; Deferred list updated ✓.
- ADR 0011 §"BIBLE new section" — §23 "Class-Thread Membership Tags" added ✓; canonical `n`/`s` tag spec ✓; direction principle + reserved-future uppercase convention codified ✓; future-candidate tags (`IS_A_PROPERTY_OF`, `REFERENCES`, editorial relationships) named without committing letters ✓.
- ADR 0011 §"Blast radius" — actual: +5 files / +458 insertions. Matches estimate (within range).

## Things tests can't catch (reviewer audit)

1. **Direction lock against pass-1d byte-equivalence.** Verified manually:
   - install.js:627 `MERGE (sup)-[:HAS_ELEMENT]->(elem)` (parent → child) ≡ pullClassThread.js:263 `MERGE (p)-[:HAS_ELEMENT]->(c)` (parent → child). ✓
   - install.js:476 `MERGE (a)-[:IS_A_SUPERSET_OF]->(b)` with `from = parentSupersetUuid`, `to = childSupersetUuid` (parent → child) ≡ pullClassThread.js:270 `MERGE (p)-[:IS_A_SUPERSET_OF]->(c)` (parent → child). ✓
   - Cycle-local S4/S5 confirms materially via Cypher matching.

2. **Trust gate timing.** Placed AFTER `visited.add` (line 220) but BEFORE materialization (line 237). Effect: a rejected event is recorded in visited so it won't be re-processed in subsequent walks within the same call (across `s`/`n`/`z` batches and across depths). Across separate calls, visited resets. Correct semantics — rejecting once per call is sufficient defense.

3. **`writeCypher` vs `runCypher`.** Line 128 uses `runCypher` (read-only) for the anchor existence check. Lines 260, 267, 283 use `writeCypher` for the MERGE + SET operations. Per `lib/neo4j-driver.js` API conventions, this is correct.

4. **`uuidOf` defensive parsing.** Line 71-76 handles missing `d` tag, wrong types for pubkey/kind. Returns null. Caller at line 217 skips null. ✓ Prevents crashing on malformed events.

5. **Cypher parameterization.** All `runCypher` / `writeCypher` calls use parameterized queries (`$p`, `$c`, `$u`). No string interpolation of untrusted input into Cypher. ✓

6. **`String(cr.headerATag || '')` malformation guard.** Line 106 — if `cr.headerATag` is undefined / null / non-string, coerces to empty string, then the parts-length-3 + `parts[0] === '39998'` check rejects. ✓

7. **`handleAddToSet` n-tag republish race window.** Between the `strfry scan` read (line ~3022 in normalize/index.js) and the `publishToStrfry` of the replacement (line ~3043), another mutation to the same item could race. Probability is low (single-server scope; same item being added to multiple sets concurrently is rare); mitigation is acceptable. **Non-blocking observation** — surfaced for future-cutover-ADR awareness if mixed-authorship items become common and the republish frequency rises.

8. **`handleAddToSet` foreign-authored item path.** When `itemAuthor !== localTApubkey` (e.g., adding a #11-anchor-materialized community Header to a local Set), the `n`-tag republish skips with a `console.warn`; the descriptor event still fires (line ~3057+ unchanged). Functional consequence: a consumer walking via `#n` won't see this edge, but can still discover it via the back-compat `#z` walk OR via Neo4j's HAS_ELEMENT edge (MERGEd at line ~3072). Degrades gracefully without breaking. **Non-blocking observation** — documented in ADR 0011 §"Emission in handleAddToSet" edge case.

9. **strfry scan inline `exec()` injection surface.** Line ~3022: `safeFilter = filter.replace(/'/g, "'\\''")`. Filter content is constructed from `itemKind` (parsed int), `itemAuthor` (Neo4j-trusted pubkey), `itemDTag` (Neo4j-trusted d-tag). Not user-controlled input. ✓ Safe. (Mirrors exportSet.js:25-26 pattern.)

10. **HTTP loopback overhead.** `pullClassThread.js` uses `fetch` to localhost for `/api/relay/external` and `/api/strfry/publish` — same pattern as `install.js`. Slight overhead vs direct module calls but keeps code parallel to Phase A and avoids dragging internal helpers into the new module. Acceptable.

11. **No secrets, no debug cruft, no commented-out code, no concurrency surface beyond the documented race.**

12. **BIBLE update completeness.** §22 Phase B paragraph + Deferred list updates correctly ✓. New §23 spec is comprehensive ✓. Glossary additions in §23 are sufficient ✓. Reserved-future convention is documented ✓.

## Findings
### Blocking
None.

### Non-blocking (binding-on-smoke)
1. **Cycle-local S12 (trust gate behavioral verification) is binding.** Per ADR 0011 §"Trust constraints" §1, the trust gate prevents cross-instance election. T6 verifies presence structurally; S12 must MATERIALLY construct a non-curator-pubkey event claiming `['n', '<curatorSupersetUuid>']`, re-run Phase B, and verify (a) the event is NOT materialized, (b) zero cross-instance edges appear, (c) skipped/errors counters incremented with `step==='trust-gate'`, (d) local concept counts byte-unchanged. Don't ship past staging without this verified end-to-end.

2. **Cycle-local S7 (honest-invariant snapshot diff) is binding.** Snapshot local concept's HAS_ELEMENT and IS_A_SUPERSET_OF counts BEFORE S3, run S3, snapshot AFTER. MUST be byte-equal. By-construction analysis says this holds, but cycle-local verifies the live system enforces it.

3. **Cycle-local S5 honest scoping.** Per ADR 0011 §"Phase B walk mechanism" + §"Migration" + test plan smoke-S5 framing: hierarchy reconstruction (recursive `IS_A_SUPERSET_OF`) requires curator-side migration to emit `s` tags. Pre-curator-migration, S5 will return 0 — that's CORRECT behavior per the back-compat z-walk yielding flat HAS_ELEMENT. The smoke recorder must document this honestly, NOT mark S5 as failed.

4. **Cycle-local S11 (back-compat z-walk fires) is essential.** Confirms Phase B materializes the curator's existing 12 dcosl events under the community Superset via the `#z`-at-Header walk. Without this confirmation, we can't verify that Phase B does anything useful pre-curator-migration.

## Verdict (initial — PASS, code/ADR/scope, pre-smoke)
**PASS (code/ADR/scope).** No blocking issues. Implementation is minimal + ADR-conformant + preserves all #11 Phase A behavior + dual-emit policy honored. The trust gate, no-editorial-relations invariant, pass-1d direction equivalence, and termination guards are all present and structurally verified. Honest invariants (AC-6) hold by construction; behavioral verification is gated on **Reviewer-required cycle-local smoke S1–S12** (per ADR 0011 §"Cycle-local smoke (authoritative)"), with **S12 binding** (trust gate cannot be only structurally verified). Same posture as #10/#11's pre-smoke verdicts — the discipline holds: structural sentinels + reviewer audit are necessary but not sufficient; cycle-local is the authoritative behavioral gate.

**Authorized next step:** cycle-local smoke S1–S12 (per ADR 0011 §"Cycle-local smoke") on the local Docker stack (`http://localhost:7778`, local TA `e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36`, curator TA `919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff`).
