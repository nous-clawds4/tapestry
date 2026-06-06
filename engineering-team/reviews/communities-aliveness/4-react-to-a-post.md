# Review: Story 4 — React to a post

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** `git diff` (uncommitted working tree) + untracked `ui-communities/src/lib/reactions.js`, `test/react-to-a-post.test.js`, story/ADR/test-plan docs

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (`node test/test.js`) — **PASS**, real exit code 0. Overall PASS; `react-to-a-post suite: PASS (11 passed, 0 failed)`; all other suites green (`reply-to-a-post` 10/10, `posting-gate` 11/11, etc.).
- [x] `npx eslint src/pages/CommunityDetail.jsx src/components/PostCard.jsx src/events/build.js src/events/fetch.js src/lib/reactions.js` — **exit 0** (verified via explicit `$?`, not a piped tail).
- [ ] `npm run test:playwright` — not applicable (no browser flow added).
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story.

| AC | Verdict | Evidence |
|---|---|---|
| AC1 react → count +1, mine active | PASS | `build.js:249` `content: active ? '+'`; T1/T4/T6; toggle wired `CommunityDetail.jsx:352-368`, count derived `:457`. |
| AC2 tap again → `-`, count −1 | PASS | T2 (`-` content), T5 (latest-per-reactor un-react drops count); `active = !mine` `CommunityDetail.jsx:357`. |
| AC3 own reaction visually distinct + a11y | PASS | `PostCard.jsx` `reactMine` class + `aria-pressed={reactionMine}` + accent border `PostCard.module.css:115-118`. State conveyed by more than color (aria-pressed + outline) — meets V1 color-independence rule. |
| AC4 exact count = distinct reactors | PASS (scrutinized hardest) | `reactions.js:13-36` latest-per-reactor (max `createdAt`, `>=` tiebreak), count = reactors whose latest `=== '+'`. T7 (dedupe), T8 (N→N). See analysis below. |
| AC5 signed-out: counts visible, react prompts sign-in | PASS | Button renders on `onToggleReaction` presence regardless of `canReact` (`PostCard.jsx`); `handleToggleReaction` calls `onSignIn()` when `!signedIn` (`CommunityDetail.jsx:353`). No disabled control. `onSignIn` sourced from outlet context (App.jsx:152). |
| AC6 failed (un)react non-blocking | PASS | `CommunityDetail.jsx:364-366` reverts the exact optimistic entry by `_localId` on `!result.ok`; post stays rendered; reaction-fetch failure also non-fatal (`:222`). |

## ADR adherence (ADR-0034)

