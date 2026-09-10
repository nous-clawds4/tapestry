# Story 2: Addressable-target assertion `d`-tag collision (spec fix)

**Status:** Draft
**Created:** 2026-09-09
**Type:** Feature — protocol/spec fix *(escalated to **Standard** — all phases, Test Design
included: the wire-format irreversibility trigger fires and the deliverable adds a core source
file; a full ADR is required — workflows/light-profile.md § Gate A)*

## Background
[Event Taggings](../../../protocols/drafts/event-taggings.md) § "The assertion d-tag (normative)"
makes an assertion's `d` deterministic so each asserter holds exactly one live stance per
(descriptor, target):

```
d = event-tag-<descriptor>-<target8>-<asserter8>
```

For an `e` target, `<target8>` is the first 8 hex of the event id — unique per target. For an
`a` target the spec (and `src/lib/event-tagging/builders.js:146-147`, pinned by
`test/event-tagging-core.test.js:117-130`) takes `<target8>` from the **author-pubkey segment of
the coordinate**. Every addressable event by the same author therefore maps to the **same**
`target8`, so one asserter applying one tag to two items by the same author mints two assertions
at the same replaceable address — the second silently replaces the first.

This was latent while `a` targets were only tag-elements. It is fatal for DList-item tagging: on
the `github-accounts` list four of seven items share an author (`b83a28b7…`). Tagging `vcavallo`
and then `aburra16` as "white hat hacker" would leave only the second tagging alive. Story 3 (the
tagging affordance) cannot ship on top of this.

## User-facing description
As a user tagging items on a Decentralized List, I want each (tag, item) stance I publish to
stand on its own, so that tagging a second item by the same author never erases my tagging of
the first.

## Acceptance criteria
- [ ] AC-1: Given two addressable targets with the same author and different `d` values, when
      the same asserter builds an assertion for the same tag against each, then the two
      assertions have **different** `d` tags.
- [ ] AC-2: Given the same (tag, target, asserter), building the assertion twice yields the
      **same** `d` tag (still deterministic; republishing still replaces).
- [ ] AC-3: Given an `e` target, the `d` tag is unchanged from today (`event-tag-<slug>-<id8>-
      <asserter8>`) — no regression for note taggings already in the wild.
- [ ] AC-4: The spec's "The assertion d-tag (normative)" section states the new `a`-target rule,
      records the old rule as superseded with the date, and states the compatibility posture for
      assertions already published under the old rule.
- [ ] AC-5: An ADR under `engineering-team/decisions/dlist-item-tagging/` records the options
      considered (at least: hash of the full coordinate; author8 + d-slug; full coordinate
      verbatim) and the consequences, including relay `d`-tag length limits and the read side
      (readers key on `#a`, never on parsing `d` — verify and state).
- [ ] AC-6: `test/event-tagging-core.test.js`'s pinned expectation for the addressable case is
      updated to the new rule, and a new regression test covers AC-1 explicitly.

## Concepts touched
- `39998:<TA>:nostr-event-tag` — the assertion shape (its `d` derivation).
- `39998:<TA>:tagging-with-specific-tag` — unaffected (header `d` stays `tagging:<slug>-tagging`).
- Spec: `protocols/drafts/event-taggings.md` § d-tag; `protocols/README.md` status row if changed.

## Out of scope
- Any UI (story 3). Any change to `e`-target derivation. Migration of already-published
  `a`-target assertions (state the posture; do not build a migrator).

## Open questions *(for the Gate)*
1. **Derivation.** Recommendation: `target8 = sha256(<full a-coordinate>)` first 8 hex — fixed
   length, no `d`-length risk, unambiguous, and the same shape as the `e` case (8 hex of an
   identifier). Alternative `author8-<d>` is human-readable but unbounded in length.
2. **Compatibility posture.** Recommendation: no migration; readers already key on `#a` (verify
   at Architecture), so old-rule assertions stay readable; a user who re-asserts under the new
   rule leaves one orphan old-rule event that the interpretation buckets identically. Record
   how many old-rule `a`-target assertions exist on the reference relays at Architecture time.
3. **Upstream.** The protocol author (David) owns the draft — this story amends the working copy
   here and the ADR names the upstream notification as a follow-up.

## Linked artifacts
- ADR: `engineering-team/decisions/dlist-item-tagging/0001-addressable-target-dtag.md` (Proposed)
- Test plan: (pending)
- Review: `engineering-team/reviews/dlist-item-tagging/2-addressable-target-dtag-collision.md`

Link by path only — never record verdicts or round history in this file.
