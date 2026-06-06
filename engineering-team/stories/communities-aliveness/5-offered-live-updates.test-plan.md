# Test Plan: Story 5 — New posts are offered, not forced

**Story:** `engineering-team/stories/communities-aliveness/5-offered-live-updates.md`
**ADR:** `engineering-team/decisions/communities-aliveness/0035-offered-live-updates.md`
**Date:** 2026-06-06

## Approach
New suite `test/offered-live-updates.test.js`, registered in `test/test.js`. The detection core is tested against **real source** via extract-and-eval; the component lifecycle (poll, pill, tap) via source-guards (repo convention).

**Refinement to the ADR impl notes (testability):** the "new" detection filter is extracted into a pure helper `countNewPosts(freshPosts, displayedIds, viewerPubkey)` in `ui-communities/src/lib/liveUpdates.js`, so the exclude-displayed + exclude-own invariants are unit-testable (mirrors how Story 4 extracted `summarizeReactions`). This does not change the ADR decision (poll-based, non-injecting); it factors the detection out of the poll tick.

**The no-auto-inject structural guarantee (criterion 3)** — that the poll never writes `postsState` — is verified primarily at **review** (it's a structural property of the poll body, not cleanly unit-testable here), backed by a source-guard that the poll path sets only the count.

Pure-helper loaders run **inside each test** so the not-yet-created `lib/liveUpdates.js` fails that test cleanly, not the runner.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 new posts → "N new" with correct count | T3, T5 (count), T6 (poll sets count) | pure + source guard |
| AC2 tap → loads + clears | T8 (pill onClick → loadPosts + reset) | source guard |
| AC3 nothing injected / no shift while available | source-guard (poll sets only count) + **review** | source guard + review |
| AC4 nothing new → no affordance | T4 (count 0), T8 (pill gated on count>0) | pure + source guard |
| AC5 own just-sent post not counted | T2 (exclude viewer) | pure (real) |
| AC6 check unavailable → silent, manual reload works | T7 (document.hidden pause), T9 (try/catch silent; interval lifecycle) | source guard |

## Tests
- **T1** — `countNewPosts` excludes posts already displayed (id in displayedIds). *(fails now)*
- **T2** — excludes the viewer's own posts (author === viewer). *(fails now)*
- **T3** — counts a genuinely new post by another author. *(fails now)*
- **T4** — returns 0 when nothing is new (empty fresh, or all displayed). *(fails now)*
- **T5** — mixed set: displayed + own + two new-others → count 2. *(fails now)*
- **T6** — source guard: a poll path uses `fetchPostsForCommunity` + `countNewPosts` + `setNewCount`, gated on `tab === 'conversation'`. *(fails now)*
- **T7** — source guard: the poll skips when `document.hidden` (pauses when the page isn't visible). *(fails now)*
- **T8** — source guard: an "N new" pill renders gated on the count and its onClick calls `loadPosts` and resets the count. *(fails now)*
- **T9** — source guard: the poll uses `setInterval` with a matching `clearInterval` cleanup, and a `try/catch` so a failed check is silent. *(fails now)*

## Edge cases
- [x] Own post excluded (T2); already-displayed excluded (T1); mixed (T5).
- [x] Nothing new → no pill (T4 + T8).
- [x] Hidden page pause (T7); silent failure + interval teardown (T9).
- [ ] No-inject/no-shift — structural; verified at review.

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals `countNewPosts`, loaded inside tests to tolerate the new module.

## How to run
```
node test/test.js
# or: node -e "require('./test/offered-live-updates.test.js').run().then(r=>console.log(r))"
```

## Verification
The pure-helper tests fail (no `lib/liveUpdates.js` yet); the component guards fail (no poll/pill). Failing output pasted at the gate.
