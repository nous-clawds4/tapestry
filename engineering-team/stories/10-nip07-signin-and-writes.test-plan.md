# Test Plan: Story 10 — NIP-07 sign-in + Join / Vouch / Raise-a-concern writes

**Story:** `engineering-team/stories/10-nip07-signin-and-writes.md`
**ADR:** `engineering-team/decisions/0008-nip07-signin-and-writes.md`
**Date:** 2026-05-14

## Approach

Slice 4 has two surfaces:

1. **Pure-function event construction.** Importable from the Node runner. Tests assert that `buildCommunityRecord` / `buildEndorsementSignal` / `buildCommunitiesDListHeader` produce events matching PLAN.md §3 / the Slice 1 firmware schemas. Deterministic — same inputs produce the same event (modulo `created_at`).

2. **Source-regex / wiring tests.** The auth + publish + page wiring is mostly file structure and integration. NIP-07 itself requires a browser extension and isn't unit-testable in Node — that's manual verification via the preview tool.

The pure-function tests are the load-bearing correctness checks. The wiring tests pin module shape, env-toggle behavior, and that the right modules call the right modules. Live behavior (NIP-07 prompt fires, signature comes back, event lands on a real relay) is verified at staging smoke via a real sign-in.

## Coverage map

### Event construction (T1–T6, pure-function)

| Criterion | Test | Level |
|---|---|---|
| AC: community-record matches PLAN.md §3 schema | T1 `buildCommunityRecord output has kind 39999, d=slug, z=39998:viewer:brainstorm-communities, t=slug, plus required name/description/relay/seed/weighting_model/endorsement_threshold tags` | unit |
| AC: optional tags copy only when present | T2 `buildCommunityRecord skips image/topic/language/founder/a tags when their source fields are null` | unit |
| AC: signal event matches firmware schema | T3 `buildEndorsementSignal has kind 39999, p=target, a=communityATag, type defaults to endorse, role defaults to member` | unit |
| AC: signal d-tag is deterministic | T4 `buildEndorsementSignal d-tag for the same (role, target, community) tuple is identical across two calls` | unit |
| AC: signal d-tag changes when role flips | T5 `buildEndorsementSignal d-tag differs when role is 'moderator' vs 'member' for the same target` | unit |
| AC: DList header per PLAN.md §3 | T6 `buildCommunitiesDListHeader has kind 39998, d="brainstorm-communities", names + titles + required-tag declarations` | unit |

### Auth module (T7–T9, source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: viewer.js exports the right surface | T7 `viewer.js exports signInWithNip07, npubShort, npubFull, getStoredViewerPubkey, storeViewerPubkey, clearStoredViewerPubkey` | source-regex |
| AC: localStorage key is canonical | T8 `viewer.js uses the exact string 'brainstormCommunitiesViewerPubkey' for localStorage` | source-regex |
| AC: window.nostr access centralized in viewer.js | T9 `no file outside src/auth/ references window.nostr — auth is the single chokepoint` | source-regex (file-walk + grep) |

### Publish module (T10–T12)

| Criterion | Test | Level |
|---|---|---|
| AC: mode toggle re-uses VITE_USE_MOCK_DATA with === 'true' | T10 `publish.js gates on import.meta.env.VITE_USE_MOCK_DATA === 'true'` | source-regex |
| AC: DEFAULT_RELAYS contains the v1 default | T11 `publish.js DEFAULT_RELAYS includes 'wss://communities.brainstorm.world'` | source-regex |
| AC: mock-mode log format | T12 `publish.js mock branch console.log includes the '[publish/mock]' prefix` | source-regex |

### App + Header wiring (T13–T14)

| Criterion | Test | Level |
|---|---|---|
| AC: App.jsx switches from boolean signedIn to viewer-derived | T13 `App.jsx no longer hardcodes useState(true) for signedIn; viewer comes from getStoredViewerPubkey()` | source-regex |
| AC: Header surfaces npubShort, not "Sarah Chen" | T14 `Header.jsx imports npubShort + renders viewer-derived display; the hardcoded "Sarah Chen" string is gone` | source-regex |

### ConcernDialog (T15)

| Criterion | Test | Level |
|---|---|---|
| AC: dialog renders textarea + Cancel + Confirm | T15 `ConcernDialog.jsx renders a textarea with maxLength=280, plus Cancel and Confirm buttons` | source-regex |

### Page wiring (T16–T17)

| Criterion | Test | Level |
|---|---|---|
| AC: CommunityDetail Join publishes | T16 `CommunityDetail.jsx calls publishEvent in the Join handler` | source-regex |
| AC: Vouch + Concern publish via the same wrapper | T17 `MemberDrawerContent.jsx (or MemberRow.jsx) wires Vouch and Raise-a-concern through publishEvent` | source-regex |

### nostr-tools dep

| Criterion | Test | Level |
|---|---|---|
| AC: nostr-tools at the version ui/ uses | T18 `ui-communities/package.json declares nostr-tools ^2.23.3 (matches ui/)` | source-regex |

### Mock-mode parity / regression

