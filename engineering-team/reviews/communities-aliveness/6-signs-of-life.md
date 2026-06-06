# Review: Story 6 — Signs of life on a circle

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** working-tree changes atop `2d19c286` (Story 5 review, PASS)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS** (Overall: PASS). New `signs-of-life` suite **11/11**; relocated `post-to-cd-circle` suite **3/3**; no regressions across the full suite.
- [x] `npx eslint` on the six changed UI files — **exit 0** (clean), confirmed via `$?`.
- [ ] _Playwright — not applicable to this story (offline pure-function + source guards)._
- [ ] _Typecheck not configured — skipped (JS-without-build, per house rules)._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
  - **AC1** (active + weekly count): T1 (`Active today · 2 posts this week`), T2 (`Active this week · 1 post this week`), T8 (count exactness).
  - **AC2** (dormant, calm): T3 (`Quiet lately · last post 3 weeks ago`); CSS is muted/token-based, no urgency styling.
  - **AC3** (brand-new): T4 (`New circle · founded today`).
  - **AC4** (renders on detail + cards): T10 (card `activityLine`), T11 (detail), confirmed in source at `CommunityDetail.jsx:547` and `CommunityCard.jsx:52`.
  - **AC5** (omit-don't-guess): T6 (no data → null), T7 (no `now` → null). Both render sites map a failed/empty fetch to `now: 0` → `describeActivity` receives `now: null` → returns null. Verified `Discover.jsx:72` and `CommunityDetail.jsx:283` `.catch(...)` set `now: 0`.
  - **AC6** (recency by text, not color): the phrase carries recency; both CSS classes are color-token-only with no semantic color. T1–T4 assert the literal text.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. Out-of-scope items (real-time updates, grid sort/filter, trust signal) untouched.

## ADR adherence (ADR-0036)
- [x] Files changed match the ADR's implementation notes exactly: new `lib/activity.js` (pure `describeActivity` + inlined `rel`/`countLabel`), new `lib/circle.js#circleATag`, `events/fetch.js#fetchActivityForCircles`, `Discover.jsx`, `CommunityCard.jsx`, `CommunityDetail.jsx`, two `.module.css`.
- [x] **Pure description.** `describeActivity` (`activity.js:12`) takes `{ postTimes, foundedAt, now }`, returns string | null. Thresholds match the ADR: `now == null → null`; `age <= DAY → Active today`; `age <= WEEK → Active this week`; else `Quiet lately · last post {rel}`; no posts + `foundedAt` within WEEK → `New circle · founded {rel}`; else + `foundedAt` → `Quiet · no posts yet`; else null. `recentCount = times.filter(t => now - t <= WEEK)` — counts only posts within the last week (T8 proves the 10-day-old post is excluded).
- [x] **One batched grid query.** `fetchActivityForCircles` (`fetch.js:147`) issues a single `{ kinds:[1111], '#A': tags, limit: 300 }` filter, buckets each event by its uppercase `A` tag into `Map<aTag, number[]>`. `Discover.jsx:69-72` calls it **once** with all circles' tags — not N per-card fetches. The accepted limit:300 crowding tradeoff (a very active circle can push a dormant circle's latest post out of the grid window → coarser grid line, precise detail) is correctly documented in the ADR Consequences and is acceptable for v1.
- [x] **`now` purity.** `Date.now()` appears only inside `.then(...)` fetch-time callbacks (`Discover.jsx:71`, `CommunityDetail.jsx:282`) and in pre-existing event-builders inside handlers — never during render. Render reads `activity.now` / `detailActivity.now` from state. The react-hooks/purity trap from Stories 4/5 is avoided; eslint is clean.
- [x] **Detail independence.** The detail signs-of-life effect (`CommunityDetail.jsx:278`) has deps `[currentCommunity, communityATag]` — **not** `tab`. It is not gated on the Conversation tab being opened. Verified it is a separate effect from the tab-gated poll at line 261.
- [x] **Reactions excluded.** `fetchActivityForCircles` filters `kinds:[1111]` only (`fetch.js:152`); the kind-7 reaction fetch is a separate function. `lastActivity`/`recentCount` derive from posts+replies only, honoring the ADR's honest-to-"posts" constraint.
- [x] **USE_MOCK / failure paths.** `fetchActivityForCircles` returns an empty map under `USE_MOCK` or empty tags; relay-connect failures are swallowed in `collectFromRelay` (warn + resolve), so a failed fetch yields an empty/partial map → cards still render, lines fall back to founded-based or omit. Cross-relay dedup is by `ev.id`, so a post on multiple relays is counted once.
- [x] No new dependencies. No new lint/build tooling.

