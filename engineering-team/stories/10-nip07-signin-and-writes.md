# Story 10: NIP-07 sign-in + Join / Vouch / Raise-a-concern writes (Slice 4)

**Status:** Done
**Created:** 2026-05-14
**Type:** Feature

## Background

Slices 0–3 built the surface but every interaction is local React state. The Sign-in button is a no-op; the `signedIn: true` flag is a `useState` literal; Join / Vouch / Raise-a-concern toggle `joinedSet` and `vouchedSet` without ever signing or publishing an event. Slice 4 makes the writes real.

The protocol shapes were locked in Slice 1:

- **Community-record** (PLAN.md §3) — a `kind 39999` ListItem on the user's `brainstorm-communities` DList (`kind 39998`). Tags carry the community metadata; `d` is the slug; `z` points at the DList header.
- **Endorsement signal** (`COMMUNITY_ENDORSEMENTS_DLIST.md` + the brainstorm-community-signal schema from Slice 1) — a `kind 39999` event with `p` (target pubkey), `a` (community a-tag), `type` (endorse / veto), `role` (member / moderator), optional `comments`. The d-tag is deterministic over `(target, community, role)` so "latest stance wins" — the user's most recent vouch or veto for a given (person, role) is the active signal.

Slice 4 ships:

1. **NIP-07 sign-in.** The Header's "Sign in" button triggers `window.nostr.getPublicKey()`; the resolved pubkey is the viewer for the rest of the session. Persisted to `localStorage` so a page reload doesn't sign the user out.
2. **Threaded viewer.** The API client's `getCommunities(viewer)` etc. start receiving a real pubkey instead of `null`. The server-side `viewer` query param works against the API (already supported in Slice 2).
3. **Event-publish wrapper.** A `publishEvent(unsigned)` helper that requests a NIP-07 signature and then either logs (mock mode) or publishes to the configured relay set (real mode).
4. **Join → publish community-record.** When a signed-in user clicks Join, we construct the kind-39999 community-record event from the community detail, request the signature via NIP-07, and publish. Local `joinedSet` updates optimistically.
5. **Vouch → publish endorsement.** When a signed-in member clicks Vouch on another member, we construct the kind-39999 signal event with `p = target`, `a = community a-tag`, `type = "endorse"`, `role = "member"`, request the signature, and publish. Local `vouchedSet` updates optimistically.
6. **Raise a concern → publish veto.** Same event shape as Vouch but `type = "veto"`. A confirmation dialog surfaces an optional `comments` textarea before publishing.

