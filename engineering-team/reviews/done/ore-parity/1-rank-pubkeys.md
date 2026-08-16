# Review: Story 1 — ORE-03 /rank/pubkeys (global)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-15
**Diff:** `git diff staging...HEAD` (test commit `51eadeb6`, impl commit `9b4ad192`, branch `feat/ore-rank-pubkeys`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall PASS, exit 0** (reviewer's own run on the final tree, 2026-08-15):
      `open-ranking-rank` 16/16, `open-ranking-stats` 29/29, `open-ranking-search` 18/18, every
      other suite green. The SDK conformance test (C2) passes — the real `open-ranking@0.1.1`
      `validateCapabilities()` accepts the served document.
- [x] `npm run test:playwright` — not applicable (no browser-flow behavior in scope; docs-page
      rendering verified live instead, see below).
- [x] _Lint not configured — skipped._ (`scripts/harness-lint.sh` run separately: clean.)
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ (UI bundle built and deployed to the local container as
      part of cycle-local verification.)

Independent live checks (reviewer-run against the local stack, final tree deployed in-container):
duplicate-collapse (`[K, K]` + `limit: 5` → one result), capability doc advertises
`/stats/pubkey, /rank/pubkeys, /search/pubkeys`. The Implementer's cycle-local evidence
additionally covered: seeded-influence consistency (rank 42 = stats 42 for the same key, graph
restored to null-influence state afterward), 422/400/413 conventions with `X-Reason`,
boundary-1000 → 200 with 1000 results, `ACAO: *` everywhere, and the real SDK
`Client.create('http://localhost:7778')` + `rankPubkeys()` round-trip — the exact npub.world path.

## Spec adherence
- [x] Every acceptance criterion has a passing test: AC-1 → C1 + C2; AC-2 → B1/B3/B4; AC-3 →
      B1/B2; AC-4 → B5/B6; AC-5 → B8; AC-6 → B7/B9/B10/B11/E1; AC-7 → S1/S2 + C1's
      sibling-endpoint assertions + all pre-existing suites green in the same run.
- [x] No criterion silently dropped. The one AC amendment (`ttl` removed from AC-2) was made at
      the Architecture gate, operator-approved, and is recorded in both the story and ADR
      decision 1 — B1/B4 assert `ttl` absent.
- [x] No behavior added beyond the story. The two beyond-ADR doc touches are logged in the
      story's `## Deviations` and reviewed here (below) — no runtime behavior beyond the story.

## ADR adherence
- [x] Files changed match ADR ore-parity/0001 §Implementation notes exactly: `rank.js` (new,
      builder + local `fetchInfluences` + thin wrapper), `capabilities.js` (registry entry,
      spec-ordered), `index.js` (ORE_PATHS + route + re-exports), `package.json`/lock (devDep),
      `BIBLE.md` §28, `OpenRanking.jsx` docs section, plus the Phase-3 test artifacts.
- [x] Layering respected: pure builder returns triples; Express wrapper thin with the sibling
      try/catch→500 shape; registry drives both the served doc and `resolveAlgorithm` (no-drift).
- [x] Dependencies: exactly one new entry, `open-ranking@0.1.1`, **dev-only, exact-pinned** —
      authorized by ADR decision 6; `package-lock.json` confirms no transitive additions
      (zero-dep package, MIT, integrity-pinned). Container installs `--production`
      (`docker/entrypoint.sh:224`) so it never ships.
- [x] Sub-decisions verified in code: dedupe-first-occurrence + deduped-count limit basis
      (decision 2, `rank.js:71-83`); stable-sort tie order (decision 3, `rank.js:90`);
      `MAX_PUBKEYS = 1000` counted pre-dedup → 413 (decision 4, `rank.js:54-56`); one reason
      string for all pubkeys-shape rejections (decision 5); no `ttl` (decision 1).

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall required (matches ADR "No").
- [x] Handles referenced in the story are `kind:pubkey:slug` form with the per-deployment TA
      caveat; no TA-pubkey literals introduced anywhere in the diff (checked).
- [x] No BIBLE-orientation anti-pattern: the new code touches no concepts, so nothing to orient.

## Things tests can't catch
- [x] No secrets in committed files (diff walked; lockfile integrity hash only).
- [x] No leftover debug logging — the single `console.error` in the 500 catch mirrors
      `stats.js`/`search.js` convention.
- [x] No commented-out code.
- [x] Error paths: validation short-circuits before the Neo4j call on every 4xx (asserted by
      tests via the spy; verified in code order `rank.js:50-79`); 500 path returns a generic
      reason, no internals leaked.
- [x] Concurrency: stateless read-only endpoint over a shared driver pool; one bounded query per
      request (≤1000 index lookups in a single `UNWIND`); no shared mutable state.
- [x] Security: **parameterized Cypher** (`$pubkeys`) — notably safer than the string-built query
      in the legacy `get-profile-scores.js` path; strict hex validation before any query; no new
      unauthenticated oracle (no `pov` path on this endpoint; the W12 gate untouched); response
      size bounded (~80KB worst case).

## House rules check
- [x] Concept Graph API authority respected (nothing concept-bearing).
- [x] No new lint/typecheck/build tooling.

## Deviations reviewed (logged in the story's `## Deviations`)
1. **BIBLE §28 Deployment staleness fix** — the section claimed ORE was "Not on production";
   production's capability document was fetched live this session, so the claim was false. The
   correction is factual, one sentence, on the section this story edits. Accepted.
2. **Docs-page section numbering** (appended as §4 rather than renumbering to spec order) —
   cosmetic, accepted.
3. **JSX spacing fix** on the conventions line (`(malformed JSON),422` → spaced) — this was the
   prior book's recorded non-blocking finding, fixed on a line this story already edits. Accepted.

## Findings

### Blocking
None.

### Non-blocking
1. **src/api/open-ranking/rank.js:75** — `limit: true` coerces via `Number(true) === 1` and is
   accepted as limit 1. Identical behavior to the reviewed `search.js` limit handling, so
   consistency wins; noting only for the record. No change requested.

### Harness friction
None.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in the chat (book `ore-parity` remains
      Open — acceptance-frame bullets 1 (live npub.world validation on staging/production) and
      2 (ORE-06/07) not yet satisfied; no close offer due).
