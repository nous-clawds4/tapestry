# ADR 0008: NIP-07 sign-in, event construction, and publish wrapper layering

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/10-nip07-signin-and-writes.md`

## Context

Story #10 lands four things that all touch the same client surface:

1. NIP-07 sign-in (Header button → `window.nostr.getPublicKey()` → persist viewer pubkey).
2. Viewer threading (the active pubkey starts flowing through the API client + publish path).
3. Event construction (pure functions that build kind-39999 community-records + endorsement signals matching the firmware schemas from Slice 1).
4. Publish wrapper (`publishEvent` — signs via NIP-07, then either logs or sends to a relay).

The four pieces compose differently in dev vs. production but share the same conceptual flow: build event → request signature → log-or-send → resolve to a result the UI can act on.

Relevant facts:

- **`window.nostr`** is the NIP-07 surface in the browser. Methods: `getPublicKey() → Promise<hex>`, `signEvent(unsigned) → Promise<signed>`. Optional `getRelays()`, `nip04.encrypt`, etc. — not used in Slice 4.
- **`nostr-tools`** at version `^2.23.3` (matches `ui/package.json:14`) provides: `getEventHash`, `verifyEvent`, `nip19.npubEncode/decode`, `Relay.connect`, event-publishing helpers. Already battle-tested in `ui/`.
- **The Header lives in `ui-communities/src/components/Header.jsx`** and currently takes `signedIn` as a boolean prop. Slice 4 needs the actual viewer pubkey (or null), so Header's contract evolves from `signedIn: boolean` to `viewer: string | null`.
- **App-state state lives at the App root** (`ui-communities/src/App.jsx`). Slice 0–3 hold `signedIn`, `joinedSet`, `vouchedSet`, `drawerMember`, `drawerCommunitySlug` there. Slice 4 adds `viewer` (the active pubkey) to that set, and the `signedIn` boolean derives as `viewer !== null`.
- **`localStorage` API** is synchronous + globally available in the browser. Persisting the viewer pubkey is one line each on sign-in / sign-out.
- **The existing `client.js` (Slice 3) already accepts a `viewer` argument** in all three exports — the threading work is mostly "where does the viewer come from?" not "where does it go?".
- **The community-record event shape is locked by PLAN.md §3** (tag set + `content: ""`). The signal event shape is locked by `COMMUNITY_ENDORSEMENTS_DLIST.md` + the brainstorm-community-signal schema from Slice 1.
- **The publish wrapper has two modes** matching the `VITE_USE_MOCK_DATA` toggle from Slice 3 — mock mode logs, real mode sends. Paired states means one env var, one decision point at module load.
- **No new server-side endpoints in Slice 4.** Writes go directly from the client to a relay via WebSocket; the Tapestry server reads from the same relay (via strfry) on the next API request. This is the nostr publish model — clients write to relays, not to servers.

Constraints:

- **No new build / lint / typecheck tooling.** `nostr-tools` is a runtime dep, not tooling. Match the version `ui/` uses.
- **The publish path must work in dev without a Docker stack.** The mock-mode log path satisfies this.
- **The signing flow must be testable.** Pure-function event construction is unit-testable; the NIP-07 prompt itself requires a browser extension and is tested manually + via the preview tool.

## Options considered

### Option A — `nostr-tools` for event helpers + a thin `auth/` module + `publish/` module + a `useViewer` hook (chosen)

1. **Add `nostr-tools` to `ui-communities/package.json`** at `^2.23.3` (version match with `ui/`).
2. **New module `src/auth/viewer.js`** exports:
   - `getStoredViewerPubkey() → string | null` — reads `localStorage.brainstormCommunitiesViewerPubkey`.
   - `storeViewerPubkey(pubkey) → void` — writes localStorage.
   - `clearStoredViewerPubkey() → void` — clears localStorage.
   - `signInWithNip07() → Promise<{ ok: true, pubkey } | { ok: false, error: 'no-extension' | 'rejected' | 'unknown' }>` — wraps `window.nostr.getPublicKey()` with error handling.
   - `npubShort(hex) → string` — formats a hex pubkey as `npub1<first6>...<last6>` for display.
3. **`App.jsx` integrates the viewer state.** Replaces the `signedIn: useState(true)` placeholder with:
   ```js
   const [viewer, setViewer] = useState(() => getStoredViewerPubkey())
   const signedIn = viewer !== null
   ```
   Plus `onSignIn` / `onSignOut` callbacks passed into Header.
4. **Header.jsx evolves** to take `viewer` + `onSignIn` + `onSignOut` props. The user-menu dropdown renders the npub-short + Copy npub + Sign out items. The Sign-in button calls `signInWithNip07()` inline and surfaces errors as inline copy below the button.
5. **New module `src/events/build.js`** exports pure-function event builders:
   - `buildCommunityRecord({ viewerPubkey, community }) → unsignedEvent` — kind 39999, builds tags per PLAN.md §3.
   - `buildEndorsementSignal({ viewerPubkey, targetPubkey, communityATag, type, role, comments }) → unsignedEvent` — kind 39999, builds tags per the firmware signal schema. `type` defaults to `'endorse'`, `role` defaults to `'member'`. The d-tag is `${role}:${targetPubkey}:${communityATag}` so successive signals for the same `(role, target, community)` tuple replace.
   - `buildCommunitiesDListHeader({ viewerPubkey }) → unsignedEvent` — kind 39998 brainstorm-communities header (used the first time a user joins anything).
6. **New module `src/events/publish.js`** exports `publishEvent(unsignedEvent) → Promise<PublishResult>`:
   - Reads `import.meta.env.VITE_USE_MOCK_DATA === 'true'` once at module load (same toggle as `client.js`).
   - Mock mode: `await window.nostr.signEvent(unsigned)`, then `console.log('[publish/mock]', signed)`, return `{ ok: true, eventId: signed.id, signed, relaysAccepted: [] }`.
   - Real mode: same `signEvent`, then `Relay.connect('wss://communities.brainstorm.world')`, `await relay.publish(signed)` with a 10s timeout. Return `{ ok: true, eventId, signed, relaysAccepted: ['wss://communities.brainstorm.world'] }` on accept; `{ ok: false, error: 'rejected' | 'timeout' | 'network', message }` on failure.
   - Default relay URL is a module constant `DEFAULT_RELAYS = ['wss://communities.brainstorm.world']`. Per-community relay overrides (reading `relay` tags from the community-record) are future-Slice work; the wrapper signature accepts an optional `relays` arg for forward-compat.
7. **Page-level wiring.** `CommunityDetail.jsx` Join button → `buildCommunityRecord` + `publishEvent`; result `ok=true` → setJoinedSet; result `ok=false` → inline error. Vouch + Raise-a-concern similar.
8. **Raise-a-concern confirmation dialog** — new component `ConcernDialog.jsx` opens on the Raise-a-concern button click. Has an optional `<textarea maxLength={280}>` and Cancel + Confirm buttons. Confirm publishes the veto signal.
9. **The existing `Drawer.jsx` already supports the slide-in pattern** — the concern confirmation could be a Drawer variant, but a dedicated `ConcernDialog` (centered modal) reads better for a confirmation UX. New component, ~30 LoC.
10. **Optimistic state with rollback.** Join / Vouch / Concern all update local state synchronously when the button is clicked; on `publishEvent` resolve, if `ok: false`, the state is reverted and an error toast / inline message appears for ~4 seconds.

**Pros:**
- One env-var toggle gates both data-mode (Slice 3) and publish-mode (Slice 4). Single source of truth.
- Event construction is pure-function, so it's unit-testable in isolation.
- `nostr-tools` matches the existing `ui/` version → upgrades stay coordinated.
- Sign-in state is a single piece of React state at the App root; threads cleanly through outlet context like every other piece of cross-page state.
- Auth module wraps `window.nostr` so we never touch the global directly outside `auth/viewer.js`.

**Cons:**
- New runtime dep (nostr-tools). 80 kB gzipped. Acceptable — matches the existing `ui/` bundle size profile.
- No retry on transient relay failures. Acceptable for v1.

### Option B — Hand-rolled event signing (no `nostr-tools`)

NIP-07's `signEvent` handles the signature; `nostr-tools` mostly contributes `getEventHash`, `nip19.npubEncode`, and the relay-publish helper. We could:
- Compute the event hash via Web Crypto API directly (SHA-256 of the serialized event).
- Format npubs with a bech32 hand-implementation (~50 LoC).
- Open the WebSocket and serialize messages by hand.

**Pros:**
- Zero new runtime deps.
- Smaller bundle.

**Cons (why rejected):**
- bech32 hand-implementation is error-prone. Getting npub encoding wrong silently breaks every "Copy npub" affordance.
- WebSocket message format isn't trivial — handling `OK` / `EOSE` / `NOTICE` correctly across edge cases is real work.
- We'd be reinventing a tested wheel. The cost-savings (one dep) isn't worth the implementation risk for a slice with this much surface area.
- `nostr-tools` is already in `ui/`. Consistency across the two apps is worth more than the bundle delta.

### Option C — Server-mediated publishing (POST endpoints that take signed events and forward to relays)

Add `POST /api/communities/:slug/join`, `POST /api/communities/:slug/endorse`, etc. The client sends the signed event; the server forwards to the relay set via `strfry sync`. Server is in the loop on every write.

**Pros:**
- Centralizes relay-set decisions on the server.
- Easier server-side observability of writes (count, log, audit).

**Cons (why rejected):**
- It's not how nostr works. Clients publish to relays directly; servers index events that flow through relays. Server-mediated publishing adds a hop without adding capability.
- Couples the UI to the server's availability. Slice 0–3 carefully kept the UI fetch-able even when the server is empty; Slice 4 shouldn't break that for the write path.
- Requires new auth on those POST endpoints (sign request bodies? validate the embedded event's signature server-side anyway?). Doubles the auth surface.
- Doesn't solve any real problem the direct-publish path doesn't.

## Decision

We chose **Option A**.

The pure-function event-construction + thin auth wrapper + module-load-time publish-mode decision is the minimum new surface that lands the four sub-features cleanly. Re-using the `VITE_USE_MOCK_DATA` toggle from Slice 3 keeps configuration simple. `nostr-tools` is the right cost — one dep, version-matched with `ui/`, well-tested.

Trade-offs accepted: bundle adds ~80 kB gzip (nostr-tools), and we'll need to revisit relay-set selection when communities start carrying their own relay tags.

## Consequences

- **Enables:** Slice 5 (Create flow) reuses the same `publishEvent` for newly-created communities. Slice 6 (kind-1 conversation) reuses the same auth-context for the post-composer.
- **Constrains:** Future "remote signer" support (NIP-46) requires extending `auth/viewer.js` to dispatch between NIP-07 and NIP-46 signers based on a user preference. Easy to add later; not in v1.
- **New debt:** Optimistic-with-rollback is naive (no retry, no exponential backoff). When real publish failures start happening on staging, we'll have data on what kinds of failures matter and can add retry policies in a follow-up.
- **Firmware reinstall?** No — Slice 1 already activated v1.1.0; Slice 4 consumes those schemas.

## Implementation notes

### Files & layout (new in `ui-communities/`)

```
src/auth/
├── viewer.js              — sign-in + localStorage + npub helpers

