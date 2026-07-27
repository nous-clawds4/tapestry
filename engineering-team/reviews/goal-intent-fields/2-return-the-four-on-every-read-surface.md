# Review: Story 2 — Return the four on every read surface that shows a goal

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-27
**Diff:** `git diff e288539b..c7b11d56 -- src/` (implementation commit `c7b11d56`)
**Story:** `engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.md`
**ADR:** `engineering-team/decisions/goal-intent-fields/0002-read-side-intent-projection-absence-as-null.md`
**Test plan:** `engineering-team/stories/goal-intent-fields/2-return-the-four-on-every-read-surface.test-plan.md`
**Book / frame:** `engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md`

**Files in scope (3):** `src/lib/brain/goals.js`, `src/api/brain/index.js`, `src/lib/brain/direction.js`.
The commit also carries six evidence logs, the journal, and the story's own `## Deviations` block —
none of which are code.

---

## Quality gates (run by the Reviewer, not trusted)

### `npm test` — **PASS**

Run by me, this session, on `c7b11d56` with the stack up. Per OPEN.md #103/#105/#111, the
background-completion notification's exit code is not evidence and the ledger's own
`EXIT=${PIPESTATUS[0]}` mitigation is bash (this shell is zsh). I used the brace form and read the
`Overall:` line and the echoed code out of the log file itself:

```
{ npm test; echo "EXIT=$?"; } > <scratch>/npm-test.log 2>&1
```

```
store-the-four suite:                            PASS (40 passed, 0 failed)
store-the-four H-class:                          11 executed / 0 skipped
return-the-four suite:                           PASS (54 passed, 0 failed)
return-the-four H-class:                         8 executed / 0 skipped
Total skipped:                                   51
Overall:                                         PASS
EXIT=0
```

Three independent corroborations, because a single green line is not evidence in this repo:

1. **Zero test-level failures in the whole 3,724-line log.** `grep -c "^  FAIL "` → `0`. The only two
   lines in the run containing the string `FAIL` are a *test name* (`… FAILS OPEN …`, log:1507) and a
   harness-lint fixture (log:2074) — neither is a failure.
2. **The live class actually ran** — `return-the-four: H-class 8 executed / 0 skipped`, so this is not
   the false green OPEN.md #104/#106 describes. H1 printed the live census against the real corpus:
   `{"total":31,"storedFalse":7,"neverSetAnything":23,"multiLinePrompt":1,"partialSubset":7,"ratified":1}`.
   The discrimination this epic turns on is exercised against 31 real goals, not 2 fixtures.
3. **Every suite the ADR named as "must stay green" is green**, including the closed book's:
   `operational-direction PASS (86/0)` with `U25`, `U26`, `U28` individually confirmed in the log;
   `the-proposal-loop PASS (33/0)` (H2/S11); `capture-a-goal-and-see-it PASS (27/0)` (S1);
   `sessions-read-the-brain PASS (30/0)`; `the-brain-survives PASS (31/0)`; `structures-the-brain-can-trust PASS (24/0)`;
   `harness-lint PASS (32/0)`; `stack-free-npm-test PASS (7/0)`.

**The story-1 re-pin is green:** `store-the-four` `R1 (scope): parseGoalRow projects exactly its
fourteen fields` — PASS (log:3429). Its siblings `R2`/`R3` also PASS, so the Direction workaround and
the write-module require allow-list are intact.

