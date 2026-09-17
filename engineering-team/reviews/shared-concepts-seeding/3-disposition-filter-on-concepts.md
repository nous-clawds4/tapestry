# Review: Story 3 — Find, in bulk, which of my concepts I haven't shared

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-11
**Diff:** `git diff origin/staging...HEAD` — round 1 at `2bf081ac`, round 2 at `d619b83d`
**Rounds:** one Review kick-back. Findings below are preserved as first written; each carries its
resolution.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS (Overall: PASS)**, run by the reviewer with `strfry-router` RUNNING
      throughout. Zero `FAIL` lines across the whole run; 43 skipped (browser-only B-class and unmet
      preconditions, all pre-existing). `not-yet-shared-filter suite: PASS (15 passed, 0 failed)`.

      *Noted for accuracy, not as evidence:* this branch is based on `origin/staging`, which does not
      carry the row-150 bracket fix (that work is on a separate, still-unmerged branch), so
      `relationship-primitives` H8 and `-probe` H4 ran their **old whole-corpus** brackets here and
      happened to pass. At the 83% spurious-red rate measured on this machine, one clean run is
      unremarkable and is **not** an argument that the fix was unnecessary. Recorded so a later
      reader does not draw that inference from this file.

      **Round 2 (`d619b83d`): `npm test` — PASS (Overall: PASS)**, router RUNNING, zero `FAIL` lines,
      53 skipped (all pre-existing). `not-yet-shared-filter suite: PASS (17 passed, 0 failed)`.
- [x] `npm run test:playwright` — **not run.** No Playwright spec exists for this page and the test
      plan deliberately did not add one (OPEN.md row 13 defers e2e). The rendered behaviour was
      checked by hand instead — see below.
- [x] _Lint not configured — skipped._ (`scripts/harness-lint.sh`: **clean, 0 violations**.)
- [x] _Typecheck not configured — skipped._
- [x] Build — `npm --prefix ui run build` succeeds; deployed to the local container and exercised.

### Story suite and neighbours (reviewer-run)

```
                                  round 1        round 2
not-yet-shared-filter:            15 / 0         17 / 0
shared-by-me:                     14 / 0         14 / 0
honest-broadcast-reporting:       15 / 0         15 / 0
retire-offering-vocabulary:       10 / 0          —
state-on-concept-page:            20 / 0         20 / 0
b-coverage-audit-and-disposition: 26 / 0         26 / 0
```

### Round 2 — every state verified independently against live data

Row counts recomputed from `/api/shared-by-me` + Cypher, outside the app, and compared with what the
page renders. This is the reviewer's own computation, not the Implementer's:

```
state              expected   rendered   match
shared             3          3          OK
not-yet-shared     45         45         OK
wired              6          6          OK
private            2          2          OK
undispositioned    45         45         OK
all                62         62         OK

shared names expected: ['dog', 'dog breed', 'tapestry']  |  rendered: same
```

The partition is exact: 3 + 45 + 6 + 2 = 56 = every TA-authored concept; the remaining 6 of 62 belong
to other authors. *Shared (mine)* listing exactly the three concepts the endpoint reports as
`published:true` is AC-2 verified from the opposite direction to round 1.

**Known limit, accepted:** the outage notice itself is still not verified on screen. The Implementer
said so plainly rather than letting the rendered counts imply it. Inducing a real relay outage means
interfering with container networking, which is more invasive than the check is worth, and `U10`
(logic) plus `S5` (the page gate) cover it.

### Rendered verification, and an independent cross-check

The page was exercised in a browser against the live stack. *Not yet shared (mine)* renders **45 of
62**, matching a set computed independently from `/api/shared-by-me` + Cypher by re-deriving the
ratified predicate outside the app:

```
graph headers:             62
expected not-yet-shared:   45   ← page renders 45 ✓
expected undispositioned:  45
difference between them:   NONE — identical on this data
```

Author + state compose (AC-1): `tapestry_dev` + *Not yet shared* → **0 of 62**. `dog`, `dog breed`
and `tapestry` are correctly absent as published (AC-2).

## Spec adherence

- [x] **AC-1 (composes)** — verified on the rendered page; the state stage runs after the author
      stage (`ConceptList.jsx:203-208`), so they narrow together.
- [x] **AC-2 (pages agree)** — structurally guaranteed: publication comes from `/api/shared-by-me`,
      the same endpoint Shared by me renders, resolved by the same `src/lib/sharingState.js`. Verified
      on live data for all three published concepts.
- [x] **AC-3 (unconfirmed ≠ not-shared)** — *round 1:* satisfied for the *not-yet-shared* state (`U3`,
      withheld notice at `:210-214`) but **its principle was violated by the sibling state this story
      introduced** (Blocking 1). *Round 2:* both publication-bearing states now report an outage —
      **resolved**, and guarded by `S5`.
- [x] **AC-4 (local declaration ≠ shared)** — satisfied at the predicate level (`U1`).
      **Not observable on this instance** — see Non-blocking 1.
