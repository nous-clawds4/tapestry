# ADR 0010: Conversation tab — kind-1 read/write + error-helper extraction

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/12-participate-kind1-reads-writes.md`

## Context

Story #12 wires the Conversation tab on `/community/:slug` to real kind-1 nostr notes. Two halves: fetch on tab-open + publish on Send. Same `VITE_USE_MOCK_DATA` toggle the rest of the slices use; same `publishEvent` wrapper for the write path.

Relevant facts:

- **nostr-tools `Relay.connect(url)`** returns a `Promise<Relay>`. The `Relay` instance has:
  - `relay.subscribe(filters, params)` where `params` includes `onevent(evt)`, `oneose()`, `eoseTimeout`, `onclose`. Returns a `Subscription` with a `.close()` method. EOSE = "end of stored events," the signal that the relay has flushed everything matching the filter.
  - `relay.publish(event)` returns `Promise<string>` (event id on success; rejects on relay-side rejection).
  - `relay.close()` tears the WebSocket down.
- **The `Conversation` tab in `CommunityDetail.jsx`** currently does:
  ```jsx
  {tab === 'conversation' && (
    <div>
      {signedIn && joined && <CommposerPlaceholder />}
      {posts.map(p => <PostCard post={p} />)}
      {posts.length === 0 && <p>No posts yet…</p>}
    </div>
  )}
  ```
  `posts` comes from `state.community.posts` — the mock projection. Slice 6 replaces that with a fetched array.
- **`PostCard` accepts `{ author, text, time }`** where `author` is a member id (mock) or a pubkey (real). The component already calls `getMember(author)` from mock data → returns an `Avatar` + name. Real-mode authors need a fallback (npub-short) when `getMember` returns undefined.
- **The community a-tag** is currently best-effort-synthesized at MemberDrawerContent (Slice 4 NB-3): `${39999}:${founder || viewer}:${slug}`. Same shape works here. When Slice 2 NB-4 lands real backend data sources, the canonical a-tag will come from the API response.
- **`publishErrorCopy` is duplicated across CommunityDetail, MemberDrawerContent, Create.** Slice 5 NB-1 flagged this; Slice 6 adds a fourth call site (the composer's publish path), making four copies the right moment to factor.

Constraints:

- **No new dependencies.** `nostr-tools` already provides `Relay` + `publish`. The subscribe-with-collect pattern is one function in `src/events/fetch.js`.
- **Mock-mode parity.** Dev keeps the existing mock `c.posts` arrays visible; the publish still mocks via the existing `[publish/mock]` log.
- **CLS = 0 on the Conversation tab.** Loading skeleton matches PostCard's height.
- **No live subscription.** One-shot fetch on tab-open + re-fetch after a successful send. Live subscription is out of scope.

## Options considered

### Option A — `src/events/fetch.js` + new `PostSkeleton` + composer-state in CommunityDetail + extract `src/lib/errors.js` (chosen)

1. **`src/events/fetch.js`** exports `fetchKind1ForCommunity({ communityATag, relays = DEFAULT_RELAYS, timeout = 5000 })` returning `Promise<Post[]>`.
   - Mock mode (`VITE_USE_MOCK_DATA === 'true'`): returns the mock community's `c.posts` array, projected to the `{ id, author, content, createdAt }` shape. The fetch helper takes the community-slug as a hint (or fetches the mock array via a small lookup) so it can project the right posts.
   - Real mode: for each relay in `relays` (v1: single entry), `Relay.connect` → `relay.subscribe([{ kinds: [1], '#a': [communityATag] }], { onevent, oneose, eoseTimeout: timeout })`. Collects events into a Map keyed by event id (dedupes across relays for v1.1+). On EOSE or timeout, sub close + relay close. Returns the projection sorted by `createdAt` descending.
2. **`buildKind1Post({ viewerPubkey, communityATag, content })`** added to `src/events/build.js`. Returns the unsigned kind-1 event with `tags: [['a', communityATag]]` and `content: text.trim()`.
3. **`PostSkeleton.jsx` + `PostSkeleton.module.css`** — mirrors `CardSkeleton`'s shimmer pattern at PostCard's dimensions. Three skeletons render during the initial fetch.
4. **`CommunityDetail.jsx` Conversation tab gains:**
   - `postsState: { status: 'idle' | 'loading' | 'ready' | 'error', posts: Post[], error?: Error }` (separate from the main `state` so re-fetches don't disturb the community detail).
   - `useEffect` keyed on `tab === 'conversation' && c.aTag` to lazy-fetch only when the tab is opened (avoids fetching for users who never click Conversation).
   - A `composerText` + `composerSending` state for the Send flow.
   - A `pendingPosts` array (the optimistic-update layer): when Send is clicked, prepend `{ id: <uuid>, author: viewer, content: text, createdAt: now, pending: true }`. On publish success, replace with the real event-id'd post. On failure, mark the pending entry with `error: true` and surface a Retry button on that post.
5. **`PostCard` extended** to accept the new `Post` shape (`{ id, author, content, createdAt, pending?, error? }`) alongside the legacy mock shape. The `author` field projects via `getMember(author)` first (mock fallback); if that returns nothing, render `npubShort(author)` from `auth/viewer.js`.
6. **`src/lib/errors.js` extracted.** Exports `publishErrorCopy(result)` + `signInErrorCopy(code)`. All four call sites import from here; the local duplicates are deleted.
7. **Member composer JSX:** textarea + Send button, gated on `signedIn && joinedSet.has(slug)`. Non-member alt: small "Join this circle to post" pointer (no fake-disabled affordance).

**Pros:**
- Mirrors every prior write-path slice exactly. No new abstractions; the existing `publishEvent` wrapper handles the publish.
- Mock-mode parity: existing `c.posts` arrays surface through the fetch helper's mock branch, so dev review stays populated.
- One-shot fetch keeps the relay connection short — no long-lived WebSocket overhead. v1 doesn't need live updates.
- Extracting `errors.js` resolves NB-1 alongside the new write surface; this is the natural moment.

**Cons:**
- No live updates means users have to refresh to see others' posts. Acceptable for v1 (explicit out-of-scope in the story).

### Option B — Persistent live subscription + reactive state

Open a long-lived subscription when the Conversation tab opens; receive events as they arrive. New posts appear without refresh.

**Pros:**
- Best UX for active conversations.

**Cons (why rejected):**
- More complex lifecycle: subscription needs to close on tab change, route change, unmount. Race conditions on rapid navigation.
- Long-lived WebSocket per open tab = real cost at scale (each viewer × each community × each tab).
- Premature for v1's expected volume. Add later as a separate ADR when the data justifies it.

### Option C — Server-side `/api/communities/:slug/posts` endpoint

Add a REST endpoint that queries strfry for kind-1 events and returns JSON. UI hits `/api/...` instead of the relay directly.

**Pros:**
- Centralizes the read path. Server can cache.
- Aligns with the rest of the API surface (community list + detail + members).

**Cons (why rejected):**
- The kind-1 read isn't coupled to the API layer; reading directly from the relay is the standard nostr client pattern.
- Adding the endpoint forces Slice 6 to wait on Slice 2 NB-4 (real backend data sources). Direct-relay reads decouple us from that wait.
- The endpoint becomes a sync point: when Slice 2 NB-4 lands, the relay→strfry→API path adds latency vs. the relay-direct path. Better to keep kind-1 reads independent.
- Writes already go direct to the relay (Slices 4–5); making reads also direct is symmetric.

## Decision

We chose **Option A**.

Direct-to-relay read + the existing publish wrapper for writes is the minimal new surface. Mock-mode parity preserves the dev-review flow. The `errors.js` extraction is the right side-task to bundle: four call sites is the trigger, and Slice 6 is the moment.

Trade-off accepted: no live updates in v1. Easy to add as a follow-up.

## Consequences

- **Enables:** v1 ships the last journey from PLAN.md §6. Conversations work end-to-end on the deployed droplet as soon as it exists.
- **Constrains:** Refresh-to-see-others-posts is the v1 behavior. Document expectation-setting for non-technical reviewers.
- **New debt:** Live-subscription story (Option B) becomes a real future ADR if the v1 UX hits the refresh-fatigue wall.
- **Firmware reinstall?** No.

## Implementation notes

### Files & layout (new in `ui-communities/`)

```
src/events/
└── fetch.js               — fetchKind1ForCommunity wrapper

