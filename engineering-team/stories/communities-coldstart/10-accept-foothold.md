# Story 10: Accept a foothold and enter as a newcomer

**Status:** Done
**Created:** 2026-06-07
**Type:** Feature
**Epic:** `communities-coldstart` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.4 · **Queue:** `product-team/stories-queue.md` Block D, Story 10
**Pairs with:** Story 9 (issuing). ADR-0039 Option C — the issuer's client fulfills the carried vouch.

## Background
Story 9 lets a member create an invite that carries their vouch. This story is the other side: a person opens that invite, enters the circle through the issuer's extended trust, and the carried vouch is fulfilled. Two halves:
1. **Accept (recipient):** open the invite link, see who invited them and which circle (read-only, before sign-in), sign in with their portable identity, and on accepting, self-tag into the circle and signal their redemption of the invite.
2. **Fulfill (issuer):** the issuer's client, when it next sees a redemption of one of its invites, publishes the real vouch (a standard membership assertion for the recipient) — so the recipient crosses from "just arrived" to a vouched member.

This completes cold-start: the outsider enters via a person's real trust, not an admin's approval. (Visibility of the resulting membership still waits on lights-on / Story 1, like all membership.)

Affected: the Newcomer (true outsider) entering; the Convener whose invite admits them.

## User-facing description
As someone who received an invite, I want to open it, see who invited me and where, and join through their vouch — so I can get a first foothold in a circle even though no one there knew me before.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] Opening an invite link, a visitor sees who invited them and which circle, in plain prose, **before** signing in.
- [ ] On accepting (signing in with a portable identity), the recipient is self-tagged into the circle and a redemption of the invite is recorded, so the issuer can fulfill the vouch.
- [ ] The issuer's client, when it observes a redemption of one of its invites, publishes the carried vouch (a standard membership assertion for the recipient) — exactly once per redemption.
- [ ] After accepting, the path from "just arrived" to fuller belonging is stated in plain words.
- [ ] An expired or unresolvable invite shows a path forward ("ask whoever shared it for a new one"), never a dead end.
- [ ] Intended state survives the sign-in step; a signing failure shows specific copy (network / signing cancelled), never "something went wrong".

## Concepts touched
- **Foothold Invite** (from Story 9) — fetched by its code to resolve issuer + circle.
- **Redemption** (new) — the recipient's signal that they accepted invite `<code>`, binding their pubkey, so the issuer can fulfill.
- **Carried vouch** — the issuer's standard membership assertion (`buildMembershipAssertion`, +1) published on redemption; counted natively by the roster.
- The recipient's **self-tag** ("I'm in") — makes them an applicant immediately, before the issuer's vouch lands.

## Out of scope
- **Keyless onboarding** (a person brand-new to nostr with no key): v1 accept uses an existing portable identity (NIP-07). Generating/backing up a fresh key in-browser is a deeper onboarding — defer (note for a later story), keeping to the crypto policy (no hand-rolled crypto).
- Visible membership in production (depends on lights-on / Story 1).
- Invite revocation/expiry management beyond detecting an unresolvable/expired invite.
- Multi-use accounting / per-invite caps.

## Open questions (for Architecture)
- **Redemption event shape** — how the recipient signals "I redeemed code `<X>`, pubkey `<P>`" so the issuer can find it by code (e.g. a kind-39999 with a foothold-redemption `z` and `d`/ref to the code). Must be queryable by the issuer.
- **Issuer-side watcher** — when/where the issuer's client checks for redemptions of its invites (e.g. on app load / alongside the notifications fetch) and publishes the vouch **idempotently** (exactly once — don't double-vouch on every load). How idempotency is enforced (the assertion is addressable per target, so re-publishing is harmless, but avoid churn).
- **Accept identity** — NIP-07 sign-in for v1 (confirm); the keyless-newcomer path is deferred.
- **Where the invite code is read** — the `?invite=<code>` param on the circle route (Story 9's link shape) resolves to the invite event; confirm the route handling.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-coldstart/0040-accept-foothold.md` (accept = NIP-07 + self-tag + redemption event; issuer fulfills the carried vouch circle-scoped, idempotent; reuses buildMembershipAssertion — no engine change)
- Test plan: `engineering-team/stories/communities-coldstart/10-accept-foothold.test-plan.md` (new suite `test/accept-foothold.test.js`: real-source buildInviteRedemption T1–T2 + pendingRedemptions T3–T4, accept/fetch/fulfillment guards T5–T8)
- Review: `engineering-team/reviews/communities-coldstart/10-accept-foothold.md` (PASS, 2026-06-07)