**The known environmental brackets did not fire this run.** OPEN.md row 75's global strfry
scan-count assertions both passed: `relationship-primitives PASS (23/0)` and
`relationship-primitives-probe PASS (9/0)`. Nothing to distinguish — recorded because a *green* here
is a third corroboration that row 75 is environmental (the Director's journal notes the same two ran
green at Gate 3 while the test plan's older pasted block shows `-probe` H4 red).

### `npm run test:playwright` — **not applicable** (with evidence, not assumption)

The diff contains no `ui/` file (`git diff --name-only` confirms three `src/` files and no others).
I checked whether an additive JSON key could still change a screen: the three consumers
(`ui/src/hooks/useBrainGoals.js`, `useBrainProposals.js`, `useBrainGoalDetail.js`) and the three
screens (`pages/brain/Goals.jsx`, `Proposals.jsx`, `GoalDetail.jsx`) contain **no** `Object.keys` /
`Object.entries` generic key rendering — every field is named explicitly. The four are therefore
invisible on the owner's screens today, which is exactly what the ceiling ("no new screen is built")
and story 3's scope require.

### Lint / typecheck / build — *not configured in this project; skipped.* No new tooling was added.

---

## Independent verification (my own probe, not the story's tests)

The Reviewer's job is not to re-run the Implementer's suite. I wrote my own driver that loads the
**real** handlers from `src/api/brain/index.js` with `runCypher` / `getOwnerAssistantPubkey` /
`isOwner` stubbed, over my own corpus (a goal storing `prompt` multi-line + `chanceOfSuccess: 0` +
`needsHumanInput: false` + `needsBreakdown: true`, a goal that never set anything, and a parent), and
read the raw response objects. Results:

| Surface | Observed keys / behaviour |
|---|---|
| goals list | `[… ,"pointerCount","prompt","chanceOfSuccess","needsHumanInput","needsBreakdown"]`; prompt byte-identical incl. tabs and trailing-space lines; stored `0` reads `0`; stored `false` reads `false`; never-set reads `null` on all four |
| goal detail | same four appended; `parentSlug`/`parentName` unchanged (`"p"`/`"P"`) |
| orient `served` | four present |
| orient `roots` | **exactly** `["slug","name","standing"]` — gained nothing |
| orient `ancestry` | **exactly** `["slug","name"]` — gained nothing |
| proposal card | four present, `goalName` unchanged |
| proposal `passedOver` | **exactly** `["goal","goalName","whyNot"]` — gained nothing |
| Direction `terms` | `{ask, successCriteria, ceiling, estimate, estimateSource, prompt, needsHumanInput, needsBreakdown}`; no `chanceOfSuccess` key |
| Direction `chain` | **exactly** `["slug","uuid"]` per entry; no prompt text anywhere in it |
| Direction `boundaryReview.steps` | **exactly** `["parentBoundary","childBoundary"]` on a genuine 2-goal chain with `boundary-unjudged`; no field name of the four, and no prompt text, appears anywhere in a blinded step |
| export, stored goal | all four present, prompt byte-identical |
| export, never-set goal | keys are `["name","slug","description","capturedOn","deliverable","boundary"]` — **the four are omitted, not nulled** |

**On the four things you asked me to judge for myself:**

**1. The discrimination, including through export/restore.** It holds, and I confirmed the
round-trip specifically because that is where a fabricated default would be *destructive* rather than
merely wrong. `projectIntentFields` (`goals.js:337-344`) is `!= null ? … : null` — a stored `0`,
`false` or `''` comes back as itself; only never-set reads `null`. On the same list response, a goal
storing `needsHumanInput: false` and a goal that never set it read `false` vs `null`. The export path
is untouched (`src/lib/brain/export.js` is not in the diff), and `familyEntries` (`export.js:47-58`)
uses `parseRow(row) == null` **only as a validity filter** and then re-parses `row.json` to emit the
raw section — so the parser gaining four keys cannot reach the artifact. I serialized the never-set
goal's exported section and confirmed a restore of it would write **none** of the four back.

I also chased the write side, which the ADR asserted but did not prove file-by-file. All seven
`fetchGoalRecords` consumers (`normalize/index.js:2228, 2344, 2558, 2862, 2945, 3200, 4811`) use the
parsed record only for `slug`/`name`/`uuid`/`hasChildren`/`deliverable`/`boundary` lookups.
`updateGoalIntent` (`:2340-2387`) is the dangerous one and is safe: it re-parses `row.json` and
mutates the **raw section**, using the parsed record only for `.uuid`/`.slug`. `restoreBrain`
(`:5016`) passes parsed records to `planRestore` for collision detection only; every `mint.section`
comes from the **artifact**. `hygiene.js` has no `Object.keys`/`Object.entries` anywhere and uses
`parseRecord` as a null-check — a wider record is inert there. **No path writes the new `null`s into
storage.**

**2. U25 / the estimate derivation byte-unchanged.** Verified, not taken on faith. The
`src/lib/brain/direction.js` hunk is `@@ -142,6 +142,18 @@` with **zero deletion lines** — nothing
was removed or reflowed. `parseEstimate` (`:118-130`), `UNAVAILABLE`, `boundarySteps`, `identify`,
`blindSteps`, `resolveAnchor` are untouched, and `handleGetDirection`'s call
`deriveTerms(target, parseEstimate(rowByUuid.get(target.uuid)))` is not in the diff at all.
`deriveTerms` reads `g.statement/g.deliverable/g.boundary/g.prompt/g.needsHumanInput/g.needsBreakdown`
and **never** `g.chanceOfSuccess`, so the record now carrying that field changes nothing. My probe
drove a never-set goal through the live handler and got `estimate: null, estimateSource: "absent"`;
`operational-direction` `U25` passes in my run (log:3326).

**3. Surfaces that must have gained nothing.** All five confirmed by reading the actual response
objects (table above), not by grepping source. The blinding check is the one I insisted on doing
properly: the story's own D13 and my first probe both produced a *length-1* chain (the goal was its
own anchor), which would have made the assertion vacuous. I rebuilt the fixture so only the parent is
ratified, got a real 2-goal chain with `refusal: "boundary-unjudged"` and one step, and confirmed the
step is exactly the two boundary strings with no goal content and no prompt text. The blinding
contract is intact.

