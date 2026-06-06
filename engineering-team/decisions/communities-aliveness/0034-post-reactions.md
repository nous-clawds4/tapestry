# ADR 0034: Post reactions (NIP-25) with a latest-per-reactor toggle

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-aliveness/4-react-to-a-post.md`

## Context
Circle posts/replies are NIP-22 kind-1111 events, built by `buildCommunityPost` and fetched via `{ kinds: [1111], '#A': [communityATag] }` (`events/fetch.js:53`). There is **no reaction code today**. Story 4 wants a single, honest reaction with an exact count (= distinct reactors), a toggle (react / un-react), the viewer's own reaction visually distinct, counts visible read-only, and reacting gated by the existing `canCompose`.

Constraints: JS-without-build; reactions must stay scoped to the circle (queryable per-circle, consistent with the kind-1111 anti-leakage posture); counts must be exact (design principle 7 — no inflation); pure, testable aggregation preferred (repo test style). NIP-25 defines kind-7 reactions referencing a target event (`e`/`p`/`k`), with content like `+` (like) / `-` — but it has **no native "remove my reaction"** primitive, which is the crux.

## Options considered

### Option A — Latest-per-reactor `+`/`-` model (no deletions)
A reaction is a kind-7 event with content `+` (active) or `-` (removed). A reactor's current state for a target is the content of their **most recent** kind-7 (by `created_at`). Count = number of distinct reactors whose latest reaction is `+`. Un-react = publish a `-`.
- **Pros:** deterministic and idempotent; no deletion semantics to honor on read; aggregation is a pure function (count distinct reactors with latest `+`), trivially unit-testable; resilient across relays (a `-` is just data); exact-count requirement falls out naturally (dedupe by reactor).
- **Cons:** un-react leaves a tombstone `-` event rather than removing data; repurposes NIP-25's `-` (dislike) as "removed" in a single-reaction model (documented).

### Option B — NIP-09 deletion (kind-5) for un-react
React = kind-7 `+`; un-react = publish a kind-5 deletion of that reaction event.
- **Pros:** semantically "removes" the reaction.
- **Cons:** requires honoring kind-5 deletions on read (extra fetch + filter logic); deletions are unreliable/partial across relays; harder to make the count deterministic and pure-testable. More surface for an exact-count bug.

## Decision
We chose **Option A**. The latest-per-reactor `+`/`-` model makes the count a deterministic pure function of the reaction set, satisfies the exact-count requirement by construction, and avoids the cross-relay fragility of deletions. We use a **single reaction type** (a like) — no emoji palette — honoring the design's no-vanity-surface stance; the model trivially extends to a small symbol set later without a new ADR (group by `[target, symbol]`). NIP-25's `-` is repurposed as the removal marker in this single-reaction model; documented here.

## Consequences
- **Enables:** honest, exact reaction counts; a clean toggle; pure aggregation that's unit-testable; reactions scoped per-circle.
- **Constrains:** un-react leaves a `-` tombstone (no data removal); the model is single-reaction (a palette is a future extension).
- **New debt:** none material. A future palette would group by symbol; a future "real delete" would be a separate ADR.
- **Firmware reinstall required?** No (no concept changes).

## Implementation notes
- **`ui-communities/src/events/build.js`** — add `buildReaction({ viewerPubkey, communityATag, post, active = true })` → kind-7 event, `content: active ? '+' : '-'`, tags: `['A', communityATag]` (circle scope, mirrors posts), `['e', post.id, '', post.author]`, `['p', post.author]`, `['k', '1111']`. Guard `viewerPubkey`, `communityATag`, `post.id`, `post.author`. Pure builder (uses `nowSec()`).
- **`ui-communities/src/events/fetch.js`** — add `fetchReactionsForCommunity({ communityATag, relays, timeout })` using `{ kinds: [7], '#A': [communityATag] }` (same relay-collect pattern as posts). Project each as `{ targetId: <lowercase e>, reactor: ev.pubkey, content: ev.content, createdAt }`.
- **`ui-communities/src/lib/reactions.js`** (new, pure) — `summarizeReactions(reactions, viewerPubkey)` → `{ [targetId]: { count, mine } }`. For each target: keep the latest reaction per reactor (max `created_at`); `count` = reactors whose latest `content === '+'`; `mine` = the viewer's latest is `'+'`. This is the testable core.
- **`ui-communities/src/pages/CommunityDetail.jsx`** — in `loadPosts` (or a parallel load keyed on the same `communityATag`), also `fetchReactionsForCommunity` and store a `reactions` state; derive `summarizeReactions(reactions, viewer)`. Add `handleToggleReaction(post)`: compute `mine` from the summary, optimistically flip the local summary (count ±1, mine toggled), publish `buildReaction({ …, post, active: !mine })`, and on failure revert to last-known-good (non-blocking — the post stays readable). Gate the interactive toggle on `canCompose`; when `!signedIn`, tapping prompts sign-in (reuse the existing sign-in affordance); counts render regardless.
- **`ui-communities/src/components/PostCard.jsx`** — add reaction props (`reactionCount`, `reactionMine`, `onToggleReaction`, `canReact`). Render a single reaction control showing the exact count; the viewer's active reaction is visually distinct (accent treatment); when `!canReact`/`!signedIn` the control is display-or-prompt, never a dead disabled button.
- **CSS** — reaction pill classes in `PostCard.module.css`, token-based; the "mine" state uses an accent border/treatment (state by more than color — pair with an active visual + accessible name, per the design guide's a11y baseline).

## Out of scope
- Live reaction updates (Story 5), reaction notifications, signs-of-life-from-reactions (Story 6).
- Emoji palette / multiple symbols (future extension; the model supports it by grouping on symbol).
- True data deletion of a reaction (would be a separate ADR).
