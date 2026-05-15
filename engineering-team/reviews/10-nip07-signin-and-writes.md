# Review: Story 10 — NIP-07 sign-in + Join / Vouch / Raise-a-concern writes

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** five commits in the slice:

- `c28b2f79` story: nip07-signin-and-writes (#10)
- `4dbe912f` adr: 0008 — NIP-07 sign-in + event construction + publish wrapper
- `ca2c1e78` test-plan: nip07-signin-and-writes (#10) — failing tests
- `304b013a` impl: nip07 sign-in + join / vouch / raise-a-concern writes (#10)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Nine suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - firmware-v1.1.0-finalization: 14/14 PASS
  - gr-community-scoring-and-api: 25/25 PASS
  - discover-swaps-mock-data-for-api: 22/22 PASS
  - **nip07-signin-and-writes: 17/17 PASS** (new in this slice)
  - **Overall: 132/132.** No regressions.
- [x] **`cd ui-communities && npm run lint` — PASS** with one new per-line disable in ConcernDialog (`react-hooks/set-state-in-effect` on the open→close transition, commented in source).
- [x] **`cd ui-communities && npm run build` — PASS.** Vite 7.3.3, 117 modules, ~620 ms. Bundle: 445.28 kB JS (146.32 kB gzip), 50.23 kB CSS (9.22 kB gzip). ~110 kB raw / ~40 kB gzip growth from Slice 3 — nostr-tools accounts for the delta.
- [x] **Browser preview at 1280×900** — Header now renders the **un-signed state** (only "Discover" in the nav, "Sign in" button, no "Sarah" placeholder). Visually identical otherwise to Slice 3 — the rest of the surface is unchanged for unauthenticated viewers.
- [ ] **`npm run test:playwright`** — N/A. The NIP-07 prompt requires a real browser extension; not driveable from headless Playwright without an extension fixture. Live signing verification is staging smoke.
- [x] _Typecheck not configured._

## Spec adherence (vs. story #10 acceptance criteria)

### Sign-in flow

- [x] **AC: Sign-in opens NIP-07 handshake; resolves the viewer hex-pubkey.** [Header.jsx:24-32](ui-communities/src/components/Header.jsx#L24) wires `handleSignInClick` → `props.onSignIn()` → `App.handleSignIn` → `signInWithNip07()`. [viewer.js:52-69](ui-communities/src/auth/viewer.js#L52) calls `window.nostr.getPublicKey()` and validates the result.
- [x] **AC: localStorage persistence + restoration.** [App.jsx:31](ui-communities/src/App.jsx#L31) initializes `viewer` from `getStoredViewerPubkey()` once. `signInWithNip07` resolve → `storeViewerPubkey + setViewer`. Sign-out → `clearStoredViewerPubkey + setViewer(null)`. [viewer.js:18-43](ui-communities/src/auth/viewer.js#L18) handles the localStorage I/O with hex-shape validation + clear-on-malformed.
- [x] **AC: Friendly error inline.** [Header.jsx:158-173](ui-communities/src/components/Header.jsx#L158) `errorCopyFor` maps error codes to brand-appropriate copy: `no-extension` → "needs a nostr browser extension... Try Alby or nos2x.", `rejected` → "Sign-in cancelled.", default → "Sign-in failed. Try again?". Rendered inline below the Sign-in button.
- [x] **AC: User-menu dropdown shows truncated npub + Copy npub.** [Header.jsx:88-138](ui-communities/src/components/Header.jsx#L88). Hover the chip → full npub tooltip. Dropdown header shows "Signed in as npub1n0e...l9rk23" (formatted by `npubShort`). "Copy npub" writes `npubFull(viewer)` to the clipboard with a 1.6s "Copied!" flash.
- [x] **AC: Sign out clears localStorage + viewer.** [App.jsx:80-83](ui-communities/src/App.jsx#L80). Verified by `clearStoredViewerPubkey` invocation.
- [x] **AC: Viewer threads through API client.** All three fetching pages (Discover, CommunityDetail, Edit) now pass `viewer` to their `get*` calls + include `viewer` in the `useEffect` deps so a sign-in/sign-out re-fires the fetch. [Discover.jsx:25-46](ui-communities/src/pages/Discover.jsx#L25), [CommunityDetail.jsx:36-58](ui-communities/src/pages/CommunityDetail.jsx#L36), [Edit.jsx:18-44](ui-communities/src/pages/Edit.jsx#L18).

### Event construction

- [x] **AC: community-record per PLAN.md §3.** [build.js:64-119](ui-communities/src/events/build.js#L64) `buildCommunityRecord`. Required tags present (d, z, t, name, description, relay, seed, weighting_model, endorsement_threshold). Optional tags conditional on source fields. Content empty. Kind 39999. T1 + T2 verify.
- [x] **AC: endorsement signal per `COMMUNITY_ENDORSEMENTS_DLIST.md`.** [build.js:128-160](ui-communities/src/events/build.js#L128) `buildEndorsementSignal`. Required: p, a. Optional with defaults: type=endorse, role=member. comments stripped + trimmed. D-tag `${role}|${target}|${communityATag}` is deterministic (T3 + T4 verify) and role-sensitive (T5 verifies). Kind 39999. Content empty.
- [x] **AC: DList header.** [build.js:34-58](ui-communities/src/events/build.js#L34). Kind 39998, d="brainstorm-communities", names + titles + required tag declarations. T6 verifies.
- [x] **AC: `created_at` uses Math.floor(Date.now()/1000).** [build.js:21-23](ui-communities/src/events/build.js#L21).
- [x] **AC: pure functions.** No I/O imports in build.js — `grep` confirms. Same input → same output (modulo `created_at`).

### Publish wrapper

- [x] **AC: `publishEvent` resolves typed PublishResult.** [publish.js:36-87](ui-communities/src/events/publish.js#L36). Signature, then mock-or-real branch, then result.
- [x] **AC: strict `=== 'true'` env comparison.** [publish.js:16](ui-communities/src/events/publish.js#L16). T10 verifies. Matches Slice 3 client.js pattern.
- [x] **AC: Mock-mode logs with `[publish/mock]` prefix.** [publish.js:51](ui-communities/src/events/publish.js#L51). T12 verifies. No network call.
- [x] **AC: Real-mode publishes to DEFAULT_RELAYS via Relay.connect + per-relay timeout.** [publish.js:64-101](ui-communities/src/events/publish.js#L64). 10s timeout default; relays.allSettled + per-relay OK collection.
- [x] **AC: Typed error codes for each failure mode.** All five from the ADR present: `no-extension`, `rejected`, `network`, `rejected-by-relay`, `timeout`. Verified by `grep` across the publish handlers.

### Join / Vouch / Raise-a-concern

- [x] **AC: Join publishes + optimistic update + rollback.** [CommunityDetail.jsx:70-92](ui-communities/src/pages/CommunityDetail.jsx#L70) `handleJoinClick`. Optimistic `onJoin`; on `result.ok === false`, rollback via `onLeave` + set `publishError`. T16 verifies.
- [x] **AC: Vouch publishes endorsement signal + optimistic flip + rollback.** [MemberDrawerContent.jsx:40-62](ui-communities/src/pages/MemberDrawerContent.jsx#L40) `handleVouch`. T17 verifies.
- [x] **AC: Raise-a-concern → dialog → publish veto with optional comments.** [MemberDrawerContent.jsx:64-83](ui-communities/src/pages/MemberDrawerContent.jsx#L64) `handleConcernConfirm`. [ConcernDialog.jsx](ui-communities/src/components/ConcernDialog.jsx) opens with textarea (maxLength 280), Cancel/Confirm, ESC closes when not busy. T15 verifies the dialog shape.
- [x] **AC: D-tag deterministic over (role, target, community).** [build.js:148-150](ui-communities/src/events/build.js#L148) `const dTag = \`${role}|${targetPubkey}|${communityATag}\``. Pipe separator chosen to avoid collision with the colons inside the community a-tag (`39999:<curator>:<slug>`). Documented inline.
- [x] **AC: Buttons gated by viewer.** Vouch / Raise-a-concern only render when `signedIn` ([MemberDrawerContent.jsx:118](ui-communities/src/pages/MemberDrawerContent.jsx#L118)). Join button only renders when `signedIn` ([CommunityDetail.jsx:117-159](ui-communities/src/pages/CommunityDetail.jsx#L117)).

### Header chrome

- [x] **AC: Signed-in chrome shows mark, nav, cross-link, user-menu with npub.** Verified by source + spec.
- [x] **AC: Un-signed chrome shows mark, Discover-only nav, cross-link, Sign-in.** Verified visually via preview screenshot.

### Edit-screen "Save your view"

- [x] **AC: Edit Save does NOT publish in Slice 4.** [Edit.jsx](ui-communities/src/pages/Edit.jsx) — no `publishEvent` import, no event-builder import. Save handler still navigates back without writing. **Correct per the AC.**

### Mock-mode parity

- [x] **AC: VITE_USE_MOCK_DATA=true → NIP-07 prompts but no network publish.** Verified by code path inspection — `publish.js:48` `if (USE_MOCK)` short-circuits before the relay-connect block.
- [x] **AC: VITE_USE_MOCK_DATA=false → real publish to DEFAULT_RELAYS.** Code path confirmed; live verification deferred to staging smoke.

### Regression

- [x] **AC: All 115 pre-existing tests pass.** Confirmed in the quality-gate run.
- [x] **AC: Build + lint clean.** Confirmed.
- [x] **AC: Slice 3 dev-mode visual review still works.** Browser preview confirms.

No criterion is silently dropped.

## ADR adherence (vs. ADR-0008)

- [x] **Option A — nostr-tools + auth/viewer + events/build + events/publish + ConcernDialog.** Implemented exactly.
- [x] **File layout** matches ADR §"Files & layout".
- [x] **nostr-tools at ^2.23.3** matches `ui/`. T18 verifies.
- [x] **localStorage key `brainstormCommunitiesViewerPubkey`.** T8 verifies.
- [x] **Mode toggle re-uses Slice 3's `VITE_USE_MOCK_DATA`.** Confirmed.
- [x] **`DEFAULT_RELAYS = ['wss://communities.brainstorm.world']`.** T11 verifies.
- [x] **`signEventViaNip07` helper added so publish.js doesn't touch `window.nostr` directly.** [viewer.js:79-98](ui-communities/src/auth/viewer.js#L79). This is a **mild improvement over the ADR's sketch** — the ADR had publish.js call `window.nostr.signEvent` directly; T9 caught that and we routed it through a new viewer-module helper. The chokepoint property is now mechanically enforced by the test rather than by code-review discipline.
- [x] **Optimistic state with rollback.** Implemented per ADR §"Page wiring" exactly. No retry; failure reverts + surfaces inline error.
- [x] **No new dependencies beyond nostr-tools.** Confirmed.

**One mild deviation from the ADR (improvement, not regression):** the ADR's `signEvent` access pattern was open-ended ("publish.js calls window.nostr.signEvent"). The implementation centralizes via `signEventViaNip07` so `window.nostr` is referenced in exactly one file (`auth/viewer.js`). This is a cleaner architecture than the ADR specified; the change went through the test phase (T9 caught the deviation and the implementer corrected it).

## Concept-graph integrity

- [x] **No firmware reinstall required.** Slice 4 doesn't change concept definitions. Slice 1's v1.1.0 already activated the schemas this slice produces events against.
- [x] **Event tag sets match the schemas.** community-record JSON Schema lists `slug, name, description, image, topics, language, founder, relays, seedMembers, weightingModel, endorsementThreshold, nip72Wrapping`. The DList-layer tag names mapped per PLAN.md §3: `d, name, description, image, topic (multi), language, founder, relay (multi), seed (multi), weighting_model, endorsement_threshold, a (NIP-72 wrapping)`. [build.js:73-118](ui-communities/src/events/build.js#L73) emits exactly these.
- [x] **`weightingModel` default is the registered slug.** [build.js:104](ui-communities/src/events/build.js#L104) defaults to `gr-community-default-v1` — matches Slice 2's `WEIGHTING_MODEL_ID`.

## Things tests can't catch

- [x] **No secrets in committed files.** No pubkeys, no test signatures, no API tokens.
- [x] **No leftover debug logging.** Two `console.error` calls in the publish-failure paths (pages catch + log the raw error). One `console.log` in the mock-publish path — intentional, prefixed with `[publish/mock]`.
- [x] **No commented-out code.**
- [x] **Error paths handled.**
  - NIP-07 absent: typed `no-extension` error; UI surfaces "needs a nostr browser extension."
  - NIP-07 rejection: typed `rejected`; UI shows "Sign-in cancelled." or (for publishes) "Signing cancelled."
  - Network failure: typed `network`; UI shows "We could not reach the relay."
  - Relay rejection: typed `rejected-by-relay`; UI shows "The relay rejected this event."
  - Timeout: typed `timeout`; UI shows "The relay took too long to confirm."
  - Malformed localStorage value: cleared silently on `getStoredViewerPubkey` read.
  - Browser without `navigator.clipboard`: copy silently fails (doesn't crash).
- [x] **Concurrency.** Each publish action has a `vouchBusy` / `publishing` / `concernBusy` guard so double-clicks don't double-publish. The optimistic state is updated synchronously before the await, so a double-click while busy is a no-op (button disabled).
- [x] **Security.** Events are signed by the NIP-07 extension, which owns the private key — the client never sees it. No `dangerouslySetInnerHTML`. Comments textarea passes through React's escape pipeline. The slug + comments fields are user input but they go into kind-39999 tag values, not into HTML/SQL/Cypher injection contexts.
- [x] **No race on cancellation.** All three fetching pages still carry `let cancelled = false` + cleanup; the new `viewer` dep on the effect re-fires correctly on sign-in/out without stale-state risk.

## House rules check

- [x] **Concept Graph API authority respected** — the client doesn't bypass the REST/event layer.
- [x] **No new lint/typecheck/build tooling** — only nostr-tools at the runtime dep level.
- [x] **Firmware reinstall not required.** Confirmed.

## Story #10 scope items verified untouched

- [x] **Edit-screen publishing** — not added. Edit.jsx Save handler still navigates without writing.
- [x] **NIP-09 / DList delete for Leave** — local-state-only Leave per the AC.
- [x] **kind-1 reads/writes (Slice 6)** — none.
- [x] **Founder/Create publishing (Slice 5)** — Create page still uses local state only.
- [x] **Profile resolution** — npub-short stands in everywhere a viewer name would go.
- [x] **Multi-relay publish with per-community relay sets** — DEFAULT_RELAYS single-entry.
- [x] **NIP-46 remote signer** — not added.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — Live NIP-07 round-trip verification deferred.** The mock-mode log path is verified by source + preview tool; the real-mode WebSocket publish to `wss://communities.brainstorm.world` has never been exercised. **Action items for staging smoke:**
   - Visit the deployed URL with Alby / nos2x installed.
   - Click Sign in → confirm extension prompt fires → confirm chip displays npub-short.
   - Click Vouch on a member → confirm `[publish/mock]` does NOT appear in console (would mean prod build accidentally has mock mode on); the signed event should fly over WebSocket to the relay.
   - `websocat wss://communities.brainstorm.world <<<'["REQ","x",{"kinds":[39999],"authors":["<viewer>"]}]'` should return the signed event.
   - If no events appear: check Slice 3 NB-1 first (production bundle accidentally tree-shook nothing), then check Slice 0 NB-3 (auth middleware accidentally gating the publish path — though Slice 4 doesn't add server routes, so this is unlikely).

2. **NB-2 — Vouch toggle-off not implemented.** PLAN.md §3 commits to "latest stance wins" semantics. The story ACs explicitly noted that clicking "Vouched" again should send a *fresh* signature (republish the same event), not toggle off — and that retracting a vouch is achieved by Raise-a-concern (the opposite stance). **The implementation matches the AC** but it's worth flagging for UX testing: users will likely try clicking "Vouched" to retract, and the action will re-fire the NIP-07 prompt without visible state change. This isn't a bug, but a future UX story could add an explicit "retract vouch" affordance.

3. **NB-3 — Community a-tag construction is best-effort.** [MemberDrawerContent.jsx:48](ui-communities/src/pages/MemberDrawerContent.jsx#L48) builds the community a-tag as `\`39999:${c.founder || viewer || ''}:${c.slug}\``. The "real" community a-tag is determined by *who first curated this community-record* (per PLAN.md §3 — the d-tag is scoped per pubkey). For mock-mode this is fine because everything is fake; for real-mode the API should return the canonical a-tag in the community detail response, and the UI should use that instead of synthesizing. **Action item:** when Slice 2's data sources go live, the API's `loadCommunityRecord` should populate `record.aTag` and the UI should read it from there rather than synthesizing.

4. **NB-4 — `publishErrorCopy` duplicated across CommunityDetail and MemberDrawerContent.** Same function ~10 lines defined twice. Trivial DRY win — extract to `src/lib/publishErrorCopy.js`. Not blocking; could be picked up in any future cleanup pass.

5. **NB-5 — The `nostr-tools` bundle bumps the gzip size from ~106 kB to ~146 kB.** Acceptable, expected, on the high side for the eventual mobile-first audience. If/when bundle size becomes a real concern (Slice 6 + Slice 5 will add more), consider lazy-loading the publish + event modules behind a dynamic import — they're not needed until the user signs in.

6. **NB-6 — No real "Sign in" feedback when the extension is being slow.** The button label flips to "Signing in…" but if the extension never resolves (e.g. user ignores the prompt for 60 seconds), the button stays in that state indefinitely. Acceptable for v1; could add a timeout in a follow-up.

## Verdict

**PASS.**

Slice 4 lands the first write surface cleanly: NIP-07 sign-in (with friendly error inlines for the no-extension and rejected paths), the viewer pubkey threads through the API client, three actions (Join, Vouch, Raise-a-concern) build well-shaped kind-39998/39999 events and publish via a mode-toggled wrapper that re-uses Slice 3's `VITE_USE_MOCK_DATA` flag. ConcernDialog adds the optional-comments confirmation UX. `window.nostr` access is centralized in `auth/viewer.js` (improvement over the ADR sketch, surfaced by T9).

132/132 tests pass across 9 suites. ESLint clean (with the documented set-state-in-effect disable). Build clean (~146 kB gzip — nostr-tools is the cost).

Six non-blocking notes; **NB-1** (staging smoke for the live NIP-07 + WebSocket round-trip) is the only operationally-important one. Everything else is future-cleanup territory.

Ready for the deploy chain. **Slice 5 (Create flow + Found publishing)** becomes the next workable slice. The same `publishEvent` wrapper from Slice 4 handles it — Create just needs to call `buildCommunityRecord` (already exists) on the wizard output and publish.
