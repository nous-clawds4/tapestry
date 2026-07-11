# Review: Story open-ranking #2 — ORE-05 /search/pubkeys (global only)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-19
**Diff:** `git diff 9fea1025..HEAD -- src test` (story commits `6cda4a2c` ADR → `0212a8d3` tests → `bf83c1d7` impl → this review's hardening)
**Method:** three independent adversarial reviewers (spec/ADR/ORE-05 conformance, security+correctness of the outbound fetch, reuse/regression), findings verified.

## Quality gates (run by reviewer, not trusted)

- [x] `open-ranking-search` suite — **18 passed, 0 failed** (re-run by reviewer, incl. the new B13 guard test).
- [x] `open-ranking-stats` suite — **20 passed, 0 failed** (no regression from the capability-doc / ORE_PATHS additions).
- [~] `npm test` (full aggregator) — not host-runnable (Docker-stack suites); real `nostr-search-api` ranking verified at staging smoke.
- [x] _Lint / typecheck / build — not configured._

## Spec adherence
- [x] Every AC has a passing test (S1–S2, C1–C2, B1–B13, E1).
- [x] Capability doc advertises `/search/pubkeys → [grapevine (pov:false)]` and keeps `/stats/pubkey` (2 algos). No personalized search algo in v1 (deferred Story 3).
- [x] `query` (non-empty, ≤512), `limit` (positive int, ≤200), unsupported `algorithm` → 422; malformed JSON → 400; `pov`-on-global ignored; CORS + `X-Reason` everywhere.
- [x] `rank = round(wot_rank_<ownerSuffix>)`, floor 0; `ttl` 300.

## ADR adherence
- [x] Matches ADR 0002: calls `nostr-search-api` directly with `sort=wot_rank_<ownerSuffix>:desc`; owner suffix via the runtime `getOwnerAssistantPubkey()` (never hardcoded); reuses the Story-1 helpers + the `buildSearch(input, deps)` seam.
- [x] **Result ordering** relies on the backend's `sort` param (the search-api re-sorts by the sort field). Acceptable per ADR; **confirm rank-desc at staging smoke** (the one behavior the hermetic tests can't prove).

## Concept-graph integrity
- [x] No concepts touched; no firmware reinstall.

## Things tests can't catch
- [x] Query is safely URL-encoded (`searchParams.set`) — no injection into the search-api; `NOSTR_SEARCH_URL` is deployment config, not user input (no SSRF).
- [x] **No enumeration oracle** — global-only (`pov:false`); no per-caller differentiation. (This is why Story 2, unlike Story-1 personalized stats, has no W12 pre-prod gate.)
- [x] Search-api failure is anonymized to `500 "internal error"` (no internals leaked).
- [x] No secrets / debug leftovers / commented-out code (only the 500-path `console.error`). Clean module load.

## House rules check
- [x] Per-deployment TA pubkey resolved at runtime (`getOwnerAssistantPubkey`), never hardcoded.
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking — addressed in this review commit
1. **Null-pubkey guard — `src/api/open-ranking/search.js` `buildSearch`.** `mapHitToResult` returned `{pubkey: undefined}` for a hit lacking both `pubkey` and `id`, which `res.json` would drop → an ORE-05 result with no `pubkey`. Not reachable in practice (Meili docs always have an `id`), but a contract violation if the backend ever misbehaves. **Fixed:** `buildSearch` now `.filter((r) => r.pubkey)` after mapping; locked by new test **B13**.

### Non-blocking — addressed in this review commit
2. **Outbound fetch had no timeout** — a hung `nostr-search-api` could pin a worker (thread-pool saturation on a public endpoint). Matches the existing Meili proxy, but worth bounding here. **Fixed:** `searchProfiles` now uses `AbortSignal.timeout(5000)`; a timeout rejects → caught → `500 "internal error"`.

### Non-blocking — noted, not changed
3. **Result ordering** is delegated to the backend `sort` param rather than re-sorted in `buildSearch`. Correct given the search-api's behavior; verified at staging smoke (Tier 3). If a future backend change breaks desc ordering, add a stable in-builder sort.

## Verdict
**PASS.** The diff matches the story, ADR 0002, and the test plan; both ORE suites are green (38 total); ORE-00/01/05 conformance is met. The one blocking finding (null-pubkey guard) and the fetch-timeout hardening were applied and re-verified in this commit. Unlike Story 1's personalized stats, this global-only endpoint carries **no enumeration-oracle pre-prod gate**.