## circleATag refactor + test-guard relocation (scrutinized)
- [x] **(a) Behavior preserved.** `circleATag` (`circle.js:8`) reproduces the old inline logic: declaration → `39998` keyed on `founder` (never the viewer); bespoke → `39999` keyed on `founder || curator || viewerFallback`. The bespoke viewer fallback is passed as `circleATag(currentCommunity, viewer)` at `CommunityDetail.jsx:215`. Declaration founder-only rule intact.
- [x] **(b) `communityATag` identity.** Old IIFE: `!currentCommunity → null`, build kind/author, `!author → null`, else `${kind}:${author}:${slug}`. New helper adds one guard: `!circle.slug → null`. On the real detail path the circle is loaded *by* slug, so slug is always present and the result is byte-identical. The only behavioral change is the unreachable-in-practice slug-missing case, where the old code produced a malformed `kind:author:undefined` coordinate and the new code returns `null` — a strict improvement (omit a bad address rather than emit one), not a regression. Discover calls `circleATag(c)` with no viewer fallback and `.filter(Boolean)` drops nulls.
- [x] **(c) Test relocation preserves intent, not a weakening.** Story 41's `post-to-cd-circle.test.js` T1 originally pinned the `39998:39999` ternary in `CommunityDetail.jsx`. It now (1) asserts the ternary lives in `circle.js` (where it moved) **and** (2) adds a new assert that `CommunityDetail` derives its anchor via `circleATag(`. That is *stronger* than the original (it pins both the moved logic and the call-site wiring), so the guard is not gamed. T2/T3 (posting wiring, read path) are unchanged. Suite passes 3/3.

## Concept-graph integrity
- [x] Handles remain `kind:pubkey:slug` form (`39998:founder:slug` / `39999:author:slug`) — produced by `circleATag`, unchanged shape.
- [x] No concept definitions changed → no firmware reinstall required (ADR confirms "No").
- [x] No new code re-reads BIBLE.md; pure helper + relay fetch only.

## Real-source tests
- [x] T1–T8 extract-and-eval the genuine `describeActivity` from `lib/activity.js` via `loadExport` (regex captures the exported function, `new Function` evals it). The function is self-contained (helpers inlined) so the standalone eval exercises shipped code, not a copy. Confirmed all 8 pass against the real source.
- [x] T9–T11 are source guards on the actual fetch + both render sites.
- [x] Suite is registered in `test/test.js` (require, run, summary line, and `signsOfLifeResult.fail === 0` folded into `overallOk`).

## Things tests can't catch
- [x] No secrets committed.
- [x] No leftover debug logging (the one `console.warn` in `collectFromRelay` is pre-existing relay-connect diagnostics, not new).
- [x] No commented-out code.
- [x] Edge cases handled: empty postTimes, missing `now`, missing `foundedAt`, missing slug, non-array postTimes (`Array.isArray` guard at `activity.js:22`), non-number `created_at` (coerced to 0 at `fetch.js:160`), cross-relay dedup, limit:300 crowding (ADR-accepted).
- [x] Threshold boundaries consistent: `age <= DAY`/`<= WEEK` in `describeActivity` align with the strict-`<` boundaries in `rel()` (at exactly DAY the active branch wins before `rel` is reached); `recentCount` uses `<= WEEK` matching the ADR.
- [x] No race conditions: both effects use a `cancelled` flag in cleanup.

## House rules check
- [x] Concept Graph API authority respected (no domain-concept changes).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`CommunityCard.module.css:151`** — the card uses `--text-faint` while the design guide specifies `--text-muted` for the signs-of-life line and the detail page (`CommunityDetail.module.css:248`) uses `--text-muted`. The fainter card variant is defensible for the denser card context and stays within the calm/muted intent, but the two surfaces are slightly inconsistent with each other and with the guide. Optional: align the card to `--text-muted`, or leave as a deliberate density choice.
2. **Loading state** — the design guide mentions a short line shimmer while activity loads; the implementation omits the line until loaded (renders nothing). This is the calmer, omit-don't-guess behavior the ADR chose and avoids a flash; noted only as a documented divergence from the guide's loading note, not a defect.
3. **Discover founded-line reach** — on the grid, the `New circle` / `Quiet · no posts yet` founded lines only appear if merged circle summaries carry `_createdAt`; where absent it falls to an honest omit (`c._createdAt || null`). Correct per AC5 (omit, never guess); flagging so the product team knows the grid founded-line depends on summary projection carrying the founded date.

## Verdict
**PASS** — The implementation matches the story's six acceptance criteria (each with a passing real-source or guard test), conforms to ADR-0036 (pure `describeActivity`, one batched grid query, `now`-at-fetch purity, tab-independent detail fetch, reactions excluded, omit-on-failure), and the `circleATag` extraction is behavior-identical with a strict-improvement on the unreachable slug-missing edge. The test-guard relocation is strengthened, not weakened. Full suite PASS (signs-of-life 11/11, post-to-cd-circle 3/3), eslint exit 0. The three non-blocking notes are cosmetic/documentation-level.
