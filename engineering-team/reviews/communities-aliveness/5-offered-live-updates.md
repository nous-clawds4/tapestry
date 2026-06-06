# Review: Story 5 — New posts are offered, not forced

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** working-tree (uncommitted) on `feat/communities` — tracked: `test/test.js`, `ui-communities/src/pages/CommunityDetail.jsx`, `ui-communities/src/pages/CommunityDetail.module.css`; new: `ui-communities/src/lib/liveUpdates.js`, `test/offered-live-updates.test.js`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. Overall PASS; `offered-live-updates suite: PASS (9 passed, 0 failed)`. No regressions in any sibling suite.
- [x] `npx eslint src/pages/CommunityDetail.jsx src/lib/liveUpdates.js` — **exit 0** (confirmed via explicit `$?`), no output.
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a test or a verified structural guarantee.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story.

AC-by-AC:

- **AC1 (new posts → "N new" with correct count).** Poll effect (`CommunityDetail.jsx:263-278`) fetches via `fetchPostsForCommunity`, computes the count via `countNewPosts`, and the pill renders `{newCount} new` when `newCount > 0` (`:745-757`). Count correctness covered by T3/T5; poll wiring by T6.
- **AC2 (tap → loads + clears).** Pill `onClick={() => { loadPosts(); setNewCount(0) }}` (`:749`). `loadPosts` also self-clears the count on completion (`:236`). Covered by T8.
- **AC3 (nothing injected / no shift while available).** **KEY ITEM — verified structurally.** The poll's `tick` (`:266-275`) calls **only** `setNewCount(...)`; it never references `setPostsState`, `setPending`, or any displayed-list setter. The fetched `fresh` array is consumed solely by `countNewPosts` and then discarded. Because the poll cannot write the rendered list, the displayed conversation cannot shift, replace, or be injected into while new posts are available — the invariant holds by construction, exactly as ADR-0035 specifies. New posts enter the view **only** through `loadPosts()`, which fires on the pill tap (`:749`), on first tab open (`:250`), on post-send (`:337`), and on reply-send (`:383`) — all user- or send-initiated. Backed by source-guard T6 (poll sets only count) plus this structural review.
- **AC4 (nothing new → no affordance).** `countNewPosts` returns 0 (T4); pill is gated on `newCount > 0` (`:745`), guard T8.
- **AC5 (own just-sent post not counted).** `countNewPosts` excludes `p.author === viewerPubkey` (`liveUpdates.js:22`); `viewer` is threaded into the poll call (`:271`). The viewer's sent post is already displayed via the post-send `loadPosts` (`:337`), and optimistic pending posts are local-only (never returned by a relay fetch). Covered by T2.
- **AC6 (check unavailable → silent, manual reload works).** The poll `try/catch` (`:268-274`) catches and does nothing — no state set, no error chrome. `loadPosts` (the manual path) is independent of the poll and keeps working. Covered by T7 (hidden pause) + T9 (interval lifecycle + silent catch). The catch is **not** an empty-block lint issue: it contains a comment, and eslint exited 0.

## ADR adherence

- [x] Files changed match ADR-0035's implementation notes: `CommunityDetail.jsx` (state + poll + pill), `CommunityDetail.module.css` (`.newPill`), reuse of `fetchPostsForCommunity`. No change to `fetch.js`/`build.js`.
- [x] Layering respected. No persistent-subscription machinery introduced (ADR-0010's one-shot direction honored — the poll reuses the existing one-shot fetch and is a *detector*, not a loader).
- [x] No new dependencies.
- [x] **`countNewPosts` extraction is sound, not a deviation.** The Tester factored the inline filter from the ADR's impl note into `lib/liveUpdates.js`. This is a faithful refinement (mirrors Story 4's `summarizeReactions`): the helper is pure, the exact same filter (`!displayed.has(id) && author !== viewer`), and it strengthens — not weakens — the design by making the exclude-displayed/exclude-own invariants unit-testable. The poll behavior is identical to the ADR's described tick.

Ref pattern / hooks correctness:

