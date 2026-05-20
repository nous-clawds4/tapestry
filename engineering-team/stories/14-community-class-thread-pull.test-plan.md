# Test Plan: Story 14 — Community class-thread pull (Phase B)

**Story:** `engineering-team/stories/14-community-class-thread-pull.md`
**ADR:** `engineering-team/decisions/0010-community-class-thread-pull.md` (mechanism + classification rule superseded by ADR 0011)
**ADR amendment:** `engineering-team/decisions/0011-class-thread-tags-and-phase-b-mechanism.md` (single-char `n`/`s` tag walk, child-claims-parent; dual-emit migration cycle; authorship trust gate; reserved-future direction convention)
**Date:** 2026-05-19

## Approach
Same precedent as #5/#6/#8/#10/#11. Source/structural sentinels pin the spec-required code shape ADR 0011 specified — endpoint registration + owner gating (T1), `#n`/`#s` tag walk + kind 39999 filter (T2), `:Set` label SET on classified Sets (T3), canonical edge MERGE with no `source` property (T4), visited-set + max-depth guards (T5), authorship trust gate (T6), `s`-tag emission in `handleCreateSet` (T7), `n`-tag emission in `handleAddToSet` (T8). Regression guards lock the #11 install.js contract (R1) and the dual-emit policy that protects against premature descriptor cutover (R2).

