# Review: Story 4 — Reach the not-yet-shared list from the page about what I've shared

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-11
**Diff:** `git diff origin/staging...HEAD` (commit `d967906f`)
**Story:** `engineering-team/stories/shared-concepts-seeding/4-share-from-shared-by-me.md`
**ADR:** `engineering-team/decisions/shared-concepts-seeding/0002-the-route-and-its-count-reuse-the-shipped-predicate.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS (Overall: PASS)**, run by the reviewer with `strfry-router` RUNNING. Zero
      `FAIL` lines; 31 skipped (browser-only B-class and unmet preconditions, all pre-existing).
      `share-from-shared-by-me suite: PASS (15 passed, 0 failed)`.

      Incidentally confirmed on this base: `strfry-write-assertion-bracket` 6/0,
      `relationship-primitives` 23/0 and `-probe` 9/0 — the row-150 narrowed brackets holding on a
      full gate with the router live and no quiescing.
- [x] Story suite — `share-from-shared-by-me: 15 passed, 0 failed, 0 skipped`.
- [x] Neighbours — `not-yet-shared-filter` 17/0, `shared-by-me` 14/0, `honest-broadcast-reporting`
      15/0, `retire-offering-vocabulary` 10/0, `state-on-concept-page` 20/0,
      `b-coverage-audit-and-disposition` 26/0.
- [x] `scripts/harness-lint.sh` — clean, 0 violations.
- [x] Build — `npm --prefix ui run build` succeeds; deployed and exercised on the local stack.
- [x] _Lint / typecheck not configured — skipped._

> **Session note:** the SessionStart digest reported the stack absent. It was — the container had
> restarted moments before. It came back up and this review was run against a live stack, so nothing
> here is degraded by that. The build survived because `dist/` is bind-mounted from the repo; the
> served bundle was confirmed to contain the new route string before verifying anything.

### Rendered verification — reviewer's own run, not the Implementer's

| Check | Result |
|---|---|
| Route on Shared by me | `Haven't shared these yet — 45 waiting →` → `/tapestry/concepts?state=not-yet-shared` |
| Destination, **direct load** of that URL | control already reads *Not yet shared (mine)*, **45 rows**, "45 of 62 concepts" |
| **The number equals the list** | **45 = 45** |

The direct load matters more than the click-through: it is what distinguishes a real address contract
from a transient hand-off, and it is the check Option D in the ADR would have failed.

## Spec adherence

- [x] **AC-1 (a way through)** — a `Link` (`SharedByMe.jsx:46`, rendered at `:152-166`), verified on
      the page.
- [x] **AC-2 (arrives ready)** — verified by direct load. `ConceptList.jsx:75` derives the filter
      from the address; `:82` writes it back with `replace: true`.
- [x] **AC-3 (errand completes)** — the destination is the surface story #3 shipped, whose
      undispositioned rows carry the *Submit as a Shared Concept* control. Unchanged by this diff.
- [x] **AC-4 (stale advice gone)** — `S4`; the old "Submit one from its concept page" is gone.
- [~] **AC-5 (goal state reads as success)** — satisfied on the path that matters (concepts exist,
      none waiting → `clear`), **not** on a zero-concept instance. See Non-blocking 1.

## ADR adherence

- [x] Option A implemented as decided: address-backed state, count from `matchesState`.
- [x] The default omits the parameter entirely rather than writing `?state=all` — verified live
      (returning to All empties the query string).
- [x] Unrecognised state falls back to All — verified live (`?state=nonsense` → All states, 62 rows,
      not an empty table).
- [x] **No second implementation.** `summarizeNotYetShared` (`conceptStateFilter.js:182`) counts with
      `matchesState`, so the number and the list are one function over the same inputs. This is the
      ADR's deciding argument and it holds.
- [x] `ctx.relayOk` is now read (`:184`), retiring the vestigial-field finding from story #3's
      round-1 review.
- [x] No server change, no new endpoint, no new dependency, no concept definitions touched.
- [~] The ADR's honesty rules are correctly implemented **in the module** and partly undone **at the
      call site**. See Non-blocking 1.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code.
- [x] `Link` rather than programmatic navigation — the route is a real anchor, middle-clickable.
- [x] `useMemo` dependency array (`SharedByMe.jsx:80-95`) lists every input it reads.
- [x] Read-only; nothing written to strfry or the graph.
- [x] The population query (`:36-43`) is genuinely minimal — no aggregation, no schema joins —
      matching what the ADR asked for.
- [ ] **A doc comment now describes the wrong function** — Non-blocking 2.

## House rules check

- [x] No hardcoded TA pubkey; `taPubkey` comes from `useConfig()`.
- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority respected; no concept definitions changed, no firmware reinstall.