- `displayedIdsRef` is synced from `postsState.items` in a dedicated effect (`:255-257`) and read inside the poll. This correctly avoids both a stale closure on the displayed set **and** re-arming the interval on every fetch — the poll effect's deps (`tab, currentCommunity, communityATag, viewer`) deliberately exclude `postsState.items`, so the 25s interval is not torn down and rebuilt each load. Deps are complete for everything the effect actually closes over (`fetchPostsForCommunity`/`countNewPosts` are module imports; `currentCommunity.slug` is reached through `currentCommunity`). No missing/extra deps, no setState-in-render.
- `cancelled` guard (`:265`, checked at `:270`, set in cleanup `:277`) prevents setState-after-unmount and discards a poll that resolves after tab-change/unmount.
- `clearInterval` cleanup (`:277`) handles rapid tab switches — each effect re-run tears down the prior interval before arming a new one.

## Anti-capture / sovereignty (design principle 7)

- [x] No auto-inject (AC3, structural — above). No auto-scroll, no presence, no typing indicators, no read receipts introduced.
- [x] Poll pauses when `document.hidden` (`:267`), guarded with a `typeof document` check for non-browser safety.
- [x] Conservative cadence: 25s interval, matching the ADR's "~25s".
- [x] The pill is the only "live" surface; everything else updates on user action — matches design-guide §"signs-of-life pill" and principle 7.

## Concept-graph integrity

- [x] No concept definitions touched; handles untouched (the poll reuses the existing `kind:pubkey:slug` `communityATag` derivation).
- [x] No firmware reinstall required (ADR confirms).
- [x] No re-derivation from BIBLE.md.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging. The only `console.error` (`:238`) is pre-existing in `loadPosts`, not added by this story; the poll path logs nothing.
- [x] No commented-out code.
- [x] Error/edge paths handled: silent poll failure (AC6); own-post-after-send (excluded by author filter + post-send reload); replies from others — fetched posts include replies (`fetch.js:103` sets `parentId`), `displayedIdsRef` is synced from the **full** `postsState.items` (top-level + replies, `:476`), so a new reply by another author is correctly counted and is cleared on the tap-driven `loadPosts`. Count-correctness for the mixed case is T5.
- [x] Concurrency: a poll resolving after tab-change/unmount is dropped by `cancelled`; overlapping ticks only ever write a single integer (`newCount`), so no torn state.
- [x] Security: no new input boundary; the fetch is the same authenticated relay read already in use.

## Guardrails / style

- [x] Token-based CSS: `.newPill` uses `--accent`, `--accent-muted`, `--radius-full`, `--text-sm`, `--space-2` (all defined in `styles/tokens.css`). No hardcoded colors. The raw px (`padding: 5px 14px`, `min-height: 32px`) match the established small-control convention in the same module (`padding: 4px 10px`, `gap: 6px`) — not a guardrail violation.
- [x] Accessible: real `<button type="button">` with `aria-label="Load N new post(s)"` (pluralized), `min-height: 32px` touch target, hover affordance.
- [x] Honest copy: "N new" — no manufactured urgency, no red badge, no em-dash/declarative-negative issues. Matches the design guide's calm "3 new" affordance.

## Findings

### Blocking
None.

### Non-blocking
1. **`CommunityDetail.module.css:234,239`** — `.newPill` uses raw px (`5px 14px`, `min-height: 32px`). Consistent with sibling controls in this module, so acceptable; an optional future tidy could route these through space tokens if the module ever standardizes.
2. **`CommunityDetail.jsx:266-275`** — the poll re-fetches the full post list every 25s purely to derive a count (the ADR's accepted tradeoff). Fine for now; a future real-time upgrade (ADR Option B) would replace this. No action.

## Verdict
**PASS** — The diff matches the story's six acceptance criteria, conforms to ADR-0035 (and respects ADR-0010), and the test gate is clean (overall PASS, offered-live-updates 9/9; eslint exit 0). The central sovereignty guarantee (AC3, no auto-inject) holds structurally: the poll writes only `newCount` and never the displayed list, so the conversation cannot shift while new posts are available; new posts load only via the user-/send-initiated `loadPosts`. Hooks, ref-sync, cancel guard, and interval teardown are correct. The `countNewPosts` extraction is a sound, test-strengthening refinement of the ADR, not a deviation.
