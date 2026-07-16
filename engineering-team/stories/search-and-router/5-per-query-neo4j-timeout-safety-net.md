# Story 5: Per-query Neo4j timeout for `/api/get-user-data`

**Status:** Done (backfilled 2026-07-02 — PASS review on record; see docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md Appendix A)
**Created:** 2026-05-13
**Type:** Bug

## Background

During the cycle-staging smoke test for PR #127 (story #4), the canonical "known-active" pubkey from `docs/SMOKE_TEST.md:46` — Jack (`04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9`) — was found to hang `/api/get-user-data` on both staging and production. Reproduction (May 2026): the request times out at the curl deadline of 20s with zero bytes returned, while the neighboring `/api/get-user-counts?pubkey=$PK` (strfry-backed, not Neo4j) returns 200 in normal time, and the same `/api/get-user-data` endpoint returns 200 in ~400ms for less-connected pubkeys. The hang is specific to the (endpoint, high-fanout-pubkey) combination.

Root cause for the *hang* (separate from the *slow query*): the handler at `src/api/export/users/queries/userdata.js:172` calls `session.run(cypherQuery)` with no transaction config. Neo4j has no server-side deadline, so a runaway query keeps consuming graph resources and the bolt session never returns; the nginx upstream eventually drops the client, but the Node process still has an open session and an open driver until the underlying connection dies. There is no structured error path for "this query is too slow."

The underlying query also has unbounded fan-out — that is the *cause* of the slowness for Jack — but fixing the query is Story #6. **This story scopes only to the safety net**: ensure the endpoint fails fast with a structured response and releases its resources, so that (a) the same pubkey returning slow doesn't black-hole a connection, (b) future high-fanout pubkeys are bounded even if the query itself drifts back into unboundedness, and (c) the smoke test gets a clear failure signal (504 + JSON body) instead of a 20s hang.

Lands the failsafe independently of the query fix, so even if Story #6 slips a cycle, the production endpoint stops hanging.

## User-facing description

**As an operator of a Brainstorm instance**, I want `/api/get-user-data` to return a structured error within a bounded time when its Neo4j query is too slow, **so that** a slow or high-fanout pubkey can never hang the endpoint long enough for the upstream nginx to drop the client, and so that the failure shows up in logs and clients as a real status code instead of a black-holed connection.

## Acceptance criteria

- [ ] Given Jack's pubkey (`04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9`), when `/api/get-user-data?pubkey=<jack>` is called, the response returns within the configured timeout window (default ≤ 15s) with **HTTP 504** and a JSON body matching `{ success: false, message: <string mentioning timeout> }`. No more zero-byte hangs.
- [ ] Given a fast pubkey (e.g. `0f6c85267910c0e49e60b8f4f92db600a47c7c10f711a94182989c9cae5e1313` from the existing repro), when `/api/get-user-data?pubkey=<fast>` is called, the response is HTTP 200 with the existing response shape unchanged — same top-level keys (`success`, `isUserInNeo4j`, `metaData`, `data`), same nested fields. No regression on the happy path.
- [ ] The timeout is enforced at the Neo4j layer via the driver's `transactionConfig.timeout` (or equivalent), not only at the Node/Express layer, so the Neo4j-side query is actually cancelled and stops consuming graph resources when the deadline fires.
- [ ] On timeout, both `session.close()` and `driver.close()` still run (the existing `.finally` path must not leak when the rejection comes from the timeout rather than from a query error). Verified by an assertion that no driver/session handles accumulate after N consecutive timed-out requests in the test suite.
- [ ] The timeout value is read from configuration (via `getConfigFromFile`, matching the existing pattern for `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD`), with a sensible default if the config is absent. Operators can tune it without a code change.
- [ ] The 504 response is distinguishable from an nginx-emitted 504: the response **has a JSON body with `success: false`**, whereas an upstream nginx 504 typically returns an HTML error page. This lets the smoke test and any clients tell a handled timeout from an unhandled one.
- [ ] On timeout, a structured `console.error` (matching the format of the existing `'Error fetching user data:'` log) is emitted with the pubkey, observerPubkey, and elapsed-time fields, so operators can grep logs for slow pubkeys without needing Neo4j-side tracing.
- [ ] The existing error path for non-timeout Neo4j errors (`.catch` at `userdata.js:267`) continues to return HTTP 500 with the existing shape — the new timeout path is additive, not a replacement.
- [ ] `docs/SMOKE_TEST.md:46` is updated with a one-sentence note that the canonical "known-active" pubkey (Jack) currently exercises the high-fanout path and is expected to return a 504 from `/api/get-user-data` until Story #6 lands. A smoke-test run that gets a 504 with `success: false` from this endpoint for Jack should be treated as **expected** (not a regression), while a hang or a 502 should be flagged.

## Concepts touched

To be resolved by the Implementer via `/api/concept-graph/summaries` if uncertain:

- NostrUser (the Neo4j node type the timed-out query traverses)
- Get-user-data endpoint
- Owner / Owner PoV (the default `observerPubkey` fallback at `userdata.js:38`)
- NostrUserWotMetricsCard (the alternate source when `observerPubkey` is set)

## Out of scope

- **The actual Cypher rewrite to bound the fan-out.** That is Story #6. This story explicitly accepts that Jack will keep timing out at 504 until #6 lands; the goal here is *bounded failure*, not *successful response*.
- **Cypher injection / pubkey hex validation at `userdata.js:69`.** Same handler, but tightly coupled to the query rewrite — lands with Story #6.
- **Fixing the latent `query` → `cypherQuery` ReferenceError in the `.catch` at `userdata.js:271`.** Same reasoning: bundle with #6.
- **Applying the same timeout pattern to other Neo4j-backed handlers** (`profiles.js`, `nip56-profiles.js`, `proximity.js`, etc.). If the Implementer extracts a shared helper while doing this story, fine, but the *application* of the helper to other endpoints is a separate decision per endpoint and out of scope here.
- **Changes to nginx upstream timeout configuration.** This story makes the application-layer deadline come first; nginx config is a separate concern.
- **Per-pubkey query result caching.** Tempting for Jack specifically, but invalidation is non-trivial and belongs in a later story if at all.
- **A UI surfacing of the 504.** Clients that consume this endpoint will start seeing 504s — surfacing them in any front-end views is a separate story per consumer.

## Open questions

Resolved with operator at approval time:

- **Default timeout value:** **15s** (15000 ms). Well under the 20s curl deadline observed in the repro and below typical nginx upstream timeouts, so the application-layer 504 is the first deadline to fire.
- **Config key name:** **`NEO4J_QUERY_TIMEOUT_MS`**, read via `getConfigFromFile` matching the existing pattern for `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD`, defaulting to 15000 in code if absent.
- **Shared helper vs. inline:** **Inline in `userdata.js`** for this story. Story #6 revisits the same handler and is the natural point to factor a shared helper if one is needed elsewhere.

## Linked artifacts

- ADR: skipped (Bug, fix is obvious — per CLAUDE.md harness rules for Standard strictness on Bug type)
- Test plan: `engineering-team/stories/5-per-query-neo4j-timeout-safety-net.test-plan.md`
- Review: `engineering-team/reviews/5-per-query-neo4j-timeout-safety-net.md` (PASS, 5 non-blocking notes)
