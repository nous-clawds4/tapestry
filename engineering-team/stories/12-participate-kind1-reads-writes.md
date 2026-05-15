# Story 12: Participate — kind-1 reads + writes on the Conversation tab (Slice 6)

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background

The Conversation tab on `/community/:slug` has shown hand-typed mock posts since Slice 0. Slice 6 — the last v1 slice per PLAN.md §6 Q5.4 — wires it to real **kind-1 nostr notes** tagged with the community's `a` tag.

Two halves:

1. **Read.** Fetch kind-1 events from the community's relay set (filter: `{ kinds: [1], '#a': [communityATag] }`), sort by `created_at` descending, render via the existing `PostCard` component.
2. **Write.** When the viewer is signed in **and** a member of the community, the composer at the top of the Conversation tab becomes a real textarea + Send button. Submitting publishes a kind-1 event with `content: <textarea body>` and `tags: [['a', communityATag]]` via the existing `publishEvent` wrapper.

The Slice 4 NB-2 lifecycle on the relay-side whitelist is the load-bearing detail: **the relay rejects writes from non-members** (PLAN.md §2). v1's relay-hosting story is brainstorm.world-managed and the whitelist generation isn't fully wired (deferred to v1.1 alongside mirror tooling), so client-side gating is what we ship — composer renders only for `signedIn && joinedSet.has(slug)`. When the relay-side whitelist lands, the same UI shape is correct; non-members who somehow trigger a publish get a `rejected-by-relay` error.

Mock-mode keeps the existing per-community `posts` arrays from `mockData.js` so local dev stays populated. The `VITE_USE_MOCK_DATA` toggle gates the fetch + publish behavior identically to Slices 3–5.

This slice is **independent of Slice 2 NB-4** (real API data sources still pending). Slice 6 reads kind-1 directly from the relay, not through `GET /api/communities/:slug/posts` — there's no such endpoint, and adding one would couple the kind-1 read path to the API layer for no benefit. The relay is the canonical source for nostr events; the UI reads it directly via the same `Relay.connect` wrapper used for writes.

## User-facing description

**As a signed-in joined member**, I want to type a note into the Conversation tab and click Send so my kind-1 event flies to `wss://communities.brainstorm.world` tagged with the community's `a` tag, **so that** my post appears in this circle and in any kind-1 indexer that's listening for the community.

**As any visitor** (signed-in or not, member or not), I want to see the latest kind-1 posts in the community when I open the Conversation tab **so that** I can read the activity that's happening here without having to join.

**As a non-member visitor**, I want to be told plainly that joining is the path to posting — the composer should not appear with a disabled Send button (false UX promise); instead show a small "Join this circle to post" affordance that hands me back to the Join CTA at the top of the page.

## Acceptance criteria

### Read path

- [ ] When the Conversation tab is opened on `/community/:slug`, the UI fetches kind-1 events filtered by `{ kinds: [1], '#a': [communityATag] }` from the community's relay set (`DEFAULT_RELAYS` from `publish.js` for v1 — single entry `wss://communities.brainstorm.world`).
- [ ] Fetched events render via the existing `PostCard` component (already on the page). Each post displays:
  - `author`: the event's `pubkey` (resolved to npub-short for v1; profile resolution per Slice 2 NB-1 is a future story)
  - `content`: the event's `content` field
  - `time`: a relative timestamp derived from `created_at` ("2h ago" style)
