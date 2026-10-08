# Review: Story 1 — The cards' counting rule follows the draft grammar in three edge cases

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-07
**Diff:** `git diff origin/staging...HEAD` (base `547ff7d`, head `c60a3ac`; 9 commits, 11 files). The only source
change is `c60a3ac`, in `ui/src/pages/treasure-map/manageTreasureMap.js`.

## Quality gates (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme1-review npm test`, read with `npm run -s gate:status -- --label tme1-review`:

  ```
  20261007T161005Z-5429-165f [tme1-review] started 2026-10-07T16:10:05.923Z on c60a3ac1 — PASS, exit 0, 4999 passed, 0 failed, 581 skipped, 272/272 suites
  ```

  - The 581 skips are the live-stack suites. There's no Docker stack in this container.
  - `treasure-map-card-rule-edges`: 29 passed, 0 failed.
  - `manage-treasure-map-cards`: 31 passed (K1–K20, C1–C5, W1–W3, S1–S3), unchanged.
  - `manage-treasure-map-page`: 22 passed, 2 live tests skipped. That includes V7 ("the view-model loads in Node — no
    React import, nothing that signs, publishes or stores").
  - `harness-lint` and `stack-free-npm-test` passed.
  - The totals agree with Phase 3's red run (`20261007T142756Z-984-3aa4`: 4982 passed + 17 failed = 4999).
- [x] Browser: the four specs run with
  `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/manage-treasure-map.spec.js
  tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js
  tests/brainstorm/my-assistants-map.spec.js --project=chromium` gave **57 passed (41.9s)**.
  - The bundle was built from the change. `dist/index.html` loads `assets/index-DXypvaed.js`, which carries
    `new Set(["tag","pin","dlist"])` and the `dlist-header` → `39998` fold.
  - `dist/` was built at 15:01:51, a minute before `c60a3ac` was committed (15:02:50), with the same rule code.
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)`. The clone is full
  (`git rev-parse --is-shallow-repository` → `false`).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped. The Vite build was only for the browser run._

## Spec adherence

To re-derive the rows, I loaded the rule twice in a scratchpad script that isn't committed:

- the pre-change module (`git show d14bbcf:…/manageTreasureMap.js`, with only its one relative import made absolute);
- the module at HEAD.

I ran every story row, every test-plan row and about 40 probes of my own through both. The result for each card is
below. "Story" is the card the story asks for, "Old" is the pre-change code and "New" is HEAD.

| Row | Story | Old | New |
|---|---|---|---|
| AC-1.1 `3038x:tag`→B, `*:tag:X`→D | S: B; today Mixed | S: B,D | S: B |
| AC-1.2 `3038x:tag:`→B, `*:tag:X`→D | S: B; today Mixed | S: B,D | S: B |
| AC-1.3 `3038x:tag::T`→B, `*:tag:X:T`→D | S: B; today Mixed | S: B,D | S: B |
| AC-1.4 `3039x:dlist`→B, `*:dlist:X`→D | L: B; today Mixed | L: B,D | L: B |
| AC-1.5 `3038x:tag`→B, `*:tag`→D | S: B; same | S: B | S: B |
| AC-1.6 `3038x:tag:X`→B, `*:tag`→D | S: B,D; same | S: B,D | S: B,D |
| AC-1.7 `3038x:tag:X`→B, `*:tag:Y`→D | S: B,D; same | S: B,D | S: B,D |
| AC-1.8 `30382:rank`→A, `*:rank`→D | S: A,D; same | S: A,D | S: A,D |
| AC-2.1 `*:rank`→D | S: D, L: –, C: –; today S and L | S: D, L: D | S: D, L: –, C: – |
| AC-2.2 `*:contexts`→D | S: –, L: D; today S and L | S: D, L: D | S: –, L: D |
| AC-2.3 `*:pin`→D | S: D, L: D, C: –; same | same | same |
| AC-2.4 `30392`→A, `*:rank`→D | S: D, L: A; today L Mixed | L: A,D | S: D, L: A |
| AC-2.5 `3038x`→B, `*:contexts`→D | S: B, L: D; same | S: B, L: D | S: B, L: D |
| AC-3.1 `39998`→A, `39998:dlist-header`→B | C: A; today Mixed | C: A,B | C: A |
| AC-3.2 the same, reversed | C: B; today Mixed | C: B,A | C: B |
| AC-3.3 `*`→C, `*:`→D | C on all three; today Mixed ×3 | C,D ×3 | C ×3 |
| AC-3.4 `3038x:tag`→B, `3038x:tag:`→D | S: B; today Mixed | S: B,D | S: B |
| AC-3.5 `39998:dog-breed`→A, `39998:dog-breed:`→B | C: A,B; same | C: A,B | C: A,B |

- [x] **Every acceptance criterion has a passing test.**
  - AC-1: H1–H8. AC-2: F1–F5. AC-3: N1–N5.
  - The X rows add the cases from ADR 0001's "For the Tester", and they're all green.
  - AC-4 is held by suites this diff doesn't touch: `git diff origin/staging...HEAD` is empty for
    `test/manage-treasure-map-cards.test.js`, `test/manage-treasure-map-page.test.js` and `tests/`.
  - The page's wiring doesn't change. `Index.jsx:195` still calls `categoryAssistants(event)`, and only
    `manageTreasureMap.js` changed.
- [x] **The story's "Today" columns are accurate.** Every "Today" cell, and every "same", matches the pre-change code
  (table above).
- [x] **The test plan's "Now" column is accurate.**
  - Exactly H1–H4, F1, F2, F4, N1–N4 and X1–X6 fail against `d14bbcf`, 17 in all. That's the count in the Phase-3
    record `20261007T142756Z-984-3aa4`, which `gate:status --label tme1-phase3c` confirms.
  - H5–H8, F3, F5, N5 and X7–X11 pass there.
- [x] **No criterion is silently dropped.**
- [x] **No behaviour is added that isn't in the story.**
  - Every Old→New change in my probes traces to AC-1, AC-2 or AC-3, or to ADR 0001's stated reading of them.
  - Examples: `*:followers` and `*:Contexts` become Scores-only, `30392:` folds into `30392`, and `3039x:contexts`
    covers `*:contexts`.

## ADR adherence

- [x] **Sub-decision 1, `entryOf`** (`manageTreasureMap.js:115–132`).
  - Validity is unchanged (`:116`). The key is still split at the first colon.
  - `concept` is set for `39998` and `39999`.
  - Concept `norm` is the key as written, except `39998:dlist-header` → `39998` (`:125`).
  - For every other key, `segments` drops trailing empties and keeps middle ones (`:127–128`), and `norm` is
    `[slot, ...segments].join(':')` (`:129`).
  - `norm` can't collide. Segments come from `split(':')` and hold no colon. A Concept `norm` always starts `39998`
    or `39999`, and no other slot does.
- [x] **Sub-decision 2, `appliesTo`** (`:139–155`).
  - Kinds and families are unchanged.
  - Bare `*`, `*:` and `*::` reach all three categories (`:149`). A `*:…` key never reaches Concepts (`:150`).
  - `tag`, `pin`, `dlist` and `''` reach Scores and Lists (`:106`, `:152`). `contexts` reaches Lists (`:153`). Any
    other word reaches Scores (`:154`).
  - Words are matched exactly, case and all.
- [x] **Sub-decision 3, `covers` and `shadowed`** (`:158–173`).
  - `covers` is the ADR's one-liner, verbatim.
  - Only `*` entries are ever hidden.
  - For Concepts, `conceptNorms.has('39998')`. That set only runs for bare `*`, since nothing else reaches Concepts.
  - `families` and `conceptNorms` are built once per call from valid-delegate entries (`:185–186`).
- [x] **Sub-decision 4, grouping by `norm`** (`:190–194`).
  - `appliesTo` and `shadowed` read only `slot` and `segments`, so every entry of one `norm` gets the same answer. The
    first in Map order is the key's Assistant, including after a shadowed or invalid first spelling (probed).
  - The output order and the "never throws" behaviour are unchanged. I probed `undefined`, `null`, `5`, `'x'`, `{}`,
    `{tags:'x'}` and mixed garbage tags: each gave three empty lists.
- [x] **Sub-decision 5.** The Status parenthetical and the "Superseded in part" note on manage-treasure-map ADR 0002
  landed in `b7acdcb`, the commit that accepted ADR 0001, as the ADR says. It follows the curated-dlist-update
  precedent, for example `decisions/done/curated-dlist-update/0004-…md:9`.
  - "Sub-decisions 1–2 superseded in part" is accurate. Sub-decision 1's split and validity stand. Sub-decision 2's
    "applies", "shadowed" and "per key" bullets are replaced, and its result and garbage bullets stand.
  - One wording nit in the note is Non-blocking 3.
- [x] **No more than the ADR asks.**
  - The comments the ADR asks for are updated (`:98–100`, `:108–114`, `:175–181`).
  - The export's signature and answer shape are unchanged. No new export, module or dependency.
  - The only import is still `cardFields` from `../assistants/myAssistants.js`.
- [x] **Layering.** The module stays free of React, `fetch`, signing and storage, and loads in Node (V7 is green). The
  new suite and my probe both import it directly.

## Concept-graph integrity

- [x] **Handles:** the story reads kind 10040 and touches no concept handle.
- [x] **Firmware reinstall:** not required, since no concept definition changed. The story and ADR both say so.
- [x] **`/summaries`:** not applicable. The new code adds no concept lookup.

## Things tests can't catch

- [x] **Secrets:** none committed. The fixtures use fake pubkeys (`c1…`, `c2…`, `c3…`, `d1…`), and no TA pubkey
  literal was added.
- [x] **Debug code:** no leftover `console.log` or other debug output.
- [x] **Commented-out code:** none.
- [x] **Edge cases.** Beyond the tables I probed:
  - a real Map's legacy keys: the eleven `30382:<metric>` rows, bare `30392`, `39998:dlist-header` with a backup,
    and `39998:<d>` per-DList entries, all unchanged;
  - the browser spec's main sample, unchanged;
  - two partial families, which still don't cover;
  - a family listed after the `*` entry, which still covers;
  - an uppercase delegate, which still dedups;
  - an uppercase slot (`3038X`), which still reaches no category;
  - `39998:` and `39998:dlist-header:`, which aren't folded, per § 4.5;
  - out-of-grammar keys (`*::rank`, `3038x::rank`), which count as today.

  One draft-grammar case the story doesn't name is still counted wrongly, as it was before (Non-blocking 1).
- [x] **Concurrency:** the rule is pure and synchronous.
- [x] **Security:** no new input surface. Keys are compared as strings and never evaluated.

## House rules check

- [x] **Concept Graph API authority:** respected; nothing here reads concepts.
- [x] **Tooling:** no new lint, typecheck or build tooling.
- [x] **TA pubkey:** not used. No `LEGACY_*` constant is touched.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. This is a no-PRD book, and the words, states and look are unchanged (AC-4, 57/57 browser).

## Findings

### Blocking

None.

### Non-blocking

1. **`manageTreasureMap.js:151–152`. A `*:` key that ends in a metric still counts on Lists. This is old behaviour
   that the story doesn't name.**
   - The draft (§ 4.3) makes a Score key the List key plus `:<metric>`. Under § 6 a key matches an insight only where
     it agrees with every value it names.
   - So `*:tag:<cat>:<Tag>:<metric>`, `*:tag:::confidence`, `*:pin:<cat>:<Pin>:<metric>` and
     `*:dlist:<DList>:<metric>` reach Scores only.
   - The rule still counts them on Lists, because AC-2 (story `:57–61`) decides by the system word alone. Probed: Old
     and New both give S: D, L: D.
   - This isn't a regression, and the code meets the approved AC-2. Edit mode's preview and its "individually
     assigned duties" will reuse this rule, though, so it should be on record before then.
   - Ask: a new `bug` ledger row. The fix would be a `*` key whose segment count is past its system's List layout
     (`tag`/`pin` > 3 segments, `dlist` > 2) reaches Scores only. That could be folded into Edit mode's ADR, which
     already has to export or move the parser.
2. **`engineering-team/epics/treasure-map-edit.md:20`. Story 1 still reads "Not yet written."** The story has been
   written, approved and implemented. Ask: in the close-out commit, name the file (`1-the-card-rule-edge-cases.md`),
   as the manage-treasure-map epic does.
3. **`engineering-team/decisions/done/manage-treasure-map/0002-…md:8–9`. The note says "empty segments at the end
   don't count", but a Concept key keeps its `d` tag as written.** So `39998:dog-breed:` stays distinct (AC-3, N5).
   Optional: add "(except in a Concept key)".
4. **`engineering-team/decisions/treasure-map-edit/0001-…md:35–40`. The Facts' line numbers are off by 6–9.**
   - The ADR gives `~113`, `~124`, `~141` and `~160`.
   - In the pre-change file (`d14bbcf`, the same as `547ff7d`), `entryOf`, `appliesTo`, `shadowed` and
     `categoryAssistants` are at lines 107, 117, 134 and 151.
   - Nothing hangs on them.
5. **ADR 0001 `:84`. "Every segment value an entry doesn't name is open-ended" isn't strictly true for a List's
   system slot.**
   - That slot is a registered vocabulary. Today it's `tag`, `pin`, `dlist` and `contexts` (§ 4.3, § 4.4: it can't
     be empty).
   - So `3039x:tag`, `3039x:pin`, `3039x:dlist` and `3039x:contexts` together leave bare `*` no List insight today,
     but the rule still counts it.
   - No Map has this. A future system word would be `*`'s again (§ 4.3, "a future system registers a word"). No
     change asked.

**Doc accuracy, checked and found true:**

- The book, its decisions and the handoff status line.
- The story's Background, every "Today" cell and its Out of scope.
- ADR 0001's Context, its Facts (callers: `Index.jsx:9` only, `Advanced.jsx` imports only `COPY`; browser fixtures
  at `manage-treasure-map-cards.spec.js:57–59`) and its Consequences.
- The test plan's coverage map, edge cases and Verification. Both run ids exist with the stated counts.
- Ledger `2026-10-07-shallow-clone-trips-lint-l10`:
  - L10 is `git log -1 --no-merges` (`scripts/harness-lint.sh:264`);
  - `aa9b373` is the PR #782 merge of 2026-09-29;
  - run `20261007T141651Z-14068-c873` failed in `harness-lint` and the new suite;
  - lint is clean unshallowed.
  - The row's "50 commits" depth can't be re-checked now that the clone is full.
- Ledger `2026-10-07-treasure-map-card-rule-edge-cases` predates this branch. Its three cases are the story's.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **The template's last section heading reads as the verdict.** Its `## On PASS (same commit)` heading carries a
   verdict token, so it's renamed below, as the brief asked. This is already ledger
   `2026-10-07-on-pass-heading-reads-as-verdict`, so it needs no new row.
2. **The Reviewer's wiring and the brief conflict.** The wiring says to flip the story to Done and commit in the
   review. The brief reserves both for the orchestrator, and I followed the brief. This is already OPEN.md row 316,
   so it needs no new row.

## Verdict

**PASS**

The diff does what ADR 0001's sub-decisions 1–5 say and nothing more. Every story row and test-plan row was
re-derived against the pre-change and new code. The gate, the four browser specs and harness-lint are green on
`c60a3ac`. The five findings above are non-blocking.

## Close-out on a pass

- [ ] Story `**Status:**` flipped to `Done` in place. The orchestrator does this in the review commit.
- [ ] Completion detection performed, by the orchestrator; its result is recorded in the chat, not here.