**4. Is a comment sufficient for `direction.js`'s hand-maintained three?** — see Non-blocking #1.
Short answer: sufficient *here*, but it is not the right long-run instrument.

**5. The two Deviations** — see below. Both hold.

---

## Spec adherence

- [x] **AC1 — all four, on each surface.** Five projecting surfaces confirmed by direct response
      inspection; verbatim surfaces confirmed unchanged (export section carries all four as stored).
- [x] **AC2 — the prompt comes back whole.** Byte-identical on the **list** surface (the one AC2
      calls out), the detail, orient `served`, the proposal card and `terms`. My fixture prompt has a
      blank first line, an indented fenced block with trailing spaces inside it, a tab, and a
      trailing whitespace line — none of it is trimmed, reflowed or re-escaped. Live H3 checks the
      real 6,155-char prompt on the real corpus.
- [x] **AC3 — nothing is invented.** `null` reports; it never substitutes. None of the three
      forbidden values (`0`, `false`, `''`) appears for a never-set property on any surface. Both
      shipped "not set" contracts are preserved by *not touching their code*: Direction keeps
      `null` + `'absent'`, the export keeps omitting the key.
- [x] **AC4 — nothing acts on them.** No sort, filter, cap, gate, tie-break or refusal was edited.
      `sortGoals`, `deriveStanding`, `resolveDecomposition`, `slugIndex`, `validateDecompositionOp`,
      `openProposals`, `resolveAnchor`, the roots `.filter().slice()` and `ORIENT_ROOT_CAP` are all
      absent from the diff. D16 drives the differential (strip the four → identical set and order on
      list, orient and proposals); D17 pins that a 99 estimate does not outrank a 1.
- [x] No criterion silently dropped; no behaviour added beyond the story.
- [x] **Ceiling respected.** "Storing and showing only" — no rule keys off the four; no screen was
      built or changed (zero `ui/` files); nothing acts on the estimate or the flags.

## ADR adherence

Every sub-decision checked against the code:

