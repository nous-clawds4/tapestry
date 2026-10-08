# Review: Story 2 — The cards ignore an everything entry that goes beyond `*`

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-07
**Diff:** `git diff 34477188..HEAD` (base `34477188`, story 1's review; head `c8dbd10`; 7 commits, 15 files). The only
source change is `c8dbd10`, in `ui/src/pages/treasure-map/manageTreasureMap.js`; the same commit adds item 12 to
`protocols/drafts/treasure-maps.md` § 13.

## Quality gates (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme2-review npm test`, read with `npm run -s gate:status -- --label tme2-review`:

  ```
  20261007T222855Z-5393-2553 [tme2-review] started 2026-10-07T22:28:55.035Z on c8dbd10d — PASS, exit 0, 5016 passed, 0 failed, 581 skipped, 273/273 suites
  ```

  - The 581 skips are the live-stack suites. There's no Docker stack in this container.
  - Run alone, the touched suites give: `treasure-map-star-scopes-ignored` 17/17, `treasure-map-card-rule-edges` 29/29,
    `manage-treasure-map-cards` 31/31, and `manage-treasure-map-page` 22/22 (unchanged). These match the plan's counts.
  - The totals agree with Phase 3's red run. `gate:status --label tme2-phase3` gives `20261007T191634Z-9404-7c08`:
    4990 passed + 26 failed = 5016, on 273 suites.
  - That run's JSON lists exactly the plan's "fails" rows:
    - I1–I8, O1, O2 and P1–P3 (13);
    - H6–H8, F1–F5, X3, X6 and X10 (11);
    - K9 and K16 (2).
  - X7 and B1–B4 passed there, as the plan says.
- [x] Browser: the four specs, run with `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test
  tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js
  tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium`, gave
  **57 passed (30.9s)**. That's the same 57 the plan records before any code change.
  - The bundle was built from the change. `dist/index.html` loads `assets/index-l_eGsa9o.js`.
    - It has no `"tag","pin","dlist"` set.
    - Its minified rule is HEAD's `appliesTo` tail (`n==="*"&&s.length===0`) and HEAD's `shadowed`
      (`n.norm!=="*"?!1:s.has(e==="scores"?"3038x":e==="lists"?"3039x":"39998")`).
  - `dist/` was built at 22:00:02, four minutes before `c8dbd10` was committed (22:04:13), with the same rule code
    (Harness friction 3).
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this file existed. The clone
  is full (`git rev-parse --is-shallow-repository` → `false`).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped. The Vite build was only for the browser run._

## Spec adherence

To re-derive the rows, I loaded the rule twice in a scratchpad script that isn't committed:

- the pre-change module, `git show 8ab511d:…/manageTreasureMap.js`. It's byte-identical to `34477188`'s. Its one
  relative import is stubbed, because `categoryAssistants` doesn't use `cardFields`.
- the module at HEAD.

I ran every story row and every test-plan row, the re-aim table's "Was" and "Now expects" cells included, through
both. "Old" is the pre-change code and "New" is HEAD. S, L and C are the three cards, and – is Not assigned yet.

| Row | Story / plan | Old | New |
|---|---|---|---|
| AC-1.1 `*:tag`→D | none; today S, L | S: D, L: D | – – – |
| AC-1.2 `*:rank`→D | none; today S | S: D | – – – |
| AC-1.3 `*:contexts`→D | none; today L | L: D | – – – |
| AC-1.4 `*:tag:X:T:confidence`→D | none; today S, L | S: D, L: D | – – – |
| AC-1.5 `*::rank`→D | none; today S, L | S: D, L: D | – – – |
| AC-1.6 `30382:rank`→A, `*:rank`→D | S: A; today S Mixed | S: A,D | S: A |
| AC-1.7 `30392`→A, `*:tag`→D | L: A; today S: D, L Mixed | S: D, L: A,D | S: –, L: A |
| AC-1.8 `3038x:tag:X`→B, `*:tag`→D | S: B; today S Mixed, L: D | S: B,D, L: D | S: B, L: – |
| AC-2.1–2.4 `*:`, `*::`, `3038x`+`*:`, `*`+`*:` | C ×3; C ×3; S: B, L/C: C; C ×3; all same | same | same |
| AC-3.1 `*:tag`→D, then `*`→C | C ×3; today S, L Mixed (D, C) | S: D,C, L: D,C, C: C | C ×3 |
| AC-3.2 `*:tag`→D, `3038x:tag`→B | S: B only; today L: D | S: B, L: D | S: B, L: – |
| H6 / H7 / H8 | was S: B,D / B,D / A,D; now S: B / B / A | as "was" | as "now" |
| F1 / F2 / F3 | was S / L / S+L: D; now none | as "was" | – – – |
| F4 `30392`→A, `*:rank`→D | was S: D, L: A; now S: –, L: A | as "was" | as "now" |
| F5 `3038x`→B, `*:contexts`→D | was S: B, L: D; now S: B, L: – | as "was" | as "now" |
| X3 / X6 / X10 | was S: B, L: D / S: D / S, L: D; now S: B, L: – / none / none | as "was" | as "now" |
| X7, old Map (`3038x:tag`→invalid, `*:tag:X`→D) | was S: D | S: D | S: – |
| X7, new Map (`3038x:`→invalid, `*`→D) | S: D, both before and after | S: D | S: D |
| K9 `*:tag`→D | was S, L: D; now none | as "was" | – – – |
| K16a–d | was (S: B, L: D), (S: B, L: D), (S: B,D, L: D), (L: B, S: D); now the family entry only | as "was" | as "now" |

- [x] **Every acceptance criterion has a passing test.**
  - AC-1: I1–I8. AC-2: B1–B4. AC-3: O1–O2. AC-5: P1–P3.
  - AC-4 is held by the re-aimed tests, every other test in both older suites, the page suite and the four browser
    specs.
  - I also ran every example in the AC-4 tables (story 1's AC-3 and manage-treasure-map #2's AC-2) through both
    rules. All are unchanged except "`*:tag` → D, nothing else", the one row the story names.
- [x] **The story's "Today" columns and the plan's "Was"/"Now" columns are accurate** (table above). Every "same"
  matches.
- [x] **X7's new Map is justified, and its intent holds.**
  - Under the new rule, the old Map gives S: – whatever the family entry's delegate is. Re-aiming only the answer would
    have pinned nothing about validity.
  - The new Map does discriminate. With a valid delegate, `3038x:` → B hides `*` → D on Scores (probed: S: B). With an
    invalid one, it hides nothing (S: D). The new Map also exercises the `3038x:` fold.
- [x] **No assertion was weakened.** Each re-aimed test compares the same cards it compared before. H6–H8 and X7 check
  Scores. X3 and K16 check Scores and Lists. F1–F5, X6, X10 and K9 check all three. Only the expected lists changed,
  and only on the tests the ADR's "For the Tester" names. `git show 8ab511d --stat` shows Phase 4 (`c8dbd10`) touched
  no test.
- [x] **No criterion is silently dropped.**
- [x] **No behaviour is added that isn't in the story.** I fuzzed 50,000 random Maps. The keys were bare and scoped
  `*`, family keys with and without folds, exact kinds, Concept keys with and without folds, `99999`, `3038X` and
  empty keys. The delegates were valid, uppercase, invalid or non-string. On every Map, HEAD's answer equals the
  pre-change rule's answer on the same Map with every `*` entry that names anything after the `*` deleted: 0
  mismatches. So the only change is that such entries stop counting. That is AC-1 and AC-3 in general, and AC-2 and
  AC-4 follow.

## ADR adherence

- [x] **Sub-decision 1, `appliesTo`** (`manageTreasureMap.js:138–148`).
  - Five-digit kinds, `3038x` and `3039x` are untouched (`:139–146`).
  - The `*` case is `slot === '*' && segments.length === 0` (`:147`), the ADR's implementation note verbatim.
  - `BOTH_FAMILIES` and the system-word branch are gone. `grep` finds no `BOTH_FAMILIES`, `covers`, `families` or
    `conceptNorms` anywhere in the module or in any JS in the repo.
- [x] **Sub-decision 2, `shadowed`** (`:156–159`).
  - It returns false unless `entry.norm === '*'`. Then it checks `norms.has('3038x' | '3039x' | '39998')` by category.
  - `norms` is one `Set` of every valid entry's `norm` (`:172`), as the ADR asks.
  - This is equivalent to the old code for a bare `*`. With trailing empty segments trimmed, `covers(F, bare *)` held
    only for a family entry with no segments, whose `norm` is `3038x` or `3039x`.
  - No non-Concept entry can have `norm` `39998`, because its slot would have to be `39998`. So the wider set doesn't
    change the Concepts check.
- [x] **Sub-decision 3, unchanged.** `entryOf` (`:114–131`), grouping by `norm`, first valid delegate per key, Map order
  without repeats, three empty lists for garbage and never throwing are all unchanged.
  - I probed `null`, `undefined`, `5`, `'x'`, `{}`, `{tags: null}` and mixed garbage tags: each gave three empty lists.
  - An ignored entry listed first never takes a key's place. `appliesTo` fails before `seenKeys.add` (`:177`), so O1
    and the fuzz hold.
- [x] **Sub-decision 4, the draft's item 12.** It's the ADR's text verbatim. AC-5 is checked under "Doc accuracy"
  below.
- [x] **Sub-decision 5, pointers.** All three landed in `e979b69`, the commit that accepted the ADR:
  - ADR 0001: a Status parenthetical and a "Superseded in part" note;
  - manage-treasure-map ADR 0002: its Status line and one added sentence;
  - story 1: a "Replaced in part" note.
- [x] **Comments.** The section comment (`:97–101`) and the JSDoc of `appliesTo` (`:133–137`), `shadowed`
  (`:150–155`) and `categoryAssistants` (`:161–168`) cite ADR 0002, and the first two cite book decision 11. One
  wording nit is Non-blocking 1.
- [x] **Layering.** The module is still free of React, `fetch`, signing and storage. Its only import is still
  `cardFields` from `../assistants/myAssistants.js`, and it loads in Node: the suites and my probe import it directly.
  `categoryAssistants` is still imported only by `ui/src/pages/treasure-map/Index.jsx:9`.
- [x] **No new dependency, export or module.** The ADR's Facts line numbers (106, 115, 139, 158, 168) are exact for
  `34477188`.

## Concept-graph integrity

- [x] **Handles:** the story reads kind 10040 and touches no concept handle.
- [x] **Firmware reinstall:** not required, since no concept definition changed. The story and ADR both say so.
- [x] **`/summaries`:** not applicable. The new code adds no concept lookup.

## Things tests can't catch

- [x] **Secrets:** none committed. The fixtures use fake pubkeys (`c1…`, `c2…`, `c3…`, `d1…`), and no TA pubkey
  literal was added.
- [x] **Debug code:** none. The only `console.log` lines are the new suite's reporter, the same pattern as every Node
  suite.
- [x] **Commented-out code:** none.
- [x] **Edge cases and real Maps.** Old and New agree on:
  - a Map the app writes today: the eleven `30382:<metric>` rows from `src/lib/treasureMapMerge.js`, bare `30392`,
    `39998:dlist-header` and `39998:<d>` per-DList entries;
  - the same Map with a bare `*`, and with a leading `*:`;
  - every fixture Map in the four browser specs (`MAIN`, `EVERYTHING`, `FOUR`, manage-treasure-map's `MAP` and its
    long-key variant, my-assistants-map's `MAP`).

  Only the Map with an added `*:tag` changes. Nothing in `src/` or `ui/src/` writes a `*` key (`grep`), as the story's
  Background says.
  - `*:` and `*::` still behave as bare `*`, including the one-key fold with `*` (B4, N3), and they're still hidden by
    `3038x` (B3).
  - `*: ` (a space) and `*:*` name something after the `*`, so they're ignored. That's consistent with AC-1.
  - The ledger row this story settles (`2026-10-07-card-rule-star-metric-reaches-lists`) lists four keys:
    `*:tag:X:T:confidence`, `*:tag:::confidence`, `*:dlist:L:rank` and `*:pin:X:P:rank`. All four now reach no
    category.
- [x] **Concurrency:** the rule is pure and synchronous.
- [x] **Security:** no new input surface. Keys are compared as strings and never evaluated.

## House rules check

- [x] **Concept Graph API authority:** respected; nothing here reads concepts.
- [x] **Tooling:** no new lint, typecheck or build tooling.
- [x] **TA pubkey:** not used. No `LEGACY_*` constant is touched.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. This is a no-PRD book. The words, states and look are unchanged (AC-4, 57/57 browser). The spec
  diff is two comments (`manage-treasure-map-cards.spec.js:19`, `:55–56`).

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/treasure-map/manageTreasureMap.js:163–164`. `categoryAssistants`' JSDoc says "a `*:…` entry never
   counts", without the qualifier.**
   - `*:` and `*::` do count: they're a bare `*` (AC-2).
   - The section comment (`:100`) and `appliesTo`'s JSDoc (`:135–136`) both say "that names anything after the `*`".
   - Its "a `*` entry that a more specific entry covers completely" also now means only a bare `*`.
   - Optional: "a bare `*` that a more specific entry covers doesn't count, and a `*:…` entry that names anything after
     the `*` never counts".
2. **`protocols/drafts/treasure-maps.md:531` (§ 13 item 12). Two places are less precise than they could be.** Both are
   in the owner-accepted wording of ADR 0002 sub-decision 4, and neither is false.
   - **"A `*:…` key never reaches a Concept (§ 4.5)" is a fair generalisation, but § 4.5 states it only for `*:tag` and
     `*:dlist`.**
     - The general claim also rests on § 4.3: a Score or List key's segment 2 is a system word or, for Scores only, a
       metric.
     - It also rests on § 4.5 defining a Concept key only as `39998:<d-tag>` or `39999:<d-tag>`.
     - The draft never says whether `*:<x>` could be read as a `d` tag. That residual ambiguity sits fairly inside an
       open question.
   - **"the precedence cases between a family key and a `*` key with the same scope (§ 6)" understates what dropping
     `*:<scope>` removes.**
     - It removes every case between a family key and a scoped `*` key.
     - That includes § 6's own example, `3039x:tag` against `*:tag:⟨…⟩:⟨Mexican⟩`, whose scopes differ.
   - Optional, when the question is next discussed: cite "§ 4.3, § 4.5", and drop "with the same scope".
   - Its last sentence describes this app's UI. That's non-normative context, which the boundary rule allows with
     precedent (§ 10.3's "Tapestry's existing generic entry", the § 12 migration table). It goes stale when `appliesTo`
     changes; the trail is `appliesTo` → ADR 0002 → item 12.
3. **`test/treasure-map-card-rule-edges.test.js:84–93` (H1–H5). The names still say a family entry "covers" the `*:…`
   entry.**
   - That entry is now ignored, not covered.
   - Their assertions are still true (re-derived above) and unchanged.
   - The H class header (`:13–14`) now says "counts nowhere, covered or not".
   - They aren't on the ADR's re-aim list because they pass either way. They now pin nothing the I class doesn't.
   - The header's "AC-4 … unchanged: manage-treasure-map-cards (K1–K20 …)" (`:19–20`) is story 1's history now that K9
     and K16 changed.
   - Optional, for Edit mode's Tester: rename H1–H5, or fold them into the I class.
4. **`engineering-team/epics/treasure-map-edit.md:21–22`. Item 2 doesn't name its story file, and it calls the story a
   "change" where the story's Type is Bug.**
   - Story 1's review raised the same naming nit (its Non-blocking 2).
   - Ask, at close-out: name `2-the-cards-ignore-scoped-star-entries.md` and add "Done.". The same commit should flip
     ledger `2026-10-07-card-rule-star-metric-reaches-lists` to DONE (ADR 0002 § Consequences) and fill in the story's
     "Review:" link.

**Doc accuracy, checked and found true:**

- **Book decision 11** (`engineering-team/audits/treasure-map-edit/book.md:99–115`).
  - It matches the story's AC-1 to AC-3 and its Out of scope ("ignored" means never counted and never removed; `*:`
    and `*::` are `*`).
  - It matches the epic's new guardrail and ADR 0002's Consequences.
  - I can't check the two owner quotes against a transcript. They're consistent with every artifact that cites them.
- **ADR 0001's "Superseded in part" note** (`:8–10`).
  - The system-word branch of sub-decision 2 is gone, including its `''` case (X10). That's sub-decision 2's
    `*`-with-segments half.
  - Sub-decision 3's `covers` is gone.
  - "Hidden only by a bare family entry or `39998`" is HEAD's `shadowed`.
- **manage-treasure-map ADR 0002's added sentence** (`:9–10`): only a bare `*` (or `*:`) counts. That's true (`*::`
  too).
- **Story 1's "Replaced in part" note** (`:9–10`).
  - Every row in its AC-1 and AC-2 tables names a `*:` key with something after the `*`. None is a bare `*:`, so "such
    an entry counts on no card" is true of each.
  - Its AC-3 rows are unaffected (re-derived).
- **Draft scope.** `git diff 34477188..HEAD -- protocols/` and `git diff origin/staging...HEAD --
  protocols/drafts/treasure-maps.md` are each one added line, item 12. Items 1–11 and the grammar are untouched. AC-5's
  last sentence holds.
- **Story 2's Background.** The ledger row and story 1's finding 1 are as described. Nothing writes a `*:…` key. A
  `*:…` key never reaches Concepts in either rule.
- **ADR 0002's Facts.** The line numbers are exact. The only importer is `Index.jsx:9`. The prototype's list of changed
  tests is exactly the 13 re-aimed tests that went red in Phase 3.
- **The test plan.**
  - The coverage map, the re-aim table and the X7 note are accurate.
  - The spec comment lines (19, 55–56) are the ones the diff changes.
  - The registry entry sits after `treasure-map-card-rule-edges.test.js`.
  - The Verification run id exists with the stated counts and failing tests.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **The template's last section heading reads as the verdict.** Its `## On PASS (same commit)` heading carries a
   verdict token, so it's renamed below, as the brief asked. This is already ledger
   `2026-10-07-on-pass-heading-reads-as-verdict` (OPEN), so it needs no new row.
2. **The Reviewer's wiring and the brief conflict.** The wiring says to flip the story to Done and commit in the
   review. The brief reserves both for the orchestrator, and I followed the brief. This is already OPEN.md row 316, so
   it needs no new row.
3. **The browser gate's `dist/` has no build provenance.**
   - Twice in this epic the bundle was built from the working tree minutes before the implementation commit: story 1
     at 15:01:51 against 15:02:50, and this story at 22:00:02 against 22:04:13.
   - The only way to tie the 57/57 to the reviewed code is to grep minified output for the rule's shape.
   - A stamp written by the build (the commit hash plus a dirty flag, in `dist/`) would make that link checkable.
   - No existing row covers this. OPEN.md rows 124, 226 and 253 are about the container's bind mount and `docker cp`,
     not provenance. It would be a new `meta` row.

## Verdict

**PASS**

The diff does what ADR 0002's sub-decisions 1–5 say and nothing more. A 50,000-Map differential fuzz shows the only
change is that a `*` entry naming anything after the `*` stops counting. I re-derived every story row, every plan row
and every re-aim cell against the pre-change and new code. The gate, the four browser specs and harness-lint are green
on `c8dbd10`. The four findings above are non-blocking.

## Close-out on a pass

- [ ] Story `**Status:**` flipped to `Done` in place. The orchestrator does this in the review commit.
- [ ] Completion detection performed, by the orchestrator; its result is recorded in the chat, not here.