src/components/
├── PostSkeleton.jsx       — loading-state placeholder
├── PostSkeleton.module.css

src/lib/
└── errors.js              — publishErrorCopy + signInErrorCopy (extracted)
```

### `src/events/fetch.js` shape

```js
import { Relay } from 'nostr-tools/relay'
import { DEFAULT_RELAYS } from './publish.js'
import { communities } from '../data/mockData.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

const FETCH_TIMEOUT_MS = 5000

/**
 * @typedef {Object} Post
 * @property {string} id
 * @property {string} author     hex pubkey or mock member id
 * @property {string} content
 * @property {number} createdAt  unix seconds
 * @property {boolean} [pending] optimistic placeholder
 * @property {boolean} [error]   publish failed
 */

export async function fetchKind1ForCommunity({ communityATag, slug, relays = DEFAULT_RELAYS, timeout = FETCH_TIMEOUT_MS }) {
  if (USE_MOCK) {
    return projectMockPosts(slug)
  }
  // Collect kind-1 events from all relays into a Map<id, event>.
  const events = new Map()
  const filter = { kinds: [1], '#a': [communityATag] }
  await Promise.all(relays.map(url => collectFromRelay(url, filter, events, timeout)))
  return Array.from(events.values())
    .map(projectRealEvent)
    .sort((a, b) => b.createdAt - a.createdAt)
}