src/events/
├── build.js               — pure-function event builders
└── publish.js             — sign + log/send wrapper

src/components/
├── ConcernDialog.jsx      — Raise-a-concern confirmation modal
├── ConcernDialog.module.css
```

### `ui-communities/package.json`

```diff
 "dependencies": {
+  "nostr-tools": "^2.23.3",
   "react": "^19.2.0",
   "react-dom": "^19.2.0",
   "react-router-dom": "^7.13.1"
 },
```

### `src/auth/viewer.js` API surface

```js
export function getStoredViewerPubkey(): string | null
export function storeViewerPubkey(pubkey: string): void
export function clearStoredViewerPubkey(): void
export async function signInWithNip07(): Promise<{ ok: true, pubkey: string } | { ok: false, error: ErrorCode }>
export function npubShort(hex: string): string  // "npub1n0e...l9rk23"
export function npubFull(hex: string): string   // full npub for copy
```

Error codes: `'no-extension'`, `'rejected'`, `'unknown'`.

### `src/events/build.js` API surface

```js
export function buildCommunityRecord({ viewerPubkey, community }): UnsignedEvent
export function buildEndorsementSignal({
  viewerPubkey, targetPubkey, communityATag,
  type = 'endorse', role = 'member', comments = null,
}): UnsignedEvent
export function buildCommunitiesDListHeader({ viewerPubkey }): UnsignedEvent
```

D-tag for signal events: `${role}:${targetPubkey}:${communityATag}` — escape colons in the tag value if needed (community a-tags already contain colons, so wrap with a separator that doesn't collide; `|` is safe in tag values).

### `src/events/publish.js` API surface

```js
export async function publishEvent(unsigned, options = {}): Promise<PublishResult>
// options.relays?: string[] = DEFAULT_RELAYS
// options.timeout?: number = 10000 ms

