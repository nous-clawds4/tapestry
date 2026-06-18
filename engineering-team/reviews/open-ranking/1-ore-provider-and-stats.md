# Review: Story open-ranking #1 — ORE provider surface + ORE-02 /stats/pubkey

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git diff 0d7f9173..HEAD -- src test` (story commits `b433a8de` → `f9e4379a` + review cleanup)
**Method:** four independent adversarial reviewers (spec/ADR, security/POV-invariant, ORE-protocol conformance, reuse/correctness) over the actual files, findings verified.

## Quality gates (run by reviewer, not trusted)

- [x] `open-ranking-stats` suite (`node test/open-ranking-stats.test.js`) — **20 passed, 0 failed** (re-run by reviewer).
- [~] `npm test` (full aggregator) — **not runnable on the host**: the other suites require the live Docker stack (Neo4j/Redis); the project verifies those in Docker via `/cycle-staging`. The ORE suite is hermetic (injected deps) and green; syntax-checked the aggregator wiring. Real Neo4j paths + OPTIONS preflight are verified at staging smoke.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test (S1–S2, C1–C3, B1–B12, V1, E1–E2).
- [x] No criterion silently dropped. AC-2 (`OPTIONS` preflight) is satisfied as a 2xx via the platform's global `cors()` and verified at staging, per the ADR CORS decision + story deviation (confirmed at the Test-Design gate).
- [x] No behavior added beyond the story. Additive, read-only; routes off the `/api/` prefix.

## ADR adherence
- [x] Files match ADR 0001 implementation notes (module layout, registry, field mapping, POV semantics).
- [x] Layering respected: pure builders (`buildStats`, `buildCapabilityResponse`) + thin Express wrappers; the testability seam (injected `deps`) is honored.
- [x] No unauthorized new dependencies — reuses `src/lib/neo4j-driver` (`runCypher`) and the extracted `fetchProfileScores`.
- [x] Global `grapevine` reads the owner baseline; `grapevine-personalized` uses `pov` as `observer_pubkey` and **422s an unprovisioned pov before any fetch** (no house fallback). `reports`/`first_seen_at` omitted; `rank = round(influence×100)`; `ttl = 3600`.

## Concept-graph integrity
- [x] No concepts touched; no concept handles introduced.
- [x] No firmware reinstall required (no concept/schema definitions changed).
- [x] No BIBLE re-derivation in code.

## Things tests can't catch
- [x] No secrets committed (only the public `BRAINSTORM_OWNER_PUBKEY` is read).
- [x] No leftover debug logging beyond a sanitized `console.error` on the 500 path (error not leaked to the client).
- [x] No commented-out code.
- [x] Error paths handled (400 malformed JSON, 422 validation, 500 guarded).
- [x] Cypher injection: the ORE path validates `pubkey`/`pov` as 64-hex lowercase **before** they reach the (string-interpolated) `get-profile-scores` query; `isPovProvisioned` is parameterized. Safe as built.
- [~] **Security — provisioning-enumeration oracle (see Findings → Non-blocking #1).**

## House rules check
- [x] Concept Graph API authority respected (N/A — no concepts).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey: N/A — no signing, no TA-author filtering in this surface.

## Findings

### Blocking
_None._

### Non-blocking
1. **Provisioning-enumeration oracle — `src/api/open-ranking/stats.js` (the `grapevine-personalized` path).** An unauthenticated caller can distinguish provisioned (`200`) from unprovisioned (`422 pov not provisioned`) POVs, enumerating the instance's customer set. This is the exact concern W12 deferred a separate availability probe over — the shipped personalized endpoint *is* that probe. **Acceptable for staging** (the book's target; test data), **but a hard gate before any prod promotion**: gate the `pov:true` path behind ORE-A/NWT auth or a self-only check first. Recorded in [protocols/worksheet.md](../../../protocols/worksheet.md) W12 (review finding) and the book's out-of-scope. **Surface to the operator before `/cycle-prod`.**
2. **Defense-in-depth: parameterize the `get-profile-scores` Cypher.** `queryProfileScores` still string-interpolates `pubkey`/`observerPubkey`. Currently safe (hex-validated upstream on the ORE path; pre-existing on the legacy `/api/get-profile-scores` path), but parameterized `runCypher` would be more robust and maintainable. Out of this story's scope (the ADR authorized extraction-for-reuse, not a query rewrite); worth a follow-up.
3. **NIT — redundant lazy `require` in `handleStatsPubkey` — FIXED in this review commit** (hoisted `applyTriple` to the top-level import).

## Verdict
**PASS** (for the staging target). The diff matches the story, ADR, and test plan; the ORE suite is green; ORE-00/01/02 wire conformance is met (only the documented 2xx-preflight cosmetic gap). The one security finding (enumeration oracle) is a consequence of the approved `pov:true`+`422` design, acceptable on staging and explicitly tracked as a **pre-prod gate** in W12 — it must be resolved before promoting this endpoint to `brainstorm.world`.