- [ ] Posts are sorted by `created_at` descending (newest first).
- [ ] Loading state for the initial fetch: a `PostSkeleton` (new component, mirrors `CardSkeleton`'s shimmer pattern) shows three placeholders. CLS = 0 when posts replace skeletons.
- [ ] Error state: if the relay connect/fetch fails, the Conversation tab shows the existing `FetchError` component with a Retry action (re-fires the fetch).
- [ ] Empty state (no kind-1 events for this community): the existing "No posts yet. Be the first to share." copy renders. Re-uses the existing `.emptyPosts` style.

### Write path (composer)

- [ ] The composer renders **only when** `signedIn && joinedSet.has(slug)`. For un-signed visitors and non-members, replace the composer with a small inline "Join this circle to post" prompt that focuses attention on the Join CTA at the top of the page.
- [ ] Member composer: an `<textarea>` (no character cap — kind-1 doesn't have a hard length limit; browser sanity-checks via `rows={3}` resize-vertical) + a primary "Send" button.
- [ ] Submit publishes a kind-1 event built via a new pure-function helper `buildKind1Post({ viewerPubkey, communityATag, content })`. The event has `kind: 1`, `content: <text>`, `tags: [['a', communityATag]]`, `created_at: now`, `pubkey: viewer`.
- [ ] Optimistic update: on submit click, immediately prepend a temporary "pending" post to the top of the list with the viewer's text + a subtle "Sending…" indicator. On publish success, the pending entry flips to a real post (using the resolved event id). On failure, the pending entry shows an inline error indicator + Retry affordance for that single post.
- [ ] Empty textarea: Send is disabled until `content.trim().length > 0`.
- [ ] During publish: textarea + Send disable; Send button shows "Sending…" state.

### Membership state mismatch

- [ ] If the relay rejects a member's publish with `rejected-by-relay` (because the relay-side whitelist hasn't caught up with the user's recent Join), the per-post error indicator surfaces a copy variant: "The relay didn't recognize you yet. Try again in a moment." Retry re-fires the same publish.
- [ ] Other publish errors (`no-extension`, `rejected`, `timeout`, `network`) reuse the existing `publishErrorCopy` helper. Slice 5 NB-1 calls out the duplication; Slice 6 takes the opportunity to extract `publishErrorCopy` + `signInErrorCopy` to `src/lib/errors.js` and update **all four** call sites (CommunityDetail, MemberDrawerContent, Create, and the new Conversation composer).

### Mock-mode parity

- [ ] In `VITE_USE_MOCK_DATA=true`, the kind-1 fetch resolves with the existing `c.posts` mock array (projected to the new `Post` shape `{ id, author, content, createdAt }`). Composer submit publishes via mock — signed event goes to `console.log('[publish/mock]', signed)`, the optimistic post becomes real with a synthetic event id, and the visual flow is identical to production.
- [ ] In `VITE_USE_MOCK_DATA=false`, the fetch hits the relay via `Relay.connect` and a one-shot subscription that closes on EOSE (end-of-stored-events). 5-second timeout fallback: if EOSE doesn't arrive, resolve with what we have so far and close the relay connection.

### Post-shape consistency

- [ ] A new module `src/events/fetch.js` exports `fetchKind1ForCommunity({ communityATag, relays })` that returns `Promise<Post[]>` where `Post` is `{ id, author, content, createdAt }`. Pure I/O wrapper — calls the relay or returns mock projections; no UI knowledge.
- [ ] `PostCard` accepts the new shape. Existing mock posts get adapted via a tiny projection at the fetch boundary (so PostCard's contract stays clean).

### Error-helper extraction (NB-1 cleanup)

- [ ] `src/lib/errors.js` exports `publishErrorCopy(result)` + `signInErrorCopy(code)`. The four duplicate copies in `CommunityDetail.jsx`, `MemberDrawerContent.jsx`, `Create.jsx`, and the new composer **all import from here**. The local definitions are deleted.

### Regression

- [ ] All 145 pre-existing tests pass. Slice 6 adds a new suite; no existing tests should flip.
- [ ] `cd ui-communities && npm run build && npm run lint` — clean.
- [ ] Dev-mode visual review still works: complete the wizard, navigate to a community detail page, click Conversation tab → mock posts render. As a "joined" mock viewer, type in the composer → Send → see the optimistic post appear at the top.

## Concepts touched

- `brainstorm-community` (kind 39998 concept-header, Slice 1) — the community's `a` tag is what we filter kind-1 reads by and tag kind-1 writes with.
- Standard nostr **kind 1** events — no firmware concept change; kind-1 is already understood by the Tapestry concept graph as a primitive nostr kind.

No firmware reinstall required.

## Out of scope

- **Reactive live updates** (subscribe to new events after the initial fetch). v1 ships one-shot fetch on tab open + after Send. Refresh-to-see-others-posts is acceptable for v1; live updates are a follow-up.
- **Author profile resolution.** Kind-0 → display name + avatar still pending (Slice 2 NB-1 / Slice 4 NB-3). v1 shows npub-short for real-mode authors; mock-mode shows mock names because they round-trip through the mock projection.
- **Reply threads.** kind-1 supports replies via `e` tags; the v1 composer doesn't surface a "reply" affordance. Posts are flat.
- **Reactions / likes / reposts.** v1 ships read + write of plain posts. NIP-25 reactions, NIP-18 reposts deferred.
- **Pagination / "load more".** v1's expected post volume per community is bounded; if it grows, pagination becomes a real story.
- **Long-form (kind 30023) content.** PLAN.md §6 Q5.4: "kind-1 only for v1."
- **Markdown / link previews / media uploads.** Plain text only.
- **The actual relay-side membership whitelist.** PLAN.md §8 step 7 — community relay whitelist generation. v1 ships client-side composer gating; the relay enforces eventually. UI shape is correct for both states.
- **Mirror tooling.** PLAN.md §6 Q5.3 — defer to v1.1.

## Open questions

Resolved at intake:

- **Fetch via `Relay.connect` directly, or via a new server endpoint?** Direct relay. The kind-1 read path is not coupled to the API; this matches nostr's normal client→relay pattern and means kind-1 round-trip works without waiting for Slice 2 NB-4.
- **One-shot fetch vs live subscription?** One-shot on tab-open + re-fetch after Send. Live subscription = post-v1.
- **Character cap on the composer?** None. Kind-1 doesn't have one; relays typically apply their own.
- **`PostSkeleton` separate component, or inline?** Separate. Mirrors `CardSkeleton`'s pattern from Slice 3.
- **When to extract `publishErrorCopy`?** Now. Slice 6 adds a fourth call site; four copies is the right moment to factor (Slice 5 NB-1).
- **Optimistic post id?** Use `crypto.randomUUID()` for the placeholder; replace with the relay-returned event id on success.

## Linked artifacts

- ADR: [`engineering-team/decisions/0010-participate-kind1-reads-writes.md`](../decisions/0010-participate-kind1-reads-writes.md)
- Test plan: `engineering-team/stories/12-participate-kind1-reads-writes.test-plan.md` (filled in by Tester)
- Review: `engineering-team/reviews/12-participate-kind1-reads-writes.md` (filled in by Reviewer)