export const DEFAULT_RELAYS = ['wss://communities.brainstorm.world']

type PublishResult =
  | { ok: true, eventId: string, signed: SignedEvent, relaysAccepted: string[] }
  | { ok: false, error: 'no-extension' | 'rejected' | 'network' | 'rejected-by-relay' | 'timeout' | 'unknown', message: string }
```

Mock mode (`VITE_USE_MOCK_DATA === 'true'`): sign via NIP-07, log, resolve `{ ok: true, eventId, signed, relaysAccepted: [] }`. Real mode: sign, then iterate `options.relays`, open WebSocket, send `["EVENT", signed]`, await `["OK", id, accepted, msg]` with timeout. Resolve `relaysAccepted` listing relays that returned `accepted=true`; if zero, `{ ok: false, error: 'rejected-by-relay' }`.

### `App.jsx` viewer state

```js
const [viewer, setViewer] = useState(() => getStoredViewerPubkey())
const signedIn = viewer !== null

const handleSignIn = useCallback(async () => {
  const result = await signInWithNip07()
  if (result.ok) {
    storeViewerPubkey(result.pubkey)
    setViewer(result.pubkey)
  }
  return result  // Header surfaces the error
}, [])

const handleSignOut = useCallback(() => {
  clearStoredViewerPubkey()
  setViewer(null)
}, [])
```

Then thread `viewer`, `handleSignIn`, `handleSignOut` through outlet context alongside the existing values.

### Header changes

Accepts `viewer` (string | null), `onSignIn` (returns Promise<{ ok, error? }>), `onSignOut`. Renders `npubShort(viewer)` in the chip + dropdown header. "Copy npub" copies `npubFull(viewer)`. The "Sign in" button has local state for the in-flight prompt + the error message; on error, renders `<p className={s.signInError}>...</p>` below the chip.

### Page wiring (CommunityDetail, MemberRow + Drawer)

`CommunityDetail.jsx` Join button handler becomes:

```js
const handleJoin = async () => {
  if (!state.community) return
  if (!viewer) return
  // Optimistic update
  onJoin(state.community.slug)
  const unsigned = buildCommunityRecord({ viewerPubkey: viewer, community: state.community })
  const result = await publishEvent(unsigned)
  if (!result.ok) {
    onLeave(state.community.slug)  // revert
    setPublishError(`Couldn't publish your community record: ${result.message}`)
  }
}
```

Similarly for Vouch / Raise-a-concern. The `publishError` state is local to each page; surfaces as inline below the action button for ~4 seconds (use `setTimeout` clear).

### ConcernDialog component

Centered modal (NOT the right-side Drawer). Has `<textarea>` with `maxLength={280}` + counter, Cancel + Confirm buttons. ESC closes (Cancel-equivalent). Confirm fires the publish; while in-flight, both buttons disable.

### Tests

Tester writes a new suite at `test/nip07-signin-and-writes.test.js`:

**Pure-function tests (event builders):**
- T1: buildCommunityRecord output has kind 39999, d=slug, z pointing at the user's brainstorm-communities DList, t=slug, all required tags present per PLAN.md §3.
- T2: buildCommunityRecord copies optional tags only when present (no empty `image` tag if image is null).
- T3: buildEndorsementSignal has kind 39999, p=target, a=communityATag, type/role defaults, deterministic d-tag.
- T4: buildEndorsementSignal d-tag is unique over (role, target, community); calling twice with same inputs produces the same d-tag.
- T5: buildEndorsementSignal d-tag changes when role flips (member → moderator).
- T6: buildCommunitiesDListHeader has kind 39998, d="brainstorm-communities", names + titles + required schema-declaration tags per PLAN.md §3.

**Source-regex tests:**
- T7: viewer.js exports signInWithNip07 + npubShort + npubFull + getStoredViewerPubkey + storeViewerPubkey + clearStoredViewerPubkey.
- T8: viewer.js localStorage key is exactly 'brainstormCommunitiesViewerPubkey' (one string match).
- T9: viewer.js never touches window.nostr outside the signInWithNip07 function (other components route through viewer.js, never directly).
- T10: publish.js gates mock vs real on `VITE_USE_MOCK_DATA === 'true'` (same strict comparison as Slice 3 client.js).
- T11: publish.js DEFAULT_RELAYS includes 'wss://communities.brainstorm.world'.
- T12: publish.js mock branch console.logs with the '[publish/mock]' prefix.
- T13: App.jsx replaces `signedIn: useState(true)` with viewer-derived state.
- T14: Header.jsx no longer hardcodes "Sarah Chen" — the display name comes from npubShort(viewer).
- T15: ConcernDialog.jsx renders a textarea with maxLength=280 and Cancel + Confirm buttons.
- T16: CommunityDetail.jsx's Join handler calls publishEvent.
- T17: MemberRow / drawer wires the Vouch and Raise-a-concern handlers through publishEvent.

**Skipped (manual):** the live NIP-07 prompt flow + the WebSocket round-trip. Verified post-deploy via staging smoke (sign in → click Vouch → confirm a kind-39999 event hits `wss://communities.brainstorm.world`).

## Out of scope

- **Live publish to the real relay.** Mock mode is the implementation path; real-mode is the same code, exercised at staging.
- **NIP-09 deletes for Leave.** Out.
- **Edit-screen Save publishing.** Out.
- **NIP-46 / bunker signers.** Out.
- **Multi-relay publishing with per-community relay sets.** Out — DEFAULT_RELAYS single-entry for v1.
- **Profile resolution (kind-0 → display name + avatar).** Out — npub-short stands in.
