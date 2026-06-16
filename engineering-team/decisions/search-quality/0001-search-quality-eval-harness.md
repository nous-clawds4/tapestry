# ADR 0001: Architecture for the offline search-quality evaluation harness

**Status:** Accepted
**Date:** 2026-05-17 · **Revived/re-validated:** 2026-06-16
**Story:** `engineering-team/stories/search-quality/1-search-quality-eval-harness.md`
**Epic:** `search-quality`

> **Revival note (2026-06-16).** Authored 2026-05-17 on the local-only branch `feat/search-eval-harness` (never pushed); revived into the `search-quality` epic and renumbered from the flat `decisions/0004-…`. The load-bearing facts below were re-checked against current `main`: the meili proxy `src/api/search/profiles/meili/index.js` → `handleMeiliSearchProfiles` (still the "SINGLE AUTHORITY") ✓; `nostr-search/src/{search,ingest,startup}.js` ✓; the `test-data/` fixture precedent ✓ (now also `dwarves-v2-*`); `.github/workflows/` still all deploy-only (`deploy-brainstorm`, `deploy-communities`, `deploy-magic-carpet`, `deploy-staging`) so a PR-triggered CI workflow remains net-new ✓; the `test/test.js` hand-rolled runner ✓. Two small drifts corrected inline below: the Meili tag and the test-file name. **Correction (2026-06-16):** an Implementation scaffold following these notes already exists, backed up on `feat/search-eval-harness` (`e66a3fed`) — unfinished (gold set incomplete) and unmerged/unverified; see the epic's "Implementation status".

## Context

Story 1 asks for an offline harness that scores search quality against a
hand-judged query set, with a measure-and-regression-gate success condition, a
layered-ready fixture format (v1 scores profile search only), and a v1 Done bar
of ≥30 hand-judged queries. Relevant facts pulled from the story plus the
codebase:

- **Two search seams exist.**
  - `src/api/search/profiles/meili/index.js` → `handleMeiliSearchProfiles`
    (`GET /api/search/profiles/meili?q&wotPov=house|user&userPubkey`). Its own
    header comment: *"This proxy is the SINGLE AUTHORITY for POV resolution,
    filter/sort config, and field namespacing (`wot_<metric>_<suffix>`). The
    client only sends q, limit, offset, wotPov, userPubkey."*
  - `nostr-search/src/search.js` (`GET /api/search`) — lower level; expects
    already-fully-qualified `sort`/`wotFilters` (e.g. `wot_rank_a8ca55ca`) and
    runs the two-phase scored+backfill merge against Meilisearch directly.
- **The corpus mutates continuously.** `nostr-search/src/ingest.js` live-ingests
  kind-0; `nostr-search/src/startup.js` schedules a 24h bulk re-ingest; WoT
  scores are upserted via `POST /api/load-scores`. A score compared to a baseline
  is only meaningful against a *fixed* corpus.
- **Constraints.**
  - CLAUDE.md / `roles/architect.md`: JS-without-build; *no new
    lint/typecheck/build tooling without an ADR*. All `.github/workflows/` are
    deploy-only — a PR-triggered CI workflow is net-new automation.
  - `test/test.js` is a hand-rolled runner: phase-1 smoke + story suites
    `test/<slug>.test.js` each exporting `async run() → {pass,fail}`,
    `require()`d and added to the results list; `process.exit(0|1)`.
  - `test-data/` (`dwarves-test-data.json`, `mint-dwarves.js`) is the
    established curated-fixture-dataset precedent.
- **Concept Graph orientation (three-call pattern, AGENTS.md):** `/summaries`
  (34 concepts) → `/node/<h>/neighbors` for the two concepts the story names.
  - `39998:e00ed090…df36:web-of-trust` — ConceptHeader, neighbors `{}`.
  - `39998:e00ed090…df36:graperank` — ConceptHeader, neighbors `{}`.
  - No `search` / `relevance` / `evaluation` concept exists. The harness adds
    and changes **no** concept-graph node or schema.

## Options considered

### Option A — Proxy seam + version-pinned fixture corpus + hand-rolled scorer (chosen)

Drive the eval through `/api/search/profiles/meili` (the real product path).
Co-version a small curated **fixture corpus** + the gold set; load the corpus
into an **ephemeral Meilisearch** (`MEILI_URL` override, tag matching
`docker-compose.yml` — currently `getmeili/meilisearch:v1.12`) for each run.
Hand-rolled binary-relevance scorer (recall@k + MRR). Ships a PR-triggered CI
workflow added as a **non-required** check.

- **Pros:** Tests what users actually get (POV resolution + namespacing exercised,
  not duplicated). Reproducible — score moves only when code/config moves.
  Hermetic and CI-able. Reuses the `test-data/` fixture precedent. No new runtime
  dependency; consistent with the hand-rolled `test/test.js` and JS-without-build.
- **Cons:** Needs the control-panel + nostr-search-api + an ephemeral Meili stood
  up for a full run. A small corpus is not the production data distribution —
  v1 measures *ranking logic on a controlled corpus*, explicitly not prod recall.

### Option B — nostr-search-api seam + pinned index snapshot + nDCG

Hit `nostr-search/src/search.js` directly against a pinned Meilisearch dump of
the real index; graded relevance with nDCG@k.

