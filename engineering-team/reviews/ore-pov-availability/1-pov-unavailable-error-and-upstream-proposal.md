# Review: Story 1 — POV-unavailable error — never substitute, propose upstream, document

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-12
**Diff:** `git diff origin/staging...HEAD` (base `d2f9446a` → head `7eac97c5`; phase commits `41c59c87` story, `8665802e` ADR, `50700f9b` tests, `7eac97c5` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall: PASS** (reviewer's own run, exit 0; `open-ranking-stats suite: PASS (29 passed, 0 failed)`; 53 skips are the catalog's pre-existing live-stack skips)
- [x] _Playwright not applicable — no browser-flow tests in the plan; docs page verified live in the Browser pane instead (console clean)._
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (UI bundle built as part of local deploy, clean)._

## Spec adherence

- [x] Every acceptance criterion has a passing test: AC1 → `P1` (+ existing `B5` no-fetch pin); AC2 → existing `G1`/`G2` unmodified; AC3 → existing `B4`/`G3`/`B12` unmodified; AC4 → `P2`/`P5`; AC5 → `P3`/`P4`.
- [x] No criterion silently dropped. The test commit is **purely additive** — verified zero removed lines in `test/open-ranking-stats.test.js` — so AC2/AC3's "existing tests keep passing unmodified" claim is structurally true, not asserted.
- [x] No behavior added beyond the story: `git diff` touches exactly the ADR's six surfaces + the phase artifacts.

## ADR adherence

- [x] Files match ADR §Implementation notes 1–6: [src/api/open-ranking/stats.js:96](../../../src/api/open-ranking/stats.js) (one composed reason, `resolveAlgorithm` already imported, registry-derived so guidance can't drift), [BIBLE.md:1726](../../../BIBLE.md) (invariant sentence kept; contract-draft pointer added), [ui/src/pages/developers/OpenRanking.jsx](../../../ui/src/pages/developers/OpenRanking.jsx) (three edits as specified), `protocols/upstream/ore-01-pov-unavailable.md` (spec text **verbatim** vs the ADR's ratified block — compared word-for-word), `protocols/README.md` (one layout line), `protocols/worksheet.md` W12 (append-only dated update; question (1)/oracle history intact).
- [x] Layering respected: pure-builder seam untouched; `capabilities.js`/`search.js`/`index.js`/`shared.js` unchanged.
- [x] No new dependencies.

## Concept-graph integrity

- [x] No concept handles introduced or altered; no firmware change (ADR: reinstall not required).
- [x] No new code paths read BIBLE.md/firmware for graph-resident knowledge.

## Things tests can't catch

- [x] No secrets; **zero 64-hex literals in the additions** (per-deployment TA/pubkey hardcode rule respected — grep-verified on the impl commit).
- [x] No debug logging, no commented-out code.
- [x] **Oracle posture (the security crux):** the informative reason runs only on the gate-OPEN unprovisioned path. Independently re-verified on the live local stack post-deploy: gate-off capability doc is global-only and a personalized request returns the *gated* `422 unsupported algorithm` — byte-identical for any pov (no provisioning probe). Gate-open reveals no new bit beyond the pre-existing 200-vs-422 split (worksheet W12; ADR `open-ranking/0005` unchanged, flag default still OFF in `src/config/defaults.json` — untouched by this diff).
- [x] Error path: `resolveAlgorithm('/stats/pubkey')` with no opts cannot return null (the global algorithm is always the registry's first, ungated element), so the composed reason cannot throw.
- [x] End-to-end evidence (local stack): gate-on unprovisioned pov returned exactly the new reason in both `X-Reason` and `body.error`; owner pov returned `200`; settings restored from backup afterward (key absent; gated behavior re-confirmed live).

## House rules check

- [x] Concept Graph API authority respected (no concept claims re-derived from BIBLE).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **[ui/src/pages/developers/OpenRanking.jsx:93](../../../ui/src/pages/developers/OpenRanking.jsx)** — pre-existing (untouched by this story): the older Conventions sentence renders "(malformed JSON),422" with a missing space — a JSX newline-adjacent-to-tag artifact. Correctly left alone under the no-neighbor-refactor rule; optional one-character follow-up (`{' '}` before the `422` code tag).
2. **Upstream drift risk (accepted in ADR §Consequences):** if the merged upstream wording diverges from the proposal, our `X-Reason` phrasing may deserve a cosmetic re-phrase; the pinned *contract* (422, never substitute, informative reason) would be unaffected.

### Harness friction
None — orientation docs, ports, and paths were accurate this story.

## Addendum — 2026-08-13 (fast-track doc amendment, operator-directed)

Post-PASS amendment to the AC4 artifact only (`protocols/upstream/ore-01-pov-unavailable.md`): the proposal now also restates the rule as one `422` row in each endpoint ORE's Error Codes table (`02.md`–`07.md`, inserted beneath the existing missing-`pov` row — mirroring how those tables already restate ORE-01's missing-`pov` rule, and completing the missing/cannot-serve pairing that ORE-04's `topic` rows already have); "How to submit" gains the corresponding step; the PR description gains the table-row rationale and an aside flagging ORE-08's pre-existing pov-row gap (deliberately untouched there). No code, test, or runtime behavior change; `open-ranking-stats` suite re-run green after the edit (P2 artifact pins intact). The verdict below is unaffected.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in the chat (book not yet complete — the acceptance frame's staging-verification bullet is outstanding).
