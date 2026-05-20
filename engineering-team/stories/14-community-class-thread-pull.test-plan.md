# Test Plan: Story 14 — Community class-thread pull (Phase B)

**Story:** `engineering-team/stories/14-community-class-thread-pull.md`
**ADR:** `engineering-team/decisions/0009-community-class-thread-pull.md`
**Date:** 2026-05-20

## Approach
Same precedent as #5/#6/#8/#10/#11. Source/structural sentinels pin the spec-required code shape ADR 0009 specified — endpoint registration + owner gating, z-tag walk filter shape, `:Set` label SET, canonical edge MERGE with no `source` property, visited-set + max-depth guards. The behavioral round-trip — real owner-authenticated POST actually fetches `#z`-tagged events from `wss://dcosl.brainstorm.world`, materializes a foreign sub-graph (Sets + elements), wires the canonical `HAS_ELEMENT` / `IS_A_SUPERSET_OF` edges in pass-1d-equivalent direction, holds the honest invariants (no editorial relationships, no election, local concept untouched), behaves idempotently, graceful-skips per-member errors, Rule-5 audit interaction — is **not** reproducible in the hand-rolled Node runner (relay + Neo4j + auth) and is the **authoritative cycle-local smoke S1–S10** (Reviewer-required, per ADR 0009). Story #10's cycle-local definitively vindicated this discipline (it caught the pubkey double-encode); #11's cycle-local re-confirmed it (Rule-5 surfaced + recorded as benign on server). Same expectation here.

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (owner-only endpoint POST `/api/concept/:handle/pull-community-class-thread`) | **T1** (registration + requireOwner + literal path). Behavioral S3 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-2 (starts at #11 anchor; 4xx if absent) | Anchor lookup is implementation-detail; **cycle-local S1** verifies anchor pre-check works | — | smoke |
| AC-3 (z-tag recursive walk; `:Set` label SET) | **T2** (`#z` filter + `kinds:[39999]`), **T3** (`SET n:Set` on classified Sets). Behavioral S5/S6 = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-4 (canonical class-thread edges, no `source` property) | **T4** (MERGE for `HAS_ELEMENT` / `IS_A_SUPERSET_OF` carries no `{source:…}` property bag in pullClassThread.js). Behavioral S4/S5 + Reviewer S9 audit = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-5 (per-member graceful, idempotent, terminating — visited-set + max-depth) | **T5** (`visited` symbol + `maxDepth`/`MAX_DEPTH` symbol in pullClassThread.js). Behavioral S8 (idempotency) = cycle-local | test/community-class-thread-pull.test.js | source + smoke |
| AC-6 (honest invariants — no editorial relationships, no election, local untouched) | **T4** prevents `source` properties on the new edges (no Neo4j-only stubs); the "no editorial relationships" check is enforced via **S9 Reviewer audit** in cycle-local (grep diff + Cypher audit). Behavioral S7 (local concept counts pre = post) = cycle-local | test/community-class-thread-pull.test.js (T4) + smoke (S7, S9) | source + smoke |
| AC-7 (zero collateral) | **R1** preserves the #11 Header materialization + `REFERENCES{source:'firmware-community'}` MERGE + cross-curator `IS_A_SUPERSET_OF` MERGE in `install.js` (Phase B is an *additive* on-demand endpoint; install.js must not be touched) | test/community-class-thread-pull.test.js | source (sentinel) |

T1/T2/T3/T4/T5 = FAIL pre-impl (pullClassThread.js does not exist, registration line absent), PASS post.
R1 = PASS pre AND post (regression guard on the #11 `install.js` contract — Phase B does NOT modify install.js).

## Edge cases
- [x] **No false-positive on existing `IS_A_SUPERSET_OF` MERGEs elsewhere.** T4 scopes its `source`-property check to `pullClassThread.js` only — the file doesn't exist pre-impl, so T4 FAILs at the file-read step. Post-impl, T4 inspects only the Implementer's new file; existing MERGEs in `install.js` / `normalize/index.js` are out of scope.
- [x] **No false-positive on the existing #11 `REFERENCES{source:'firmware-community'}` MERGE.** T4 inspects `pullClassThread.js` only; the #11 MERGE in `install.js` carries `source` legitimately (Neo4j-only stub) and is *outside* T4's scope. R1 explicitly preserves it.
- [x] **No false-positive from existing `pull-` strings or other `/api/concept/:handle/` routes.** T1 anchors on the exact literal `/api/concept/:handle/pull-community-class-thread` plus the registration pattern (`app.post(…, requireOwner, …)`). The existing #9 route is `export-set` (different literal, different verb `app.get`).
- [x] **No false-positive on `#z` appearing in comments or docs.** T2 requires `#z` AND `kinds:[39999]` (with optional whitespace) — both must appear together within the same file. Docstrings mentioning `#z` alone won't trip the kind filter.
- [x] **No false-positive on `SET n:Set` in normalize/index.js.** T3 reads only `pullClassThread.js`; the local `:Set` precedent at `src/api/normalize/index.js:2937` is out of T3's scope.
- [x] **No false-positive on `visited` / `maxDepth` symbols in unrelated files.** T5 reads only `pullClassThread.js`.
- [ ] **Pass-1d direction lock correctness.** Not catchable in source sentinels — the **cycle-local smoke (S4/S5/S6)** is the authoritative check via Cypher matching on `(:Superset)` / `(:Set)` endpoints + element traversal. ADR 0009 mandates Implementer ground pass-1d byte-equivalence before review.
- [ ] **Pass-1d Superset-edge pruning replication.** Not catchable in source sentinels — Reviewer audit + **cycle-local smoke** verifies the foreign sub-graph shape is canonical.
- [ ] **Rule-5 audit interaction.** Per ADR 0008 / ADR 0009 — server-side benign (no programmatic enforcement); cycle-local **S10** surfaces + documents.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)
Run on the local Docker stack (control panel `http://localhost:7778`):

**S1 — Pre-check: #11 anchor exists locally.** Cypher `MATCH (s:Superset {uuid:'39999:919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff:nostr-relay-superset'}) RETURN count(s)` → expect `1`. If `0`, owner runs firmware install first (one-time setup; out of scope to retry-here).

**S2 — Pre-check: curator class-thread members on dcosl.** Cypher / curl: `curl 'http://localhost:7778/api/relay/external?...&relays=wss://dcosl.brainstorm.world'` with filter `{"kinds":[39999],"#z":["39999:919ba08af7786892093b8264332d817379662a0ba0ba1f5c791ed7b62a7ee2ff:nostr-relay-superset"]}` → expect ≥ 1 event. If 0, surface + STOP (means the curator never exported class-thread members; that's feature-blocking upstream of #14 and out of scope to fix here).

**S3 — AC-1 (real endpoint POST):** authenticated owner POST `/api/concept/nostr-relay/pull-community-class-thread` (NIP-07 session in browser, or scripted-via-fetch-in-owner-tab). Expect 200 with non-zero `materialized` + `edgesMerged`. Capture the response JSON for the smoke record.

**S4 — AC-3+AC-4 (direct element membership materialized):** Cypher `MATCH (s:Superset {uuid:'<communitySuperset>'})-[:HAS_ELEMENT*0..1]->(e) RETURN count(*)` (or pass-1d-equivalent direction) → expect > 0.

**S5 — AC-3+AC-4 (recursive sub-Sets + leaves wired):** Cypher `MATCH p=(comm:Superset {uuid:'<communitySuperset>'})<-[:IS_A_SUPERSET_OF*1..16]-(child:Set)-[:HAS_ELEMENT]->(leaf) RETURN count(*)` (direction subject to pass-1d lock) → expect > 0.

**S6 — AC-3 (:Set label SET on foreign Sets):** Cypher `MATCH (n:Set) WHERE n.uuid STARTS WITH '39999:919ba08af778…:' RETURN count(n)` → expect > 0 (the foreign Sets ended up with `:Set` label, not just `:ListItem`).

**S7 — AC-6 (honest invariant — local concept untouched):** Before S3, snapshot: `MATCH (local:ListHeader {uuid:'39998:<localTA>:nostr-relay'})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT*0..]-(n) RETURN count(n)` AND `MATCH (a {uuid STARTS WITH '39999:<localTA>:'})-[:IS_A_SUPERSET_OF]->(b) RETURN count(*)`. After S3: re-run. Counts MUST be equal. If they differ, election leaked → FAIL loudly (ADR 0009 invariant violated).

**S8 — AC-5 (idempotency):** Re-run S3 → re-check S4, S5, S6 counts → MUST be unchanged from first pull. Re-check node counts too (no duplicate foreign nodes).

**S9 — Reviewer audit (no editorial relationships smuggled in):** Cypher `MATCH ()-[r]->() WHERE startNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND endNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND type(r) NOT IN ['HAS_ELEMENT','IS_A_SUPERSET_OF','IS_THE_CONCEPT_FOR'] RETURN type(r), count(*)` → expect zero non-class-thread edges between foreign nodes. (Also Cypher: `MATCH ()-[r]->() WHERE startNode(r).uuid STARTS WITH '39999:<localTA>:' AND endNode(r).uuid STARTS WITH '39999:919ba08af778…:' AND type(r) <> 'IS_A_SUPERSET_OF' RETURN type(r), count(*)` → expect zero cross-pubkey edges other than the #11 IS_A_SUPERSET_OF anchor → proves no election.)

**S10 — Rule-5 audit interaction (per ADR 0008 §5 / ADR 0009):** No programmatic server-side audit (lives in `tapestry-cli`, separate repo). Document benign on server; same posture as #11.

**S11 — Total-fetch budget + truncation (defensive):** Optionally, set `BRAINSTORM_COMMUNITY_PULL_MAX_FETCH=5` env on the container (override), re-run S3, expect `truncated:true` in response and `fetched===5`. Documents that the budget mechanism works. Skippable if curator vocabulary is small.

**S12 — Max-depth termination (defensive):** Optionally, set `BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH=1`, re-run S3, expect `depth===1` in response and no foreign Sets materialized at depth ≥ 2. Skippable if curator vocabulary is shallow.

## Test infrastructure
- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps. Will register: `communityClassThreadPull`.
- Asserts against three files: `src/api/concept/pullClassThread.js` (the new handler — must exist), `src/api/index.js` (registration line), `src/firmware/install.js` (R1 regression guard).
- No Playwright. No relay calls. No Neo4j. (Auth + relay + Neo4j is cycle-local smoke territory.)

## How to run
```
npm test
```
Targeted: `node -e "require('./test/community-class-thread-pull.test.js').run()"`

## Verification
Confirmed against pre-implementation tree (atop ADR commit `e0d568b2`). Actual `npm test` tail:

```
community-class-thread-pull suite:
  ✗ T1: POST /api/concept/:handle/pull-community-class-thread is registered with requireOwner middleware (AC-1, ADR 0009)
      src/api/index.js does not register POST /api/concept/:handle/pull-community-class-thread with the requireOwner middleware (AC-1; ADR 0009). Mirror Story #9's export-set registration at line 491 — POST verb, exact literal path, requireOwner as second argument, handler as third.
  ✗ T2: pullClassThread.js walks z-tags via /api/relay/external (#z filter + kinds:[39999]) (AC-3, ADR 0009)
      src/api/concept/pullClassThread.js does not exist yet. Implementer must create the handler per ADR 0009 (z-tag recursive walk starting at the materialized community Superset from #11; owner-only via requireOwner).
  ✗ T3: pullClassThread.js classifies and SETs :Set label on foreign Sets (AC-3, ADR 0009)
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T4: pullClassThread.js MERGEs canonical HAS_ELEMENT / IS_A_SUPERSET_OF with NO source property (AC-4 + AC-6, ADR 0009)
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✗ T5: pullClassThread.js carries visited-set + max-depth termination guards (AC-5, ADR 0009)
      src/api/concept/pullClassThread.js does not exist — see T2 for the create-this-file message.
  ✓ R1: install.js #11 Header materialization + REFERENCES MERGE + IS_A_SUPERSET_OF MERGE preserved (regression guard)

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
community-class-thread-pull suite:               FAIL (1 passed, 5 failed)
Overall:                                         FAIL
```

Every prior suite stays green — Phase B test additions cause **zero false-positive regression**. T1–T5 FAIL pre-impl with implementer-actionable messages (file-doesn't-exist messages cite ADR 0009 explicitly; each spec clause cites its AC + ADR section). R1 PASS pre-impl, must remain PASS post-impl (regression guard on #11 install.js contract).
