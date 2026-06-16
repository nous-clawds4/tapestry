# Test Plan: Story 7 — Offline search-quality evaluation harness

**Story:** `engineering-team/stories/7-search-quality-eval-harness.md`
**ADR:** `engineering-team/decisions/0004-search-quality-eval-harness.md`
**Date:** 2026-05-17

## Coverage map

Every acceptance criterion maps to at least one automated test in
`test/7-search-quality-eval-harness.test.js`. Pure scorer/schema/gate logic gets
real behavioral assertions (the ADR-0004 hermetic design makes this possible);
the live end-to-end run is intentionally not automated in the hand-rolled runner
— see "Not covered".

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC-1 (score + per-query breakdown) | `score.js exposes pure recallAtK, mrr, and aggregate functions` | test/7-search-quality-eval-harness.test.js | unit (pure) |
| AC-1 (metric correctness) | `recallAtK returns the fraction of judged-relevant items found within the top k` | test/7-…test.js | unit (pure) |
| AC-1 (metric correctness) | `mrr is the reciprocal rank of the first judged-relevant hit, 0 when none are relevant` | test/7-…test.js | unit (pure) |
| AC-1 (overall + breakdown) | `aggregate returns an overall score and a per-query breakdown carrying each query id` | test/7-…test.js | unit (pure) |
| AC-1 (corpus reference) | `aggregate records the corpus/index reference it ran against` | test/7-…test.js | unit (pure) |
| AC-2 (gate FAIL + regressed list) | `the gate fails below baseline-minus-tolerance and names exactly the regressed queries` | test/7-…test.js | unit (pure) |
| AC-2 (gate PASS + boundary) | `the gate passes when the score is at or within tolerance of baseline` | test/7-…test.js | unit (pure) |
| AC-3 (schema + required fields) | `validateGoldEntry accepts a minimal entry and rejects ones missing query/observer/judgments` | test/7-…test.js | unit (pure) |
| AC-3 (layered-ready accepted) | `validateGoldEntry accepts a layered-ready entry — tag/dlist fields are never a rejection reason` | test/7-…test.js | unit (pure) |
| AC-3 (layered ignored in v1) | `v1 scoring ignores the layered block — score is identical with or without it` | test/7-…test.js | unit (pure) |
| AC-4 (auditable report) | `the per-query report exposes query, observer, returned results, and judged hit/miss` | test/7-…test.js | unit (pure) |
| AC-5 (≥30 hand-judged, valid) | `at least 30 hand-judged gold queries are committed and every one is schema-valid` | test/7-…test.js | unit (file/JSON) |
| ADR constraint (runner seam + baseline) | `runner.js guards main with require.main===module and baseline.json declares metric/baseline/tolerance` | test/7-…test.js | unit (file/grep) |
| ADR constraint (CI workflow) | `a PR CI workflow runs the eval runner against a pinned Meilisearch v1.12.8 service` | test/7-…test.js | unit (file/grep) |

## Edge cases

- [x] **Empty result list** → recall 0 (not NaN). Asserted in the recall@k test.
- [x] **No judged-relevant items** → recall 0, MRR 0 (not NaN/undefined).
- [x] **First-relevant-at-rank-k** → MRR = 1/k exactly.
- [x] **Each required field missing** (query / observer / judgments) → invalid,
      tested independently (not a single happy-path schema test).
- [x] **`layered` block present** → entry still valid (AC-3 anti-rejection) AND
      v1 score provably unchanged vs. the same entry without it.
- [x] **Gate boundary is inclusive** → overall exactly `baseline - tolerance`
      must PASS, not FAIL.
- [x] **Gold directory absent** → a clear AC-5 failure message, not a crash.

## Not covered

Mirrors the story-#4 convention: things requiring live infrastructure or
process-level effects are verified by running the harness / CI, not by the
hand-rolled `npm test`.

- **Live end-to-end eval run** — replaying gold queries through
  `/api/search/profiles/meili` against an ephemeral Meilisearch loaded with the
  pinned fixture corpus. Requires the full local stack (control-panel +
  nostr-search-api + Meilisearch). Verified by `node nostr-search/eval/runner.js`
  locally and by the `.github/workflows/search-eval.yml` CI job.
- **Actual `process.exit(0|1)` wiring** — exercised by the harness run / CI; the
  pass/fail *decision* is unit-tested via the pure `evaluateGate`.
- **Production-distribution recall** — out of scope per ADR 0004 (v1 measures
  ranking on a controlled fixture corpus, explicitly not prod data).
- **CI check being *non-required* vs required** — a workflow/branch-protection
  property; verified by review and governed by the separate harness-contract
  ADR, not asserted mechanically here.

