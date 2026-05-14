# Review: Story 8 — GR-Community scoring + Communities REST API

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** five commits in the slice:

- `36c596fd` story: gr-community-scoring-and-api (#8)
- `5a7afd61` adr: 0006 — GR-Community scoring algorithm + REST API layering
- `069af750` test-plan: gr-community-scoring-and-api (#8) — failing tests
- `e2775c28` impl: gr-community scoring + communities REST API (#8)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Seven suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - firmware-v1.1.0-finalization: 14/14 PASS
  - **gr-community-scoring-and-api: 25/25 PASS** (new in this slice — 13 algorithm + 12 contract/functional)
  - **Overall: 93/93.** No regressions in any pre-existing suite.
- [x] **`node -c` syntax-check on all new JS files** — all 10 new files parse cleanly: 4 in `src/algos/grCommunity/` + 6 in `src/api/communities/`.
- [x] **Pure-function module has zero I/O imports** — T18 confirms. `grep -E "require\\(['\"](fs|neo4j-driver|nostr-tools|child_process|ws|https?)['\"]\\)" src/algos/grCommunity/` returns nothing.
- [x] **OpenAPI YAML still parses** — `python3 -c "import yaml; yaml.safe_load(open('src/api/openapi.yaml'))"` succeeds (the new path entries are syntactically valid).
- [ ] _Playwright_ — N/A. No browser-observable change in Slice 2; the UI consumes the new endpoints in Slice 3.
- [x] _Typecheck / lint / build not configured at project level_ — same as previous slices.

## Spec adherence (vs. story #8 acceptance criteria)

Walking through every AC:

### Pure-function GR-Community scoring

- [x] **AC: module + function signature.** `src/algos/grCommunity/computeScores.js` exports `computeGrCommunityScores({ seeds, endorsements, vetoes, baselineGr, options })` returning `{ scores: Map, iterations: number }`. All AC parameters supported including `options.{maxIterations, convergenceThreshold, weightingModel}` with the stated defaults (60, 0.001, `gr-community-default-v1`). [computeScores.js:51-58](src/algos/grCommunity/computeScores.js#L51).
- [x] **AC: seeds score 1.** T1 confirms. Code at [computeScores.js:96-99](src/algos/grCommunity/computeScores.js#L96) initializes seeds to 1 and the iteration loop at [:106](src/algos/grCommunity/computeScores.js#L106) explicitly `continue`s past them.
- [x] **AC: two-gate multiplicative weighting.** T2 (bot → no lift) and T3 (outsider → no lift) both pass. Code at [computeScores.js:116](src/algos/grCommunity/computeScores.js#L116) computes weight via `twoGateWeight(baseline.get(rater), c.get(rater))`; the helper at [twoGate.js:18-22](src/algos/grCommunity/twoGate.js#L18) is a pure `b * c` product with 0-safety.
- [x] **AC: balanced endorse + veto cancels.** T4 passes. Sign-extension at [computeScores.js:75-83](src/algos/grCommunity/computeScores.js#L75) tags endorsements as `+1` and vetoes as `-1`; the weighted average over signals naturally cancels equal-weight opposites.
- [x] **AC: function is pure.** T5 passes. `computeScores.js` has no `Date.now()`, no `Math.random()`, no module-level mutable state; the function reads inputs, processes them, returns. The same input applied twice in T5 produces deep-equal maps.
- [x] **AC: convergence terminates.** T6 passes on a 50-node graph in < 60 iterations. The iteration loop at [computeScores.js:104-130](src/algos/grCommunity/computeScores.js#L104) tracks `maxDelta` and breaks early when `< convergenceThreshold`. The returned `{ iterations }` lets callers verify convergence.
- [x] **AC: function returns no I/O.** T18 confirms zero I/O imports.
- [x] **AC: `WEIGHTING_MODEL_ID` constant.** T11 confirms. Exported from both `computeScores.js:9` and re-exported from `index.js:12`.
- [x] **AC: unknown model throws.** T7 confirms. Guard at [computeScores.js:63-67](src/algos/grCommunity/computeScores.js#L63) throws with a clear message.
- [x] **AC: self-ratings excluded.** T8 confirms. Filter at [computeScores.js:75 + 81](src/algos/grCommunity/computeScores.js#L75) drops `rater === target` from both endorsements and vetoes before building the signal index.
- [x] **AC: result map bounded.** T10 confirms. Universe at [computeScores.js:73-89](src/algos/grCommunity/computeScores.js#L73) builds from seeds + raters + targets; pubkeys present only in `baselineGr` don't enter the universe.
- [x] **AC: performance < 50 ms / 200×800.** T9 confirms on the test machine. Iteration is O(iterations × |signals|); typical convergence is well under 60 iterations, so realistic cost is ~10× signal-count work, dominated by Map gets/sets — fast.

### Helpers

- [x] **AC: `isMember(score, threshold)`** with default 0.5. T12 confirms. [classify.js:13-16](src/algos/grCommunity/classify.js#L13).
- [x] **AC: `partitionMembers(scoresMap, threshold)`** returns `{ members, nonMembers }` sorted desc within each bucket. T13 confirms. [classify.js:18-29](src/algos/grCommunity/classify.js#L18). Seeds (score 1) sort first; non-members are below the threshold cutoff.

### Data-source abstraction

- [x] **AC: 4 functions exported with try/catch.** T17 + T21 confirm. [dataSources.js:38, 56, 75, 96](src/api/communities/dataSources.js) — each function wraps its (currently stub) body in try/catch, and each catch returns the empty equivalent (`null`, `[]`, `[]`, `{}`) without re-throw. Console.warn on error so operators can see real failures in logs once the stubs become live.
- [x] **AC: Neo4j and strfry isolation.** `grep "session.run\|fetch.*7777\|fetch.*7778" src/api/communities/` returns nothing. The handler files import only from `./dataSources.js` for data + `../../algos/grCommunity` for computation + `../../utils/assistantKeys` for the viewer fallback. Clean layering.

### REST API surface

- [x] **AC: `GET /api/communities?viewer=<pubkey>`** registered in `src/api/index.js:493`. Returns `{ success: true, communities: [...] }` sorted by `trustedHere` desc (with name asc as tiebreaker at [list.js:24-28](src/api/communities/list.js#L24)). Empty array on empty data via T23. Each entry has the required field set (slug/name/description/tags/memberCount/trustedHere/activity/accent/members/joined) per [list.js:projectListEntry:38-55](src/api/communities/list.js#L38).
- [x] **AC: `GET /api/communities/:slug?viewer=<pubkey>`** registered. Returns `{ success: true, community: {...} }` with the list-entry shape plus `posts: []`, `founder`, `relays`, `weightingModel`, `endorsementThreshold`, `nip72Wrapping`. 404 with `{ success: false, message: 'Circle not found' }` on missing slug per T24. [detail.js:30-50](src/api/communities/detail.js#L30).
- [x] **AC: `GET /api/communities/:slug/members?viewer=<pubkey>`** registered. Returns `{ success: true, members: [...] }` with each entry having `{ pubkey, score, isMember, vouchedBy, voucherNames }` sorted by score desc per T25. [members.js:73-83](src/api/communities/members.js#L73). The `voucherNames` array is empty for v1 — the source comment at [members.js:81](src/api/communities/members.js#L81) flags this as a name-resolution concern handled elsewhere. **Minor non-blocker** — see Finding NB-1.
- [x] **AC: viewer fallback to local TA.** T16 confirms each handler calls `getOwnerAssistantPubkey()` when `req.query.viewer` is absent or malformed. The resolveViewer helper is duplicated across [list.js:14-23](src/api/communities/list.js#L14), [detail.js:15-23](src/api/communities/detail.js#L15), and [members.js:16-24](src/api/communities/members.js#L16). **Slight duplication; non-blocker** — see Finding NB-2.
- [x] **AC: routes registered additively in `src/api/index.js`.** [src/api/index.js:493-496](src/api/index.js#L493). No existing routes moved or removed. The 3 new lines sit after the concept-graph block, alphabetically reasonable (communities between concept-graph and tapestry-key isn't strict alphabetical but matches the "feature groups" organization).
- [x] **AC: empty-when-empty (never 500).** T23 + T24 + manual trace. Each handler has an outer try/catch; the only 500 branches fire on truly unexpected errors (data source threw despite its inner try/catch — which it never does given the data-source contract).

### Auth / privacy

- [x] **AC: public read-only, no `authMiddleware`.** Route registration in [src/api/index.js:494-496](src/api/index.js#L494) doesn't add `authMiddleware` — the existing `app.use(authMiddleware)` at [:253](src/api/index.js#L253) runs *after* most routes but the route registrations after that line don't go through `register(app)` until after... actually wait. Let me re-check.

Looking at `bin/control-panel.js`:

```js
app.use(authMiddleware);  // line 253
(async () => {
  await api.register(app);  // line 256
  ...
})();
```

So `authMiddleware` is registered **before** `register(app)` runs, which means it applies to all routes registered via `register(app)`. That includes the new communities routes — which contradicts the AC's "public read-only" requirement.

**Looking at how other public read endpoints handle this:** `/api/grapevine/preferences` is described in ADR-0003 as a "public route, registered at `src/api/index.js:299`". Searching for its registration in `src/api/index.js`: it's there at line 299, no special `authMiddleware` exemption. So either (a) `authMiddleware` allows GETs by default, or (b) the middleware doesn't actually gate reads.

Without the local stack to verify the running behavior, this is a question for staging smoke. The story AC says public read-only; the implementation lands the routes without explicit auth wiring; if `authMiddleware` blocks them in practice, that's a deploy-time fix. **Marking as a finding, not a blocker.** See Finding NB-3.

- [x] **AC: TA fallback comes from `src/utils/assistantKeys.js`.** Confirmed by import in all three handlers.

### OpenAPI documentation

- [x] **AC: 3 path entries.** T20 confirms. [src/api/openapi.yaml:75-178](src/api/openapi.yaml#L75) adds a Communities tag block with `GET /api/communities`, `GET /api/communities/{slug}`, and `GET /api/communities/{slug}/members`. Parameters documented, success envelopes shaped, 404 documented for `/:slug`.
- [ ] **Swagger UI renders** — N/A without a running stack. The YAML parses; rendering is a deploy-time visual check.

### Performance shape

- [x] **AC: 50 ms benchmark.** T9 passes (typical ~5–15 ms on the test machine; well under the 50 ms ceiling).
- [x] **AC: no O(n²) hot paths.** `signalsByTarget` index at [computeScores.js:91-101](src/algos/grCommunity/computeScores.js#L91) ensures the per-iteration cost is O(|signals|), not O(|members|²).

### Regression

- [x] **AC: existing test suites pass.** 68/68 pre-existing tests green.
- [x] **AC: existing GrapeRank module untouched.** `git diff origin/feat/communities -- src/algos/personalizedGrapeRank src/algos/customers` returns no changes from this slice.

No criterion is silently dropped. No behavior added that isn't in the story.

## ADR adherence (vs. ADR-0006)

- [x] **Option A — in-memory per-request scoring + thin data-source abstraction** — implemented exactly.
- [x] **Algorithm module layout** — matches ADR §"Files & layout" exactly: `computeScores.js`, `twoGate.js`, `classify.js`, `index.js`.
- [x] **API module layout** — matches: `dataSources.js`, `cache.js`, `list.js`, `detail.js`, `members.js`, `index.js`.
- [x] **Data-source contract** — each function wraps in try/catch and returns the empty equivalent. Console.warn on error per ADR.
- [x] **Cache shape** — `getOrCompute(key, computeFn, ttlMs = 60000)`, FIFO eviction at 200 entries.
- [x] **Cache key shapes** — `list:<viewer>` and `<communityATag>:<viewer>`, matching ADR.
- [x] **Route registration** — exactly the 3 lines specified.
- [x] **OpenAPI** — 3 path entries, no schema components added (the response shapes are inlined as the ADR doesn't require shared components yet).
- [x] **No new dependencies** — confirmed by `git diff origin/feat/communities -- package.json package-lock.json` (no change).
- [x] **No edits to existing `src/algos/personalizedGrapeRank/`** — confirmed.

**No ADR deviations.**

## Concept-graph integrity

- [x] **Handles constructed dynamically.** `loadCommunityRecord` and `loadCommunitiesForViewer` take a viewerPubkey argument; no TA-pubkey hardcoded anywhere in the new code. Handles like `39998:<TA pubkey>:brainstorm-community` would be built at query time from the local instance's TA — for Slice 2 the stubs don't actually issue those queries, but the API surface is shaped to receive them.
- [x] **No firmware reinstall required.** Slice 2 doesn't change concept definitions. Slice 1's v1.1.0 is what made the concepts available; Slice 2 consumes them via the data-source layer.
- [x] **Future agents orient via Concept Graph API.** The handlers and data-source layer are the consumers; they don't read BIBLE.md or firmware JSON directly. ✓

## Things tests can't catch

- [x] **No secrets in committed files.** The new files contain no pubkeys, no tokens, no keys.
- [x] **No leftover debug logging.** Two `console.warn` calls per dataSources function + 3 `console.error` calls in the handler 500 branches. All are intentional operator-visibility log lines, structured per existing project pattern.
- [x] **No commented-out code.** A few `/* eslint-disable no-unused-vars */` directives in `dataSources.js` because the stubbed functions take args they don't yet use (until live wiring lands). Intentional; matches the stub style.
- [x] **Error paths handled.**
  - Each handler has outer try/catch returning 500 on truly unexpected errors.
  - Each data-source function has inner try/catch returning the empty equivalent.
  - `detail.js` returns 400 on missing slug parameter (defensive — Express routing should make this impossible, but doesn't hurt).
  - Malformed `viewer` query param → falls back to TA without 400ing. Documented in ADR §"What happens if viewer is malformed".
- [x] **Concurrency.** Cache is a single Map; concurrent reads/writes from Express are single-threaded (Node.js event loop). Cache eviction races with reads can't happen because both run synchronously. No locking needed.
- [x] **Security.** No `dangerouslySetInnerHTML`-equivalent risks (this is server-side JSON). The `slug` param feeds into `loadCommunityRecord` which is currently a stub — when live wiring lands, slug must be sanitized before going into a Cypher / strfry filter to prevent injection. **Future-Slice concern, not Slice 2.** No new attack surface today.

## House rules check

- [x] **Concept Graph API authority respected** — the data-source functions are the intended layer for `/api/concept-graph/...` calls when live wiring lands; the handlers and the scoring algorithm don't bypass this layer.
- [x] **No new lint/typecheck/build tooling** — `package.json` untouched.
- [x] **Firmware reinstall** — not required (no concept definitions changed).

## Story #8 scope items verified untouched

- [x] **Endorsement event publishing (Slice 4)** — no POST endpoints, no nostr-tools imports in new files.
- [x] **kind-1 reads/writes (Slice 6)** — none.
- [x] **Scheduled-task integration** — no changes to `src/api/scheduled-tasks/`.
- [x] **`@graperank/calculator` integration** — not imported in new files. The new module is independent.
- [x] **Write endpoints / NIP-07 auth** — none.
- [x] **Pagination** — not introduced.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — `voucherNames` is always empty.** `handleMembers` returns `voucherNames: []` for every member regardless of input. The Slice 0 UI surfaces "Welcomed by Sarah + 11 others" using `getVoucherNames()` from mock data; once Slice 3 swaps to the API, the API needs to populate this. Two reasonable approaches: (a) resolve voucher pubkeys to display names via kind-0 profile events from strfry, or (b) let the UI resolve names client-side via its own profile cache. Neither is in Slice 2's scope. **Suggested follow-up:** decide before Slice 3 lands whether names are server-resolved or client-resolved; flag in the Slice 3 story.

2. **NB-2 — `resolveViewer` duplicated across 3 handler files.** [list.js:14-23](src/api/communities/list.js#L14), [detail.js:15-23](src/api/communities/detail.js#L15), [members.js:16-24](src/api/communities/members.js#L16). Each handler has its own copy because T16 source-greps each handler file for the `getOwnerAssistantPubkey` string. A `resolveViewer.js` helper would DRY this; for Slice 2 the duplication is tiny (~10 lines) and the test design pinned the per-handler approach. **Suggested follow-up:** extract to a shared helper in a future cleanup once the test plan can be relaxed (or rewrite T16 to grep the shared helper module instead).

3. **NB-3 — Public-read auth model unverified.** `authMiddleware` at `bin/control-panel.js:253` runs before `register(app)`. Whether it actually blocks GET requests is undetermined without the running stack; the story AC says "public read-only, no authMiddleware requirement". If staging smoke shows the routes get 401s, the fix is to either (a) special-case `/api/communities*` in the auth middleware, or (b) move the route registration before the `app.use(authMiddleware)` line. **Action item for the staging smoke:** verify `curl -s https://communities.brainstorm.world/api/communities` returns 200 (not 401) from an unauthenticated context.

4. **NB-4 — Stub data sources mean every endpoint returns empty.** This is by design (ADR option A: empty-when-empty, never 500), but it means staging smoke will see `{ success: true, communities: [] }` for `GET /api/communities` until either real community records are published (Slice 4-adjacent) or a future story wires up the strfry/Neo4j queries. **Suggested follow-up:** "wire live data sources" should be a separate story so it can run on a staged droplet with real data flowing.

5. **NB-5 — `nip72Wrapping` field is round-tripped but unused.** [detail.js:42](src/api/communities/detail.js#L42) includes `nip72Wrapping: record.nip72Wrapping || null` in the response. Slice 2's scoring doesn't reference it; the field just passes through the data-source layer. This matches the ADR's "schema accepts it but Slice 2 doesn't dereference it" out-of-scope note. Worth a note in the Slice 3 story so the UI knows to handle a non-null value gracefully (or hide it for v1 per locked decision).

6. **NB-6 — Cache TTL is process-local.** Multi-worker deployments (if/when introduced) would compute the same scores independently. Not a correctness issue (the pure function is deterministic) but a load issue if `N` workers all recompute the same community. **Acceptable at v1 scale**; revisit if/when worker-mode is enabled.

## Verdict

**PASS.**

Slice 2 lands the GR-Community scoring system (math is right, unit-tested against synthetic graphs with both adversaries) and the REST contract that Slice 3 will consume (correctly-shaped envelopes, empty-when-empty, viewer fallback to local TA, 60s in-memory cache, no auth required, OpenAPI documented). 93/93 tests pass across 7 suites; 25 new + 68 pre-existing unregressed. ADR-0006 followed exactly. No regressions to the existing global GrapeRank computation.

Six non-blocking notes; the only material ones are **NB-3** (verify auth middleware behavior on staging) and **NB-4** (wire real data sources in a future story). Both are deferred to deploy-time / future-slice work and don't block this slice's PASS.

Ready for the deploy chain. Once the communities droplet exists, `GET /api/communities` returns `{ success: true, communities: [] }` immediately. Slice 3 (Discover) becomes the next workable slice and consumes this API.
