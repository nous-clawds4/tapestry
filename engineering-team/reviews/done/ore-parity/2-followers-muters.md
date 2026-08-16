# Review: Story 2 — ORE-06 /followers + ORE-07 /muters (global)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-16
**Diff:** `git diff staging...HEAD` (test commit `52b7b9f6`, impl commit `359d3f36`, branch `feat/ore-followers-muters`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall PASS, exit 0** (reviewer's own run on the final committed tree,
      2026-08-16): `open-ranking-followers-muters` 16/16; siblings unchanged (`stats` 29/29,
      `search` 18/18, `rank` 16/16); every other suite green. This run matters doubly here: the
      Implementer's full run raced the `neo4j.int` fix, so this is the authoritative gate on the
      final tree.
- [x] `npm run test:playwright` — not applicable; docs page verified live instead.
- [x] _Lint/typecheck/build not configured — skipped._ (`scripts/harness-lint.sh`: clean.)

Independent live checks (reviewer-run against the local container running the final code):
unknown target → `{"results":[],"total":0}` (the no-404 posture); algorithm error `X-Reason`
names the endpoint (`… for /muters`); limit boundary 1000 → 200 / 1001 → 422; `ACAO: *` on 200.
The Implementer's cycle-local evidence additionally covered: seeded three-follower proof (rank
90 first, tied 50s in `pubkey ASC` order, `total: 3` independent of `limit: 1`), the muters edge
with its own cutoff var (seeded rank 70), graph restored to its exact prior state, SDK
`Client.create` validating all five endpoints + `followers()` round-trip, docs page console-clean.

## Spec adherence
- [x] Every acceptance criterion has a passing test: AC-1 → C1 + C2 (SDK-constant-anchored);
      AC-2 → B1/B3/B4; AC-3 → B2; AC-4 (limit) → B6/B7; AC-5 (unknown/empty) → B5; AC-6 →
      B8/B9/B10/B11/E1; AC-7 → S1/S2 + C1 sibling assertions + all pre-existing suites green.
- [x] No criterion silently dropped; no behavior beyond the story (docs sections are the story's
      own contract surfaces).
- [x] The two deliberate spec/sibling deviations the story pins — integer house-scale ranks +
      no-`ttl` (vs NosFabrica floats/ttl) and 200-not-404 for unknown targets — are implemented
      and pinned by B1/B2/B5.

## ADR adherence
- [x] Files match ADR ore-parity/0002 §Implementation notes exactly: `inbound.js` (new, twin
      builders + `fetchVerifiedInbound` + wrappers), `capabilities.js` (two spec-ordered
      entries), `index.js` (ORE_PATHS + routes + re-exports), BIBLE §28, `OpenRanking.jsx`
      combined section, plus Phase-3 artifacts. **No dependency changes** (SDK reused from
      story 1's pin).
- [x] Sub-decisions verified in code: default 50 / max 1000 with over-max `422`
      (`inbound.js:96-101`, decision 2); query tie order `influence DESC, pubkey ASC`
      (`inbound.js:53`, decision 3); per-edge cutoffs bound as `$cutoff`, read at request time
      inside the real dep (`inbound.js:43-44`, decision 4); no-404 via plain `MATCH` fallthrough
      (decision 5); both statements under `NEO4J_QUERY_TIMEOUT_MS` txConfig (`inbound.js:45`,
      decision 6); live `total` from the same filtered scan (Option C rejection honored).
- [x] One implementation detail beyond the ADR's sketch, correct and necessary: `LIMIT` demands
      a Bolt INTEGER — plain JS numbers serialize as floats and Neo4j rejects them (22N03,
      observed live) — fixed with `neo4j.int(Math.trunc(limit))` + explanatory comment
      (`inbound.js:47-49`). Caught by cycle-local before commit; the hermetic seam cannot see it
      (deps injected), which is exactly why the live pass exists.

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall (matches ADR).
- [x] No TA-pubkey literals introduced (checked); story handles carry the per-deployment caveat.

## Things tests can't catch
- [x] No secrets; no debug logging beyond the sibling-convention `console.error` in the 500 catch.
- [x] No commented-out code.
- [x] **Injection surface:** the only string interpolated into Cypher is `EDGES[endpointPath].rel`
      — a two-entry whitelist keyed by the hard-bound endpoint path, never request input
      (`inbound.js:26-29,52,60`); `pubkey`/`cutoff`/`limit` all bound parameters. Validation
      short-circuits before any query on every 4xx (spy-pinned + code order).
- [x] Concurrency: stateless, read-only, two bounded statements per request on the shared pooled
      driver; no shared mutable state.
- [x] Error paths: unknown config value for a cutoff parses to `NaN` → filter matches nothing →
      empty-but-valid responses (same failure shape as the existing verified-* surfaces; noted
      non-blocking below).

## House rules check
- [x] Concept Graph API authority respected (nothing concept-bearing).
- [x] No new lint/typecheck/build tooling; no new dependencies.

## Findings

### Blocking
None.

### Non-blocking
1. **src/api/open-ranking/inbound.js:43** — a malformed cutoff config value (`parseFloat` →
   `NaN`) silently yields empty results rather than erroring. Identical failure shape to the
   pre-existing verified-* machinery reading the same config; a config-validation guard would be
   a cross-cutting improvement outside this story. No change requested.
2. **src/api/open-ranking/inbound.js:97** — `limit: true` coerces to 1 (`Number(true)`), same
   loose-typing acceptance as the reviewed search/rank limit handling. Consistency retained;
   record only.

### Harness friction
None.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in the chat (book `ore-parity`: parity
      bullet now implemented but the frame's verification bullets require the staging deploy —
      book remains Open pending `cycle-staging`; close to be offered after deploy verification).