async function collectFromRelay(url, filter, eventsMap, timeoutMs) {
  let relay
  try {
    relay = await Relay.connect(url)
  } catch {
    return  // silently skip a relay that won't connect; aggregate over the rest
  }
  await new Promise(resolve => {
    const sub = relay.subscribe([filter], {
      onevent: (e) => { eventsMap.set(e.id, e) },
      oneose: () => { sub.close(); resolve() },
      eoseTimeout: timeoutMs,
    })
    setTimeout(() => { try { sub.close() } catch {} resolve() }, timeoutMs + 200)
  })
  try { relay.close() } catch { /* ignore */ }
}

function projectRealEvent(e) {
  return { id: e.id, author: e.pubkey, content: e.content, createdAt: e.created_at }
}

function projectMockPosts(slug) {
  const c = communities.find(x => x.slug === slug)
  if (!c || !Array.isArray(c.posts)) return []
  return c.posts.map((p, i) => ({
    id: `mock-${slug}-${i}`,
    author: p.author,
    content: p.text,
    createdAt: parseMockTime(p.time),
  })).sort((a, b) => b.createdAt - a.createdAt)
}

function parseMockTime(time) {
  // Mock posts use "2h ago" / "5h ago" / "1d ago". Convert to unix seconds.
  const now = Math.floor(Date.now() / 1000)
  const m = /(\d+)\s*(m|h|d)/.exec(time || '')
  if (!m) return now
  const n = parseInt(m[1], 10)
  switch (m[2]) {
    case 'm': return now - n * 60
    case 'h': return now - n * 3600
    case 'd': return now - n * 86400
    default: return now
  }
}
```

### `buildKind1Post` added to `src/events/build.js`

```js
export function buildKind1Post({ viewerPubkey, communityATag, content }) {
  if (!viewerPubkey) throw new Error('buildKind1Post: viewerPubkey is required')
  if (!communityATag) throw new Error('buildKind1Post: communityATag is required')
  if (!content || !content.trim()) throw new Error('buildKind1Post: content is required')
  return {
    kind: 1,
    tags: [['a', communityATag]],
    content: content.trim(),
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}
```

### `src/lib/errors.js` extraction

```js
export function publishErrorCopy(result) {
  switch (result && result.error) {
    case 'no-extension': return 'Sign in with a nostr extension to publish.'
    case 'rejected': return 'Signing cancelled.'
    case 'timeout': return 'The relay took too long to confirm. Try again?'
    case 'rejected-by-relay': return 'The relay rejected this event.'
    case 'network': return 'We could not reach the relay. Check your connection?'
    default: return 'Something went wrong publishing. Try again?'
  }
}

export function signInErrorCopy(code) {
  switch (code) {
    case 'no-extension': return 'Brainstorm Communities needs a nostr browser extension to sign in. Try Alby or nos2x.'
    case 'rejected': return 'Sign-in cancelled.'
    default: return 'Sign-in failed. Try again?'
  }
}
```

Delete the local definitions in: `CommunityDetail.jsx`, `MemberDrawerContent.jsx`, `Create.jsx`, and `Header.jsx` (which has `errorCopyFor` — same function, different name; consolidate to `signInErrorCopy`).

### `CommunityDetail.jsx` changes

**New imports:**
```js
import PostSkeleton from '../components/PostSkeleton.jsx'
import { fetchKind1ForCommunity } from '../events/fetch.js'
import { buildKind1Post } from '../events/build.js'
import { publishErrorCopy } from '../lib/errors.js'
```

**New state:**
```js
const [postsState, setPostsState] = useState({ status: 'idle', posts: [], error: null })
const [composerText, setComposerText] = useState('')
const [composerSending, setComposerSending] = useState(false)
const [pendingPosts, setPendingPosts] = useState([])  // optimistic + error variants
```

**Lazy-fetch effect (only when Conversation tab is open):**
```js
useEffect(() => {
  if (tab !== 'conversation' || !c) return
  let cancelled = false
  const aTag = c.aTag || `39999:${c.founder || viewer || ''}:${c.slug}`
  setPostsState(prev => ({ ...prev, status: 'loading', error: null }))
  fetchKind1ForCommunity({ communityATag: aTag, slug: c.slug })
    .then(posts => {
      if (cancelled) return
      setPostsState({ status: 'ready', posts, error: null })
    })
    .catch(error => {
      if (cancelled) return
      console.error('[CommunityDetail] kind-1 fetch failed:', error)
      setPostsState({ status: 'error', posts: [], error })
    })
  return () => { cancelled = true }
}, [tab, c?.slug, c?.aTag, viewer])
```

**Send handler:**
```js
async function handleSendPost() {
  if (!signedIn || !viewer || !joined || composerSending) return
  const text = composerText.trim()
  if (!text) return
  const aTag = c.aTag || `39999:${c.founder || viewer || ''}:${c.slug}`
  const pendingId = crypto.randomUUID()
  setPendingPosts(prev => [{ id: pendingId, author: viewer, content: text, createdAt: Math.floor(Date.now() / 1000), pending: true }, ...prev])
  setComposerSending(true)
  const unsigned = buildKind1Post({ viewerPubkey: viewer, communityATag: aTag, content: text })
  const result = await publishEvent(unsigned)
  setComposerSending(false)
  if (!result.ok) {
    setPendingPosts(prev => prev.map(p => p.id === pendingId ? { ...p, pending: false, error: publishErrorCopy(result) } : p))
    return
  }
  // Replace optimistic placeholder with the real event id; clear composer.
  setPendingPosts(prev => prev.map(p => p.id === pendingId ? { id: result.eventId, author: viewer, content: text, createdAt: Math.floor(Date.now() / 1000) } : p))
  setComposerText('')
}
```

**Render Conversation tab:**
- `postsState.status === 'loading'`: three `PostSkeleton`s
- `postsState.status === 'error'`: `<FetchError onRetry={...}>`
- `postsState.status === 'ready'`: render `[...pendingPosts, ...postsState.posts]` via PostCard
- empty state: existing "No posts yet" copy when both arrays are empty

**Composer render:**
- `signedIn && joined`: textarea (`rows={3}`) + Send button (disabled when `!composerText.trim() || composerSending`)
- Else: small inline `<p className={s.composerPrompt}>Join this circle to post.</p>` with no input

### `PostCard.jsx` adapter

```js
import { getMember } from '../data/mockData.js'
import { npubShort } from '../auth/viewer.js'

export default function PostCard({ post }) {
  // Adapt both shapes:
  // - new: { id, author, content, createdAt, pending?, error? }
  // - legacy mock: { author, text, time }
  const content = post.content ?? post.text
  const time = post.time ?? relativeTime(post.createdAt)
  const author = typeof post.author === 'string' ? post.author : ''
  const m = author ? getMember(author) : null
  const authorName = m ? m.name : (author && /^[0-9a-f]{64}$/i.test(author) ? npubShort(author) : 'unknown')
  // ...render Avatar, authorName, content, time, plus optional pending/error indicators
}
```

`relativeTime(unixSec)` is a small helper that returns "just now" / "Nm ago" / "Nh ago" / "Nd ago".

### `PostSkeleton` shape

Mirrors `CardSkeleton`'s shimmer pattern at the height of a `PostCard` (~80px). Three rendered side-by-side in the loading state.

### Tests

Tester writes `test/participate-kind1-reads-writes.test.js`:

**Pure-function (T1–T4):**
- T1: `buildKind1Post` returns `{ kind: 1, tags: [['a', communityATag]], content: <trimmed>, created_at: number, pubkey: viewer }`.
- T2: `buildKind1Post` throws when `viewerPubkey` is empty.
- T3: `buildKind1Post` throws when `communityATag` is empty.
- T4: `buildKind1Post` throws when `content` is empty/whitespace.

**Source-regex (T5–T13):**
- T5: `src/events/fetch.js` exports `fetchKind1ForCommunity`.
- T6: `fetch.js` gates mock vs real on `VITE_USE_MOCK_DATA === 'true'`.
- T7: `fetch.js` real-mode subscribes with the filter `{ kinds: [1], '#a': [communityATag] }`.
- T8: `fetch.js` handles `oneose` (closes the subscription on end-of-stored-events).
- T9: `CommunityDetail.jsx` imports `fetchKind1ForCommunity` + `buildKind1Post` + `publishErrorCopy` from the right paths.
- T10: `CommunityDetail.jsx` composer renders only when `signedIn && joined`.
- T11: `CommunityDetail.jsx` Send handler calls `publishEvent` with the result of `buildKind1Post`.
- T12: `src/lib/errors.js` exports `publishErrorCopy` + `signInErrorCopy`.
- T13: The duplicate `publishErrorCopy` defs are gone from `CommunityDetail.jsx`, `MemberDrawerContent.jsx`, `Create.jsx`; all import from `'../lib/errors.js'`.

**Component existence (T14–T15):**
- T14: `PostSkeleton.jsx` exists and exports a `PostSkeleton` component.
- T15: `PostCard.jsx` handles the new `{ id, author, content, createdAt }` shape AND falls back to `npubShort` for hex-pubkey authors not present in mockData.

### Manual staging smoke (post-deploy)

```bash
# Join a community, navigate to its Conversation tab.
# Type a note, click Send.
# Console should NOT show [publish/mock] in prod.
# Verify the kind-1 event landed:
websocat wss://communities.brainstorm.world \
  <<<'["REQ","x",{"kinds":[1],"#a":["<community-a-tag>"]}]'
# Expect: your event among the returned events.
```

## Out of scope

- **Live subscription** (Option B; deferred).
- **Server-side `/api/communities/:slug/posts` endpoint** (Option C; deferred — direct-to-relay is the canonical nostr pattern).
- **Pagination, replies, reactions, long-form, media uploads.**
- **Author profile resolution (kind-0 → display name + avatar).** v1 shows npub-short.
- **Real relay-side membership whitelist enforcement.** Deferred to v1.1 alongside mirror tooling.
