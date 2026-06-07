# Review: Story 10 — Accept a foothold and enter as a newcomer

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-07
**Diff:** `git diff` (uncommitted working tree). Pairs with the committed Story 9.
**Story:** `engineering-team/stories/communities-coldstart/10-accept-foothold.md`
**ADR:** `engineering-team/decisions/communities-coldstart/0040-accept-foothold.md` (builds on ADR-0039)
**Test plan:** `engineering-team/stories/communities-coldstart/10-accept-foothold.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. Overall PASS; `accept-foothold suite: PASS (8 passed, 0 failed)`; all other suites still pass (no regressions). Suite exit code `0`.
- [x] Code-hygiene test (`communities-ui-scaffold.test.js:256`, "no lorem/TODO/FIXME/EDITMODE markers ship in ui-communities/src") — **PASS**. Confirms the `todo`→`unfulfilled` rename is clean and no markers leaked.
- [x] `npx eslint src/pages/CommunityDetail.jsx src/events/build.js src/events/fetch.js src/lib/invites.js` — **exit 0** (verified via explicit `$?`).
- [ ] _Typecheck not configured — skipped (JS-without-build, per house rules)._
- [ ] _Build not configured — skipped._

## Spec adherence

Every acceptance criterion has at least one passing test and is satisfied in source.

- [x] **AC1 — see inviter + circle before sign-in (read-only).** Banner at `CommunityDetail.jsx:741` is gated on `inviteCode && inviteContext && !viewerIsMember`; `viewerIsMember` (`:614`) requires `viewer`, so when signed-out it is `false` → banner renders. Copy at `:751-753` shows `npubShort(issuer)` + `{c.name}` before any sign-in. Resolve effect `:315-323` runs on `inviteCode` only. Test T6.
- [x] **AC2 — accept → self-tag + redemption recorded.** `handleAcceptInvite` (`:503-515`) awaits `handleAssert(viewer, 1)` (self-tag) then publishes `buildInviteRedemption(...)` to `MEMBERSHIP_WRITE_RELAYS`. Redemption shape verified by T1; flow by T6.
- [x] **AC3 — issuer fulfills the vouch exactly once.** Fulfillment effect `:323-349` + `pendingRedemptions`/`markFulfilled` (`lib/invites.js`). See "THE KEY ITEM" below. Tests T3/T4 + T7.
- [x] **AC4 — path to fuller belonging stated.** `:751-753` "you'll start as a new member and belong more fully as people here get to know you." Accepted-state copy `:744` "your standing grows as people here vouch for you." Test T6.
- [x] **AC5 — expired/unresolvable invite shows a path forward.** `:747` "This invite has expired. Ask whoever shared it for a new one." (matches the design guide §48 verbatim). Resolve effect maps both null and thrown to `status:'expired'`. Test T8.
- [x] **AC6 — state survives sign-in; specific failure copy.** Two-step accept: `?invite=` is a URL param (`useSearchParams`), so it survives `onSignIn`; the banner re-renders post-sign-in with the Accept action. Publish failure → `publishErrorCopy(res)` (specific network/signing-cancelled copy); thrown error → "Couldn't accept the invite. Try again." Neither path emits "something went wrong" (confirmed by grep + T8).

No criterion silently dropped. No behavior added beyond the story.

## ADR adherence

- [x] **Files match ADR-0040 implementation notes.** New `lib/invites.js` (`pendingRedemptions`/`loadFulfilled`/`markFulfilled`); `events/build.js` `buildInviteRedemption`; `events/fetch.js` `fetchFootholdInvite` + `fetchRedemptions`; `CommunityDetail.jsx` accept banner + `handleAcceptInvite` + resolve effect + fulfillment effect; CSS for the banner; tests. Exactly the surface the ADR authorized.
- [x] **Redemption event shape (ADR §2).** `build.js:303-322`: kind-39999, `a`=communityATag, `d`=`redeem-<code>`, `p`=issuer, `z`=`39998:<LEG>:foothold-redemption`, empty content, `pubkey`=recipient. Guards on all four inputs (T2).
- [x] **`z` marker is NOT `nostr-user-tag`.** Redemption uses `foothold-redemption` (`build.js:318`); the roster counts only `…:nostr-user-tag` (`assertion.js:32,104`; `build.js:278` comment). Confirmed the roster ignores redemptions — no membership-count pollution.
- [x] **Carried vouch is a STANDARD assertion (ADR §3, ADR-0039 Option C).** Fulfillment publishes `buildMembershipAssertion({ viewerPubkey: issuer, target: recipient, tagElement, polarity: 1 })` (`:340`) — the same `nostr-user-tag` builder the roster counts natively. No engine change.
- [x] **Reuse correctness.** `handleAssert(viewer, 1)` is called only inside `handleAcceptInvite`, which returns early unless `signedIn && viewer` (`:504`) — viewer is settled. `resolveTagElement(currentCommunity.claims[0])` used in the fulfillment effect (`:337-338`), mirroring `handleAssert`'s own claim resolution (`:211-216`).
- [x] **No new dependencies.** No new tooling; uses existing `useSearchParams`, `npubShort`, `publishErrorCopy`, `MEMBERSHIP_WRITE_RELAYS`.

## THE KEY ITEM — issuer fulfillment idempotency (AC3)

Fulfillment effect `CommunityDetail.jsx:323-349`:

- [x] **(a) Publishes once per redemption.** `markFulfilled(viewer, r.code)` is called only on `res.ok` (`:343`), persisting the code to per-issuer localStorage. On the next circle-open, `loadFulfilled(viewer)` + `pendingRedemptions` (`:333`) exclude it. Belt-and-suspenders: the assertion is addressable (`d=profile-tag-<slug>-<target8>-<asserter8>`), so any stray re-publish *replaces*, never duplicates — correctness-idempotent even if localStorage is wiped.
- [x] **(b) Non-issuers are no-ops.** `fetchRedemptions({ issuer: viewer, communityATag })` filters `#p:[viewer]` + `z` endsWith `foothold-redemption` (`fetch.js:181-188`). Redemptions name the *issuer* in `p`; a non-issuer viewer matches nothing → `reds.length === 0` → early return (`:332`). No publish.
- [x] **(c) Deps + `cancelled` guard correct; no loop.** Deps `[signedIn, viewer, currentCommunity, communityATag, triggerRetry]`. `triggerRetry` is a `useCallback(..., [])` (`:161`) — stable identity, so including it does not re-fire the effect. The effect *calls* `triggerRetry()` (`:345`), which bumps `retryNonce`; `retryNonce` is **not** in this effect's deps, so the bump re-runs the roster fetch but **not** the fulfillment effect → no loop. Even if it did re-run, `markFulfilled` makes `pendingRedemptions` empty → no-op. `cancelled` guards every async boundary (`:330,334,339,341,344`); state writes are guarded, no set-after-unmount. The only state write here is the indirect `triggerRetry()`, which is guarded by `if (!cancelled)`.
- [x] **Zero-redemption circle.** `if (cancelled || !reds.length) return` (`:332`) — clean no-op, no tag-element resolution, no publish.
- [x] **Unresolvable tag-element.** `if (!tagEl || cancelled) return` (`:339`) — if the circle's claim can't resolve, fulfillment is skipped silently and retries next visit (no `markFulfilled`, so it stays pending). Correct.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form — `a`=communityATag (passed through), `z`=`39998:<LEG>:foothold-redemption`.
- [x] **Firmware reinstall: not required.** `foothold-redemption` is an app-level `z` convention the dark engine ignores (ADR-0040 §39, ADR-0039 §39). No concept definition changed.
- [x] No re-derivation from BIBLE.md; reuses existing builders/markers.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log` in new code (the lone `console.warn` in `fetch.js:68` is the pre-existing relay-connect helper, untouched).
- [x] No commented-out code (only explanatory comments).
- [x] Error paths handled: expired/unresolvable invite (path forward), publish failure (specific copy), thrown accept (fallback copy), fulfillment failure (silent retry-next-visit, documented `catch`), localStorage quota/private-mode (`catch` in `loadFulfilled`/`markFulfilled`).
- [x] Concurrency/races: `cancelled` guards on unmount; `acceptState.accepting` guards double-submit (`:504`); idempotent fulfillment.
- [x] Security/input validation: `buildInviteRedemption` guards all four inputs; fetch filters are scoped (`#p`+`#a`+`z`); no injection vector (event tags are plain strings).
- [x] No `Date.now`/`Math.random` in render or in the new `invites.js`; `buildInviteRedemption` uses `nowSec()`. The pre-existing `Date.now`/`Math.random` hits are in unrelated click handlers / local-id helpers, not the Story 10 path.

