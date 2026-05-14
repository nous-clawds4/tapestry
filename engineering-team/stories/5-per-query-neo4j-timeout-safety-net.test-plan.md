# Test Plan: Story 5 — Per-query Neo4j timeout for `/api/get-user-data`

**Story:** `engineering-team/stories/5-per-query-neo4j-timeout-safety-net.md`
**ADR:** None — Architecture phase intentionally skipped per Standard-strictness Bug classification (see story §"Linked artifacts").
**Date:** 2026-05-14

## Coverage map

Same testing style as story #4 and the recent `strfry-router-first-boot-config` Bug: failing tests are **source-regex assertions** against `src/api/export/users/queries/userdata.js` and `docs/SMOKE_TEST.md`. They pin what the spec requires (driver-layer timeout, config key name, 504 branch, structured log, docs note) without prescribing **how** the implementer wires it (Promise wrapping, an `executeRead` transaction, a Map of timeouts, etc. — all left open).

Live behavior assertions (Jack actually returns 504 within 15s) are deferred to manual staging smoke since they require real Neo4j + Jack's graph data — not reproducible in the hand-rolled Node runner without infrastructure this project doesn't have an ADR for.

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC-1 (Jack → HTTP 504 within 15s with JSON body) | covered indirectly by T2 (driver-layer timeout wired) + T3 (504 branch with success:false + message); live behavior verified by manual staging smoke (`curl -m 20 .../api/get-user-data?pubkey=04c915da…`) | n/a | manual smoke |
| AC-2 (fast pubkey still returns 200 with existing shape) | R3 `userdata.js still emits the existing 200 response shape (success/isUserInNeo4j/metaData/data)` | test/per-query-neo4j-timeout-safety-net.test.js | unit (regression sentinel) |
| AC-3 (timeout enforced at Neo4j driver layer, not just Node) | T2 `userdata.js passes a transactionConfig with a numeric timeout to session.run / executeRead / readTransaction` | test/per-query-neo4j-timeout-safety-net.test.js | unit (source regex) |
| AC-4 (session.close + driver.close run on timeout — no leak) | R1 `userdata.js still closes session and driver in the .finally cleanup path` | test/per-query-neo4j-timeout-safety-net.test.js | unit (regression sentinel) |
| AC-5 (timeout from `NEO4J_QUERY_TIMEOUT_MS` via getConfigFromFile, default 15000) | T1 `userdata.js reads NEO4J_QUERY_TIMEOUT_MS via getConfigFromFile with a numeric default of 15000` | test/per-query-neo4j-timeout-safety-net.test.js | unit (source regex) |
| AC-6 (504 distinguishable from nginx 504: JSON body with success:false) | T3 `userdata.js has a 504 response branch with JSON body {success:false} and a message that mentions "timeout"` | test/per-query-neo4j-timeout-safety-net.test.js | unit (source regex) |
| AC-7 (structured timeout log: pubkey + observerPubkey + elapsed) | T4 `userdata.js logs the timeout with elapsed-time context, distinct from the existing generic error log` | test/per-query-neo4j-timeout-safety-net.test.js | unit (source regex) |
| AC-8 (existing non-timeout 500 path unchanged) | R2 `userdata.js still has the 500 error path with success:false for non-timeout Neo4j errors` | test/per-query-neo4j-timeout-safety-net.test.js | unit (regression sentinel) |
| AC-9 (docs/SMOKE_TEST.md notes Jack 504 expectation pending Story #6) | T5 `docs/SMOKE_TEST.md notes the get-user-data 504 expectation for the high-fanout pubkey` | test/per-query-neo4j-timeout-safety-net.test.js | unit (file grep) |

## Edge cases

- [x] **`NEO4J_QUERY_TIMEOUT_MS` unset.** Story §"Open questions" resolved: default in code is 15000 ms. T1 asserts the default literal is present, so an Implementer who reads the config without a default trips the test.
- [x] **Existing generic Neo4j error path unregressed.** R2 sentinel — if the Implementer accidentally rips out the 500 path while adding the 504 branch, it flips to FAIL.
- [x] **`.finally` resource cleanup unregressed.** R1 sentinel — if the Implementer adds an `await session.run(...)` with a `try/catch` that bypasses the existing `.finally`, the sentinel flips to FAIL.
- [x] **Happy-path 200 response shape unregressed.** R3 sentinel — if the Implementer accidentally changes the top-level response keys (`success` / `isUserInNeo4j` / `metaData` / `data`), it flips to FAIL.
- [x] **Timeout log is distinct from generic Neo4j-error log.** T4 asserts `elapsed` appears in the source AND a `console.error` site mentions timeout — drives a separate log line that's grep-able for operators (per story background: "without needing Neo4j-side tracing").
- [x] **Cypher rewrite NOT in scope.** No assertion about LIMIT, `size(...)` patterns, parameterized pubkeys, or the `query` → `cypherQuery` ReferenceError at line 271 — those are explicitly Story #6 per the story's "Out of scope" section, and adding tests here would block this safety-net story on the bigger fix.

## Not covered

- **AC-1 live behavior: Jack actually returns 504 within 15s.** Requires real Neo4j with Jack's loaded graph (~hundreds of thousands of follow edges) and the deployed handler. Verified by manual staging smoke after deploy:
  ```bash
  PK=04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9
  time curl -m 20 -s -o /tmp/resp.json -w '%{http_code}\n' \
    "https://staging.brainstorm.world/api/get-user-data?pubkey=$PK"
  # Expect: 504 within ~15s, /tmp/resp.json contains {"success":false,...}
  jq '.success, .message' /tmp/resp.json   # success:false, message mentioning timeout
  ```
- **AC-2 live behavior: fast pubkey still returns 200 in normal time.** Verified by manual staging smoke alongside AC-1:
  ```bash
  PK2=0f6c85267910c0e49e60b8f4f92db600a47c7c10f711a94182989c9cae5e1313
  time curl -m 20 -s -o /tmp/resp2.json -w '%{http_code}\n' \
    "https://staging.brainstorm.world/api/get-user-data?pubkey=$PK2"
  # Expect: 200 within ~0.5s, full response shape intact
  ```
- **AC-4 no-handle-accumulation leak under repeated timeouts.** Requires running the server with a debug build and asserting bolt-connection count post-N-requests is bounded. R1 pins the `.finally` cleanup in source; runtime leak verification is deferred to the standard "let staging soak for an hour after deploy" step.
- **AC-7 log line shape match in production logs.** Verified by `docker logs tapestry | grep -i 'timeout'` against staging after a smoke-test hit on Jack post-deploy.
- **nginx upstream window confirmed at >15s.** The 15s default was chosen against an assumed nginx upstream timeout ≥20s (the curl repro's deadline). If the deployed nginx config is shorter, the safety-net 504 wouldn't fire first. Pre-implementation check: `grep -r 'proxy_read_timeout\|proxy_send_timeout' docker/ config/` to confirm. Deferred to Implementer as a one-line sanity check, not a test.

## Test infrastructure

- **Test framework:** project's existing hand-rolled Node runner (`test/test.js`). No new dependencies.
- **No Playwright spec** — the failure mode (a hung HTTP connection on the unbounded Cypher) cannot be reproduced in the local Docker stack without Jack's data loaded. No browser surface is changed.
- **Fixtures:** none. All assertions read source files via `fs.readFileSync`.
- **Files asserted against:**
  - `src/api/export/users/queries/userdata.js` — the handler being patched.
  - `docs/SMOKE_TEST.md` — the operator-facing smoke doc.

## How to run

```
npm test
```

Targeted run of just this suite:
```
node -e "require('./test/per-query-neo4j-timeout-safety-net.test.js').run()"
```

## Verification

The new tests fail on the pre-implementation tree. Confirmed against the working tree at story commit `ab38d595` (`story: per-query-neo4j-timeout-safety-net`), with the failing-tests file and `test/test.js` registration staged on top:

```
per-query-neo4j-timeout-safety-net suite:
  ✗ T1: userdata.js reads NEO4J_QUERY_TIMEOUT_MS via getConfigFromFile with a numeric default of 15000
      userdata.js must read NEO4J_QUERY_TIMEOUT_MS via getConfigFromFile with a numeric default of 15000 (AC-5). Example: `const queryTimeoutMs = parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000));`
  ✗ T2: userdata.js passes a transactionConfig with a numeric timeout to session.run / executeRead / readTransaction
      userdata.js must enforce the query timeout at the Neo4j driver layer, not just on the Node side (AC-3). Expected `session.run(cypherQuery, {}, { timeout: queryTimeoutMs })` (or equivalent executeRead/readTransaction call with `{ timeout: ... }`). Current call has no transactionConfig.
  ✗ T3: userdata.js has a 504 response branch with JSON body {success:false} and a message mentioning "timeout"
      userdata.js must return HTTP 504 with a JSON body when the Neo4j query times out (AC-1, AC-6). No `.status(504).json(` call found.
  ✗ T4: userdata.js logs the timeout with elapsed-time context, distinct from the existing generic Neo4j-error log
      userdata.js must surface elapsed-time on timeout (AC-7) — search for "elapsed" yielded nothing. Suggested: include an `elapsedMs` field in the timeout log.
  ✗ T5: docs/SMOKE_TEST.md notes the get-user-data 504 expectation for the high-fanout pubkey (Jack)
      docs/SMOKE_TEST.md must note that /api/get-user-data is expected to return 504 for the high-fanout pubkey (Jack) until story #6 lands (AC-9). No co-located "504" + Jack/get-user-data/story #6 reference found.
  ✓ R1: userdata.js still closes session and driver in the .finally cleanup path (no resource leak on timeout)
  ✓ R2: userdata.js still returns 500 with success:false for non-timeout Neo4j errors (existing error path unregressed)
  ✓ R3: userdata.js still emits the existing 200 response shape (success/isUserInNeo4j/metaData/data)

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
strfry-router-first-boot-config suite:           PASS (3 passed, 0 failed)
per-query-neo4j-timeout-safety-net suite:        FAIL (3 passed, 5 failed)
Overall:                                         FAIL
```

- 5 failing tests (T1–T5), each with a message that directly names what the Implementer needs to add: the config-key read, the driver `transactionConfig.timeout`, the 504 JSON branch, the elapsed-time log, and the docs note.
- 3 already-passing sentinels (R1–R3): the existing `.finally` cleanup, the existing 500-path body, and the existing 200-response shape. They are intentionally green; if any of them flips to FAIL during Implementation, an existing behavior was broken and the Implementer needs to back out the regressing change.
- All four other suites stay green — no collateral regression from registering the new file in `test/test.js`.
- Failures cite the spec by AC number and include the suggested fix snippet, not a typo or import error.
