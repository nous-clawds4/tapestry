# Story 4: Wire to an external shared concept on My Assistant rows

**Status:** Done
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `list-headers-disposition`
**Book:** `engineering-team/audits/list-headers-disposition/book.md`

## Background

Story 3 put **Submit as a Shared Concept** and **Keep private** on List Headers, for every kind-39998 header the
signed-in person's own Assistant wrote. Only that Assistant can sign, a request from another site is refused, and a
header that can't be verified as the Assistant's is never re-signed. This story adds the third action from Concept
Headers' panel, **Wire to an external shared concept**, under the same rule.

Wiring says "this header of mine corresponds to that shared concept": a b-tag pointing at someone else's header.
- On Concept Headers today, Wire signs as the Owner's Assistant, and any admin can trigger it (OPEN.md row
  `2026-10-01-concept-headers-disposition-owner-signer`).
- On this machine the Owner's Assistant already has 10 wired headers, all wired from Concept Headers.

The owner decided at planning (2026-10-01) that a pasted target can be **any header address**, as on Concept Headers.
A shared concept that lives on a relay the pick-list doesn't search can still be wired, and catching a typo is the
person's job.

## User-facing description

As a signed-in person, I want to wire my Assistant's list headers to other people's shared concepts from List
Headers, so that I can say which shared concept each of my headers corresponds to. My Assistant does the signing,
and nobody else can make it, or anyone else's, sign.

## Acceptance criteria

- [ ] **The Wire section.** Given the Disposition panel on one of the viewer's own Assistant's rows, whatever its
      state, the panel shows a **🔗 …or wire to an external shared concept** section with:
      - an address field;
      - a **Wire** button, which can't be clicked while the field is empty;
      - a pick-list of the Shared Concepts on the community relay, by name, with the description on hover. Picking
        one puts its address in the field. While the list loads, the panel says it is searching the community relay.
- [ ] **Wire.** Given an undecided, self-declared or kept-private row and a target address, picked or pasted, when
      the person clicks **Wire**:
      - a new version of the header is saved on this instance (relay and graph), signed by the person's own
        Assistant, with every earlier tag kept except the keep-private marker, plus a b-tag pointing at the target;
      - it is sent to the community relay;
      - the row then shows 🔗, next to 🤝 if it was self-declared, without a reload;
      - the panel says which happened (published, kept here because external publishing is off, or not delivered
        but saved here), then offers **Next undecided →** and **Done** as after the other actions.

      Given a row already wired to a *different* target, the new wiring is added and both are kept.
- [ ] **Already wired.** Given a row already wired to the same target, nothing new is signed. The existing version
      is sent to the community relay again, and the panel says it was already wired.
- [ ] **A target that can't be wired.** When the field doesn't hold a header address (`kind:pubkey:d-tag`), or it
      holds the header's own address, nothing is signed and the panel says why. For its own address, it points the
      person to **Submit as a Shared Concept**.
- [ ] **Nobody else's signer.** Given any request to wire, this instance signs nothing, saves nothing and answers
      with a refusal for every case story 3 refuses:
      - a request from another site;
      - no signed-in session, including a call from inside the container;
      - a header that wasn't written by the caller's own Assistant;
      - a caller with no Assistant here;
      - kind 9998, or a header that doesn't exist;
      - a header that can't be verified as the caller's Assistant's.

      Concept Headers' Wire behaves exactly as it does today.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:list`: **list** (the headers being
  re-signed). Handle as it reads in this machine's graph; the pubkey part differs per instance.
- Shared Concepts on the community relay, which are other authors' headers that point at themselves: the targets
  the pick-list offers.
- The b-tag's pointer form and the keep-private marker, with the meanings Concept Headers already uses
  (community-reference ADR 0029; shared-concepts-adoption ADR 0001).

## Out of scope

- **Checking that a pasted address is a known Shared Concept.** That was the owner's decision.
- **Wiring Me rows.** That's story 5, signed by the person's own browser signer.
- **Removing a wiring, or choosing the b-tag's type.** Wiring always adds a `pointer` b, as on Concept Headers.
- **Searching more relays for the pick-list.** It shows what Concept Headers' pick-list shows: the community relay.
- **Concept Headers' Wire.** It keeps its current signer until its own fix.

## Open questions

None.

## Linked artifacts
- ADR: `engineering-team/decisions/list-headers-disposition/0004-wire-on-my-assistant-rows.md`
- Test plan: `engineering-team/stories/list-headers-disposition/4-wire-on-my-assistant-rows.test-plan.md`
- Review: `engineering-team/reviews/list-headers-disposition/4-wire-on-my-assistant-rows.md`
