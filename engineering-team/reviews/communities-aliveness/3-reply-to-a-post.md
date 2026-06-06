# Review: Story communities-aliveness/3 — Reply to a post

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** working-tree (uncommitted) on `feat/communities` @ `b06bf3cc`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. Overall PASS; `reply-to-a-post` suite **10/10** (T1–T10 all green). No regressions in any existing suite.
- [x] `npx eslint src/pages/CommunityDetail.jsx src/components/PostCard.jsx src/events/build.js src/events/fetch.js` — **clean, exit 0**.
- [ ] _Playwright — not applicable to this story._
- [ ] _Typecheck not configured — skipped (JS-without-build, per house rules)._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test (or is verified here for the items the test plan explicitly deferred to review).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story.

Per-AC verdict:

- **AC1 — reply nests one level under its post.** PASS. `buildCommunityPost` emits the reply tag shape (build.js:230-231); `projectRealEvent` surfaces `parentId` (fetch.js:95-103); the render groups under `repliesByParent[p.id]` and indents via `s.reply` (CommunityDetail.jsx:396-403, 690-699). Tests T2/T4/T5/T6/T9.
- **AC2 — reply shows author/body/time.** PASS. Replies render through the same `PostCard` (CommunityDetail.jsx:692), and `projectRealEvent` preserves `author`/`content`/`createdAt` alongside the new `parentId` (fetch.js:97-102; T5).
- **AC3 — reply-to-a-reply attaches at the same single level (THE deferred review item).** PASS, **one level guaranteed by construction** per ADR-0033 Option A. Two independent guarantees, both verified:
  1. *Client re-parent:* the Reply affordance is placed **only on top-level cards** (`topLevelPosts.map`, CommunityDetail.jsx:654-663). Reply cards (rendered at :690-699) get no `onReply`, so a reply can never open a composer. The composer that does open is `setReplyTarget({ id: p.id, author: p.author })` where `p` is iterated from `topLevelPosts` — `replyTarget` is therefore always a top-level post. `handleSendReply` parents exactly `replyTarget` (CommunityDetail.jsx:282-285, 305), so every reply points at a top-level post.
  2. *Structural fallback:* even if a reply's id were somehow passed as a parent, the grouping is a single non-recursive group-by `parentId` (no ancestry walk), so the deepest a reply can render is one level. There is no code path that nests a reply under another reply.
  Assessment of the "Reply only on top-level cards" approach: it is a **sound** way to guarantee one level — it makes the re-parent invariant unbreakable at the source (a reply target literally cannot be a reply) rather than policing it after the fact, which is exactly the spirit of Option A. The product tradeoff (no "reply to a specific reply" affordance) is the documented and accepted ADR consequence, and matches the flat one-level model where all replies are peers. Not a gap.
- **AC4 — signed-out → "Sign in to reply" prompt, no disabled control.** PASS. `replyHint={!signedIn ? 'Sign in to reply' : null}` and `onReply={canCompose && !p._status ? … : null}` (CommunityDetail.jsx:661-662). When signed out, `onReply` is null and `PostCard` renders the hint as a plain `<span>` (`replyHint`), never a disabled button (PostCard.jsx:52-60). T8.
- **AC5 — failed reply → inline error + retry, parent stays.** PASS. On failure the pending entry flips to `_status: 'error'` carrying `_text` and `_parent` (CommunityDetail.jsx:307-311); the reply still renders via `PostCard` with `error`/`onRetry` (:695-696). `handleRetryPending` reopens the **reply** composer to the correct parent when `entry._parent` is present, else refills the main composer (:330-338). The parent top-level post is untouched and stays visible. T7.
- **AC6 — scoped to circle + parent, never top-level, no leak.** PASS. A reply keeps uppercase `A`/`K`/`P` = community root (build.js:221-225), so it stays in the `#A` query and in-circle; it carries a lowercase `e` → non-null `parentId`, so `topLevelPosts.filter(p => !p.parentId)` excludes it (CommunityDetail.jsx:396). A given post is either in `topLevelPosts` or in exactly one `repliesByParent` bucket — never both. T2.

## ADR adherence (ADR-0033, Option A)

- [x] Files changed match the ADR implementation notes exactly: `build.js`, `fetch.js`, `CommunityDetail.jsx`, `CommunityDetail.module.css`, plus `PostCard.jsx`/`PostCard.module.css` for the affordance (a reasonable, ADR-consistent placement of the "Reply" control on the card).
- [x] **Reply tag shape (build.js:219-235):** uppercase `A`/`K`/`P` = community root retained; for a reply, lowercase becomes `['e', parent.id, '', parent.author]` + `['k','1111']` + `['p', parent.author]`, with **no lowercase `a`** (T2 asserts `!tag(ev.tags,'a')`). Top-level branch unchanged (`a`/`k`/`p` = community; T1). Matches the ADR's prescribed transform.
- [x] **Guard (build.js:210-213):** rejects an incomplete parent (`!parent.id || !parent.author`). T3.
- [x] **projectRealEvent (fetch.js:94-103):** `parentId = (eTag && eTag[1]) || null`; finds the first lowercase `e`; top-level → null. Author/content/createdAt intact. No read-filter change (the `#A` filter at fetch.js:53 is untouched). Defensive `Array.isArray(ev.tags)` added (fetch.js:96) — minor hardening, harmless.
- [x] **One level by construction** (re-parent to top-level post) — see AC3 above.
- [x] **Gate reuse:** who-may-reply reuses `canCompose` (CommunityDetail.jsx:661), which includes the ADR-0032 degraded fallback (:414-416). No new permission logic introduced. T10.
- [x] **Optimistic/pending:** pending reply carries `parentId` so it nests immediately (CommunityDetail.jsx:294); success filters the local entry and `loadPosts()` re-fetches (:312-313); failure path mirrors `handleSendPost` (:307-311). Correct.
- [x] **Edge — missing parent:** a reply whose `parentId` isn't in the fetched set falls out of `topLevelPosts` and lands in a `repliesByParent` bucket that is never rendered (no matching top-level post) → it silently disappears rather than rendering as top-level. The ADR's stated graceful-degradation intent was "renders as top-level," and Option A makes this near-impossible in practice (parents are always top-level posts in the same `#A` query). This is a **theoretical, non-blocking** divergence from the ADR's prose, not a real defect. Noted below.
- [x] No new dependencies. No concept-graph / firmware change (correct — none needed).