- [x] **AC-5 (controls aren't synonyms)** — `U7` at the predicate level; a single-select makes it
      structural. **Not observable on this instance** — see Non-blocking 1.
- [x] No criterion silently dropped; no behaviour added beyond the story.

## ADR adherence

- [x] Option A implemented as decided — lazy fetch, join by `coord`, filter locally.
- [x] **No re-derivation.** `ConceptList.jsx` mentions neither `carriesSelfPointer` nor
      `resolveSharingState`; the sharing rule keeps its single home.
- [x] The Phase-3 refinement (extract the predicate to `ui/src/utils/conceptStateFilter.js`,
      dependency-free) is implemented as ratified, and the module imports nothing.
- [x] `_undispositionedMine` and `nextUndispositioned` untouched — "Save & next" is not collateral
      damage.
- [x] No new dependency, no new tooling.
- [x] **Failure tier 2** — *round 1:* implemented for one state and not the other (Blocking 1).
      *Round 2:* gated on `needsPublication`, so it covers both, and any state added later.

## Concept-graph integrity

- [x] No concept definitions changed; **no firmware reinstall required**.
- [x] No hardcoded TA pubkey — `taPubkey` comes from `useConfig()` and flows through `stateCtx`.
- [x] Handles remain `kind:pubkey:slug`; the join key is that coordinate, verified live by `H2`.

## Things tests can't catch

- [x] No secrets; no debug logging; no commented-out code.
- [x] **A React effect-lifecycle bug was found and fixed during Implementation** — `sharing` had been
      in the effect's dependency array, so setting it to `{loading}` re-ran the effect whose cleanup
      cancelled the in-flight fetch; the page hung on "Checking the community relay…" while a 200 was
      discarded. Now a ref guards in-flight and only unmount cancels (`:108-130`). Worth recording that
      **the suite was 15/15 green while this was broken on screen** — the unit tests cover the
      predicate, and the defect was in the fetch lifecycle.
- [x] Read-only: the page writes nothing; the suite writes nothing.
- [x] **Empty-list-as-assertion during a relay outage** — Blocking 1, **resolved in round 2**; `S5`
      independently confirmed to fail against the pre-fix page.

## House rules check

- [x] Concept Graph API authority respected (orientation done at Planning; `shared-concept`'s own
      definition is what "shared" means here).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`ui/src/pages/concepts/ConceptList.jsx:210-211` — during a community-relay outage, *Shared (mine)*
   renders an empty list with no explanation, asserting "you have shared nothing".**

   The `withheld` notice is gated on `stateFilter === 'not-yet-shared'`. When the relay is
   unreachable the endpoint still answers 200 with every `published: null`, so `sharing.ok` is true,
   `stateAnswerable` is true, rows are filtered, and `isShared` matches nothing. The table then falls
   through to `emptyMessage="No concepts match your filters"`.

   Confirmed by driving the predicate directly with an all-null map:

   ```
   SHARED (mine) during a relay outage ->  []     ← rendered with no notice
   withheld count for that case        ->  2      ← already computed, just not shown
   NOT-YET-SHARED during same outage   ->  ['new'] ← correctly handled
   ```

   This is the specific lie the endpoint this story consumes calls out in its own header
   (`src/api/concept/sharedByMe.js:12-21`): *"An empty list would assert 'you have shared nothing',
   the one lie a completeness page must never tell."* The story's AC-3 names only the
   *not-yet-shared* state, so this is not a literal AC violation — but *Shared (mine)* is a state
   **this story invented**, so the story owns its honesty, and shipping the honest half beside the
   dishonest half in a book whose subject is truthful reporting is not defensible.

   **Asked change:** extend the withheld/unconfirmed notice to cover the `shared` state as well as
   `not-yet-shared`, worded for that direction (publication could not be confirmed, so this list may
   be incomplete — rather than "not listed here"). `unconfirmedCount` already returns the right
   number; only the gate at `:211` and the message need to change. A test pinning the outage case for
   *both* publication-bearing states should come with it.

   > **RESOLVED, round 2 (`d619b83d`).** `ConceptList.jsx:214` now gates on
   > `needsPublication(stateFilter)` rather than a state literal, so **every** publication-dependent
   > state reports an outage — including any added later, which makes the fix robust rather than
   > merely correct today. `unconfirmedCount` (`conceptStateFilter.js:141`) takes the state and
   > scopes itself the way that state's predicate is scoped; the notice wording branches at `:369`.
   >
   > **The guard was verified, not assumed.** The Implementer claimed `S5` fails against the pre-fix
   > page; independently reproduced by restoring the round-1 page and re-running the current suite:
   >
   > ```
   >   PASS  U10 (AC-3, both directions): a relay outage is accounted for by BOTH publication-bearing states…
   >   FAIL  S5 (AC-3, review kick-back): the outage notice is not gated to ONE state…
   >   not-yet-shared-filter: 16 passed, 1 failed, 0 skipped
   > ```
   >
   > `U10` passing against the broken page is exactly what the Implementer disclosed unprompted:
   > their first test exercised the util while the defect lived in the page's gate. They checked
   > whether their own test would have caught the bug, found it would not, said so, and added the one
   > that does. Recorded because a test that cannot fail is the failure mode this book keeps paying
   > for.

### Non-blocking

1. **AC-4 and AC-5 are unobservable on this instance, and that should be recorded rather than
   implied.** The only declared-but-unpublished concept (`b-coverage-fixture-s1b`) exists in strfry
   only and has no graph node, so it can never appear in the graph-sourced Concepts list. Consequence:
   *Not yet shared* and *Undispositioned* select **identical 45-row sets** here, and the story's
   central distinction cannot be seen on screen. `U1`/`U7` prove both at the predicate level. This is
   a property of the local corpus, not a defect — but the Implementer's own V1 step was written on
   the false premise that shared-by-me rows map to Concepts rows (`H2` proved only that *at least
   one* does), and that premise was corrected by looking rather than by any test. Recorded so a
   later reader does not mistake "V1 passed" for "the distinction was seen".

2. **`ui/src/pages/concepts/ConceptList.jsx:114` — a failed publication fetch cannot be retried
   without a page reload.** `sharingRequested` is set before the fetch and never reset, so the error
   state is terminal for the page's lifetime and the error message offers no retry. *Optional
   improvement:* reset the ref in the failure branch, or add a retry affordance to the error notice.

3. **`ui/src/pages/concepts/ConceptList.jsx:195` — `stateCtx.relayOk` is passed but never read by the
   predicate**, which derives everything from the tri-state map values. Harmless, but a field that
   looks load-bearing and isn't will mislead the next reader. *Optional improvement:* drop it, or
   comment why it is carried.

   > *Round 2:* NB-2 and NB-3 were left unaddressed, which is legitimate — both are non-blocking and
   > the kick-back was scoped to the blocking finding. NB-1 is inherent to the local corpus and
   > cannot be fixed here. All three carry forward.

4. **(round 2) `ui/src/pages/concepts/ConceptList.jsx:369` — the notice *wording* branches on
   `stateFilter === 'shared'`, so a third publication-bearing state added later would silently
   inherit the *not-yet-shared* sentence.** The *gate* is now future-proof (`needsPublication`); the
   wording is not. Low likelihood and harmless if it happens, but the asymmetry is worth a word.
   *Optional improvement:* carry the sentence on the `STATES` entry beside `needsPublication`, so a
   new state cannot be added without choosing one.

### Harness friction

1. *(round 1 — none. The Phase-3 ADR refinement was surfaced and ratified at the gate, which is the
   process working. The general gap it exercised is already OPEN.md row 167 from the previous story.)*

2. **(round 2) A kick-back to Implementation that requires a *new* test has no clean lane.**
   `workflows/4-implementation.md:38` prohibits "modifying tests to make them pass. If a test is
   wrong, kick back to Tester" — aimed at an Implementer weakening their own judge. A review finding
   that needs a *new* test pinning a *new* defect is the opposite, and the Implementer added `S5`
   during Phase 4, reasoning that strengthening is not what the rule forbids. That reading is right
   and the diff bears it out — `S5` fails against the old code. But it was derived in the moment
   rather than read off a rule. Same shape as OPEN.md row 167 (no lane for a story whose deliverable
   *is* a test change); **folded into 167 rather than minting a new row**, since the fix is the same
   sentence in the same file.

## Verdict

**PASS** *(after one Review kick-back; the CHANGES_REQUESTED reasoning is preserved above)*

Round 1 held this on one issue — the state the story introduced could render an empty list during a
relay outage that read as "you have shared nothing". That is fixed, and fixed in the more durable
way: the gate is `needsPublication(stateFilter)`, so a state added later cannot inherit the silence.
The fix is guarded by `S5`, which this reviewer independently confirmed **fails** against the
pre-fix page and passes against the current one.

Every gate is green across both rounds: full `npm test` Overall PASS with the router live and zero
`FAIL` lines, the story suite 15/15 then 17/17, four neighbouring suites unmoved, harness-lint clean.
Every one of the six states was recomputed from `/api/shared-by-me` + Cypher outside the app and
matches what the page renders, with an exact partition over the TA-authored corpus.

The design is the part worth keeping: publication is read from the one endpoint that already owns the
answer, resolved by the one module that owns the rule, so AC-2 holds by construction rather than by
two implementations agreeing on the day they shipped.

Three things are recorded rather than resolved, and none blocks a merge. **AC-4 and AC-5 are proven
at the predicate level but cannot be seen on this instance** — the only declared-but-unpublished
concept is strfry-only, so the two states select identical row sets here; a reader must not take this
PASS as "the distinction was observed". The **outage notice is likewise unverified on screen**, by a
deliberate choice not to interfere with container networking. And the notice **wording** remains
gated on a state literal even though its trigger no longer is.

What earns the PASS beyond the gates is that the two defects found in this story were both caught by
looking — the effect-lifecycle hang by opening the page while the suite was 15/15 green, and the
empty-list assertion by reading the failure mode rather than the row count — and that when the
Implementer's own test turned out not to cover the reported bug, they checked, said so unprompted,
and wrote the one that did.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in the chat, not here.