## Test infrastructure

- **Test framework:** the project's existing hand-rolled Node runner
  (`npm test` → `node test/test.js`). New suite
  `test/7-search-quality-eval-harness.test.js`, `require()`d and folded into the
  results block + `overallOk` in `test/test.js`. No new test framework
  (Tester house rule).
- **No new dependencies.** Tests use only `fs`, `path`, and guarded `require()`
  (implementation modules are required *inside* tests so a missing file is a
  clean assertion failure, not a runner crash).
- **Module export requirement (for unit testability).** Same precedent as story
  #4's `parseArgs` / `require.main===module` seam — observability seams that pin
  spec-level ACs hermetically without prescribing internal implementation:
  - `nostr-search/eval/score.js` exports pure `recallAtK`, `mrr`, `aggregate`,
    and **`evaluateGate(overall, {baseline,tolerance}, perQuery)`**.
  - `nostr-search/eval/schema.js` exports `validateGoldEntry(entry)` and
    **`scoringInputs(entry)`** (→ `{query, observer, judged}`, omitting
    `layered`, which is what makes "v1 ignores layered" provable — AC-3).
  - `nostr-search/eval/runner.js` guards its entrypoint with
    `if (require.main === module)`.
  `evaluateGate` and `scoringInputs` are the only names not literally in ADR
  0004's impl notes; each exists solely to make a spec-pinned AC (AC-2 / AC-3)
  testable without the live stack. Kick back to the Architect if either seam is
  objectionable.
- **Prerequisite for the (not-covered-here) full run:** control-panel +
  nostr-search-api + an ephemeral Meilisearch **v1.12.8**.

## How to run

```
npm test
```

## Verification

The new suite fails on the pre-implementation tree, every failure for the right
reason (missing implementation modules / absent gold set / absent workflow —
clean assertion messages, no typo or import errors). The four pre-existing
suites are unregressed. Confirmed at commit `44869016`
(`adr: search-quality-eval-harness`):

```
search-quality-eval-harness suite:
  ✗ score.js exposes pure recallAtK, mrr, and aggregate functions
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/nostr-search/eval/score.js'
  ✗ recallAtK returns the fraction of judged-relevant items found within the top k
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ mrr is the reciprocal rank of the first judged-relevant hit, 0 when none are relevant
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ aggregate returns an overall score and a per-query breakdown carrying each query id
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ aggregate records the corpus/index reference it ran against
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ the per-query report exposes query, observer, returned results, and judged hit/miss
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ the gate fails below baseline-minus-tolerance and names exactly the regressed queries
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ the gate passes when the score is at or within tolerance of baseline
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ validateGoldEntry accepts a minimal entry and rejects ones missing query/observer/judgments
      nostr-search/eval/schema.js must exist and be require()-able — Cannot find module '…/schema.js'
  ✗ validateGoldEntry accepts a layered-ready entry — tag/dlist fields are never a rejection reason (AC-3)
      nostr-search/eval/schema.js must exist and be require()-able — Cannot find module '…/schema.js'
  ✗ v1 scoring ignores the layered block — score is identical with or without it (AC-3)
      nostr-search/eval/score.js must exist and be require()-able — Cannot find module '…/score.js'
  ✗ at least 30 hand-judged gold queries are committed and every one is schema-valid
      nostr-search/eval/gold/ must exist and hold the hand-judged gold set (AC-5)
  ✗ runner.js guards main with require.main===module and baseline.json declares metric/baseline/tolerance
      nostr-search/eval/runner.js must exist (ADR 0004 impl notes)
  ✗ a PR CI workflow runs the eval runner against a pinned Meilisearch v1.12.8 service
      .github/workflows/search-eval.yml must exist (ADR 0004 — net-new tooling authorized by the ADR)

Test Results
-------------
Configuration Loading:                           PASS
treasure-maps-router-preset suite:               PASS (5 passed, 0 failed)
scheduled-search-and-house-scores-refresh suite: PASS (12 passed, 0 failed)
strfry-router-first-boot-config suite:           PASS (3 passed, 0 failed)
per-query-neo4j-timeout-safety-net suite:        PASS (8 passed, 0 failed)
search-quality-eval-harness suite:               FAIL (0 passed, 14 failed)
Overall:                                         FAIL
```

- 14 failing tests; each message names exactly what the Implementer must add per
  ADR 0004 — no typo / import-error failures.
- All four pre-existing suites remain green (5 / 12 / 3 / 8) — the new suite is
  purely additive, no collateral regression.
- `npm test` exits 1 (Overall FAIL), as required pre-implementation.