- [x] Files match implementation notes exactly: `build.js` (`buildReaction`), `fetch.js` (`fetchReactionsForCommunity` + `projectReaction`), `lib/reactions.js` (new, pure `summarizeReactions`), `CommunityDetail.jsx` (parallel load + `handleToggleReaction`), `PostCard.jsx` + `.module.css`.
- [x] `buildReaction` shape matches ADR: kind 7, content `+`/`-`, tags `['A', communityATag]`, `['e', post.id, '', post.author]`, `['p', post.author]`, `['k','1111']`, guards on viewerPubkey/communityATag/post.id/post.author, uses `nowSec()`. (`build.js:249-269`)
- [x] Fetch uses `{ kinds: [7], '#A': [communityATag] }`, same relay-collect pattern as posts; projects `{ targetId, reactor, content, createdAt }` with lowercase-not-applied — note `e` tag is taken verbatim (see non-blocking #2). (`fetch.js:113-138`)
- [x] Aggregation is the pure, testable core exactly as specified; `mine` = viewer's latest is `+`.
- [x] Gate reuse: reacting reuses `canCompose` (`CommunityDetail.jsx:354,720,758`); no new permission logic.
- [x] Scope: uppercase `A` tag → circle-scoped; fetched via `#A`. (T1, T9)
- [x] Single reaction type (no palette). No new dependencies.
- [x] Firmware reinstall: N/A (no concept changes), as ADR states.

## Concept-graph integrity
- [x] No concept handles touched; `kind:pubkey:slug` form not involved.
- [x] No firmware changes.
- [x] No BIBLE.md re-derivation.

## Focused correctness analysis

**Exact-count invariant (AC4 — the headline).** `summarizeReactions` (`reactions.js:13-36`) builds `targetId → reactor → {content, createdAt}`, keeping max-`createdAt` per reactor (`>=` so a later-in-array entry wins on a tie). Count = distinct reactors whose surviving entry is `'+'`. This is deduped-by-reactor by construction; no inflation possible. T7 (same reactor twice → 1) and T8 (7 distinct → 7) lock it. Confirmed honest per design principle 7 / style guide ("exact and small, never inflated or rounded").

**Optimistic dedup correctness.** The summary is computed over `[...reactions, ...optimisticReactions]` (`CommunityDetail.jsx:355,457`). A local reaction and a later refetched REAL reaction for the same reactor+target do **not** double-count — `summarizeReactions` collapses them to one reactor entry. Because optimistic entries are appended last AND carry a current-time `createdAt` (`>=` real entries), the optimistic state always wins the tiebreak, so the toggle reflects immediately and survives the refetch race. Revert-on-failure (`:365`) filters by `_localId`, removing exactly the optimistic entry just added — verified correct.

**Rapid double-toggle.** Two fast taps append `+` then `-`; the later entry wins (array order + `>=`). If the first publish fails after the second succeeds, the `_localId` filter removes only the failed entry, leaving the winning state intact. No corruption.

**Edge cases.** Reactions apply uniformly to top-level posts (`CommunityDetail.jsx:715-720`) and replies (`:753-758`) — both get the same four props, matching the story's "both are posts." A reaction whose target post isn't loaded is summarized but never rendered (keyed lookup `reactionSummary[p.id]`) — benign, matches the test plan. Pending/optimistic posts get `reactionCount=0`, `reactionMine=false`, `onToggleReaction=null` (`p._status` guard) — reactions render for real posts only, per the audit requirement.

**The two mid-implementation corrections.**
1. T6 fix to `summarize(...)[POST_ID].mine` — the source `summarizeReactions` returns `{ [targetId]: { count, mine } }`, so `mine` is correctly nested under the target id. The earlier top-level `.mine` access was the test's bug; the implementation was right. The corrected T6 (`reactions.test.js:81-87`) exercises the real shape and still covers all three mine cases (latest `-` false, non-reactor false, latest `+` true). Coverage not weakened. **Legitimate.**
2. Module-scope `makeOptimisticReaction` (`CommunityDetail.jsx:40-53`) — moving `Date.now()`/`Math.random()`/`crypto.randomUUID()` out of render scope to satisfy `react-hooks/purity`. It is called inside the async event handler, not render, so behavior is identical; eslint now clean (exit 0). **Legitimate fix, not gaming** — it resolves a real impurity flag without altering logic.

**Real-source tests.** T1–T8 load `buildReaction`/`summarizeReactions` via extract-and-eval inside each test (`react-to-a-post.test.js:25-32, 41, 65`), so they exercise shipped source, not fixtures. T9–T11 are source-guards on fetch/CommunityDetail/PostCard. Confirmed genuine.

## Things tests can't catch
- [x] No secrets committed.
- [x] No leftover `console.log` / debug logging in the reaction paths.
- [x] No commented-out code.
- [x] Error paths handled (publish failure revert; reaction-fetch failure non-fatal).
- [x] Concurrency: optimistic race + rapid toggle analyzed above — sound.
- [x] Input validation at the boundary: `buildReaction` guards; `projectReaction` drops events with no `e`/`e[1]`.

## House rules check
- [x] Concept Graph API authority respected (untouched).
- [x] No new lint/typecheck/build tooling.
- [x] CSS is token-based — `var(--bg-hover)`, `var(--accent)`, `var(--text-secondary)`, `var(--radius-full)`, `var(--text-sm)`, `var(--space-*)`. No hardcoded colors. (One literal `gap: 5px` — non-token spacing, see non-blocking #3.)
- [x] Copy is honest, no AI-slop, no vanity surface.

## Findings

### Blocking
None.

### Non-blocking
1. **`PostCard.jsx` `aria-label`** — produces "3 likes, you reacted". The v2 design guide §a11y (line 91) specifies the accessible name "3 like reactions, you reacted". The wording differs ("likes" vs "like reactions"). The state is still fully conveyed non-visually (aria-pressed + count + "you reacted"), so this is a copy nit, not an a11y failure. Optional: align wording to the guide.
2. **`fetch.js:130` `projectReaction`** — the ADR's fetch note says "project each as `{ targetId: <lowercase e>, ... }`", but `targetId: eTag[1]` is taken verbatim (no `.toLowerCase()`). `buildReaction` and post ids are already lowercase hex in this codebase, so in practice this never mismatches; but a reaction authored elsewhere with uppercase hex in its `e` tag would not match a loaded post id. Optional: lowercase `eTag[1]` to honor the ADR note literally and harden cross-client matching.
3. **`PostCard.module.css:107` `gap: 5px`** — a raw pixel value inside `.reactBtn` where the rest of the file uses `--space-*` tokens. Cosmetic; optional to tokenize.
4. **`CommunityDetail.jsx` `optimisticReactions` growth** — after a successful publish, `loadPosts()` refetches real `reactions` but optimistic entries are never pruned, so the array grows by one per toggle for the session's life. Counts stay correct (dedup by reactor + latest-wins), and it resets on navigation/remount, so this is a minor, bounded memory note, not a correctness bug. Optional: clear matched optimistic entries on successful refetch.

## Verdict
**PASS**

Reasoning: All six acceptance criteria are covered by passing tests against real source; `node test/test.js` is green (react-to-a-post 11/11, overall PASS, exit 0) and eslint is clean (exit 0). The implementation conforms to ADR-0034 file-for-file — the exact-count invariant is honest by construction (latest-per-reactor dedupe), the optimistic toggle never double-counts and reverts exactly on failure, the gate reuses `canCompose`, scope carries uppercase `A`, and the signed-out path prompts sign-in with no dead control. Both mid-implementation corrections (T6 object-level access fix; module-scope `makeOptimisticReaction` for `react-hooks/purity`) are legitimate and do not weaken coverage or correctness. The four findings are all non-blocking nits (copy wording, ADR-literal lowercasing, one non-token gap, bounded optimistic-array growth) that do not gate merge.
