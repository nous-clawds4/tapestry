# Review: Story 7 — Brain-first tapestry authoring

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-04
**Diff:** `git diff 3d58dc28...03032d1d` (phase commits `801abd4d` story → `73e608b1` ADR → `32fdc82f` failing tests → `03032d1d` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall: PASS** (reviewer's own full run, log at the session scratchpad `review-npm-test.log`): `brain-first-tapestry-authoring suite: PASS (19 passed, 0 failed, 0 skipped)`; neighbor suites `create-tapestry` 22/0, `add-a-concept-to-a-tapestry` 23/0, `take-a-concept-back-out` 22/0; harness-lint clean inside the run.
- [x] Story suite standalone — 19/19 (also re-verified post-R2-hygiene-fix).
- [x] `npm run test:playwright` — not run as a whole; the two shipped tapestries specs ride `npm test`'s Playwright-independent sentinels and are mocked-network (word-less fixtures); AC3's render-no-regression was instead **live-verified** (below).
- [x] _Lint/typecheck/build not configured — skipped._
- [x] Live verification (reviewer's own browser pass): ConceptElements for `39998:<TA>:tapestry` lists the fixture element — **Explicit ✅ Implicit ✅ Schema ✅** — where it listed zero elements before the story; View Tapestries shows exactly the two real tapestries (zero test residue after R2's self-cleanup); the Exploration page renders the **word-bearing** fixture as-authored (title, description, member sidebar, composed integration graph — the new top-level key is transparently ignored).

## Spec adherence

- [x] Every acceptance criterion has a passing test. AC1 → I1/I2/I3; AC2 → the documented composition chain (G2 guard accepts owner + R2 proves client-signed events traverse the hook + I1 proves accepted events complete + S1 pins the await) — the end-to-end limitation was declared in the approved plan, not discovered here; AC3 → U1/I3/I4 + live Exploration check + existing specs untouched; AC4 → I1/I5; AC5 → U2/U3/I6/I7 (I7 asserts brain json **byte-identical** to the letter's).
- [x] No criterion silently dropped.
- [x] No behavior beyond the story: the hook is guard-scoped to the instance's own tapestry letters; the response field is additive (`brainWrite` only present when the hook ran); third-party and non-tapestry publishes are behaviorally unchanged (R2 + the untouched-suite evidence).

## ADR adherence

- [x] Files changed exactly match ADR 0007's implementation notes: new `src/api/strfry/tapestryBrainWrite.js`; `publishEvent.js` promisified with the awaited hook; `tapestryDraft.mjs` word section (create-only). No other production files touched.
- [x] Layering respected: hook module isolated, one call site, requires only existing shared machinery (`normalize/helpers.importEventDirect`, `tapestry-derive.deriveByKey`, `neo4j-driver`, `tapestry-store`, runtime key resolvers).
- [x] No new dependencies.
- [x] **Deviations (2, both disclosed in the story — audited):**
  1. *Pre-derive cache invalidation* (`store.remove(tapestryKey)` before `deriveByKey`): surfaced by I6's first live run — the word deriver's base prefers an existing LMDB doc over the node's refreshed json tag, so republishes re-derived stale content. The fix keeps derivation brain-sourced (§29) and touches nothing outside the hook. Within the ADR's derive step's intent; correctly logged. Accepted.
  2. *Phase-4 test edit (R2 fixture hygiene)*: audited the exact delta (`git diff 32fdc82f 03032d1d -- test/…`): the three assertions are **byte-identical** (re-indented into a try/finally); additions are a stable non-secret fixture key, a tie-safe `created_at` bump, and best-effort self-cleanup by exact event id. No assertion weakened; motivated by five observed junk rows in the live directory (swept dry-run-first). Accepted — and the disclosure pattern (story Deviations + plan correction note) is exactly right for a test touch in this phase.

## Concept-graph integrity

- [x] Handles are `kind:pubkey:slug`, composed from the runtime-resolved TA (`getOwnerAssistantPubkey()`) and owner (`getOwnerPubkey()`) — no hardcoded pubkeys in production code (fixture literals confined to the test file, per convention).
- [x] No concept definitions changed → no firmware reinstall required (ADR states it; confirmed — the schema already tolerated `word`, verified live by I4).
- [x] No BIBLE re-derivation in code.

## Things tests can't catch

- [x] No secrets: R2's fixture private key is deliberately non-secret and documented as such.
- [x] Console output matches house style (one error line on hook failure; the pre-existing publish log retained).
- [x] No commented-out code, no leftover debug, no TODOs needing filing.
- [x] Injection: every hook Cypher write uses `$`-parameters; the only composed string is the concept handle built from the hex-validated runtime TA. Event fields (pubkey, d-tag) reach queries as parameters only, and the hook runs strictly after strfry's signature verification.
- [x] Error paths: strfry-import failure short-circuits with the pre-existing message shape; hook failure returns `{success:false, error}` in `brainWrite` without failing the publish (the letter cannot be unsent — correct per ADR); `store.remove` of a missing key no-ops; `getOwnerPubkey()` null degrades the allow-list to TA-only (safe).
- [x] Concurrency: republishes MERGE on a stable uuid; concurrent same-coordinate publishes converge on last-writer json + idempotent placement — acceptable for a single-owner authoring surface.

## House rules check

- [x] Concept Graph API authority respected (the story's element/schema facts were pulled from the live graph during architecture).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

None.

### Non-blocking

1. **BIBLE.md:300–307 (§6 Graph-embedding convention)** — the shape prose ("carries a top-level `graph` block alongside `tapestry`") now omits the authored `word` section, and :307's read-side rationale ("the Neo4j projection, which drops tapestry elements (`OPEN.md` #88)") cites the retired misdiagnosis and predates the brain write this story ships. The read-side *convention* (View Tapestries reads strfry) still stands — only the stated *reason* is stale. Ask: fold the §6 touch-up + a §16 changelog row into this book's close (the doc-reconciliation step; precedent: OPEN.md rows #5/#10 handled BIBLE impact at close).
2. **`ui/src/pages/tapestries/useCreateTapestry.js:58-63` (and the add/remove flows)** — the UI reads only `success` from the publish response; a partial outcome (`success: true, brainWrite: {success: false}`) is server-logged and response-visible but user-invisible, so a hook failure would silently re-open the split-brain for that one element. Not an AC; the repair tool exists (`POST /api/neo4j/event-update`). Optional improvement: surface `brainWrite.success === false` as a non-fatal warning in the authoring flows, or fold into the stage-2 ingest story (which owns reconciliation) — a ledger row at close would keep it from evaporating.
3. **`src/lib/derivers/word.js:42-45` (`getExistingWordJson`)** — the cache-first base preference (stored LMDB doc over the node's refreshed json tag) is a latent staleness hazard for any *other* content-refresh path that re-derives without invalidating first; this story's hook invalidates locally (Deviation 1) and deliberately leaves the general behavior alone. Optional: note it into the self-ontology epic's anticipated story 4 (deriver audit) via a ledger row at close.

### Harness friction

None — the harness surfaces consulted this story were accurate (the BIBLE §6 staleness above is product-doc impact created by this very story, not a doc that misled it).

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result and book arithmetic reported in chat (human-gated flow), not here. `/close-book` offered.