- **Pros:** Realistic data distribution; nDCG is the ranking gold standard.
- **Cons:** The harness must re-implement the proxy's `wot_<metric>_<suffix>`
  namespacing — a fidelity/drift hazard for a quality gate. A real-index dump is
  750K–2.6M docs / 1.2–5.6 GB RAM — too heavy to version or run in CI. Graded
  labels materially raise the hand-judging burden against a 30-query v1.

### Option C — Meilisearch-direct + live staging index + wide tolerance

Query Meilisearch directly against the live staging index; absorb data drift
with a loose tolerance.

- **Pros:** Cheapest to stand up.
- **Cons:** Bypasses the two-phase WoT merge in `search.js` (doesn't test what
  ships). A drift-noisy gate on a *trust* metric is worse than none — it trains
  everyone to ignore it (the Goodhart failure mode AC4 exists to prevent).

## Decision

We chose **Option A**.

The story's acceptance criteria are observer-relative and the proxy is the
documented single authority for observer resolution; testing below it would
either bypass observer semantics (B/C) or force the harness to duplicate and
drift from proxy logic (B). Reproducibility is non-negotiable for a regression
gate, which kills the live-index options; a small co-versioned fixture corpus is
the only hermetic, CI-able choice and matches the existing `test-data/` pattern.

Sub-decisions:

- **Metric:** binary relevance, primary metrics **recall@k and MRR**
  (k configurable, default 10); overall score = mean over queries. Chosen over
  graded nDCG because it minimizes hand-judging burden for the ≥30-query v1 and
  is directly auditable (AC4). The gold-entry schema stores an optional `grade`
  so nDCG can be added later without re-judging.
- **CI as a *required* gate is deferred.** This ADR authorizes the workflow
  *file* (satisfying the no-new-tooling-without-ADR rule); promoting it to a
  merge-blocking required check is a process-contract change tracked in the
  separate, independently-ratifiable harness-contract ADR — not this story.

## Consequences

- **Enables:** A reproducible, observer-relative search-quality number and an
  auditable per-query report; a mechanical regression signal; a fixture format
  ready for the future layered Tag→DList work.
- **Constrains:** A full eval run requires the local stack + an ephemeral Meili.
  The fixture corpus becomes a maintained artifact that must evolve with search.
- **New debt / follow-ups:** The concrete baseline value + tolerance are set
  post-Implementation (story Open Questions). Promoting the CI check to required,
  and any production-distribution eval, are explicitly deferred.
- **Firmware reinstall required?** **No** — verified via the Concept Graph: no
  concept node or schema is added or changed.

## Implementation notes

Concrete guidance for the Implementer (no production code written here):

- **`nostr-search/eval/score.js`** — pure, dependency-free:
  `recallAtK(hitPubkeys, judged, k)`, `mrr(hitPubkeys, judged)`,
  `aggregate(perQuery)`. No framework.
- **`nostr-search/eval/schema.js`** — `validateGoldEntry(obj)`: requires
  `query`, `observer`, `judgments`; **accepts and ignores** an optional
  `layered` object (AC3 — never reject it).
- **`nostr-search/eval/runner.js`** — `runEval({goldDir, corpusDir, k})`:
  validate gold, ensure corpus loaded into the target Meili, for each entry
  `GET ${TAPESTRY_URL}/api/search/profiles/meili?q&wotPov&userPubkey`, collect
  hit pubkeys, score, write `report.json` + a human-readable per-query report
  (query, observer, returned results, judged hit/miss — AC4), compare overall to
  `baseline.json`, `process.exit(0|1)` listing regressed queries (AC2).
- **`nostr-search/eval/gold/*.json`** — ≥30 hand-judged entries. Schema:
  `{ id, query, observer:{wotPov, userPubkey?}, judgments:[{pubkey, relevant,
  grade?}], layered?:{tagLayer?,dlistLayer?} }`.
- **`nostr-search/eval/corpus/*.json`** + a `mint-*.js`-style loader mirroring
  the `test-data/` precedent; pinned, co-versioned with the gold set.
- **`nostr-search/eval/baseline.json`** — `{ metric, baseline, tolerance }`;
  numbers filled post-Implementation.
- **`test/search-quality-eval-harness.test.js`** — exports `async run()` →
  `{pass,fail}`; unit-tests `score.js`, `schema.js` (incl. layered-ignored), and
  the gate exit logic with synthetic inputs (hermetic — no live stack).
  Register in `test/test.js`: `require()` + suite line + fold into `overallOk`.
  (Slug-named, not number-prefixed, per the current `test/` convention.)
- **`.github/workflows/search-eval.yml`** — PR trigger on `nostr-search/**` and
  `src/api/search/**`; Meilisearch service container at the tag `docker-compose.yml`
  uses (**`v1.12`** as of 2026-06-16); load corpus; `node nostr-search/eval/runner.js`.
  Added **non-required** in v1.

Alternative location considered: a top-level `eval/`. Chose `nostr-search/eval/`
to co-locate with the search service it measures (mirrors `nostr-search/src/`).

## Out of scope

- The concrete baseline number + tolerance (post-Implementation).
- Promoting the CI workflow to a required, merge-blocking gate (separate
  harness-contract ADR, for the operator + Vinney to ratify).
- A production-distribution / real-index-snapshot eval.
- Scoring the layered Tag→DList layers (only the *format* is layered-ready).
- Any label bootstrapping (story explicitly rejected; hand-judged only).
