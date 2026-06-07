# ADR 0040: Accept a foothold + issuer-side vouch fulfillment

**Status:** Proposed
**Date:** 2026-06-07
**Story:** `engineering-team/stories/communities-coldstart/10-accept-foothold.md`
**Builds on:** ADR-0039 (foothold invite, Option C). Completes the cold-start pair.

## Context
Story 9 publishes a foothold-invite event (kind-39999, `d=invite-<code>`, `z=…:foothold-invite`, `a`=circle, `p`=issuer). Story 10 must: (a) let an invited person open the link, see the inviter + circle before signing in, and join through the issuer's trust; (b) have the **issuer's client fulfill the carried vouch** (Option C). The vouch must be a *standard* membership assertion so the existing roster counts it — no engine change. Visibility waits on lights-on (Story 1).

Reusable pieces already exist: `buildMembershipAssertion` (the self-tag and the vouch), `resolveTagElement` + a circle's `claims` (to get the tag-element), `handleAssert` (the existing "I'm in" self-tag flow), NIP-07 sign-in (`onSignIn`), `publishEvent` + `MEMBERSHIP_WRITE_RELAYS`, and Story 9's invite event.

## Decision

**1. Accept (recipient), v1 = existing portable identity (NIP-07).**
- The circle route reads `?invite=<code>`. The page fetches the invite by `d=invite-<code>` → resolves issuer + circle, and shows "‹inviter› invited you into ‹circle›. Their vouch is your way in." **read-only, before sign-in**.
- Accept → `onSignIn` (NIP-07). On success, publish two events:
  - the recipient's **self-tag** (reuse the existing `handleAssert(self, +1)` path → a standard kind-39999 assertion → applicant immediately), and
  - a **redemption** event (new) signalling "I redeemed `<code>`", so the issuer can fulfill.
- Keyless-newcomer onboarding (no nostr key at all) is **deferred** (crypto policy — no hand-rolled keygen); v1 serves the stranger-with-an-identity, which is still cold-start (trusted by no one here).

**2. Redemption event (new, the issuer's trigger).**
- `buildInviteRedemption({ viewerPubkey: recipient, issuer, code, communityATag })` → kind-39999, `tags: [['a', communityATag], ['d', 'redeem-<code>'], ['p', issuer], ['z', '39998:<LEGACY_Z_TAG_PUBKEY>:foothold-redemption']]`, empty content, author = recipient. Addressable by code; `p=issuer` so the issuer finds it; `a` carries the circle. The engine ignores this `z` (no membership-count pollution).

**3. Fulfillment (issuer), scoped to the circle view.**
- When the issuer opens the circle (CommunityDetail), the client fetches redemptions naming them for this circle (`{kinds:[39999], '#p':[viewer], '#a':[communityATag]}` filtered to the foothold-redemption `z`), and for each redemption **not already fulfilled**, publishes the carried vouch: `buildMembershipAssertion({ viewerPubkey: issuer, target: recipient, tagElement, +1 })` — the standard assertion the roster counts.
- **Idempotency:** the assertion is addressable (`d=profile-tag-<slug>-<target8>-<asserter8>`), so re-publishing replaces rather than duplicates — fulfillment is *correctness-idempotent* for free. To avoid churn (re-publishing every circle-open), track fulfilled redemption codes in `localStorage` (per issuer) and skip them; a pure `pendingRedemptions(redemptions, fulfilledSet)` decides what's new.
- **Scope choice:** fulfillment runs in the circle view (where the tag-element is already resolved), not an app-global hook. Trade-off: the vouch fires when the issuer next opens that circle (not on any page). Acceptable v1 — the issuer who just shared a link is engaged; an app-level watcher is a future enhancement. The recipient is an applicant (self-tag) until then.

## Options considered
- **App-global fulfillment hook** (like `useNotifications`): fires on any app load. More reliable, but more cross-cutting surface; deferred in favor of the simpler circle-scoped fulfillment for v1.
- **Recipient self-publishes the vouch via delegation** (NIP-26): rejected in ADR-0039 (delegatee unknown at invite time).
- **No redemption event; issuer manually vouches:** rejected — that's the weak "do it yourself later" path.

## Consequences
- **Enables:** end-to-end cold-start with no engine change — outsider enters via the issuer's real, roster-counted vouch.
- **Constrains:** vouch fires on the issuer's next visit to that circle (not instant if they're away); keyless newcomers deferred; visibility waits on Story 1.
- **New debt:** an app-global fulfillment watcher (future) for reliability; keyless onboarding (future).
- **Firmware reinstall?** No — `foothold-redemption` `z` is an app convention the engine ignores.

## Implementation notes
- **`ui-communities/src/events/build.js`** — pure `buildInviteRedemption({ viewerPubkey, issuer, code, communityATag })` (shape above; guards on all four). Reuse `LEGACY_Z_TAG_PUBKEY`.
- **`ui-communities/src/events/fetch.js`** — `fetchFootholdInvite({ code, relays, timeout })` → fetch the single invite by `#d=invite-<code>` filtered to the foothold-invite `z` → `{ issuer (p), communityATag (a), id, createdAt }` (or null if unresolvable/expired). `fetchRedemptions({ issuer, communityATag })` → `{kinds:[39999], '#p':[issuer], '#a':[communityATag]}` filtered to the foothold-redemption `z` → `[{ code (from d), recipient (author), createdAt }]`.
- **`ui-communities/src/lib/invites.js`** (new, pure) — `pendingRedemptions(redemptions, fulfilledCodes)` → redemptions whose code isn't in the fulfilled set. Plus `loadFulfilled(pubkey)` / `markFulfilled(pubkey, code)` (localStorage, mirrors notif last-seen). The pure `pendingRedemptions` is the testable core.
- **`ui-communities/src/pages/CommunityDetail.jsx`**
  - Read `?invite=<code>` (via `useSearchParams` / the router). If present and the invite resolves, show an **accept banner** (inviter + circle, before sign-in). Accept → `onSignIn` if needed → `handleAssert(viewer, 1)` (self-tag) + `publishEvent(buildInviteRedemption(...), { relays: MEMBERSHIP_WRITE_RELAYS })`. State the path to fuller belonging; an unresolvable/expired invite shows the "ask for a new one" path; signing failure → specific copy (reuse the existing publish-error copy).
  - **Fulfillment effect** (issuer viewing their circle): fetch redemptions for `(viewer, communityATag)`, compute `pendingRedemptions` vs `loadFulfilled(viewer)`, resolve the circle's tag-element once (`resolveTagElement(currentCommunity.claims[0])`), and for each pending redemption publish `buildMembershipAssertion(issuer→recipient, +1)` then `markFulfilled`. Guard against running for non-issuers / when there are no invites.
- **Reuse:** `buildMembershipAssertion`, `resolveTagElement`, `MEMBERSHIP_WRITE_RELAYS`, `publishErrorCopy`, the existing `handleAssert` self-tag.

## Out of scope
- Keyless-newcomer keygen onboarding; app-global fulfillment watcher; invite revocation/expiry management; multi-use caps. Visible membership (Story 1).
