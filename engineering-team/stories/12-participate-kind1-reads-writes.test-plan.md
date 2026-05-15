# Test Plan: Story 12 — Participate (kind-1 reads + writes)

**Story:** `engineering-team/stories/12-participate-kind1-reads-writes.md`
**ADR:** `engineering-team/decisions/0010-participate-kind1-reads-writes.md`
**Date:** 2026-05-14

## Approach

Two surfaces:

1. **Pure-function tests** for `buildKind1Post` — verify the event shape (kind 1, content trimmed, `a` tag, throws on empty inputs). Same approach as Slice 4's event builders.
2. **Source-regex tests** for the rest: `fetch.js` shape (mode toggle, filter shape, EOSE handling), `CommunityDetail.jsx` wiring (imports, member-only composer, Send via publishEvent), `errors.js` extraction landed and the duplicates are deleted, `PostSkeleton` exists, `PostCard` adapts the new shape.

Live behavior (real WebSocket → relay → publish → query roundtrip) stays at staging smoke per the test plan §"Manual smoke." Mock-mode visual review stays at preview-tool level.

## Coverage map

### `buildKind1Post` pure function (T1–T4)

| Criterion | Test | Level |
|---|---|---|
| AC: kind 1 + a-tag + trimmed content | T1 `buildKind1Post returns kind 1, tags: [['a', aTag]], content trimmed, created_at: number, pubkey: viewer` | unit |
| AC: viewerPubkey required | T2 `buildKind1Post throws when viewerPubkey is empty/null/undefined` | unit |
| AC: communityATag required | T3 `buildKind1Post throws when communityATag is empty` | unit |
| AC: content required + non-whitespace | T4 `buildKind1Post throws when content is empty or whitespace-only` | unit |

### `fetch.js` shape (T5–T8, source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: exports fetchKind1ForCommunity | T5 `src/events/fetch.js exports fetchKind1ForCommunity` | source-regex |
| AC: mode toggle strict === 'true' | T6 `fetch.js gates on VITE_USE_MOCK_DATA === 'true'` | source-regex |
| AC: real-mode subscribes with kind-1 + #a filter | T7 `fetch.js subscribes with the filter { kinds: [1], '#a': [...] }` | source-regex |
| AC: handles EOSE | T8 `fetch.js attaches an oneose callback that closes the subscription` | source-regex |

### `CommunityDetail.jsx` wiring (T9–T11, source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: correct imports | T9 `CommunityDetail.jsx imports fetchKind1ForCommunity + buildKind1Post + publishErrorCopy from the right paths` | source-regex |
| AC: composer member-gated | T10 `CommunityDetail.jsx renders the composer only when signedIn && joined (or equivalent)` | source-regex |
| AC: Send goes through publishEvent | T11 `CommunityDetail.jsx Send handler calls publishEvent with the result of buildKind1Post` | source-regex |

### `src/lib/errors.js` extraction (T12–T13)

| Criterion | Test | Level |
|---|---|---|
| AC: errors.js exports both helpers | T12 `src/lib/errors.js exports publishErrorCopy + signInErrorCopy` | source-regex |
| AC: duplicate definitions removed; imports added | T13 `CommunityDetail.jsx, MemberDrawerContent.jsx, Create.jsx no longer define publishErrorCopy locally — all import from '../lib/errors.js'` | source-regex |

### Components (T14–T15)

| Criterion | Test | Level |
|---|---|---|
| AC: PostSkeleton exists | T14 `PostSkeleton.jsx exports a PostSkeleton component` | source-regex |
| AC: PostCard handles new shape + npub fallback | T15 `PostCard.jsx accepts post.content (new shape) AND falls back to npubShort for hex-pubkey authors not in mockData` | source-regex |

### Regression

| Criterion | Test | Level |
|---|---|---|
| AC: 158 pre-existing tests still pass | full test run | regression |
| AC: build + lint clean | `cd ui-communities && npm run build && npm run lint` | CI |

## Edge cases

- [x] **Relay connection fails.** `collectFromRelay` catches and returns early; the aggregate over multiple relays still resolves (`Promise.all` with all-skip becomes empty results). Test plan documents this; not a regression — surfaces as the empty state or as the FetchError block depending on whether any other relay succeeded.
- [x] **Network never sends EOSE.** `setTimeout` fallback at `timeoutMs + 200` force-closes the subscription. Verified by source inspection of fetch.js timeout handling.
- [x] **Same event id arrives from two relays.** `Map<id, event>` dedupes. v1 only queries one relay so this is forward-compatible, not actively exercised.
- [x] **Optimistic post + publish failure.** Pending post gets `error: true` flag; PostCard renders the error indicator + Retry. The pending post stays in the list so the user can retry without re-typing.
- [x] **User signs out mid-publish.** `viewer` becomes null during the in-flight publish; the publish completes (NIP-07 already signed); the optimistic post becomes a real post with the just-departed viewer's pubkey as author. Not a bug.
- [x] **Empty composer.** Send is disabled.
- [x] **Composer text contains only whitespace.** Trim before publish; Send disabled if `!content.trim()`.

## Not covered (intentional)

- **Live WebSocket round-trip** to `wss://communities.brainstorm.world`. Staging smoke verifies via `websocat`.
- **Real strfry-side membership whitelist enforcement.** Deferred to v1.1.
- **Live updates** (push new posts as they arrive). Out of scope per Option B rejection.
- **Pagination / replies / reactions.** Explicit out of scope.
- **Profile resolution.** Slice 2 NB-1.

## Test infrastructure

- Node runner. New file `test/participate-kind1-reads-writes.test.js`.
- Pure-function tests load `buildKind1Post` via the same source-extract-then-eval pattern used for Slice 5's `slugify` (build.js is ESM).
- Source-regex tests against the new + modified files.

## How to run

```bash
npm test
```

Manual visual verification:

```bash
cd ui-communities && npm run dev
# Open http://localhost:5174
# Sign in (if NIP-07 extension installed)
# Navigate to /community/listening-room (or any joined community)
# Click Conversation tab → existing mock posts render
# Type in the composer → click Send
# DevTools console shows [publish/mock] with the kind-1 event
# Optimistic post appears at the top of the list
# Refresh — mock post comes back (mock data is stable)
```

Manual staging smoke (post-deploy):

```bash
# Visit https://communities.brainstorm.world with NIP-07 extension
# Sign in. Join a community (or create one). Click Conversation.
# Type + Send a post. Console should NOT show [publish/mock].
# Verify the kind-1 event landed:
websocat wss://communities.brainstorm.world \
  <<<'["REQ","x",{"kinds":[1],"#a":["<community-a-tag>"],"authors":["<viewer-hex>"]}]'
# Expect: the just-published event in the returned stream.
```

## Verification

Tests fail with the current code (no `src/events/fetch.js`, no `PostSkeleton`, no `src/lib/errors.js`, CommunityDetail still uses mock `c.posts`). Confirmed-failing on the previous commit; the test file lands here and confirms-failing for the right reasons before Implementation.
