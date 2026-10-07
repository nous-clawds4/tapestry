# Test Plan: Story 1 — The cards' counting rule follows the draft grammar in three edge cases

**Story:** `engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.md`
**ADR:** `engineering-team/decisions/treasure-map-edit/0001-the-card-rule-compares-keys-segment-by-segment.md`
**Date:** 2026-10-07

## Coverage map

All new tests are in one new Node suite, `test/treasure-map-card-rule-edges.test.js` (registered in `test/registry.js`
after `manage-treasure-map-cards.test.js`). Each runs `categoryAssistants(event)` from
`ui/src/pages/treasure-map/manageTreasureMap.js` over a Map whose entries are in the order shown, and compares the
named cards. The rule is pure and the page's wiring doesn't change (ADR 0001), so the new tests are unit-level. AC-4 is
held by the suites that already pin the page, unchanged.

"Now" says how the test runs against the code before this story: **fails** (the story's fix), or **passes** (a pin on
what must not move).

| Criterion | Test | Story / ADR row | Now |
|---|---|---|---|
| AC-1 | H1: `3038x:tag` → B covers `*:tag:<X>` → D — Scores: B | AC-1 table row 1 | fails |
| AC-1 | H2: `3038x:tag:` → B covers `*:tag:<X>` → D — Scores: B | row 2 | fails |
| AC-1 | H3: `3038x:tag::<T>` → B covers `*:tag:<X>:<T>` → D — Scores: B | row 3 | fails |
| AC-1 | H4: Lists — `3039x:dlist` → B covers `*:dlist:<X>` → D — Lists: B | row 4 | fails |
| AC-1 | H5: `3038x:tag` → B covers `*:tag` → D — Scores: B | row 5 | passes |
| AC-1 | H6: `3038x:tag:<X>` → B doesn't cover `*:tag` → D — Scores: B, D | row 6 | passes |
| AC-1 | H7: `3038x:tag:<X>` → B doesn't cover `*:tag:<Y>` → D — Scores: B, D | row 7 | passes |
| AC-1 | H8: a single kind never covers a family — `30382:rank` → A, `*:rank` → D — Scores: A, D | row 8 | passes |
| AC-2 | F1: `*:rank` → D — Scores only | AC-2 table row 1 | fails |
| AC-2 | F2: `*:contexts` → D — Lists only | row 2 | fails |
| AC-2 | F3: `*:pin` → D — Scores and Lists, never Concepts | row 3 | passes |
| AC-2 | F4: `30392` → A, `*:rank` → D — Scores: D; Lists: A | row 4 | fails |
| AC-2 | F5: `3038x` → B, `*:contexts` → D — Scores: B; Lists: D | row 5 | passes |
| AC-3 | N1: Concepts — `39998` → A, then `39998:dlist-header` → B — A | AC-3 table row 1 | fails |
| AC-3 | N2: Concepts — `39998:dlist-header` → B, then `39998` → A — B | row 2 | fails |
| AC-3 | N3: `*` → C, then `*:` → D — C on all three | row 3 | fails |
| AC-3 | N4: `3038x:tag` → B, then `3038x:tag:` → D — Scores: B | row 4 | fails |
| AC-3 | N5: `39998:dog-breed` → A and `39998:dog-breed:` → B are two Concepts | row 5 | passes |
| AC-3 | X1: `3038x:` is `3038x`, so it covers `*` for Scores | ADR "For the Tester" 2 | fails |
| AC-3 | X2: `*::` is `*`, so it reaches all three cards | ADR 3 | fails |
| AC-1, AC-3 | X3: `*:tag:` is `*:tag`, so `3038x:tag` covers it | ADR sub-decisions 1, 3 | fails |
| AC-3 | X4: an exact kind folds too — `30382:rank`, then `30382:rank:` — Scores: A | story AC-3 "every key except a Concept's" | fails |
| AC-3 | X5: `30396:tag`, then `30396:tag::` — Lists: A | story AC-3, the third example spelling | fails |
| AC-2 | X6: `*:Tag` (capital T) is a metric — Scores only | ADR 8 | fails |
| AC-1 | X7: a family entry with no valid delegate covers nothing | ADR 5 | passes |
| AC-3 | X8: only kind 39998's `dlist-header` folds — `39999` and `39999:dlist-header` are two keys | ADR 6 | passes |
| AC-3 | X9: a Concept d tag with colons stays whole — `39998:a:b` and `39998:a` | ADR 7 | passes |
| § Out of scope | X10: `*::rank` reaches Scores and Lists, as today | ADR 4 | passes |
| § Out of scope | X11: `3039x:rank` reaches Lists, as today | ADR 4 | passes |
| AC-4 | `manage-treasure-map-cards`: K1–K20, C1–C5, W1–W3, S1–S3 (unchanged) | manage-treasure-map #2 AC-2 table and the rest | passes |
| AC-4 | the page suite (unchanged) | manage-treasure-map #1 | passes |
| AC-4 | `tests/brainstorm/manage-treasure-map.spec.js`, `manage-treasure-map-cards.spec.js` (unchanged) | the cards' words, states, look; nothing signed | passes |

