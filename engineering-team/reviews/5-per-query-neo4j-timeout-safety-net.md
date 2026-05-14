# Review: Story 5 — Per-query Neo4j timeout for `/api/get-user-data`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `fix/get-user-data-neo4j-timeout` → `staging` (PR pending)
**Diff:** `git diff origin/staging...HEAD` — three commits ahead:
- `ab38d595` story: per-query-neo4j-timeout-safety-net
- `82a4e2f2` test: failing tests for per-query-neo4j-timeout-safety-net (story #5)
- `181c6596` impl: per-query-neo4j-timeout-safety-net (story #5)

**Classification:** Bug / Standard / Implementer + Tester + Reviewer (Architecture skipped — fix is obvious per CLAUDE.md harness rules for Bug type).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Four suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - **per-query-neo4j-timeout-safety-net: 8/8 PASS** (T1–T5 driver tests + R1–R3 regression sentinels)
- [x] `node -c` syntax-check on all three modified JS files — **PASS** (`src/api/export/users/queries/userdata.js`, `test/per-query-neo4j-timeout-safety-net.test.js`, `test/test.js`).
- [ ] `npm run test:playwright` — skipped. No browser-observable change; story explicitly states no UI surface is altered.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (vs. story #5 acceptance criteria)

Every AC has a passing test or a documented manual-smoke deferral:

- [x] **AC-1** (Jack → 504 within 15s with JSON body) — T2 + T3 pin the wiring; live behavior deferred to manual staging smoke per the test plan's "Not covered" section (requires real Neo4j with Jack's graph loaded, not reproducible in local Docker stack).
- [x] **AC-2** (fast pubkey still 200 with existing shape) — R3 sentinel verifies the `apiResponse` literal still contains `success/isUserInNeo4j/metaData/data`. PASS.
- [x] **AC-3** (driver-layer timeout) — T2 confirms `session.run(cypherQuery, {}, { timeout: queryTimeoutMs })` at [userdata.js:176](src/api/export/users/queries/userdata.js#L176). The timeout fires inside the Neo4j server via transactionConfig, not via a Node-side Promise.race wrapper.
- [x] **AC-4** (session/driver close on timeout) — R1 sentinel verifies the `.finally(() => { session.close(); driver.close(); })` at [userdata.js:288](src/api/export/users/queries/userdata.js#L288) is preserved. The 504 `return` at line 276 ensures `.finally` still runs.
- [x] **AC-5** (config-driven timeout) — T1 confirms `parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000), 10)` at [userdata.js:60](src/api/export/users/queries/userdata.js#L60), matching the existing `NEO4J_URI/USER/PASSWORD` pattern.
- [x] **AC-6** (JSON 504 distinguishable from nginx 504) — T3 confirms `res.status(504).json({ success: false, message: ... })` at [userdata.js:276](src/api/export/users/queries/userdata.js#L276). Body is JSON, not HTML.
- [x] **AC-7** (structured timeout log: pubkey + observerPubkey + elapsed) — T4 confirms `console.error('Neo4j query timeout fetching user data:', { pubkey, observerPubkey, elapsedMs, limitMs, code })` at [userdata.js:275](src/api/export/users/queries/userdata.js#L275). Distinct prefix from the generic `'Error fetching user data:'` log makes it grep-able.
- [x] **AC-8** (existing 500 path unchanged) — R2 sentinel verifies the `res.status(500).json({ success: false, ... })` path at [userdata.js:282-286](src/api/export/users/queries/userdata.js#L282) is preserved. The 504 is additive.
- [x] **AC-9** (`docs/SMOKE_TEST.md` notes the Jack 504 expectation) — T5 confirms the new paragraph at [docs/SMOKE_TEST.md:48](docs/SMOKE_TEST.md#L48) co-locates "504", "jack", "get-user-data", and "story #6". Smoke runners will now treat the Jack 504 as expected.

No criterion is silently dropped. No behavior added that isn't in the story.

## ADR adherence

- [x] **No ADR required.** Architecture phase intentionally skipped per CLAUDE.md harness rules for Standard-strictness Bug classification (fix is a `transactionConfig` + a 504 branch — obvious). Story's "Linked artifacts" records the skip explicitly.
- [x] **No new dependencies.** `package.json` and `package-lock.json` untouched (`git diff --stat origin/staging...HEAD` confirms). The change uses the already-imported `neo4j-driver` module's existing `session.run(query, params, transactionConfig)` API surface — no new module imports.
- [x] **Layering respected.** Change is entirely inside the existing handler function in `src/api/export/users/queries/userdata.js`. No leak into shared `lib/`, `src/utils/`, or driver-level code.

## Concept-graph integrity

- [x] N/A. No concept definitions, schemas, or firmware JSON touched. No `kind:pubkey:slug` handles involved. No firmware reinstall needed.

## Things tests can't catch

- [x] **No secrets in committed files.** `git diff origin/staging...HEAD` contains only the pubkey hex `04c915da…ecc9` (Jack), which is a public Nostr identifier (pubkeys are public by design — that's how Nostr identifies users). Logging `pubkey` and `observerPubkey` on timeout is consistent with the existing `'Error fetching user data:', error` log, which already serializes the request context.
- [x] **No leftover debug logging or `console.log`.** Two `console.error` calls (one timeout-specific, one generic) — both structured, both intentional per AC-7 and the existing pattern.
- [x] **No commented-out code.** The three-line comment block at [userdata.js:172-174](src/api/export/users/queries/userdata.js#L172) explains *why* the deadline exists (forward-pointer to story #6 for the underlying Cypher fix) — non-obvious WHY per CLAUDE.md tone rules, not narration.
- [x] **Error paths handled where it matters.** The `isTimeout` guard at [line 273](src/api/export/users/queries/userdata.js#L273) checks `error && typeof error.code === 'string' && /TransactionTimedOut/i.test(error.code)` — null-safe, string-type-safe, and uses a permissive substring regex that handles both `TransactionTimedOutClientConfiguration` and `TransactionTimedOut` variants the Neo4j server emits across versions.
- [x] **Concurrency / race conditions considered.** Each request creates its own driver+session pair (pre-existing pattern at [line 62-67](src/api/export/users/queries/userdata.js#L62)); the Promise chain is single-flight per request. No shared mutable state introduced. The `queryStartMs` capture at [line 175](src/api/export/users/queries/userdata.js#L175) closes over a per-request const, no leakage between requests.
- [x] **Security: no new injection vectors.** The 504 body interpolates only the integers `elapsedMs` and `queryTimeoutMs` — no user input. The console.error log includes `pubkey`/`observerPubkey` but only into the structured-object second arg, not into a format string. Pre-existing Cypher injection via interpolated pubkey at [line 69](src/api/export/users/queries/userdata.js#L69) is **explicitly out of scope** per the story (deferred to story #6 alongside the hex-validation work) — confirmed untouched by this diff.

## House rules check

- [x] **Concept Graph API authority respected** (N/A — no concept code touched).
- [x] **No new lint/typecheck/build tooling.** `package.json` not modified.
- [x] **No firmware reinstall needed** (no concept definitions changed).

## Story #6 scope items verified untouched

Reviewed explicitly because the story's "Out of scope" section calls these out:

- [x] **Unbounded `OPTIONAL MATCH` fan-out** at [userdata.js:88-136](src/api/export/users/queries/userdata.js#L88) — confirmed unchanged. `grep "OPTIONAL MATCH"` returns the same 8 unmodified occurrences.
- [x] **Weak pubkey validation** at [userdata.js:31](src/api/export/users/queries/userdata.js#L31) (`nip19.npubEncode` accepts non-hex input; no `/^[0-9a-f]{64}$/i` check) — confirmed unchanged.
- [x] **Latent `query` → `cypherQuery` ReferenceError** at [userdata.js:284](src/api/export/users/queries/userdata.js#L284) inside the 500 catch body — confirmed unchanged. Will only fire on the (now-narrowed) generic-error path; still latent.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **[src/api/export/users/queries/userdata.js:60](src/api/export/users/queries/userdata.js#L60) — `parseInt` on malformed conf value yields `NaN`.** If `/etc/brainstorm.conf` ever contains a non-numeric `NEO4J_QUERY_TIMEOUT_MS=abc`, `parseInt` returns `NaN` and `session.run(query, {}, { timeout: NaN })` is passed to the driver. Per neo4j-driver-core, `transactionConfig.timeout` is validated as a non-negative integer; `NaN` will likely throw at config-validation time, which falls through to the existing 500 path with a config-error stack trace. Acceptable — the operator gets a clear 500 they can diagnose — but a defensive `Number.isFinite(queryTimeoutMs) && queryTimeoutMs > 0 ? queryTimeoutMs : 15000` would make the misconfiguration self-healing. Skip if you'd rather surface bad config loudly; mention in the next handler-touch.

2. **[src/api/export/users/queries/userdata.js:278](src/api/export/users/queries/userdata.js#L278) — 504 message hardcodes a "story #6" forward-reference.** The client sees `"see story #6 for the planned Cypher fix"` in the response body. Internal story numbers leaking into public API responses is a minor smell — when story #6 lands, the message either becomes stale or needs a coordinated edit. Consider a more durable wording (e.g. *"the query for this pubkey exceeds the time budget; the unbounded expansion is being addressed separately"*). Not a blocker — the existing wording is descriptive and the URL surface isn't externally documented.

3. **[src/api/export/users/queries/userdata.js:60, 65](src/api/export/users/queries/userdata.js#L60) — incidental trailing-whitespace cleanups.** The Implementer's edits inadvertently removed two trailing-whitespace lines from neighbors of the new config-read insertion. Per the Implementer role's "Don't refactor neighboring code" rule, this is a technical scope violation — but it's whitespace-only, 0 semantic effect, no review-time risk. Noted for awareness; not asking for a revert.

4. **`queryStartMs` is wall-clock from before `session.run` returns its first byte, not from when Neo4j actually begins the query.** The `elapsedMs` reported in the log and the 504 body therefore includes the bolt handshake / pool-acquisition time. For operator diagnostics this is fine — and arguably more accurate than the server-side timer, since it reflects what the client experienced — but if anyone reads the log expecting "time spent inside Neo4j," they'll be slightly off. Not in spec, not worth a code change.

5. **Per-request driver instantiation.** Each handler call creates a new `neo4j.driver(...)` and `driver.session()` pair, then closes both in `.finally`. This is a **pre-existing** pattern across the codebase (`profiles.js`, `nip56-profiles.js`, `proximity.js` all do the same), and Story #5 doesn't change it. Pool-sharing across requests would reduce handshake overhead — out of scope here, but worth a future cycle's consideration if the handler-touching budget allows.

## Verdict

**PASS** — diff matches story #5 acceptance criteria (every AC has a passing test or documented manual-smoke deferral), no ADR required by classification, all four test suites green (28/28), no Story #6 scope items touched, no blocking quality concerns. The five non-blocking notes are observations for the next handler-touch (likely Story #6), not change requests.

Recommend the standard deploy chain: `cycle-staging` → manual `curl` against staging for Jack to verify the 504 fires live (per the test plan's "Not covered" curl recipe at the story #5 test-plan §"Not covered") → on confirmation, `cycle-prod` to promote.
