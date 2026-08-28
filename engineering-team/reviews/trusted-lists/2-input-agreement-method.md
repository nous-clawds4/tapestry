# Review: Story 2 — Weighted-sum membership method (rung 2)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff 58e14390...HEAD` (implementation commit `6cfb21d9`)
**Story:** `engineering-team/stories/trusted-lists/2-input-agreement-method.md`
**ADR:** `engineering-team/decisions/trusted-lists/0002-weighted-sum-method.md`
**Test plan:** `engineering-team/stories/trusted-lists/2-input-agreement-method.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] Story suite `test/tl-weighted-sum-method.test.js`: **9/9** at implementation (incl. the
      seeded-POV known-value matrix LB, live); **8 pass + 1 correct skip** (LA skips when a
      POV exists) in the later serial batch.
- [x] Story-1 suite (hardened this story): **12/12** on the final clean run.
- [x] Validation kit run live: **all six scenarios ✓** (A 1, B 0.3, C 1.8, D 0.4, E 0,
      F −0.84), `membership-method: input` on the wire, raw p-tags printed.
- [x] Neighbor regression: `tl-publication-from-pins-publish` 7/7; `profile-tags` 13/13
      (the shared-aggregator consumer). `customize-pin-curation-publish` 3/3 in the first
      clean batch; its later red was environmental (see OPEN 184 — assumes count mode).
- [x] `node --check` on changed server files; UI `vite build` clean; served bundle verified.
- [ ] Full `npm test` not re-run (multi-suite live gate; see the flake findings below —
      running it serially on this machine currently takes tens of minutes, OPEN 182).

## Spec adherence

- [x] Method selectable — `IMPLEMENTED_METHOD_IDS = ['count','input']`
      (`membershipMethods.js:23`); UI `input` entry `available: true`, "Weighted sum" label.
- [x] Wire records `["membership-method","input"]`; one score per member in the p-tag's
      reserved slot + content JSON (`refreshPinnedTags.js:170-177,224`); LB asserts live.
- [x] Known values incl. weighting-beats-counting (C 1.8 > B 0.3), equal-weight zero (E),
      negative dispute-dominance (F). **Fixture correction during implementation:** scenario
      D's original 1-apply-vs-1-dispute can never pass the count predicate; corrected to
      2×rank-40 applies + rank-40 dispute (same weighted result 0.4) in story/plan/suite/kit.
      This is the mirror-of-OPEN-174 case: red test → check the test first. Correct call.
- [x] Membership/ordering/counts unchanged — `input` fold reuses `applyDisputesFunction`
      verbatim and only attaches scores; LB asserts order + counts.
- [x] No-POV fallback records `count` with no scores (LA + traced single-pin repro).
- [x] Count restores Story-1 shape (LC); local-only guard (L0).
- [x] Validation kit `scripts/tl-ladder-validate.js`: seeds everything, prints
      published-vs-expected, exits non-zero on mismatch. **Beyond-plan additions, both
      operator-directed at the gate conversation:** `--all` mode (per-method columns, seed
      once) and `count` as a validatable mode (membership + counts); refuses unimplemented
      methods rather than letting the fallback lie.

## ADR adherence

- [x] Option A exactly: fold accumulated in `aggregateProfilesTagged`
      (`profile-tags/index.js:693-706`), additive fields only, weights from the already-
      fetched docs; `round6` (ADR point 4); effective-method computed before the wire tag
      (point 2); `includeScoreInTL` enrichment gated to count (point 3, `:186`).
- [x] **Deviation, operator-ratified:** ADR's method table had four ids; mid-story the
      operator collapsed the selector to the original three (`count`,`input`,`certainty`) —
      rung-4 formalization is a contract change to `certainty`, not a method. Recorded in
      `membershipMethods.js`, the epic, and story-1's amended U2/S1. The ADR's table is
      superseded on this point by the epic's story list; no other ADR content is affected.

## Things tests can't catch

- [x] No secrets/debug/commented-out code. Kit prints its side effects loudly and checks
      publish policy before seeding.
- [x] Weighted fields are additive on a shared aggregator; `handleProfilesTagged` unaffected
      (13/13).
- [x] Negative/zero scores publish correctly (`item.score != null` path handles 0).

## Findings from the extended flake hunt (environmental, not this diff)

1. **Zombie refresh-alls.** A killed test driver leaves its in-container
   `refresh-all-pinned-tags` running; the zombie's `retractStaleTLs` sweep then retracts the
   *next* run's fresh fixture TL (its pin enumeration predates the fixture). This caused
   every post-batch failure and masqueraded as a code bug. Lesson recorded here: never
   overlap refresh-alls; suites/kit runs must be serialized, and killed runs poison the next
   one. Candidate future fix rides OPEN 182 (fixture prune / incremental refresh).
2. **Story-1 suite hardened** (in this diff): pins count + no-POV with byte-exact
   snapshot/restore — the method and POV became real operator knobs this book, so
   environment-assuming tests must pin. Legacy suites' same weakness: OPEN 184.

## Verdict

**PASS** — all acceptance criteria verified live by the reviewer (weighted math, wire shape,
fallback, kit), the diff matches ADR 0002 with one operator-ratified deviation (selector
collapse) properly recorded, and every red run during the extended session traced to
environment (zombie refreshes, unpinned settings), each now either fixed in-suite or
ledgered (OPEN 182/183).
