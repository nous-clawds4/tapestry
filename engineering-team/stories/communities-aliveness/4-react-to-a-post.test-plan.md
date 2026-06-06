# Test Plan: Story 4 — React to a post

**Story:** `engineering-team/stories/communities-aliveness/4-react-to-a-post.md`
**ADR:** `engineering-team/decisions/communities-aliveness/0034-post-reactions.md`
**Date:** 2026-06-06

## Approach
New suite `test/react-to-a-post.test.js`, registered in `test/test.js`. The correctness core is two pure functions, tested against **real source** via extract-and-eval:
- `buildReaction` (`events/build.js`) — kind-7 tag shape + `+`/`-` content.
- `summarizeReactions` (`lib/reactions.js`, new) — the exact-count + toggle aggregation.

Component wiring (CommunityDetail, PostCard) and the fetch are covered by source-guards (repo convention). **Loaders run inside each test** (not at module top), so a not-yet-created `lib/reactions.js` or a missing export fails that test cleanly rather than crashing the runner at require-time.

Fail-first: no reaction code exists, so the builder/aggregation loaders throw (T1–T8 fail) and the component/fetch guards fail (T9–T11).

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 react → count +1, mine active | T4 + T6 (count/mine), T1 (`+` event), T10 (toggle wired) | pure + source guard |
| AC2 tap again → removed, count −1 | T2 (`-` event), T5 (latest-per-reactor un-react) | pure (real) |
| AC3 own reaction visually distinct | T6 (mine flag), T11 (PostCard renders mine distinctly) | pure + source guard |
| AC4 counts exact = distinct reactors | T7 (dedupe per reactor), T8 (N reactors → count N) | pure (real) |
| AC5 signed-out: counts visible, react prompts sign-in | T11 (count rendered regardless), T10 (gate on canCompose / sign-in) | source guard |
| AC6 failed (un)react non-blocking, last-known-good | T10 (optimistic revert path present) | source guard |
| (scope) reactions queryable per-circle | T1 (uppercase A tag), T9 (fetch by kind 7 + #A) | pure + source guard |

## Tests
- **T1** — `buildReaction({active:true})`: kind 7, content `'+'`, tags `['A', communityATag]`, `['e', postId, '', postAuthor]`, `['p', postAuthor]`, `['k','1111']`. *(fails now)*
- **T2** — `buildReaction({active:false})`: content `'-'`. *(fails now)*
- **T3** — `buildReaction` with a post missing `id`/`author` throws. *(fails now)*
- **T4** — `summarizeReactions`: two distinct reactors `+` on a target → `count===2`. *(fails now)*
- **T5** — latest-per-reactor: a reactor whose latest is `-` is not counted (un-react). *(fails now)*
- **T6** — `mine`: viewer's latest `+` → `mine===true`; latest `-` → false; absent → false. *(fails now)*
- **T7** — dedupe: the same reactor with multiple `+` events counts once. *(fails now)*
- **T8** — exact: N distinct `+` reactors → `count===N` (no inflation/rounding). *(fails now)*
- **T9** — source guard: `fetchReactionsForCommunity` queries `kinds: [7]` with `'#A'`. *(fails now)*
- **T10** — source guard: CommunityDetail wires a reaction toggle that builds via `buildReaction`, derives via `summarizeReactions`, gates on `canCompose`, and reverts optimistically on failure. *(fails now)*
- **T11** — source guard: PostCard renders a reaction control with an exact count and a distinct "mine" state. *(fails now)*

## Edge cases
- [x] Un-react after react (T5); double-react same reactor (T7).
- [x] Viewer not a reactor (T6 absent case).
- [x] Exact count with many reactors (T8).
- [ ] Reaction whose target post isn't loaded — summarized but not rendered (benign).

## Test infrastructure
- Runner: `node test/test.js` (CommonJS; suite exports `{ run }`, registered in `test/test.js`). Real-source layers use the `export function` extract-and-eval pattern, **loaded inside each test** to tolerate the not-yet-created module.

## How to run
```
node test/test.js
# or: node -e "require('./test/react-to-a-post.test.js').run().then(r=>console.log(r))"
```

## Verification
Builder/aggregation tests fail (no `buildReaction`/`summarizeReactions` yet); component/fetch guards fail (no reaction UI/fetch). Failing output pasted at the gate.