| ADR | Verdict |
|---|---|
| d1 `parseGoalRow` gains the four from `INTENT_FIELDS`, appended after `parent`, verbatim, `null` when absent | ✅ `goals.js:54-64`; R1 pins the exact 14-key order and passes |
| d2 `projectIntentFields`, pure, non-mutating, four keys always, next to `pickIntentFields`, asymmetry comment | ✅ `goals.js:311-344`; the comment states the record-vs-response asymmetry and why collapsing it is a regression |
| d3 `null` satisfies AC3 | ✅ verified end-to-end |
| d4 the four surfaces splice the projection | ✅ `index.js:244, 385, 454, 512` |
| d5 Direction gains three, named literally with a comment; estimate byte-unchanged | ✅ `direction.js:145-156`; zero deletions in that file |
| d6 `roots`, `ancestry`, `parentSlug`/`parentName`, `passedOver`, `chain`, `blindSteps` gain nothing | ✅ all six confirmed by response inspection |
| d7 nothing acts on the four | ✅ none of the named functions is in the diff |
| d8 verbatim class untouched | ✅ `export.js` and `handleGetExport` absent from the diff |
| d9 `recordBySlug`, first-wins preserved exactly, fallback behaviour identical | ✅ `index.js:490-497`; see Deviation 1 |
| d10 not license to render — no `ui/` change | ✅ |

Implementation notes also honoured: the module header docstring was updated (`goals.js:12-21`); the
export list grew by **exactly** one name (`goals.js:355`); the brain module gained a destructured
name, **not a new `require` spec** (`index.js:26`) — which matters because that require list is
S-pinned as an allow-list across six second-brain suites, all of which pass; `src/api/normalize/`,
`src/lib/brain/hygiene.js`, `src/lib/brain/export.js` and every `ui/` file are untouched.

- [x] Files changed match the ADR's implementation notes exactly — three files, no more, no fewer.
- [x] Layering respected: both pure cores stay dependency-free (S1/S3 pass); the projector is the
      only new export.
- [x] No new dependencies.

**Deviation 1 — the `nameOf(slug)` helper (`index.js:494-497`). Accepted.** ADR d9's binding
constraint is behavioural: *"the fallback stays exactly `nameBySlug.get(p.goal) || p.goal` **in
behavior**."* I checked behaviour-identity over every input class rather than taking the claim: slug
absent from the map (`undefined || slug` → slug, both); a non-empty name (returns the name, both);
`name: null` (falls through to slug, both); `name: ''` (falls through to slug, both — `''` is falsy
either way); a falsy record is impossible because the population loop guards
`if (g && typeof g.slug === 'string')`. The helper serves both the card and each runner-up, which is
the real argument — inlining would have restated the record lookup twice. First-wins-in-scan-order is
preserved verbatim, and my probe confirms the runners-up still carry exactly
`{goal, goalName, whyNot}`.

**Deviation 2 — assigning the four in a loop rather than hoisting `INTENT_FIELDS`. Accepted.** The
ADR explicitly offered both and called it the implementer's. I checked the TDZ question rather than
accepting the comment: `INTENT_FIELDS` is a module-scope `const` at `goals.js:278` read inside
`parseGoalRow` at `:61`. The binding is in the temporal dead zone only *during module evaluation*;
`goals.js` has zero top-level invocations and zero `require` calls, so it can never be re-entered
partially evaluated by a cycle, and an external caller can only obtain the function from a completed
`require()`. Safe. Key-insertion order is `INTENT_FIELDS` order after the ten, which is exactly what
R1 pins — and R1 passes.

## Concept-graph integrity

- [x] Handles remain `kind:pubkey:slug`, built from a **runtime-resolved** TA
      (`39998:${taPubkey}:${GOAL_CONCEPT_SLUG}`). No pubkey literal anywhere in the diff — I scanned
      the `src/` diff for any 64-hex run and found none.
- [x] **No firmware reinstall required, and the ADR says so correctly.** No concept is added and none
      is redefined; `GOAL_SCHEMA` is untouched (`src/api/normalize/index.js` is not in the diff); the
      goal concept is runtime-created and has never been firmware-seeded. `firmware-concept-elements-sets`
      passes (19/0).