## Findings

### Blocking

_None._

### Non-blocking

1. **`ui/src/pages/shared-concepts/SharedByMe.jsx:81` — the page collapses the exact distinction
   `U6` was written to protect.**

   The guard is `population.length > 0`, so a **genuinely empty** population is converted to `null`
   and reported as `unknown` rather than `clear`. Demonstrated by driving the page's own
   transformation directly:

   ```
   module, empty population []      -> {"kind":"clear","count":0}
   PAGE,   empty population []      -> {"kind":"unknown","count":null}
   module, missing population null  -> {"kind":"unknown","count":null}
   ```

   The module honours the distinction; the call site discards it. This is the same shape as story
   #3's round-1 finding — the unit test covers the util, the defect lives in the page — and it is
   worth noticing that `U6` is green throughout.

   **Why it is not blocking.** The realistic AC-5 path still works: when concepts exist and none are
   waiting, `rowsKnown` is true, the count is 0, and the page correctly says *"Nothing left to
   share"*. The broken case needs **zero concept headers**, which on this product means firmware was
   never installed. And the wrong answer is `unknown`, which per the ADR renders a route with **no
   number** — so it makes no false claim about work waiting; it merely points at an empty list. I
   considered blocking and decided the gap between "rare, and honest-but-unhelpful" and story #3's
   "common, and actively false" is the line.

   **Root cause, and the one-line fix.** `useCypher` initialises `data` to `[]`
   (`ui/src/hooks/useCypher.js:11`) so loading and empty are indistinguishable by value — but it
   **also returns `loading`** (`:34`), which the page does not destructure. Using `loading` instead
   of `length > 0` separates the two states properly and removes the conflation.

   *Secondary symptom of the same guard:* on every page load the route renders without a number and
   then pops to "— 45 waiting" once the query resolves. Cosmetic, same fix.

2. **`ui/src/utils/conceptStateFilter.js:140-156` — `unconfirmedCount`'s doc comment now documents
   `summarizeNotYetShared`.** The new function was inserted between the existing JSDoc block and the
   function it belonged to. `unconfirmedCount` (`:189`) is now undocumented, and the block above
   `summarizeNotYetShared` describes something else entirely — including reasoning from the previous
   story's kick-back. No behaviour change; an IDE and a future reader will both be misled. *Fix:*
   move the `summarizeNotYetShared` definition below `unconfirmedCount`, or move the orphaned block
   down to rejoin its function.

3. **`ui/src/pages/shared-concepts/SharedByMe.jsx:174` — the empty-state copy can reference a link
   that is not rendered.** It reads "The link above lists the concepts waiting to go out", but when
   `waiting.kind === 'clear'` the link is replaced by the *"Nothing left to share"* line. Reachable
   when nothing has been declared and nothing is waiting — every concept wired or private. Rare, and
   the message is otherwise a clear improvement on what it replaced.

### Harness friction

_None this story. The Phase-3 requirement for two new exports was surfaced in the test plan and
ratified at the gate; the vocabulary regression was caught by a neighbouring suite before Review,
which is the guard working._

## Verdict

**PASS**

Every gate is green — full `npm test` Overall PASS with the router live and zero `FAIL` lines, the
story suite 15/15, six neighbouring suites unmoved, harness-lint clean — and the central claim was
verified by the reviewer rather than accepted: the route advertises 45, the destination lists 45, and
a **direct load** of the narrowed URL arrives narrowed. That last check is the one that separates an
address contract from a hand-off, and it is what Option D would have failed.

The design holds where it was argued to. The count comes from `matchesState`, the same function the
destination filters with, so the number and the list cannot drift apart — and the ADR chose that over
a cheaper server-side count precisely to avoid a second home for the definition. Both new exports are
pure and driven directly by tests, which is why the four honesty rules are checkable at all rather
than asserted in prose.

Three findings, none blocking, and the first is the interesting one: **the page collapses the empty /
missing distinction that `U6` exists to protect**, because `population.length > 0` cannot tell a
loading `[]` from a real one. `U6` is green throughout — it covers the module, and the gap is at the
call site. That is the same shape as story #3's round-1 finding, in a codebase that has now produced
it twice, which is worth saying plainly even though the consequence here is mild.

It is not blocking because the path that matters still works: with concepts present and none waiting,
the page correctly reports the backlog clear. Reaching the broken case needs zero concept headers —
firmware never installed — and even then the output is `unknown`, a route with no number, which makes
no false claim about work waiting. Story #3's blocking finding was common and actively false; this is
rare and merely unhelpful. That is the line I drew, and the fix is one line (`useCypher` already
returns `loading`) whenever someone touches this file next.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in the chat, not here.
