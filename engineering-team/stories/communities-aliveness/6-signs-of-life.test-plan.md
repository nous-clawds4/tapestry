# Test Plan: Story 6 — Signs of life on a circle

**Story:** `engineering-team/stories/communities-aliveness/6-signs-of-life.md`
**ADR:** `engineering-team/decisions/communities-aliveness/0036-signs-of-life.md`
**Date:** 2026-06-06

## Approach
New suite `test/signs-of-life.test.js`, registered in `test/test.js`. The description is a pure function — tested against **real source** via extract-and-eval (loaded inside tests to tolerate the new `lib/activity.js`). The batched fetch and the two render sites (grid card, detail) are covered by source-guards.

The pure `describeActivity({ postTimes, foundedAt, now })` carries every output branch (active today / active this week / quiet-with-age / new circle / quiet-no-posts / omit) and the recent-count exactness — so the bulk of coverage is real, deterministic, and offline.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 recent activity → concrete "Active … · N posts this week" | T1, T2, T8 (count exactness) | pure (real) |
| AC2 dormant → "Quiet lately · last post N ago", calm | T3 | pure (real) |
| AC3 brand-new → "New circle · founded today" | T4 | pure (real) |
| AC4 renders on detail + discovery cards | T10 (card), T11 (detail) | source guard |
| AC5 data can't load → omit (no wrong/zeroed claim) | T6 (no data → null), T7 (now null → null) | pure (real) |
| AC6 recency by text, not color alone | T1–T4 (the phrase carries it) + T10 (rendered as text) | pure + source guard |
| (efficiency) one batched grid query | T9 | source guard |

## Tests
- **T1** — posts within a day → "Active today · 2 posts this week" (count = posts within the last week). *(fails now)*
- **T2** — newest post 2 days ago → "Active this week · 1 post this week". *(fails now)*
- **T3** — newest post 21 days ago → "Quiet lately · last post 3 weeks ago" (relative phrasing). *(fails now)*
- **T4** — no posts, founded ~1h ago → "New circle · founded today". *(fails now)*
- **T5** — no posts, founded 60 days ago → "Quiet · no posts yet". *(fails now)*
- **T6** — no posts, no founded date → `null` (omit). *(fails now)*
- **T7** — `now == null` → `null` (omit; no guessed claim). *(fails now)*
- **T8** — recent-count exactness: a within-week post + a 10-day-old post → "Active today · 1 post this week" (old one excluded). *(fails now)*
- **T9** — source guard: `fetchActivityForCircles` queries `kinds:[1111]` with `#A` and buckets per circle. *(fails now)*
- **T10** — source guard: Discover derives a line via `describeActivity` and `CommunityCard` renders an `activityLine`. *(fails now)*
- **T11** — source guard: CommunityDetail computes signs of life via `describeActivity` (using a fetch-time `now`, not `Date.now()` in render). *(fails now)*

## Edge cases
- [x] Within-day vs within-week vs quiet thresholds (T1/T2/T3).
- [x] No posts: new vs long-dormant (T4/T5).
- [x] Omit on no-data / no-now (T6/T7).
- [x] Count excludes old posts (T8).
- [ ] Grid coarseness when a circle's latest is beyond the batched window — ADR-accepted; not a unit test (detail is precise).

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals `describeActivity`, loaded inside tests to tolerate the new module.

## How to run
```
node test/test.js
# or: node -e "require('./test/signs-of-life.test.js').run().then(r=>console.log(r))"
```

## Verification
Pure tests fail (no `lib/activity.js`); source guards fail (no fetch/render). Failing output pasted at the gate.
