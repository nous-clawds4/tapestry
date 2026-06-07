# ADR 0039: Foothold invite — issuer-fulfilled carried vouch (no engine change)

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-coldstart/9-foothold-invite.md`
**Decision input:** Q1 = invite-carries-a-vouch.

## Context
A true outsider (no pubkey, trusted by no one) needs a first foothold. The hard part: the issuer is **not present** when the outsider accepts, and the outsider has **no pubkey** at invite time — so a normal vouch (kind-39999 assertion with `p = recipient`, polarity +1) cannot be pre-published, and the assertion is what the roster engine counts. The roster is read cross-origin (app-as-consumer, ADR-0031); we **cannot** change how it counts.

This ADR covers Story 9 (the *issuing* side); it sets the contract Story 10 (accept + fulfillment) implements.

## Options considered

### Option A — Claim-code redemption interpreted by the tag engine
Issuer publishes an invite vouching a claim code; recipient redeems with their pubkey; the **engine** maps code→pubkey and treats it as a trusted vouch.
- **Pros:** vouch counts the instant of redemption, even if the issuer is offline.
- **Cons:** the dark, valence-naive engine has no notion of redemption — this needs a **new tag-engine capability (Vinney)**, a cross-team dependency. Rejected for v1 (avoidable, see C).

### Option B — Manual deferred vouch
Recipient self-tags on accept; issuer later manually vouches when notified.
- **Cons:** "carried" becomes "do it yourself later"; weak cold-start; relies on the issuer remembering. Rejected.

### Option C — Issuer's client fulfills the carried vouch with a standard vouch
The invite authorizes the vouch; the **issuer's own client publishes the real vouch** (the existing `buildMembershipAssertion`, `p = recipient`, +1) when it observes a redemption of its invite. The recipient self-tags on accept (becomes an applicant immediately); the issuer's vouch lands when their client next processes the redemption (near-instant if they're online — they just shared the link).
- **Pros:** the fulfilled vouch is a **standard kind-39999 assertion the existing roster counts natively — no engine change, no Vinney dependency.** Reuses `buildMembershipAssertion`. Honest cold-start: the recipient enters via the issuer's *real* trust.
- **Cons:** not instant if the issuer is offline at accept (the vouch waits until their client sees the redemption); adds an issuer-side redemption watcher (Story 10).

## Decision
We chose **Option C**. It resolves the open question from the story: **no new cross-team/tag-engine capability is required** — the carried vouch is fulfilled as an ordinary vouch the existing roster already understands. The only gate that remains is the universal one (Story 1 lights-on, for any membership to be visible in prod). The slight delay when the issuer is offline is acceptable for v1 and avoids coupling cold-start to the dark engine.

**Story 9 scope (this ADR):** issue an invite — publish a foothold-invite event, produce the shareable link, list issued invites. **Story 10** implements: the accept flow (recipient identity + self-tag + a redemption event) and the issuer-side watcher that fulfills with `buildMembershipAssertion`.

## Consequences
- **Enables:** cold-start with zero engine change; reuses the existing vouch builder + roster.
- **Constrains:** the carried vouch is not guaranteed instant (issuer-online dependent); v1 invites are simple (see scope).
- **New debt:** an issuer-side redemption watcher (Story 10). A future "instant, issuer-offline" path would be Option A (engine support) — a later ADR if wanted.
- **Visibility** of any of this still waits on Story 1 (lights-on), like all membership.
- **Firmware reinstall?** No. The foothold-invite `z` marker is an app-level convention on the communities relay, not a graph concept — the roster engine filters on `…:nostr-user-tag` and simply ignores it.

## Implementation notes (Story 9 — issuing only)
- **`ui-communities/src/events/build.js`** (or `events/invite.js` new) — pure `buildFootholdInvite({ viewerPubkey, communityATag, code })` → kind-39999 event: `tags: [['a', communityATag], ['d', \`invite-${code}\`], ['p', viewerPubkey], ['z', \`39998:${LEGACY_Z_TAG_PUBKEY}:foothold-invite\`]]`, `content: ''`. Guard `viewerPubkey`, `communityATag`, `code`. Parameterized-replaceable, addressable by `d` so the accept page (Story 10) can fetch the invite by code. Pure (uses `nowSec`). Import `LEGACY_Z_TAG_PUBKEY` from `events/assertion.js`.
- **Code generation** — `crypto.randomUUID()` (fallback to a random string) in the click handler or a module helper, **never in render** (the react-hooks/purity rule — same lesson as Stories 4/5/8).
- **Link shape** — `${location.origin}/community/${slug}?invite=${code}` (the accept route reads `?invite=` in Story 10). Keep the param name stable.
- **`ui-communities/src/pages/CommunityDetail.jsx`** (People area) — an "Invite someone in" affordance for signed-in members: peer-voice copy ("Your invite vouches for them. They can join even if no one else here knows them yet."), a "Create invite" action that builds + `publishEvent(..., { relays: MEMBERSHIP_WRITE_RELAYS })`, shows the resulting shareable link, and lists invites the issuer has created for this circle (fetch the issuer's foothold-invite events by `#a` + author + the `z` marker, or keep a local cache keyed per circle). Empty state ("You haven't invited anyone yet…"), inline error+retry, signed-out → sign-in prompt. Gate creation on `canCompose` (a member) — or at least signed-in; confirm against the membership gate.
- **Fetch (issued list)** — a small `fetchIssuedInvites({ communityATag, issuer })` filtering kind-39999 by `#a` + the foothold-invite `z` + author === issuer; or reuse a local record. Architecture leaves the choice to the Implementer; a fetch is more durable across devices.

## Out of scope (→ Story 10)
- Accepting an invite, recipient identity creation, the redemption event, the issuer-side watcher that fulfills the vouch via `buildMembershipAssertion`, and binding/visibility (needs Story 1).
- Revocation/expiry beyond the `d`-addressable replace; single vs multi-use (default multi-use, simplest).