- [x] The ADR's own orientation used the three-call `/summaries` → `/neighbors` → schema-node pattern
      against the live graph, not BIBLE.md, and records that it did.

## Things tests can't catch

- [x] **No secrets.** No pubkey literal, token or credential in the diff.
- [x] **No debug code.** No `console.log`/`debugger`/`TODO`/`FIXME` added to `src/`.
- [x] **No commented-out code.** The added comments are all explanatory and all load-bearing — each
      names the ADR decision it implements and, more usefully, what a future reader must *not* "fix".
- [x] **Edge cases.** `projectIntentFields(null)` / `({})` yields the four-key shape with every value
      `null`; `handleGetProposals` passes `recordBySlug.get(p.goal) || {}`, so a card nominating an
      unresolvable slug reports four `null`s rather than throwing.
- [x] **Race conditions:** none introduced. Both new functions are pure and allocate fresh objects;
      no shared mutable state; no new I/O, no new ordering dependency.
- [x] **Security:** no new input surface. These are read handlers behind the existing
      `isOwner(req) || req.localTrusted` gate, which is unchanged on all five.
- [x] **No scope creep.** Three files, all named by the ADR. The Implementer touched **no test file** —
      the Tester's lane was respected (`git diff --name-only` shows no `test/` path in `c7b11d56`).

## House rules check

- [x] Concept Graph API authority respected (orientation ran against the live graph; no concept
      redefined).
- [x] No new lint / typecheck / build tooling. No new dependency. Still JS-without-build.
- [x] TA pubkey resolved at runtime, never hardcoded; ADR 0015's `LEGACY_*` constants are not
      touched by this diff.

## Product-guide adherence

Not applicable — the book has no PRD (it runs on a goal-derived acceptance frame) and this story
ships no owner-facing copy or screen.

---

## Findings

### Blocking

**None.**

### Non-blocking

1. **`src/lib/brain/direction.js:145-156` — the three literally-named fields are maintained by hand,
   and a comment is the only tie to `INTENT_FIELDS`. My opinion, since you asked for it rather than
   agreement: the comment is *sufficient to ship this story*, but it is not the instrument I would
   want long-term.**
   What is genuinely true in the code's favour: the divergence cannot land **silently**. `U17`
   (`test/return-the-four-…:673`) asserts `INTENT_FIELDS` deep-equals the test's own
   `EXPECTED_FIELDS`, so adding a fifth intent field turns that test red immediately, with the
   message *"one list, one place."* And the comment is unusually good — it names the constant, the
   file, the pin that forbids importing it, and the maintenance obligation in one place.
   What is still weak: `U17` fires on the **goals** side and points nowhere near `direction.js`. A
   developer adding a fifth field would fix `EXPECTED_FIELDS` to make `U17` green again, and nothing
   would then fail — `U13`/`U14`/`U15` iterate a hardcoded `['prompt','needsHumanInput','needsBreakdown']`
   literal, not the constant. So the tripwire catches *that the list moved*, not *that direction.js
   fell behind*.
   The cheap fix is one S-class assertion in the Tester's lane, structure-bounded per OPEN.md #109:
   bound `deriveTerms`'s body with `needBody()` and assert it names every member of the **real**
   `INTENT_FIELDS` except `chanceOfSuccess` (which travels as `estimate` on that surface by d5). That
   reads the actual constant, so it fires on divergence and points straight at the file.
   **Not blocking**, for three reasons: ADR 0002 d5 explicitly ratified literal naming *with a
   comment* as the mitigation and re-legislating a ratified decision at Review is out of my lane;
   test-file changes are Phase 3's lane, so the Implementer could not have added it without crossing
   a phase boundary; and `INTENT_FIELDS` has changed exactly once in its life. **Asked follow-up (not
   a change to this diff):** file an OPEN.md row (`meta`) or carry it into story 3's test plan, which
   consumes the same list.

