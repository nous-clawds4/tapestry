# ADR 0036: Signs of life — pure description + one batched grid query

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-aliveness/6-signs-of-life.md`

## Context
Story 6 wants a single read-only line stating a circle's recent activity ("Active today · 6 posts this week" / "Quiet lately · last post 3 weeks ago" / "New circle · founded today"), on the circle detail **and** every discovery card, with no account. It must omit cleanly if data can't load, convey recency by text (not color), and stay calm about quiet (design principle 11).

Facts from the codebase:
- Posts/replies are kind-1111, fetched by `#A` (`events/fetch.js`). A projected declaration circle carries `_createdAt` (the CD event's created_at) — that's the founded date.
- The discovery grid (`Discover.jsx`) merges circles from three sources and renders `CommunityCard` per circle. A per-card activity fetch would be **N requests** — the efficiency concern the PO and the audit flagged.
- The detail page loads posts only when the Conversation tab opens (lazy); signs of life must show regardless of tab.
- `Date.now()` in render is flagged by `react-hooks/purity` (seen in Stories 4/5), so "now" must come from fetch-time state, not be computed during render.

## Options considered

### Option A — Pure `describeActivity` + one batched grid query
A pure helper computes the line from raw inputs: `describeActivity({ postTimes, foundedAt, now })`. The grid does **one** query `{ kinds:[1111], '#A':[all circle tags], limit:N }`, buckets posts by their `A` tag → each circle gets its `postTimes`; the detail does one small `#A` fetch for its own circle. `now` is stamped at fetch time and passed in.
- **Pros:** the grid is one query, not N (solves the flagged concern); the description logic is a pure function (unit-testable, the repo's strength); `now`-at-fetch sidesteps the purity rule; omit-on-failure is trivial (no data → helper returns null).
- **Cons:** the batched query has a global `limit`, so a very active circle could crowd out a dormant circle's latest post from the result set — that circle then shows a coarser "quiet/founded" line instead of an exact last-post age on the grid. The **detail page is always precise** (single-circle fetch). Acceptable for v1; documented.

### Option B — Per-card activity fetch
Each card fetches its own recent posts.
- **Pros:** every card is precise.
- **Cons:** N requests on every discovery load — the exact cost the PO flagged. Rejected.

## Decision
We chose **Option A**. The description is a pure function tested directly; the grid stays at one query; the detail page is precise. The coarse-on-grid edge (a dormant circle's latest post crowded out of the batched window) is an acceptable v1 tradeoff — the grid signal is "alive vs quiet," the detail is exact — and it's the same batching posture the audit set for the discovery trust signal. A future precise-grid upgrade would be a new ADR (e.g. a server-side activity index), not a per-card fetch.

## Consequences
- **Enables:** read-only signs of life on detail + grid; one batched grid query; a pure, testable description; clean omit-on-failure.
- **Constrains:** grid lines are coarse for circles beyond the batched window; reactions are not counted toward "posts this week" (kept honest to the word "posts" — lastActivity/recentCount derive from kind-1111 posts+replies only).
- **New debt:** none. Precise-grid is a future ADR.
- **Firmware reinstall required?** No.

## Implementation notes
- **`ui-communities/src/lib/activity.js`** (new, pure) — `describeActivity({ postTimes = [], foundedAt = null, now })` → string | null:
  - `lastActivityAt = postTimes.length ? Math.max(...postTimes) : null`; `recentCount = postTimes.filter(t => now - t <= WEEK).length` (WEEK = 7·86400).
  - If `now == null` → `null`.
  - If `lastActivityAt`: age = now − lastActivityAt. `≤ DAY` → "Active today" (+ " · N posts this week" when recentCount > 0); `≤ WEEK` → "Active this week" (+ count); else → `Quiet lately · last post ${relativeAge(age)}`.
  - Else (no posts): if `foundedAt` and age `≤ WEEK` → `New circle · founded ${relativeAge(age)}`; else if `foundedAt` → "Quiet · no posts yet"; else → `null` (omit).
  - Include a pure `relativeAge(seconds)` → "today" / "N days ago" / "N weeks ago" / "N months ago" (deterministic; no Date.now). Plural helper for "post(s)".
- **`ui-communities/src/events/fetch.js`** — `fetchActivityForCircles({ aTags, relays, timeout })` → `Map<aTag, number[]>` (post created_at lists). One query `{ kinds:[1111], '#A': aTags, limit: 300 }`; for each event, read its uppercase `A` tag and push `created_at` into that circle's array. `USE_MOCK` → empty map. Used by both surfaces (detail passes a single-element `aTags`).
- **A-tag helper** — derive a circle's A tag from `{ model, founder, slug }` (declaration → `39998:founder:slug`, else `39999:…`). Factor the existing `communityATag` logic in `CommunityDetail.jsx` into a small shared helper (e.g. `lib/circle.js#circleATag(circle)`) so the grid and detail build it identically.
- **`ui-communities/src/pages/Discover.jsx`** — after the circle list resolves, call `fetchActivityForCircles` once with all circles' A tags; store the map + a `fetchedAt` (stamped here, in the async handler — not render). Pass each card `activityLine = describeActivity({ postTimes: map.get(tag) || [], foundedAt: c._createdAt, now: fetchedAt })`. A failed activity fetch → empty map → cards still render, lines fall back to founded-based or omit.
- **`ui-communities/src/components/CommunityCard.jsx`** — render an optional `activityLine` prop as a muted line; nothing if null. Token-based; no urgency styling.
- **`ui-communities/src/pages/CommunityDetail.jsx`** — on detail load (independent of the conversation tab), `fetchActivityForCircles([communityATag])`, stamp `fetchedAt`, render `describeActivity(...)` near the definition. Omit if null.
- **CSS** — a muted `.activityLine` (or reuse an existing muted/faint text token class). No color-only meaning; the phrase carries it.

## Out of scope
- Real-time activity (Story 5 covers offered live updates); sorting/filtering the grid by activity (Phase 3); the discovery trust signal (Phase 3); precise per-card last-post age beyond the batched window (future ADR).
