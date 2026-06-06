# Test Plan: Story 3 — Reply to a post

**Story:** `engineering-team/stories/communities-aliveness/3-reply-to-a-post.md`
**ADR:** `engineering-team/decisions/communities-aliveness/0033-reply-threading.md`
**Date:** 2026-06-06

## Approach
New suite `test/reply-to-a-post.test.js`, registered in `test/test.js`. Two strong layers run the **real source** via the repo's extract-and-eval pattern (the same `new Function` technique `membership-assertion.test.js` uses), plus source-guards over `CommunityDetail.jsx` for the component wiring (the repo convention, cf. `posting-gate.test.js` T6 and `post-to-cd-circle.test.js`):

- **Builder (real `buildCommunityPost` from `events/build.js`):** the correctness core — reply tag shape.
- **Projection (real `projectRealEvent` from `events/fetch.js`):** the read gap — `parentId` reaches the client.
- **Component source-guards (`CommunityDetail.jsx`):** reply composer wiring, the "Sign in to reply" prompt, gate reuse, one-level re-parent.

Fail-first: the builder ignores a `parent` arg today (reply tags absent → T2/T3 fail); the projection has no `parentId` today (T5 fails); the component has no reply UI today (T6–T9 fail).

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 reply nests one level under its post | T2 (reply tags), T4/T5 (parentId), T6 (grouping) | builder + projection (real) + source guard |
| AC2 reply shows author/body/time | T5 (projection carries author/content/createdAt for replies), T10 (PostCard reused) | projection (real) + source guard |
| AC3 reply-to-reply attaches same level (one level) | T2 (reply parents a comment), T6 (group by parentId), T9 (one-level nesting class) — and the client re-parent logic verified at **review** (component logic, not cleanly unit-testable here) | builder (real) + source guards + review |
| AC4 signed-out → "Sign in to reply" prompt | T8 | source guard |
| AC5 failed reply → inline error + retry, parent stays | T7 (reply uses the pending/retry path) | source guard |
| AC6 reply scoped to circle, not top-level, no leak | T2 (keeps uppercase `A` root; has lowercase `e` so non-top-level) | builder (real) |
| (regression) top-level post unchanged | T1 | builder (real) |
| (guard) reply builder validates parent fields | T3 | builder (real) |

## Tests
- **T1** — `buildCommunityPost` with no `parent`: top-level shape unchanged (uppercase `A`/`K`/`P` + lowercase `a`/`k`/`p` = community; no lowercase `e`). *(regression; passes now)*
- **T2** — `buildCommunityPost` with `parent = {id, author}`: keeps uppercase `A`/`K`/`P` (community root); lowercase parent points at the comment — has `['e', parentId, '', parentAuthor]`, lowercase `k === '1111'`, lowercase `p === parentAuthor`; **no** lowercase `a`. *(fails now)*
- **T3** — `buildCommunityPost` with a `parent` missing `id` or `author` throws. *(fails now)*
- **T4** — `projectRealEvent` on a top-level event (no `e` tag) → `parentId === null`. *(fails now: field absent)*
- **T5** — `projectRealEvent` on a reply event (lowercase `e` present) → `parentId === <parent id>`, and `author`/`content`/`createdAt` still projected. *(fails now)*
- **T6** — source guard: `CommunityDetail.jsx` groups posts by `parentId` (consumes the projected field for nesting). *(fails now)*
- **T7** — source guard: a reply parent object (with `author`) is constructed for the send — accepts `parent: { … }` or `parent = { … }`, scoped to the object form, not the bare token "parent" which already appears for `community.parent`. *(fails now)*
- **T8** — source guard: a "Sign in to reply" prompt exists for signed-out viewers. *(fails now)*
- **T9** — source guard: replies render at one indented level via the dedicated nesting class (`s.reply`). *(fails now)*
- **T10** — source guard: replies render with the same post fields/component as top-level posts (author/body/time). *(fails now)*

## Edge cases
- [x] Reply-to-reply re-parents to top-level (T2 + T9).
- [x] Top-level vs reply distinguished purely by presence of lowercase `e` (T4/T5).
- [x] Scoping: reply keeps uppercase `A` root, so it stays in-circle and never reads as top-level (T2).
- [ ] Missing-parent reply renders gracefully as top-level (Option A makes this near-impossible; not separately tested).

## Test infrastructure
- Runner: `node test/test.js` (CommonJS; new suite `reply-to-a-post.test.js` exports `{ run }`, registered in `test/test.js`). Real-source layers use the `export function` / `function` extract-and-eval pattern (cf. `membership-assertion.test.js`).
- No Concept Graph / firmware preconditions.

## How to run
```
node test/test.js
# or just this suite:
node -e "require('./test/reply-to-a-post.test.js').run().then(r=>console.log(r))"
```

## Verification
The builder/projection tests fail against current source (no `parent` handling, no `parentId`), and the component guards fail (no reply UI). Failing output pasted at the gate.
