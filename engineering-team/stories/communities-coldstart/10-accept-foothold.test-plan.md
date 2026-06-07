# Test Plan: Story 10 — Accept a foothold and enter as a newcomer

**Story:** `engineering-team/stories/communities-coldstart/10-accept-foothold.md`
**ADR:** `engineering-team/decisions/communities-coldstart/0040-accept-foothold.md`
**Date:** 2026-06-07

## Approach
New suite `test/accept-foothold.test.js`, registered in `test/test.js`. Two pure cores tested against **real source** via extract-and-eval: `buildInviteRedemption` (`events/build.js`, loader injects `LEGACY_Z_TAG_PUBKEY` + `nowSec`) and `pendingRedemptions` (`lib/invites.js`). The accept banner, the fetches, and the issuer fulfillment effect are source-guards over `CommunityDetail.jsx` / `fetch.js`.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| AC1 see inviter + circle before sign-in | T6 (accept banner: fetch invite + "invited you" copy) | source guard |
| AC2 accept → self-tag + redemption recorded | T1 (redemption shape), T6 (publishes redemption + self-tag) | pure + source guard |
| AC3 issuer fulfills the vouch exactly once | T3/T4 (pendingRedemptions dedup), T7 (publishes buildMembershipAssertion + markFulfilled) | pure + source guard |
| AC4 path to fuller belonging stated | T6 (accept copy) | source guard |
| AC5 expired/unresolvable → path forward | T8 ("ask … for a new one") | source guard |
| AC6 state survives sign-in; specific failure copy | T8 (no "something went wrong"; reuses publish-error copy) | source guard |

## Tests
- **T1** — `buildInviteRedemption({viewerPubkey, issuer, code, communityATag})` → kind-39999; `a`=communityATag; `d`=`redeem-<code>`; `p`=issuer; `z`=`39998:<legacy>:foothold-redemption`; empty content. *(fails now)*
- **T2** — `buildInviteRedemption` rejects missing inputs. *(fails now)*
- **T3** — `pendingRedemptions(reds, fulfilled)` returns only redemptions whose code isn't in the fulfilled set. *(fails now)*
- **T4** — `pendingRedemptions`: empty fulfilled → all; all codes fulfilled → none. *(fails now)*
- **T5** — source guard: `fetchFootholdInvite` (by `#d`=invite-code, foothold-invite `z`) and `fetchRedemptions` (`#p`+`#a`, foothold-redemption `z`) exist. *(fails now)*
- **T6** — source guard: CommunityDetail reads the `?invite=` param, shows an "invited you" banner, and accept publishes `buildInviteRedemption` + the self-tag. *(fails now)*
- **T7** — source guard: the fulfillment path uses `pendingRedemptions` + `buildMembershipAssertion` + `markFulfilled` (publish-once). *(fails now)*
- **T8** — source guard: an unresolvable/expired invite shows "ask … for a new one"; signing-failure copy is specific (no "something went wrong" in the accept path). *(fails now)*

## Edge cases
- [x] Redemption dedup so the vouch fires once (T3/T4 + T7 markFulfilled).
- [x] Addressable redemption (T1 `d`) so the issuer queries by code.
- [x] Expired/unresolvable invite is a path, not a dead end (T8).
- [ ] Keyless newcomer — out of v1 scope (NIP-07 only).
- [ ] App-global fulfillment — out of v1 scope (circle-scoped).

## Test infrastructure
- Runner: `node test/test.js`. New suite exports `{ run }`, registered. Real-source layer extract-and-evals `buildInviteRedemption` (loader injects `LEGACY_Z_TAG_PUBKEY`+`nowSec`) and `pendingRedemptions` (loaded inside tests for the new module). The issuer fulfillment + accept flow are React effects (source-guarded); visible membership needs Story 1 (not tested here).

## How to run
```
node test/test.js
# or: node -e "require('./test/accept-foothold.test.js').run().then(r=>console.log(r))"
```

## Verification
Pure tests fail (no `buildInviteRedemption`/`pendingRedemptions`); source guards fail (no accept/fulfillment). Failing output pasted at the gate.