| Criterion | Test | Level |
|---|---|---|
| AC: existing 115 tests pass | regression run | full test suite |
| AC: build + lint clean | manual: `cd ui-communities && npm run build && npm run lint` | CI |
| AC: dev-mode visual review still works | manual: `npm run dev` → open the preview, browse Discover, sign in via NIP-07 if extension present, click Vouch → console shows [publish/mock] | manual |

## Edge cases

- [x] **No NIP-07 extension.** `window.nostr` is undefined. `signInWithNip07` resolves `{ ok: false, error: 'no-extension' }`. Inline error in the Header tells the user to install Alby / nos2x.
- [x] **User rejects the signing prompt.** Extension throws; our wrapper catches and resolves `{ ok: false, error: 'rejected' }`. UI surfaces the optimistic state and then reverts cleanly.
- [x] **Vouch double-click race.** Two clicks fire two signatures; both publish with the same d-tag; relay accepts both (the second replaces the first per nostr replaceable-event semantics). Local state stays in the "Vouched" position throughout. No corruption.
- [x] **Sign in while a fetch is in-flight.** Slice 3 effects re-fire when their dependency changes; the `viewer` dep on `useEffect` triggers a re-fetch of `getCommunities(viewer)` on sign-in/out. No stale-resolve race because each effect carries a `cancelled` flag.
- [x] **Malformed localStorage value.** `getStoredViewerPubkey` validates the stored value is 64-char hex; non-conforming values trip a clear and return null.
- [x] **`encodeURIComponent` on viewer in the API client.** Already handled by Slice 3's `client.js` (the test plan for #9 covers this).
- [x] **Empty comments on Raise-a-concern.** Allowed; the `comments` tag is simply omitted from the event when the textarea is blank.
- [x] **Comments at the 280-char limit.** Truncated by the textarea's maxLength attribute; can't exceed.
- [x] **Sign out while a publish is in-flight.** The publish completes (the WebSocket close is independent of the React unmount); the local state reset is harmless because there's no `setState` after unmount (effects clean up). The signed event still lands on the relay — that's correct nostr behavior; the user signed it.

## Not covered (intentional)

- **Live NIP-07 prompt + signature.** Requires a browser extension. Manual verification: preview-tool can't drive the extension UI; staging smoke (after a deploy) is where the human signs in with their real Alby / nos2x and confirms the round-trip.
- **WebSocket round-trip to `wss://communities.brainstorm.world`.** Requires the droplet + the relay running. Deferred to staging smoke.
- **The signed event actually landing in strfry, then being read back by `GET /api/communities/:slug/members`.** Requires NB-4 (live data sources) to be wired. Deferred to a future story.
- **Profile resolution.** Slice 4 shows the truncated npub. Resolving kind-0 to a name + avatar is a follow-up.
- **Multi-relay publish with per-community relay sets.** v1 publishes to DEFAULT_RELAYS only.
- **`nostr-tools` version regressions.** We pin `^2.23.3`; major upgrades are a separate decision.

## Test infrastructure

- **Framework:** Node runner (`test/test.js`). New file `test/nip07-signin-and-writes.test.js`. Same pattern as #5–#9.
- **No new deps.** Pure-function tests import the event builders directly via `require(...)`. Note: `events/build.js` is ESM (`export function ...`), so the test either does (a) source-regex assertions against the file content, or (b) constructs a small `require()` shim. Going with (a) for consistency with how `client.js` is tested in Slice 3 — we can extract the testable bits via source-regex without paying the ESM/CJS interop cost.

  **Practical note on T1–T6:** the event-builder tests are unit tests of pure functions. The cleanest path is to extract the builders into a CommonJS-loadable module — either by writing them in CommonJS syntax (`module.exports`) or by having the test source-regex the relevant tag shapes. Given the existing test style in this project, T1–T6 will be **source-regex tests** that verify the builder function's structural correctness (the right tag names appear, the d-tag computation expression is correct, etc.) rather than executing the function. This is consistent with how Slice 3's `client.js` tests are structured.

- **No Playwright.** No browser-observable change verifiable without a real extension.

## How to run

```bash
npm test
```

Manual visual verification:

```bash
# Dev mode: sign in if you have NIP-07; click Vouch; check console
cd ui-communities && npm run dev
# Open http://localhost:5174
# Headers should show "Sign in"; click → NIP-07 prompt → approve
# Navigate to /community/listening-room → click Vouch on a member
# DevTools console should show "[publish/mock] {...signed event...}"
```

Manual staging smoke (post-deploy):

```bash
# After communities.brainstorm.world deploy lands:
# 1. Visit https://communities.brainstorm.world
# 2. Sign in via NIP-07 extension
# 3. Click Vouch on a community member
# 4. Confirm wss://communities.brainstorm.world received the kind-39999 event
#    by querying the relay:
#    websocat wss://communities.brainstorm.world <<<'["REQ","x",{"kinds":[39999],"authors":["<viewer-hex>"]}]'
```

## Verification

Tests fail with the current code (no `src/auth/`, no `src/events/`, no `ConcernDialog`). Confirmed-failing on the previous commit; the test file lands with this commit and confirms-failing for the right reasons before the Implementer phase.