## House rules check

- [x] Concept Graph API authority respected (no concept redefinition).
- [x] No new lint/typecheck/build tooling.
- [x] Token CSS only (`--accent-muted`, `--accent`, `--radius-md`, `--text-sm`, `--space-*` all in `tokens.css`); no hardcoded values.
- [x] Peer-voice copy; no "approve"/"admit"/"Submit"; no "something went wrong".

## Scope (documented, not silent gaps)

- [x] NIP-07 only; keyless-newcomer onboarding deferred (story Out-of-scope, ADR §1, design guide §47 noted). The banner correctly avoids promising identity creation.
- [x] Fulfillment is circle-scoped, not app-global (ADR §3 trade-off documented; app-global watcher logged as future debt).
- [x] Visible membership waits on Story 1 / lights-on (story §15, ADR §9).

## Pure cores (real source)

- [x] T1–T2 extract-and-eval `buildInviteRedemption` from `events/build.js` (loader injects `LEGACY_Z_TAG_PUBKEY` + `nowSec`).
- [x] T3–T4 extract-and-eval `pendingRedemptions` from `lib/invites.js`. Genuine source, not a re-implementation.

## Findings

### Blocking
None.

### Non-blocking
1. **`CommunityDetail.jsx:507`** — `handleAssert(viewer, 1)` sets its own `publishError` on failure but does not throw, so `handleAcceptInvite` proceeds to publish the redemption even if the self-tag failed. The issuer's vouch still lands (the redemption is what triggers it) and the self-tag is addressable/retriable, so this is benign for v1; the recipient is fully recoverable on a later visit. Optional: surface a single combined accept status rather than relying on `handleAssert`'s separate `publishError`. Not required for any AC.

## Verdict
**PASS** — All eight new tests pass, the full suite is green with no regressions, eslint is clean, and the implementation conforms to the story's six acceptance criteria and ADR-0040. The redemption `z` marker is correctly distinct from `nostr-user-tag` (no count pollution); the carried vouch is a standard `buildMembershipAssertion` the roster counts with no engine change; issuer fulfillment is idempotent via per-issuer localStorage plus an addressable assertion, with correct effect deps and no infinite-loop / set-after-unmount risk. Copy, tokens, and scope all hold. The one non-blocking finding is a minor recoverable edge case.

PASS
