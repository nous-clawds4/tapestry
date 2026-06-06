# ADR 0033: One-level reply threading on NIP-22 community posts

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-aliveness/3-reply-to-a-post.md`

## Context
Circle conversation posts are NIP-22 kind-1111 comments (ADR-0010 lineage), built by `buildCommunityPost` (`ui-communities/src/events/build.js:206`) and fetched by `fetchPostsForCommunity` (`ui-communities/src/events/fetch.js:41`). The builder already documents the reply path (build.js:194-204): uppercase `A/K/P` = the community root; lowercase `a/k/p` = the immediate parent (= root for a top-level post); a reply should point its lowercase parent at the parent comment's `e`-tag instead.

Two facts make this small:
- **Read query is already reply-ready.** The fetch filter is `{ kinds: [1111], '#A': [communityATag] }` (fetch.js:53). Because replies keep the same uppercase `A` root, they already come back in the same query as top-level posts — no read-filter change.
- **The only read gap:** `projectRealEvent` (fetch.js:94-101) projects `{id, author, content, createdAt}` and **drops the tags**, so a reply's parent pointer never reaches the client. Threading needs that one field.

Posts render flat via `allPosts.map(p => <PostCard …>)` (CommunityDetail.jsx:586), with optimistic `pending` entries (`handleSendPost`, :224). The composer gate (`canCompose`, ADR-0032) governs who may post.

Story constraint: **one level of nesting only** — "a reply to a reply attaches at the same single level." And replies must stay scoped to the circle (no leak, no appearing as top-level). No concept-graph change; no firmware.

## Options considered

### Option A — Replies always parent the top-level post (re-parent on the client)
When the user replies to anything, the reply's parent is set to the **top-level post** of that group. Replying to a reply re-targets the reply's own parent (the root post). Every reply therefore points at a top-level post; the data model is structurally flat.
- **Pros:** one-level is guaranteed *by construction* (a reply can never have a reply beneath it). Rendering is trivial — group replies by `parentId`. No ancestry walking, no missing-ancestor edge case (a reply's parent is always a top-level post present in the same `#A` set). Matches the common one-level comment model.
- **Cons:** replying to a specific reply records the root post as parent, not that reply — the "I replied to Bob's reply" nuance is lost. Acceptable in a flat one-level UI (all replies are peers under the root); an `@`-style nicety is out of scope.

### Option B — Parent = the exact post replied-to, flatten on render
The reply points at whatever was clicked (possibly another reply); the renderer walks the parent chain to the top-level ancestor and displays everything one level deep.
- **Pros:** preserves the exact reply target.
- **Cons:** needs ancestry resolution and a fallback when an ancestor is missing from the fetched set; more logic for a nuance the one-level UI does not surface. More moving parts, more failure modes.

## Decision
We chose **Option A**. One-level nesting is the product constraint, and re-parenting to the top-level post makes it a structural guarantee rather than a render-time invariant we must police. It removes the missing-ancestor edge case entirely and keeps the renderer to a single group-by. The lost "replied-to-which-reply" precision is immaterial in a flat one-level model where all replies sit as peers under the root post.

## Consequences
- **Enables:** threaded conversation with a trivial, robust renderer; replies scoped to the circle via the unchanged uppercase `A` root.
- **Constrains:** the model is intentionally flat — a future "deep threads" feature would supersede this ADR, not extend it.
- **Edge handled:** a reply whose `parentId` is somehow absent from the fetched set renders as top-level (graceful degradation), but Option A makes this near-impossible since parents are always top-level posts in the same query.
- **New debt:** none.
- **Firmware reinstall required?** No (no concept changes).

## Implementation notes
- **`ui-communities/src/events/build.js`** — extend `buildCommunityPost({ viewerPubkey, communityATag, content, parent })` with an optional `parent = { id, author }`. When `parent` is present, keep the uppercase root tags (`A`/`K`/`P` = community) and set the **lowercase parent** to the comment: replace `['a', communityATag]` with `['e', parent.id, '', parent.author]`, keep `['k','1111']`, and set `['p', parent.author]`. When `parent` is absent, behavior is unchanged (top-level post). Keep it a pure builder; add a guard that `parent.id`/`parent.author` are present when `parent` is passed.
- **`ui-communities/src/events/fetch.js`** — in `projectRealEvent`, add `parentId: (ev.tags.find(t => t[0] === 'e') || [])[1] || null`. Top-level posts have no lowercase `e` (their parent is the community `a`), so `parentId` is null; replies carry it. No filter change.
- **`ui-communities/src/pages/CommunityDetail.jsx`**
  - Group `allPosts` into top-level (`parentId == null`) and replies (`byParent[parentId]`). Render top-level newest-first (current sort); render each parent's replies beneath it, oldest-first, indented one level.
  - Add a "Reply" affordance on each post. Clicking sets a `replyTarget` = the **top-level post** of that group (if the clicked item is itself a reply, use its `parentId`'s post). A reply composer (reuse the existing composer, scoped to `replyTarget`) sends via `buildCommunityPost({ …, parent: { id, author } })`.
  - Signed-out: the reply affordance is replaced by a "Sign in to reply" prompt (mirror the `composePrompt` pattern; no disabled control). Who-may-reply reuses `canCompose` — no new gate.
  - Optimistic: a pending reply carries its `parentId` so it nests immediately; on failure, inline error + retry on the reply (mirror `handleRetryPending`), parent post stays.
- **`ui-communities/src/pages/CommunityDetail.module.css`** — a `.reply` indent class (token-based: `margin-left`/`border-left` using existing spacing/border tokens, mirroring the design guide's one-level treatment). No hardcoded values.

## Out of scope
- Reactions (Story 4), live "new" updates (Story 5), signs of life (Story 6), reply notifications (Story 8).
- Deep nesting, edit/delete, `@`-mention of a specific reply target.