## Concept-graph integrity

- [x] No concept definitions changed; no handles introduced; no firmware reinstall needed (consistent with ADR "Firmware reinstall required? No").
- [x] N/A — no new code reads BIBLE.md or concept summaries.

## Things tests can't catch

- [x] No secrets committed.
- [x] No leftover debug logging / `console.log` in the source changes.
- [x] No commented-out code.
- [x] Error paths handled (reply failure → inline error + retry; incomplete parent → throw).
- [x] Concurrency: `replySending` guards re-entry (CommunityDetail.jsx:281); optimistic entries keyed by a unique `_localId`. No shared-state race.
- [x] Security: no new input crosses a trust boundary; `parent.id`/`parent.author` are taken from already-fetched events; builder validates presence. No injection vector.

## House rules check

- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.
- [x] **Token-based CSS, no hardcoded colors.** All new CSS uses tokens (`--space-2/3/5`, `--border`, `--accent`, `--text-sm`, `--text-faint`) — PostCard.module.css:88-110, CommunityDetail.module.css:201-216. No hardcoded color/length values.
- [x] **Copy in peer voice, no protocol jargon.** "Reply", "Sign in to reply", "Write a reply", "Cancel", "Sending…" — all plain, verb-first, no "comment/thread/parent/declaration" jargon surfaced to the user. Conforms to the V2 style guide (button labels verb+noun; "Reply" is explicitly sanctioned at style-guide line 30).

## Test integrity

- [x] **T7 broadening (`parent: {` → `parent\s*[:=]\s*\{…author`).** Sound, not a weakening. The implementation uses `const parent = { id: replyTarget.id, author: replyTarget.author }` (CommunityDetail.jsx:285) — shorthand object assignment, not a property literal. The original `parent: {` pattern would have missed the real code. The broadened regex still requires an object form containing `author` within 80 chars, so it cannot be satisfied by the pre-existing bare `community.parent` / `resolveDefinition` token (which has no adjacent `{…author`). It tightens *and* generalizes correctly.
- [x] **Real-source layers exercise shipped code.** T1–T3 load the actual `buildCommunityPost` body via extract-and-eval (`loadExport`, reply-to-a-post.test.js:48) and T4–T5 load the real `projectRealEvent` (`loadLocalFn`, :82). Both run the genuine shipped functions, not reimplementations. T6–T10 are source-guards over the real `CommunityDetail.jsx`. Coverage map honored; the one item the plan deferred to review (AC3 re-parent logic) is verified above.
- [x] Fail-first claim is credible: the new `parent` handling, `parentId`, and reply UI did not exist before this change.

## Findings

### Blocking
_None._

### Non-blocking
1. **CommunityDetail.module.css:206-209 (reply indent tokens)** — The V2 design guide (`communities-v2-design-guide.md:21`) specifies the reply nest as a **`--space-4` indent with a left rule in `--bg-hover`**, and the mobile rule (:83) reduces the indent to `--space-3`. The implementation uses `margin-left: --space-5` + `padding-left: --space-3` with a `2px solid --border` rule, and adds no mobile reduction. It is fully token-based (guardrail satisfied) and visually one-level-indented (AC met), but the exact token choices and the missing mobile indent reduction deviate from the design guide. Optional improvement: align to `--space-4` / `--bg-hover` and add the `<640px` `--space-3` indent to match the documented spec, or have the designer ratify the chosen tokens.
2. **CommunityDetail.jsx:396 (missing-parent render)** — A reply whose `parentId` is absent from the fetched set is currently dropped from the view (its `repliesByParent` bucket is never rendered), whereas ADR-0033 Consequences describe it rendering "as top-level (graceful degradation)." Near-impossible under Option A, so practically immaterial. Optional improvement: if a future story relaxes the re-parent guarantee, fold orphan-bucket replies back into `topLevelPosts` to honor the ADR's stated fallback.
3. **Out-of-scope edits in the working tree** — the diff also touches `engineering-team/audits/communities-v2/book.md` and `engineering-team/epics/communities-notifications.md` (resolving PRD §11 Q6 / unblocking Story 7). These are unrelated to Story 3 and should not ride along in this story's commit. Recommend committing them separately. Not a code concern.

## Verdict

**PASS** — All six acceptance criteria are met with passing tests; the key deferred item (AC3 one-level-by-construction) is verified sound: placing the Reply affordance only on top-level cards makes the re-parent invariant unbreakable, and the single group-by renderer cannot produce a second nesting level. ADR-0033 Option A is implemented faithfully (tag shape, guard, projection, gate reuse, optimistic path all correct). Tests pass 10/10, lint clean, no regressions. The three findings are non-blocking: a design-guide token/mobile-indent deviation (CSS is still token-based and one-level), a theoretical missing-parent render divergence that Option A renders moot, and unrelated harness-doc edits that should be committed separately.