**AC-4 lives in suites this plan doesn't edit:**
- `test/manage-treasure-map-cards.test.js` K1–K20 walk every row of manage-treasure-map #2 AC-2's table, plus that
  ADR's edges.
- The C, W and S classes pin the cards' shape, words and wiring.
- `test/manage-treasure-map-page.test.js` pins the page, and that the view-model stays free of React, `fetch`, signing
  and storage (story 1's V7).
- The two browser specs pin what a viewer sees, including the main sample Map (`30382:rank` → A, `3038x` → B, `30392`
  and `3039x:tag` → local, `*:tag` → D), whose cards don't change under the new rule.

## Edge cases

Beyond the story's tables, all from ADR 0001's "For the Tester (Phase 3)":
- [x] A fold makes a family entry a cover: `3038x:` hides `*` (X1).
- [x] A fold on the `*` side: `*::` reaches Concepts (X2); `*:tag:` is hidden by `3038x:tag` (X3).
- [x] Folding applies to exact kinds and Lists too, not only to the story's examples (X4, X5).
- [x] A system word is matched exactly, so `Tag` is a metric (X6).
- [x] Validity still gates coverage (X7).
- [x] The Concept exemptions: only `39998:dlist-header` folds (X8), and a d tag with colons isn't split (X9).
- [x] Out of scope stays as today: an empty system slot (X10), a metric on a List family (X11).
- [x] Order: when the legacy spelling comes first, its Assistant is the key's (N2).
- [ ] No event, no tags, garbage: already pinned by K20; not repeated.

## Test infrastructure
- Test framework: Node built-in runner (`npm test`, registry `test/registry.js`). Read the run's result with
  `npm run -s gate:status`.
- Concept Graph API: not used. The stack wasn't running; nothing in this story needs it, and no live suite is added.
- Firmware state: none.
- Fixtures: inline Maps of `[key, pubkey, relay]` tags; fixture pubkeys (`c1…`, `c2…`, `c3…`, `d1…`); `naddr1x`,
  `naddr1y` and `naddr1t` stand in for categories and a Tag (any segment without a colon).
- Browser: the four manage-treasure-map and my-assistants specs, against the built UI on :7799 with every `/api/*`
  mocked (the handoff's recipe, `docs/TREASURE_MAP_EDIT_HANDOFF.md` § 6). Unchanged by this story; run as a baseline
  now, and again in Phases 4 and 5.

## How to run

```
npm test
npm run -s gate:status
```

The new suite alone:
```
node -e "require('./test/treasure-map-card-rule-edges.test.js').run()"
```

For browser/e2e (built UI served on :7799, as the handoff describes):
```
BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-07 at commit `b7acdcb` (plus this phase's uncommitted
files), full history (`git fetch --unshallow`; see the note below):

```
20261007T142756Z-984-3aa4 [tme1-phase3c] started 2026-10-07T14:27:56.024Z on b7acdcb1+dirty — FAIL, exit 1, 4982 passed, 17 failed, 581 skipped, 272/272 suites; failed: treasure-map-card-rule-edges
```

The 17 are the "fails" rows above, each for the behaviour, not a load error. For example:

```
FAIL  H1: `3038x:tag` → B covers `*:tag:<X>` → D for Scores — Scores: B
      3038x:tag → B, *:tag:naddr1x → D — scores: want [B], got [B, D]
FAIL  F1: `*:rank` → D names a Score metric — Scores: D; Lists and Concepts: Not assigned yet
      *:rank → D — lists: want [], got [D]
FAIL  N1: Concepts — `39998` → A, then `39998:dlist-header` → B are one key — Concepts: A (B is a backup)
      39998 → A, 39998:dlist-header → B — concepts: want [A], got [A, B]
FAIL  X2: `*::` is `*`, so it reaches all three cards — C on Scores, Lists and Concepts
      *:: → C — concepts: want [C], got []
```

In the same run, `manage-treasure-map-cards` passed 31/31, `manage-treasure-map-page` 22 with 2 live tests skipped
(no stack), and `stack-free-npm-test` (every suite registered) passed.

**Browser baseline, before any code changes:** the four specs, against the UI built from `b7acdcb` and served on :7799
with every `/api/*` mocked, `57 passed (40.2s)`.

**The tests can all pass:** run against a throwaway prototype of ADR 0001's sub-decisions 1–4 (scratchpad, not
committed), the suite passes 29/29.

**Note, the shallow clone.** An earlier run in this session, `20261007T141651Z-14068-c873`, also failed `harness-lint`.
That came from the container's shallow clone, not this story: lint L10 reads the clone's boundary commit as a harness
change. After `git fetch --unshallow origin` the tree lints clean. Ledger `2026-10-07-shallow-clone-trips-lint-l10`
records it.