Live publish against the real `wss://communities.brainstorm.world` relay is deferred to staging smoke (matches the pattern from #4 / #5 / #7 / #8). In dev, `publishEvent` mocks the relay call: it still triggers NIP-07 (so signing is exercised end-to-end) but the signed event goes to `console.log` instead of a WebSocket.

## User-facing description

**As a visitor with a NIP-07 extension** (e.g. Alby, nos2x), I want to click Sign in, approve the public-key request, and have my pubkey power the rest of the session — Discover starts surfacing communities personalized to my trust network, Join/Vouch/Concern require my signature, my Header shows my npub-short instead of "Sarah." **So that** I don't have to create yet another account, and the protocol's identity model lands on the surface where it belongs.

**As a circle member**, I want my Vouch and Raise-a-concern clicks to actually publish signed events so that other members running mirror relays compute me as part of the community's roster. **So that** the algorithmic-convergence property PLAN.md §2 promises ("multiple operators running mirror relays from different seed users derive nearly identical membership whitelists") starts to be real.

**As a developer**, I want every signing flow to work end-to-end on localhost even without a Docker stack — the NIP-07 extension lives in the browser, signs the event, and the publish step logs to console so I can iterate visually. **So that** the Slice 4 flow is verifiable in the same dev loop the earlier slices established.

## Acceptance criteria

### Sign-in flow

- [ ] The Header's "Sign in" button (visible when no viewer is signed in) opens a NIP-07 handshake via `window.nostr.getPublicKey()`. On approval, the resolved 64-char-hex pubkey becomes the active viewer. On reject / no-extension / `window.nostr` undefined, a friendly inline error surfaces ("Brainstorm Communities needs a nostr browser extension to sign in. Try Alby or nos2x.") and the button stays in the un-signed state.
- [ ] On initial page load, if `localStorage.brainstormCommunitiesViewerPubkey` exists, the viewer is restored — the Header renders the signed-in state without prompting the extension again. (The extension is consulted again only for the next signing operation.)
- [ ] The Header's user-menu dropdown shows the viewer's npub (in `npub1...` short form, e.g. `npub1n0e...l9rk23`) instead of the hardcoded "Sarah Chen." A "Copy npub" affordance puts the full npub on the clipboard.
- [ ] "Sign out" clears `localStorage.brainstormCommunitiesViewerPubkey` and returns the viewer to `null`. The page re-renders with the un-signed Header + the read-only versions of pages.
- [ ] The viewer pubkey threads through the API client: `getCommunities(viewer)` / `getCommunity(slug, viewer)` / `getCommunityMembers(slug, viewer)` all receive the active pubkey when the user is signed in, or `null` when they're not. The fetched results re-fetch on sign-in / sign-out so the API can re-personalize.

### Event construction

- [ ] A new module (path TBD by Architect) builds **community-record events** matching PLAN.md §3 / the firmware schema (Slice 1). Required tags: `d` (slug), `z` (DList header pointer `39998:<viewer>:brainstorm-communities`), `t` (slug), `name`, `description`, `relay` (multi), `seed` (multi), `weighting_model`, `endorsement_threshold`. Optional tags surfaced when present: `image`, `topic` (multi), `language`, `founder`, `a` (NIP-72 wrapping). `content` is empty per PLAN.md §3.
- [ ] The same module builds **endorsement / veto signal events** matching `COMMUNITY_ENDORSEMENTS_DLIST.md`. Required tags: `p` (target pubkey), `a` (community a-tag), `z` (endorsements DList header pointer). Optional: `type` (default `endorse`), `role` (default `member`), `comments`. **The `d` tag is deterministic** over `(target, community, role)` so successive signals from the same author for the same (person, role) replace earlier ones.
- [ ] Event timestamps use `Math.floor(Date.now() / 1000)`. `pubkey` defaults to the viewer; the NIP-07 signer fills in the final pubkey + signature.
- [ ] The event-construction helpers are **pure functions** — given the same inputs they produce equal output (up to `created_at`). Testable in isolation via the existing Node-runner pattern.

### Publish wrapper

- [ ] A `publishEvent(unsigned)` helper requests a NIP-07 signature, then either logs the signed event (dev / mock mode) or publishes it to each relay in the configured set (real mode). Returns a Promise that resolves to `{ ok: true, eventId, relaysAccepted }` on success or `{ ok: false, error }` on failure.
- [ ] Mock-mode publish: the signed event goes to `console.log` with a clear `[publish/mock]` prefix. The Promise resolves to `{ ok: true, eventId, relaysAccepted: [] }`. No network call. The same `VITE_USE_MOCK_DATA` env flag from Slice 3 gates this — mock data and mock publish are paired modes.
- [ ] Real-mode publish: opens a WebSocket to `wss://communities.brainstorm.world` (the v1 default — overridable per-community via the community-record's `relay` tag once communities exist), sends `["EVENT", signedEvent]`, awaits the relay's `["OK", id, accepted, message]` response with a 10s timeout. Resolves with `relaysAccepted` listing the relays that returned `accepted=true`.
- [ ] Failure modes — extension absent, user rejects signing, WebSocket connection refused, relay's `OK` says `false`, timeout — each resolve `{ ok: false }` with a distinct `error` code/message so the UI can show the right inline error.

### Join / Vouch / Raise-a-concern

- [ ] Click Join on a community detail → NIP-07 prompt fires → on signature, the community-record event is published. Local `joinedSet` updates optimistically when the publish resolves `ok`. On `ok: false`, the optimistic state reverts and a toast / inline error surfaces with the failure reason.
- [ ] Click Vouch on a member row → NIP-07 prompt fires → on signature, the endorsement signal publishes. Local `vouchedSet` updates optimistically. The button label flips to "Vouched" with the success styling.
- [ ] Click Vouch again on the same member (in the same session) → publishes a *second* signed event with the same deterministic d-tag (replaces the first — that's nostr-NIP-09-replaceable-event semantics). Local state mirrors this: clicking "Vouched" again sends a fresh signature; the visual state doesn't toggle off.

  **Toggling off a vouch is a separate action.** PLAN.md §3 commits to "latest stance wins" semantics — to retract a vouch, the user re-publishes the same signal with a `type` flip. v1 doesn't surface a retract affordance from the Vouched button; instead, "Raise a concern" is how members express the opposite stance. The two are not the same toggle.

- [ ] Click Raise-a-concern on a member → confirmation dialog opens with an optional comments textarea (max 280 chars, matches kind-1 length). Submit → NIP-07 prompt fires → veto signal publishes with the comments. Cancel → no signature requested, no event sent.
- [ ] The kind-39999 signal d-tag is computed deterministically as `${role}:${target}:${communityATag}` (or similar tuple — Architect picks the exact serialization). Different `role` produces a different d-tag → a moderator endorsement and a member endorsement for the same target are additive, not replaceable.
- [ ] All three actions are guarded by `viewer !== null`. Un-signed users see the buttons in their un-actionable state (per Slice 0): Join is disabled / hidden, Vouch + Raise-a-concern don't render on member rows.

### Header chrome

- [ ] Signed-in Header shows: the brand mark, the nav, the cross-product link, the user-menu trigger with a real-avatar-shaped circle (initials derived from npub for now — name resolution is Slice 4-adjacent NB-1 from Slice 2), and the truncated npub. Dropdown items: "Your Circles," "Start a Circle," "Copy npub," "Sign out."
- [ ] Un-signed Header shows: brand mark, nav (Discover only — "Your Circles" and "Start a Circle" hide when there's no viewer), cross-product link, and the "Sign in" button.

### Edit-screen "Save your view"

- [ ] The Save button on `/edit/:slug` does NOT publish in Slice 4. It updates local state and returns to `/community/:slug` — same behavior as Slice 0–3. The publish path for community-record updates is identical to the Join path but is a separate AC because the Edit screen is for already-joined communities and the use case ("change my view of this community") differs from joining for the first time. **Implementer note: out of scope for Slice 4; a future story wires Edit-publish once the round-trip from real published events back into Discover via NB-4 is verified.**

### Mock-mode parity

- [ ] When `VITE_USE_MOCK_DATA=true` (dev default), every Slice 4 interaction works end-to-end EXCEPT the actual network publish: NIP-07 still prompts, events still sign, and the signed event goes to console. Local state still updates. Sign-in flow still works against `window.nostr` if the extension is installed; without one, the inline error surfaces.
- [ ] When `VITE_USE_MOCK_DATA=false` (prod build), events publish to the real relay set. Sign-in failure modes render the same error UI as dev.

### Regression

- [ ] All 115 pre-existing tests pass. Slice 4 adds a new suite; no existing tests should flip.
- [ ] `cd ui-communities && npm run build` succeeds. ESLint clean.
- [ ] The Slice 3 mock-mode visual review path still works: `cd ui-communities && npm run dev` → all 8 mock communities render on Discover.

## Concepts touched

- `brainstorm-community` (kind 39998 concept-header in Neo4j after Slice 1) — referenced by `weighting_model` in published community-records.
- `brainstorm-community-signal` (kind 39998 concept-header) — referenced by the published endorsement / veto events.

Per AGENTS.md §1, the local TA pubkey resolves dynamically at runtime; no hardcoded values in the client. **The `weightingModel` reference in community-record events is the slug `gr-community-default-v1`, not a TA-anchored handle** — that's a string identifier shared across operators per the PLAN.md §4 algorithm contract.

## Out of scope

- **Live publish to the real `wss://communities.brainstorm.world` relay.** Deferred to staging smoke. The publish wrapper is implemented; verification that a deployed instance round-trips signed events through strfry and back into `GET /api/communities` is post-deploy work, paired with NB-4 from Slice 2.
- **Real backend data sources wiring.** Still stubbed. Until NB-4 lands, the published events go to a relay but don't surface back through the API. Slice 4 ships the *send* path; the *round-trip* verification is the staging story.
- **Edit-screen publishing.** Local-state-only per the AC above. Future story wires `/edit/:slug` Save into a community-record republish.
- **NIP-09 / replaceable-event delete semantics for Leave.** v1 Leave is local-state-only. To remove a community from the user's DList in a way other clients can observe, the user re-publishes their kind-39998 brainstorm-communities header without the now-departed community's reference. Out of scope.
- **kind-1 read / Conversation tab.** Slice 6.
- **Founder / Create flow publishing.** Slice 5 lands the create wizard publish path. Slice 4 only handles Join (which publishes a copy of an *existing* community-record into the user's DList), not Found.
- **Profile resolution for the viewer's display name.** Slice 4 shows the truncated npub. Resolving the viewer's kind-0 profile event to a name + avatar is a follow-up (paired with the same name-resolution work for vouchers per Slice 2 NB-1).
- **Multi-relay publishing.** v1 publishes only to the default relay set (single entry `wss://communities.brainstorm.world` for v1). Per-community relay sets read from the community-record's `relay` tags are a Slice-5-adjacent enhancement.
- **Optimistic-with-rollback for transient publish failures.** v1 reverts the optimistic state on failure but does not retry. A retry-with-backoff is post-v1.
- **Rate limiting on the publish side.** No client-side throttle; the relay's own policies handle abuse. Belt-and-suspenders rate-limiting is post-v1.
- **NIP-46 / remote signer support.** v1 supports `window.nostr` (NIP-07) only. NIP-46 (bunker / remote signer) is a separate ADR.

## Open questions

Resolved at intake:

- **Mock-publish behavior in dev:** log signed event, no network call. Paired with `VITE_USE_MOCK_DATA`.
- **Default relay URL:** `wss://communities.brainstorm.world`.
- **Raise-a-concern UX:** one-click with optional comments textarea (max 280 chars).

Resolved during PO drafting:

- **localStorage key name:** `brainstormCommunitiesViewerPubkey` (verbose but unambiguous — the surface evolves to more keys post-v1).
- **npub display format:** `npub1<first6>...<last6>` (12 visible chars + ellipsis). Matches the existing brainstorm.world UI's npub-shortening style if there is one.
- **Signature retry:** none for v1. If a user rejects the NIP-07 prompt, no auto-retry; the action just stays in its un-actioned state.
- **Toast vs. inline error:** inline error on the same surface that triggered the action. Toast infrastructure is heavier than v1 needs.

## Linked artifacts

- ADR: [`engineering-team/decisions/0008-nip07-signin-and-writes.md`](../decisions/0008-nip07-signin-and-writes.md)
- Test plan: [`engineering-team/stories/10-nip07-signin-and-writes.test-plan.md`](10-nip07-signin-and-writes.test-plan.md)
- Review: [`engineering-team/reviews/10-nip07-signin-and-writes.md`](../reviews/10-nip07-signin-and-writes.md) (PASS, 6 non-blocking notes)
