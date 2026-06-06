# ADR 0035: Offered live updates via a non-injecting poll

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-aliveness/5-offered-live-updates.md`
**Relates to:** ADR-0010 (one-shot vs live conversation load) — this extends it, does not supersede it.

## Context
The conversation loads once on tab-open (`conversationLoadedRef`, CommunityDetail.jsx:237-243) and re-fetches after the viewer sends (`loadPosts`). ADR-0010 chose one-shot over a live subscription for simplicity. Story 5 wants the room to feel current **without** auto-injecting: a single "N new" affordance the member taps, and the displayed posts must not move while new ones are available (design principle 7 — sovereignty; no attention-capture). Criteria: detect new posts → show count; tap → load; nothing injected; the viewer's own posts aren't counted; the background check fails silently with manual reload still working.

Constraints: JS-without-build; reuse the existing one-shot fetch where possible; do not introduce a persistent relay subscription layer (none exists today — `collectFromRelay` is one-shot with EOSE/timeout).

## Options considered

### Option A — Periodic poll into a non-rendered counter
While the conversation tab is open (and the page visible), poll `fetchPostsForCommunity` on an interval. Compute "new" = fetched posts whose id is not currently displayed **and** not authored by the viewer. Store only a **count** in state; never touch `postsState`. Render an "N new" pill when count > 0; tapping calls `loadPosts()` (the normal injecting load, now user-initiated) and clears the count.
- **Pros:** reuses the existing one-shot fetch (no new subscription infra); the displayed list is *structurally* never mutated by the poll (it only sets a number), so the no-inject/no-shift requirement holds by construction; degraded path is trivial (a failed poll sets nothing); aligns with ADR-0010's simplicity.
- **Cons:** not truly real-time (interval latency); a poll every N seconds per open conversation. Mitigated by pausing when the page is hidden and a conservative interval.

### Option B — Live relay subscription into a buffer
Open a persistent kind-1111 `#A` subscription while the tab is open; buffer incoming events; show the count; merge on tap.
- **Pros:** real-time.
- **Cons:** introduces persistent-subscription machinery the codebase doesn't have (against ADR-0010's chosen direction); more lifecycle/edge surface (reconnect, dedup, teardown); larger change for a feature whose value is "you can choose to load," not "instant."

## Decision
We chose **Option A**. The product value is *offered* updates, not instant ones, so a poll that only ever sets a counter is the smallest change that satisfies the sovereignty requirement by construction: because the poll never writes `postsState`, the displayed conversation cannot shift or be injected into — the invariant is structural, not policed. It reuses the existing fetch and honors ADR-0010's one-shot direction (loads remain user- or send-initiated; the poll is a detector, not a loader).

## Consequences
- **Enables:** a current-feeling room with zero auto-inject; trivial degraded behavior; no new infra.
- **Constrains:** interval latency (not real-time); a background fetch per open conversation while visible.
- **Guards against:** attention-capture — there is no auto-scroll, no presence, no auto-merge; the only "live" surface is the tappable count.
- **New debt:** none. A future real-time upgrade would be a new ADR (Option B) layered on the same "buffer, don't inject" contract.
- **Firmware reinstall required?** No.

## Implementation notes
- **`ui-communities/src/pages/CommunityDetail.jsx`**
  - State: `const [newCount, setNewCount] = useState(0)`. A `displayedIdsRef` synced from `postsState.items` via an effect (`useEffect(() => { displayedIdsRef.current = new Set(postsState.items.map(p => p.id)) }, [postsState.items])`).
  - Poll effect, gated on `tab === 'conversation' && currentCommunity && communityATag`: `setInterval` (~25s). Each tick: if `document.hidden`, skip. Else `try { const fresh = await fetchPostsForCommunity({ communityATag, slug }); const n = fresh.filter(p => !displayedIdsRef.current.has(p.id) && p.author !== viewer).length; setNewCount(n) } catch { /* silent — no affordance, no error chrome */ }`. Cleanup clears the interval. Deps include `tab, currentCommunity, communityATag, viewer`.
  - Reset `setNewCount(0)` on slug change (alongside the existing conversation-state reset) and whenever `loadPosts` completes (tap and post-send both re-sync the displayed list, so the count is stale → clear).
  - Affordance: when `tab === 'conversation' && newCount > 0`, render a single centered "N new" pill at the **top of the conversation**, above the post list, that does not displace content. `onClick`: `loadPosts(); setNewCount(0)`. (loadPosts re-fetches posts + reactions; this is the user-initiated inject, which is allowed.)
  - Own-post exclusion (criterion 5): the `p.author !== viewer` filter; the viewer's sent post is already displayed via the post-send `loadPosts`, and optimistic pending posts are local-only so never appear in a relay fetch.
- **`ui-communities/src/pages/CommunityDetail.module.css`** — a `.newPill` class: centered, `--accent` text on `--accent-muted`, `--radius-full`, token-based; matches the v2 wireframe's "N new" treatment. Announce politely to assistive tech (the pill is a real button with an accessible label like "Load N new posts").
- No change to `fetch.js`/`build.js` (the poll reuses `fetchPostsForCommunity`).

## Out of scope
- Real-time subscription (Option B) — future ADR if needed.
- Live reaction-count streaming (tap re-fetches reactions via `loadPosts`; no separate stream).
- Signs of life on discovery (Story 6), notifications (Block C).
