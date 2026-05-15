# Review: Story 12 — Participate (kind-1 reads + writes on the Conversation tab)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** four commits in the slice:

- `a2b868f9` story: participate-kind1-reads-writes (#12)
- `c00ef8c1` adr: 0010 — Conversation tab kind-1 reads/writes + errors.js extract
- `79c38369` test-plan: participate-kind1-reads-writes (#12) — failing tests
- `485e0741` impl: conversation tab kind-1 reads + writes (#12)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`node test/test.js` — PASS.** Eleven suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - firmware-v1.1.0-finalization: 14/14 PASS
  - gr-community-scoring-and-api: 25/25 PASS
  - discover-swaps-mock-data-for-api: 22/22 PASS
  - nip07-signin-and-writes: 17/17 PASS
  - create-flow-publishes: 13/13 PASS
  - **participate-kind1-reads-writes: 15/15 PASS** (new in this slice)
  - **Overall: 160/160.** No regressions on the 145 pre-existing tests.
- [x] **`cd ui-communities && npm run lint` — PASS.** Clean. The new effect uses an inline `// eslint-disable-next-line react-hooks/set-state-in-effect` on the data-reset path, mirroring the pattern already in [CommunityDetail.jsx:55](ui-communities/src/pages/CommunityDetail.jsx#L55) for the same idiomatic "fetch on prop change" use case.
- [x] **`cd ui-communities && npm run build` — PASS.** Vite 7.3.3, 122 modules, ~723 ms. Bundle: 452.64 kB JS (148.83 kB gzip), 53.74 kB CSS (9.74 kB gzip). ~4 kB JS / ~1.7 kB gzip growth from Slice 5 — small, expected (fetch.js + the composer + the PostCard adapter + the new helpers).
- [ ] **`npm run test:playwright`** — N/A. Composer publish + relay subscription both require live infra; verification stays at staging smoke per ADR §"Live verification".
- [x] _Typecheck not configured._

## Spec adherence (vs. story #12 acceptance criteria)

### Read path

- [x] **AC: Fetch on Conversation tab open with `{ kinds: [1], '#a': [communityATag] }`.** [CommunityDetail.jsx:95-115](ui-communities/src/pages/CommunityDetail.jsx#L95) lazy-loads on first tab activation guarded by `conversationLoadedRef`. [fetch.js:48-49](ui-communities/src/events/fetch.js#L48) constructs the filter; T7 verifies the literal shape.
- [x] **AC: PostCard renders the new shape.** [PostCard.jsx:20-22](ui-communities/src/components/PostCard.jsx#L20) reads `post.content` (new) with `post.text` (legacy) fallback. T15 verifies.
- [x] **AC: npub-short fallback for hex-pubkey authors.** [PostCard.jsx:42](ui-communities/src/components/PostCard.jsx#L42) `npubShort(post.author)`. [HexAvatar:65](ui-communities/src/components/PostCard.jsx#L65) renders a deterministically-colored disc using the same `getAvatarBg` hash function as the regular Avatar. T15 verifies.
- [x] **AC: createdAt → relative timestamp.** [PostCard.jsx:25](ui-communities/src/components/PostCard.jsx#L25) `relativeTime(post.createdAt)`. New helper at [format.js:50-58](ui-communities/src/lib/format.js#L50): just-now / Xm / Xh / Xd / Xw.
- [x] **AC: Sort by createdAt descending.** [fetch.js:53](ui-communities/src/events/fetch.js#L53) `.sort((a, b) => b.createdAt - a.createdAt)`.
- [x] **AC: PostSkeleton with shimmer; CLS=0.** [PostSkeleton.jsx + .module.css](ui-communities/src/components/PostSkeleton.jsx) mirror PostCard's meta-row + body-paragraph layout. Three placeholders rendered during initial fetch ([CommunityDetail.jsx:387-393](ui-communities/src/pages/CommunityDetail.jsx#L387)). T14 verifies.
- [x] **AC: FetchError on relay failure.** [CommunityDetail.jsx:395-397](ui-communities/src/pages/CommunityDetail.jsx#L395) `<FetchError onRetry={loadPosts} />`. Retry re-fires the same `loadPosts` closure.
- [x] **AC: Empty-state copy preserved.** [CommunityDetail.jsx:408-410](ui-communities/src/pages/CommunityDetail.jsx#L408) "No posts yet. Be the first to share." gated on `postsState.status === 'ready' && allPosts.length === 0`.

### Write path (composer)

- [x] **AC: Composer only when signedIn && joined.** [CommunityDetail.jsx:358](ui-communities/src/pages/CommunityDetail.jsx#L358) `const canCompose = signedIn && joined`. T10 verifies the conditional + the `<textarea>` presence.
- [x] **AC: Non-member sees "Join this circle to post" inline.** [CommunityDetail.jsx:381-385](ui-communities/src/pages/CommunityDetail.jsx#L381) the else-branch renders the join-prompt panel with dashed border — no false-promise disabled button.
- [x] **AC: textarea rows={3}, resize-vertical.** [CommunityDetail.jsx:367](ui-communities/src/pages/CommunityDetail.jsx#L367) `rows={3}`; [.module.css:198](ui-communities/src/pages/CommunityDetail.module.css#L198) `resize: vertical`.
- [x] **AC: buildKind1Post payload shape.** [build.js:192-203](ui-communities/src/events/build.js#L192) returns `{ kind: 1, tags: [['a', aTag]], content: trimmed, created_at, pubkey }`. T1 verifies all five fields; T2-T4 verify guard clauses on empty viewer/aTag/content.
- [x] **AC: Optimistic prepend with pending indicator.** [CommunityDetail.jsx:138-149](ui-communities/src/pages/CommunityDetail.jsx#L138) prepends a `{ _status: 'pending', _localId: crypto.randomUUID() }` entry; PostCard shows the "Sending…" pendingTag and dims the post.
- [x] **AC: Success → drop pending, re-fetch.** [CommunityDetail.jsx:170-172](ui-communities/src/pages/CommunityDetail.jsx#L170) — pending entry removed by `_localId`, then `loadPosts()` re-fetches so the real event id replaces the synthetic one.
- [x] **AC: Failure → per-post error indicator + Retry.** [CommunityDetail.jsx:163-169](ui-communities/src/pages/CommunityDetail.jsx#L163) flips `_status: 'error'` on the pending entry; PostCard renders the inline error row with a Retry button that re-loads the text into the composer via [handleRetryPending:175-180](ui-communities/src/pages/CommunityDetail.jsx#L175). Choice of "re-load into composer" over "auto-resend" preserves user agency.
- [x] **AC: Send disabled on empty/whitespace.** [CommunityDetail.jsx:376](ui-communities/src/pages/CommunityDetail.jsx#L376) `disabled={composerSending || !composerText.trim()}`.
- [x] **AC: Sending state.** [CommunityDetail.jsx:377](ui-communities/src/pages/CommunityDetail.jsx#L377) Send shows "Sending…" while busy; textarea is `disabled={composerSending}`.

### Membership state mismatch

- [x] **AC: `rejected-by-relay` copy variant.** [CommunityDetail.jsx:163-165](ui-communities/src/pages/CommunityDetail.jsx#L163) — `result.error === 'rejected-by-relay'` branches to "The relay didn't recognize you yet. Try again in a moment." Other codes route through `publishErrorCopy` exactly as the join-publish path does.

### Mock-mode parity

- [x] **AC: Mock fetch projects existing `c.posts`.** [fetch.js:95-107](ui-communities/src/events/fetch.js#L95) `projectMockPosts(slug)` reads from `mockData.communities`, maps `{ author, text, time }` → `{ id, author, content, createdAt, _mockTime }`. The `_mockTime` carries the hand-crafted "2h ago" string so the mock author/time pairing stays exact in dev. T6 verifies the strict `=== 'true'` toggle (avoids the truthy-string gotcha that bit us in Slice 3).
- [x] **AC: Real-mode fetch via `Relay.connect` + one-shot subscription.** [fetch.js:54-86](ui-communities/src/events/fetch.js#L54) — `relay.subscribe([filter], { onevent, oneose, eoseTimeout })` then `setTimeout(done, timeoutMs)` for the 5s fallback. T8 verifies the `oneose:` callback + `sub.close()`.

### Post-shape consistency

- [x] **AC: `fetchKind1ForCommunity({ communityATag, slug?, relays?, timeout? })` → `Promise<Post[]>`.** Shape confirmed at [fetch.js:32-54](ui-communities/src/events/fetch.js#L32).
- [x] **AC: PostCard supports both shapes.** Already covered above.

### Error-helper extraction (NB-1 cleanup)

- [x] **AC: `src/lib/errors.js` exports `publishErrorCopy` + `signInErrorCopy`.** [errors.js:14-29](ui-communities/src/lib/errors.js#L14) + [errors.js:31-40](ui-communities/src/lib/errors.js#L31). T12 verifies.
- [x] **AC: Four duplicate definitions removed; all four sites import.** T13 verifies the negative match (`!/function\s+publishErrorCopy\s*\(/`) and the positive import path in CommunityDetail/MemberDrawerContent/Create. Header.jsx's previous `errorCopyFor` renamed to `signInErrorCopy` at the call site too.

### Regression

- [x] **All 145 pre-existing tests pass.** Confirmed (Overall 160/160 above).
- [x] **`npm run build && npm run lint` — clean.**
- [ ] **Dev-mode visual review** — confirmed at the source level: composer renders with `<textarea>` for signed-in joined viewers; mock-mode `_mockTime` round-trips so the existing "2h ago / 5h ago / 1d ago" strings preserve. Live browser run is deferred to the deploy step (consistent with Slice 4/5 review practice).

## ADR adherence (vs. ADR-0010)

- [x] **Option A picked — direct-to-relay fetch + reuse `publishEvent`.** Confirmed in [fetch.js](ui-communities/src/events/fetch.js).
- [x] **One-shot subscription per relay; closes on EOSE or 5s timeout.** [fetch.js:60-85](ui-communities/src/events/fetch.js#L60).
- [x] **Optimistic-with-rollback for the per-post error indicator.** Confirmed — pending entry stays in place with an error state rather than being yanked; the user can read what they tried to send.
- [x] **Lazy fetch on tab open, not on detail-page mount.** Confirmed — `conversationLoadedRef` gates first-load, slug-change resets it.
- [x] **`errors.js` extraction lands in this slice.** Confirmed; all four sites updated.
- [x] **No live subscription (deferred to v1.1).** Confirmed — fetch closes the relay connection on EOSE/timeout.
- [x] **No reply threads, reactions, pagination, kind-30023, media.** Confirmed — none added.

**No ADR deviations.**

## Concept-graph integrity

- [x] **No firmware reinstall required.** Kind-1 is a primitive nostr kind; the Tapestry concept graph already understands it.
- [x] **`a` tag points to the community's kind-39999 community-record.** Confirmed — `communityATag = "39999:<curator>:<slug>"`. The curator pubkey defaults to `community.founder` (set by Slice 5's Create handler), with `community.curator` and `viewer` as fallbacks; in practice, on a community a viewer opens via Discover, `community.founder` is always present.

## Things tests can't catch

- [x] **No secrets.** No keys, tokens, or pubkeys hardcoded.
- [x] **No leftover debug logging.** Two intentional `console.error` calls on fetch failures + one `console.warn` for individual relay-connect failures in `collectFromRelay` ([fetch.js:60](ui-communities/src/events/fetch.js#L60)). Warn-not-error because a single dead relay shouldn't kill the whole fetch — other relays may resolve.
- [x] **No commented-out code.**
- [x] **Error paths handled.** Fetch: connect-fail (per-relay warn, doesn't halt the rest), timeout (resolve with what we have), aggregate-empty (status === 'ready' with empty items → empty-state copy). Publish: all six `publishEvent` failure codes mapped through `publishErrorCopy`, plus the new `rejected-by-relay` membership-lag variant.
- [x] **Concurrency.** `composerSending` guards the Send button. Double-click while busy is a no-op. The `setPending` updates use functional setters, so two near-simultaneous Sends (impossible to trigger from UI but defensible) wouldn't collide.
- [x] **Security.** Kind-1 content is plain text rendered through React's escape pipeline ([PostCard.jsx:48](ui-communities/src/components/PostCard.jsx#L48) `<p>{content}</p>`). No `dangerouslySetInnerHTML`. The composer trims input before signing, so leading/trailing whitespace doesn't reach the relay. Communities filter is scoped to the `a` tag — no client-side trust assumption on relay-returned events (still: a malicious relay could return events with mismatched `#a` tags; that's a relay-side concern, not Slice 6's). Pubkey rendered via `npubShort` is a substring slice, no escaping concern.
- [x] **Race: tab-switch during fetch.** `loadPosts` writes via `setPostsState` regardless of tab state; if the user switches away mid-fetch, the state is still set and visible when they come back. Acceptable — no AbortController needed for a 5s ceiling.
- [x] **Race: slug change during fetch.** The Slice 4 outer `useEffect` already cancels via the closure-captured `cancelled` flag; the new `useEffect` that resets conversation state on slug change ([CommunityDetail.jsx:121-128](ui-communities/src/pages/CommunityDetail.jsx#L121)) clears `conversationLoadedRef` so the new slug's fetch runs fresh.

## House rules check

- [x] **Concept Graph API authority respected.** No new domain concept introduced — kind-1 is primitive.
- [x] **No new lint/typecheck/build tooling.** package.json untouched.
- [x] **Firmware reinstall not required.**

## Story #12 scope items verified untouched

- [x] **Live subscription** — not added; fetch is one-shot.
- [x] **kind-0 profile resolution** — not added; PostCard uses `npubShort` as the placeholder for hex authors.
- [x] **Reply threads / reactions / reposts** — not added.
- [x] **Pagination / load-more** — not added.
- [x] **kind-30023 long-form / media uploads / markdown** — not added.
- [x] **Relay-side membership whitelist** — not added; client-side gating only (per PLAN.md §8 step 7's deferral).
- [x] **Mirror tooling** — not added.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — `_mockTime` field leaks the legacy shape across the boundary.** [fetch.js:106](ui-communities/src/events/fetch.js#L106) projects mock posts with `_mockTime: p.time` so PostCard renders the hand-crafted "2h ago" labels in dev. The leading underscore signals "private/intermediate" but the field is technically part of the Post shape in mock-mode only. **Trivial alternative:** translate the mock string to a synthetic `createdAt` and let `relativeTime` derive a label. Skipped for now to preserve the exact mock copy as authored. Worth tidying when kind-0 lands and the mock-mode walkthrough can drop the legacy field entirely.

2. **NB-2 — Conversation-tab reset effect uses an `eslint-disable-next-line`.** [CommunityDetail.jsx:124](ui-communities/src/pages/CommunityDetail.jsx#L124) — same pattern Slices 3/4 chose (idiomatic "reset state on prop change"). A key-based remount or a `useMemo`-driven reset would eliminate the disable, but the cost is a larger surgery on `CommunityDetail`'s already-busy hook tree. Picking the simpler-but-flagged approach for v1; revisit if more reset-on-slug-change effects accumulate.

3. **NB-3 — `loadPosts` is not exposed for a manual-refresh affordance.** The Conversation tab fetches lazily on first open and re-fetches after Send, but there's no user-triggered "refresh" button. ADR-0010 §"Open questions" notes this is intentional (one-shot + post-send is the v1 behavior); a real refresh button is the lightest version of the deferred live-subscription work. **Action item for v1.1.**

4. **NB-4 — Mock-mode pending posts disappear after `loadPosts()` runs.** In mock mode the optimistic post is prepended, the publish "succeeds" via `[publish/mock]`, then `loadPosts()` re-resolves with the static `c.posts` mock array (which does not include the just-sent post). Net result in dev: the user types, hits Send, sees the optimistic post for ~50 ms, then it disappears. **Acceptable for dev visualization** (the publish flow exercised the right code paths) but could confuse non-implementer viewers. A future polish would keep the mock-published post locally appended; not worth the complexity for a v1 dev affordance.

5. **NB-5 — Per-relay failures in real-mode are warned, not surfaced.** [fetch.js:60](ui-communities/src/events/fetch.js#L60) `console.warn` on a connect failure for one relay in a multi-relay set. v1's `DEFAULT_RELAYS` is a single entry (brainstorm.world), so the warn==fail path is effectively the whole-fetch failure path. When mirror tooling lands and the relay set fans out, a single-relay failure should not show `FetchError` if at least one relay returned EOSE. Today's behavior happens to coincide (single relay → connect-fail means events stays empty → `status: 'ready'` with empty items → empty-state copy; **not** a `FetchError`). When multi-relay arrives this path needs explicit "did any relay succeed?" accounting — track on the v1.1 mirror-tooling story.

6. **NB-6 — `currentCommunity.curator` fallback path is unreachable today.** [CommunityDetail.jsx:84-86](ui-communities/src/pages/CommunityDetail.jsx#L84) reads `community.founder || community.curator || viewer || ''` when building the `a` tag. The API/mock shape exposes `founder`, not `curator`. Defensive belt-and-suspenders, not load-bearing — keeping it because it costs nothing and lets a future `curator`-field migration not regress this code path.

## Verdict

**PASS.**

Slice 6 closes the v1 plan: the last v1 slice ships kind-1 reads + writes on the Conversation tab gated on `signedIn && joined`, the `errors.js` extraction lands and de-duplicates four copies of the publish/sign-in error mapping, and the new `fetchKind1ForCommunity` follows the same `Relay.connect`-then-close pattern the publish wrapper has used since Slice 4. 15 new tests + 145/145 prior. Lint and build clean.

Six non-blocking notes; none are load-bearing. **NB-3** (no manual refresh) and **NB-5** (per-relay accounting once multi-relay lands) both fold naturally into the v1.1 mirror-tooling story.

The deploy chain on `feat/communities` is ready to absorb this slice. Ready to push.
