# Story 5: Disposition on Me rows — the same three actions, signed by your own browser signer

**Status:** Done
**Created:** 2026-10-01
**Type:** Feature
**Epic:** `list-headers-disposition`
**Book:** `engineering-team/audits/list-headers-disposition/book.md`

## Background

Stories 3 and 4 let a signed-in person settle what their own *Assistant's* list headers are, on List Headers:
**Submit as a Shared Concept**, **Keep private**, or **Wire to an external shared concept**. The Assistant signs, on
the server, and nobody else's Assistant can be made to.

This story does the same for headers the person wrote **with their own key**: the **Me** rows from story 1. Book
decision 1 says the person's own browser signer (NIP-07) signs these, so the person is literally the author. The
instance never holds or sees the person's private key. It only checks what the signer produced.

Who this serves today:

| Instance | The Owner's own-key kind-39998 headers |
|---|---|
| This machine | 6, all undecided |
| Staging | 28, 27 undecided |

No customer has a header under their own key on either instance.

The owner decided at planning (2026-10-01) that **Next undecided →** walks one kind of row at a time:
- from a **Me** row, it goes to the person's next undecided Me row;
- from an Assistant row, it goes to their Assistant's next undecided row, as now.

A Me walk asks the browser signer at each step, and an Assistant walk never does, so mixing them would interleave
signer prompts unexpectedly.

## User-facing description

As a signed-in person, I want to submit, keep private, or wire the list headers I wrote myself, from List Headers,
signing each new version with my own browser signer, so that I stay the author of my own headers and nobody else's
key is ever involved.

## Acceptance criteria

- [ ] **Who gets the button.** Given a signed-in person, a **Disposition…** button appears on every kind-39998
      row their own account wrote, whatever its disposition, as it does on their Assistant's rows. No button
      appears on rows written by anyone else, on kind-9998 rows, or on any row when signed out.
- [ ] **The same three actions, signed by the person.** Given one of their Me rows, the panel offers
      **Submit as a Shared Concept**, **Keep private** and **Wire**, with the same changes, rules and messages as on
      their Assistant's rows:
      - Submit adds the self-pointing b and drops the keep-private marker;
      - Keep private is only for an undecided row;
      - Wire takes a bounded list-header address that isn't the header's own.

      For each action that makes a new version:
      - the person's browser signer is asked to sign it;
      - it is saved on this instance, and the relay is checked to have kept it before the graph follows;
      - Submit and Wire send it to the community relay;
      - the row then shows its new state without a reload;
      - the panel says honestly what happened.

      When nothing new is needed (already self-declared, already private, already wired to that target), the
      signer isn't asked at all.
- [ ] **When the signer can't or won't sign.** Nothing is saved, and the panel says why, when:
      - the browser has no signer available;
      - the person declines in their signer;
      - the signer holds a key other than the signed-in account's.
- [ ] **Nothing but the person's own change, signed by the person.** Given any request to save a new version of a
      Me row, this instance saves nothing and answers with a refusal when:
      - it comes from another site;
      - there is no signed-in session, including a call from inside the container;
      - the header wasn't written by the signed-in account, or is kind 9998, or doesn't exist here;
      - the stored header can't be verified as that account's;
      - the new version isn't signed by the signed-in account, doesn't verify, or makes any change other than the
        one the chosen action makes.

      The instance never receives the person's private key. Concept Headers behaves as it does today.
- [ ] **Next stays with one signer.** After an action on a Me row, **Next undecided →** opens the person's next
      undecided **Me** row, when there is one. Otherwise the panel offers only **Done**. From an Assistant row,
      **Next** still walks only the Assistant's rows.

## Concepts touched

- `39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:list`: **list** (the headers being
  re-signed). Handle as it reads in this machine's graph; the pubkey part differs per instance.
- The signed-in person's own key, through their browser signer. It is not a concept-graph node.
- The b-tag, its self-pointing form, its pointer form, and the keep-private marker, with the same meanings as in
  stories 3 and 4.

## Out of scope

- **Wiring to a kind-9998 header by event id.** It's out for Me rows too, as for Assistant rows.
- **Signing several rows with one prompt.** Each Me action asks the signer once.
- **Choosing which signer to use.** Whatever signer the browser provides is used: the one the person signed in
  with.
- **Concept Headers and New DList's "Sign as Assistant".** Both are the deferred fixes in OPEN.md rows
  `2026-10-01-concept-headers-disposition-owner-signer` and `2026-10-01-new-dlist-assistant-signer`.
- **The read-back hardening items in OPEN.md row `2026-10-01-list-headers-readback-hardening`.** They apply to
  whatever the Architect reuses, and stay filed.

## Open questions

None.

## Linked artifacts
- ADR: `engineering-team/decisions/list-headers-disposition/0005-me-rows-prepare-sign-commit.md`
- Test plan: `engineering-team/stories/list-headers-disposition/5-disposition-on-me-rows.test-plan.md`
- Review: `engineering-team/reviews/list-headers-disposition/5-disposition-on-me-rows.md`
