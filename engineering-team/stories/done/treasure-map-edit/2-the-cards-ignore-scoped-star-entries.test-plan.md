# Test Plan: Story 2 — The cards ignore an everything entry that goes beyond `*`

**Story:** `engineering-team/stories/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md`
**ADR:** `engineering-team/decisions/done/treasure-map-edit/0002-only-a-bare-star-counts.md`
**Date:** 2026-10-07

## Coverage map

The new tests are in one new Node suite, `test/treasure-map-star-scopes-ignored.test.js`, registered in
`test/registry.js` after `treasure-map-card-rule-edges.test.js`. The I, B and O classes run `categoryAssistants(event)`
from `ui/src/pages/treasure-map/manageTreasureMap.js` over a Map whose entries are in the order shown. The P class reads
`protocols/drafts/treasure-maps.md`. Every test compares all three cards; `[]` is Not assigned yet.

"Now" says how the test runs against the code and draft before this story: **fails** (the story's change) or
**passes** (a pin on what must not move).

| Criterion | Test | Story row | Now |
|---|---|---|---|
| AC-1 | I1: `*:tag` → D — none | AC-1 row 1 | fails |
| AC-1 | I2: `*:rank` → D — none | row 2 | fails |
| AC-1 | I3: `*:contexts` → D — none | row 3 | fails |
| AC-1 | I4: `*:tag:<X>:<T>:confidence` → D — none | row 4 | fails |
| AC-1 | I5: `*::rank` → D — none | row 5 | fails |
| AC-1 | I6: `30382:rank` → A, `*:rank` → D — Scores: A | row 6 | fails |
| AC-1 | I7: `30392` → A, `*:tag` → D — Lists: A, nothing else | row 7 | fails |
| AC-1 | I8: `3038x:tag:<X>` → B, `*:tag` → D — Scores: B, nothing else | row 8 | fails |
| AC-2 | B1: `*:` → C — C on all three | AC-2 row 1 | passes |
| AC-2 | B2: `*::` → C — C on all three | row 2 | passes |
| AC-2 | B3: `3038x` → B, `*:` → C — Scores: B; Lists, Concepts: C | row 3 | passes |
| AC-2 | B4: `*` → C, then `*:` → D — C on all three | row 4 | passes |
| AC-3 | O1: `*:tag` → D, then `*` → C — C on all three | AC-3 row 1 | fails |
| AC-3 | O2: `*:tag` → D, `3038x:tag` → B — Scores: B, nothing else | row 2 | fails |
| AC-5 | P1: § 13 names `*:<scope>`, `3038x:<scope>` and `3039x:<scope>` | AC-5 | fails |
| AC-5 | P2: § 13 says Brainstorm reads only a bare `*` | AC-5 | fails |
| AC-5 | P3: § 13 still has items 1–11, plus a 12th | AC-5 | fails |
| AC-4 | the re-aimed tests below, and every other test in their suites (unchanged) | AC-4 | see below |
| AC-4 | `test/manage-treasure-map-page.test.js` (unchanged) | AC-4: words, states, nothing signed | passes |
| AC-4 | the four browser specs (unchanged apart from two comments) | AC-4: what a viewer sees | passes |

**AC-5's last sentence** ("the draft's grammar and rules don't otherwise change") isn't a Node test. A test would have
to compare the draft with a git revision, which fails in shallow clones (ledger `2026-10-07-shallow-clone-trips-lint-l10`).
The Reviewer checks it from the diff: `git diff origin/staging...HEAD -- protocols/drafts/treasure-maps.md` should add
item 12 to § 13 and change nothing else.

### Re-aimed tests (ADR 0002, "For the Tester")

Story 1's and the last book's suites pinned the counting this story changes. Each re-aimed test keeps its ID, says
"(story 2)" or "(treasure-map-edit #2)" in its name, and now expects the story-2 behaviour. The suite headers say so.

| Suite | Test | Map | Was | Now expects | Now |
|---|---|---|---|---|---|
| `treasure-map-card-rule-edges` | H6 | `3038x:tag:<X>` → B, `*:tag` → D | Scores: B, D | Scores: B | fails |
| | H7 | `3038x:tag:<X>` → B, `*:tag:<Y>` → D | Scores: B, D | Scores: B | fails |
| | H8 | `30382:rank` → A, `*:rank` → D | Scores: A, D | Scores: A | fails |
| | F1 | `*:rank` → D | Scores: D | none | fails |
| | F2 | `*:contexts` → D | Lists: D | none | fails |
| | F3 | `*:pin` → D | Scores, Lists: D | none | fails |
| | F4 | `30392` → A, `*:rank` → D | Scores: D; Lists: A | Scores: none; Lists: A | fails |
| | F5 | `3038x` → B, `*:contexts` → D | Scores: B; Lists: D | Scores: B; Lists: none | fails |
| | X3 | `3038x:tag` → B, `*:tag:` → D | Scores: B; Lists: D | Scores: B; Lists: none | fails |
| | X6 | `*:Tag` → D | Scores: D | none | fails |
| | X7 | was `3038x:tag` → (invalid), `*:tag:<X>` → D; now `3038x:` → (invalid), `*` → D | Scores: D | Scores: D | passes |
| | X10 | `*::rank` → D | Scores, Lists: D | none | fails |
| `manage-treasure-map-cards` | K9 | `*:tag` → D | Scores, Lists: D | none | fails |
| | K16a | `3038x:tag` → B, `*:tag` → D | Scores: B; Lists: D | Scores: B; Lists: none | fails |
| | K16b | `3038x` → B, `*:tag` → D | Scores: B; Lists: D | Scores: B; Lists: none | fails |
| | K16c | `3038x:dlist` → B, `*:tag` → D | Scores: B, D; Lists: D | Scores: B; Lists: none | fails |
| | K16d | `3039x:tag` → B, `*:tag` → D | Lists: B; Scores: D | Lists: B; Scores: none | fails |

**X7 changes its Map, not just its answer.** Its point was "a family entry with no valid Assistant hides nothing". With
`*:tag:<X>` now ignored anyway, the old Map can't show that. The new Map keeps the point with a bare `*`, and adds a
fold (`3038x:` is `3038x`). The rule already handles it, so it passes now and pins it.

**Browser:** `tests/brainstorm/manage-treasure-map-cards.spec.js` changes two comments only: the class note at line 19
and the note above `MAIN`, lines 55–56. Both said `*:tag` → D is "covered" or "never reaches Concepts"; now it counts on
no card. `MAIN`'s cards don't change: `*:tag` was hidden on Scores by `3038x` and on Lists by `3039x:tag` before, and is
ignored now.

## Edge cases

- [x] Finding 1's case, a `*:` key ending in a metric (I4).
- [x] An empty slot followed by more is not "nothing after the `*`" (I5, X10).
- [x] Only empty slots is still `*`, including as one key with `*` (B1–B4).
- [x] An ignored entry listed first doesn't become the key `*` (O1).
- [x] An ignored entry beside a family entry: only the family entry counts (O2, K16a–d).
- [x] Validity still gates hiding, with the fold (X7).
- [ ] No event, no tags, garbage: pinned by K20; not repeated.

## Test infrastructure
- Test framework: Node built-in runner (`npm test`, registry `test/registry.js`). Read the run's result with
  `npm run -s gate:status`.
- Concept Graph API: not used; no live suite added. The stack isn't running in this session.
- Firmware state: none.
- Fixtures: inline Maps of `[key, pubkey, relay]` tags with fixture pubkeys; `naddr1x`, `naddr1y` and `naddr1t` stand
  in for categories and a Tag. P reads the repo's own draft.
- Browser: the four manage-treasure-map and my-assistants specs, against the built UI on :7799 with every `/api/*`
  mocked (the handoff's recipe, `docs/TREASURE_MAP_EDIT_HANDOFF.md` § 6).

## How to run

```
npm test
npm run -s gate:status
```

The three Node suites this story touches, alone:
```
for t in treasure-map-star-scopes-ignored treasure-map-card-rule-edges manage-treasure-map-cards; do node -e "require('./test/$t.test.js').run()"; done
```

Browser (built UI served on :7799):
```
BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new and re-aimed tests fail with the current code and draft. Confirmed on 2026-10-07 at commit `e979b69` (plus
this phase's uncommitted test, plan and comment changes), full git history:

```
20261007T191634Z-9404-7c08 [tme2-phase3] started 2026-10-07T19:16:34.184Z on e979b69a+dirty — FAIL, exit 1, 4990 passed, 26 failed, 581 skipped, 273/273 suites; failed: manage-treasure-map-cards, treasure-map-card-rule-edges, treasure-map-star-scopes-ignored
```

The 26 failures are exactly the "fails" rows above: 13 in the new suite, 11 re-aimed in `treasure-map-card-rule-edges`
and 2 (K9, K16) in `manage-treasure-map-cards`. Each fails on the card it shows, not on a load error. For example:

```
FAIL  I4: `*:tag:<X>:<T>:confidence` → D (the review’s finding 1) — Not assigned yet on all three cards
      *:tag:naddr1x:naddr1t:confidence → D — scores: want [], got [D]; lists: want [], got [D]
FAIL  O1: `*:tag` → D, then `*` → C — C on all three cards (D is neither counted nor the key `*`)
      *:tag → D, * → C — scores: want [C], got [D, C]; lists: want [C], got [D, C]
FAIL  P3: the question is a new numbered item after the eleven already there (items 1–11 stay)
      protocols/drafts/treasure-maps.md § 13 items: want 1–12, found [1,2,3,4,5,6,7,8,9,10,11]
```

Every other suite in the run passed, including `manage-treasure-map-page` and `stack-free-npm-test` (every suite
registered). The B rows and the re-aimed X7 pass now, as pins.

**The tests can all pass:** against a throwaway prototype of ADR 0002's sub-decisions 1–3 and a copy of the draft with
the ADR's item 12 (scratchpad, not committed), the three suites pass 17/17, 29/29 and 31/31.

**Browser, before any code change:** the four specs, against the UI built from story 1's code (`c60a3ac`) and served on
:7799 with every `/api/*` mocked, after this phase's comment edits: `57 passed (34.0s)`.
