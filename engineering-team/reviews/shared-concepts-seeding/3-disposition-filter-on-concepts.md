# Review: Story 3 — Find, in bulk, which of my concepts I haven't shared

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-11
**Diff:** `git diff origin/staging...HEAD` (commit `2bf081ac`)

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
- [x] `npm run test:playwright` — **not run.** No Playwright spec exists for this page and the test
      plan deliberately did not add one (OPEN.md row 13 defers e2e). The rendered behaviour was
      checked by hand instead — see below.
- [x] _Lint not configured — skipped._ (`scripts/harness-lint.sh`: **clean, 0 violations**.)
- [x] _Typecheck not configured — skipped._
- [x] Build — `npm --prefix ui run build` succeeds; deployed to the local container and exercised.

### Story suite and neighbours (reviewer-run)

```
not-yet-shared-filter:            15 passed, 0 failed, 0 skipped
shared-by-me:                     14 passed, 0 failed
honest-broadcast-reporting:       15 passed, 0 failed
retire-offering-vocabulary:       10 passed, 0 failed
state-on-concept-page:            20 passed, 0 failed
b-coverage-audit-and-disposition: 26 passed, 0 failed
```

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
- [~] **AC-3 (unconfirmed ≠ not-shared)** — satisfied for the *not-yet-shared* state (`U3`, and the
      withheld notice at `:210-214`, rendered at `:362-368`). **Its principle is violated by the sibling state this story
      introduced** — see Blocking 1.
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
- [~] **Failure tier 2 is implemented for one state and not the other** — Blocking 1.

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
- [ ] **Empty-list-as-assertion during a relay outage** — Blocking 1.

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

### Harness friction

1. *(none this story — the Phase-3 ADR refinement was surfaced and ratified at the gate, which is the
   process working. The general gap it exercised is already OPEN.md row 167 from the previous story.)*

## Verdict

**CHANGES_REQUESTED**

Every quality gate is green — full `npm test` Overall PASS with the router live, the story suite
15/15, five neighbouring suites unaffected, harness-lint clean — and the design is sound: publication
comes from the one endpoint that already owns the answer, so AC-2 holds by construction rather than
by coincidence. Four of the five acceptance criteria are met, one of them verified against live data
by re-deriving the expected set outside the app and matching the rendered 45 of 62.

It is held on a single issue, and a narrow one: the state *this story introduces* can render an empty
list during a relay outage that reads as "you have shared nothing". The story's own AC-3 does not
name that state, so this is a judgment call rather than a rule violation — but the endpoint the
feature consumes singles out that exact sentence as the one lie its page must never tell, and the
book this story belongs to exists to stop the product claiming things about sharing that are not
true. A feature that is honest in one direction and silent in the other is not finished.

The fix is small and the arithmetic already exists (`unconfirmedCount` returns the right number
today); what is missing is the gate and the wording, plus a test that pins the outage case for both
publication-bearing states. Nothing else in the diff needs to move.

## On PASS (same commit)

Not applicable — the verdict is CHANGES_REQUESTED. The story's `**Status:**` stays `Approved`, and
completion detection is not run: the book's third frame bullet is not yet satisfied.