2. **`src/api/brain/index.js:244, 385, 454, 512` — the projector is spread *last* in each response
   literal, so the four would win any future key collision with a sibling field.** No collision
   exists today (I checked all four literals against all four names), and `U17` prevents
   `INTENT_FIELDS` drifting into a colliding name without a red test. Recorded as a property of the
   shape, not a defect.

3. **`src/api/brain/index.js:490-497` vs `:363-364` — the proposal card resolves its record
   first-wins-in-scan-order while the detail read uses the resolver-winner, so on an instance with a
   duplicated goal slug the card and the detail can show a *different* four for the same slug.**
   Pre-existing (`goalName` already diverged exactly this way), and ADR d9 explicitly ratified
   preserving it because changing it would be a content change AC4 does not sanction. Recorded
   because **story 3 renders both surfaces**, where the inconsistency would become owner-visible for
   the first time. Worth a line in story 3's ADR; nothing to do here.

4. **ADR 0002's live-corpus census is stale by one and my run confirms it.** The ADR says 6 goals
   store `needsHumanInput: false`; H1's live census this session printed `storedFalse: 7` goals
   overall, and the test plan's independent read gives 5 for `needsHumanInput` specifically. The test
   plan already recorded the delta and correctly noted nothing load-bearing moves (the ADR's two
   conclusions hold with *more* margin, since `needsBreakdown` adds explicit `false`s the ADR never
   counted). **The book's close should carry the corrected, re-derived census, not the ADR's figure.**

5. **`src/lib/brain/direction.js:91` — `UNAVAILABLE`'s `estimate` detail is now factually stale.** It
   still reads *"the goals read API drops it (parseGoalRow)"*, which as of this commit is false.
   Deliberately not changed here — U28 pins that constant and it belongs to a closed book — and ADR
   0002 Consequences (a) reserves the correction for whenever the raw-record workaround is retired.
   Flagging it because the ADR asks the **book's close to report it**, and the book's own *"One thing
   this book closes about itself"* section quotes that sentence.

### Harness friction

1. **The background-completion notification reported "exit code 0" and this time it happened to be
   right.** That is coincidence, not reliability — the verdict came from the echoed `EXIT=` and the
   `Overall:` line inside the log, per OPEN.md #103/#105/#111. No new row needed; the existing rows
   already describe it, and the brace form worked exactly as row 111 prescribes.
2. **OPEN.md row 75's two environmental assertions both passed this run** (`relationship-primitives`
   H8, `relationship-primitives-probe` H4). Nothing needed distinguishing. Worth appending to row 75
   as a third corroboration that it is environmental — it has now been observed both red and green
   with the same code inside this run.

---

## Verdict

**PASS**

The diff does exactly what the ADR designed and nothing else: three files, four spread sites, one new
pure export, three literally-named terms. Every acceptance criterion is satisfied by evidence I
produced myself, not by the suite's own say-so — including the two places a defect would have been
easy to miss and expensive to ship: the export/restore round-trip (never-set keys are **omitted**, so
a backup cycle cannot turn "never estimated" into "estimated at zero") and the boundary judge's
blinding contract (a real 2-goal chain still yields steps of exactly two boundary strings). The
closed book's `U25` contract is intact and its derivation is byte-unchanged — zero deletion lines in
`direction.js`. Full suite: `Overall: PASS`, `EXIT=0`, zero test-level failures, live H-class 8/8
executed.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; the Linked-artifacts Review line filled in.
- [x] Story file stays in `stories/goal-intent-fields/` — retirement is per-epic, not per-story.
- [x] **Completion detection run: the book is NOT complete — `/close-book` deliberately not offered.**
      The frame's third bullet is *"all four come back on every surface that shows a goal."* This
      story bounded itself to the **server-side** read surfaces and put the owner's screens in
      `goal-intent-fields` #3, which is `Status: Approved` and not yet built. The epic
      (`epics/goal-intent-fields.md`) is `Status: Active`. Offering a close now would ratify a frame
      bullet that is only two-thirds carried.
