# Story 9: Extend a foothold invite

**Status:** Done
**Created:** 2026-06-06
**Type:** Feature
**Epic:** `communities-coldstart` · **Book:** `audits/communities-v2/book.md`
**PRD:** `product-team/prd/communities-v2.md` §5.3 · **Queue:** `product-team/stories-queue.md` Block D, Story 9
**Decision:** Q1 resolved — **invite-carries-a-vouch** (PRD §11 Q1).

## Background
A founder can only grow a circle past their own network if a true outsider — trusted by no one — can get a first foothold. Q1 settled the mechanism: a member extends an **invite that carries their vouch**, so the recipient can join even though no one else knows them yet. This story is the *issuing* side: a member creates an invite from a circle, gets a shareable link, and can see the invites they've created. The recipient's acceptance (creating an identity, the vouch taking effect) is Story 10. Worded as a personal act of trust, never an approval.

Affected: the Convener (and any member) bringing someone in.

## User-facing description
As a signed-in member of a circle, I want to create an invite that vouches for whoever accepts it, so that I can bring in someone new even when no one else here knows them yet.

## Acceptance criteria
Testable from the outside. Each gets at least one test.

- [ ] A signed-in member can create an invite from a circle and receive a shareable link.
- [ ] The invite flow states plainly that the invite vouches for the recipient and that the issuer's vouch stands behind them (peer voice, not "approve/admit").
- [ ] An issuer can see the invites they have created (for that circle).
- [ ] Before any invite exists, an empty state explains what an invite is for.
- [ ] A failed invite creation shows an inline error with retry; nothing is silently half-created.
- [ ] Signed out, the create action is replaced by a sign-in prompt (no disabled control).

## Concepts touched
- **Foothold Invite** (new) — an entry a member extends that confers a first foothold without requiring pre-existing trust; carries the issuer's vouch, binds a recipient on acceptance.
- The **carried vouch** — the issuer's membership assertion that activates for the recipient on accept (Story 10). Its exact shape is the central architecture question (see Open questions).
- The circle and its claimed membership tag.

## Out of scope
- **Accepting** an invite / the recipient creating an identity / the vouch *activating* and producing visible membership → **Story 10**.
- Revoking or expiring invites beyond a basic lifecycle marker (full invite management is later).
- Making the carried vouch *count in the live roster* — depends on lights-on (Story 1) and possibly the tag engine (see Open questions).

## Open questions (the central one is for Architecture)
- **The carried-vouch mechanism — the hard part.** The issuer is *not present* when the recipient accepts, and the recipient has *no pubkey yet*, so a normal vouch (kind-39999 assertion targeting the recipient) can't be pre-published. The Architect must decide how an absent issuer's vouch binds to a not-yet-existent identity and how it counts in the (dark, valence-naive) roster engine. Candidate shapes: a signed invite event vouching a **claim code** that the recipient redeems on accept (Story 10), then a consumer maps code→pubkey; or a delegated/pre-authorized credential. **This may surface a tag-engine capability dependency (Vinney)** — if so, kick back and flag it; the *issuing UI + link + list* in this story can still ship, but the end-to-end vouch may need engine support. Resolve in Architecture before committing to the wire shape.
- Invite link shape (what it encodes: circle coordinate + issuer + claim code) and where issued invites are stored/read (device-local vs a signed event) — Architecture.
- Whether an invite is single-use or multi-use, and any expiry — Architecture; default to the simplest that satisfies the ACs.

## Linked artifacts
- ADR: `engineering-team/decisions/communities-coldstart/0039-foothold-invite.md` (Option C — issuer's client fulfills the carried vouch with a standard kind-39999 assertion; NO engine change. Story 9 = issuing only; fulfillment = Story 10)
- Test plan: `engineering-team/stories/communities-coldstart/9-foothold-invite.test-plan.md` (new suite `test/foothold-invite.test.js`: real-source buildFootholdInvite T1–T2, issuing-UI guards T3–T6)
- Review: `engineering-team/reviews/communities-coldstart/9-foothold-invite.md` (PASS, 2026-06-07)
