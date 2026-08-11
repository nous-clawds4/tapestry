# Test Plan: Story 4 — Reach the not-yet-shared list from the page about what I've shared

**Story:** `engineering-team/stories/shared-concepts-seeding/4-share-from-shared-by-me.md`
**ADR:** `engineering-team/decisions/shared-concepts-seeding/0002-the-route-and-its-count-reuse-the-shipped-predicate.md`
**Date:** 2026-08-11

## Two additions to `conceptStateFilter.js`, and why they are testable rather than grepped

ADR 0002 describes two pieces of decision logic in prose: the four honesty rules for the count, and
the fallback when the address carries a state the page does not know. Both are branchy, both are the
parts the ADR itself flags as easy to get wrong, and **a source grep cannot distinguish a correct
implementation from a plausible one.** So this plan requires both as exports:

> - **`summarizeNotYetShared(rows, ctx)`** → `{ kind: 'waiting' | 'clear' | 'unknown', count: number|null }`
>   — the four honesty rules in one place. `rows == null` means the population could not be read.
> - **`normalizeState(raw)`** → a valid state id, or `''` for All — the address fallback.

Both go in the module story #3 already established as the single home for this vocabulary. No new
file, no new pattern: `matchesState` and `unconfirmedCount` already live there and are already driven
by tests the same way.

**A note on how this plan was corrected mid-write.** The first version of `S2` asserted that
`ConceptList.jsx` mentions `STATES` and calls `.map(` — and it **passed against today's code**, which
has no validation at all, because those tokens already exist for rendering the dropdown. That is a
test that cannot fail. It was replaced: `U8` now drives the fallback directly with junk input
(`'nonsense'`, `'NOT-YET-SHARED'`, `'../evil'`, `''`), and `S2` only pins that the page routes its
input through the function `U8` covers.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 (a way through) | `S3` — the page links to the Concepts page **with the state** | source |
| AC-2 (arrives narrowed) | `S1` (reads the address), `S2` (validates it), `U7`/`U8`/`U9` (what validation does) | source + unit |
| AC-3 (errand completes) | **V1 step 3** — share from the destination, confirm it leaves the list | manual |
| AC-4 (stale advice gone) | `S4` | source |
| AC-5 (goal state reads as success) | `U2` — zero is `clear`, not an errand | unit |
| ADR rule 1 (population unknown) | `U3` — no number, never `0` | unit |
| ADR rule 2 (relay unreachable) | `U4` — no number; the count would be a lower bound | unit |
| ADR rule 3 (both good) | `U1` | unit |
| ADR "cannot disagree" | `U5` — the count equals what `matchesState` selects | unit |
| ADR: one home | `S5` — the page does not re-implement the count or the sharing rule | source |

### The distinction `U6` exists for

An **empty** population is `clear`; a **missing** one is `unknown`. Collapsing them is precisely how
"we could not check" becomes "you are done" — the failure mode this book has now paid for twice. It
is a separate test because the natural implementation (`(rows || []).filter(...).length`) collapses
them silently and passes everything else.

### `U4` deserves naming

When the relay cannot be asked, story #3's predicate withholds unconfirmed concepts from
*not-yet-shared*. So a count computed anyway is a **lower bound** — it reads as "you are closer to
done than you are". That is a quieter lie than a wrong zero and easier to ship by accident.

## Edge cases covered

- [x] Bad / stale / hostile state in the address → All, never an empty table (`U8`).
- [x] No state in the address → All; `'all'` normalises to `''` so ordinary visits keep a clean
      address (`U9`).
- [x] Zero waiting → success, not an empty errand (`U2`).
- [x] Population unreadable → no number (`U3`); relay unreachable → no number (`U4`).
- [x] Count drifting from the list it advertises (`U5`).
- [x] A rename of the state's display label leaving two surfaces disagreeing (`S6`, pre-satisfied).

## Deliberately not automated

- **The rendered page.** Playwright stays deferred (OPEN.md row 13). It is **V1** below, run at
  Review, and it is required — story #3's effect-lifecycle bug was invisible to a 15/15 green suite
  and was caught only by opening the page.
- **A live H-class.** This story adds no server surface. The one live claim worth checking — that the
  number on one page equals the rows on the other — is a rendered comparison, not an HTTP one, and
  is V1 step 2.

## Test infrastructure

- Framework: the repo's runner — `node test/test.js`, suites exporting `run()`. No new tooling.
- Registered in `test/test.js` at four sites (require, invocation, summary line, overall-pass
  conjunction).
- U-class loads `ui/src/utils/conceptStateFilter.js` by dynamic `import()` (`ui/` is
  `"type": "module"`), the `loadEsm` idiom of `firmware-concept-elements-sets.test.js:58-66`. The
  module must stay dependency-free.
- No stack required — every test here is stack-free, so the whole suite gates in CI.
- Fixtures: five fabricated rows in-suite (two waiting, one shared, one wired, one private). Nothing
  is written anywhere.

## How to run

```bash
node test/share-from-shared-by-me.test.js
```

## Verification

Confirmed 2026-08-11 at commit `7f598b93` — 14 failing for the stated reasons, 1 pre-satisfied guard:

```
FAIL  U1–U6   conceptStateFilter.js must export summarizeNotYetShared(rows, ctx) … not implemented.
FAIL  U7–U9   conceptStateFilter.js must export normalizeState(raw) …
FAIL  S1      ConceptList.jsx must read its state filter from the address via useSearchParams …
FAIL  S2      ConceptList.jsx must pass the incoming state through normalizeState …
FAIL  S3      the route must target the not-yet-shared state specifically, not the bare Concepts page …
FAIL  S4      the empty state still reads "…Submit one from its concept page." …
FAIL  S5      SharedByMe.jsx must get its number from conceptStateFilter.js …
PASS  S6      (pre-satisfied guard — see below)

share-from-shared-by-me: 1 passed, 14 failed, 0 skipped
```

`S6` passes today because `SharedByMe` does not mention the state at all. It becomes a real guard the
moment the route is written, since the tempting implementation is to paste the display label beside
the link. Annotated as pre-satisfied in the suite header, the same way
`relationship-primitives-probe` H3 is.

## Verification protocol V1 — run at Review, recorded in the review

Automated coverage stops at the two pure functions and the page's structure. This exercises the
thing the story is actually about.

1. **The route exists and is findable** (AC-1). Open Shared by me. Confirm a route to the
   not-yet-shared concepts is visible without hunting.
2. **The number matches the list** (ADR's central claim). Note the number on the route. Follow it.
   Confirm the destination's row count **equals** it. This is the one check that would catch the
   count and the list drifting apart.
3. **The destination arrives ready, and the errand completes** (AC-2, AC-3). Confirm the state
   control is already set — without touching it. Then share one concept from there and confirm it
   leaves the not-yet-shared list and the number drops by one.
4. **It is the address, not a transient hand-off** (AC-2). Copy the destination URL, reload it in a
   fresh tab. Confirm it is still narrowed. A router-state implementation passes step 3 and fails
   here.
5. **Bad input degrades safely** (AC-2 edge). Visit `?state=nonsense`. Confirm All states, a full
   table, and no error — not an empty table.
6. **The address tracks the control.** Change the dropdown; confirm the address follows and the back
   button does not replay every intermediate selection.
7. **Capture a screenshot** of the route into the review.

*Not reachable on any current deployment:* AC-5's zero state, and the two no-number cases (`U3`,
`U4`), which need a failed graph read or an unreachable relay. Covered at unit level only — state
this plainly in the review rather than implying V1 covered them.