The behavioral round-trip — real owner-authenticated POST + auth + `/api/relay/external` against dcosl + real Neo4j + idempotency + honest invariants (no editorial relationships, no election, local concept untouched) + trust-gate enforcement + back-compat z-walk against curator's pre-amendment events + Rule-5 audit interaction — is **not** reproducible in the hand-rolled Node runner (relay + Neo4j + auth + multi-pubkey scenario construction) and is the **authoritative cycle-local smoke S1–S12** (Reviewer-required, per ADR 0011). Story #10's cycle-local definitively vindicated this discipline (caught the pubkey double-encode); #11's cycle-local re-confirmed it (Rule-5 surfaced + benign on server). Same expectation here, with the additional binding posture that **T6 + S12 are the trust-gate gate** (cross-instance election prevention) and must be observed materially, not just structurally.

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (owner-only endpoint POST `/api/concept/:handle/pull-community-class-thread`) | **T1** (registration + requireOwner + literal path). Behavioral S3 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-2 (starts at #11 anchor; 4xx if absent) | Anchor lookup is implementation-detail; **cycle-local S1** verifies anchor pre-check works | — | smoke |
| AC-3 (walk mechanism + `:Set` label SET) | **T2** (`#n` + `#s` filter literals + `kinds:[39999]` per ADR 0011), **T3** (`SET n:Set` on classified Sets). Behavioral S4/S5/S6 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-4 (canonical class-thread edges, no `source` property) | **T4** (MERGE for `HAS_ELEMENT` / `IS_A_SUPERSET_OF` carries no `{source:…}` property bag in pullClassThread.js). Behavioral S4/S5 + Reviewer S9 audit = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-5 (per-member graceful, idempotent, terminating — visited-set + max-depth) | **T5** (`visited` + `maxDepth`/`MAX_DEPTH` symbols in pullClassThread.js). Behavioral S8 (idempotency) = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-6 (honest invariants — no editorial relationships, no election, local untouched) | **T4** (no source on canonical edges, prevents Neo4j-only stub leakage) + **T6** (authorship trust gate prevents cross-instance election) + **R2** (dual-emit regression prevents protocol-cutover-with-collateral). Reviewer S9 audit + S7 (local-counts-pre=post) + S12 (trust-gate behavioral) = cycle-local | test/community-class-thread-pull.test.js (T4 + T6 + R2) + smoke (S7, S9, S12) | source + smoke |
| AC-7 (zero collateral — install.js untouched) | **R1** preserves the #11 Header materialization + `REFERENCES{source:'firmware-community'}` MERGE + cross-curator `IS_A_SUPERSET_OF` MERGE + `:Superset` label SET in `install.js` | test/community-class-thread-pull.test.js | source (sentinel) |
| **NEW (ADR 0011) Trust-gate invariant** | **T6** (authorship trust gate in pullClassThread.js). Behavioral S12 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| **NEW (ADR 0011) `s`-tag emission on Set creation** | **T7** (`['s', resolvedParentUuid]` push in `handleCreateSet`). Behavioral S11/S13 (post-impl, observe new Sets carrying `s` tag on relay) = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| **NEW (ADR 0011) `n`-tag emission on add-to-set** | **T8** (`['n', setUuid]` push on republished source event in `handleAddToSet`). Behavioral S11/S13 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| **NEW (ADR 0011) Dual-emit policy preserved (no premature cutover)** | **R2** (`['relationshipType', REL.CLASS_THREAD_PROPAGATION]` + `['relationshipType', REL.CLASS_THREAD_TERMINATION]` literal patterns remain in `handleCreateSet`/`handleAddToSet`) | test/community-class-thread-pull.test.js | source (sentinel) |

T1–T8 = FAIL pre-impl (pullClassThread.js doesn't exist; `s`/`n` tag emissions absent in normalize/index.js). PASS post.
R1, R2 = PASS pre AND post — regression guards on the #11 install.js contract (R1) and the dual-emit policy (R2). R2 specifically protects against the Implementer accidentally doing the descriptor-event cutover (which is a future ADR, not this story).

## Edge cases
- [x] **No false-positive on existing `IS_A_SUPERSET_OF` MERGEs elsewhere.** T4 scopes its `source`-property check to `pullClassThread.js` only — the file doesn't exist pre-impl, so T4 FAILs at the file-read step. Post-impl, T4 inspects only the Implementer's new file; existing MERGEs in `install.js` / `normalize/index.js` are out of scope.
- [x] **No false-positive on the existing #11 `REFERENCES{source:'firmware-community'}` MERGE.** T4 inspects `pullClassThread.js` only; the #11 MERGE in `install.js` carries `source` legitimately (Neo4j-only stub) and is *outside* T4's scope. R1 explicitly preserves it.
- [x] **No false-positive from existing `pull-` strings or other `/api/concept/:handle/` routes.** T1 anchors on the exact literal `/api/concept/:handle/pull-community-class-thread` plus the registration pattern (`app.post(…, requireOwner, …)`). The existing #9 route is `export-set` (different literal, different verb `app.get`).
- [x] **No false-positive on `#n` or `#s` strings in normalize/index.js docstrings or comments.** T2 reads only `pullClassThread.js` (which doesn't exist pre-impl); existing `n`/`s` letter references in other files are out of scope.
- [x] **No false-positive on `SET n:Set` in normalize/index.js.** T3 reads only `pullClassThread.js`; the local `:Set` precedent at `src/api/normalize/index.js:2937` is out of T3's scope.
- [x] **No false-positive on `visited` / `maxDepth` symbols in unrelated files.** T5 reads only `pullClassThread.js`.
- [x] **No false-positive on `pubkey !==` comparisons in unrelated files.** T6 reads only `pullClassThread.js`. Baseline-verified: `normalize/index.js` has **zero** existing `pubkey !==` or `pubkey ===` comparisons — the trust-gate regex is unambiguous on the new file.
- [x] **No false-positive on existing `['s', `/`['n', ` patterns.** Baseline-verified pre-impl: `normalize/index.js` has **zero** occurrences of `['s',` or `['n',` (or backtick / double-quote variants). T7/T8 will trip cleanly on the first emission added.
- [x] **No false-positive on R2 from descriptor-event const references unrelated to handleCreateSet/handleAddToSet.** R2 anchors on the full literal `['relationshipType', REL.CLASS_THREAD_PROPAGATION]` (line ~2948) and `['relationshipType', REL.CLASS_THREAD_TERMINATION]` (line ~3022). The `REL.CLASS_THREAD_*` consts are defined elsewhere but only ASSIGNED via these literals in handleCreateSet/handleAddToSet. Cutover would require deleting these specific lines, which is what R2 protects against.
- [ ] **Pass-1d direction lock correctness.** Not catchable in source sentinels — the **cycle-local smoke (S4/S5)** is the authoritative check via Cypher matching on `(:Superset)` / `(:Set)` endpoints + element traversal. ADR 0011 mandates Implementer ground pass-1d byte-equivalence before review.
- [ ] **Cross-instance election prevention (trust-gate behavioral).** Not catchable structurally beyond T6 (which only verifies presence of the gate, not correctness). The **cycle-local smoke S12** is the authoritative check via manually publishing a non-curator-pubkey event claiming `['n', '<my-local-Superset-uuid>']`, re-running Phase B, and verifying NO cross-instance edge is MERGEd.
- [ ] **Back-compat z-walk against pre-amendment curator events.** Not catchable structurally — cycle-local **S11** verifies that Phase B materializes the curator's existing dcosl events (which lack `n`/`s` tags) via the z-at-Header back-compat path, MERGEing them as flat HAS_ELEMENT under the community Superset.
- [ ] **Rule-5 audit interaction.** Per ADR 0008 / ADR 0011 — server-side benign (no programmatic enforcement); cycle-local **S10** surfaces + documents.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)
Run on the local Docker stack (control panel `http://localhost:7778`):

**S1 — Pre-check: #11 anchor exists locally.** Cypher `MATCH (s:Superset {uuid:'39999:919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff:nostr-relay-superset'}) RETURN count(s)` → expect `1`. If `0`, owner runs firmware install first (one-time setup; out of scope to retry here).

**S2 — Pre-check: curator events present on dcosl.** Two parallel checks:
- **New-encoding path (likely empty pre-curator-migration):** `curl 'http://localhost:7778/api/relay/external?...&relays=wss://dcosl.brainstorm.world'` with filter `{"kinds":[39999],"authors":["919ba08af778…"],"#n":["39999:919ba08af778…:nostr-relay-superset"]}` → expect 0 (curator hasn't migrated yet); same for `#s`. Document as expected.
- **Back-compat path (must be non-empty):** same curl with filter `{"kinds":[39999],"authors":["919ba08af778…"],"#z":["39998:919ba08af778…:nostr-relay"]}` → expect ≥ 12 events (per the inventory grounding finding). If 0, surface + STOP (curator's existing exports are missing; that's feature-blocking upstream of #14).

**S3 — AC-1 (real endpoint POST):** authenticated owner POST `/api/concept/nostr-relay/pull-community-class-thread` (NIP-07 session in browser, or scripted-via-fetch-in-owner-tab). Expect 200 with non-zero `materialized` + `edgesMerged`. Capture the response JSON for the smoke record. Per ADR 0011, the response shape is `{supersetUuid, fetched, materialized, edgesMerged, skipped, errors[], truncated, depth}`.

**S4 — AC-3+AC-4 (direct element membership materialized via #n + back-compat z):** Cypher `MATCH (s:Superset {uuid:'<communitySuperset>'})-[:HAS_ELEMENT]->(e) RETURN count(*)` → expect > 0. Per ADR 0011, root-iteration HAS_ELEMENT edges may come from EITHER the `#n` walk (if curator has migrated) OR the back-compat z-at-Header walk (against curator's existing 12 events). Either way, count > 0 on a real consumer instance after S3.

**S5 — AC-3+AC-4 (recursive sub-Sets + leaves via #s):** Cypher `MATCH (comm:Superset {uuid:'<communitySuperset>'})-[:IS_A_SUPERSET_OF*1..16]->(child:Set)-[:HAS_ELEMENT]->(leaf) RETURN count(*)` → expect > 0 only if curator has migrated to emit `s` tags. **Pre-curator-migration: expect 0** (back-compat z-walk runs only at root depth and wires flat HAS_ELEMENT — no hierarchy reconstruction). Document the expectation honestly: hierarchy reconstruction is gated on curator-side migration to `s` tags; until then, Phase B yields flat HAS_ELEMENT closure (which is correct behavior for the back-compat path).

**S6 — AC-3 (`:Set` label SET on foreign Sets):** Cypher `MATCH (n:Set) WHERE n.uuid STARTS WITH '39999:919ba08af778…:' RETURN count(n)` → expect > 0 only if at least one foreign Set was discovered via `#n`/`#s` walk AND classified (z-tag = `:set`). Pre-curator-migration: count of foreign `:Set`-labelled nodes depends on whether the curator's existing 12 events include any Sets z-tagged at the curator's `:set` concept. If yes (likely — the curator's 14 events with `z=:set` per inventory grounding), some foreign Sets will be present.

**S7 — AC-6 (honest invariant — local concept untouched, binding):** Before S3, snapshot: `MATCH (local:ListHeader {uuid:'39998:<localTA>:nostr-relay'})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT*0..]-(n) RETURN count(n)` AND `MATCH (a)-[:IS_A_SUPERSET_OF]->(b) WHERE a.uuid STARTS WITH '39999:<localTA>:' AND b.uuid STARTS WITH '39999:<localTA>:' RETURN count(*)`. After S3: re-run. Counts MUST be equal. If they differ, election leaked → FAIL loudly (ADR 0011 invariant + AC-6 violated).

**S8 — AC-5 (idempotency):** Re-run S3 → re-check S4, S5, S6 counts → MUST be unchanged from first pull. Re-check node counts too (no duplicate foreign nodes).

**S9 — Reviewer audit (no editorial relationships smuggled in):** Cypher `MATCH ()-[r]->() WHERE startNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND endNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND type(r) NOT IN ['HAS_ELEMENT','IS_A_SUPERSET_OF','IS_THE_CONCEPT_FOR'] RETURN type(r), count(*)` → expect zero non-class-thread edges between foreign nodes. Plus Cypher: `MATCH ()-[r]->() WHERE startNode(r).uuid STARTS WITH '39999:<localTA>:' AND endNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND type(r) <> 'IS_A_SUPERSET_OF' RETURN type(r), count(*)` → expect zero cross-pubkey edges other than the #11 IS_A_SUPERSET_OF anchor → proves no election.

**S10 — Rule-5 audit interaction (per ADR 0008 §5 / ADR 0011):** No programmatic server-side audit (lives in `tapestry-cli`, separate repo). Document benign on server; same posture as #11.

**S11 — NEW: back-compat z-at-Header walk fires correctly.** Read response from S3: `fetched` should be ≥ 12 (the back-compat z-walk picks up the curator's existing concept-Header-z-tagged events). The `materialized` count should equal (or be slightly less than) the `fetched` count (delta = trust-gate-skipped events, which should be 0 for the curator's own events). This confirms Phase B's back-compat path is functional.

**S12 — NEW: trust gate prevents cross-instance election (binding).** Construction:
1. Publish a kind-39999 event from a NON-curator pubkey (e.g. the local TA, or any test pubkey) carrying `['n', '39999:<curatorPk>:nostr-relay-superset']` — i.e., a malicious-looking attempt to inject content claiming the curator's Superset as parent.
2. Re-run S3.
3. Cypher `MATCH (e {uuid:'39999:<non-curator-pubkey>:<dtag>'}) RETURN count(e)` → expect `0` (the event was NOT materialized).
4. Cypher `MATCH ()-[r:HAS_ELEMENT]->() WHERE startNode(r).uuid='39999:<curatorPk>:nostr-relay-superset' AND endNode(r).pubkey <> '<curatorPk>' RETURN count(r)` → expect `0` (no cross-instance edge).
5. Response from S3 should show `skipped` ≥ 1 and `errors[].step==='trust-gate'` ≥ 1 for the rejected event.
6. Local concept's HAS_ELEMENT + IS_A_SUPERSET_OF counts UNCHANGED from S7's snapshot.

If S12 doesn't produce the expected zero counts, the trust gate is broken and election is possible. FAIL loudly.

**S13 (optional, defensive) — Owner can re-pull after creating new Sets locally.** Create a new local Set via `/api/normalize/create-set` (which should now emit the `s` tag per T7 + still emit the descriptor per R2). Verify on local strfry: the new Set event has tag `['s', '<parent-uuid>']`. Verify on Neo4j: the local hierarchy is byte-equivalent to pre-T7 behavior (the new `s` tag doesn't change local class-thread shape; Pass-1c still wires IS_A_SUPERSET_OF from the descriptor event or direct MERGE). Then add an item to the new Set via `/api/normalize/add-to-set` — verify the item's strfry event was republished with `['n', '<new-set-uuid>']` added.

## Test infrastructure
- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps. Suite registered: `communityClassThreadPull`.
- Asserts against four files: `src/api/concept/pullClassThread.js` (the new handler — must exist), `src/api/index.js` (registration line), `src/firmware/install.js` (R1 regression guard), `src/api/normalize/index.js` (T7/T8 emission + R2 dual-emit regression).
- No Playwright. No relay calls. No Neo4j. (Auth + relay + Neo4j + multi-pubkey scenario is cycle-local smoke territory.)

## How to run
```
npm test
```
Targeted: `node -e "require('./test/community-class-thread-pull.test.js').run()"`

## Verification
Confirmed against pre-implementation tree (atop ADR-amendment commit `0d65b74f`). Actual `npm test` tail:

```
community-class-thread-pull suite:
  ✗ T1: POST /api/concept/:handle/pull-community-class-thread is registered with requireOwner middleware (AC-1, ADR 0010 §"Surface")
      src/api/index.js does not register POST /api/concept/:handle/pull-community-class-thread with the requireOwner middleware (AC-1; ADR 0010 §"Surface"). Mirror Story #9's export-set registration at line 491 — POST verb, exact literal path, requireOwner as second argument, handler as third.
  ✗ T2: pullClassThread.js walks #n AND #s tag filters at kind 39999 (AC-3, ADR 0011 §"Phase B walk mechanism")
      src/api/concept/pullClassThread.js does not exist yet. Implementer must create the handler per ADR 0011 (single-char #n/#s child-claims-parent tag walk from the #11 community Superset anchor; owner-only via requireOwner).
  ✗ T3: pullClassThread.js SETs :Set label on classified foreign Sets (AC-3, ADR 0011 §"Decision")
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T4: pullClassThread.js MERGEs canonical HAS_ELEMENT / IS_A_SUPERSET_OF with NO source property (AC-4 + AC-6, ADR 0010 §"Trust constraints" + ADR 0011 §"Decision")
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T5: pullClassThread.js carries visited-set + max-depth termination guards (AC-5, ADR 0011 §"Phase B walk mechanism")
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T6: pullClassThread.js enforces authorship trust gate (skips events whose pubkey !== curatorPk) (ADR 0011 §"Trust constraints" §1)
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T7: handleCreateSet emits child-claims-parent `s` tag on the Set event (ADR 0011 §"Emission in handleCreateSet")
      src/api/normalize/index.js does not emit the canonical `s` tag (ADR 0011 §"Emission in handleCreateSet"). In handleCreateSet (line ~2934), add `tags.push(['s', resolvedParentUuid]);` before signAndFinalize. Mirrors the existing z-tag pattern: lowercase single-char tag with the parent's a-tag form as value. Dual-emit policy — keep the existing descriptor-event publication unchanged (R2 regression-guards it).
  ✗ T8: handleAddToSet emits child-claims-parent `n` tag on the source event via republish (ADR 0011 §"Emission in handleAddToSet")
      src/api/normalize/index.js does not emit the canonical `n` tag (ADR 0011 §"Emission in handleAddToSet"). In handleAddToSet (line ~3014), build and publish a replaceable kind-39999 event with the existing source tags + `['n', setUuid]` added, before publishing the descriptor event. Locally-authored items only (foreign-authored items cannot be re-signed — log + skip the `n` tag for those; descriptor event still emitted). Dual-emit policy — keep the existing descriptor-event publication unchanged (R2).
  ✓ R1: install.js #11 Header materialization + REFERENCES MERGE + IS_A_SUPERSET_OF MERGE preserved (regression guard)
  ✓ R2: handleCreateSet + handleAddToSet still emit descriptor events (dual-emit policy regression guard, ADR 0011 §"Emission policy")

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
strfry-router-first-boot-config suite:           PASS (3 passed, 0 failed)
per-query-neo4j-timeout-safety-net suite:        PASS (8 passed, 0 failed)
nip05-checkmark-verification suite:              PASS (4 passed, 0 failed)
publish-export-a-concept suite:                  PASS (3 passed, 0 failed)
community-reference-nostr-relay-stub suite:      PASS (4 passed, 0 failed)
header-conceptgraph-tag suite:                   PASS (2 passed, 0 failed)
community-reference-superset-link suite:         PASS (4 passed, 0 failed)
community-class-thread-pull suite:               FAIL (2 passed, 8 failed)
Overall:                                         FAIL
```

Every prior suite stays green — Phase B test additions cause **zero false-positive regression**. T1–T8 FAIL pre-impl with implementer-actionable messages (file-doesn't-exist messages cite ADR 0011 explicitly; each spec clause cites its AC + ADR section + line number where applicable). R1 + R2 PASS pre-impl, both must remain PASS post-impl (R1 regression guard on #11 install.js contract; R2 regression guard on the dual-emit policy — protects against premature descriptor cutover).
